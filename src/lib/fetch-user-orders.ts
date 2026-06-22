import type { User } from '@supabase/supabase-js';

import { supabase } from '@/integrations/supabase/client';

const CUSTOMER_ORDER_SELECT = `
  id,
  order_number,
  status,
  total_amount,
  subtotal,
  shipping_price,
  shipping_payment_deferred,
  estimated_shipping_price,
  shipping_fee_paid_at,
  created_at,
  updated_at,
  estimated_delivery_start,
  estimated_delivery_end,
  courier_tracking_number,
  payment_reference,
  customer_confirmed_at,
  group_buy_id,
  is_group_buy_master,
  parent_order_id,
  order_items (*)
`;

type ProductVariantLookupRow = Pick<
  import('@/integrations/supabase/types').Database['public']['Tables']['product_variants']['Row'],
  'id' | 'product_id'
>;

type ProductImageLookupRow = Pick<
  import('@/integrations/supabase/types').Database['public']['Tables']['product_images']['Row'],
  'product_id' | 'image_url' | 'order_index'
>;

export type CustomerOrderItem = {
  id: string;
  product_name: string;
  variant_details: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_id: string | null;
  product_variant_id: string | null;
  image_url?: string | null;
};

export type CustomerOrder = {
  id: string;
  order_number: string;
  status: string | null;
  total_amount: number;
  subtotal?: number | null;
  shipping_price?: number | null;
  shipping_payment_deferred?: boolean | null;
  estimated_shipping_price?: number | null;
  shipping_fee_paid_at?: string | null;
  created_at: string;
  updated_at: string;
  estimated_delivery_start: string | null;
  estimated_delivery_end: string | null;
  courier_tracking_number: string | null;
  payment_reference: string | null;
  customer_confirmed_at: string | null;
  group_buy_id: string | null;
  is_group_buy_master: boolean | null;
  parent_order_id: string | null;
  order_items: CustomerOrderItem[];
};

export async function ensureAuthenticatedUser(): Promise<User> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!error && user) {
    return user;
  }

  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
  const refreshedUser = refreshData.session?.user;

  if (refreshError || !refreshedUser) {
    throw new Error('Please sign in again to view your orders.');
  }

  return refreshedUser;
}

export async function fetchCustomerOrdersForUser(userId: string): Promise<CustomerOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(CUSTOMER_ORDER_SELECT)
    .eq('user_id', userId)
    .or('is_group_buy_master.is.null,is_group_buy_master.eq.false')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Failed to load orders.');
  }

  const safeOrders = data || [];
  const orderItems = safeOrders.flatMap((order) => order.order_items || []);
  const directProductIds = [
    ...new Set(
      orderItems
        .map((item) => item.product_id)
        .filter((productId): productId is string => Boolean(productId)),
    ),
  ];
  const variantIds = [
    ...new Set(
      orderItems
        .map((item) => item.product_variant_id)
        .filter((variantId): variantId is string => Boolean(variantId)),
    ),
  ];

  let variantProductMap = new Map<string, string>();
  if (variantIds.length > 0) {
    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, product_id')
      .in('id', variantIds);

    variantProductMap = new Map(
      ((variants as ProductVariantLookupRow[] | null) || []).map((variant) => [variant.id, variant.product_id]),
    );
  }

  const imageProductIds = [
    ...new Set([
      ...directProductIds,
      ...variantIds
        .map((variantId) => variantProductMap.get(variantId))
        .filter((productId): productId is string => Boolean(productId)),
    ]),
  ];

  const productImageMap = new Map<string, string>();
  if (imageProductIds.length > 0) {
    const { data: images } = await supabase
      .from('product_images')
      .select('product_id, image_url, order_index')
      .in('product_id', imageProductIds)
      .order('order_index', { ascending: true });

    ((images as ProductImageLookupRow[] | null) || []).forEach((image) => {
      if (!productImageMap.has(image.product_id)) {
        productImageMap.set(image.product_id, image.image_url);
      }
    });
  }

  return safeOrders.map((order) => ({
    ...order,
    order_items: (order.order_items || []).map((item) => {
      const resolvedProductId =
        item.product_id ||
        (item.product_variant_id ? variantProductMap.get(item.product_variant_id) || null : null);

      return {
        ...item,
        image_url: resolvedProductId ? productImageMap.get(resolvedProductId) || null : null,
      };
    }),
  }));
}
