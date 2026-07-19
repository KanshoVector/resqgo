-- =============================================================================
-- ResQGo — 支援者向け contact_info 返却（認証済み RPC のみ）
-- =============================================================================
-- 既存データを保持したまま search / map fallback RPC を差し替え

create or replace function public.search_nearby_emergencies(
  lat             double precision,
  lng             double precision,
  radius_meters   double precision default 5000,
  priority_filter text default null
)
returns table (
  id           uuid,
  title        text,
  description  text,
  contact_info text,
  location     json,
  status       text,
  priority     text,
  created_by   uuid,
  created_at   timestamptz
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
    el.id, el.title, el.description, el.contact_info,
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
          el.id, el.title, el.description, el.contact_info,
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
