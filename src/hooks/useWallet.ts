import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { creditWalletByAdmin } from '@/lib/wallet';

export interface WalletTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  order_id: string | null;
  created_by: string | null;
  reference_key: string | null;
  created_at: string;
}

export function useWalletTransactions(userId?: string) {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: ['wallet-transactions', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];

      const { data, error } = await supabase
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
      reference_key?: string | null;
    }) => {
      await creditWalletByAdmin({
        userId: input.user_id,
        amount: input.amount,
        description: input.description,
        createdBy: user?.id,
        orderId: input.order_id || null,
        referenceKey: input.reference_key || null,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions', variables.user_id] });
    },
  });
}
