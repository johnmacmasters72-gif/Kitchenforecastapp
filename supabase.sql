-- Run this once in Supabase: SQL Editor -> New query -> Run
create table if not exists kf_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table kf_data enable row level security;
create policy "own row select" on kf_data for select using (auth.uid() = user_id);
create policy "own row insert" on kf_data for insert with check (auth.uid() = user_id);
create policy "own row update" on kf_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own row delete" on kf_data for delete using (auth.uid() = user_id);
