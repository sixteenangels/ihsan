-- Create table to store backup recovery codes for 2FA
CREATE TABLE public.backup_recovery_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code_hash TEXT NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.backup_recovery_codes ENABLE ROW LEVEL SECURITY;

-- Users can only view their own codes
CREATE POLICY "Users can view their own backup codes"
ON public.backup_recovery_codes
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own codes
CREATE POLICY "Users can create their own backup codes"
ON public.backup_recovery_codes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own codes (mark as used)
CREATE POLICY "Users can update their own backup codes"
ON public.backup_recovery_codes
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own codes (for regeneration)
CREATE POLICY "Users can delete their own backup codes"
ON public.backup_recovery_codes
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_backup_recovery_codes_user_id ON public.backup_recovery_codes(user_id);