import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Crown, Medal, Star } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';

export function CustomerLeaderboard() {
  const { formatPrice } = useCurrency();

  const { data: topCustomers, isLoading } = useQuery({
    queryKey: ['admin-customer-leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('user_id, total_amount');

      if (error) throw error;

      // Aggregate by user
      const userTotals: Record<string, { total: number; count: number }> = {};
      (data || []).forEach((order) => {
        if (!userTotals[order.user_id]) {
          userTotals[order.user_id] = { total: 0, count: 0 };
        }
        userTotals[order.user_id].total += Number(order.total_amount);
        userTotals[order.user_id].count += 1;
      });

      const userIds = Object.keys(userTotals);
      if (userIds.length === 0) return [];

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p) => { profileMap[p.user_id] = p; });

      return userIds
        .map((uid) => ({
          user_id: uid,
          name: profileMap[uid]?.name || profileMap[uid]?.email || 'Unknown',
          email: profileMap[uid]?.email || '',
          total_spent: userTotals[uid].total,
          order_count: userTotals[uid].count,
        }))
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, 20);
    },
  });

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Medal className="h-5 w-5 text-amber-600" />;
    return <Star className="h-4 w-4 text-muted-foreground" />;
  };

  const getVipBadge = (total: number) => {
    if (total >= 10000) return <Badge className="bg-yellow-500/20 text-yellow-700">VIP Gold</Badge>;
    if (total >= 5000) return <Badge className="bg-gray-300/20 text-gray-600">VIP Silver</Badge>;
    if (total >= 2000) return <Badge className="bg-amber-600/20 text-amber-700">VIP Bronze</Badge>;
    return null;
  };

  return (
    <div>
      <h1 className="text-3xl font-bold font-serif text-foreground mb-8 flex items-center gap-3">
        <Trophy className="h-7 w-7 text-primary" />
        Customer Leaderboard
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Top Customers by Total Spend</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : !topCustomers?.length ? (
            <p className="text-muted-foreground text-center py-8">No orders yet</p>
          ) : (
            <div className="space-y-3">
              {topCustomers.map((customer, index) => (
                <div
                  key={customer.user_id}
                  className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                    index < 3 ? 'bg-primary/5 border border-primary/10' : 'bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8">
                      {index < 3 ? getRankIcon(index) : (
                        <span className="text-sm font-bold text-muted-foreground">#{index + 1}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">{customer.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {getVipBadge(customer.total_spent)}
                    <div className="text-right">
                      <p className="font-bold text-foreground">{formatPrice(customer.total_spent)}</p>
                      <p className="text-xs text-muted-foreground">{customer.order_count} orders</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
