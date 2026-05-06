import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type GroupBuyParticipantRecord = Database['public']['Tables']['group_buy_participants']['Row'] & {
  group_buys: (Database['public']['Tables']['group_buys']['Row'] & {
    products: {
      name: string;
      base_price: number;
    } | null;
  }) | null;
};

export interface MyGroupBuyParticipation {
  id: string;
  group_buy_id: string;
  quantity: number | null;
  payment_status: string | null;
  payment_reference: string | null;
  joined_at: string;
  variant_id: string | null;
  group_buy: {
    id: string;
    title: string | null;
    product_id: string;
    min_participants: number;
    current_participants: number | null;
    discount_percentage: number | null;
    group_price: number | null;
    expires_at: string;
    status: string | null;
    product: {
      name: string;
      base_price: number;
      images: string[];
    };
  };
}

export function useMyGroupBuys() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-group-buys', user?.id],
    queryFn: async (): Promise<MyGroupBuyParticipation[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('group_buy_participants')
        .select(`
          *,
          group_buys(
            id, title, product_id, min_participants, current_participants,
            discount_percentage, group_price, expires_at, status,
            products(name, base_price)
          )
        `)
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false });

      if (error) throw error;

      // Fetch images for products
      const participations = (data || []) as GroupBuyParticipantRecord[];
      const productIds = participations
        .map((participation) => participation.group_buys?.product_id)
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

      return participations.map((participation) => {
        const gb = participation.group_buys;
        const product = gb?.products;
        return {
          id: participation.id,
          group_buy_id: participation.group_buy_id,
          quantity: participation.quantity,
          payment_status: participation.payment_status,
          payment_reference: participation.payment_reference,
          joined_at: participation.joined_at,
          variant_id: participation.variant_id,
          group_buy: {
            id: gb?.id,
            title: gb?.title,
            product_id: gb?.product_id,
            min_participants: gb?.min_participants,
            current_participants: gb?.current_participants,
            discount_percentage: gb?.discount_percentage ? Number(gb.discount_percentage) : null,
            group_price: gb?.group_price != null ? Number(gb.group_price) : null,
            expires_at: gb?.expires_at,
            status: gb?.status,
            product: {
              name: product?.name || 'Unknown Product',
              base_price: Number(product?.base_price || 0),
              images: imagesMap.get(gb?.product_id) || [],
            },
          },
        };
      });
    },
    enabled: !!user,
  });
}
