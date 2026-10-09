-- Comments on tasks and subtasks.
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists task_comments_task_idx on public.task_comments(task_id);
create index if not exists task_comments_project_idx on public.task_comments(project_id);
alter table public.task_comments enable row level security;
create policy task_comments_select on public.task_comments for select to authenticated using ((select public.is_approved()));
create policy task_comments_insert on public.task_comments for insert to authenticated with check ((select public.is_approved()) and user_id = (select auth.uid()));
create policy task_comments_delete on public.task_comments for delete to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
grant select, insert, delete on public.task_comments to authenticated;
alter publication supabase_realtime add table public.task_comments;

-- Main-task progress only; overdue counts tasks and subtasks.
create or replace view public.project_progress as
 select p.id as project_id,
    count(t.id) filter (where t.parent_id is null) as total,
    count(t.id) filter (where t.parent_id is null and t.done) as done,
    count(t.id) filter (where not t.done and t.due < current_date) as overdue,
    min(t.due) filter (where not t.done) as next_due
   from projects p left join tasks t on t.project_id = p.id
  group by p.id;
alter table public.task_comments replica identity full; -- so deletes reach live listeners
