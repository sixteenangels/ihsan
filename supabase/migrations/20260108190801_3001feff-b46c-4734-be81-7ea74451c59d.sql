-- Create store settings table for currency and other configurations
CREATE TABLE IF NOT EXISTS public.store_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Store settings are viewable by everyone" ON public.store_settings
FOR SELECT USING (true);

-- Only admins can manage settings
CREATE POLICY "Admins can manage store settings" ON public.store_settings
FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Insert default currency setting (Ghana Cedis)
INSERT INTO public.store_settings (key, value) VALUES
('currency', '{"code": "GHS", "symbol": "₵", "name": "Ghana Cedis"}'),
('supported_currencies', '{"currencies": [{"code": "GHS", "symbol": "₵", "name": "Ghana Cedis"}, {"code": "USD", "symbol": "$", "name": "US Dollar"}, {"code": "NGN", "symbol": "₦", "name": "Nigerian Naira"}, {"code": "EUR", "symbol": "€", "name": "Euro"}, {"code": "GBP", "symbol": "£", "name": "British Pound"}]}')
ON CONFLICT (key) DO NOTHING;

-- Create user sessions table to track active sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_info text,
  ip_address text,
  location text,
  last_active_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_current boolean DEFAULT false,
  browser text,
  os text
);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "Users can view their own sessions" ON public.user_sessions
FOR SELECT USING (auth.uid() = user_id);

-- Users can delete their own sessions (revoke)
CREATE POLICY "Users can delete their own sessions" ON public.user_sessions
FOR DELETE USING (auth.uid() = user_id);

-- Users can insert their own sessions
CREATE POLICY "Users can insert their own sessions" ON public.user_sessions
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update their own sessions" ON public.user_sessions
FOR UPDATE USING (auth.uid() = user_id);

-- Add trigger for updated_at on store_settings
CREATE TRIGGER update_store_settings_updated_at
BEFORE UPDATE ON public.store_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();