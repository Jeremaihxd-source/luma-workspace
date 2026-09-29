alter table public.workspace_invites
  alter column expires_at drop not null,
  alter column expires_at set default (now() + interval '30 days');

update public.workspace_invites
set expires_at = created_at + interval '30 days'
where expires_at is not null
  and expires_at <= created_at + interval '7 days 1 minute';

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
    and (expires_at is null or expires_at > now())
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

revoke all on function public.accept_workspace_invite(text) from public, anon;
grant execute on function public.accept_workspace_invite(text) to authenticated;
