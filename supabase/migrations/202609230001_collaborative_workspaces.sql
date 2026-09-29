create schema if not exists private;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  owner_id uuid not null references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  max_uses integer not null default 10 check (max_uses between 1 and 100),
  uses integer not null default 0 check (uses >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 255),
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists workspaces_owner_id_idx on public.workspaces(owner_id);
create index if not exists workspace_members_user_id_idx on public.workspace_members(user_id);
create index if not exists workspace_invites_workspace_id_idx on public.workspace_invites(workspace_id);
create index if not exists workspace_invites_created_by_idx on public.workspace_invites(created_by);
create index if not exists workspace_files_workspace_id_idx on public.workspace_files(workspace_id);
create index if not exists workspace_files_uploaded_by_idx on public.workspace_files(uploaded_by);

create or replace function private.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace
      and user_id = (select auth.uid())
  );
$$;

create or replace function private.can_edit_workspace(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace
      and user_id = (select auth.uid())
      and role in ('owner', 'editor')
  );
$$;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
revoke all on function private.is_workspace_member(uuid) from public, anon;
revoke all on function private.can_edit_workspace(uuid) from public, anon;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.can_edit_workspace(uuid) to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.workspace_files enable row level security;

create policy "members can view workspaces" on public.workspaces
  for select to authenticated
  using ((select private.is_workspace_member(id)));

create policy "editors can update workspaces" on public.workspaces
  for update to authenticated
  using ((select private.can_edit_workspace(id)))
  with check ((select private.can_edit_workspace(id)));

create policy "members can view members" on public.workspace_members
  for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy "editors can view invites" on public.workspace_invites
  for select to authenticated
  using ((select private.can_edit_workspace(workspace_id)));

create policy "editors can create invites" on public.workspace_invites
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.can_edit_workspace(workspace_id))
  );

create policy "editors can delete invites" on public.workspace_invites
  for delete to authenticated
  using ((select private.can_edit_workspace(workspace_id)));

create policy "members can view files" on public.workspace_files
  for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy "editors can add files" on public.workspace_files
  for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and (select private.can_edit_workspace(workspace_id))
  );

create policy "editors can remove files" on public.workspace_files
  for delete to authenticated
  using ((select private.can_edit_workspace(workspace_id)));

revoke all on public.workspaces, public.workspace_members, public.workspace_invites, public.workspace_files from anon;
grant select on public.workspaces to authenticated;
grant update (name, state) on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;
grant select, insert, delete on public.workspace_invites to authenticated;
grant select, insert, delete on public.workspace_files to authenticated;

create or replace function public.create_workspace(p_name text, p_state jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_email text;
  new_workspace uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if char_length(trim(p_name)) not between 1 and 80 then raise exception 'Invalid workspace name'; end if;
  select email into caller_email from auth.users where id = caller;
  insert into public.workspaces (name, owner_id, state)
  values (trim(p_name), caller, coalesce(p_state, '{}'::jsonb))
  returning id into new_workspace;
  insert into public.workspace_members (workspace_id, user_id, email, role)
  values (new_workspace, caller, coalesce(caller_email, 'Usuario'), 'owner');
  return new_workspace;
end;
$$;

create or replace function public.accept_workspace_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_email text;
  invite public.workspace_invites%rowtype;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select * into invite
  from public.workspace_invites
  where code = upper(trim(p_code))
    and expires_at > now()
    and uses < max_uses
  for update;
  if invite.id is null then raise exception 'Invite is invalid or expired'; end if;
  select email into caller_email from auth.users where id = caller;
  insert into public.workspace_members (workspace_id, user_id, email, role)
  values (invite.workspace_id, caller, coalesce(caller_email, 'Usuario'), invite.role)
  on conflict (workspace_id, user_id) do nothing;
  update public.workspace_invites set uses = uses + 1 where id = invite.id;
  return invite.workspace_id;
end;
$$;

revoke all on function public.create_workspace(text, jsonb) from public, anon;
revoke all on function public.accept_workspace_invite(text) from public, anon;
grant execute on function public.create_workspace(text, jsonb) to authenticated;
grant execute on function public.accept_workspace_invite(text) to authenticated;

create or replace function private.touch_workspace_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workspaces_touch_updated_at on public.workspaces;
create trigger workspaces_touch_updated_at
before update on public.workspaces
for each row execute function private.touch_workspace_updated_at();

insert into storage.buckets (id, name, public, file_size_limit)
values ('workspace-files', 'workspace-files', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

create policy "workspace members can download files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'workspace-files'
    and (select private.is_workspace_member(((storage.foldername(name))[1])::uuid))
  );

create policy "workspace editors can upload files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'workspace-files'
    and (select private.can_edit_workspace(((storage.foldername(name))[1])::uuid))
  );

create policy "workspace editors can update files" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'workspace-files'
    and (select private.can_edit_workspace(((storage.foldername(name))[1])::uuid))
  )
  with check (
    bucket_id = 'workspace-files'
    and (select private.can_edit_workspace(((storage.foldername(name))[1])::uuid))
  );

create policy "workspace editors can delete files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'workspace-files'
    and (select private.can_edit_workspace(((storage.foldername(name))[1])::uuid))
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'workspaces'
  ) then
    alter publication supabase_realtime add table public.workspaces;
  end if;
end $$;
