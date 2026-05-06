-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for product images storage
CREATE POLICY "Product images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Admins and managers can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' 
  AND is_admin_or_manager(auth.uid())
);

CREATE POLICY "Admins and managers can update product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images' 
  AND is_admin_or_manager(auth.uid())
);

CREATE POLICY "Admins and managers can delete product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images' 
  AND is_admin_or_manager(auth.uid())
);