
-- Add columns to group_buy_participants
ALTER TABLE public.group_buy_participants
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS shipping_address jsonb;

-- Add columns to group_buys
ALTER TABLE public.group_buys
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS max_participants integer;

-- Add columns to orders for group buy linking
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS group_buy_id uuid REFERENCES public.group_buys(id),
  ADD COLUMN IF NOT EXISTS is_group_buy_master boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_order_id uuid REFERENCES public.orders(id);

-- Replace the trigger function to auto-fill and notify
CREATE OR REPLACE FUNCTION public.update_group_buy_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  gb_record RECORD;
  participant RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.group_buys
    SET current_participants = current_participants + 1,
        updated_at = now()
    WHERE id = NEW.group_buy_id
    RETURNING * INTO gb_record;

    -- Auto-fill check
    IF gb_record.current_participants >= gb_record.min_participants AND gb_record.status = 'open' THEN
      UPDATE public.group_buys SET status = 'filled', updated_at = now() WHERE id = NEW.group_buy_id;

      -- Notify all participants
      FOR participant IN SELECT user_id FROM public.group_buy_participants WHERE group_buy_id = NEW.group_buy_id
      LOOP
        INSERT INTO public.notifications (user_id, title, message, type, data)
        VALUES (
          participant.user_id,
          'Group Buy Filled!',
          'The group buy "' || COALESCE(gb_record.title, 'Group Buy') || '" has reached its goal! Your order will be processed soon.',
          'group_buy',
          jsonb_build_object('group_buy_id', NEW.group_buy_id)
        );
      END LOOP;

      -- Notify admin (first admin found)
      INSERT INTO public.notifications (user_id, title, message, type, data)
      SELECT ur.user_id, 'Group Buy Filled - Action Required',
        'Group buy "' || COALESCE(gb_record.title, 'Group Buy') || '" has ' || gb_record.min_participants || ' participants. Create the collective order.',
        'group_buy',
        jsonb_build_object('group_buy_id', NEW.group_buy_id)
      FROM public.user_roles ur WHERE ur.role = 'admin' LIMIT 1;
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.group_buys
    SET current_participants = GREATEST(current_participants - 1, 0),
        updated_at = now()
    WHERE id = OLD.group_buy_id;
    RETURN OLD;
  END IF;
END;
$function$;

-- Create function to expire old group buys
CREATE OR REPLACE FUNCTION public.check_expired_group_buys()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  gb RECORD;
  participant RECORD;
BEGIN
  FOR gb IN SELECT * FROM public.group_buys WHERE status = 'open' AND expires_at < now()
  LOOP
    UPDATE public.group_buys SET status = 'cancelled', updated_at = now() WHERE id = gb.id;
    
    FOR participant IN SELECT user_id FROM public.group_buy_participants WHERE group_buy_id = gb.id
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, data)
      VALUES (
        participant.user_id,
        'Group Buy Expired',
        'The group buy "' || COALESCE(gb.title, 'Group Buy') || '" has expired without reaching its goal. Refund processing will begin.',
        'group_buy',
        jsonb_build_object('group_buy_id', gb.id)
      );
    END LOOP;
  END LOOP;
END;
$function$;

-- Allow update on group_buy_participants for payment status
CREATE POLICY "Users can update their own participation"
ON public.group_buy_participants
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow admins to view all participants
DROP POLICY IF EXISTS "Users can view their own group buy participation" ON public.group_buy_participants;
CREATE POLICY "Users and admins can view group buy participation"
ON public.group_buy_participants
FOR SELECT
USING (auth.uid() = user_id OR is_admin_or_manager(auth.uid()));

-- Allow public to view participation count (for the detail page)
CREATE POLICY "Anyone can view participant counts"
ON public.group_buy_participants
FOR SELECT
USING (true);
