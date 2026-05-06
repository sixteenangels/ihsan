import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ComparisonHistoryEntry {
  id: string;
  product_ids: string[];
  compared_at: string;
}

export function useComparisonHistory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: history, isLoading } = useQuery({
    queryKey: ['comparison-history', user?.id],
    queryFn: async (): Promise<ComparisonHistoryEntry[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('comparison_history')
        .select('*')
        .eq('user_id', user.id)
        .order('compared_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const saveComparison = useMutation({
    mutationFn: async (productIds: string[]) => {
      if (!user || productIds.length < 2) return;
      const { error } = await supabase
        .from('comparison_history')
        .insert({
          user_id: user.id,
          product_ids: productIds,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comparison-history'] });
    },
  });

  const deleteHistory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('comparison_history')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comparison-history'] });
    },
  });

  return {
    history: history || [],
    isLoading,
    saveComparison: saveComparison.mutate,
    deleteHistory: deleteHistory.mutate,
  };
}
