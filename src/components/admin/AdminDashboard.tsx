import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, FolderTree, Users, ShoppingCart, AlertTriangle, Zap, TrendingUp, DollarSign, Target, BellRing, ScrollText, ClipboardList, Factory } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useCurrency } from '@/hooks/useCurrency';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { useMemo } from 'react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type OrderSummaryRow = Pick<Database['public']['Tables']['orders']['Row'], 'status' | 'total_amount' | 'created_at'>;
type LowStockVariantRow = {
  id: string;
  stock: number | null;
  products: { name: string | null } | null;
};
type StockAlertRow = {
  id: string;
  created_at: string | null;
  product_id: string | null;
  variant_id: string | null;
  product_variants: {
    id: string;
    color: string | null;
    size: string | null;
  } | null;
  products: {
    name: string | null;
  } | null;
};
type ProcurementProductRow = {
  id: string;
  name: string;
  supplier_name: string | null;
  supplier_sku: string | null;
  procurement_notes: string | null;
  expected_restock_date: string | null;
  is_active: boolean | null;
  product_variants: Array<{
    id: string;
    stock: number | null;
    is_active: boolean | null;
  }> | null;
};
type AuditLogSummaryRow = {
  id: string;
  action: string;
  summary: string;
  created_at: string;
};

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
    queryFn: async (): Promise<OrderSummaryRow[]> => {
      const { data } = await supabase.from('orders').select('status, total_amount, created_at');
      return data || [];
    },
  });

  const { data: lowStockProducts } = useQuery({
    queryKey: ['admin-low-stock'],
    queryFn: async (): Promise<LowStockVariantRow[]> => {
      const { data } = await supabase
        .from('product_variants')
        .select('id, stock, products(name)')
        .lt('stock', 10)
        .eq('is_active', true);
      return (data || []) as LowStockVariantRow[];
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

  const { data: stockAlerts = [] } = useQuery({
    queryKey: ['admin-stock-alerts-demand'],
    queryFn: async (): Promise<StockAlertRow[]> => {
      const { data, error } = await supabase
        .from('stock_alerts' as never)
        .select(`
          id,
          created_at,
          product_id,
          variant_id,
          product_variants (
            id,
            color,
            size
          ),
          products (
            name
          )
        `);

      if (error) throw error;
      return (data || []) as unknown as StockAlertRow[];
    },
  });

  const { data: procurementProducts = [] } = useQuery({
    queryKey: ['admin-procurement-products'],
    queryFn: async (): Promise<ProcurementProductRow[]> => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          supplier_name,
          supplier_sku,
          procurement_notes,
          expected_restock_date,
          is_active,
          product_variants (
            id,
            stock,
            is_active
          )
        `)
        .eq('is_active', true);

      if (error) throw error;
      return (data || []) as unknown as ProcurementProductRow[];
    },
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['admin-dashboard-audit-logs'],
    queryFn: async (): Promise<AuditLogSummaryRow[]> => {
      const { data, error } = await supabase
        .from('audit_logs' as never)
        .select('id, action, summary, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return (data || []) as unknown as AuditLogSummaryRow[];
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

  const alertDemand = useMemo(() => {
    const grouped = new Map<string, { key: string; name: string; variant: string; count: number }>();

    stockAlerts.forEach((alert) => {
      const variantLabel = [alert.product_variants?.color, alert.product_variants?.size]
        .filter(Boolean)
        .join(' / ');
      const key = `${alert.product_id}:${alert.variant_id || 'base'}`;
      const existing = grouped.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        grouped.set(key, {
          key,
          name: alert.products?.name || 'Unknown product',
          variant: variantLabel,
          count: 1,
        });
      }
    });

    return [...grouped.values()].sort((a, b) => b.count - a.count);
  }, [stockAlerts]);

  const purchasePlanningQueue = useMemo(() => {
    return procurementProducts
      .map((product) => {
        const activeVariants = (product.product_variants || []).filter((variant) => variant.is_active !== false);
        const totalStock = activeVariants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
        const lowStockVariants = activeVariants.filter((variant) => Number(variant.stock || 0) < 10).length;
        const demandCount = stockAlerts.filter((alert) => alert.product_id === product.id).length;
        const urgencyScore = demandCount * 3 + (lowStockVariants > 0 ? 8 : 0) + (totalStock === 0 ? 12 : 0);
        const suggestedReorderQty = Math.max(10, demandCount * 2 + lowStockVariants * 5 + (totalStock === 0 ? 10 : 0));

        return {
          id: product.id,
          name: product.name,
          supplierName: product.supplier_name || 'Supplier not set',
          supplierSku: product.supplier_sku || 'No supplier SKU',
          procurementNotes: product.procurement_notes || '',
          expectedRestockDate: product.expected_restock_date || null,
          totalStock,
          lowStockVariants,
          demandCount,
          urgencyScore,
          suggestedReorderQty,
        };
      })
      .filter((product) => product.lowStockVariants > 0 || product.demandCount > 0)
      .sort((a, b) => b.urgencyScore - a.urgencyScore);
  }, [procurementProducts, stockAlerts]);

  const supplierCoverage = useMemo(() => {
    const mapped = new Map<string, { supplierName: string; productCount: number; urgentCount: number }>();

    purchasePlanningQueue.forEach((item) => {
      const current = mapped.get(item.supplierName);
      if (current) {
        current.productCount += 1;
        if (item.urgencyScore >= 12) {
          current.urgentCount += 1;
        }
      } else {
        mapped.set(item.supplierName, {
          supplierName: item.supplierName,
          productCount: 1,
          urgentCount: item.urgencyScore >= 12 ? 1 : 0,
        });
      }
    });

    return [...mapped.values()].sort((a, b) => b.urgentCount - a.urgentCount || b.productCount - a.productCount);
  }, [purchasePlanningQueue]);

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-primary" />
              Restock Demand
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
              <div>
                <p className="text-sm font-medium">Subscribers Waiting</p>
                <p className="text-xs text-muted-foreground">Customers asking for stock alerts</p>
              </div>
              <p className="text-2xl font-bold">{stockAlerts.length}</p>
            </div>
            {alertDemand.slice(0, 5).map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.variant || 'Any variant'}</p>
                </div>
                <Badge>{item.count} waiting</Badge>
              </div>
            ))}
            {alertDemand.length === 0 && (
              <p className="text-sm text-muted-foreground">No restock demand yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-primary" />
              Latest Admin Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="outline">{log.action}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(log.created_at), 'MMM d, p')}
                  </span>
                </div>
                <p className="mt-2 text-sm text-foreground">{log.summary}</p>
              </div>
            ))}
            {auditLogs.length === 0 && (
              <p className="text-sm text-muted-foreground">No audit entries yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Purchase Planning Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
              <div>
                <p className="text-sm font-medium">Reorder Candidates</p>
                <p className="text-xs text-muted-foreground">Products with demand or low stock pressure</p>
              </div>
              <p className="text-2xl font-bold">{purchasePlanningQueue.length}</p>
            </div>
            {purchasePlanningQueue.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.supplierName} • {item.supplierSku}
                    </p>
                  </div>
                  <Badge variant={item.totalStock === 0 ? 'destructive' : 'secondary'}>
                    {item.totalStock === 0 ? 'Out of stock' : `${item.totalStock} left`}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{item.lowStockVariants} low-stock variants</span>
                  <span>{item.demandCount} waiting alerts</span>
                  <span>Suggested reorder: {item.suggestedReorderQty}</span>
                </div>
                {item.expectedRestockDate && (
                  <p className="text-xs text-muted-foreground">
                    Expected restock: {format(new Date(item.expectedRestockDate), 'MMM d, yyyy')}
                  </p>
                )}
                {item.procurementNotes && (
                  <p className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {item.procurementNotes}
                  </p>
                )}
              </div>
            ))}
            {purchasePlanningQueue.length === 0 && (
              <p className="text-sm text-muted-foreground">No procurement actions needed right now.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5 text-primary" />
              Supplier Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
              <div>
                <p className="text-sm font-medium">Active Suppliers in Queue</p>
                <p className="text-xs text-muted-foreground">Who needs a reorder follow-up next</p>
              </div>
              <p className="text-2xl font-bold">{supplierCoverage.length}</p>
            </div>
            {supplierCoverage.slice(0, 6).map((supplier) => (
              <div key={supplier.supplierName} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium text-foreground">{supplier.supplierName}</p>
                  <p className="text-xs text-muted-foreground">
                    {supplier.productCount} products in queue
                  </p>
                </div>
                <Badge variant={supplier.urgentCount > 0 ? 'destructive' : 'secondary'}>
                  {supplier.urgentCount > 0 ? `${supplier.urgentCount} urgent` : 'Stable'}
                </Badge>
              </div>
            ))}
            {supplierCoverage.length === 0 && (
              <p className="text-sm text-muted-foreground">No supplier planning data yet.</p>
            )}
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
              {lowStockProducts.slice(0, 5).map((variant) => (
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
