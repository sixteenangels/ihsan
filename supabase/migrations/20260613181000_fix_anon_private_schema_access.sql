-- Restore minimal private schema access for anon-facing SECURITY INVOKER RPC wrappers.
-- Migration 20260613140000 revoked USAGE on private from anon, which broke public
-- wrappers such as get_public_store_settings() for unauthenticated shoppers.

GRANT USAGE ON SCHEMA private TO anon;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO anon;
GRANT EXECUTE ON FUNCTION private.is_admin_or_manager(uuid) TO anon;
GRANT EXECUTE ON FUNCTION private.get_group_buy_participant_faces(uuid, integer) TO anon;
GRANT EXECUTE ON FUNCTION private.get_public_store_settings() TO anon;
GRANT EXECUTE ON FUNCTION private.verify_public_receipt(text) TO anon;
GRANT EXECUTE ON FUNCTION private.resolve_group_buy_invite(text) TO anon;
GRANT EXECUTE ON FUNCTION private.record_group_buy_invite_visit(text, text) TO anon;
GRANT EXECUTE ON FUNCTION private.record_recommendation_event(uuid, text, text, integer, uuid, uuid, jsonb, text) TO anon;

NOTIFY pgrst, 'reload schema';
