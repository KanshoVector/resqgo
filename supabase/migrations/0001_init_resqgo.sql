-- ResQGo initial schema (design spec v2)

create extension if not exists postgis;

create table public.emergency_locations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  contact_info text,
  location geography(Point, 4326) not null,
  status text not null default 'open',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index emergency_locations_location_idx
  on public.emergency_locations using gist (location);

alter table public.emergency_locations enable row level security;

create policy "anyone can insert"
  on public.emergency_locations
  for insert
  to public
  with check (true);

create policy "authenticated can read"
  on public.emergency_locations
  for select
  to authenticated
  using (true);

create policy "owner can update own"
  on public.emergency_locations
  for update
  to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

create or replace function public.search_nearby_emergencies(
  lat double precision,
  lng double precision,
  radius_meters double precision default 5000
)
returns setof public.emergency_locations
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
  select el.*
  from public.emergency_locations el
  where el.status = 'open'
    and st_dwithin(el.location, search_point, safe_radius)
  order by st_distance(el.location, search_point)
  limit 200;
end;
$$;

revoke all on function public.search_nearby_emergencies(double precision, double precision, double precision)
  from public;

grant execute on function public.search_nearby_emergencies(double precision, double precision, double precision)
  to authenticated;
