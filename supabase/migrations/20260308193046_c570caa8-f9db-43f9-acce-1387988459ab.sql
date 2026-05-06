
-- Add review photo and admin response columns
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS admin_response TEXT DEFAULT NULL;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS admin_response_at TIMESTAMPTZ DEFAULT NULL;

-- Product Q&A table
CREATE TABLE public.product_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  answer TEXT DEFAULT NULL,
  answered_by UUID DEFAULT NULL,
  answered_at TIMESTAMPTZ DEFAULT NULL,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Questions viewable by everyone when published" ON public.product_questions
  FOR SELECT USING (is_published = true OR auth.uid() = user_id OR is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can ask questions" ON public.product_questions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage questions" ON public.product_questions
  FOR ALL USING (is_admin_or_manager(auth.uid()));

-- Referral system
CREATE TABLE public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  total_referrals INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own referral code" ON public.referral_codes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own referral code" ON public.referral_codes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.referral_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referred_user_id UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their referrals" ON public.referral_tracking
  FOR SELECT TO authenticated USING (auth.uid() = referrer_id);

CREATE POLICY "System can insert referrals" ON public.referral_tracking
  FOR INSERT TO authenticated WITH CHECK (true);

-- Loyalty points
CREATE TABLE public.loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  points INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'earn',
  description TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own points" ON public.loyalty_points
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage points" ON public.loyalty_points
  FOR ALL USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "System can insert points" ON public.loyalty_points
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
