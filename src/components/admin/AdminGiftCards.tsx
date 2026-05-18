import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy, Gift, Loader2, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useCurrency } from '@/hooks/useCurrency';
import { logAdminAction } from '@/lib/audit-log';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type GiftCardRow = Tables<'gift_cards'>;
type GiftCardProfile = Pick<Tables<'profiles'>, 'user_id' | 'name' | 'email'>;

function generateGiftCode() {
  const random = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `AJYN-${random}`;
}

export function AdminGiftCards() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(generateGiftCode());
  const [value, setValue] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const copyGiftCardCode = async (giftCode: string) => {
    await navigator.clipboard.writeText(giftCode);
    toast.success('Gift card code copied.');
  };

  const { data: giftCards = [], isLoading } = useQuery({
    queryKey: ['admin-gift-cards'],
    queryFn: async (): Promise<GiftCardRow[]> => {
      const { data, error } = await supabase
        .from('gift_cards')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['admin-gift-card-profiles'],
    queryFn: async (): Promise<GiftCardProfile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name, email');

      if (error) throw error;
      return data || [];
    },
  });

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.user_id, profile])),
    [profiles],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error('You must be signed in to create gift cards.');
      }

      const amount = Number(value);
      if (!amount || amount <= 0) {
        throw new Error('Enter a valid gift card value.');
      }

      const normalizedCode = code.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{4,50}$/.test(normalizedCode)) {
        throw new Error('Gift card code must be 4-50 characters using letters, numbers, hyphens, or underscores.');
      }

      if (giftCards.some((card) => card.code.toUpperCase() === normalizedCode)) {
        throw new Error('A gift card with this code already exists.');
      }

      const payload: TablesInsert<'gift_cards'> = {
        code: normalizedCode,
        initial_value: amount,
        balance: amount,
        created_by: user.id,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        is_active: true,
      };

      const { data, error } = await supabase
        .from('gift_cards')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      await logAdminAction({
        actorUserId: user?.id,
        action: 'gift_card.created',
        entityType: 'gift_card',
        entityId: data.id,
        summary: `Created gift card ${data.code} worth ${amount}.`,
        metadata: {
          code: data.code,
          initialValue: amount,
          expiresAt: data.expires_at,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gift-cards'] });
      toast.success('Gift card created.');
      setOpen(false);
      setCode(generateGiftCode());
      setValue('');
      setExpiresAt('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, nextActive, cardCode }: { id: string; nextActive: boolean; cardCode: string }) => {
      const update: TablesUpdate<'gift_cards'> = { is_active: nextActive };

      const { error } = await supabase
        .from('gift_cards')
        .update(update)
        .eq('id', id);

      if (error) throw error;

      await logAdminAction({
        actorUserId: user?.id,
        action: nextActive ? 'gift_card.enabled' : 'gift_card.disabled',
        entityType: 'gift_card',
        entityId: id,
        summary: `${nextActive ? 'Enabled' : 'Disabled'} gift card ${cardCode}.`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gift-cards'] });
      toast.success('Gift card status updated.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold font-serif text-foreground flex items-center gap-2">
          <Gift className="h-7 w-7 text-primary" />
          Gift Cards
        </h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Gift Card
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto bg-background sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Gift Card</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gift-card-code">Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="gift-card-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value.trim().toUpperCase())}
                  />
                  <Button type="button" variant="outline" onClick={() => setCode(generateGiftCode())}>
                    <RefreshCw className="h-4 w-4" />
                    Regenerate
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gift-card-value">Value</Label>
                <Input
                  id="gift-card-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gift-card-expiry">Expiry Date</Label>
                <Input
                  id="gift-card-expiry"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !code.trim() || !value}
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Gift Card
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Issued</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{giftCards.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatPrice(giftCards.reduce((sum, card) => sum + Number(card.balance || 0), 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Redeemed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {giftCards.filter((card) => !!card.redeemed_by).length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gift Card Inventory</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Initial Value</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Redeemed By</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {giftCards.map((card) => {
                  const redeemer = card.redeemed_by ? profileMap.get(card.redeemed_by) : null;

                  return (
                    <TableRow key={card.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{card.code}</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => copyGiftCardCode(card.code)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{formatPrice(Number(card.initial_value || 0))}</TableCell>
                      <TableCell>{formatPrice(Number(card.balance || 0))}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {redeemer?.name || redeemer?.email || (card.redeemed_by ? 'Redeemed' : '-')}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {card.expires_at ? format(new Date(card.expires_at), 'PP p') : 'No expiry'}
                      </TableCell>
                      <TableCell>
                        {card.redeemed_by ? (
                          <Badge variant="secondary">Redeemed</Badge>
                        ) : Number(card.balance || 0) > 0 ? (
                          <Badge>Available</Badge>
                        ) : (
                          <Badge variant="outline">Empty</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={card.is_active !== false}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({
                              id: card.id,
                              nextActive: checked,
                              cardCode: card.code,
                            })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {giftCards.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No gift cards created yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
