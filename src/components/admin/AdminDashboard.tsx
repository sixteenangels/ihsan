import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, FolderTree, Users, ShoppingCart, AlertTriangle, Zap, TrendingUp, DollarSign, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useCurrency } from '@/hooks/useCurrency';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { useMemo } from 'react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export function AdminDashboard() {
  const { formatPrice } = useCurrency();

  const { data: productCount } = useQuery({
    queryKey: ['admin-product-count'],
    queryFn: async () => {
      const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const { data: categoryCount } = useQuery({
    queryKey: ['admin-category-count'],
    queryFn: async () => {
      const { count } = await supabase.from('categories').select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const { data: groupBuyCount } = useQuery({
    queryKey: ['admin-groupbuy-count'],
    queryFn: async () => {
      const { count } = await supabase.from('group_buys').select('*', { count: 'exact', head: true }).eq('status', 'open');
      return count || 0;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ['admin-orders-dashboard'],
    queryFn: async () => {
      const { data } = await supabase.from('orders').select('status, total_amount, created_at');
      return data || [];
    },
  });

  const { data: lowStockProducts } = useQuery({
    queryKey: ['admin-low-stock'],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_variants')
        .select('id, stock, products(name)')
        .lt('stock', 10)
        .eq('is_active', true);
      return data || [];
    },
  });

  const { data: flashDealCount } = useQuery({
    queryKey: ['admin-flash-deals'],
    queryFn: async () => {
      const { count } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_flash_deal', true).eq('is_active', true);
      return count || 0;
    },
  });

  const { data: revenueGoal } = useQuery({
    queryKey: ['admin-revenue-goal'],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'revenue_goal')
        .maybeSingle();
      return (data?.value as number) || 50000;
    },
  });

  const orderStats = useMemo(() => {
    if (!orders) return { total: 0, pending: 0, delivered: 0, totalRevenue: 0 };
    return {
      total: orders.length,
      pending: orders.filter(o => o.status === 'pending').length,
      delivered: orders.filter(o => o.status === 'delivered').length,
      totalRevenue: orders.reduce((sum, o) => sum + Number(o.total_amount), 0),
    };
  }, [orders]);

  const revenueProgress = revenueGoal ? Math.min((orderStats.totalRevenue / (revenueGoal as number)) * 100, 100) : 0;

  // Revenue by month (last 6 months)
  const revenueByMonth = useMemo(() => {
    if (!orders) return [];
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), 5 - i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      const monthOrders = orders.filter(o => {
        const d = new Date(o.created_at);
        return d >= start && d <= end;
      });
      return {
        month: format(date, 'MMM'),
        revenue: monthOrders.reduce((sum, o) => sum + Number(o.total_amount), 0),
        orders: monthOrders.length,
      };
    });
    return months;
  }, [orders]);

  // Orders by status
  const ordersByStatus = useMemo(() => {
    if (!orders) return [];
    const statusCounts: Record<string, number> = {};
    orders.forEach(o => {
      statusCounts[o.status || 'pending'] = (statusCounts[o.status || 'pending'] || 0) + 1;
    });
    return Object.entries(statusCounts).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));
  }, [orders]);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

  const stats = [
    { name: 'Total Products', value: productCount ?? 0, icon: Package, color: 'text-primary' },
    { name: 'Categories', value: categoryCount ?? 0, icon: FolderTree, color: 'text-accent-foreground' },
    { name: 'Active Group Buys', value: groupBuyCount ?? 0, icon: Users, color: 'text-primary' },
    { name: 'Total Orders', value: orderStats.total, icon: ShoppingCart, color: 'text-accent-foreground' },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold font-serif text-foreground mb-8">Dashboard</h1>
      
      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.name}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue and Order Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{formatPrice(orderStats.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Orders</CardTitle>
            <TrendingUp className="h-5 w-5 text-accent-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{orderStats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Delivered Orders</CardTitle>
            <ShoppingCart className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{orderStats.delivered}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `₵${v}`} />
                <Tooltip formatter={(value: number) => formatPrice(value)} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Orders by Month */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Orders by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Orders by Status Pie */}
      {ordersByStatus.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Orders by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center gap-8">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={ordersByStatus} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                    {ordersByStatus.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue Goal + Flash Deals & Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue Goal</CardTitle>
            <Target className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-foreground mb-2">
              {formatPrice(orderStats.totalRevenue)} / {formatPrice(revenueGoal as number || 50000)}
            </p>
            <Progress value={revenueProgress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">{revenueProgress.toFixed(1)}% of monthly target</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Flash Deals Running</CardTitle>
            <Zap className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{flashDealCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Alerts</CardTitle>
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{lowStockProducts?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Items */}
      {lowStockProducts && lowStockProducts.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Low Stock Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockProducts.slice(0, 5).map((variant: any) => (
                <div key={variant.id} className="flex items-center justify-between p-2 rounded-lg bg-muted">
                  <span className="text-sm text-foreground">{variant.products?.name || 'Unknown Product'}</span>
                  <Badge variant={variant.stock === 0 ? 'destructive' : 'secondary'}>
                    {variant.stock} in stock
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
