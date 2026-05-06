import { supabase } from '@/integrations/supabase/client';

interface UpdateVariantStockInput {
  variantId: string;
  nextStock: number;
}

function buildVariantLabel(variant: {
  color?: string | null;
  size?: string | null;
  sku?: string | null;
}) {
  const parts = [variant.color, variant.size].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(' / ');
  }

  return variant.sku || 'Selected variant';
}

export async function updateVariantStockAndNotify({
  variantId,
  nextStock,
}: UpdateVariantStockInput) {
  const { data: variant, error: variantError } = await (supabase as any)
    .from('product_variants')
    .select(`
      id,
      stock,
      color,
      size,
      sku,
      product_id,
      products(name)
    `)
    .eq('id', variantId)
    .single();

  if (variantError) {
    throw variantError;
  }

  const previousStock = Number(variant?.stock || 0);

  const { error: updateError } = await supabase
    .from('product_variants')
    .update({ stock: nextStock })
    .eq('id', variantId);

  if (updateError) {
    throw updateError;
  }

  if (!(previousStock <= 0 && nextStock > 0)) {
    return { previousStock, notifiedCount: 0 };
  }

  const { data: alerts, error: alertsError } = await (supabase as any)
    .from('stock_alerts')
    .select('id, user_id, product_variant_id')
    .eq('product_id', variant.product_id);

  if (alertsError) {
    throw alertsError;
  }

  const matchingAlerts = (alerts || []).filter((alert: any) =>
    !alert.product_variant_id || alert.product_variant_id === variantId
  );

  if (matchingAlerts.length === 0) {
    return { previousStock, notifiedCount: 0 };
  }

  const variantLabel = buildVariantLabel(variant);
  const notifications = matchingAlerts.map((alert: any) => ({
    user_id: alert.user_id,
    title: 'Back In Stock',
    message: `${variant.products?.name || 'An item'}${variantLabel ? ` (${variantLabel})` : ''} is back in stock.`,
    type: 'product',
    data: {
      product_id: variant.product_id,
      product_variant_id: variantId,
      stock: nextStock,
    },
  }));

  const { error: notificationError } = await supabase
    .from('notifications')
    .insert(notifications);

  if (notificationError) {
    throw notificationError;
  }

  await (supabase as any)
    .from('stock_alerts')
    .update({ last_notified_at: new Date().toISOString() })
    .in('id', matchingAlerts.map((alert: any) => alert.id));

  return {
    previousStock,
    notifiedCount: matchingAlerts.length,
  };
}
