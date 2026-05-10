-- Expose newly added workflow tables through Supabase Data API.
-- RLS policies from the prior migration still decide row-level access.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.checkout_recovery_snapshots
TO authenticated;

GRANT SELECT
ON TABLE public.checkout_recovery_reminders
TO authenticated;

GRANT INSERT
ON TABLE public.restock_reservations
TO anon;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.restock_reservations
TO authenticated;

GRANT SELECT
ON TABLE public.product_recommendation_scores
TO anon, authenticated;

GRANT INSERT
ON TABLE public.product_recommendation_events
TO anon, authenticated;

GRANT SELECT
ON TABLE public.product_recommendation_events
TO authenticated;

GRANT SELECT
ON TABLE public.group_buy_invites
TO anon, authenticated;

GRANT INSERT
ON TABLE public.group_buy_invites
TO authenticated;

GRANT SELECT
ON TABLE public.group_buy_tiers
TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE
ON TABLE public.group_buy_tiers
TO authenticated;

GRANT SELECT, INSERT
ON TABLE public.pick_pack_scans
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.coupon_redemptions
TO authenticated;

NOTIFY pgrst, 'reload schema';
