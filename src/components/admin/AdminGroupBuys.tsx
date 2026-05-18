import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Loader2,
  Eye,
  ShoppingCart,
  XCircle,
  Users,
  Pencil,
} from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useCurrency } from '@/hooks/useCurrency';
import type { Database } from '@/integrations/supabase/types';
import {
  getGroupBuySavingsPercent,
  getGroupBuyUnitPrice,
} from '@/lib/groupBuyPricing';
import {
  extractGroupBuySelectionsFromShippingAddress,
  getGroupBuySelectionsTotalAmount,
} from '@/lib/groupBuySelections';
import { GroupBuyParticipantList } from '@/components/groupbuy/GroupBuyParticipantList';

type GroupBuyStatus = Database['public']['Enums']['group_buy_status'];
type GroupBuyRecord = Database['public']['Tables']['group_buys']['Row'];
type GroupBuyParticipantRecord = Database['public']['Tables']['group_buy_participants']['Row'] & {
  unit_price_at_join?: number | string | null;
};

interface GroupBuyForm {
  product_id: string;
  title: string;
  min_participants: string;
  max_participants: string;
  group_price: string;
  tier_participants: string;
  tier_group_price: string;
  expires_at: string;
}

interface GroupBuyProductSummary {
  name: string;
  base_price: number;
}

interface AdminGroupBuyRecord extends GroupBuyRecord {
  products: GroupBuyProductSummary | null;
}

interface GroupBuyTierRow {
  id: string;
  group_buy_id: string;
  min_participants: number;
  group_price: number | null;
  discount_percentage: number | null;
  reward_coupon_percent: number | null;
  label: string;
}

const defaultForm: GroupBuyForm = {
  product_id: '',
  title: '',
  min_participants: '10',
  max_participants: '',
  group_price: '',
  tier_participants: '',
  tier_group_price: '',
  expires_at: '',
};

function generateAjynOrderNumber() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AJYN-${Date.now()}-${random}`;
}

function formatDateTimeLocal(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function calculateDiscountPercentage(basePrice: number, groupPriceInput: string): number {
  const groupPrice = Number.parseFloat(groupPriceInput);

  if (!Number.isFinite(groupPrice) || groupPrice <= 0 || basePrice <= 0 || groupPrice >= basePrice) {
    return 0;
  }

  return Number((((basePrice - groupPrice) / basePrice) * 100).toFixed(2));
}

export function AdminGroupBuys() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingGroupBuyId, setEditingGroupBuyId] = useState<string | null>(null);
  const [form, setForm] = useState<GroupBuyForm>(defaultForm);
  const [selectedGroupBuyId, setSelectedGroupBuyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | GroupBuyStatus>('all');

  const { data: products } = useProducts();

  const { data: groupBuys = [], isLoading } = useQuery({
    queryKey: ['admin-group-buys'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_buys')
        .select('*, products(name, base_price)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as AdminGroupBuyRecord[];
    },
  });

  const { data: groupBuyTiers = [] } = useQuery({
    queryKey: ['admin-group-buy-tiers'],
    queryFn: async (): Promise<GroupBuyTierRow[]> => {
      const { data, error } = await supabase
        .from('group_buy_tiers' as never)
        .select('id, group_buy_id, min_participants, group_price, discount_percentage, reward_coupon_percent, label')
        .order('min_participants', { ascending: true });

      if (error) throw error;
      return ((data as unknown[]) || []).map((tier) => {
        const typedTier = tier as {
          id: string;
          group_buy_id: string;
          min_participants: number;
          group_price: number | string | null;
          discount_percentage: number | string | null;
          reward_coupon_percent: number | string | null;
          label: string;
        };

        return {
          id: typedTier.id,
          group_buy_id: typedTier.group_buy_id,
          min_participants: typedTier.min_participants,
          group_price: typedTier.group_price != null ? Number(typedTier.group_price) : null,
          discount_percentage:
            typedTier.discount_percentage != null ? Number(typedTier.discount_percentage) : null,
          reward_coupon_percent:
            typedTier.reward_coupon_percent != null ? Number(typedTier.reward_coupon_percent) : null,
          label: typedTier.label,
        };
      });
    },
  });

  const editingGroupBuy =
    groupBuys.find((groupBuy) => groupBuy.id === editingGroupBuyId) || null;
  const selectedGroupBuy =
    groupBuys.find((groupBuy) => groupBuy.id === selectedGroupBuyId) || null;
  const selectedProduct = products?.find((product) => product.id === form.product_id);
  const formBasePrice =
    Number(
      editingGroupBuy?.products?.base_price ??
        selectedProduct?.base_price ??
        0,
    ) || 0;
  const previewGroupPrice = form.group_price
    ? Number.parseFloat(form.group_price)
    : selectedProduct?.group_buy_price ?? formBasePrice;
  const previewSavingsPercent =
    formBasePrice > 0
      ? getGroupBuySavingsPercent({
          basePrice: formBasePrice,
          groupPrice: Number.isFinite(previewGroupPrice) ? previewGroupPrice : null,
          discountPercentage: null,
        })
      : 0;
  const previewUnitPrice =
    formBasePrice > 0
      ? getGroupBuyUnitPrice({
          basePrice: formBasePrice,
          groupPrice: Number.isFinite(previewGroupPrice) ? previewGroupPrice : null,
          discountPercentage: null,
        })
      : 0;

  const resetDialog = () => {
    setDialogMode('create');
    setEditingGroupBuyId(null);
    setForm(defaultForm);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    resetDialog();
  };

  const openCreateDialog = () => {
    resetDialog();
    setIsDialogOpen(true);
  };

  const openEditDialog = (groupBuy: AdminGroupBuyRecord) => {
    setDialogMode('edit');
    setEditingGroupBuyId(groupBuy.id);
    setForm({
      product_id: groupBuy.product_id,
      title: groupBuy.title || '',
      min_participants: String(groupBuy.min_participants),
      max_participants:
        groupBuy.max_participants != null ? String(groupBuy.max_participants) : '',
      group_price:
        groupBuy.group_price != null ? String(groupBuy.group_price) : '',
      tier_participants:
        groupBuyTiers.find((tier) => tier.group_buy_id === groupBuy.id && tier.min_participants > groupBuy.min_participants)
          ? String(groupBuyTiers.find((tier) => tier.group_buy_id === groupBuy.id && tier.min_participants > groupBuy.min_participants)?.min_participants)
          : '',
      tier_group_price:
        groupBuyTiers.find((tier) => tier.group_buy_id === groupBuy.id && tier.min_participants > groupBuy.min_participants)?.group_price != null
          ? String(groupBuyTiers.find((tier) => tier.group_buy_id === groupBuy.id && tier.min_participants > groupBuy.min_participants)?.group_price)
          : '',
      expires_at: formatDateTimeLocal(groupBuy.expires_at),
    });
    setIsDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async (data: GroupBuyForm) => {
      if (!user?.id) {
        throw new Error('You must be signed in to create group buys');
      }

      const product = products?.find((item) => item.id === data.product_id);
      const basePrice = Number(product?.base_price || 0);
      const groupPrice = data.group_price ? Number.parseFloat(data.group_price) : null;

      const { data: createdGroupBuy, error } = await supabase.from('group_buys').insert({
        product_id: data.product_id,
        title: data.title || null,
        min_participants: Number.parseInt(data.min_participants, 10),
        max_participants: data.max_participants
          ? Number.parseInt(data.max_participants, 10)
          : null,
        group_price: groupPrice,
        discount_percentage: calculateDiscountPercentage(basePrice, data.group_price),
        expires_at: data.expires_at,
        created_by: user.id,
        status: 'open',
      }).select('id').single();

      if (error) throw error;

      const baseTier = {
        group_buy_id: createdGroupBuy.id,
        min_participants: Number.parseInt(data.min_participants, 10),
        group_price: groupPrice,
        discount_percentage: calculateDiscountPercentage(basePrice, data.group_price),
        reward_coupon_percent: 5,
        label: 'Base group price',
      };
      const tierRows = [baseTier];
      if (data.tier_participants && data.tier_group_price) {
        tierRows.push({
          group_buy_id: createdGroupBuy.id,
          min_participants: Number.parseInt(data.tier_participants, 10),
          group_price: Number.parseFloat(data.tier_group_price),
          discount_percentage: calculateDiscountPercentage(basePrice, data.tier_group_price),
          reward_coupon_percent: 5,
          label: 'Momentum tier',
        });
      }

      const { error: tierError } = await supabase.from('group_buy_tiers' as never).insert(tierRows as never);
      if (tierError) throw tierError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['admin-group-buy-tiers'] });
      queryClient.invalidateQueries({ queryKey: ['group-buys'] });
      toast.success('Group buy created');
      closeDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: GroupBuyForm }) => {
      const basePrice = Number(
        groupBuys.find((groupBuy) => groupBuy.id === id)?.products?.base_price || 0,
      );

      const { error } = await supabase
        .from('group_buys')
        .update({
          title: data.title || null,
          min_participants: Number.parseInt(data.min_participants, 10),
          max_participants: data.max_participants
            ? Number.parseInt(data.max_participants, 10)
            : null,
          group_price: data.group_price ? Number.parseFloat(data.group_price) : null,
          discount_percentage: calculateDiscountPercentage(basePrice, data.group_price),
          expires_at: data.expires_at,
        })
        .eq('id', id);

      if (error) throw error;

      await supabase.from('group_buy_tiers' as never).delete().eq('group_buy_id', id);

      const baseGroupPrice = data.group_price ? Number.parseFloat(data.group_price) : null;
      const tierRows = [{
        group_buy_id: id,
        min_participants: Number.parseInt(data.min_participants, 10),
        group_price: baseGroupPrice,
        discount_percentage: calculateDiscountPercentage(basePrice, data.group_price),
        reward_coupon_percent: 5,
        label: 'Base group price',
      }];

      if (data.tier_participants && data.tier_group_price) {
        tierRows.push({
          group_buy_id: id,
          min_participants: Number.parseInt(data.tier_participants, 10),
          group_price: Number.parseFloat(data.tier_group_price),
          discount_percentage: calculateDiscountPercentage(basePrice, data.tier_group_price),
          reward_coupon_percent: 5,
          label: 'Momentum tier',
        });
      }

      const { error: tierError } = await supabase.from('group_buy_tiers' as never).insert(tierRows as never);
      if (tierError) throw tierError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['admin-group-buy-tiers'] });
      queryClient.invalidateQueries({ queryKey: ['group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['group-buy-detail'] });
      toast.success('Group buy updated');
      closeDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('group_buys').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['group-buys'] });
      toast.success('Group buy deleted');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('group_buys')
        .update({ status: 'cancelled' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['group-buys'] });
      toast.success('Group buy cancelled');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const expireAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('check_expired_group_buys');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['group-buys'] });
      toast.success('Expired group buys processed');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createCollectiveOrderMutation = useMutation({
    mutationFn: async (groupBuyId: string) => {
      const groupBuy = groupBuys.find((item) => item.id === groupBuyId);
      if (!groupBuy) throw new Error('Group buy not found');

      const { data: participants, error: participantsError } = await supabase
        .from('group_buy_participants')
        .select('*')
        .eq('group_buy_id', groupBuyId)
        .eq('payment_status', 'paid');

      if (participantsError) throw participantsError;

      const paidParticipants = (participants || []) as GroupBuyParticipantRecord[];
      if (paidParticipants.length === 0) throw new Error('No paid participants');

      const fallbackUnitPrice = getGroupBuyUnitPrice({
        basePrice: Number(groupBuy.products?.base_price || 0),
        groupPrice: groupBuy.group_price,
        discountPercentage: groupBuy.discount_percentage,
      });

      const totalAmount = paidParticipants.reduce((sum, participant) => {
        const selections = extractGroupBuySelectionsFromShippingAddress(participant.shipping_address);
        if (selections.length > 0) {
          return sum + getGroupBuySelectionsTotalAmount(selections);
        }

        return sum + Number(participant.unit_price_at_join || fallbackUnitPrice) * (participant.quantity || 1);
      }, 0);

      const { data: masterOrder, error: masterOrderError } = await supabase
        .from('orders')
        .insert({
          user_id: groupBuy.created_by,
          subtotal: totalAmount,
          total_amount: totalAmount,
          group_buy_id: groupBuyId,
          is_group_buy_master: true,
          status: 'confirmed',
          order_number: generateAjynOrderNumber(),
          notes: `Group Buy: ${groupBuy.title || 'Group Buy'} - ${paidParticipants.length} participants`,
        })
        .select()
        .single();

      if (masterOrderError) throw masterOrderError;

      for (const participant of paidParticipants) {
        const selections = extractGroupBuySelectionsFromShippingAddress(participant.shipping_address);
        const participantUnitPrice = Number(participant.unit_price_at_join || fallbackUnitPrice);
        const childTotal = selections.length > 0
          ? getGroupBuySelectionsTotalAmount(selections)
          : participantUnitPrice * (participant.quantity || 1);
        const shippingAddress =
          participant.shipping_address && typeof participant.shipping_address === 'object'
            ? participant.shipping_address
            : null;

        const { data: childOrder, error: childOrderError } = await supabase
          .from('orders')
          .insert({
            user_id: participant.user_id,
            subtotal: childTotal,
            total_amount: childTotal,
            group_buy_id: groupBuyId,
            parent_order_id: masterOrder.id,
            status: 'confirmed',
            order_number: generateAjynOrderNumber(),
            shipping_address: shippingAddress,
          })
          .select()
          .single();

        if (childOrderError) continue;

        const orderItems = selections.length > 0
          ? selections.map((selection) => ({
              order_id: childOrder.id,
              product_id: groupBuy.product_id,
              product_variant_id: selection.variantId,
              product_name: groupBuy.products?.name || 'Group Buy Product',
              variant_details: selection.label,
              quantity: selection.quantity,
              unit_price: selection.unitPrice,
              total_price: selection.quantity * selection.unitPrice,
            }))
          : [{
              order_id: childOrder.id,
              product_id: groupBuy.product_id,
              product_variant_id: participant.variant_id,
              product_name: groupBuy.products?.name || 'Group Buy Product',
              quantity: participant.quantity || 1,
              unit_price: participantUnitPrice,
              total_price: childTotal,
            }];

        await supabase.from('order_items').insert(orderItems);

        await supabase.from('notifications').insert({
          user_id: participant.user_id,
          title: 'Group Buy Order Created!',
          message: `Your group buy order for "${groupBuy.title || 'Group Buy'}" has been created. Check My Orders for details.`,
          type: 'order',
          data: { order_id: childOrder.id, group_buy_id: groupBuyId },
        });
      }

      await supabase.from('group_buys').update({ status: 'closed' }).eq('id', groupBuyId);
      return masterOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-group-buys'] });
      toast.success('Collective order created! All participants have been notified.');
      setSelectedGroupBuyId(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const getStatusBadge = (status: GroupBuyStatus | null) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-primary/10 text-primary">Open</Badge>;
      case 'filled':
        return <Badge className="bg-accent/10 text-accent-foreground">Filled</Badge>;
      case 'closed':
        return <Badge variant="secondary">Closed</Badge>;
      case 'cancelled':
        return <Badge className="bg-destructive/10 text-destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status || 'Unknown'}</Badge>;
    }
  };

  const filteredGroupBuys = groupBuys.filter((groupBuy) => {
    if (statusFilter === 'all') return true;
    return groupBuy.status === statusFilter;
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleDialogSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (dialogMode === 'edit' && editingGroupBuyId) {
      updateMutation.mutate({ id: editingGroupBuyId, data: form });
      return;
    }

    createMutation.mutate(form);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold font-serif text-foreground">Group Buys</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => expireAllMutation.mutate()}
            disabled={expireAllMutation.isPending}
          >
            {expireAllMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Process Expired
          </Button>

          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Create Group Buy
          </Button>
        </div>
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog();
            return;
          }

          setIsDialogOpen(true);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-background sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'edit' ? 'Update Group Buy Pricing' : 'Create New Group Buy'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'edit'
                ? 'Adjust the live price, participant target, or expiry for this offer.'
                : 'Create a fixed-price group-buy offer for an eligible product.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDialogSubmit} className="space-y-4">
            {dialogMode === 'create' ? (
              <div className="space-y-2">
                <Label>Product *</Label>
                <Select
                  value={form.product_id}
                  onValueChange={(value) => {
                    const product = products?.find((item) => item.id === value);

                    setForm((prev) => ({
                      ...prev,
                      product_id: value,
                      group_price:
                        product?.group_buy_price != null
                          ? String(product.group_buy_price)
                          : product?.base_price != null
                            ? String(product.base_price)
                            : prev.group_price,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products
                      ?.filter((product) => product.is_group_buy_eligible)
                      .map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Product</Label>
                <Input
                  value={editingGroupBuy?.products?.name || 'Unknown product'}
                  readOnly
                  disabled
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Title (optional)</Label>
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Custom group buy name"
              />
            </div>

            {formBasePrice > 0 ? (
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Regular Price
                    </p>
                    <p className="text-lg font-semibold text-foreground">
                      {formatPrice(formBasePrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Group Price
                    </p>
                    <p className="text-lg font-semibold text-primary">
                      {formatPrice(previewUnitPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Savings
                    </p>
                    <p className="text-lg font-semibold text-foreground">
                      {previewSavingsPercent}% off
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Participants *</Label>
                <Input
                  type="number"
                  min="2"
                  value={form.min_participants}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      min_participants: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Fixed Group Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.group_price}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, group_price: event.target.value }))
                  }
                  placeholder={
                    selectedProduct?.group_buy_price != null
                      ? String(selectedProduct.group_buy_price)
                      : undefined
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Max Participants</Label>
              <Input
                type="number"
                min="2"
                value={form.max_participants}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, max_participants: event.target.value }))
                }
                placeholder="No limit"
              />
            </div>

            <div className="rounded-xl border border-border p-4">
              <div className="mb-3">
                <p className="text-sm font-semibold text-foreground">Momentum Tier</p>
                <p className="text-xs text-muted-foreground">
                  Optional lower price that unlocks when more participants join.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unlock At Participants</Label>
                  <Input
                    type="number"
                    min="3"
                    value={form.tier_participants}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, tier_participants: event.target.value }))
                    }
                    placeholder="e.g. 20"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tier Price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.tier_group_price}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, tier_group_price: event.target.value }))
                    }
                    placeholder="e.g. 95"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Expires At *</Label>
              <Input
                type="datetime-local"
                value={form.expires_at}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, expires_at: event.target.value }))
                }
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {dialogMode === 'edit' ? 'Save Changes' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Tabs
        value={statusFilter}
        onValueChange={(value) => setStatusFilter(value as 'all' | GroupBuyStatus)}
        className="mb-6"
      >
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="inline-flex h-auto min-w-max gap-2 p-1">
            <TabsTrigger value="all">All ({groupBuys.length})</TabsTrigger>
            <TabsTrigger value="open">
              Open ({groupBuys.filter((item) => item.status === 'open').length})
            </TabsTrigger>
            <TabsTrigger value="filled">
              Filled ({groupBuys.filter((item) => item.status === 'filled').length})
            </TabsTrigger>
            <TabsTrigger value="closed">
              Closed ({groupBuys.filter((item) => item.status === 'closed').length})
            </TabsTrigger>
            <TabsTrigger value="cancelled">
              Cancelled ({groupBuys.filter((item) => item.status === 'cancelled').length})
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Tabs>

      {selectedGroupBuy ? (
        <Card className="mb-6">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-lg">
                {selectedGroupBuy.title || selectedGroupBuy.products?.name || 'Group Buy'}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {selectedGroupBuy.current_participants || 0}/{selectedGroupBuy.min_participants}{' '}
                participants {' - '} {getStatusBadge(selectedGroupBuy.status)}
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-muted-foreground">
                  Base price:{' '}
                  <span className="font-medium text-foreground">
                    {formatPrice(Number(selectedGroupBuy.products?.base_price || 0))}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  Group price:{' '}
                  <span className="font-medium text-primary">
                    {formatPrice(
                      getGroupBuyUnitPrice({
                        basePrice: Number(selectedGroupBuy.products?.base_price || 0),
                        groupPrice: selectedGroupBuy.group_price,
                        discountPercentage: selectedGroupBuy.discount_percentage,
                      }),
                    )}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  Savings:{' '}
                  <span className="font-medium text-foreground">
                    {getGroupBuySavingsPercent({
                      basePrice: Number(selectedGroupBuy.products?.base_price || 0),
                      groupPrice: selectedGroupBuy.group_price,
                      discountPercentage: selectedGroupBuy.discount_percentage,
                    })}
                    % off
                  </span>
                </span>
              </div>
              {groupBuyTiers.filter((tier) => tier.group_buy_id === selectedGroupBuy.id).length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {groupBuyTiers
                    .filter((tier) => tier.group_buy_id === selectedGroupBuy.id)
                    .map((tier) => (
                      <Badge key={tier.id} variant="outline">
                        {tier.label}: {tier.min_participants}+ at{' '}
                        {tier.group_price != null ? formatPrice(tier.group_price) : 'discount pricing'}
                      </Badge>
                    ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEditDialog(selectedGroupBuy)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit Pricing
              </Button>
              {selectedGroupBuy.status === 'filled' ? (
                <Button
                  onClick={() => createCollectiveOrderMutation.mutate(selectedGroupBuy.id)}
                  disabled={createCollectiveOrderMutation.isPending}
                >
                  {createCollectiveOrderMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Create Collective Order
                </Button>
              ) : null}
              {selectedGroupBuy.status === 'open' ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => cancelMutation.mutate(selectedGroupBuy.id)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => setSelectedGroupBuyId(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <GroupBuyParticipantList groupBuyId={selectedGroupBuy.id} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title / Product</TableHead>
                  <TableHead>Participants</TableHead>
                  <TableHead>Group Price</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroupBuys.map((groupBuy) => {
                  const basePrice = Number(groupBuy.products?.base_price || 0);
                  const groupPrice = getGroupBuyUnitPrice({
                    basePrice,
                    groupPrice: groupBuy.group_price,
                    discountPercentage: groupBuy.discount_percentage,
                  });
                  const savingsPercent = getGroupBuySavingsPercent({
                    basePrice,
                    groupPrice: groupBuy.group_price,
                    discountPercentage: groupBuy.discount_percentage,
                  });

                  return (
                    <TableRow
                      key={groupBuy.id}
                      className={selectedGroupBuyId === groupBuy.id ? 'bg-primary/5' : ''}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {groupBuy.title || groupBuy.products?.name || '-'}
                          </p>
                          {groupBuy.title ? (
                            <p className="text-xs text-muted-foreground">
                              {groupBuy.products?.name}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {groupBuy.current_participants || 0}/{groupBuy.min_participants}
                          {groupBuy.max_participants ? (
                            <span className="text-xs text-muted-foreground">
                              {' '}
                              (max {groupBuy.max_participants})
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-primary">
                            {formatPrice(groupPrice)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {savingsPercent > 0 ? `${savingsPercent}% off` : 'No discount'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(groupBuy.expires_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(groupBuy.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(groupBuy)}
                            title="Edit pricing"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedGroupBuyId(groupBuy.id)}
                            title="View participants"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(groupBuy.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredGroupBuys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No group buys found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
