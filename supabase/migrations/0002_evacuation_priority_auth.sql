-- Priority triage, evacuation centers, profiles, secure RPC, realtime

alter table public.emergency_locations
  add column if not exists priority text not null default 'medium'
  check (priority in ('high', 'medium', 'low'));

create table if not exists public.evacuation_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  location geography(Point, 4326) not null,
  capacity integer,
  current_occupancy integer not null default 0,
  facility_status text not null default 'open'
    check (facility_status in ('open', 'full', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists evacuation_centers_location_idx
  on public.evacuation_centers using gist (location);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user'
    check (role in ('user', 'shelter_admin')),
  display_name text,
  updated_at timestamptz not null default now()
);

alter table public.evacuation_centers enable row level security;
alter table public.profiles enable row level security;

create policy "authenticated can read evacuation centers"
  on public.evacuation_centers for select to authenticated using (true);

create policy "shelter admin can update evacuation centers"
  on public.evacuation_centers for update to authenticated
  using (
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Secure RPC: never returns contact_info
drop function if exists public.search_nearby_emergencies(double precision, double precision, double precision);

create or replace function public.search_nearby_emergencies(
  lat double precision,
  lng double precision,
  radius_meters double precision default 5000,
  priority_filter text default null
)
returns table (
  id uuid,
  title text,
  description text,
  location geography(Point, 4326),
  status text,
  priority text,
  created_by uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  safe_radius double precision;
  search_point geography;
begin
  safe_radius := least(coalesce(radius_meters, 5000), 50000);
  search_point := st_setsrid(st_makepoint(lng, lat), 4326)::geography;

  return query
  select
    el.id, el.title, el.description, el.location,
    el.status, el.priority, el.created_by, el.created_at
  from public.emergency_locations el
  where el.status = 'open'
    and st_dwithin(el.location, search_point, safe_radius)
    and (priority_filter is null or el.priority = priority_filter)
  order by
    case el.priority when 'high' then 0 when 'medium' then 1 else 2 end,
    st_distance(el.location, search_point)
  limit 200;
end;
$$;

revoke all on function public.search_nearby_emergencies(double precision, double precision, double precision, text)
  from public;
grant execute on function public.search_nearby_emergencies(double precision, double precision, double precision, text)
  to authenticated;

create or replace function public.search_nearby_evacuation_centers(
  lat double precision,
  lng double precision,
  radius_meters double precision default 5000,
  status_filter text default null
)
returns setof public.evacuation_centers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  safe_radius double precision;
  search_point geography;
begin
  safe_radius := least(coalesce(radius_meters, 5000), 50000);
  search_point := st_setsrid(st_makepoint(lng, lat), 4326)::geography;

  return query
  select ec.*
  from public.evacuation_centers ec
  where st_dwithin(ec.location, search_point, safe_radius)
    and (status_filter is null or ec.facility_status = status_filter)
  order by st_distance(ec.location, search_point)
  limit 100;
end;
$$;

revoke all on function public.search_nearby_evacuation_centers(double precision, double precision, double precision, text)
  from public;
grant execute on function public.search_nearby_evacuation_centers(double precision, double precision, double precision, text)
  to authenticated;

alter table public.emergency_locations replica identity full;

-- Sample evacuation centers (Tokyo area, public reference coordinates)
insert into public.evacuation_centers (name, address, location, capacity, current_occupancy, facility_status)
values
  ('区立総合体育館', '東京都千代田区', st_setsrid(st_makepoint(139.7536, 35.6947), 4326)::geography, 500, 120, 'open'),
  ('中央区民会館', '東京都中央区', st_setsrid(st_makepoint(139.7720, 35.6702), 4326)::geography, 300, 300, 'full'),
  ('臨時避難所A', '東京都港区', st_setsrid(st_makepoint(139.7514, 35.6586), 4326)::geography, 200, 45, 'open'),
  ('臨時避難所B', '東京都新宿区', st_setsrid(st_makepoint(139.7006, 35.6938), 4326)::geography, 150, 0, 'closed')
on conflict do nothing;
