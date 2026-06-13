-- Restore minimal private schema access for public role helper functions.
-- Security migration 20260613140000 revoked USAGE on private from authenticated,
-- which broke SECURITY INVOKER wrappers used throughout admin RLS policies.

GRANT USAGE ON SCHEMA private TO authenticated;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin_or_manager(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
