import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface WalletTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  order_id: string | null;
  created_by: string | null;
  created_at: string;
}

export function useWalletTransactions(userId?: string) {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: ['wallet-transactions', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];
      const { data, error } = await (supabase as any)
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as WalletTransaction[];
    },
    enabled: !!targetUserId,
  });
}

export function useWalletBalance(userId?: string) {
  const { data: txs } = useWalletTransactions(userId);
  const balance = (txs || []).reduce((sum, t) => {
    return t.type === 'credit' ? sum + Number(t.amount) : sum - Number(t.amount);
  }, 0);
  return Math.max(0, balance);
}

export function useCreditWallet() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      amount: number;
      description: string;
      order_id?: string | null;
    }) => {
      const { error } = await (supabase as any).from('wallet_transactions').insert({
        user_id: input.user_id,
        amount: input.amount,
        type: 'credit',
        description: input.description,
        order_id: input.order_id || null,
        created_by: user?.id,
      });
      if (error) throw error;

      // Notify the user
      await supabase.from('notifications').insert({
        user_id: input.user_id,
        title: 'Wallet Credited',
        message: `₵${input.amount.toFixed(2)} has been added to your wallet. ${input.description}`,
        type: 'wallet',
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions', variables.user_id] });
    },
  });
}
