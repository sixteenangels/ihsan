import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type RefundRequestRow = Database['public']['Tables']['refund_requests']['Row'];

interface RefundOrderSummary {
  order_number: string;
  total_amount: number;
  user_id: string;
  shipping_price: number | null;
  packaging_cost: number | null;
}

interface RefundProfileSummary {
  name: string | null;
  email: string | null;
}

type RefundStatus = RefundRequest['status'];

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
    user_id: string;
    shipping_price: number | null;
    packaging_cost: number | null;
  } | null;
}

export interface AdminRefundRequest extends RefundRequest {
  orders: RefundOrderSummary | null;
  profiles: RefundProfileSummary | null;
}

function normalizeRefundStatus(status: string): RefundStatus {
  switch (status) {
    case 'approved':
    case 'rejected':
    case 'processed':
      return status;
    default:
      return 'pending';
  }
}

async function fetchRefundOrders(orderIds: string[]) {
  if (orderIds.length === 0) {
    return new Map<string, RefundOrderSummary>();
  }

  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, user_id, shipping_price, packaging_cost')
    .in('id', orderIds);

  if (error) {
    throw error;
  }

  return new Map(
    (data || []).map((order) => [
      order.id,
      {
        order_number: order.order_number,
        total_amount: Number(order.total_amount),
        user_id: order.user_id,
        shipping_price: order.shipping_price != null ? Number(order.shipping_price) : null,
        packaging_cost: order.packaging_cost != null ? Number(order.packaging_cost) : null,
      } satisfies RefundOrderSummary,
    ]),
  );
}

async function fetchRefundProfiles(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, RefundProfileSummary>();
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, name, email')
    .in('user_id', userIds);

  if (error) {
    throw error;
  }

  return new Map(
    (data || []).map((profile) => [
      profile.user_id,
      {
        name: profile.name,
        email: profile.email,
      } satisfies RefundProfileSummary,
    ]),
  );
}

export function useRefundRequests() {
  const { user } = useAuth();

  const { data: refundRequests = [], isLoading } = useQuery({
    queryKey: ['refund-requests', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('refund_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching refund requests:', error);
        return [];
      }

      const requests = (data || []) as RefundRequestRow[];
      const orderMap = await fetchRefundOrders(
        [...new Set(requests.map((request) => request.order_id).filter(Boolean))],
      );

      return requests.map((request) => ({
        ...request,
        status: normalizeRefundStatus(request.status),
        order: orderMap.get(request.order_id) || null,
      }));
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
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching refund requests:', error);
        return [];
      }

      const requests = (data || []) as RefundRequestRow[];
      const [orderMap, profileMap] = await Promise.all([
        fetchRefundOrders([...new Set(requests.map((request) => request.order_id).filter(Boolean))]),
        fetchRefundProfiles([...new Set(requests.map((request) => request.user_id).filter(Boolean))]),
      ]);

      return requests.map((request) => ({
        ...request,
        status: normalizeRefundStatus(request.status),
        order: orderMap.get(request.order_id) || null,
        orders: orderMap.get(request.order_id) || null,
        profiles: profileMap.get(request.user_id) || null,
      }));
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
