import { supabase } from '@/integrations/supabase/client';
import type { Product, ProductVariant } from '@/types';

type AddToCartFn = (
  product: Product,
  variant: ProductVariant | null,
  quantity?: number,
  selectionMode?: 'preserve' | 'include' | 'only',
) => void;

interface ReorderOrderItem {
  product_id: string | null;
  product_variant_id: string | null;
  quantity: number;
}

interface ReorderableOrder {
  order_items: ReorderOrderItem[];
}

interface ProductVariantLookupRow {
  id: string;
  product_id: string;
  color: string | null;
  size: string | null;
  price_override: number | null;
  stock: number | null;
}

interface ProductImageRow {
  image_url: string;
  order_index: number | null;
}

interface ProductLookupRow {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  is_group_buy_eligible: boolean | null;
  is_flash_deal: boolean | null;
  is_free_shipping: boolean | null;
  rating: number | null;
  review_count: number | null;
  product_images: ProductImageRow[] | null;
}

const PLACEHOLDER_IMAGE = '/placeholder.svg';

export async function reAddOrderItemsToCart(order: ReorderableOrder, addToCart: AddToCartFn) {
  const directProductIds = [
    ...new Set(
      order.order_items
        .map((item) => item.product_id)
        .filter((productId): productId is string => Boolean(productId)),
    ),
  ];
  const variantIds = order.order_items
    .map((item) => item.product_variant_id)
    .filter((variantId): variantId is string => Boolean(variantId));

  const { data: variantRows } = variantIds.length > 0
    ? await supabase
        .from('product_variants')
        .select('id, product_id, color, size, price_override, stock')
        .in('id', variantIds)
    : { data: [] as ProductVariantLookupRow[] };

  const productIds = [...new Set([...directProductIds, ...(variantRows || []).map((variant) => variant.product_id)])];
  if (productIds.length === 0) {
    throw new Error('Some products are no longer available.');
  }

  const { data: productRows } = await supabase
    .from('products')
    .select(
      'id, name, description, base_price, is_group_buy_eligible, is_flash_deal, is_free_shipping, rating, review_count, product_images(image_url, order_index)',
    )
    .in('id', productIds);

  if (!productRows) {
    throw new Error('Could not load those products again.');
  }

  let added = 0;

  for (const item of order.order_items) {
    const variant = (variantRows || []).find((candidate) => candidate.id === item.product_variant_id);
    const productRow = (productRows as ProductLookupRow[]).find(
      (product) => product.id === (item.product_id || variant?.product_id),
    );

    if (!productRow) continue;

    const images = (productRow.product_images || [])
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .map((image) => image.image_url);

    const cartProduct: Product = {
      id: productRow.id,
      name: productRow.name,
      description: productRow.description || '',
      category: '',
      basePrice: Number(productRow.base_price),
      images: images.length > 0 ? images : [PLACEHOLDER_IMAGE],
      variants: [],
      shippingOptions: [],
      isGroupBuyEligible: !!productRow.is_group_buy_eligible,
      isFlashDeal: !!productRow.is_flash_deal,
      isFreeShippingEligible: !!productRow.is_free_shipping,
      rating: Number(productRow.rating) || 0,
      reviewCount: productRow.review_count || 0,
    };

    if (variant) {
      const cartVariant: ProductVariant = {
        id: variant.id,
        size: variant.size || undefined,
        color: variant.color || undefined,
        price: variant.price_override != null ? Number(variant.price_override) : Number(productRow.base_price),
        stock: variant.stock || 0,
      };

      addToCart(cartProduct, cartVariant, item.quantity);
    } else {
      addToCart(cartProduct, null, item.quantity);
    }

    added += 1;
  }

  if (added === 0) {
    throw new Error('Could not re-add items from this order.');
  }

  return added;
}
