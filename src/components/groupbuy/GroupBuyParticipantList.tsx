import { useQuery } from '@tanstack/react-query';
import { formatStoreDate } from '@/lib/date-utils';
import { supabase } from '@/integrations/supabase/client';
import type { Json, Tables } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import {
  extractGroupBuySelectionsFromShippingAddress,
  getGroupBuySelectionsTotalQuantity,
} from '@/lib/groupBuySelections';

interface GroupBuyParticipantListProps {
  groupBuyId: string;
}

type GroupBuyParticipantRow = Tables<'group_buy_participants'>;

interface ShippingAddress {
  address_line1?: string;
  city?: string;
}

interface Participant extends GroupBuyParticipantRow {
  profile: {
    name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
  } | null;
  variant: {
    color: string | null;
    size: string | null;
  } | null | undefined;
}

function readShippingAddress(value: Json | null): ShippingAddress | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return null;
  }

  return value as ShippingAddress;
}

function getInitials(name: string | null | undefined, email: string | null | undefined) {
  const source = name?.trim() || email?.trim() || 'AJYN member';
  const [first, second] = source.split(/\s+|@/);

  return `${first?.[0] || ''}${second?.[0] || ''}`.toUpperCase() || 'AJ';
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

      const userIds = (data || []).map((participant) => participant.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, email, phone, avatar_url')
        .in('user_id', userIds);

      const variantIds = (data || []).map((participant) => participant.variant_id).filter(Boolean);
      const { data: variants } = variantIds.length > 0
        ? await supabase
            .from('product_variants')
            .select('id, color, size')
            .in('id', variantIds)
        : { data: [] };

      const profileMap = new Map(profiles?.map((profile) => [profile.user_id, profile]));
      const variantMap = new Map<string, { id: string; color: string | null; size: string | null }>();
      variants?.forEach((variant) => variantMap.set(variant.id, variant));

      return (data || []).map((participant): Participant => ({
        ...participant,
        profile: profileMap.get(participant.user_id) || null,
        variant: participant.variant_id ? variantMap.get(participant.variant_id) || null : null,
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
        {participants.map((participant) => {
          const address = readShippingAddress(participant.shipping_address);
          const selections = extractGroupBuySelectionsFromShippingAddress(participant.shipping_address);

          return (
            <TableRow key={participant.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8 border border-border bg-primary/10">
                    <AvatarImage
                      src={participant.profile?.avatar_url || undefined}
                      alt={`${participant.profile?.name || 'Customer'} avatar`}
                    />
                    <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
                      {getInitials(participant.profile?.name, participant.profile?.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{participant.profile?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{participant.profile?.email || ''}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm">
                {selections.length > 0 ? (
                  <div className="space-y-1">
                    {selections.map((selection) => (
                      <p key={selection.variantId}>
                        {selection.label} x {selection.quantity}
                      </p>
                    ))}
                  </div>
                ) : participant.variant ? (
                  <span>{[participant.variant.color, participant.variant.size].filter(Boolean).join(' / ') || '-'}</span>
                ) : '-'}
              </TableCell>
              <TableCell>{selections.length > 0 ? getGroupBuySelectionsTotalQuantity(selections) : participant.quantity || 1}</TableCell>
              <TableCell>{getPaymentBadge(participant.payment_status)}</TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">
                {participant.payment_reference || '-'}
              </TableCell>
              <TableCell className="text-xs max-w-[150px]">
                {address ? (
                  <span className="truncate block">{address.city || address.address_line1 || 'Provided'}</span>
                ) : <span className="text-muted-foreground">Not provided</span>}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatStoreDate(participant.joined_at)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
