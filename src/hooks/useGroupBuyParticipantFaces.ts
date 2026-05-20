import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GroupBuyParticipantFace {
  participant_id: string;
  display_name: string;
  avatar_url: string | null;
  joined_at: string;
}

export function useGroupBuyParticipantFaces(groupBuyId: string | null | undefined, limit = 8) {
  return useQuery({
    queryKey: ['group-buy-participant-faces', groupBuyId, limit],
    queryFn: async (): Promise<GroupBuyParticipantFace[]> => {
      const { data, error } = await supabase.rpc('get_group_buy_participant_faces', {
        p_group_buy_id: groupBuyId!,
        p_limit: limit,
      });

      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(groupBuyId),
    staleTime: 60_000,
  });
}
