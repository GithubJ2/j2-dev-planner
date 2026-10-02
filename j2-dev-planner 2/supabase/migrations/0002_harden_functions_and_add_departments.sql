-- J2 Dev Planner: lock down functions, add departments, plan status and templates

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_field_change() from public, anon, authenticated;
revoke execute on function public.is_approved() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_approved() to authenticated;
grant execute on function public.is_admin() to authenticated;

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default '📁',
  color text not null default '#64748b',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.departments enable row level security;
create policy departments_select on public.departments for select to authenticated
  using ((select public.is_approved()));
create policy departments_admin_insert on public.departments for insert to authenticated
  with check ((select public.is_admin()));
create policy departments_admin_update on public.departments for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy departments_admin_delete on public.departments for delete to authenticated
  using ((select public.is_admin()));

insert into public.departments (name, icon, color, sort_order) values
  ('Sales & Marketing', '📈', '#2563eb', 1),
  ('Development', '💻', '#7c3aed', 2),
  ('Security Operations', '🛡️', '#dc2626', 3),
  ('Operations', '⚙️', '#0891b2', 4),
  ('Finance & Admin', '💼', '#ca8a04', 5),
  ('Leadership', '🧭', '#0f766e', 6);

alter table public.plans
  add column department_id uuid references public.departments(id) on delete set null,
  add column status text not null default 'planning'
    check (status in ('planning','in_review','approved','in_build','live','on_hold')),
  add column is_template boolean not null default false;

create index plans_department_id_idx on public.plans(department_id);
create index plans_created_by_idx on public.plans(created_by);

-- Copy any plan (as a template or with answers)
create or replace function public.duplicate_plan(src uuid, new_title text, keep_values boolean default false)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  new_plan uuid;
  n record;
  new_node uuid;
  id_map jsonb := '{}'::jsonb;
begin
  if not public.is_approved() then raise exception 'Not authorised'; end if;

  insert into public.plans (title, description, icon, color, department_id, created_by)
  select new_title, p.description, p.icon, p.color, p.department_id, auth.uid()
  from public.plans p where p.id = src
  returning id into new_plan;

  if new_plan is null then raise exception 'Plan not found'; end if;

  for n in select * from public.plan_nodes where plan_id = src loop
    insert into public.plan_nodes (plan_id, title, subtitle, category, notes, pos_x, pos_y)
    values (new_plan, n.title, n.subtitle, n.category,
            case when keep_values then n.notes end, n.pos_x, n.pos_y)
    returning id into new_node;

    id_map := id_map || jsonb_build_object(n.id::text, new_node::text);

    insert into public.node_fields (node_id, plan_id, label, help, field_type, options, value, status, owner, sort_order)
    select new_node, new_plan, f.label, f.help, f.field_type, f.options,
           case when keep_values then f.value end,
           case when keep_values then f.status else 'open' end,
           f.owner, f.sort_order
    from public.node_fields f where f.node_id = n.id;
  end loop;

  insert into public.plan_edges (plan_id, source_id, target_id, label)
  select new_plan, (id_map->>e.source_id::text)::uuid, (id_map->>e.target_id::text)::uuid, e.label
  from public.plan_edges e where e.plan_id = src;

  return new_plan;
end; $$;

revoke execute on function public.duplicate_plan(uuid, text, boolean) from public, anon;
grant execute on function public.duplicate_plan(uuid, text, boolean) to authenticated;
