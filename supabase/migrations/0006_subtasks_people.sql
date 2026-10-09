-- Subtasks and multi-person owner / waiting-on chips.
-- people: [{"name":"Jason","kind":"owner"}, {"name":"Jarred","kind":"waiting"}]
-- owner (text) is kept in sync from people for old filters, CSV export and other apps.

alter table public.tasks add column if not exists parent_id uuid references public.tasks(id) on delete cascade;
alter table public.tasks add column if not exists people jsonb not null default '[]'::jsonb;
create index if not exists tasks_parent_idx on public.tasks(parent_id);

-- Backfill people from the free-text owner column: "Jason (ask Jarred), Jack" -> Jason, Jack owners; text in brackets is kept in help.
update public.tasks
set people = (
  select coalesce(jsonb_agg(jsonb_build_object('name', trim(n), 'kind', 'owner')), '[]'::jsonb)
  from unnest(string_to_array(regexp_replace(coalesce(owner, ''), '\([^)]*\)', '', 'g'), ',')) as n
  where trim(n) <> ''
)
where people = '[]'::jsonb and coalesce(owner, '') <> '';

create or replace function public.tasks_sync_owner() returns trigger
language plpgsql set search_path = public as $$
declare o text; w text;
begin
  select string_agg(p->>'name', ', ' order by ord) into o from jsonb_array_elements(new.people) with ordinality as t(p, ord) where coalesce(p->>'kind', 'owner') = 'owner';
  select string_agg(p->>'name', ', ' order by ord) into w from jsonb_array_elements(new.people) with ordinality as t(p, ord) where p->>'kind' = 'waiting';
  if o is not null or w is not null then
    new.owner := coalesce(o, '') || case when w is not null then case when o is not null then ' ' else '' end || '(waiting on ' || w || ')' else '' end;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists tasks_sync_owner on public.tasks;
create trigger tasks_sync_owner before insert or update of people on public.tasks for each row execute function public.tasks_sync_owner();

-- Moving a task only swaps with siblings (same parent).
create or replace function public.move_task(p_task uuid, p_dir integer) returns void
language plpgsql security definer set search_path = public as $$
declare cur record; other record;
begin
  if not is_approved() then raise exception 'Not authorised'; end if;
  select id, project_id, parent_id, priority into cur from tasks where id = p_task;
  if cur is null then return; end if;
  if p_dir < 0 then
    select id, priority into other from tasks where project_id = cur.project_id and parent_id is not distinct from cur.parent_id and priority < cur.priority order by priority desc limit 1;
  else
    select id, priority into other from tasks where project_id = cur.project_id and parent_id is not distinct from cur.parent_id and priority > cur.priority order by priority asc limit 1;
  end if;
  if other is null then return; end if;
  update tasks set priority = other.priority where id = cur.id;
  update tasks set priority = cur.priority where id = other.id;
end $$;

-- Add a whole batch (tasks with subtasks) in one go, from the dump box.
-- p_tasks: [{"title":..,"people":[..],"due":"2026-10-20","tag":"blocker","help":"..","subtasks":[{...}]}]
create or replace function public.add_task_batch(p_project uuid, p_tasks jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare t jsonb; s jsonb; pid uuid; np integer; ns integer; n integer := 0;
begin
  if not is_approved() then raise exception 'Not authorised'; end if;
  select coalesce(max(priority), 0) into np from tasks where project_id = p_project and parent_id is null;
  for t in select * from jsonb_array_elements(p_tasks) loop
    if coalesce(trim(t->>'title'), '') = '' then continue; end if;
    np := np + 1;
    insert into tasks (project_id, title, people, due, tag, help, priority, created_by)
    values (p_project, trim(t->>'title'), coalesce(t->'people', '[]'::jsonb), nullif(t->>'due', '')::date, nullif(t->>'tag', ''), nullif(trim(coalesce(t->>'help', '')), ''), np, auth.uid())
    returning id into pid;
    n := n + 1; ns := 0;
    for s in select * from jsonb_array_elements(coalesce(t->'subtasks', '[]'::jsonb)) loop
      if coalesce(trim(s->>'title'), '') = '' then continue; end if;
      ns := ns + 1;
      insert into tasks (project_id, parent_id, title, people, due, tag, help, priority, created_by)
      values (p_project, pid, trim(s->>'title'), coalesce(s->'people', '[]'::jsonb), nullif(s->>'due', '')::date, nullif(s->>'tag', ''), nullif(trim(coalesce(s->>'help', '')), ''), ns, auth.uid());
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;

grant execute on function public.add_task_batch(uuid, jsonb) to authenticated;
