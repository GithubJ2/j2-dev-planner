-- Internal tool: access is gated by admin approval, so email confirmation is unnecessary.
create or replace function public.auto_confirm_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is null then new.email_confirmed_at := now(); end if;
  return new;
end; $$;
revoke execute on function public.auto_confirm_user() from public, anon, authenticated;
create trigger auto_confirm_user before insert on auth.users
for each row execute function public.auto_confirm_user();
