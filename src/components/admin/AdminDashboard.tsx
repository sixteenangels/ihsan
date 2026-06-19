import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, FolderTree, Users, ShoppingCart, AlertTriangle, Zap, TrendingUp, TrendingDown, DollarSign, Target, BellRing, ScrollText, ClipboardList, Factory, CheckSquare, ArrowRight, Phone, QrCode, PackageCheck, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCurrency } from '@/hooks/useCurrency';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { useMemo, useState } from 'react';
import { subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { formatStoreDate, formatStoreDateTimeCompact, formatStoreMonthShort } from '@/lib/date-utils';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { AFTER_SALES_CATEGORY, AFTER_SALES_SUPPORT_OPTIONS, getAfterSalesSupportLabel } from '@/lib/afterSalesSupport';
import { toast } from 'sonner';
import { buildGroupedAdminOrderCards } from '@/lib/groupBuyAdminOrders';

type OrderSummaryRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  | 'created_at'
  | 'group_buy_id'
  | 'id'
  | 'is_group_buy_master'
  | 'order_number'
  | 'parent_order_id'
  | 'status'
  | 'total_amount'
  | 'updated_at'
  | 'user_id'
>;
const ADMIN_PICK_PACK_ORDER_STATUSES = [
  'payment_received',
  'order_placed',
  'order_processed',
  'confirmed',
  'processing',
] as const;
type LowStockVariantRow = {
  id: string;
  stock: number | null;
  products: { name: string | null } | null;
};
type StockAlertRow = {
  id: string;
  created_at: string | null;
  product_id: string | null;
  product_variant_id: string | null;
  product_variants: {
    id: string;
    color: string | null;
    size: string | null;
  } | null;
  products: {
    name: string | null;
  } | null;
};
type PriceAlertRow = {
  id: string;
  created_at: string | null;
  product_id: string | null;
  target_price: number | null;
  products: {
    name: string | null;
    base_price: number | string | null;
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
type AfterSalesRequestRow = Pick<
  Database['public']['Tables']['support_requests']['Row'],
  'id' | 'status' | 'priority' | 'support_type' | 'category' | 'created_at'
>;
type PickPackOrderRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  | 'id'
  | 'order_number'
  | 'status'
  | 'created_at'
  | 'updated_at'
  | 'fulfillment_stage'
  | 'fulfillment_checks'
  | 'group_buy_id'
  | 'is_group_buy_master'
  | 'parent_order_id'
  | 'shipping_address'
  | 'total_amount'
  | 'user_id'
> & {
  order_items:
    | Array<{
        id: string;
        product_name: string;
        quantity: number;
      }>
    | null;
};

interface RestockReservationRow {
  id: string;
  product_id: string;
  product_name_snapshot: string;
  variant_label: string | null;
  desired_quantity: number;
  intent: string;
  customer_name: string;
  customer_email: string;
  status: string;
  priority: string;
  expected_restock_date: string | null;
  created_at: string;
}

interface PickPackShippingAddress {
  full_name?: string;
  phone?: string | null;
  city?: string;
}

type PickPackAction = 'picked' | 'quality_checked' | 'packed' | 'awaiting_dispatch' | 'dispatched';

const PICK_PACK_ACTIONS: Array<{ action: PickPackAction; label: string }> = [
  { action: 'picked', label: 'Pick' },
  { action: 'quality_checked', label: 'QC' },
  { action: 'packed', label: 'Pack' },
  { action: 'awaiting_dispatch', label: 'Stage' },
  { action: 'dispatched', label: 'Dispatch' },
];

function getPickPackNextAction(checks: Record<string, boolean> | null, status: string | null) {
  if (!checks?.picked) return 'Pick items';
  if (!checks?.quality_checked) return 'Quality check';
  if (!checks?.packed) return 'Pack order';
  if (!checks?.awaiting_dispatch) return 'Stage for dispatch';
  if (status === 'order_processed') return 'Hand to courier';
  return 'Review handoff';
}

export function AdminDashboard() {
  const queryClient = useQueryClient();
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const [scanCodeByOrder, setScanCodeByOrder] = useState<Record<string, string>>({});

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
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, status, total_amount, created_at, updated_at, group_buy_id, is_group_buy_master, parent_order_id, user_id')
        .order('created_at', { ascending: false });
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
          product_variant_id,
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

  const { data: priceAlerts = [] } = useQuery({
    queryKey: ['admin-price-alerts-demand'],
    queryFn: async (): Promise<PriceAlertRow[]> => {
      const { data, error } = await supabase
        .from('price_drop_alerts')
        .select(`
          id,
          created_at,
          product_id,
          target_price,
          products (
            name,
            base_price
          )
        `);

      if (error) throw error;
      return (data || []) as unknown as PriceAlertRow[];
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

  const { data: afterSalesRequests = [] } = useQuery({
    queryKey: ['admin-dashboard-after-sales'],
    queryFn: async (): Promise<AfterSalesRequestRow[]> => {
      const { data, error } = await supabase
        .from('support_requests')
        .select('id, status, priority, support_type, category, created_at')
        .eq('category', AFTER_SALES_CATEGORY)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return (data || []) as AfterSalesRequestRow[];
    },
  });

  const { data: pickPackOrders = [] } = useQuery({
    queryKey: ['admin-pick-pack-queue'],
    queryFn: async (): Promise<PickPackOrderRow[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          created_at,
          updated_at,
          fulfillment_stage,
          fulfillment_checks,
          group_buy_id,
          is_group_buy_master,
          parent_order_id,
          shipping_address,
          total_amount,
          user_id,
          order_items (
            id,
            product_name,
            quantity
          )
        `)
        .in('status', ADMIN_PICK_PACK_ORDER_STATUSES)
        .order('created_at', { ascending: true })
        .limit(40);

      if (error) throw error;
      return (data || []) as unknown as PickPackOrderRow[];
    },
  });

  const { data: restockReservations = [] } = useQuery({
    queryKey: ['admin-restock-reservations'],
    queryFn: async (): Promise<RestockReservationRow[]> => {
      const { data, error } = await supabase
        .from('restock_reservations' as never)
        .select(`
          id,
          product_id,
          product_name_snapshot,
          variant_label,
          desired_quantity,
          intent,
          customer_name,
          customer_email,
          status,
          priority,
          expected_restock_date,
          created_at
        `)
        .in('status', ['new', 'contacted', 'deposit_requested', 'reserved'])
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;
      return (data || []) as unknown as RestockReservationRow[];
    },
  });

  const updateRestockReservationMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('restock_reservations' as never)
        .update({ status, updated_at: new Date().toISOString() } as never)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-restock-reservations'] });
      toast.success('Restock reservation updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const groupedDashboardOrders = useMemo(
    () =>
      buildGroupedAdminOrderCards(orders || []).map((card) =>
        card.kind === 'group'
          ? {
              created_at: card.cluster.createdAt,
              status: card.cluster.status,
              total_amount: card.cluster.totalAmount,
            }
          : {
              created_at: card.order.created_at,
              status: card.order.status,
              total_amount: card.order.total_amount,
            },
      ),
    [orders],
  );

  const groupedPickPackCards = useMemo(
    () => buildGroupedAdminOrderCards(pickPackOrders || []),
    [pickPackOrders],
  );

  const pickPackActionMutation = useMutation({
    mutationFn: async ({
      orderId,
      action,
      scanCode,
    }: {
      orderId: string;
      action: PickPackAction;
      scanCode?: string;
    }) => {
      if (!user?.id) {
        throw new Error('You must be signed in to update the pick-and-pack queue.');
      }

      const order = pickPackOrders.find((entry) => entry.id === orderId);
      const currentChecks =
        order?.fulfillment_checks &&
        typeof order.fulfillment_checks === 'object' &&
        !Array.isArray(order.fulfillment_checks)
          ? (order.fulfillment_checks as Record<string, boolean>)
          : {};
      const nextChecks = { ...currentChecks, [action]: true };
      const nextStatus =
        action === 'awaiting_dispatch'
          ? 'order_processed'
          : action === 'dispatched'
            ? 'handed_to_courier'
            : undefined;
      const orderUpdate: Record<string, unknown> = {
        fulfillment_checks: nextChecks,
        fulfillment_stage: action,
        updated_at: new Date().toISOString(),
      };

      if (nextStatus) {
        orderUpdate.status = nextStatus;
      }

      const { error: orderError } = await supabase
        .from('orders')
        .update(orderUpdate as never)
        .eq('id', orderId);

      if (orderError) throw orderError;

      if (nextStatus && order?.is_group_buy_master && order.group_buy_id) {
        const { error: childStatusError } = await supabase
          .from('orders')
          .update({ status: nextStatus, updated_at: new Date().toISOString() } as never)
          .eq('group_buy_id', order.group_buy_id)
          .neq('id', orderId);

        if (childStatusError) throw childStatusError;

        const { data: childOrders, error: childOrdersError } = await supabase
          .from('orders')
          .select('id')
          .eq('group_buy_id', order.group_buy_id)
          .neq('id', orderId);

        if (childOrdersError) throw childOrdersError;

        if ((childOrders || []).length > 0) {
          const { error: trackingError } = await supabase.from('order_tracking').insert(
            (childOrders || []).map((childOrder) => ({
              order_id: childOrder.id,
              status: nextStatus,
              location_name:
                nextStatus === 'order_processed'
                  ? 'Order Processed'
                  : 'Handed to Courier',
              notes:
                nextStatus === 'order_processed'
                  ? 'Your order has been processed successfully and is ready for shipping.'
                  : 'Your package has been handed over to our delivery partner.',
            })) as never,
          );

          if (trackingError) throw trackingError;
        }
      }

      const trimmedScanCode = scanCode?.trim();
      const { error: scanError } = await supabase
        .from('pick_pack_scans' as never)
        .insert({
          order_id: orderId,
          admin_user_id: user.id,
          scan_code: trimmedScanCode || order?.order_number || orderId,
          scan_type: trimmedScanCode ? 'barcode' : 'manual',
          action,
        } as never);

      if (scanError) throw scanError;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-pick-pack-queue'] });
      setScanCodeByOrder((current) => ({ ...current, [variables.orderId]: '' }));
      toast.success('Pick-and-pack step saved');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const orderStats = useMemo(() => {
    if (groupedDashboardOrders.length === 0) {
      return { total: 0, paid: 0, delivered: 0, totalRevenue: 0 };
    }
    return {
      total: groupedDashboardOrders.length,
      paid: groupedDashboardOrders.filter((order) =>
        ['payment_received', 'order_placed', 'confirmed'].includes(order.status || ''),
      ).length,
      delivered: groupedDashboardOrders.filter((order) => order.status === 'delivered').length,
      totalRevenue: groupedDashboardOrders.reduce(
        (sum, order) => sum + Number(order.total_amount),
        0,
      ),
    };
  }, [groupedDashboardOrders]);

  const revenueProgress = revenueGoal ? Math.min((orderStats.totalRevenue / (revenueGoal as number)) * 100, 100) : 0;

  // Revenue by month (last 6 months)
  const revenueByMonth = useMemo(() => {
    if (groupedDashboardOrders.length === 0) return [];
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), 5 - i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      const monthOrders = groupedDashboardOrders.filter((order) => {
        const d = new Date(order.created_at);
        return d >= start && d <= end;
      });
      return {
        month: formatStoreMonthShort(date),
        revenue: monthOrders.reduce((sum, order) => sum + Number(order.total_amount), 0),
        orders: monthOrders.length,
      };
    });
    return months;
  }, [groupedDashboardOrders]);

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
      const key = `${alert.product_id}:${alert.product_variant_id || 'base'}`;
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

  const priceAlertDemand = useMemo(() => {
    const grouped = new Map<
      string,
      {
        key: string;
        name: string;
        count: number;
        currentPrice: number | null;
        lowestTargetPrice: number | null;
      }
    >();

    priceAlerts.forEach((alert) => {
      if (!alert.product_id) {
        return;
      }

      const currentPrice =
        alert.products?.base_price != null ? Number(alert.products.base_price) : null;
      const existing = grouped.get(alert.product_id);

      if (existing) {
        existing.count += 1;
        if (
          alert.target_price != null &&
          (existing.lowestTargetPrice == null || alert.target_price < existing.lowestTargetPrice)
        ) {
          existing.lowestTargetPrice = alert.target_price;
        }
      } else {
        grouped.set(alert.product_id, {
          key: alert.product_id,
          name: alert.products?.name || 'Unknown product',
          count: 1,
          currentPrice,
          lowestTargetPrice: alert.target_price,
        });
      }
    });

    return [...grouped.values()].sort((a, b) => b.count - a.count);
  }, [priceAlerts]);

  const purchasePlanningQueue = useMemo(() => {
    return procurementProducts
      .map((product) => {
        const activeVariants = (product.product_variants || []).filter((variant) => variant.is_active !== false);
        const totalStock = activeVariants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
        const lowStockVariants = activeVariants.filter((variant) => Number(variant.stock || 0) < 10).length;
        const demandCount = stockAlerts.filter((alert) => alert.product_id === product.id).length;
        const priceWatchCount = priceAlerts.filter((alert) => alert.product_id === product.id).length;
        const urgencyScore =
          demandCount * 3 +
          priceWatchCount * 2 +
          (lowStockVariants > 0 ? 8 : 0) +
          (totalStock === 0 ? 12 : 0);
        const suggestedReorderQty = Math.max(
          10,
          demandCount * 2 + priceWatchCount + lowStockVariants * 5 + (totalStock === 0 ? 10 : 0),
        );

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
          priceWatchCount,
          urgencyScore,
          suggestedReorderQty,
        };
      })
      .filter((product) => product.lowStockVariants > 0 || product.demandCount > 0)
      .sort((a, b) => b.urgencyScore - a.urgencyScore);
  }, [procurementProducts, stockAlerts, priceAlerts]);

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

  const pickPackQueue = useMemo(() => {
    return groupedPickPackCards
      .map((card) => {
        if (card.kind === 'group') {
          const controlOrder = card.cluster.masterOrder || card.cluster.primaryOrder;
          const checks =
            controlOrder.fulfillment_checks && typeof controlOrder.fulfillment_checks === 'object'
              ? (controlOrder.fulfillment_checks as Record<string, boolean>)
              : null;
          const deliverySource =
            card.cluster.childOrders[0] || card.cluster.primaryOrder;
          const shippingAddress =
            (deliverySource.shipping_address as unknown as PickPackShippingAddress | null) || null;
          const itemCount = card.cluster.childOrders
            .flatMap((order) => order.order_items || [])
            .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
          const ageHours = Math.max(
            1,
            Math.round((Date.now() - new Date(card.cluster.createdAt).getTime()) / (1000 * 60 * 60)),
          );

          return {
            id: controlOrder.id,
            orderNumber: `Group #${card.cluster.displayOrderNumber}`,
            status: card.cluster.status || 'pending',
            checks,
            totalAmount: Number(card.cluster.totalAmount || 0),
            recipientName: `${card.cluster.participantCount} participant group`,
            recipientPhone: shippingAddress?.phone || null,
            city: shippingAddress?.city || 'Multiple delivery addresses',
            itemCount,
            itemPreview: card.cluster.childOrders
              .flatMap((order) => order.order_items || [])
              .slice(0, 2)
              .map((item) => `${item.product_name} x${item.quantity}`)
              .join(', '),
            nextAction: getPickPackNextAction(checks, controlOrder.status),
            ageHours,
            isGroupOrder: true,
            participantCount: card.cluster.participantCount,
          };
        }

        const order = card.order;
        const checks =
          order.fulfillment_checks && typeof order.fulfillment_checks === 'object'
            ? (order.fulfillment_checks as Record<string, boolean>)
            : null;
        const shippingAddress =
          (order.shipping_address as unknown as PickPackShippingAddress | null) || null;
        const itemCount = (order.order_items || []).reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0,
        );
        const ageHours = Math.max(
          1,
          Math.round((Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60)),
        );

        return {
          id: order.id,
          orderNumber: order.order_number,
          status: order.status || 'pending',
          checks,
          totalAmount: Number(order.total_amount || 0),
          recipientName: shippingAddress?.full_name || 'Customer',
          recipientPhone: shippingAddress?.phone || null,
          city: shippingAddress?.city || 'Delivery address pending',
          itemCount,
          itemPreview: (order.order_items || [])
            .slice(0, 2)
            .map((item) => `${item.product_name} x${item.quantity}`)
            .join(', '),
          nextAction: getPickPackNextAction(checks, order.status),
          ageHours,
          isGroupOrder: false,
          participantCount: 0,
        };
      })
      .sort((left, right) => right.ageHours - left.ageHours);
  }, [groupedPickPackCards]);

  const stats = [
    { name: 'Total Products', value: productCount ?? 0, icon: Package, color: 'text-primary' },
    { name: 'Categories', value: categoryCount ?? 0, icon: FolderTree, color: 'text-accent-foreground' },
    { name: 'Active Group Buys', value: groupBuyCount ?? 0, icon: Users, color: 'text-primary' },
    { name: 'Total Orders', value: orderStats.total, icon: ShoppingCart, color: 'text-accent-foreground' },
  ];
  const afterSalesMetrics = useMemo(() => {
    const open = afterSalesRequests.filter((request) => request.status === 'new' || request.status === 'in_progress');
    const urgent = open.filter((request) => request.priority === 'urgent' || request.priority === 'high');
    const resolved = afterSalesRequests.filter((request) => request.status === 'resolved' || request.status === 'closed');

    return {
      total: afterSalesRequests.length,
      open: open.length,
      urgent: urgent.length,
      resolved: resolved.length,
    };
  }, [afterSalesRequests]);

  const afterSalesTypeCounts = useMemo(() => {
    return AFTER_SALES_SUPPORT_OPTIONS
      .map((option) => ({
        value: option.value,
        label: getAfterSalesSupportLabel(option.value),
        count: afterSalesRequests.filter((request) => request.support_type === option.value).length,
      }))
      .filter((item) => item.count > 0);
  }, [afterSalesRequests]);

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
            <CardTitle className="text-sm font-medium text-muted-foreground">Paid Orders</CardTitle>
            <TrendingUp className="h-5 w-5 text-accent-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{orderStats.paid}</p>
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Price Watchers</CardTitle>
            <TrendingDown className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{priceAlerts.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-8">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                After-Sales Desk
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Delivered-order issues grouped by need so the team can jump straight into the right queue.
              </p>
            </div>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to="/admin/support?category=After-Sales">
                Open Queue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Total requests</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{afterSalesMetrics.total}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Open now</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{afterSalesMetrics.open}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Priority queue</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{afterSalesMetrics.urgent}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Resolved</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{afterSalesMetrics.resolved}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {afterSalesTypeCounts.length > 0 ? (
                afterSalesTypeCounts.map((item) => (
                  <Button key={item.value} asChild variant="outline" size="sm" className="rounded-full">
                    <Link to={`/admin/support?category=${encodeURIComponent(AFTER_SALES_CATEGORY)}&type=${item.value}`}>
                      {item.label}
                      <Badge variant="secondary" className="ml-2">
                        {item.count}
                      </Badge>
                    </Link>
                  </Button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No after-sales requests yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
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
              <TrendingDown className="h-5 w-5 text-primary" />
              Price Watch Signals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
              <div>
                <p className="text-sm font-medium">Price Alert Subscribers</p>
                <p className="text-xs text-muted-foreground">Customers waiting for lower prices</p>
              </div>
              <p className="text-2xl font-bold">{priceAlerts.length}</p>
            </div>
            {priceAlertDemand.slice(0, 5).map((item) => (
              <div key={item.key} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Current price:{' '}
                      {item.currentPrice != null ? formatPrice(item.currentPrice) : 'Unavailable'}
                    </p>
                  </div>
                  <Badge>{item.count} watching</Badge>
                </div>
                {item.lowestTargetPrice != null && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Lowest target price: {formatPrice(item.lowestTargetPrice)}
                  </p>
                )}
              </div>
            ))}
            {priceAlertDemand.length === 0 && (
              <p className="text-sm text-muted-foreground">No price-watch demand yet.</p>
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
                    {formatStoreDateTimeCompact(log.created_at)}
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
                      {item.supplierName} - {item.supplierSku}
                    </p>
                  </div>
                  <Badge variant={item.totalStock === 0 ? 'destructive' : 'secondary'}>
                    {item.totalStock === 0 ? 'Out of stock' : `${item.totalStock} left`}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{item.lowStockVariants} low-stock variants</span>
                  <span>{item.demandCount} waiting alerts</span>
                  <span>{item.priceWatchCount} price watchers</span>
                  <span>Suggested reorder: {item.suggestedReorderQty}</span>
                </div>
                {item.expectedRestockDate && (
                  <p className="text-xs text-muted-foreground">
                    Expected restock: {formatStoreDate(item.expectedRestockDate)}
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

      <Card className="mb-8">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              Pick and Pack Mobile Queue
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              A compact queue for the next orders that should be picked, checked, and packed first.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/orders">
              Open Orders
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {pickPackQueue.slice(0, 6).map((order) => (
            <div
              key={order.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{order.orderNumber}</p>
                    {order.isGroupOrder ? (
                      <Badge variant="outline">Group Buy</Badge>
                    ) : null}
                    <Badge variant={order.ageHours >= 24 ? 'destructive' : 'secondary'}>
                      {order.ageHours >= 24 ? 'Needs attention' : `${order.ageHours}h in queue`}
                    </Badge>
                    <Badge variant="outline">{order.nextAction}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {order.recipientName} in {order.city}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {order.itemCount} item{order.itemCount === 1 ? '' : 's'} to process
                    {order.isGroupOrder ? ` across ${order.participantCount} participant orders` : ''}
                    {order.itemPreview ? ` - ${order.itemPreview}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {order.recipientPhone ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={`tel:${order.recipientPhone}`}>
                        <Phone className="h-4 w-4" />
                        Call
                      </a>
                    </Button>
                  ) : null}
                  <Button asChild size="sm">
                    <Link to="/admin/orders">
                      Process
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>Status: {order.status.replace(/_/g, ' ')}</span>
                <span>{formatPrice(order.totalAmount)}</span>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="relative">
                  <QrCode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={scanCodeByOrder[order.id] || ''}
                    onChange={(event) =>
                      setScanCodeByOrder((current) => ({
                        ...current,
                        [order.id]: event.target.value,
                      }))
                    }
                    placeholder="Scan or type barcode / QR code"
                    className="pl-9"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  {PICK_PACK_ACTIONS.map((step) => (
                    <Button
                      key={step.action}
                      size="sm"
                      variant={order.checks?.[step.action] ? 'secondary' : 'outline'}
                      disabled={order.checks?.[step.action] || pickPackActionMutation.isPending}
                      onClick={() =>
                        pickPackActionMutation.mutate({
                          orderId: order.id,
                          action: step.action,
                          scanCode: scanCodeByOrder[order.id],
                        })
                      }
                    >
                      <PackageCheck className="h-4 w-4" />
                      {order.checks?.[step.action] ? 'Done' : step.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {pickPackQueue.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No active pick-and-pack orders right now.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            Restock Reservation Queue
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Customers who want stock held, deposit follow-up, or restock priority.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {restockReservations.map((reservation) => (
            <div key={reservation.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{reservation.product_name_snapshot}</p>
                    {reservation.variant_label && (
                      <Badge variant="outline">{reservation.variant_label}</Badge>
                    )}
                    <Badge variant={reservation.priority === 'high' ? 'destructive' : 'secondary'}>
                      {reservation.priority === 'high' ? 'High intent' : 'Normal'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {reservation.customer_name} ({reservation.customer_email})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Qty {reservation.desired_quantity} | {reservation.intent.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Requested {formatStoreDateTimeCompact(reservation.created_at)}
                    {reservation.expected_restock_date
                      ? ` | Expected ${formatStoreDate(reservation.expected_restock_date)}`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['contacted', 'Contacted'],
                    ['deposit_requested', 'Deposit'],
                    ['reserved', 'Reserved'],
                    ['fulfilled', 'Fulfilled'],
                  ].map(([status, label]) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={reservation.status === status ? 'secondary' : 'outline'}
                      disabled={
                        reservation.status === status ||
                        updateRestockReservationMutation.isPending
                      }
                      onClick={() =>
                        updateRestockReservationMutation.mutate({
                          id: reservation.id,
                          status,
                        })
                      }
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {restockReservations.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No active restock reservations right now.
            </p>
          )}
        </CardContent>
      </Card>

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
