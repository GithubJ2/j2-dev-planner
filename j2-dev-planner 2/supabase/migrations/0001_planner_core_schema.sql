-- J2 Dev Planner: core schema (applied to Supabase project gtwejdzarmfomrnvmifp)

-- PROFILES + ACCESS CONTROL ------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'member' check (role in ('admin','member')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.approved from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role = 'admin' and p.approved from public.profiles p where p.id = auth.uid()), false);
$$;

-- First user to sign up becomes an approved admin; everyone else waits for approval.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, email, full_name, role, approved)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
          case when first_user then 'admin' else 'member' end,
          first_user);
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.set_user_access(target uuid, make_approved boolean, make_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Only admins can change access'; end if;
  if make_role not in ('admin','member') then raise exception 'Invalid role'; end if;
  if target = auth.uid() and (make_role <> 'admin' or make_approved = false) then
    raise exception 'You cannot remove your own admin access';
  end if;
  update public.profiles set approved = make_approved, role = make_role where id = target;
end; $$;

revoke execute on function public.set_user_access(uuid, boolean, text) from public, anon;
grant execute on function public.set_user_access(uuid, boolean, text) to authenticated;

-- PLANS --------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  icon text not null default '🗺️',
  color text not null default '#2563eb',
  archived boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plan_nodes (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  title text not null,
  subtitle text,
  category text not null default 'process'
    check (category in ('source','strategy','integration','compliance','channel','process','handoff','analytics','admin')),
  notes text,
  pos_x double precision not null default 0,
  pos_y double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plan_nodes_plan_id_idx on public.plan_nodes(plan_id);

create table public.plan_edges (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  source_id uuid not null references public.plan_nodes(id) on delete cascade,
  target_id uuid not null references public.plan_nodes(id) on delete cascade,
  label text,
  created_at timestamptz not null default now(),
  unique (plan_id, source_id, target_id)
);
create index plan_edges_plan_id_idx on public.plan_edges(plan_id);
create index plan_edges_source_idx on public.plan_edges(source_id);
create index plan_edges_target_idx on public.plan_edges(target_id);

create table public.node_fields (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.plan_nodes(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete cascade,
  label text not null,
  help text,
  field_type text not null default 'text'
    check (field_type in ('text','textarea','select','multiselect','number','checkbox','date')),
  options jsonb not null default '[]'::jsonb,
  value jsonb,
  status text not null default 'open' check (status in ('open','to_confirm','decided')),
  owner text,
  sort_order int not null default 0,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index node_fields_node_id_idx on public.node_fields(node_id);
create index node_fields_plan_id_idx on public.node_fields(plan_id);
create index node_fields_updated_by_idx on public.node_fields(updated_by);

create table public.activity_log (
  id bigint generated always as identity primary key,
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_plan_id_idx on public.activity_log(plan_id, created_at desc);
create index activity_log_user_id_idx on public.activity_log(user_id);

-- TRIGGERS -----------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;

create trigger plans_touch before update on public.plans
for each row execute function public.touch_updated_at();
create trigger plan_nodes_touch before update on public.plan_nodes
for each row execute function public.touch_updated_at();

create or replace function public.node_fields_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then new.updated_by := auth.uid(); end if;
  return new;
end; $$;

create trigger node_fields_before_write before insert or update on public.node_fields
for each row execute function public.node_fields_before_write();

create or replace function public.log_field_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;
  if new.value is distinct from old.value or new.status is distinct from old.status then
    insert into public.activity_log (plan_id, user_id, action, detail)
    values (new.plan_id, auth.uid(), 'field_updated',
      jsonb_build_object('field_id', new.id, 'node_id', new.node_id, 'label', new.label,
                         'status', new.status, 'old_status', old.status));
    update public.plans set updated_at = now() where id = new.plan_id;
  end if;
  return new;
end; $$;

create trigger node_fields_log after update on public.node_fields
for each row execute function public.log_field_change();

-- PROGRESS VIEW ------------------------------------------------------------
create view public.plan_progress with (security_invoker = true) as
select
  f.plan_id,
  count(*)::int as total,
  (count(*) filter (where f.status = 'decided'))::int as decided,
  (count(*) filter (where f.status = 'to_confirm'))::int as to_confirm,
  (count(*) filter (where f.value is not null
                      and f.value not in ('""'::jsonb, '[]'::jsonb, 'null'::jsonb)))::int as filled
from public.node_fields f
group by f.plan_id;

-- ROW LEVEL SECURITY -------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.plan_nodes enable row level security;
alter table public.plan_edges enable row level security;
alter table public.node_fields enable row level security;
alter table public.activity_log enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_approved()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated, anon;
grant update (full_name) on public.profiles to authenticated;

create policy plans_all on public.plans for all to authenticated
  using ((select public.is_approved())) with check ((select public.is_approved()));
create policy plan_nodes_all on public.plan_nodes for all to authenticated
  using ((select public.is_approved())) with check ((select public.is_approved()));
create policy plan_edges_all on public.plan_edges for all to authenticated
  using ((select public.is_approved())) with check ((select public.is_approved()));
create policy node_fields_all on public.node_fields for all to authenticated
  using ((select public.is_approved())) with check ((select public.is_approved()));
create policy activity_select on public.activity_log for select to authenticated
  using ((select public.is_approved()));
create policy activity_insert on public.activity_log for insert to authenticated
  with check ((select public.is_approved()) and user_id = (select auth.uid()));

-- REALTIME -----------------------------------------------------------------
alter publication supabase_realtime add table public.plans, public.plan_nodes, public.plan_edges, public.node_fields;
