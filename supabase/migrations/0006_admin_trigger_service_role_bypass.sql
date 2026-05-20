-- 0006 — admins privileged-fields trigger: fix service-role bypass clause.
--
-- The trigger introduced in 0003 (`admins_protect_privileged_fields`)
-- was meant to bypass for service-role server calls (invite acceptance,
-- promote / demote / deactivate / reactivate via the admin-management
-- API), but its bypass clause inspects `rolsuper` on `current_user`:
--
--     if (select rolsuper from pg_roles where rolname = current_user) then
--       return new;
--     end if;
--
-- In Supabase, PostgREST authenticates as `authenticator` and SET ROLE to
-- `service_role` for service-role JWTs. `service_role` has `bypassrls`
-- but NOT `rolsuper` — only `postgres` / `supabase_admin` do, and those
-- never own a request inside PostgREST. As a result the bypass never
-- triggers in production, every service-role UPDATE on
-- `public.admins.{tier,status,email}` falls through to the
-- `is_super_admin()` check, and `auth.uid()` is NULL on a service-role
-- call so the check returns false. The trigger then raises 42501 with
-- e.g. "status may only be changed by a super_admin".
--
-- Observed in prod (2026-05-20) blocking the invite-acceptance flow
-- shipped in PR #39: the new `establishAdminSession` promotion
-- `update admins set status='active' where id = <invitee>` was rejected
-- with 403 "status may only be changed by a super_admin" on every
-- attempt. By extension, every admin-management row action (promote,
-- demote, deactivate, reactivate) was also blocked — they touch the same
-- columns through the same service-role client.
--
-- This migration recreates the trigger function with a correct bypass
-- clause that catches every role through which a service-role-class
-- call can land at the database:
--
--     current_user IN ('service_role',   -- the PostgREST SET ROLE target
--                      'supabase_admin', -- local supabase shell / studio
--                      'postgres')       -- raw psql / migrations
--
-- The non-bypass path (a signed-in admin via the authenticated role)
-- is unchanged: the trigger still calls `public.is_super_admin()` and
-- still raises 42501 with the same messages on diffs of privileged
-- columns. The security posture for end-user admin updates is
-- identical; only the legitimate service-role path is unblocked.

create or replace function public.admins_protect_privileged_fields()
  returns trigger language plpgsql
as $$
declare
  is_super boolean;
begin
  -- Bypass for service-role-class roles. PostgREST sets
  -- `current_user='service_role'` for any request bearing a service-role
  -- JWT; the local supabase CLI / studio shell runs as
  -- 'postgres'/'supabase_admin'. The previous `rolsuper` check only
  -- caught the latter pair, leaving the production service-role path
  -- blocked.
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;

  is_super := public.is_super_admin();

  if not is_super then
    if new.tier is distinct from old.tier then
      raise exception 'tier may only be changed by a super_admin'
        using errcode = '42501';
    end if;
    if new.status is distinct from old.status then
      raise exception 'status may only be changed by a super_admin'
        using errcode = '42501';
    end if;
    if new.email is distinct from old.email then
      raise exception 'email may only be changed by a super_admin'
        using errcode = '42501';
    end if;
    if new.id is distinct from old.id then
      raise exception 'admin id is immutable'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- The trigger itself (created in 0003) does not need to be re-created;
-- `create or replace function` swaps the body in place and the existing
-- trigger continues to dispatch to the new body.
