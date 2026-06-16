UPDATE public.store_settings
SET
  value = '"+233 508664788"'::jsonb,
  updated_at = now()
WHERE key = 'supportPhone';

INSERT INTO public.store_settings (key, value)
SELECT 'supportPhone', '"+233 508664788"'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.store_settings WHERE key = 'supportPhone'
);

NOTIFY pgrst, 'reload schema';
