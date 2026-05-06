import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProductWithDetails } from './useProducts';

export interface GroupBuyWithProduct {
  id: string;
  product_id: string;
  title: string | null;
  current_participants: number | null;
  min_participants: number;
  max_participants: number | null;
  discount_percentage: number | null;
  expires_at: string;
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

async function fetchGroupBuys(): Promise<GroupBuyWithProduct[]> {
  const { data: groupBuys, error: groupBuysError } = await supabase
    .from('group_buys')
    .select(`
      *,
      products(
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

  return (groupBuys || []).map((gb) => {
    const product = gb.products as {
      id: string;
      name: string;
      description: string | null;
      base_price: number;
      rating: number | null;
      review_count: number | null;
      categories: { name: string } | null;
    } | null;

    return {
      id: gb.id,
      product_id: gb.product_id,
      title: (gb as any).title || null,
      current_participants: gb.current_participants,
      min_participants: gb.min_participants,
      max_participants: (gb as any).max_participants || null,
      discount_percentage: gb.discount_percentage ? Number(gb.discount_percentage) : null,
      expires_at: gb.expires_at,
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
  });
}

export function useGroupBuys() {
  return useQuery({
    queryKey: ['group-buys'],
    queryFn: fetchGroupBuys,
  });
}
