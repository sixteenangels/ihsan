-- Resolve Supabase advisor warnings for exposed public SECURITY DEFINER RPCs.
-- Private helpers stay outside the exposed API schema; public wrappers use invoker semantics.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $function$
  SELECT private.has_role(_user_id, _role);
$function$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $function$
  SELECT private.is_admin_or_manager(_user_id);
$function$;

CREATE OR REPLACE FUNCTION public.get_group_buy_participant_faces(
  p_group_buy_id uuid,
  p_limit integer DEFAULT 8
)
RETURNS TABLE (
  participant_id uuid,
  display_name text,
  avatar_url text,
  joined_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $function$
  SELECT *
  FROM private.get_group_buy_participant_faces(p_group_buy_id, p_limit);
$function$;

CREATE OR REPLACE FUNCTION public.get_public_store_settings()
RETURNS TABLE (
  key text,
  value jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $function$
  SELECT *
  FROM private.get_public_store_settings();
$function$;

CREATE OR REPLACE FUNCTION public.verify_receipt(public_receipt_number text)
RETURNS TABLE (
  receipt_number text,
  generated_at timestamptz,
  order_number text,
  order_status text,
  order_date timestamptz,
  customer_name text,
  customer_email text,
  subtotal numeric,
  shipping_price numeric,
  packaging_cost numeric,
  wallet_credit_used numeric,
  total_amount numeric,
  shipping_address jsonb,
  items jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $function$
  SELECT *
  FROM private.verify_public_receipt(public_receipt_number);
$function$;

CREATE OR REPLACE FUNCTION public.resolve_group_buy_invite(invite_code_input text)
RETURNS TABLE (
  invite_code text,
  inviter_user_id uuid,
  group_buy_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $function$
  SELECT *
  FROM private.resolve_group_buy_invite(invite_code_input);
$function$;

CREATE OR REPLACE FUNCTION public.record_group_buy_invite_visit(
  invite_code_input text,
  visitor_token_input text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $function$
  SELECT private.record_group_buy_invite_visit(invite_code_input, visitor_token_input);
$function$;

CREATE OR REPLACE FUNCTION public.record_recommendation_event(
  product_id_input uuid,
  event_type_input text,
  source_input text DEFAULT NULL,
  quantity_input integer DEFAULT 1,
  product_variant_id_input uuid DEFAULT NULL,
  order_id_input uuid DEFAULT NULL,
  metadata_input jsonb DEFAULT '{}'::jsonb,
  session_id_input text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $function$
  SELECT private.record_recommendation_event(
    product_id_input,
    event_type_input,
    source_input,
    quantity_input,
    product_variant_id_input,
    order_id_input,
    metadata_input,
    session_id_input
  );
$function$;

CREATE OR REPLACE FUNCTION public.confirm_order_delivery(order_id_input uuid)
RETURNS TABLE(order_id uuid, confirmed_at timestamptz)
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $function$
  SELECT *
  FROM private.confirm_order_delivery(order_id_input);
$function$;

CREATE OR REPLACE FUNCTION public.redeem_gift_card(input_code text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to redeem a gift card.';
  END IF;

  RETURN private.redeem_gift_card_internal(input_code);
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_expired_group_buys()
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    PERFORM private.check_expired_group_buys_internal();
    RETURN;
  END IF;

  IF NOT public.is_admin_or_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and managers can run this job.';
  END IF;

  PERFORM private.check_expired_group_buys_internal();
END;
$function$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin_or_manager(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_group_buy_participant_faces(uuid, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_public_store_settings() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.verify_public_receipt(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.resolve_group_buy_invite(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.record_group_buy_invite_visit(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.record_recommendation_event(uuid, text, text, integer, uuid, uuid, jsonb, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.confirm_order_delivery(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.redeem_gift_card_internal(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.check_expired_group_buys_internal() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_or_manager(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_group_buy_participant_faces(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_store_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_receipt(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_group_buy_invite(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_group_buy_invite_visit(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_recommendation_event(uuid, text, text, integer, uuid, uuid, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_order_delivery(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_gift_card(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_expired_group_buys() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_manager(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_group_buy_participant_faces(uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_store_settings() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_receipt(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_group_buy_invite(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_group_buy_invite_visit(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_recommendation_event(uuid, text, text, integer, uuid, uuid, jsonb, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_delivery(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_gift_card(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_expired_group_buys() TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
