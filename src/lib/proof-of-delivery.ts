import { supabase } from '@/integrations/supabase/client';

export function generateProofVerificationCode() {
  return `POD-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Date.now()
    .toString()
    .slice(-4)}`;
}

export async function uploadProofOfDelivery(orderId: string, file: File) {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${orderId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('proof-of-delivery')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('proof-of-delivery')
    .getPublicUrl(fileName);

  return data.publicUrl;
}
