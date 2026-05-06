import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, Award, Users, TrendingUp, TrendingDown, Gift, Cake } from 'lucide-react';
import { format } from 'date-fns';

export function AdminLoyalty() {
  const queryClient = useQueryClient();
  const [awardDialog, setAwardDialog] = useState(false);
  const [bdayDialog, setBdayDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [awardType, setAwardType] = useState<'earn' | 'redeem'>('earn');
  const [awardPoints, setAwardPoints] = useState('');
  const [awardReason, setAwardReason] = useState('');
  const [bdayDiscount, setBdayDiscount] = useState('10');
  const [bdayMaxUses, setBdayMaxUses] = useState('1');
  const [bdayExpiryDays, setBdayExpiryDays] = useState('30');

  // All loyalty points
  const { data: allPoints = [], isLoading } = useQuery({
    queryKey: ['admin-loyalty-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_points')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  // Profiles for customer names
  const { data: profiles = [] } = useQuery({
    queryKey: ['admin-profiles-loyalty'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, name, email');
      return data || [];
    },
  });

  const profileMap = new Map(profiles.map(p => [p.user_id, p]));

  // Compute stats
  const totalIssued = allPoints.filter(p => p.type === 'earn').reduce((s, p) => s + p.points, 0);
  const totalRedeemed = allPoints.filter(p => p.type === 'redeem').reduce((s, p) => s + p.points, 0);

  // Customer balances
  const balanceMap = new Map<string, number>();
  allPoints.forEach(p => {
    const cur = balanceMap.get(p.user_id) || 0;
    balanceMap.set(p.user_id, p.type === 'earn' ? cur + p.points : cur - p.points);
  });
  const activeMembers = [...balanceMap.values()].filter(b => b > 0).length;

  const customerRanking = [...balanceMap.entries()]
    .map(([uid, balance]) => ({ uid, balance, profile: profileMap.get(uid) }))
    .sort((a, b) => b.balance - a.balance);

  // Award/deduct mutation
  const awardMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId || !awardPoints || !awardReason) throw new Error('Fill all fields');
      const { error } = await supabase.from('loyalty_points').insert({
        user_id: selectedUserId,
        points: parseInt(awardPoints),
        type: awardType,
        description: awardReason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-loyalty-all'] });
      toast.success(`Points ${awardType === 'earn' ? 'awarded' : 'deducted'}`);
      setAwardDialog(false);
      setSelectedUserId('');
      setAwardPoints('');
      setAwardReason('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Birthday coupons mutation
  const bdayMutation = useMutation({
    mutationFn: async () => {
      const today = new Date();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const year = today.getFullYear();

      // Get all profiles with birthday today (month-day match)
      const { data: allProfiles } = await supabase.from('profiles').select('user_id, name, birthday');
      const birthdayUsers = (allProfiles || []).filter(p => {
        if (!p.birthday) return false;
        const bd = p.birthday; // "YYYY-MM-DD"
        return bd.slice(5, 7) === mm && bd.slice(8, 10) === dd;
      });

      if (birthdayUsers.length === 0) {
        toast.info('No customers with a birthday today');
        return;
      }

      let created = 0;
      for (const u of birthdayUsers) {
        const code = `BDAY-${u.user_id.slice(0, 6).toUpperCase()}-${year}`;
        
        // Skip if already created this year
        const { data: existing } = await supabase
          .from('coupons')
          .select('id')
          .eq('code', code)
          .maybeSingle();
        if (existing) continue;

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(bdayExpiryDays));

        await supabase.from('coupons').insert({
          code,
          type: 'percentage' as const,
          value: parseFloat(bdayDiscount),
          max_uses: parseInt(bdayMaxUses),
          expires_at: expiresAt.toISOString(),
          is_active: true,
        });

        await supabase.from('notifications').insert({
          user_id: u.user_id,
          title: '🎂 Happy Birthday!',
          message: `Here's a ${bdayDiscount}% birthday coupon just for you! Use code: ${code}`,
          type: 'promotion',
        });

        created++;
      }

      toast.success(`${created} birthday coupon(s) created and sent!`);
    },
    onSuccess: () => {
      setBdayDialog(false);
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-serif text-foreground">Loyalty Programme</h1>
        <div className="flex gap-2">
          <Dialog open={bdayDialog} onOpenChange={setBdayDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Cake className="h-4 w-4 mr-2" />
                Birthday Coupons
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Birthday Coupons</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Create a unique coupon for every customer whose birthday is today. Skips anyone who already received one this year.
              </p>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Discount %</Label>
                  <Input type="number" value={bdayDiscount} onChange={e => setBdayDiscount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Max Uses Per Coupon</Label>
                  <Input type="number" value={bdayMaxUses} onChange={e => setBdayMaxUses(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Valid For (days)</Label>
                  <Input type="number" value={bdayExpiryDays} onChange={e => setBdayExpiryDays(e.target.value)} />
                </div>
                <Button onClick={() => bdayMutation.mutate()} disabled={bdayMutation.isPending} className="w-full">
                  {bdayMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Cake className="h-4 w-4 mr-2" />}
                  Send Birthday Coupons
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={awardDialog} onOpenChange={setAwardDialog}>
            <DialogTrigger asChild>
              <Button>
                <Award className="h-4 w-4 mr-2" />
                Award / Deduct Points
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Award / Deduct Points</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      {profiles.map(p => (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          {p.name || p.email || p.user_id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select value={awardType} onValueChange={(v) => setAwardType(v as 'earn' | 'redeem')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="earn">Award Points</SelectItem>
                      <SelectItem value="redeem">Deduct Points</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Points</Label>
                  <Input type="number" value={awardPoints} onChange={e => setAwardPoints(e.target.value)} placeholder="100" />
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input value={awardReason} onChange={e => setAwardReason(e.target.value)} placeholder="Manual adjustment" />
                </div>
                <Button onClick={() => awardMutation.mutate()} disabled={awardMutation.isPending || !selectedUserId || !awardPoints || !awardReason} className="w-full">
                  {awardMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {awardType === 'earn' ? 'Award' : 'Deduct'} Points
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Issued</CardTitle>
            <TrendingUp className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{totalIssued.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Redeemed</CardTitle>
            <TrendingDown className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{totalRedeemed.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Members</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{activeMembers}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers">Customer Points</TabsTrigger>
          <TabsTrigger value="log">Transaction Log</TabsTrigger>
        </TabsList>

        <TabsContent value="customers">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Points Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerRanking.map((c, i) => (
                    <TableRow key={c.uid}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{c.profile?.name || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{c.profile?.email || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={c.balance > 0 ? 'default' : 'secondary'}>{c.balance.toLocaleString()}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {customerRanking.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No loyalty activity yet</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="log">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allPoints.map(p => {
                    const profile = profileMap.get(p.user_id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{profile?.name || profile?.email || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{p.description}</TableCell>
                        <TableCell className="text-right">
                          <span className={p.type === 'earn' ? 'text-green-600' : 'text-destructive'}>
                            {p.type === 'earn' ? '+' : '-'}{p.points}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{format(new Date(p.created_at), 'PP p')}</TableCell>
                      </TableRow>
                    );
                  })}
                  {allPoints.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No transactions yet</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
