import { supabase } from '@/integrations/supabase/client';

const PROOF_BUCKET = 'proof-of-delivery';
const PUBLIC_BUCKET_MARKER = `/storage/v1/object/public/${PROOF_BUCKET}/`;
const SIGNED_BUCKET_MARKER = `/storage/v1/object/sign/${PROOF_BUCKET}/`;

export function generateProofVerificationCode() {
  return `POD-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Date.now()
    .toString()
    .slice(-4)}`;
}

export function normalizeProofOfDeliveryPath(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsedUrl = new URL(trimmed);
      const bucketMarker = parsedUrl.pathname.includes(PUBLIC_BUCKET_MARKER)
        ? PUBLIC_BUCKET_MARKER
        : parsedUrl.pathname.includes(SIGNED_BUCKET_MARKER)
          ? SIGNED_BUCKET_MARKER
          : null;

      if (!bucketMarker) {
        return trimmed;
      }

      return decodeURIComponent(parsedUrl.pathname.split(bucketMarker)[1] || '');
    } catch {
      return trimmed;
    }
  }

  return trimmed.replace(new RegExp(`^${PROOF_BUCKET}/`), '');
}

export async function uploadProofOfDelivery(orderId: string, file: File) {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${orderId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(PROOF_BUCKET)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  return fileName;
}

export async function getProofOfDeliverySignedUrl(
  storedValue: string | null | undefined,
  expiresIn = 60 * 60,
) {
  const proofPath = normalizeProofOfDeliveryPath(storedValue);
  if (!proofPath) {
    return null;
  }

  if (/^https?:\/\//i.test(proofPath)) {
    return proofPath;
  }

  const { data, error } = await supabase.storage
    .from(PROOF_BUCKET)
    .createSignedUrl(proofPath, expiresIn);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}
