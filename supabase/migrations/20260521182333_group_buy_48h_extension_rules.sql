-- Enforce the 48-hour default, single extension flow, host reminder notice,
-- and one-hour leave lock for storefront-created group buys.

CREATE SCHEMA IF NOT EXISTS private;

ALTER TABLE public.group_buys
  ADD COLUMN IF NOT EXISTS extension_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS extension_hours integer,
  ADD COLUMN IF NOT EXISTS extended_at timestamptz,
  ADD COLUMN IF NOT EXISTS extension_notice_sent_at timestamptz;

UPDATE public.group_buys
SET extension_used = false
WHERE extension_used IS DISTINCT FROM false;

ALTER TABLE public.group_buys
  ALTER COLUMN extension_used SET DEFAULT false,
  ALTER COLUMN extension_used SET NOT NULL;

ALTER TABLE public.group_buys
  DROP CONSTRAINT IF EXISTS group_buys_extension_hours_check;

ALTER TABLE public.group_buys
  ADD CONSTRAINT group_buys_extension_hours_check
  CHECK (extension_hours IS NULL OR extension_hours IN (2, 4, 6));

ALTER TABLE public.group_buys
  DROP CONSTRAINT IF EXISTS group_buys_extension_state_check;

ALTER TABLE public.group_buys
  ADD CONSTRAINT group_buys_extension_state_check
  CHECK (
    (extension_used = false AND extension_hours IS NULL AND extended_at IS NULL)
    OR (extension_used = true AND extension_hours IS NOT NULL AND extended_at IS NOT NULL)
  );

-- Backfill legacy shopper-created 7-day windows to the new 48-hour default.
UPDATE public.group_buys
SET expires_at = created_at + interval '48 hours',
    updated_at = now()
WHERE status = 'open'
  AND COALESCE(extension_used, false) = false
  AND abs(extract(epoch FROM (expires_at - (created_at + interval '7 days')))) <= 300;

DROP POLICY IF EXISTS "Creators can extend their own group buys" ON public.group_buys;
CREATE POLICY "Creators can extend their own group buys"
ON public.group_buys
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE OR REPLACE FUNCTION private.apply_group_buy_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF NEW.created_by IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND NEW.created_by = auth.uid()
     AND NOT public.is_admin_or_manager(auth.uid()) THEN
    NEW.expires_at := now() + interval '48 hours';
  ELSIF NEW.expires_at IS NULL THEN
    NEW.expires_at := now() + interval '48 hours';
  END IF;

  NEW.extension_used := COALESCE(NEW.extension_used, false);

  IF COALESCE(NEW.extension_used, false) = false THEN
    NEW.extension_hours := NULL;
    NEW.extended_at := NULL;
  END IF;

  IF NEW.extension_notice_sent_at IS NULL THEN
    NEW.extension_notice_sent_at := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.apply_group_buy_defaults() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS apply_group_buy_defaults_before_insert ON public.group_buys;
CREATE TRIGGER apply_group_buy_defaults_before_insert
BEFORE INSERT ON public.group_buys
FOR EACH ROW
EXECUTE FUNCTION private.apply_group_buy_defaults();

CREATE OR REPLACE FUNCTION private.enforce_creator_group_buy_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR public.is_admin_or_manager(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF auth.uid() <> OLD.created_by THEN
    RAISE EXCEPTION 'You cannot edit this group buy';
  END IF;

  IF (
    to_jsonb(NEW) - ARRAY['expires_at', 'extension_hours', 'extension_used', 'extended_at', 'updated_at']::text[]
  ) IS DISTINCT FROM (
    to_jsonb(OLD) - ARRAY['expires_at', 'extension_hours', 'extension_used', 'extended_at', 'updated_at']::text[]
  ) THEN
    RAISE EXCEPTION 'You can only extend your group buy timer';
  END IF;

  IF OLD.status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'Only open group buys can be extended';
  END IF;

  IF COALESCE(OLD.current_participants, 0) >= OLD.min_participants THEN
    RAISE EXCEPTION 'Filled group buys cannot be extended';
  END IF;

  IF COALESCE(OLD.extension_used, false) THEN
    RAISE EXCEPTION 'This group buy has already been extended once';
  END IF;

  IF OLD.expires_at <= now() THEN
    RAISE EXCEPTION 'This group buy has already expired';
  END IF;

  IF OLD.expires_at > now() + interval '1 hour' THEN
    RAISE EXCEPTION 'The timer can only be extended during the final hour';
  END IF;

  IF NEW.extension_hours IS NULL OR NEW.extension_hours NOT IN (2, 4, 6) THEN
    RAISE EXCEPTION 'Choose a 2-hour, 4-hour, or 6-hour extension';
  END IF;

  NEW.extension_used := true;
  NEW.extended_at := now();
  NEW.expires_at := OLD.expires_at + make_interval(hours => NEW.extension_hours);
  NEW.updated_at := now();

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.enforce_creator_group_buy_updates() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_creator_group_buy_updates_before_update ON public.group_buys;
CREATE TRIGGER enforce_creator_group_buy_updates_before_update
BEFORE UPDATE ON public.group_buys
FOR EACH ROW
EXECUTE FUNCTION private.enforce_creator_group_buy_updates();

DROP POLICY IF EXISTS "Users can leave group buys" ON public.group_buy_participants;
DROP POLICY IF EXISTS "Users can leave group buys within one hour of joining" ON public.group_buy_participants;
CREATE POLICY "Users can leave group buys within one hour of joining"
ON public.group_buy_participants
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  AND joined_at >= now() - interval '1 hour'
  AND EXISTS (
    SELECT 1
    FROM public.group_buys gb
    WHERE gb.id = group_buy_participants.group_buy_id
      AND gb.status = 'open'
      AND COALESCE(gb.current_participants, 0) < gb.min_participants
  )
);

CREATE OR REPLACE FUNCTION public.check_expired_group_buys()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  gb public.group_buys%ROWTYPE;
  participant RECORD;
  now_value timestamptz := now();
BEGIN
  FOR gb IN
    SELECT *
    FROM public.group_buys
    WHERE status = 'open'
      AND COALESCE(current_participants, 0) < min_participants
      AND COALESCE(extension_used, false) = false
      AND extension_notice_sent_at IS NULL
      AND expires_at > now_value
      AND expires_at <= now_value + interval '1 hour'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (
      gb.created_by,
      'Group Buy Expiring Soon',
      'Your group buy "' || COALESCE(gb.title, 'Group Buy') || '" has less than 1 hour left. You can extend it once by 2, 4, or 6 hours if it is still not filled.',
      'group_buy',
      jsonb_build_object('group_buy_id', gb.id, 'expires_at', gb.expires_at, 'can_extend', true)
    );

    UPDATE public.group_buys
    SET extension_notice_sent_at = now_value,
        updated_at = now_value
    WHERE id = gb.id;
  END LOOP;

  FOR gb IN
    SELECT *
    FROM public.group_buys
    WHERE status = 'open'
      AND expires_at <= now_value
  LOOP
    IF COALESCE(gb.current_participants, 0) >= gb.min_participants THEN
      UPDATE public.group_buys
      SET status = 'filled',
          updated_at = now_value
      WHERE id = gb.id;

      FOR participant IN
        SELECT user_id
        FROM public.group_buy_participants
        WHERE group_buy_id = gb.id
      LOOP
        INSERT INTO public.notifications (user_id, title, message, type, data)
        VALUES (
          participant.user_id,
          'Group Buy Closed Successfully',
          'The group buy "' || COALESCE(gb.title, 'Group Buy') || '" closed with enough participants and is now ready for fulfillment.',
          'group_buy',
          jsonb_build_object('group_buy_id', gb.id)
        );
      END LOOP;
    ELSE
      UPDATE public.group_buys
      SET status = 'cancelled',
          updated_at = now_value
      WHERE id = gb.id;

      FOR participant IN
        SELECT user_id
        FROM public.group_buy_participants
        WHERE group_buy_id = gb.id
      LOOP
        INSERT INTO public.notifications (user_id, title, message, type, data)
        VALUES (
          participant.user_id,
          'Group Buy Expired',
          'The group buy "' || COALESCE(gb.title, 'Group Buy') || '" expired without reaching its goal. Refund processing will begin.',
          'group_buy',
          jsonb_build_object('group_buy_id', gb.id)
        );
      END LOOP;
    END IF;
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.check_expired_group_buys() TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'check-expired-group-buys'
  ) THEN
    PERFORM cron.unschedule('check-expired-group-buys');
  END IF;
END;
$$;

SELECT cron.schedule(
  'check-expired-group-buys',
  '*/5 * * * *',
  $$SELECT public.check_expired_group_buys();$$
);

NOTIFY pgrst, 'reload schema';
