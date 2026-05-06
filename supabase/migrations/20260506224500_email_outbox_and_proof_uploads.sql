CREATE TABLE IF NOT EXISTS public.outgoing_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  subject text NOT NULL,
  html_content text NOT NULL,
  text_content text,
  email_type text NOT NULL DEFAULT 'transactional',
  related_entity_type text,
  related_entity_id text,
  requested_by uuid,
  status text NOT NULL DEFAULT 'queued',
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.outgoing_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage outgoing emails" ON public.outgoing_emails;
CREATE POLICY "Admins can manage outgoing emails"
ON public.outgoing_emails
FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_outgoing_emails_status_created_at
ON public.outgoing_emails(status, created_at DESC);

INSERT INTO storage.buckets (id, name, public)
VALUES ('proof-of-delivery', 'proof-of-delivery', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Proof of delivery is publicly accessible" ON storage.objects;
CREATE POLICY "Proof of delivery is publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'proof-of-delivery');

DROP POLICY IF EXISTS "Admins and managers can upload proof of delivery" ON storage.objects;
CREATE POLICY "Admins and managers can upload proof of delivery"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'proof-of-delivery'
  AND is_admin_or_manager(auth.uid())
);

DROP POLICY IF EXISTS "Admins and managers can update proof of delivery" ON storage.objects;
CREATE POLICY "Admins and managers can update proof of delivery"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'proof-of-delivery'
  AND is_admin_or_manager(auth.uid())
);

DROP POLICY IF EXISTS "Admins and managers can delete proof of delivery" ON storage.objects;
CREATE POLICY "Admins and managers can delete proof of delivery"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'proof-of-delivery'
  AND is_admin_or_manager(auth.uid())
);
