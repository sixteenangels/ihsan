import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wallet, Plus, Search, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useCreditWallet, useWalletTransactions } from '@/hooks/useWallet';
import { useCurrency } from '@/hooks/useCurrency';

export function AdminWallet() {
  const { formatPrice } = useCurrency();
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDescription, setCreditDescription] = useState('');
  const [open, setOpen] = useState(false);

  const creditMutation = useCreditWallet();

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-wallet-users', search],
    queryFn: async () => {
      let q = supabase.from('profiles').select('user_id, name, email').order('name');
      if (search.trim()) {
        q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      }
      const { data, error } = await q.limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: txs } = useWalletTransactions(selectedUserId || undefined);

  const handleCredit = async () => {
    if (!selectedUserId) return;
    const amt = parseFloat(creditAmount);
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!creditDescription.trim()) {
      toast.error('Add a description (e.g. shipping buffer refund for order ABC)');
      return;
    }
    try {
      await creditMutation.mutateAsync({
        user_id: selectedUserId,
        amount: amt,
        description: creditDescription.trim(),
      });
      toast.success('Wallet credited');
      setCreditAmount('');
      setCreditDescription('');
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to credit wallet');
    }
  };

  const balance = (txs || []).reduce((sum, t) => {
    return t.type === 'credit' ? sum + Number(t.amount) : sum - Number(t.amount);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-serif text-foreground flex items-center gap-2">
          <Wallet className="h-7 w-7 text-primary" />
          Customer Wallets
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Find a customer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Customers</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {(users || []).map((u) => (
                  <button
                    key={u.user_id}
                    onClick={() => setSelectedUserId(u.user_id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedUserId === u.user_id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <p className="font-medium text-foreground">{u.name || 'Unnamed'}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Wallet</CardTitle>
            {selectedUserId && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Credit Wallet
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Credit Wallet</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <Label>Amount (₵)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={creditAmount}
                        onChange={(e) => setCreditAmount(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={creditDescription}
                        onChange={(e) => setCreditDescription(e.target.value)}
                        placeholder="e.g. Shipping buffer refund for order IHS-..."
                        rows={3}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleCredit}
                      disabled={creditMutation.isPending}
                    >
                      {creditMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Credit Wallet
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            {!selectedUserId ? (
              <p className="text-muted-foreground text-sm">Select a customer to view their wallet.</p>
            ) : (
              <>
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 mb-4">
                  <p className="text-xs text-muted-foreground">Available Balance</p>
                  <p className="text-3xl font-bold text-primary">{formatPrice(Math.max(0, balance))}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Store credit only — cannot be withdrawn.
                  </p>
                </div>

                <h4 className="text-sm font-semibold mb-2">History</h4>
                {(txs || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No transactions yet.</p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {(txs || []).map((t) => (
                      <div key={t.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        {t.type === 'credit' ? (
                          <ArrowDownCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        ) : (
                          <ArrowUpCircle className="h-5 w-5 text-destructive mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <Badge variant={t.type === 'credit' ? 'default' : 'destructive'}>
                              {t.type === 'credit' ? '+' : '-'}
                              {formatPrice(Number(t.amount))}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(t.created_at), 'MMM d, yyyy')}
                            </span>
                          </div>
                          <p className="text-sm text-foreground mt-1">{t.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
