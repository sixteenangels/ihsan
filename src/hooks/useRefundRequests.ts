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
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  order?: {
    order_number: string;
    total_amount: number;
  };
}

export function useRefundRequests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: refundRequests = [], isLoading } = useQuery({
    queryKey: ['refund-requests', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const client = supabase as any;
      const { data, error } = await client
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

      return (data || []).map((r: any) => ({
        ...r,
        order: r.orders,
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

  const { data: refundRequests = [], isLoading } = useQuery({
    queryKey: ['admin-refund-requests'],
    queryFn: async () => {
      const client = supabase as any;
      const { data, error } = await client
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

      return data as any[];
    },
  });

  const updateRefundMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      admin_notes,
    }: {
      id: string;
      status: 'approved' | 'rejected' | 'processed';
      admin_notes?: string;
    }) => {
      const client = supabase as any;
      const { error } = await client
        .from('refund_requests')
        .update({
          status,
          admin_notes,
          processed_at: status === 'processed' ? new Date().toISOString() : null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-refund-requests'] });
    },
  });

  return {
    refundRequests,
    isLoading,
    updateRefund: updateRefundMutation.mutate,
    isUpdating: updateRefundMutation.isPending,
  };
}
