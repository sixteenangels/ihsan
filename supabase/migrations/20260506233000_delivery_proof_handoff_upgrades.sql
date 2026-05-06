ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS proof_of_delivery_recipient_name text,
  ADD COLUMN IF NOT EXISTS proof_of_delivery_recipient_phone text,
  ADD COLUMN IF NOT EXISTS proof_of_delivery_relationship text,
  ADD COLUMN IF NOT EXISTS proof_of_delivery_signature_name text,
  ADD COLUMN IF NOT EXISTS proof_of_delivery_verification_code text,
  ADD COLUMN IF NOT EXISTS courier_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_confirmed_at timestamptz;

CREATE INDEX IF NOT EXISTS orders_proof_of_delivery_verification_code_idx
  ON public.orders (proof_of_delivery_verification_code);
