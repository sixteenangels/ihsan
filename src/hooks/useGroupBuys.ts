import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import { DEFAULT_GROUP_BUY_SETTINGS, resolveGroupBuySettings } from '@/lib/groupBuyConfig';

type GroupBuyRecord = Database['public']['Tables']['group_buys']['Row'];

export interface GroupBuyWithProduct {
  created_by: string;
  id: string;
  product_id: string;
  title: string | null;
  current_participants: number | null;
  min_participants: number;
  max_participants: number | null;
  discount_percentage: number | null;
  extension_hours: number | null;
  extension_used: boolean;
  group_price: number | null;
  expires_at: string;
  settings: Json;
  status: string | null;
  product: {
    id: string;
    name: string;
    description: string | null;
    base_price: number;
    rating: number | null;
    review_count: number | null;
    category_name: string | null;
    images: string[];
  } | null;
}

interface GroupBuyQueryRow extends GroupBuyRecord {
  product: {
    id: string;
    name: string;
    description: string | null;
    base_price: number;
    rating: number | null;
    review_count: number | null;
    categories: {
      name: string;
    } | null;
  } | null;
}

async function fetchGroupBuys(): Promise<GroupBuyWithProduct[]> {
  const { data: groupBuys, error: groupBuysError } = await supabase
    .from('group_buys')
    .select(`
      *,
      product:products!group_buys_product_id_fkey(
        id,
        name,
        description,
        base_price,
        rating,
        review_count,
        categories(name)
      )
    `)
    .eq('status', 'open')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at');

  if (groupBuysError) throw groupBuysError;

  // Fetch images for group buy products
  const productIds = (groupBuys || [])
    .map((gb) => gb.product_id)
    .filter(Boolean);

  const { data: images } = await supabase
    .from('product_images')
    .select('product_id, image_url, order_index')
    .in('product_id', productIds)
    .order('order_index');

  const imagesMap = new Map<string, string[]>();
  images?.forEach((img) => {
    const existing = imagesMap.get(img.product_id) || [];
    existing.push(img.image_url);
    imagesMap.set(img.product_id, existing);
  });

  return ((groupBuys || []) as GroupBuyQueryRow[]).map((gb) => {
    const product = gb.product;
    return {
      created_by: gb.created_by,
      id: gb.id,
      product_id: gb.product_id,
      title: gb.title || null,
      current_participants: gb.current_participants,
      min_participants: gb.min_participants,
      max_participants: gb.max_participants || null,
      discount_percentage: gb.discount_percentage ? Number(gb.discount_percentage) : null,
      extension_hours: gb.extension_hours ?? null,
      extension_used: gb.extension_used,
      group_price: gb.group_price != null ? Number(gb.group_price) : null,
      expires_at: gb.expires_at,
      settings: gb.settings,
      status: gb.status,
      product: product ? {
        id: product.id,
        name: product.name,
        description: product.description,
        base_price: Number(product.base_price),
        rating: product.rating ? Number(product.rating) : null,
        review_count: product.review_count,
        category_name: product.categories?.name || null,
        images: imagesMap.get(product.id) || [],
      } : null,
    };
  })
    .filter((groupBuy) => resolveGroupBuySettings(DEFAULT_GROUP_BUY_SETTINGS, groupBuy.settings).visibleByDefault)
    .sort((left, right) => {
      const leftSettings = resolveGroupBuySettings(DEFAULT_GROUP_BUY_SETTINGS, left.settings);
      const rightSettings = resolveGroupBuySettings(DEFAULT_GROUP_BUY_SETTINGS, right.settings);
      if (leftSettings.featuredByDefault !== rightSettings.featuredByDefault) {
        return leftSettings.featuredByDefault ? -1 : 1;
      }

      return new Date(left.expires_at).getTime() - new Date(right.expires_at).getTime();
    });
}

export function useGroupBuys() {
  return useQuery({
    queryKey: ['group-buys'],
    queryFn: fetchGroupBuys,
  });
}
