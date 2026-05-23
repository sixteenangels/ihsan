import { useEffect, useMemo, useState } from 'react';
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
  BarChart3,
  Sparkles,
  EyeOff,
  EyeIcon,
  LockKeyhole,
  LockOpen,
  Star,
  RotateCcw,
} from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useCurrency } from '@/hooks/useCurrency';
import type { Database, Json } from '@/integrations/supabase/types';
import {
  getGroupBuySavingsPercent,
  getGroupBuyUnitPrice,
} from '@/lib/groupBuyPricing';
import {
  extractGroupBuySelectionsFromShippingAddress,
  getGroupBuySelectionsTotalAmount,
} from '@/lib/groupBuySelections';
import { GroupBuyParticipantList } from '@/components/groupbuy/GroupBuyParticipantList';
import { AdminGroupBuySettingsCard } from './AdminGroupBuySettingsCard';
import { useGroupBuySettings } from '@/hooks/useGroupBuySettings';
import {
  buildGroupBuySettingsSnapshot,
  DEFAULT_GROUP_BUY_SETTINGS,
  GROUP_BUY_SHIPPING_METHODS,
  resolveGroupBuySettings,
  type GroupBuySettings,
  type GroupBuyShippingMethod,
  groupBuyDurationToMilliseconds,
} from '@/lib/groupBuyConfig';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

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

interface GroupBuyInviteAnalyticsRow {
  group_buy_id: string;
  visits: number;
  joins: number;
}

function buildDefaultExpiryLocal(settings: GroupBuySettings): string {
  const futureDate = new Date(
    Date.now() +
      groupBuyDurationToMilliseconds(
        settings.countdownDurationValue,
        settings.countdownDurationUnit,
      ),
  );
  return formatDateTimeLocal(futureDate.toISOString());
}

function buildDefaultForm(settings: GroupBuySettings): GroupBuyForm {
  return {
    product_id: '',
    title: '',
    min_participants: String(settings.minParticipantsRequired),
    max_participants: String(
      Math.max(settings.maxParticipantsAllowed, settings.minParticipantsRequired),
    ),
    group_price: '',
    tier_participants: '',
    tier_group_price: '',
    expires_at: buildDefaultExpiryLocal(settings),
  };
}

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
  const { settings: defaultGroupBuySettings } = useGroupBuySettings();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingGroupBuyId, setEditingGroupBuyId] = useState<string | null>(null);
  const [form, setForm] = useState<GroupBuyForm>(() => buildDefaultForm(DEFAULT_GROUP_BUY_SETTINGS));
  const [selectedGroupBuyId, setSelectedGroupBuyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | GroupBuyStatus>('all');
  const [controlsGroupBuyId, setControlsGroupBuyId] = useState<string | null>(null);
  const [controlsDraft, setControlsDraft] = useState<GroupBuySettings>(DEFAULT_GROUP_BUY_SETTINGS);

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

  const { data: inviteAnalytics = [] } = useQuery({
    queryKey: ['admin-group-buy-invite-analytics'],
    queryFn: async (): Promise<GroupBuyInviteAnalyticsRow[]> => {
      const { data, error } = await supabase
        .from('group_buy_invites' as never)
        .select('group_buy_id, visits, joins');

      if (error) {
        throw error;
      }

      return ((data as unknown[]) || []) as GroupBuyInviteAnalyticsRow[];
    },
  });

  const editingGroupBuy =
    groupBuys.find((groupBuy) => groupBuy.id === editingGroupBuyId) || null;
  const selectedGroupBuy =
    groupBuys.find((groupBuy) => groupBuy.id === selectedGroupBuyId) || null;
  const controlsGroupBuy =
    groupBuys.find((groupBuy) => groupBuy.id === controlsGroupBuyId) || null;
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

  useEffect(() => {
    if (!controlsGroupBuy) {
      return;
    }

    setControlsDraft(
      resolveGroupBuySettings(defaultGroupBuySettings, controlsGroupBuy.settings),
    );
  }, [controlsGroupBuy, defaultGroupBuySettings]);

  const resetDialog = () => {
    setDialogMode('create');
    setEditingGroupBuyId(null);
    setForm(buildDefaultForm(defaultGroupBuySettings));
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    resetDialog();
  };

  const openCreateDialog = () => {
    setDialogMode('create');
    setEditingGroupBuyId(null);
    setForm(buildDefaultForm(defaultGroupBuySettings));
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
      const minParticipants = Number.parseInt(data.min_participants, 10);
      const maxParticipants = data.max_participants
        ? Number.parseInt(data.max_participants, 10)
        : null;
      const settingsSnapshot = buildGroupBuySettingsSnapshot({
        ...defaultGroupBuySettings,
        minParticipantsRequired: minParticipants,
        maxParticipantsAllowed: maxParticipants ?? minParticipants,
      });

      const { data: createdGroupBuy, error } = await supabase.from('group_buys').insert({
        product_id: data.product_id,
        title: data.title || null,
        min_participants: minParticipants,
        max_participants: maxParticipants,
        group_price: groupPrice,
        discount_percentage: calculateDiscountPercentage(basePrice, data.group_price),
        expires_at: data.expires_at,
        created_by: user.id,
        status: 'open',
        settings: settingsSnapshot as unknown as Json,
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
      queryClient.invalidateQueries({ queryKey: ['product-active-group-buys'] });
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
      const existingGroupBuy = groupBuys.find((groupBuy) => groupBuy.id === id);
      const minParticipants = Number.parseInt(data.min_participants, 10);
      const maxParticipants = data.max_participants
        ? Number.parseInt(data.max_participants, 10)
        : null;
      const settingsSnapshot = buildGroupBuySettingsSnapshot({
        ...resolveGroupBuySettings(defaultGroupBuySettings, existingGroupBuy?.settings),
        minParticipantsRequired: minParticipants,
        maxParticipantsAllowed: maxParticipants ?? minParticipants,
      });

      const { error } = await supabase
        .from('group_buys')
        .update({
          title: data.title || null,
          min_participants: minParticipants,
          max_participants: maxParticipants,
          group_price: data.group_price ? Number.parseFloat(data.group_price) : null,
          discount_percentage: calculateDiscountPercentage(basePrice, data.group_price),
          expires_at: data.expires_at,
          settings: settingsSnapshot as unknown as Json,
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
      queryClient.invalidateQueries({ queryKey: ['product-active-group-buys'] });
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
      queryClient.invalidateQueries({ queryKey: ['group-buy-detail'] });
      queryClient.invalidateQueries({ queryKey: ['product-active-group-buys'] });
      toast.success('Group buy cancelled');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateControlsMutation = useMutation({
    mutationFn: async ({
      groupBuyId,
      settings,
      status,
    }: {
      groupBuyId: string;
      settings: GroupBuySettings;
      status?: GroupBuyStatus | null;
    }) => {
      const payload: Database['public']['Tables']['group_buys']['Update'] = {
        settings: buildGroupBuySettingsSnapshot(settings) as unknown as Json,
      };

      if (status !== undefined) {
        payload.status = status;
      }

      const { error } = await supabase
        .from('group_buys')
        .update(payload)
        .eq('id', groupBuyId);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['group-buy-detail'] });
      queryClient.invalidateQueries({ queryKey: ['product-active-group-buys'] });
      toast.success('Group-buy controls updated');
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
      queryClient.invalidateQueries({ queryKey: ['group-buy-detail'] });
      queryClient.invalidateQueries({ queryKey: ['product-active-group-buys'] });
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

      const createdOrderIds: string[] = [];
      let masterOrderId: string | null = null;

      try {
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
        masterOrderId = masterOrder.id;

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

          if (childOrderError) {
            throw new Error(`Could not create order for participant ${participant.user_id}: ${childOrderError.message}`);
          }

          createdOrderIds.push(childOrder.id);

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

          const { error: orderItemsError } = await supabase.from('order_items').insert(orderItems);
          if (orderItemsError) {
            throw new Error(`Could not add items for participant ${participant.user_id}: ${orderItemsError.message}`);
          }

          const { error: notificationError } = await supabase.from('notifications').insert({
            user_id: participant.user_id,
            title: 'Group Buy Order Created!',
            message: `Your group buy order for "${groupBuy.title || 'Group Buy'}" has been created. Check My Orders for details.`,
            type: 'order',
            data: { order_id: childOrder.id, group_buy_id: groupBuyId },
          });

          if (notificationError) {
            throw new Error(`Could not notify participant ${participant.user_id}: ${notificationError.message}`);
          }
        }

        const { error: closeError } = await supabase
          .from('group_buys')
          .update({ status: 'closed' })
          .eq('id', groupBuyId);

        if (closeError) throw closeError;

        return masterOrder;
      } catch (error) {
        if (masterOrderId) {
          const { error: childRollbackError } = createdOrderIds.length > 0
            ? await supabase.from('orders').delete().in('id', createdOrderIds)
            : { error: null };
          const { error: masterRollbackError } = await supabase
            .from('orders')
            .delete()
            .eq('id', masterOrderId);

          if (childRollbackError || masterRollbackError) {
            console.warn('Could not roll back incomplete group-buy orders:', childRollbackError || masterRollbackError);
          }
        }

        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['group-buy-detail'] });
      queryClient.invalidateQueries({ queryKey: ['product-active-group-buys'] });
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

  const filteredGroupBuys = useMemo(
    () =>
      groupBuys
        .filter((groupBuy) => {
          if (statusFilter === 'all') return true;
          return groupBuy.status === statusFilter;
        })
        .sort((left, right) => {
          const leftSettings = resolveGroupBuySettings(defaultGroupBuySettings, left.settings);
          const rightSettings = resolveGroupBuySettings(defaultGroupBuySettings, right.settings);
          if (leftSettings.featuredByDefault !== rightSettings.featuredByDefault) {
            return leftSettings.featuredByDefault ? -1 : 1;
          }

          return new Date(left.expires_at).getTime() - new Date(right.expires_at).getTime();
        }),
    [defaultGroupBuySettings, groupBuys, statusFilter],
  );

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const selectedCurrentParticipants = selectedGroupBuy?.current_participants || 0;
  const selectedParticipantCap =
    selectedGroupBuy?.max_participants ?? selectedGroupBuy?.min_participants ?? 0;
  const selectedCanCreateCollectiveOrder =
    !!selectedGroupBuy &&
    (selectedGroupBuy.status === 'open' || selectedGroupBuy.status === 'filled') &&
    selectedCurrentParticipants >= selectedGroupBuy.min_participants;
  const selectedResolvedSettings = selectedGroupBuy
    ? resolveGroupBuySettings(defaultGroupBuySettings, selectedGroupBuy.settings)
    : null;
  const totalParticipantsTracked = groupBuys.reduce(
    (sum, groupBuy) => sum + (groupBuy.current_participants || 0),
    0,
  );
  const totalInviteVisits = inviteAnalytics.reduce((sum, row) => sum + (row.visits || 0), 0);
  const totalInviteJoins = inviteAnalytics.reduce((sum, row) => sum + (row.joins || 0), 0);
  const completedGroupBuyCount = groupBuys.filter(
    (groupBuy) => groupBuy.status === 'filled' || groupBuy.status === 'closed',
  ).length;
  const failedGroupBuyCount = groupBuys.filter((groupBuy) => groupBuy.status === 'cancelled').length;
  const completionRate = groupBuys.length > 0
    ? Math.round((completedGroupBuyCount / groupBuys.length) * 100)
    : 0;
  const inviteConversionRate = totalInviteVisits > 0
    ? Math.round((totalInviteJoins / totalInviteVisits) * 100)
    : 0;

  const openControlsDialog = (groupBuy: AdminGroupBuyRecord) => {
    setControlsGroupBuyId(groupBuy.id);
    setControlsDraft(resolveGroupBuySettings(defaultGroupBuySettings, groupBuy.settings));
  };

  const closeControlsDialog = () => {
    setControlsGroupBuyId(null);
  };

  const handleControlsSave = () => {
    if (!controlsGroupBuy) {
      return;
    }

    const nextStatus =
      controlsGroupBuy.status === 'filled' && controlsDraft.participationOpen
        ? 'open'
        : undefined;

    updateControlsMutation.mutate(
      {
        groupBuyId: controlsGroupBuy.id,
        settings: controlsDraft,
        status: nextStatus,
      },
      {
        onSuccess: () => {
          closeControlsDialog();
        },
      },
    );
  };

  const updateSelectedGroupBuySettings = (
    transform: (settings: GroupBuySettings) => GroupBuySettings,
    status?: GroupBuyStatus | null,
  ) => {
    if (!selectedGroupBuy) {
      return;
    }

    const nextSettings = transform(
      resolveGroupBuySettings(defaultGroupBuySettings, selectedGroupBuy.settings),
    );

    updateControlsMutation.mutate({
      groupBuyId: selectedGroupBuy.id,
      settings: nextSettings,
      status,
    });
  };

  const handleDialogSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const minParticipants = Number.parseInt(form.min_participants, 10);
    const maxParticipants = form.max_participants
      ? Number.parseInt(form.max_participants, 10)
      : null;
    const tierParticipants = form.tier_participants
      ? Number.parseInt(form.tier_participants, 10)
      : null;

    if (!Number.isFinite(minParticipants) || minParticipants < 1) {
      toast.error('Set a valid minimum participant target.');
      return;
    }

    if (maxParticipants != null && maxParticipants < minParticipants) {
      toast.error('Max participants must be the same as or higher than the minimum target.');
      return;
    }

    if (tierParticipants != null && tierParticipants <= minParticipants) {
      toast.error('Momentum tier participants must be higher than the minimum target.');
      return;
    }

    if (tierParticipants != null && maxParticipants != null && tierParticipants > maxParticipants) {
      toast.error('Momentum tier cannot be higher than the participant cap.');
      return;
    }

    if (dialogMode === 'edit' && editingGroupBuyId) {
      updateMutation.mutate({ id: editingGroupBuyId, data: form });
      return;
    }

    createMutation.mutate(form);
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-serif text-2xl font-bold text-foreground sm:text-3xl">Group Buys</h1>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => expireAllMutation.mutate()}
            disabled={expireAllMutation.isPending}
          >
            {expireAllMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Process Expired
          </Button>

          <Button className="w-full sm:w-auto" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Create Group Buy
          </Button>
        </div>
      </div>

      <AdminGroupBuySettingsCard />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Participant Count Tracker</p>
              <p className="text-2xl font-bold text-foreground">{totalParticipantsTracked}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-accent/15 p-3 text-accent-foreground">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Conversion Tracking</p>
              <p className="text-2xl font-bold text-foreground">{inviteConversionRate}%</p>
              <p className="text-xs text-muted-foreground">{totalInviteJoins} joins from {totalInviteVisits} tracked visits</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-destructive/10 p-3 text-destructive">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Failed Group Buy Tracking</p>
              <p className="text-2xl font-bold text-foreground">{failedGroupBuyCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-green-500/10 p-3 text-green-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completion Rate Monitoring</p>
              <p className="text-2xl font-bold text-foreground">{completionRate}%</p>
              <p className="text-xs text-muted-foreground">{completedGroupBuyCount} completed of {groupBuys.length}</p>
            </div>
          </CardContent>
        </Card>
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

            <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {dialogMode === 'edit' ? 'Save Changes' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!controlsGroupBuyId}
        onOpenChange={(open) => {
          if (!open) {
            closeControlsDialog();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-background sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {controlsGroupBuy?.title || controlsGroupBuy?.products?.name || 'Group Buy'} Controls
            </DialogTitle>
            <DialogDescription>
              Override visibility, participation, fulfillment, shipping, notification, and pricing rules for this live deal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-xl border border-border/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Visible</Label>
                    <p className="text-xs text-muted-foreground">Show this group buy on the storefront.</p>
                  </div>
                  <Switch
                    checked={controlsDraft.visibleByDefault}
                    onCheckedChange={(checked) =>
                      setControlsDraft((current) => ({ ...current, visibleByDefault: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Featured Group Buy</Label>
                    <p className="text-xs text-muted-foreground">Pin this deal higher in storefront group-buy lists.</p>
                  </div>
                  <Switch
                    checked={controlsDraft.featuredByDefault}
                    onCheckedChange={(checked) =>
                      setControlsDraft((current) => ({ ...current, featuredByDefault: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Participation Open</Label>
                    <p className="text-xs text-muted-foreground">Allow new shoppers to join this group buy.</p>
                  </div>
                  <Switch
                    checked={controlsDraft.participationOpen}
                    onCheckedChange={(checked) =>
                      setControlsDraft((current) => ({ ...current, participationOpen: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Auto-Close When Full</Label>
                    <p className="text-xs text-muted-foreground">Close automatically when the max seat count is reached.</p>
                  </div>
                  <Switch
                    checked={controlsDraft.autoCloseWhenFull}
                    onCheckedChange={(checked) =>
                      setControlsDraft((current) => ({ ...current, autoCloseWhenFull: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Auto-Confirm At Target</Label>
                    <p className="text-xs text-muted-foreground">Mark this deal ready when the minimum target is met.</p>
                  </div>
                  <Switch
                    checked={controlsDraft.autoConfirmWhenTargetReached}
                    onCheckedChange={(checked) =>
                      setControlsDraft((current) => ({
                        ...current,
                        autoConfirmWhenTargetReached: checked,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Manual Confirmation Required</Label>
                    <p className="text-xs text-muted-foreground">Keep admin confirmation in the loop before fulfillment starts.</p>
                  </div>
                  <Switch
                    checked={controlsDraft.manualConfirmationRequired}
                    onCheckedChange={(checked) =>
                      setControlsDraft((current) => ({
                        ...current,
                        manualConfirmationRequired: checked,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-border/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Allow Partial Fulfillment</Label>
                    <p className="text-xs text-muted-foreground">Process ready participants even if the deal does not fully convert.</p>
                  </div>
                  <Switch
                    checked={controlsDraft.allowPartialFulfillment}
                    onCheckedChange={(checked) =>
                      setControlsDraft((current) => ({ ...current, allowPartialFulfillment: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Allow Duplicate Participation</Label>
                    <p className="text-xs text-muted-foreground">Let the same shopper add more quantity later.</p>
                  </div>
                  <Switch
                    checked={controlsDraft.allowDuplicateParticipation}
                    onCheckedChange={(checked) =>
                      setControlsDraft((current) => ({ ...current, allowDuplicateParticipation: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Require Full Payment</Label>
                    <p className="text-xs text-muted-foreground">Prevent unpaid shoppers from taking a slot.</p>
                  </div>
                  <Switch
                    checked={controlsDraft.requireFullPaymentBeforeJoining}
                    onCheckedChange={(checked) =>
                      setControlsDraft((current) => ({
                        ...current,
                        requireFullPaymentBeforeJoining: checked,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Participant Limit Per User</Label>
                  <Input
                    type="number"
                    min="1"
                    value={controlsDraft.participantLimitPerUser}
                    onChange={(event) =>
                      setControlsDraft((current) => ({
                        ...current,
                        participantLimitPerUser: Math.max(1, Number(event.target.value) || 1),
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Automatic Participant Notifications</Label>
                    <p className="text-xs text-muted-foreground">Send automatic lifecycle notifications for this deal.</p>
                  </div>
                  <Switch
                    checked={controlsDraft.automaticParticipantNotifications}
                    onCheckedChange={(checked) =>
                      setControlsDraft((current) => ({
                        ...current,
                        automaticParticipantNotifications: checked,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Allow Admin Cancellation</Label>
                    <p className="text-xs text-muted-foreground">Keep the cancel action available for this group buy.</p>
                  </div>
                  <Switch
                    checked={controlsDraft.allowAdminCancellation}
                    onCheckedChange={(checked) =>
                      setControlsDraft((current) => ({ ...current, allowAdminCancellation: checked }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-border/70 p-4">
              <div>
                <Label>Allowed Shipping Methods</Label>
                <p className="text-xs text-muted-foreground">Restrict which shipping methods can be used for this deal.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {GROUP_BUY_SHIPPING_METHODS.map((method) => (
                  <label
                    key={method}
                    className="flex items-center gap-3 rounded-xl border border-border/70 p-3 text-sm"
                  >
                    <Checkbox
                      checked={controlsDraft.allowedShippingMethods.includes(method)}
                      onCheckedChange={(checked) =>
                        setControlsDraft((current) => {
                          const nextMethods = checked
                            ? [...current.allowedShippingMethods, method]
                            : current.allowedShippingMethods.filter((entry) => entry !== method);
                          const dedupedMethods = Array.from(new Set(nextMethods));

                          return {
                            ...current,
                            allowedShippingMethods:
                              dedupedMethods.length > 0 ? dedupedMethods : [method],
                            defaultShippingMethod:
                              dedupedMethods.includes(current.defaultShippingMethod) || checked
                                ? current.defaultShippingMethod
                                : method,
                          };
                        })
                      }
                    />
                    <span>
                      {method === 'air_shipping'
                        ? 'Air Shipping'
                        : method === 'sea_shipping'
                          ? 'Sea Shipping'
                          : 'Courier (Local) Delivery'}
                    </span>
                  </label>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
                <div className="space-y-2">
                  <Label>Default Shipping Method</Label>
                  <Select
                    value={controlsDraft.defaultShippingMethod}
                    onValueChange={(value) =>
                      setControlsDraft((current) => ({
                        ...current,
                        defaultShippingMethod: value as GroupBuyShippingMethod,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {controlsDraft.allowedShippingMethods.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method === 'air_shipping'
                            ? 'Air Shipping'
                            : method === 'sea_shipping'
                              ? 'Sea Shipping'
                              : 'Courier (Local) Delivery'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Shipping Fee Override</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={controlsDraft.shippingFeeOverride ?? ''}
                    onChange={(event) =>
                      setControlsDraft((current) => ({
                        ...current,
                        shippingFeeOverride:
                          event.target.value === '' ? null : Math.max(0, Number(event.target.value) || 0),
                      }))
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Shipping Restriction Notes</Label>
                <Textarea
                  rows={3}
                  value={controlsDraft.shippingRestrictionNotes}
                  onChange={(event) =>
                    setControlsDraft((current) => ({
                      ...current,
                      shippingRestrictionNotes: event.target.value,
                    }))
                  }
                  placeholder="Sea shipping not recommended for electronics."
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-xl border border-border/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Dynamic Pricing</Label>
                    <p className="text-xs text-muted-foreground">Allow this deal to react to milestone pricing rules.</p>
                  </div>
                  <Switch
                    checked={controlsDraft.dynamicPricing}
                    onCheckedChange={(checked) =>
                      setControlsDraft((current) => ({ ...current, dynamicPricing: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Admin Override Pricing</Label>
                    <p className="text-xs text-muted-foreground">Keep manual override pricing enabled for this deal.</p>
                  </div>
                  <Switch
                    checked={controlsDraft.adminOverridePricing}
                    onCheckedChange={(checked) =>
                      setControlsDraft((current) => ({ ...current, adminOverridePricing: checked }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-3 rounded-xl border border-border/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Fragile Item</Label>
                    <p className="text-xs text-muted-foreground">Flag this group buy for fragile handling logic.</p>
                  </div>
                  <Switch
                    checked={controlsDraft.fragileItemByDefault}
                    onCheckedChange={(checked) =>
                      setControlsDraft((current) => ({ ...current, fragileItemByDefault: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Reinforced Packaging</Label>
                    <p className="text-xs text-muted-foreground">Allow reinforced packaging upsell for this deal.</p>
                  </div>
                  <Switch
                    checked={controlsDraft.reinforcedPackagingAvailable}
                    onCheckedChange={(checked) =>
                      setControlsDraft((current) => ({
                        ...current,
                        reinforcedPackagingAvailable: checked,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={closeControlsDialog}>
                Cancel
              </Button>
              <Button className="w-full sm:w-auto" onClick={handleControlsSave} disabled={updateControlsMutation.isPending}>
                {updateControlsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Controls
              </Button>
            </div>
          </div>
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
                {selectedCurrentParticipants}/{selectedGroupBuy.min_participants} minimum
                {selectedParticipantCap > selectedGroupBuy.min_participants
                  ? `, ${selectedParticipantCap} cap`
                  : ''}{' '}
                {' - '} {getStatusBadge(selectedGroupBuy.status)}
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
              {selectedResolvedSettings ? (
                <div className="flex flex-wrap gap-2">
                  <Badge variant={selectedResolvedSettings.visibleByDefault ? 'default' : 'outline'}>
                    {selectedResolvedSettings.visibleByDefault ? (
                      <EyeIcon className="mr-1 h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="mr-1 h-3.5 w-3.5" />
                    )}
                    {selectedResolvedSettings.visibleByDefault ? 'Visible' : 'Hidden'}
                  </Badge>
                  <Badge variant={selectedResolvedSettings.featuredByDefault ? 'default' : 'outline'}>
                    <Star className="mr-1 h-3.5 w-3.5" />
                    {selectedResolvedSettings.featuredByDefault ? 'Featured' : 'Not featured'}
                  </Badge>
                  <Badge variant={selectedResolvedSettings.participationOpen ? 'default' : 'outline'}>
                    {selectedResolvedSettings.participationOpen ? (
                      <LockOpen className="mr-1 h-3.5 w-3.5" />
                    ) : (
                      <LockKeyhole className="mr-1 h-3.5 w-3.5" />
                    )}
                    {selectedResolvedSettings.participationOpen ? 'Participation open' : 'Participation closed'}
                  </Badge>
                </div>
              ) : null}
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => openControlsDialog(selectedGroupBuy)}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Deal Controls
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const reopening = !selectedResolvedSettings?.participationOpen;
                  updateSelectedGroupBuySettings(
                    (settings) => ({
                      ...settings,
                      participationOpen: !settings.participationOpen,
                    }),
                    reopening && selectedGroupBuy.status === 'filled' ? 'open' : undefined,
                  );
                }}
                disabled={
                  updateControlsMutation.isPending ||
                  selectedGroupBuy.status === 'cancelled' ||
                  selectedGroupBuy.status === 'closed'
                }
              >
                {selectedResolvedSettings?.participationOpen ? (
                  <>
                    <LockKeyhole className="mr-2 h-4 w-4" />
                    Close Participation
                  </>
                ) : (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reopen Participation
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateSelectedGroupBuySettings((settings) => ({
                    ...settings,
                    visibleByDefault: !settings.visibleByDefault,
                  }))
                }
                disabled={updateControlsMutation.isPending}
              >
                {selectedResolvedSettings?.visibleByDefault ? (
                  <>
                    <EyeOff className="mr-2 h-4 w-4" />
                    Hide
                  </>
                ) : (
                  <>
                    <EyeIcon className="mr-2 h-4 w-4" />
                    Show
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateSelectedGroupBuySettings((settings) => ({
                    ...settings,
                    featuredByDefault: !settings.featuredByDefault,
                  }))
                }
                disabled={updateControlsMutation.isPending}
              >
                <Star className="mr-2 h-4 w-4" />
                {selectedResolvedSettings?.featuredByDefault ? 'Unfeature' : 'Feature'}
              </Button>
              {selectedCanCreateCollectiveOrder ? (
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
              {selectedGroupBuy.status === 'open' && selectedResolvedSettings?.allowAdminCancellation !== false ? (
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
                  const resolvedSettings = resolveGroupBuySettings(defaultGroupBuySettings, groupBuy.settings);

                  return (
                    <TableRow
                      key={groupBuy.id}
                      className={selectedGroupBuyId === groupBuy.id ? 'bg-primary/5' : ''}
                    >
                      <TableCell>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">
                              {groupBuy.title || groupBuy.products?.name || '-'}
                            </p>
                            {resolvedSettings.featuredByDefault ? (
                              <Badge variant="outline">
                                <Star className="mr-1 h-3 w-3" />
                                Featured
                              </Badge>
                            ) : null}
                            {!resolvedSettings.visibleByDefault ? (
                              <Badge variant="outline">
                                <EyeOff className="mr-1 h-3 w-3" />
                                Hidden
                              </Badge>
                            ) : null}
                          </div>
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
                          {!resolvedSettings.participationOpen ? (
                            <Badge variant="outline" className="ml-2">
                              Closed
                            </Badge>
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
                            onClick={() => openControlsDialog(groupBuy)}
                            title="Deal controls"
                          >
                            <Sparkles className="h-4 w-4" />
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
