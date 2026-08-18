-- Allow the restricted Kiddush administrator role.
-- Run this once in Supabase SQL Editor before assigning Kiddush-only access.
begin;

alter table public.members
  drop constraint if exists members_portal_role_check;

alter table public.members
  add constraint members_portal_role_check
  check (portal_role in ('member', 'admin', 'kiddush_admin'));

commit;
