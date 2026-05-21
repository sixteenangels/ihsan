import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';

interface GroupBuyTier {
  id: string;
  min_participants: number;
  group_price: number | null;
  discount_percentage: number | null;
  label: string;
}

export interface ProductActiveGroupBuy {
  id: string;
  created_by: string;
  current_participants: number | null;
  discount_percentage: number | null;
  expires_at: string;
  extension_hours: number | null;
  extension_used: boolean | null;
  max_participants: number | null;
  min_participants: number;
  product_id: string;
  group_price: number | null;
  status: string | null;
  title: string | null;
  tiers: GroupBuyTier[];
  viewer_has_joined: boolean;
}

interface ProductActiveGroupBuyQueryProps {
  productId?: string;
  userId?: string;
}

export function useProductActiveGroupBuys({
  productId,
  userId,
}: ProductActiveGroupBuyQueryProps) {
  return useQuery({
    queryKey: ['product-active-group-buys', productId, userId],
    enabled: !!productId,
    queryFn: async (): Promise<ProductActiveGroupBuy[]> => {
      if (!productId) {
        return [];
      }

      const nowIso = new Date().toISOString();
      const { data: groupBuys, error } = await supabase
        .from('group_buys')
        .select(`
          id,
          created_by,
          current_participants,
          discount_percentage,
          expires_at,
          extension_hours,
          extension_used,
          max_participants,
          min_participants,
          product_id,
          group_price,
          status,
          title
        `)
        .eq('product_id', productId)
        .eq('status', 'open')
        .gt('expires_at', nowIso)
        .order('expires_at', { ascending: true });

      if (error) {
        throw error;
      }

      const rows = groupBuys || [];
      if (rows.length === 0) {
        return [];
      }

      const groupBuyIds = rows.map((row) => row.id);

      const { data: tiersData, error: tiersError } = await supabase
        .from('group_buy_tiers' as never)
        .select('id, group_buy_id, min_participants, group_price, discount_percentage, label')
        .in('group_buy_id', groupBuyIds)
        .order('min_participants', { ascending: true });

      if (tiersError) {
        throw tiersError;
      }

      const joinedIds = new Set<string>();
      if (userId) {
        const { data: participationRows, error: participationError } = await supabase
          .from('group_buy_participants')
          .select('group_buy_id')
          .eq('user_id', userId)
          .in('group_buy_id', groupBuyIds);

        if (participationError) {
          throw participationError;
        }

        (participationRows || []).forEach((row) => joinedIds.add(row.group_buy_id));
      }

      const tiersByGroupId = new Map<string, GroupBuyTier[]>();
      (((tiersData as unknown[]) || []) as Array<{
        id: string;
        group_buy_id: string;
        min_participants: number;
        group_price: number | string | null;
        discount_percentage: number | string | null;
        label: string;
      }>).forEach((tier) => {
        const existing = tiersByGroupId.get(tier.group_buy_id) || [];
        existing.push({
          id: tier.id,
          min_participants: tier.min_participants,
          group_price: tier.group_price != null ? Number(tier.group_price) : null,
          discount_percentage:
            tier.discount_percentage != null ? Number(tier.discount_percentage) : null,
          label: tier.label,
        });
        tiersByGroupId.set(tier.group_buy_id, existing);
      });

      return rows.map((row) => ({
        id: row.id,
        created_by: row.created_by,
        current_participants: row.current_participants,
        discount_percentage:
          row.discount_percentage != null ? Number(row.discount_percentage) : null,
        expires_at: row.expires_at,
        extension_hours: row.extension_hours,
        extension_used: row.extension_used,
        max_participants: row.max_participants,
        min_participants: row.min_participants,
        product_id: row.product_id,
        group_price: row.group_price != null ? Number(row.group_price) : null,
        status: row.status,
        title: row.title,
        tiers: tiersByGroupId.get(row.id) || [],
        viewer_has_joined: joinedIds.has(row.id),
      }));
    },
  });
}
