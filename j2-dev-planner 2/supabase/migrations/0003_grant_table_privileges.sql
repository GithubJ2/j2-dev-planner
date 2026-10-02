-- Row-level security decides WHICH rows; these grants let signed-in users reach the tables at all.
grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.plans to authenticated;
grant select, insert, update, delete on public.plan_nodes to authenticated;
grant select, insert, update, delete on public.plan_edges to authenticated;
grant select, insert, update, delete on public.node_fields to authenticated;
grant select, insert, update, delete on public.departments to authenticated;
grant select, insert on public.activity_log to authenticated;
grant select on public.plan_progress to authenticated;
revoke all on public.profiles, public.plans, public.plan_nodes, public.plan_edges,
  public.node_fields, public.departments, public.activity_log, public.plan_progress from anon;
