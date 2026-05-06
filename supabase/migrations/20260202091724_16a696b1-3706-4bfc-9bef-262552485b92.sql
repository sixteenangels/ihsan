-- Create refund_requests table for customer refund workflow (without FK constraint)
CREATE TABLE IF NOT EXISTS public.refund_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL,
    user_id UUID NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processed')),
    admin_notes TEXT,
    refund_amount NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID
);

-- Enable RLS
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist and recreate
DROP POLICY IF EXISTS "Users can view own refund requests" ON public.refund_requests;
DROP POLICY IF EXISTS "Users can create refund requests" ON public.refund_requests;

-- Customers can view their own refund requests
CREATE POLICY "Users can view own refund requests" 
ON public.refund_requests 
FOR SELECT 
USING (auth.uid() = user_id);

-- Customers can create refund requests for their orders
CREATE POLICY "Users can create refund requests" 
ON public.refund_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);