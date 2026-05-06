-- Allow admins and managers to view all profiles for order management
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (is_admin_or_manager(auth.uid()));