
-- Fix overly permissive referral tracking INSERT policy
DROP POLICY IF EXISTS "System can insert referrals" ON public.referral_tracking;
CREATE POLICY "Users can track their referrals" ON public.referral_tracking
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = referrer_id OR auth.uid() = referred_user_id);
