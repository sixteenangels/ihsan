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
  userId,
  eventType,
  source,
  weight = 1,
  revenue = 0,
  metadata = {},
}: TrackRecommendationEventInput) {
  void supabase.from('product_recommendation_events' as never).insert({
    product_id: productId,
    user_id: userId || null,
    session_id: getRecommendationSessionId(),
    event_type: eventType,
    source: source || null,
    weight,
    revenue,
    metadata,
  } as never);
}
