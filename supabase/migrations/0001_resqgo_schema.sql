-- =============================================================================
-- ResQGo — Supabase / PostGIS スキーマ（本番用・フルリセット対応）
-- =============================================================================
--
-- 適用方法（推奨）:
--   GitHub Actions → "Ops - Supabase Bootstrap" → Run workflow
--   （Repository secret: SUPABASE_DB_URL = Dashboard → Database → Connection string URI）
--
-- 手動: Supabase SQL Editor に本ファイル全文を貼り付けて実行
--
-- 注意: §0 RESET はアプリデータを削除します（auth.users / profiles 含む）
--
-- §0  RESET — レガシーオブジェクト削除
-- §1  Extension
-- §2  Tables
-- §3  Indexes & constraints
-- §4  Privileges（テーブル直叩き最小化）
-- §5  Row Level Security
-- §6  Auth trigger
-- §7  Domain helpers
-- §8  RPC — SOS 投稿（レート制限付き・唯一の anon 投稿経路）
-- §9  RPC — 近傍検索（要認証・二重チェック）
-- §10 RPC — 地図フォールバック
-- §11 RPC — Keep-alive（実 DB 書き込み）
-- §12 Realtime
-- §13 Seed（デモ避難所・重複不可）
-- =============================================================================


-- =============================================================================
-- §0 RESET
-- =============================================================================
drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.create_sos_emergency(text, text, text, text, double precision, double precision);
drop function if exists public.search_nearby_emergencies(double precision, double precision, double precision);
drop function if exists public.search_nearby_emergencies(double precision, double precision, double precision, text);
drop function if exists public.search_nearby_evacuation_centers(double precision, double precision, double precision, text);
drop function if exists public.fetch_all_map_pins();
drop function if exists public.keep_alive_ping();
drop function if exists public.is_sos_emergency_title(text);
drop function if exists public.assert_authenticated();
drop function if exists public.handle_new_user();

drop table if exists public.ops_heartbeat_logs cascade;
drop table if exists public.sys_keep_alive_logs cascade;
drop table if exists public.emergency_locations cascade;
drop table if exists public.evacuation_centers cascade;
drop table if exists public.profiles cascade;


-- =============================================================================
-- §1 Extension
-- =============================================================================
create extension if not exists postgis;


-- =============================================================================
-- §2 Tables
-- =============================================================================

create table public.emergency_locations (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 1 and 80),
  description  text check (description is null or char_length(description) <= 500),
  contact_info text check (contact_info is null or char_length(contact_info) <= 200),
  location     geography(Point, 4326) not null,
  status       text not null default 'open' check (status in ('open', 'closed')),
  priority     text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create table public.evacuation_centers (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  address            text,
  location           geography(Point, 4326) not null,
  capacity           integer check (capacity is null or capacity >= 0),
  current_occupancy  integer not null default 0 check (current_occupancy >= 0),
  facility_status    text not null default 'open'
                       check (facility_status in ('open', 'full', 'closed')),
  created_at         timestamptz not null default now()
);

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         text not null default 'user' check (role in ('user', 'shelter_admin')),
  display_name text,
  updated_at   timestamptz not null default now()
);

create table public.ops_heartbeat_logs (
  id         bigint generated always as identity primary key,
  source     text not null default 'cron' check (char_length(source) <= 64),
  created_at timestamptz not null default now()
);


-- =============================================================================
-- §3 Indexes & constraints
-- =============================================================================
create index emergency_locations_location_idx
  on public.emergency_locations using gist (location);
create index emergency_locations_created_at_idx
  on public.emergency_locations (created_at desc);

create index evacuation_centers_location_idx
  on public.evacuation_centers using gist (location);
create unique index evacuation_centers_name_unique
  on public.evacuation_centers (name);

create index ops_heartbeat_logs_created_at_idx
  on public.ops_heartbeat_logs (created_at);


-- =============================================================================
-- §4 Privileges — PostgREST 直叩き経路を最小化
-- =============================================================================
revoke all on public.emergency_locations from anon, authenticated;
revoke all on public.evacuation_centers from anon, authenticated;
revoke all on public.profiles from anon, authenticated;
revoke all on public.ops_heartbeat_logs from anon, authenticated;

grant select, update on public.emergency_locations to authenticated;
grant select, update on public.evacuation_centers to authenticated;
grant select, update on public.profiles to authenticated;


-- =============================================================================
-- §5 Row Level Security
-- =============================================================================
alter table public.emergency_locations enable row level security;
alter table public.evacuation_centers enable row level security;
alter table public.profiles enable row level security;
alter table public.ops_heartbeat_logs enable row level security;

-- SOS: INSERT は RPC のみ（テーブル INSERT ポリシーなし）
create policy "authenticated can read emergencies"
  on public.emergency_locations for select to authenticated
  using (true);

create policy "owner can update own emergency"
  on public.emergency_locations for update to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

create policy "authenticated can read evacuation centers"
  on public.evacuation_centers for select to authenticated
  using (true);

create policy "shelter admin can update evacuation centers"
  on public.evacuation_centers for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'shelter_admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'shelter_admin'
    )
  );

create policy "users can read own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "users can update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id);


-- =============================================================================
-- §6 Auth trigger
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =============================================================================
-- §7 Domain helpers
-- =============================================================================
create or replace function public.is_sos_emergency_title(p_title text)
returns boolean
language sql
immutable
as $$
  select
    btrim(coalesce(p_title, '')) <> ''
    and btrim(p_title) !~ '^【避難所】|^避難所[：:・\s]'
    and not (
      btrim(p_title) like '%避難所%'
      and btrim(p_title) not like '%救助%'
      and btrim(p_title) not like '%要請%'
    );
$$;

create or replace function public.assert_authenticated()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
end;
$$;


-- =============================================================================
-- §8 RPC — SOS 投稿
-- =============================================================================
create or replace function public.create_sos_emergency(
  p_title        text,
  p_description  text default null,
  p_contact_info text default null,
  p_priority     text default 'medium',
  p_lng          double precision default null,
  p_lat          double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
  recent_global integer;
  recent_user integer;
begin
  -- グローバル: 1 分あたり 20 件
  select count(*) into recent_global
  from public.emergency_locations
  where created_at > now() - interval '1 minute';

  if recent_global >= 20 then
    raise exception 'rate_limit_global' using errcode = 'P0001';
  end if;

  -- 認証ユーザー: 1 分あたり 5 件
  if auth.uid() is not null then
    select count(*) into recent_user
    from public.emergency_locations
    where created_by = auth.uid()
      and created_at > now() - interval '1 minute';

    if recent_user >= 5 then
      raise exception 'rate_limit_user' using errcode = 'P0001';
    end if;
  end if;

  if not public.is_sos_emergency_title(p_title) then
    raise exception 'invalid sos title' using errcode = '22023';
  end if;

  if p_priority not in ('high', 'medium', 'low') then
    raise exception 'invalid priority' using errcode = '22023';
  end if;

  if p_lng is null or p_lat is null
     or p_lat < -90 or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'invalid coordinates' using errcode = '22023';
  end if;

  insert into public.emergency_locations (
    title, description, contact_info, priority, created_by, location
  )
  values (
    left(btrim(p_title), 80),
    left(nullif(btrim(p_description), ''), 500),
    left(nullif(btrim(p_contact_info), ''), 200),
    p_priority,
    auth.uid(),
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.create_sos_emergency(text, text, text, text, double precision, double precision) from public;
grant execute on function public.create_sos_emergency(text, text, text, text, double precision, double precision) to anon, authenticated;


-- =============================================================================
-- §9 RPC — 近傍検索（authenticated GRANT + 関数内 auth チェック）
-- =============================================================================
create or replace function public.search_nearby_emergencies(
  lat             double precision,
  lng             double precision,
  radius_meters   double precision default 5000,
  priority_filter text default null
)
returns table (
  id          uuid,
  title       text,
  description text,
  location    json,
  status      text,
  priority    text,
  created_by  uuid,
  created_at  timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  safe_radius  double precision;
  search_point geography;
begin
  perform public.assert_authenticated();

  if priority_filter is not null and priority_filter not in ('high', 'medium', 'low') then
    raise exception 'invalid priority filter' using errcode = '22023';
  end if;

  safe_radius := least(greatest(coalesce(radius_meters, 5000), 100), 50000);
  search_point := st_setsrid(st_makepoint(lng, lat), 4326)::geography;

  return query
  select
    el.id, el.title, el.description,
    st_asgeojson(el.location)::json as location,
    el.status, el.priority, el.created_by, el.created_at
  from public.emergency_locations el
  where el.status = 'open'
    and public.is_sos_emergency_title(el.title)
    and st_dwithin(el.location, search_point, safe_radius)
    and (priority_filter is null or el.priority = priority_filter)
  order by
    case el.priority when 'high' then 0 when 'medium' then 1 else 2 end,
    st_distance(el.location, search_point)
  limit 200;
end;
$$;

revoke all on function public.search_nearby_emergencies(double precision, double precision, double precision, text) from public;
grant execute on function public.search_nearby_emergencies(double precision, double precision, double precision, text) to authenticated;

create or replace function public.search_nearby_evacuation_centers(
  lat            double precision,
  lng            double precision,
  radius_meters  double precision default 5000,
  status_filter  text default null
)
returns table (
  id                uuid,
  name              text,
  address           text,
  location          json,
  capacity          integer,
  current_occupancy integer,
  facility_status   text,
  created_at        timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  safe_radius  double precision;
  search_point geography;
begin
  perform public.assert_authenticated();

  if status_filter is not null and status_filter not in ('open', 'full', 'closed') then
    raise exception 'invalid status filter' using errcode = '22023';
  end if;

  safe_radius := least(greatest(coalesce(radius_meters, 5000), 100), 50000);
  search_point := st_setsrid(st_makepoint(lng, lat), 4326)::geography;

  return query
  select
    ec.id, ec.name, ec.address,
    st_asgeojson(ec.location)::json as location,
    ec.capacity, ec.current_occupancy, ec.facility_status, ec.created_at
  from public.evacuation_centers ec
  where st_dwithin(ec.location, search_point, safe_radius)
    and (status_filter is null or ec.facility_status = status_filter)
  order by st_distance(ec.location, search_point)
  limit 100;
end;
$$;

revoke all on function public.search_nearby_evacuation_centers(double precision, double precision, double precision, text) from public;
grant execute on function public.search_nearby_evacuation_centers(double precision, double precision, double precision, text) to authenticated;


-- =============================================================================
-- §10 RPC — 地図フォールバック
-- =============================================================================
create or replace function public.fetch_all_map_pins()
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result json;
begin
  perform public.assert_authenticated();

  select json_build_object(
    'emergencies', (
      select coalesce(json_agg(row_to_json(e)), '[]'::json)
      from (
        select
          el.id, el.title, el.description,
          st_asgeojson(el.location)::json as location,
          el.status, el.priority, el.created_by, el.created_at
        from public.emergency_locations el
        where el.status = 'open'
          and public.is_sos_emergency_title(el.title)
        order by el.created_at desc
        limit 100
      ) e
    ),
    'shelters', (
      select coalesce(json_agg(row_to_json(s)), '[]'::json)
      from (
        select
          ec.id, ec.name, ec.address,
          st_asgeojson(ec.location)::json as location,
          ec.capacity, ec.current_occupancy, ec.facility_status, ec.created_at
        from public.evacuation_centers ec
        order by ec.created_at desc
        limit 100
      ) s
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.fetch_all_map_pins() from public;
grant execute on function public.fetch_all_map_pins() to authenticated;


-- =============================================================================
-- §11 RPC — Keep-alive
-- =============================================================================
-- 根拠: https://supabase.com/docs/guides/platform/free-project-pausing (2026-07)
--   7 日間の DB アクティビティ不足で pause。「a few requests per day over the week」
-- → INSERT する実クエリ + GitHub Actions 6h cron（1 日 4 回）
create or replace function public.keep_alive_ping()
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.ops_heartbeat_logs (source) values ('keep_alive_ping');

  delete from public.ops_heartbeat_logs
  where created_at < now() - interval '30 days';

  return json_build_object('status', 'ok', 'ts', now());
end;
$$;

revoke all on function public.keep_alive_ping() from public;
grant execute on function public.keep_alive_ping() to anon;


-- =============================================================================
-- §12 Realtime
-- =============================================================================
alter table public.emergency_locations replica identity full;


-- =============================================================================
-- §13 Seed（デモ避難所）
-- =============================================================================
insert into public.evacuation_centers (name, address, location, capacity, current_occupancy, facility_status)
values
  ('区立総合体育館', '東京都千代田区', st_setsrid(st_makepoint(139.7536, 35.6947), 4326)::geography, 500, 120, 'open'),
  ('中央区民会館', '東京都中央区', st_setsrid(st_makepoint(139.7720, 35.6702), 4326)::geography, 300, 300, 'full'),
  ('臨時避難所A', '東京都港区', st_setsrid(st_makepoint(139.7514, 35.6586), 4326)::geography, 200, 45, 'open'),
  ('臨時避難所B', '東京都新宿区', st_setsrid(st_makepoint(139.7006, 35.6938), 4326)::geography, 150, 0, 'closed')
on conflict (name) do nothing;
