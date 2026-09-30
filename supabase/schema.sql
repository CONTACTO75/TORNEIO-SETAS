-- Torneios de dardos: esquema da base de dados (Supabase)
-- Correr uma vez no SQL Editor do Supabase.

create extension if not exists pgcrypto;

-- Quem pode editar (organizadores). O público só lê.
create table if not exists admins (
  user_id uuid primary key references auth.users on delete cascade
);

create or replace function is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  points jsonb not null default '[{"from":1,"points":25},{"from":2,"points":18},{"from":3,"points":15},{"from":4,"points":12},{"from":5,"points":10},{"from":7,"points":8},{"from":9,"points":6},{"from":13,"points":4},{"from":17,"points":2},{"from":25,"points":1}]',
  created_at timestamptz not null default now()
);

create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null default current_date,
  format text not null default 'double' check (format in ('single','double')),
  first_to int not null default 3 check (first_to between 1 and 21),
  first_to_final int not null default 4 check (first_to_final between 1 and 21),
  status text not null default 'draft' check (status in ('draft','running','finished')),
  season_id uuid references seasons on delete set null,
  seeds uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists results (
  tournament_id uuid not null references tournaments on delete cascade,
  match_id text not null,
  p1 uuid not null,
  p2 uuid not null,
  s1 int not null check (s1 >= 0),
  s2 int not null check (s2 >= 0),
  updated_at timestamptz not null default now(),
  primary key (tournament_id, match_id)
);

alter table admins enable row level security;
alter table players enable row level security;
alter table seasons enable row level security;
alter table tournaments enable row level security;
alter table results enable row level security;

drop policy if exists "ver o proprio admin" on admins;
create policy "ver o proprio admin" on admins for select using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['players','seasons','tournaments','results'] loop
    execute format('drop policy if exists "leitura publica" on %I', t);
    execute format('create policy "leitura publica" on %I for select using (true)', t);
    execute format('drop policy if exists "admin escreve" on %I', t);
    execute format('create policy "admin escreve" on %I for all using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- Atualizações ao vivo para quem está a ver a árvore
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='results') then
    alter publication supabase_realtime add table results;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='tournaments') then
    alter publication supabase_realtime add table tournaments;
  end if;
end $$;
