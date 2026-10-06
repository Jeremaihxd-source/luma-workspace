create table if not exists public.workspace_tasks (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null,
  title text not null check (char_length(title) between 1 and 500),
  done boolean not null default false,
  due_date date,
  priority text not null default 'Media' check (priority in ('Alta', 'Media', 'Baja')),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create table if not exists public.workspace_events (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null,
  title text not null check (char_length(title) between 1 and 500),
  event_date date not null,
  start_minute smallint not null check (start_minute between 0 and 1439),
  duration_minutes smallint not null check (duration_minutes between 15 and 1440),
  color text not null default 'blue' check (color in ('blue', 'purple', 'orange', 'green')),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create table if not exists public.workspace_pages (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null,
  title text not null default 'Sin titulo' check (char_length(title) <= 500),
  icon text not null default '📄' check (char_length(icon) <= 16),
  cover text not null default '' check (char_length(cover) <= 500),
  blocks jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array'),
  task_ids text[] not null default '{}',
  project_ids text[] not null default '{}',
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create index if not exists workspace_tasks_due_idx on public.workspace_tasks(workspace_id, done, due_date);
create index if not exists workspace_events_date_idx on public.workspace_events(workspace_id, event_date, start_minute);
create index if not exists workspace_pages_position_idx on public.workspace_pages(workspace_id, position);

alter table public.workspace_tasks enable row level security;
alter table public.workspace_events enable row level security;
alter table public.workspace_pages enable row level security;

create policy "members can view tasks" on public.workspace_tasks for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy "editors can add tasks" on public.workspace_tasks for insert to authenticated with check ((select private.can_edit_workspace(workspace_id)));
create policy "editors can update tasks" on public.workspace_tasks for update to authenticated using ((select private.can_edit_workspace(workspace_id))) with check ((select private.can_edit_workspace(workspace_id)));
create policy "editors can delete tasks" on public.workspace_tasks for delete to authenticated using ((select private.can_edit_workspace(workspace_id)));

create policy "members can view events" on public.workspace_events for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy "editors can add events" on public.workspace_events for insert to authenticated with check ((select private.can_edit_workspace(workspace_id)));
create policy "editors can update events" on public.workspace_events for update to authenticated using ((select private.can_edit_workspace(workspace_id))) with check ((select private.can_edit_workspace(workspace_id)));
create policy "editors can delete events" on public.workspace_events for delete to authenticated using ((select private.can_edit_workspace(workspace_id)));

create policy "members can view pages" on public.workspace_pages for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy "editors can add pages" on public.workspace_pages for insert to authenticated with check ((select private.can_edit_workspace(workspace_id)));
create policy "editors can update pages" on public.workspace_pages for update to authenticated using ((select private.can_edit_workspace(workspace_id))) with check ((select private.can_edit_workspace(workspace_id)));
create policy "editors can delete pages" on public.workspace_pages for delete to authenticated using ((select private.can_edit_workspace(workspace_id)));

revoke all on public.workspace_tasks, public.workspace_events, public.workspace_pages from public, anon;
grant select, insert, update, delete on public.workspace_tasks, public.workspace_events, public.workspace_pages to authenticated;

drop trigger if exists workspace_tasks_touch_updated_at on public.workspace_tasks;
create trigger workspace_tasks_touch_updated_at before update on public.workspace_tasks for each row execute function private.touch_workspace_updated_at();
drop trigger if exists workspace_events_touch_updated_at on public.workspace_events;
create trigger workspace_events_touch_updated_at before update on public.workspace_events for each row execute function private.touch_workspace_updated_at();
drop trigger if exists workspace_pages_touch_updated_at on public.workspace_pages;
create trigger workspace_pages_touch_updated_at before update on public.workspace_pages for each row execute function private.touch_workspace_updated_at();

insert into public.workspace_tasks (workspace_id, id, title, done, due_date, priority, position)
select w.id, item.value->>'id', coalesce(nullif(item.value->>'title', ''), 'Tarea'), coalesce((item.value->>'done')::boolean, false),
  case when item.value->>'date' ~ '^\d{4}-\d{2}-\d{2}$' then (item.value->>'date')::date end,
  case when item.value->>'priority' in ('Alta', 'Media', 'Baja') then item.value->>'priority' else 'Media' end,
  (item.ordinality - 1)::integer
from public.workspaces w
cross join lateral jsonb_array_elements(case when jsonb_typeof(w.state->'tasks') = 'array' then w.state->'tasks' else '[]'::jsonb end) with ordinality as item(value, ordinality)
where nullif(item.value->>'id', '') is not null
on conflict (workspace_id, id) do nothing;

insert into public.workspace_events (workspace_id, id, title, event_date, start_minute, duration_minutes, color, position)
select w.id, item.value->>'id', coalesce(nullif(item.value->>'title', ''), 'Evento'), (item.value->>'date')::date,
  greatest(0, least(1439, coalesce((item.value->>'start')::integer, 0))),
  greatest(15, least(1440, coalesce((item.value->>'duration')::integer, 60))),
  case when item.value->>'color' in ('blue', 'purple', 'orange', 'green') then item.value->>'color' else 'blue' end,
  (item.ordinality - 1)::integer
from public.workspaces w
cross join lateral jsonb_array_elements(case when jsonb_typeof(w.state->'events') = 'array' then w.state->'events' else '[]'::jsonb end) with ordinality as item(value, ordinality)
where nullif(item.value->>'id', '') is not null and item.value->>'date' ~ '^\d{4}-\d{2}-\d{2}$'
on conflict (workspace_id, id) do nothing;

insert into public.workspace_pages (workspace_id, id, title, icon, cover, blocks, task_ids, project_ids, position)
select w.id, item.value->>'id', coalesce(item.value->>'title', 'Sin titulo'), coalesce(nullif(item.value->>'icon', ''), '📄'), coalesce(item.value->>'cover', ''),
  case when jsonb_typeof(item.value->'blocks') = 'array' then item.value->'blocks' else '[]'::jsonb end,
  array(select jsonb_array_elements_text(case when jsonb_typeof(item.value->'taskIds') = 'array' then item.value->'taskIds' else '[]'::jsonb end)),
  array(select jsonb_array_elements_text(case when jsonb_typeof(item.value->'projectIds') = 'array' then item.value->'projectIds' else '[]'::jsonb end)),
  (item.ordinality - 1)::integer
from public.workspaces w
cross join lateral jsonb_array_elements(case when jsonb_typeof(w.state->'pages') = 'array' then w.state->'pages' else '[]'::jsonb end) with ordinality as item(value, ordinality)
where nullif(item.value->>'id', '') is not null
on conflict (workspace_id, id) do nothing;

update public.workspaces set state = state - 'tasks' - 'events' - 'pages'
where state ?| array['tasks', 'events', 'pages'];

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
  item record;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if char_length(trim(p_name)) not between 1 and 80 then raise exception 'Invalid workspace name'; end if;
  select email into caller_email from auth.users where id = caller;
  insert into public.workspaces (name, owner_id, state)
  values (trim(p_name), caller, coalesce(p_state, '{}'::jsonb) - 'tasks' - 'events' - 'pages')
  returning id into new_workspace;
  insert into public.workspace_members (workspace_id, user_id, email, role)
  values (new_workspace, caller, coalesce(caller_email, 'Usuario'), 'owner');

  for item in select value, ordinality from jsonb_array_elements(case when jsonb_typeof(p_state->'tasks') = 'array' then p_state->'tasks' else '[]'::jsonb end) with ordinality loop
    insert into public.workspace_tasks (workspace_id, id, title, done, due_date, priority, position) values (
      new_workspace, item.value->>'id', coalesce(nullif(item.value->>'title', ''), 'Tarea'), coalesce((item.value->>'done')::boolean, false),
      case when item.value->>'date' ~ '^\d{4}-\d{2}-\d{2}$' then (item.value->>'date')::date end,
      case when item.value->>'priority' in ('Alta', 'Media', 'Baja') then item.value->>'priority' else 'Media' end, (item.ordinality - 1)::integer);
  end loop;
  for item in select value, ordinality from jsonb_array_elements(case when jsonb_typeof(p_state->'events') = 'array' then p_state->'events' else '[]'::jsonb end) with ordinality loop
    if item.value->>'date' ~ '^\d{4}-\d{2}-\d{2}$' then
      insert into public.workspace_events (workspace_id, id, title, event_date, start_minute, duration_minutes, color, position) values (
        new_workspace, item.value->>'id', coalesce(nullif(item.value->>'title', ''), 'Evento'), (item.value->>'date')::date,
        greatest(0, least(1439, coalesce((item.value->>'start')::integer, 0))), greatest(15, least(1440, coalesce((item.value->>'duration')::integer, 60))),
        case when item.value->>'color' in ('blue', 'purple', 'orange', 'green') then item.value->>'color' else 'blue' end, (item.ordinality - 1)::integer);
    end if;
  end loop;
  for item in select value, ordinality from jsonb_array_elements(case when jsonb_typeof(p_state->'pages') = 'array' then p_state->'pages' else '[]'::jsonb end) with ordinality loop
    insert into public.workspace_pages (workspace_id, id, title, icon, cover, blocks, task_ids, project_ids, position) values (
      new_workspace, item.value->>'id', coalesce(item.value->>'title', 'Sin titulo'), coalesce(nullif(item.value->>'icon', ''), '📄'), coalesce(item.value->>'cover', ''),
      case when jsonb_typeof(item.value->'blocks') = 'array' then item.value->'blocks' else '[]'::jsonb end,
      array(select jsonb_array_elements_text(case when jsonb_typeof(item.value->'taskIds') = 'array' then item.value->'taskIds' else '[]'::jsonb end)),
      array(select jsonb_array_elements_text(case when jsonb_typeof(item.value->'projectIds') = 'array' then item.value->'projectIds' else '[]'::jsonb end)), (item.ordinality - 1)::integer);
  end loop;
  return new_workspace;
end;
$$;

revoke all on function public.create_workspace(text, jsonb) from public, anon;
grant execute on function public.create_workspace(text, jsonb) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['workspace_tasks', 'workspace_events', 'workspace_pages'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 100),
  daily_hour smallint not null default 9 check (daily_hour between 0 and 23),
  event_lead_minutes smallint not null default 30 check (event_lead_minutes in (10, 15, 30, 60, 120)),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_delivery_log (
  id bigint generated always as identity primary key,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  reminder_key text not null,
  delivered_at timestamptz not null default now(),
  unique (subscription_id, reminder_key)
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
create index if not exists push_delivery_log_delivered_idx on public.push_delivery_log(delivered_at);

alter table public.push_subscriptions enable row level security;
alter table public.push_delivery_log enable row level security;

create policy "users manage their push subscriptions" on public.push_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.push_subscriptions, public.push_delivery_log from public, anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
create trigger push_subscriptions_touch_updated_at before update on public.push_subscriptions for each row execute function private.touch_workspace_updated_at();
