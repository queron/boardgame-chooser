create table if not exists public.game_nights (
  slug text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists game_nights_updated_at_idx on public.game_nights (updated_at desc);

create table if not exists public.bgg_games_cache (
  bgg_id integer primary key,
  title text not null,
  year integer,
  raw_xml text,
  normalized_json jsonb not null,
  fetched_at timestamptz not null default now(),
  refreshed_at timestamptz,
  source_version text
);

create index if not exists bgg_games_cache_refreshed_at_idx on public.bgg_games_cache (refreshed_at desc);

alter table public.game_nights enable row level security;
alter table public.bgg_games_cache enable row level security;

drop policy if exists "service role manages game nights" on public.game_nights;
create policy "service role manages game nights"
  on public.game_nights
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role manages bgg games cache" on public.bgg_games_cache;
create policy "service role manages bgg games cache"
  on public.bgg_games_cache
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
