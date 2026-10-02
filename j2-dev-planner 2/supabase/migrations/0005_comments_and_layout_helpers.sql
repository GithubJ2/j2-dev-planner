-- Comments on questions, batch position saves, atomic question reorder.
create table public.field_comments (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.node_fields(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index field_comments_field_id_idx on public.field_comments(field_id);
create index field_comments_plan_id_idx on public.field_comments(plan_id);
create index field_comments_user_id_idx on public.field_comments(user_id);
alter table public.field_comments enable row level security;
create policy field_comments_select on public.field_comments for select to authenticated using ((select public.is_approved()));
create policy field_comments_insert on public.field_comments for insert to authenticated with check ((select public.is_approved()) and user_id = (select auth.uid()));
create policy field_comments_delete on public.field_comments for delete to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
grant select, insert, delete on public.field_comments to authenticated;
revoke all on public.field_comments from anon;
alter publication supabase_realtime add table public.field_comments;

create or replace function public.log_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare lbl text;
begin
  select f.label into lbl from public.node_fields f where f.id = new.field_id;
  insert into public.activity_log (plan_id, user_id, action, detail)
  values (new.plan_id, new.user_id, 'comment_added', jsonb_build_object('field_id', new.field_id, 'label', lbl));
  update public.plans set updated_at = now() where id = new.plan_id;
  return new;
end; $$;
revoke execute on function public.log_comment() from public, anon, authenticated;
create trigger field_comments_log after insert on public.field_comments for each row execute function public.log_comment();

create or replace function public.set_node_positions(positions jsonb)
returns void language sql security invoker set search_path = '' as $$
  update public.plan_nodes n set pos_x = (p->>'x')::float8, pos_y = (p->>'y')::float8
  from jsonb_array_elements(positions) p where n.id = (p->>'id')::uuid;
$$;
revoke execute on function public.set_node_positions(jsonb) from public, anon;
grant execute on function public.set_node_positions(jsonb) to authenticated;

create or replace function public.swap_field_order(a uuid, b uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare oa int; ob int;
begin
  select sort_order into oa from public.node_fields where id = a;
  select sort_order into ob from public.node_fields where id = b;
  if oa is null or ob is null then raise exception 'Question not found'; end if;
  if oa = ob then ob := ob + 1; end if;
  update public.node_fields set sort_order = ob where id = a;
  update public.node_fields set sort_order = oa where id = b;
end; $$;
revoke execute on function public.swap_field_order(uuid, uuid) from public, anon;
grant execute on function public.swap_field_order(uuid, uuid) to authenticated;
