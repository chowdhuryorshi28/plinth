-- ============================================================
-- Plinth database schema
-- Run this once in your Supabase project: SQL Editor -> New query
-- -> paste this whole file -> Run.
-- ============================================================

-- PROFILES
-- One row per signed-up person. The "id" column is the SAME id
-- Supabase Auth already gave that person when they signed up —
-- that's the "unique ID per person" your app needs, for free.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  agent_code text unique not null,
  display_name text not null,
  skills text[] default '{}',
  bio text default '',
  available_for_work boolean default true,
  rating_sum integer default 0,
  rating_count integer default 0,
  completed_count integer default 0,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

-- Anyone can read profiles (it's a public marketplace directory).
create policy "Profiles are viewable by everyone"
  on profiles for select
  using (true);

-- You can only ever create/edit YOUR OWN profile row.
create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);


-- PROJECTS
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  category text not null,
  description text not null,
  requirements text[] default '{}',
  software text[] default '{}',
  deadline text default 'TBD',
  workload text default 'TBD',
  budget integer default 0,
  location text default '',
  status text default 'open', -- open | in_progress | completed
  created_at timestamptz default now()
);

alter table projects enable row level security;

create policy "Projects are viewable by everyone"
  on projects for select
  using (true);

-- You can only post a project as YOURSELF.
create policy "Users can insert their own projects"
  on projects for insert
  with check (auth.uid() = owner_id);

-- You can only edit/close a project YOU posted.
create policy "Owners can update their own projects"
  on projects for update
  using (auth.uid() = owner_id);

-- ============================================================
-- That's it for now. Threads (chat) and deals tables come in the
-- next milestone, once accounts + posting are confirmed working.
-- ============================================================
