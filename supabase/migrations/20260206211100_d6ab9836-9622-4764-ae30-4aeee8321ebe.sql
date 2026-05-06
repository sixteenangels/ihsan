-- Fix security issues for refund_requests table
-- Add admin SELECT policy for viewing all refund requests
CREATE POLICY "Admins can view all refund requests" 
ON public.refund_requests FOR SELECT 
TO authenticated 
USING (is_admin_or_manager(auth.uid()));

-- Add admin UPDATE policy for processing refund requests
CREATE POLICY "Admins can update refund requests" 
ON public.refund_requests FOR UPDATE 
TO authenticated 
USING (is_admin_or_manager(auth.uid()));

-- Ensure profiles table has proper restrictive policies
-- The existing policies already restrict users to their own profile
-- Add explicit denial for unauthenticated access attempts by ensuring 
-- the table only allows authenticated access (which is already the case)

-- Ensure addresses table has proper restrictive policies
-- The existing policies already restrict users to their own addresses
-- No additional changes needed as RLS is enabled and policies are restrictive