import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, User } from 'lucide-react';

interface GroupBuyParticipantListProps {
  groupBuyId: string;
}

interface Participant {
  id: string;
  user_id: string;
  quantity: number | null;
  payment_status: string | null;
  payment_reference: string | null;
  joined_at: string;
  variant_id: string | null;
  shipping_address: any;
  profile: {
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  variant: {
    color: string | null;
    size: string | null;
  } | null | undefined;
}

export function GroupBuyParticipantList({ groupBuyId }: GroupBuyParticipantListProps) {
  const { data: participants, isLoading } = useQuery({
    queryKey: ['group-buy-participants', groupBuyId],
    queryFn: async (): Promise<Participant[]> => {
      const { data, error } = await supabase
        .from('group_buy_participants')
        .select('*')
        .eq('group_buy_id', groupBuyId)
        .order('joined_at');

      if (error) throw error;

      // Fetch profiles for participants
      const userIds = (data || []).map((p) => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, email, phone')
        .in('user_id', userIds);

      // Fetch variants
      const variantIds = (data || []).map((p) => p.variant_id).filter(Boolean);
      const { data: variants } = variantIds.length > 0
        ? await supabase
            .from('product_variants')
            .select('id, color, size')
            .in('id', variantIds)
        : { data: [] };

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));
      const variantMap = new Map<string, { id: string; color: string | null; size: string | null }>();
      variants?.forEach((v) => variantMap.set(v.id, v));

      return (data || []).map((p): Participant => ({
        ...p,
        profile: profileMap.get(p.user_id) || null,
        variant: p.variant_id ? variantMap.get(p.variant_id) || null : null,
      }));
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!participants || participants.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No participants yet.</p>;
  }

  const getPaymentBadge = (status: string | null) => {
    switch (status) {
      case 'paid': return <Badge className="bg-primary/10 text-primary">Paid</Badge>;
      case 'pending': return <Badge className="bg-accent/10 text-accent-foreground">Pending</Badge>;
      case 'refunded': return <Badge className="bg-destructive/10 text-destructive">Refunded</Badge>;
      default: return <Badge variant="secondary">{status || 'Unknown'}</Badge>;
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Variant</TableHead>
          <TableHead>Qty</TableHead>
          <TableHead>Payment</TableHead>
          <TableHead>Ref</TableHead>
          <TableHead>Address</TableHead>
          <TableHead>Joined</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {participants.map((p) => {
          const addr = p.shipping_address as any;
          return (
            <TableRow key={p.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{p.profile?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{p.profile?.email || ''}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm">
                {p.variant ? (
                  <span>{[p.variant.color, p.variant.size].filter(Boolean).join(' • ') || '-'}</span>
                ) : '-'}
              </TableCell>
              <TableCell>{p.quantity || 1}</TableCell>
              <TableCell>{getPaymentBadge(p.payment_status)}</TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">
                {p.payment_reference || '-'}
              </TableCell>
              <TableCell className="text-xs max-w-[150px]">
                {addr ? (
                  <span className="truncate block">{addr.city || addr.address_line1 || 'Provided'}</span>
                ) : <span className="text-muted-foreground">Not provided</span>}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(p.joined_at).toLocaleDateString()}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
