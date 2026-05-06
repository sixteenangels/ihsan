import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface RefundRequest {
  id: string;
  order_id: string;
  user_id: string;
  reason: string;
  details: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  admin_notes: string | null;
  refund_amount: number | null;
  refund_channel: string;
  wallet_credit_amount: number;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  order?: {
    order_number: string;
    total_amount: number;
  };
}

export interface AdminRefundRequest extends RefundRequest {
  orders: {
    order_number: string;
    total_amount: number;
    user_id: string;
  } | null;
  profiles: {
    name: string | null;
    email: string | null;
  } | null;
}

export function useRefundRequests() {
  const { user } = useAuth();

  const { data: refundRequests = [], isLoading } = useQuery({
    queryKey: ['refund-requests', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('refund_requests')
        .select(`
          *,
          orders(order_number, total_amount)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching refund requests:', error);
        return [];
      }

      return (data || []).map((request) => ({
        ...request,
        order: request.orders || undefined,
      })) as RefundRequest[];
    },
    enabled: !!user,
  });

  return {
    refundRequests,
    isLoading,
  };
}

export function useAdminRefundRequests() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: refundRequests = [], isLoading } = useQuery({
    queryKey: ['admin-refund-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('refund_requests')
        .select(`
          *,
          orders(order_number, total_amount, user_id),
          profiles!refund_requests_user_id_fkey(name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching refund requests:', error);
        return [];
      }

      return (data || []) as AdminRefundRequest[];
    },
  });

  const updateRefundMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      admin_notes,
      refund_channel,
      wallet_credit_amount,
    }: {
      id: string;
      status: 'approved' | 'rejected' | 'processed';
      admin_notes?: string;
      refund_channel?: string;
      wallet_credit_amount?: number;
    }) => {
      const { error } = await supabase
        .from('refund_requests')
        .update({
          status,
          admin_notes,
          refund_channel,
          wallet_credit_amount,
          processed_at: status === 'processed' ? new Date().toISOString() : null,
          processed_by: status === 'processed' ? user?.id || null : null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-refund-requests'] });
      queryClient.invalidateQueries({ queryKey: ['refund-requests'] });
    },
  });

  return {
    refundRequests,
    isLoading,
    updateRefund: updateRefundMutation.mutateAsync,
    isUpdating: updateRefundMutation.isPending,
  };
}
