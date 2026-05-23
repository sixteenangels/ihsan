import { supabase } from '@/integrations/supabase/client';

type RecommendationEventType =
  | 'view'
  | 'cart_add'
  | 'checkout_seed'
  | 'order_complete'
  | 'recommendation_click';

interface TrackRecommendationEventInput {
  productId: string;
  userId?: string | null;
  eventType: RecommendationEventType;
  source?: string;
  weight?: number;
  revenue?: number;
  productVariantId?: string | null;
  orderId?: string | null;
  metadata?: Record<string, unknown>;
}

const SESSION_KEY = 'ajyn_scan_recommendation_session_v1';

function getRecommendationSessionId() {
  if (typeof window === 'undefined') {
    return null;
  }

  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) {
    return existing;
  }

  const next = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(SESSION_KEY, next);
  return next;
}

export function trackRecommendationEvent({
  productId,
  eventType,
  source,
  weight = 1,
  productVariantId,
  orderId,
  metadata = {},
}: TrackRecommendationEventInput) {
  const quantity = Math.max(1, Math.round(Number(weight) || 1));

  void supabase.rpc('record_recommendation_event' as never, {
    product_id_input: productId,
    event_type_input: eventType,
    source_input: source || null,
    quantity_input: quantity,
    product_variant_id_input: productVariantId || null,
    order_id_input: orderId || null,
    metadata_input: metadata,
    session_id_input: getRecommendationSessionId(),
  } as never);
}
