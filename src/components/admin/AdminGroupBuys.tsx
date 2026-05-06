import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Eye, ShoppingCart, XCircle, Users } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useCurrency } from '@/hooks/useCurrency';
import { groupBuySchema, validateForm } from '@/lib/validations/admin';
import { GroupBuyParticipantList } from '@/components/groupbuy/GroupBuyParticipantList';

interface GroupBuyForm {
  product_id: string;
  title: string;
  min_participants: string;
  max_participants: string;
  discount_percentage: string;
  expires_at: string;
}

const defaultForm: GroupBuyForm = {
  product_id: '',
  title: '',
  min_participants: '10',
  max_participants: '',
  discount_percentage: '20',
  expires_at: '',
};

export function AdminGroupBuys() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<GroupBuyForm>(defaultForm);
  const [selectedGroupBuyId, setSelectedGroupBuyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: products } = useProducts();

  const { data: groupBuys, isLoading } = useQuery({
    queryKey: ['admin-group-buys'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_buys')
        .select('*, products(name, base_price)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: GroupBuyForm) => {
      const { error } = await supabase.from('group_buys').insert({
        product_id: data.product_id,
        title: data.title || null,
        min_participants: parseInt(data.min_participants),
        max_participants: data.max_participants ? parseInt(data.max_participants) : null,
        discount_percentage: parseFloat(data.discount_percentage),
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
      // Call the check_expired_group_buys function
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
      const gb = groupBuys?.find((g) => g.id === groupBuyId);
      if (!gb) throw new Error('Group buy not found');

      // Fetch all paid participants
      const { data: participants, error: pErr } = await supabase
        .from('group_buy_participants')
        .select('*')
        .eq('group_buy_id', groupBuyId)
        .eq('payment_status', 'paid');
      if (pErr) throw pErr;
      if (!participants || participants.length === 0) throw new Error('No paid participants');

      const product = gb.products as any;
      const discountedPrice = Number(product?.base_price || 0) * (1 - (Number(gb.discount_percentage) || 0) / 100);

      // Create master order
      const totalAmount = participants.reduce((sum, p) => sum + discountedPrice * (p.quantity || 1), 0);
      const { data: masterOrder, error: moErr } = await supabase
        .from('orders')
        .insert({
          user_id: gb.created_by,
          subtotal: totalAmount,
          total_amount: totalAmount,
          group_buy_id: groupBuyId,
          is_group_buy_master: true,
          status: 'confirmed',
          order_number: 'PLACEHOLDER',
          notes: `Group Buy: ${gb.title || 'Group Buy'} — ${participants.length} participants`,
        })
        .select()
        .single();
      if (moErr) throw moErr;

      // Create child orders for each participant
      for (const p of participants) {
        const childTotal = discountedPrice * (p.quantity || 1);
        const addr = p.shipping_address as any;

        const { data: childOrder, error: coErr } = await supabase
          .from('orders')
          .insert({
            user_id: p.user_id,
            subtotal: childTotal,
            total_amount: childTotal,
            group_buy_id: groupBuyId,
            parent_order_id: masterOrder.id,
            status: 'confirmed',
            order_number: 'PLACEHOLDER',
            shipping_address: addr || null,
          })
          .select()
          .single();
        if (coErr) continue;

        // Create order item
        if (p.variant_id) {
          await supabase.from('order_items').insert({
            order_id: childOrder.id,
            product_variant_id: p.variant_id,
            product_name: product?.name || 'Group Buy Product',
            quantity: p.quantity || 1,
            unit_price: discountedPrice,
            total_price: childTotal,
          });
        }

        // Notify participant
        await supabase.from('notifications').insert({
          user_id: p.user_id,
          title: 'Group Buy Order Created!',
          message: `Your group buy order for "${gb.title || 'Group Buy'}" has been created. Check My Orders for details.`,
          type: 'order',
          data: { order_id: childOrder.id, group_buy_id: groupBuyId },
        });
      }

      // Update group buy status to closed
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'open': return <Badge className="bg-primary/10 text-primary">Open</Badge>;
      case 'filled': return <Badge className="bg-accent/10 text-accent-foreground">Filled</Badge>;
      case 'closed': return <Badge variant="secondary">Closed</Badge>;
      case 'cancelled': return <Badge className="bg-destructive/10 text-destructive">Cancelled</Badge>;
      default: return <Badge variant="secondary">{status || 'Unknown'}</Badge>;
    }
  };

  const filteredGroupBuys = groupBuys?.filter((gb) => {
    if (statusFilter === 'all') return true;
    return gb.status === statusFilter;
  }) || [];

  const selectedGb = groupBuys?.find((g) => g.id === selectedGroupBuyId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold font-serif text-foreground">Group Buys</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => expireAllMutation.mutate()} disabled={expireAllMutation.isPending}>
            {expireAllMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Process Expired
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Create Group Buy</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create New Group Buy</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Product *</Label>
                  <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>
                      {products?.filter((p) => p.is_group_buy_eligible).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Title (optional)</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Custom group buy name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Min Participants *</Label>
                    <Input type="number" min="2" value={form.min_participants} onChange={(e) => setForm({ ...form, min_participants: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Discount % *</Label>
                    <Input type="number" min="1" max="99" value={form.discount_percentage} onChange={(e) => setForm({ ...form, discount_percentage: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Max Participants</Label>
                  <Input type="number" value={form.max_participants} onChange={(e) => setForm({ ...form, max_participants: e.target.value })} placeholder="No limit" />
                </div>
                <div className="space-y-2">
                  <Label>Expires At *</Label>
                  <Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} required />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
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

      {/* Status Filter Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All ({groupBuys?.length || 0})</TabsTrigger>
          <TabsTrigger value="open">Open ({groupBuys?.filter((g) => g.status === 'open').length || 0})</TabsTrigger>
          <TabsTrigger value="filled">Filled ({groupBuys?.filter((g) => g.status === 'filled').length || 0})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({groupBuys?.filter((g) => g.status === 'closed').length || 0})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({groupBuys?.filter((g) => g.status === 'cancelled').length || 0})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Drill-down view */}
      {selectedGroupBuyId && selectedGb ? (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                {(selectedGb as any).title || (selectedGb.products as any)?.name || 'Group Buy'}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {(selectedGb as any).current_participants || 0}/{selectedGb.min_participants} participants
                {' • '}{getStatusBadge(selectedGb.status)}
              </p>
            </div>
            <div className="flex gap-2">
              {selectedGb.status === 'filled' && (
                <Button
                  onClick={() => createCollectiveOrderMutation.mutate(selectedGroupBuyId)}
                  disabled={createCollectiveOrderMutation.isPending}
                >
                  {createCollectiveOrderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Create Collective Order
                </Button>
              )}
              {selectedGb.status === 'open' && (
                <Button variant="destructive" size="sm" onClick={() => cancelMutation.mutate(selectedGroupBuyId)}>
                  <XCircle className="h-4 w-4 mr-2" /> Cancel
                </Button>
              )}
              <Button variant="outline" onClick={() => setSelectedGroupBuyId(null)}>Close</Button>
            </div>
          </CardHeader>
          <CardContent>
            <GroupBuyParticipantList groupBuyId={selectedGroupBuyId} />
          </CardContent>
        </Card>
      ) : null}

      {/* Group Buys Table */}
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
                  <TableHead>Discount</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroupBuys.map((gb) => {
                  const product = gb.products as any;
                  return (
                    <TableRow key={gb.id} className={selectedGroupBuyId === gb.id ? 'bg-primary/5' : ''}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{(gb as any).title || product?.name || '-'}</p>
                          {(gb as any).title && <p className="text-xs text-muted-foreground">{product?.name}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {gb.current_participants || 0}/{gb.min_participants}
                          {(gb as any).max_participants && <span className="text-xs text-muted-foreground"> (max {(gb as any).max_participants})</span>}
                        </div>
                      </TableCell>
                      <TableCell>{gb.discount_percentage}%</TableCell>
                      <TableCell>{new Date(gb.expires_at).toLocaleDateString()}</TableCell>
                      <TableCell>{getStatusBadge(gb.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setSelectedGroupBuyId(gb.id)} title="View participants">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(gb.id)} title="Delete">
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
