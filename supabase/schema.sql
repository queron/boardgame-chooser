create table if not exists public.game_nights (
  slug text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists game_nights_updated_at_idx on public.game_nights (updated_at desc);

alter table public.game_nights enable row level security;

drop policy if exists "service role manages game nights" on public.game_nights;
create policy "service role manages game nights"
  on public.game_nights
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
