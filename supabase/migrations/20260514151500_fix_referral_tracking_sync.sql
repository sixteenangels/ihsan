-- Keep referral totals authoritative even when multiple signups happen close together.
CREATE OR REPLACE FUNCTION public.sync_referral_code_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.referral_codes
    SET total_referrals = (
      SELECT count(*)::integer
      FROM public.referral_tracking
      WHERE referrer_id = NEW.referrer_id
    )
    WHERE user_id = NEW.referrer_id;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE public.referral_codes
    SET total_referrals = (
      SELECT count(*)::integer
      FROM public.referral_tracking
      WHERE referrer_id = OLD.referrer_id
    )
    WHERE user_id = OLD.referrer_id;

    RETURN OLD;
  END IF;

  IF OLD.referrer_id IS DISTINCT FROM NEW.referrer_id THEN
    UPDATE public.referral_codes
    SET total_referrals = (
      SELECT count(*)::integer
      FROM public.referral_tracking
      WHERE referrer_id = OLD.referrer_id
    )
    WHERE user_id = OLD.referrer_id;
  END IF;

  UPDATE public.referral_codes
  SET total_referrals = (
    SELECT count(*)::integer
    FROM public.referral_tracking
    WHERE referrer_id = NEW.referrer_id
  )
  WHERE user_id = NEW.referrer_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_referral_code_total() FROM PUBLIC;

DROP TRIGGER IF EXISTS sync_referral_code_total_after_change ON public.referral_tracking;
CREATE TRIGGER sync_referral_code_total_after_change
AFTER INSERT OR DELETE OR UPDATE OF referrer_id
ON public.referral_tracking
FOR EACH ROW
EXECUTE FUNCTION public.sync_referral_code_total();

UPDATE public.referral_codes rc
SET total_referrals = (
  SELECT count(*)::integer
  FROM public.referral_tracking rt
  WHERE rt.referrer_id = rc.user_id
);

ALTER TABLE public.referral_codes REPLICA IDENTITY FULL;
ALTER TABLE public.referral_tracking REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'referral_codes'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.referral_codes;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'referral_tracking'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.referral_tracking;
    END IF;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_referral_reward_once_idx
ON public.notifications (
  user_id,
  ((data ->> 'referral_tracking_id'))
)
WHERE type = 'promotion'
  AND (data ->> 'reward_kind') = 'referral_signup'
  AND data ? 'referral_tracking_id';
