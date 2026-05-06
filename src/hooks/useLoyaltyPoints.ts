import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useLoyaltyPoints() {
  const { user } = useAuth();

  const { data: pointsHistory = [], isLoading } = useQuery({
    queryKey: ['loyalty-points', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('loyalty_points')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const totalPoints = pointsHistory.reduce((sum, p) => {
    return p.type === 'earn' ? sum + p.points : sum - p.points;
  }, 0);

  return {
    pointsHistory,
    totalPoints,
    isLoading,
  };
}
