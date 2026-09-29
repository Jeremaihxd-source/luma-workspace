create table if not exists public.user_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_workspaces enable row level security;

revoke all on table public.user_workspaces from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.user_workspaces to authenticated;

drop policy if exists "Users can read their workspace" on public.user_workspaces;
create policy "Users can read their workspace"
  on public.user_workspaces
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their workspace" on public.user_workspaces;
create policy "Users can create their workspace"
  on public.user_workspaces
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their workspace" on public.user_workspaces;
create policy "Users can update their workspace"
  on public.user_workspaces
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their workspace" on public.user_workspaces;
create policy "Users can delete their workspace"
  on public.user_workspaces
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_workspace_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_workspaces_updated_at on public.user_workspaces;
create trigger set_user_workspaces_updated_at
before update on public.user_workspaces
for each row execute function public.set_workspace_updated_at();

revoke execute on function public.set_workspace_updated_at() from public, anon, authenticated;
