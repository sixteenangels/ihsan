CREATE OR REPLACE FUNCTION private.get_user_loyalty_points_balance(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT COALESCE(
    SUM(
      CASE
        WHEN type = 'earn' THEN points
        WHEN type = 'redeem' THEN -points
        ELSE 0
      END
    ),
    0
  )::integer
  FROM public.loyalty_points
  WHERE user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION private.get_user_wallet_balance(p_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT COALESCE(
    SUM(
      CASE
        WHEN type = 'credit' THEN amount
        WHEN type = 'debit' THEN -amount
        ELSE 0
      END
    ),
    0
  )
  FROM public.wallet_transactions
  WHERE user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_checkout_loyalty_balance(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.get_user_loyalty_points_balance(p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.get_checkout_wallet_balance(p_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.get_user_wallet_balance(p_user_id);
$$;

REVOKE ALL ON FUNCTION public.get_checkout_loyalty_balance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_checkout_wallet_balance(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_checkout_loyalty_balance(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_checkout_wallet_balance(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
