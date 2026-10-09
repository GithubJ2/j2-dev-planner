-- @mentions and notifications (applied 9 Oct 2026 via MCP, statement by statement).
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('mention','owner','waiting')),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  comment_id uuid references public.task_comments(id) on delete cascade,
  snippet text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, read_at, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, update (read_at) on public.notifications to authenticated;
alter table public.notifications replica identity full;
alter publication supabase_realtime add table public.notifications;

create or replace function public.profiles_by_first_name(p_names text[]) returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct p.id from profiles p
  where p.approved and exists (
    select 1 from unnest(p_names) n
    where lower(n) = lower(split_part(coalesce(nullif(trim(p.full_name), ''), split_part(p.email, '@', 1)), ' ', 1))
       or lower(n) = lower(split_part(p.email, '@', 1)))
$$;
create or replace function public.mention_names(p_text text) returns text[]
language sql immutable set search_path = public as $$
  select coalesce(array_agg(distinct m[2]), '{}') from regexp_matches(coalesce(p_text, ''), '(^|[^A-Za-z0-9._%+-])@([A-Za-z][A-Za-z0-9_-]*)', 'g') as m
$$;
-- notify_comment_mentions(): after insert on task_comments -> 'mention' rows for @named users (not the author).
-- notify_task_people(): after insert/update of title, help, people on tasks -> new @mentions, and people newly added as owner/waiting.
-- (Full bodies live in the database; see pg_get_functiondef.)
