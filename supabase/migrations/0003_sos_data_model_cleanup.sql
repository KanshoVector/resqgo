-- Data model cleanup: emergency_locations = SOS only

-- Remove shelter master data mistakenly stored as emergencies
delete from public.emergency_locations
where title like '【避難所】%'
   or title ~ '^避難所[：:・\s]'
   or (title like '%避難所%' and title not like '%救助%' and title not like '%要請%');

-- Recreate SOS-only search RPC
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

revoke all on function public.search_nearby_emergencies(double precision, double precision, double precision, text)
  from public;
grant execute on function public.search_nearby_emergencies(double precision, double precision, double precision, text)
  to authenticated;

-- Unfiltered map display (authenticated, SOS-only emergencies)
create or replace function public.fetch_all_map_pins()
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result json;
begin
  select json_build_object(
    'emergencies', (
      select coalesce(json_agg(row_to_json(e)), '[]'::json)
      from (
        select id, title, description, location, status, priority, created_by, created_at
        from public.emergency_locations el
        where el.status = 'open'
          and el.title not like '【避難所】%'
          and el.title !~ '^避難所[：:・\s]'
          and not (
            el.title like '%避難所%'
            and el.title not like '%救助%'
            and el.title not like '%要請%'
          )
        order by el.created_at desc
        limit 100
      ) e
    ),
    'shelters', (
      select coalesce(json_agg(row_to_json(s)), '[]'::json)
      from (
        select id, name, address, location, capacity, current_occupancy, facility_status, created_at
        from public.evacuation_centers
        order by created_at desc
        limit 100
      ) s
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.fetch_all_map_pins() from public;
grant execute on function public.fetch_all_map_pins() to authenticated;
