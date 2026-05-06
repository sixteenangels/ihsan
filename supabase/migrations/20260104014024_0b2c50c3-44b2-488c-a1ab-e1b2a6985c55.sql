-- Create comparison history table
CREATE TABLE public.comparison_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_ids UUID[] NOT NULL,
  compared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.comparison_history ENABLE ROW LEVEL SECURITY;

-- Policies - users can only see/manage their own history
CREATE POLICY "Users can view their own comparison history"
ON public.comparison_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own comparison history"
ON public.comparison_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comparison history"
ON public.comparison_history
FOR DELETE
USING (auth.uid() = user_id);

-- Restrict group_buy_participants visibility to only show participant count, not user details
DROP POLICY IF EXISTS "Participants are viewable by everyone" ON public.group_buy_participants;

CREATE POLICY "Users can view their own group buy participation"
ON public.group_buy_participants
FOR SELECT
USING (auth.uid() = user_id OR is_admin_or_manager(auth.uid()));