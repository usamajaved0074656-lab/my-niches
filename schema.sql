-- Niche Core — Supabase schema.
-- Supabase dashboard → SQL Editor → paste → Run.

create table if not exists public.niches (
  id          uuid primary key default gen_random_uuid(),
  title       text        not null default 'Untitled niche',
  status      text        not null default 'Researching',
  difficulty  text        not null default 'Beginner Friendly',
  notes       text        not null default '',
  tags        jsonb       not null default '[]'::jsonb,
  likes       int         not null default 0,
  liked       boolean     not null default false,
  saved       boolean     not null default false,
  cover       text,
  -- Channels ek hi row mein rehte hain: ek niche = ek atomic write, koi join nahi.
  channels    jsonb       not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists niches_created_at_idx on public.niches (created_at desc);
create index if not exists niches_status_idx     on public.niches (status);

-- Ye app localhost par chalti hai aur service-role key server-side rehti hai,
-- is liye RLS on rakh kar sirf service role ko rasta dete hain.
alter table public.niches enable row level security;

drop policy if exists "service role full access" on public.niches;
create policy "service role full access"
  on public.niches
  for all
  to service_role
  using (true)
  with check (true);
