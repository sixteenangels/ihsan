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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Eye, ShoppingCart, XCircle, Users } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useCurrency } from '@/hooks/useCurrency';
import type { Database } from '@/integrations/supabase/types';
import { getGroupBuyUnitPrice } from '@/lib/groupBuyPricing';
import { GroupBuyParticipantList } from '@/components/groupbuy/GroupBuyParticipantList';

type GroupBuyStatus = Database['public']['Enums']['group_buy_status'];
type GroupBuyRecord = Database['public']['Tables']['group_buys']['Row'];
type GroupBuyParticipantRecord = Database['public']['Tables']['group_buy_participants']['Row'];

interface GroupBuyForm {
  product_id: string;
  title: string;
  min_participants: string;
  max_participants: string;
  group_price: string;
  expires_at: string;
}

interface GroupBuyProductSummary {
  name: string;
  base_price: number;
}

interface AdminGroupBuyRecord extends GroupBuyRecord {
  products: GroupBuyProductSummary | null;
}

const defaultForm: GroupBuyForm = {
  product_id: '',
  title: '',
  min_participants: '10',
  max_participants: '',
  group_price: '',
  expires_at: '',
};

export function AdminGroupBuys() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
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

  const createMutation = useMutation({
    mutationFn: async (data: GroupBuyForm) => {
      const { error } = await supabase.from('group_buys').insert({
        product_id: data.product_id,
        title: data.title || null,
        min_participants: Number.parseInt(data.min_participants, 10),
        max_participants: data.max_participants ? Number.parseInt(data.max_participants, 10) : null,
        group_price: data.group_price ? Number.parseFloat(data.group_price) : null,
        discount_percentage: 0,
        expires_at: data.expires_at,
        created_by: user?.id,
        status: 'open',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['group-buys'] });
      toast.success('Group buy created');
      setIsOpen(false);
      setForm(defaultForm);
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

      const unitPrice = getGroupBuyUnitPrice({
        basePrice: Number(groupBuy.products?.base_price || 0),
        groupPrice: groupBuy.group_price,
        discountPercentage: groupBuy.discount_percentage,
      });

      const totalAmount = paidParticipants.reduce((sum, participant) => {
        return sum + unitPrice * (participant.quantity || 1);
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
          order_number: 'PLACEHOLDER',
          notes: `Group Buy: ${groupBuy.title || 'Group Buy'} - ${paidParticipants.length} participants`,
        })
        .select()
        .single();

      if (masterOrderError) throw masterOrderError;

      for (const participant of paidParticipants) {
        const childTotal = unitPrice * (participant.quantity || 1);
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
            order_number: 'PLACEHOLDER',
            shipping_address: shippingAddress,
          })
          .select()
          .single();

        if (childOrderError) continue;

        if (participant.variant_id) {
          await supabase.from('order_items').insert({
            order_id: childOrder.id,
            product_variant_id: participant.variant_id,
            product_name: groupBuy.products?.name || 'Group Buy Product',
            quantity: participant.quantity || 1,
            unit_price: unitPrice,
            total_price: childTotal,
          });
        }

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

  const selectedGroupBuy = groupBuys.find((groupBuy) => groupBuy.id === selectedGroupBuyId) || null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold font-serif text-foreground">Group Buys</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => expireAllMutation.mutate()}
            disabled={expireAllMutation.isPending}
          >
            {expireAllMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Process Expired
          </Button>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Group Buy
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Group Buy</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createMutation.mutate(form);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Product *</Label>
                  <Select
                    value={form.product_id}
                    onValueChange={(value) => {
                      const selectedProduct = products?.find((product) => product.id === value);
                      setForm((prev) => ({
                        ...prev,
                        product_id: value,
                        group_price:
                          selectedProduct?.group_buy_price != null
                            ? String(selectedProduct.group_buy_price)
                            : prev.group_price,
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.filter((product) => product.is_group_buy_eligible).map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Title (optional)</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Custom group buy name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Min Participants *</Label>
                    <Input
                      type="number"
                      min="2"
                      value={form.min_participants}
                      onChange={(e) => setForm((prev) => ({ ...prev, min_participants: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Group Price *</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.group_price}
                      onChange={(e) => setForm((prev) => ({ ...prev, group_price: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Max Participants</Label>
                  <Input
                    type="number"
                    value={form.max_participants}
                    onChange={(e) => setForm((prev) => ({ ...prev, max_participants: e.target.value }))}
                    placeholder="No limit"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Expires At *</Label>
                  <Input
                    type="datetime-local"
                    value={form.expires_at}
                    onChange={(e) => setForm((prev) => ({ ...prev, expires_at: e.target.value }))}
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | GroupBuyStatus)} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All ({groupBuys.length})</TabsTrigger>
          <TabsTrigger value="open">Open ({groupBuys.filter((item) => item.status === 'open').length})</TabsTrigger>
          <TabsTrigger value="filled">Filled ({groupBuys.filter((item) => item.status === 'filled').length})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({groupBuys.filter((item) => item.status === 'closed').length})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({groupBuys.filter((item) => item.status === 'cancelled').length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {selectedGroupBuy ? (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                {selectedGroupBuy.title || selectedGroupBuy.products?.name || 'Group Buy'}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {selectedGroupBuy.current_participants || 0}/{selectedGroupBuy.min_participants} participants
                {' - '}{getStatusBadge(selectedGroupBuy.status)}
              </p>
            </div>
            <div className="flex gap-2">
              {selectedGroupBuy.status === 'filled' && (
                <Button
                  onClick={() => createCollectiveOrderMutation.mutate(selectedGroupBuy.id)}
                  disabled={createCollectiveOrderMutation.isPending}
                >
                  {createCollectiveOrderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Create Collective Order
                </Button>
              )}
              {selectedGroupBuy.status === 'open' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => cancelMutation.mutate(selectedGroupBuy.id)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
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
                  const groupPrice = getGroupBuyUnitPrice({
                    basePrice: Number(groupBuy.products?.base_price || 0),
                    groupPrice: groupBuy.group_price,
                    discountPercentage: groupBuy.discount_percentage,
                  });

                  return (
                    <TableRow key={groupBuy.id} className={selectedGroupBuyId === groupBuy.id ? 'bg-primary/5' : ''}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{groupBuy.title || groupBuy.products?.name || '-'}</p>
                          {groupBuy.title && (
                            <p className="text-xs text-muted-foreground">{groupBuy.products?.name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {groupBuy.current_participants || 0}/{groupBuy.min_participants}
                          {groupBuy.max_participants ? (
                            <span className="text-xs text-muted-foreground">
                              {' '} (max {groupBuy.max_participants})
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{formatPrice(groupPrice)}</TableCell>
                      <TableCell>{new Date(groupBuy.expires_at).toLocaleDateString()}</TableCell>
                      <TableCell>{getStatusBadge(groupBuy.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
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
                {filteredGroupBuys.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No group buys found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
