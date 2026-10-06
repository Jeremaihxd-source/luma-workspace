-- Invitation links accept any number of distinct accounts. Reopening a link as
-- an existing member is idempotent and never consumes another use.
alter table public.workspace_invites
  alter column max_uses drop not null,
  alter column max_uses drop default;

alter table public.workspace_invites
  drop constraint if exists workspace_invites_max_uses_check;

alter table public.workspace_invites
  add constraint workspace_invites_max_uses_check
  check (max_uses is null or max_uses > 0);

update public.workspace_invites
set max_uses = null
where max_uses is not null;

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
  inserted_rows integer := 0;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  select * into invite
  from public.workspace_invites
  where code = upper(trim(p_code))
    and (expires_at is null or expires_at > now())
  for update;

  if invite.id is null then
    raise exception 'Invite is invalid or expired';
  end if;

  if exists (
    select 1
    from public.workspace_members
    where workspace_id = invite.workspace_id
      and user_id = caller
  ) then
    return invite.workspace_id;
  end if;

  if invite.max_uses is not null and invite.uses >= invite.max_uses then
    raise exception 'Invite has reached its access limit';
  end if;

  select email into caller_email
  from auth.users
  where id = caller;

  insert into public.workspace_members (workspace_id, user_id, email, role)
  values (invite.workspace_id, caller, coalesce(caller_email, 'Usuario'), invite.role)
  on conflict (workspace_id, user_id) do nothing;

  get diagnostics inserted_rows = row_count;
  if inserted_rows = 1 then
    update public.workspace_invites
    set uses = uses + 1
    where id = invite.id;
  end if;

  return invite.workspace_id;
end;
$$;

revoke all on function public.accept_workspace_invite(text) from public, anon, authenticated;
grant execute on function public.accept_workspace_invite(text) to authenticated;
