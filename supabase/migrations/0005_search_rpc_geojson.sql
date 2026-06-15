-- search RPC も GeoJSON を返す（PostgREST 経由だと EWKB hex 文字列になるため）

drop function if exists public.search_nearby_emergencies(double precision, double precision, double precision, text);

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
  location json,
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
    el.id, el.title, el.description,
    st_asgeojson(el.location)::json as location,
    el.status, el.priority, el.created_by, el.created_at
  from public.emergency_locations el
  where el.status = 'open'
    and st_dwithin(el.location, search_point, safe_radius)
    and (priority_filter is null or el.priority = priority_filter)
    and el.title not like '【避難所】%'
    and el.title !~ '^避難所[：:・\s]'
    and not (
      el.title like '%避難所%'
      and el.title not like '%救助%'
      and el.title not like '%要請%'
    )
  order by
    case el.priority when 'high' then 0 when 'medium' then 1 else 2 end,
    st_distance(el.location, search_point)
  limit 200;
end;
$$;

revoke all on function public.search_nearby_emergencies(double precision, double precision, double precision, text) from public;
grant execute on function public.search_nearby_emergencies(double precision, double precision, double precision, text) to authenticated;

drop function if exists public.search_nearby_evacuation_centers(double precision, double precision, double precision, text);

create or replace function public.search_nearby_evacuation_centers(
  lat double precision,
  lng double precision,
  radius_meters double precision default 5000,
  status_filter text default null
)
returns table (
  id uuid,
  name text,
  address text,
  location json,
  capacity integer,
  current_occupancy integer,
  facility_status text,
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
