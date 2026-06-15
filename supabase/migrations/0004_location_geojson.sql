-- fetch_all_map_pins: geography を GeoJSON に変換（row_to_json 単体ではパース不能な形式になる）

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
        select
          el.id, el.title, el.description,
          st_asgeojson(el.location)::json as location,
          el.status, el.priority, el.created_by, el.created_at
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
