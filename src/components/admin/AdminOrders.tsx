import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Loader2, Eye, MapPin, Package, Calendar, CreditCard, ShoppingBag, PackageCheck, Truck, Plane, MapPinned, Home, CheckCircle, XCircle, RotateCcw, Search, Download, StickyNote, CheckSquare, BellRing, MessageSquare, Plus, ChevronDown, type LucideIcon } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { useCurrency } from '@/hooks/useCurrency';
import { useMessageTemplates, useSaveTemplate } from '@/hooks/useMessageTemplates';
import { SwipeableOrderCard } from './SwipeableOrderCard';
import { SwipeHintOverlay } from './SwipeHintOverlay';
import { useAuth } from '@/contexts/AuthContext';
import type { Database, Json } from '@/integrations/supabase/types';
import { useDocumentVisibility } from '@/hooks/useDocumentVisibility';
import { logAdminAction } from '@/lib/audit-log';
import {
  generateProofVerificationCode,
  getProofOfDeliverySignedUrl,
  normalizeProofOfDeliveryPath,
  uploadProofOfDelivery,
} from '@/lib/proof-of-delivery';
import { creditWalletByAdmin } from '@/lib/wallet';
import {
  buildGroupedAdminOrderCards,
  type GroupedAdminOrderCard,
  type GroupOrderCluster,
} from '@/lib/groupBuyAdminOrders';
import {
  buildDeliveryWindowEmailHtml,
  buildDeliveryWindowEmailSubject,
  buildDeliveryWindowEmailText,
  buildOrderStatusEmailHtml,
  buildOrderStatusEmailSubject,
  buildOrderStatusEmailText,
  buildRefundEmailHtml,
  buildRefundEmailSubject,
  buildRefundEmailText,
} from '@/lib/email-templates';
import { GroupBuyParticipantList } from '@/components/groupbuy/GroupBuyParticipantList';

const ORDER_STATUSES = [
  'pending',
  'payment_received',
  'order_placed',
  'order_processed',
  'confirmed',
  'processing',
  'packed_for_delivery',
  'shipped',
  'in_transit',
  'in_ghana',
  'ready_for_delivery',
  'handed_to_courier',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'refunded',
] as const;

type OrderStatus = typeof ORDER_STATUSES[number];
const ADMIN_VISIBLE_ORDER_STATUSES: OrderStatus[] = ORDER_STATUSES.filter(
  (status): status is OrderStatus => status !== 'pending',
);
type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];
type OrderTrackingRow = Database['public']['Tables']['order_tracking']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ProductImageRow = Database['public']['Tables']['product_images']['Row'];
type ProductVariantRow = Database['public']['Tables']['product_variants']['Row'];
type RefundRequestRow = Database['public']['Tables']['refund_requests']['Row'];

interface ShippingAddress {
  full_name?: string;
  address_line1?: string;
  address_line2?: string | null;
  city?: string;
  state?: string | null;
  postal_code?: string | null;
  country?: string;
  phone?: string | null;
}

interface FulfillmentChecks {
  picked?: boolean;
  quality_checked?: boolean;
  packed?: boolean;
  awaiting_dispatch?: boolean;
}

type AdminOrder = OrderRow & {
  order_items: Array<OrderItemRow & { image_url: string | null }>;
  order_tracking: OrderTrackingRow[];
  profiles: Pick<ProfileRow, 'user_id' | 'name' | 'email'> | null;
  refund_request: RefundRequestRow | null;
};

type OrderCard = GroupedAdminOrderCard<AdminOrder>;

type RefundChannel = 'original_payment' | 'wallet_credit' | 'mixed';

const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  'payment_received',
  'confirmed',
  'order_placed',
  'order_processed',
  'shipped',
  'in_transit',
  'in_ghana',
  'processing',
  'ready_for_delivery',
  'handed_to_courier',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'refunded',
];

interface StatusTabConfig {
  value: string;
  label: string;
  icon: LucideIcon;
  statuses: OrderStatus[];
}

const STATUS_TABS: StatusTabConfig[] = [
  { value: 'all', label: 'All Orders', icon: Package, statuses: ADMIN_VISIBLE_ORDER_STATUSES },
  { value: 'payment_received', label: 'Payment Received', icon: CreditCard, statuses: ['payment_received'] },
  { value: 'order_placed', label: 'Order Placed', icon: ShoppingBag, statuses: ['order_placed'] },
  { value: 'packed_for_delivery', label: 'Packed', icon: PackageCheck, statuses: ['packed_for_delivery'] },
  { value: 'in_transit', label: 'In Transit', icon: Truck, statuses: ['in_transit'] },
  { value: 'in_ghana', label: 'In Ghana', icon: Plane, statuses: ['in_ghana'] },
  { value: 'ready_for_delivery', label: 'Ready for Delivery', icon: MapPinned, statuses: ['ready_for_delivery'] },
  { value: 'delivered', label: 'Delivered', icon: CheckCircle, statuses: ['delivered'] },
  { value: 'cancelled', label: 'Cancelled/Refunded', icon: XCircle, statuses: ['cancelled', 'refunded'] },
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  payment_received: 'Payment Received',
  order_placed: 'Order Placed',
  order_processed: 'Order Processed',
  confirmed: 'Confirmed',
  processing: 'Processing',
  packed_for_delivery: 'Packed for Delivery',
  shipped: 'Shipped',
  in_transit: 'In Transit',
  in_ghana: 'In Ghana',
  ready_for_delivery: 'Ready for Delivery',
  handed_to_courier: 'Handed to Courier',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const STANDARD_CHECKPOINTS = [
  { key: 'payment_received', label: 'Payment' },
  { key: 'order_placed', label: 'Ordered' },
  { key: 'packed_for_delivery', label: 'Packed' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'in_ghana', label: 'In Ghana' },
  { key: 'ready_for_delivery', label: 'Ready' },
  { key: 'delivered', label: 'Delivered' },
] as const;

const COURIER_CHECKPOINTS = [
  { key: 'payment_received', label: 'Payment' },
  { key: 'order_processed', label: 'Processed' },
  { key: 'handed_to_courier', label: 'Courier' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
] as const;

const ORDER_FLOW_STATUSES: OrderStatus[] = [
  'pending',
  'payment_received',
  'order_placed',
  'order_processed',
  'confirmed',
  'processing',
  'packed_for_delivery',
  'shipped',
  'in_transit',
  'in_ghana',
  'ready_for_delivery',
  'handed_to_courier',
  'out_for_delivery',
  'delivered',
];

function getCheckpointsForOrder(status: string) {
  return ['order_processed', 'handed_to_courier', 'out_for_delivery'].includes(status)
    ? COURIER_CHECKPOINTS
    : STANDARD_CHECKPOINTS;
}

function getProgressPercentage(status: string, checkpoints: typeof STANDARD_CHECKPOINTS | typeof COURIER_CHECKPOINTS) {
  const keys = checkpoints.map((checkpoint) => checkpoint.key);
  const idx = keys.indexOf(status);
  if (idx >= 0) {
    return Math.round(((idx + 1) / keys.length) * 100);
  }

  const orderIdx = ORDER_FLOW_STATUSES.indexOf(status as OrderStatus);
  if (orderIdx < 0) {
    return 0;
  }

  for (let i = keys.length - 1; i >= 0; i -= 1) {
    if (ORDER_FLOW_STATUSES.indexOf(keys[i] as OrderStatus) <= orderIdx) {
      return Math.round(((i + 1) / keys.length) * 100);
    }
  }

  return 0;
}

function getCheckpointStatus(
  orderStatus: string,
  checkpointKey: string,
  checkpoints: typeof STANDARD_CHECKPOINTS | typeof COURIER_CHECKPOINTS,
): 'done' | 'current' | 'pending' {
  const orderIdx = ORDER_FLOW_STATUSES.indexOf(orderStatus as OrderStatus);
  const checkIdx = ORDER_FLOW_STATUSES.indexOf(checkpointKey as OrderStatus);

  if (checkIdx < 0 || orderIdx < 0) {
    return 'pending';
  }

  if (orderIdx >= checkIdx) {
    return 'done';
  }

  const keys = checkpoints.map((checkpoint) => checkpoint.key);
  const currentCheckpointIndex = keys.findIndex(
    (key) => ORDER_FLOW_STATUSES.indexOf(key as OrderStatus) > orderIdx,
  );

  if (currentCheckpointIndex >= 0 && keys[currentCheckpointIndex] === checkpointKey) {
    return 'current';
  }

  return 'pending';
}

function getAutoNote(status: string, productName: string) {
  switch (status) {
    case 'payment_received':
      return `We've received payment for "${productName}".`;
    case 'order_placed':
      return `The order for "${productName}" has been placed successfully.`;
    case 'order_processed':
      return 'Item verified and prepared for courier pickup.';
    case 'confirmed':
      return 'The order is confirmed and queued for fulfillment.';
    case 'processing':
      return 'The order is currently being processed.';
    case 'packed_for_delivery':
      return 'The order has been packed and is ready to ship.';
    case 'shipped':
      return 'The order has been shipped.';
    case 'in_transit':
      return 'The order is currently in transit.';
    case 'in_ghana':
      return 'The shipment has arrived in Ghana.';
    case 'ready_for_delivery':
      return 'The order is ready for final delivery.';
    case 'handed_to_courier':
      return 'Courier has picked up the package.';
    case 'out_for_delivery':
      return 'The order is out for delivery.';
    case 'delivered':
      return 'The order has been delivered.';
    case 'cancelled':
      return 'The order has been cancelled.';
    case 'refunded':
      return 'The order has been refunded.';
    default:
      return '';
  }
}

function AdminOrderThumbnail({
  imageUrl,
  alt,
}: {
  imageUrl?: string | null;
  alt: string;
}) {
  return (
    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <Package className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}

function getSuggestedRefundWalletCredit(order: AdminOrder) {
  const shipping = Number(order.shipping_price || 0);
  const packaging = Number(order.packaging_cost || 0);
  const requestedAmount = Number(order.refund_request?.refund_amount || order.total_amount || 0);
  return Math.max(0, Math.min(requestedAmount, shipping + packaging));
}

function getRefundStatusLabel(status: string) {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'processed':
      return 'Processed';
    default:
      return status.replaceAll('_', ' ');
  }
}

export function AdminOrders() {
  const queryClient = useQueryClient();
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const { data: templates = [] } = useMessageTemplates();
  const saveTemplateMutation = useSaveTemplate();
  const proofUploadInputRef = useRef<HTMLInputElement | null>(null);
  const isDocumentVisible = useDocumentVisibility();
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [trackingLocation, setTrackingLocation] = useState({ lat: '', lng: '', location: '', notes: '', courierName: '', courierTrackingNumber: '', deliveryFee: '' });
  const [deliveryDates, setDeliveryDates] = useState<{ orderId: string; start: string; end: string }>({ orderId: '', start: '', end: '' });
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [statusNotes, setStatusNotes] = useState<Record<string, string>>({});
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [selectedFulfillmentOrder, setSelectedFulfillmentOrder] = useState<AdminOrder | null>(null);
  const [selectedRefundOrder, setSelectedRefundOrder] = useState<AdminOrder | null>(null);
  const [refundDraft, setRefundDraft] = useState<{
    refundChannel: RefundChannel;
    walletCreditAmount: string;
    adminNotes: string;
  }>({
    refundChannel: 'original_payment',
    walletCreditAmount: '',
    adminNotes: '',
  });
  const [fulfillmentDraft, setFulfillmentDraft] = useState({
    stage: 'new',
    picked: false,
    quality_checked: false,
    packed: false,
    awaiting_dispatch: false,
    courierName: '',
    courierTrackingNumber: '',
    deliveryFee: '',
    proofNote: '',
    proofImageUrl: '',
    recipientName: '',
    recipientPhone: '',
    recipientRelationship: '',
    signatureName: '',
    verificationCode: '',
    courierConfirmed: false,
  });
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [proofImagePreviewUrl, setProofImagePreviewUrl] = useState('');

  const getShippingAddress = useCallback((address: Json | null): ShippingAddress | null => {
    if (!address || typeof address !== 'object' || Array.isArray(address)) {
      return null;
    }

    return address as ShippingAddress;
  }, []);

  const getFulfillmentChecks = useCallback((checks: Json | null): FulfillmentChecks => {
    if (!checks || typeof checks !== 'object' || Array.isArray(checks)) {
      return {};
    }

    return checks as FulfillmentChecks;
  }, []);

  // Real-time subscription for new/updated orders
  useEffect(() => {
    if (!isDocumentVisible) {
      return;
    }

    const channel = supabase
      .channel('admin-orders-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
          setNewOrderAlert(true);
          toast.success('New order received!', { duration: 5000 });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isDocumentVisible, queryClient]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async (): Promise<AdminOrder[]> => {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            id,
            product_name,
            product_id,
            product_variant_id,
            variant_details,
            quantity,
            unit_price,
            total_price
          ),
          order_tracking(
            id,
            status,
            location_name,
            latitude,
            longitude,
            notes,
            created_at
          )
        `)
        .in('status', ADMIN_VISIBLE_ORDER_STATUSES)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const safeOrders = ordersData || [];
      const userIds = [...new Set(safeOrders.map((order) => order.user_id))];
      const directProductIds = [
        ...new Set(
          safeOrders
            .flatMap((order) => order.order_items ?? [])
            .map((item) => item.product_id)
            .filter((productId): productId is string => Boolean(productId)),
        ),
      ];
      const variantIds = [
        ...new Set(
          safeOrders
            .flatMap((order) => order.order_items ?? [])
            .map((item) => item.product_variant_id)
            .filter((variantId): variantId is string => Boolean(variantId)),
        ),
      ];

      let profilesMap = new Map<string, Pick<ProfileRow, 'user_id' | 'name' | 'email'>>();
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, name, email')
          .in('user_id', userIds);

        profilesMap = new Map(profilesData?.map((profile) => [profile.user_id, profile]) || []);
      }

      let variantProductMap = new Map<string, string>();
      if (variantIds.length > 0) {
        const { data: variantData } = await supabase
          .from('product_variants')
          .select('id, product_id')
          .in('id', variantIds);

        variantProductMap = new Map(
          (variantData as Pick<ProductVariantRow, 'id' | 'product_id'>[] | null)?.map((variant) => [
            variant.id,
            variant.product_id,
          ]) || [],
        );
      }

      const imageProductIds = [
        ...new Set([
          ...directProductIds,
          ...variantIds
            .map((variantId) => variantProductMap.get(variantId))
            .filter((productId): productId is string => Boolean(productId)),
        ]),
      ];

      const productImageMap = new Map<string, string>();
      if (imageProductIds.length > 0) {
        const { data: imageData } = await supabase
          .from('product_images')
          .select('product_id, image_url, order_index')
          .in('product_id', imageProductIds)
          .order('order_index', { ascending: true });

        (imageData as Pick<ProductImageRow, 'product_id' | 'image_url' | 'order_index'>[] | null)?.forEach(
          (image) => {
            if (!productImageMap.has(image.product_id)) {
              productImageMap.set(image.product_id, image.image_url);
            }
          },
        );
      }

      const refundRequestMap = new Map<string, RefundRequestRow>();
      if (safeOrders.length > 0) {
        const { data: refundRequestData } = await supabase
          .from('refund_requests')
          .select('*')
          .in('order_id', safeOrders.map((order) => order.id))
          .order('created_at', { ascending: false });

        (refundRequestData as RefundRequestRow[] | null)?.forEach((request) => {
          if (!refundRequestMap.has(request.order_id)) {
            refundRequestMap.set(request.order_id, request);
          }
        });
      }

      return safeOrders.map((order) => ({
        ...order,
        profiles: profilesMap.get(order.user_id) || null,
        refund_request: refundRequestMap.get(order.id) || null,
        order_items: (order.order_items ?? []).map((item) => {
          const resolvedProductId =
            item.product_id ||
            (item.product_variant_id ? variantProductMap.get(item.product_variant_id) || null : null);

          return {
            ...item,
            image_url: resolvedProductId ? productImageMap.get(resolvedProductId) || null : null,
          };
        }),
        order_tracking: order.order_tracking ?? [],
      })) as AdminOrder[];
    },
  });

  const orderCards = useMemo(
    () => buildGroupedAdminOrderCards(orders || []),
    [orders],
  );

  const filteredOrders = orderCards.filter((card) => {
    const status = card.kind === 'group' ? card.cluster.status : card.order.status;
    const tabMatch =
      activeTab === 'all' ||
      STATUS_TABS.find((tab) => tab.value === activeTab)?.statuses.includes(status as OrderStatus);

    if (!tabMatch) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const searchText =
        card.kind === 'group'
          ? [
              card.cluster.displayOrderNumber,
              ...card.cluster.allOrders.flatMap((order) => [
                order.order_number,
                order.profiles?.name || '',
                order.profiles?.email || '',
                ...order.order_items.map((item) => item.product_name || ''),
              ]),
            ]
              .join(' ')
              .toLowerCase()
          : [
              card.order.order_number,
              card.order.profiles?.name || '',
              card.order.profiles?.email || '',
              ...card.order.order_items.map((item) => item.product_name || ''),
            ]
              .join(' ')
              .toLowerCase();

      return searchText.includes(q);
    }

    return true;
  });

  const getOrderCountForTab = (tabValue: string) => {
    if (tabValue === 'all') return orderCards.length;
    const tabConfig = STATUS_TABS.find(t => t.value === tabValue);
    return orderCards.filter((card) => {
      const status = card.kind === 'group' ? card.cluster.status : card.order.status;
      return tabConfig?.statuses.includes(status as OrderStatus);
    }).length;
  };

  const sendTransactionalEmail = useCallback(async (payload: {
    to?: string | null;
    subject: string;
    html: string;
    text: string;
    type: string;
    relatedEntityId: string;
    metadata?: Record<string, unknown>;
  }) => {
    if (!payload.to) {
      return { sent: false, skipped: true };
    }

    const { data, error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        type: payload.type,
        relatedEntityType: 'order',
        relatedEntityId: payload.relatedEntityId,
        requestedBy: user?.id,
        metadata: payload.metadata,
      },
    });

    if (error) throw error;
    return data;
  }, [user?.id]);

  const applyOrderStatusChange = useCallback(async ({
    orderId,
    status,
    userId,
    orderNumber,
    customNote,
    customerEmail,
    customerName,
    notifyCustomer = true,
  }: {
    orderId: string;
    status: OrderStatus;
    userId?: string;
    orderNumber?: string;
    customNote?: string;
    customerEmail?: string | null;
    customerName?: string | null;
    notifyCustomer?: boolean;
  }) => {
    const { error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) {
      console.error('Update error:', error);
      throw error;
    }

    const autoNotes: Record<string, string> = {
      payment_received: "We've received your payment. Thank you!",
      order_placed: 'Your order has been placed successfully.',
      order_processed: 'Item verified and packed. Preparing for courier pickup.',
      confirmed: 'Your order has been confirmed.',
      processing: 'Your order is being processed.',
      packed_for_delivery: 'Your order has been packed and is ready for shipping.',
      shipped: 'Your order has been shipped!',
      in_transit: 'Your order is on its way.',
      in_ghana: 'Your order has arrived in Ghana!',
      ready_for_delivery: 'Your order is ready for pickup/delivery.',
      handed_to_courier: 'Courier has picked up your package.',
      out_for_delivery: 'Your order is on the way to your location.',
      delivered: 'Item received. Enjoy!',
      cancelled: 'Your order has been cancelled.',
      refunded: 'Your order has been refunded.',
    };

    const trackingNote = customNote
      ? (autoNotes[status] ? `${autoNotes[status]} - ${customNote}` : customNote)
      : (autoNotes[status] || '');

    await supabase.from('order_tracking').insert({
      order_id: orderId,
      status,
      location_name: STATUS_LABELS[status],
      notes: trackingNote,
    });

    const statusMessages: Record<OrderStatus, string> = {
      pending: 'Your order is pending confirmation.',
      payment_received: 'Payment received! Processing your order.',
      order_placed: 'Your order has been placed successfully!',
      order_processed: 'Item verified and packed. Preparing for courier pickup.',
      confirmed: 'Your order has been confirmed!',
      processing: 'Your order is being processed.',
      packed_for_delivery: 'Your order has been packed and ready for shipping!',
      shipped: 'Your order has been shipped!',
      in_transit: 'Your order is in transit.',
      in_ghana: 'Your order has arrived in Ghana!',
      ready_for_delivery: 'Your order is ready for delivery!',
      handed_to_courier: 'Courier has picked up your package.',
      out_for_delivery: 'Your order is out for delivery!',
      delivered: 'Your order has been delivered!',
      cancelled: 'Your order has been cancelled.',
      refunded: 'Your order has been refunded.',
    };

    let emailResult:
      | {
          sent?: boolean;
          skipped?: boolean;
        }
      | undefined;

    if (notifyCustomer && userId) {
      const message = customNote
        ? `${statusMessages[status]} Note: ${customNote}`
        : statusMessages[status];

      await supabase.from('notifications').insert({
        user_id: userId,
        title: `Order Status: ${STATUS_LABELS[status]}`,
        message,
        type: 'order_status',
        data: { orderId, status },
      });

      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            user_id: userId,
            title: `Order ${orderNumber || 'Update'}`,
            body: statusMessages[status],
            data: { orderId, status, type: 'order_status' },
          },
        });
      } catch (pushError) {
        console.log('Push notification not sent:', pushError);
      }

      emailResult = await sendTransactionalEmail({
        to: customerEmail,
        subject: buildOrderStatusEmailSubject({
          orderNumber: orderNumber || 'your order',
          statusLabel: STATUS_LABELS[status],
        }),
        html: buildOrderStatusEmailHtml({
          customerName: customerName || 'there',
          orderNumber: orderNumber || 'your order',
          statusLabel: STATUS_LABELS[status],
          message: statusMessages[status],
          note: customNote,
        }),
        text: buildOrderStatusEmailText({
          customerName: customerName || 'there',
          orderNumber: orderNumber || 'your order',
          statusLabel: STATUS_LABELS[status],
          message: statusMessages[status],
          note: customNote,
        }),
        type: 'order_status',
        relatedEntityId: orderId,
        metadata: { orderNumber, status, customerEmail },
      });
    }

    await logAdminAction({
      actorUserId: user?.id,
      action: 'order.status_updated',
      entityType: 'order',
      entityId: orderId,
      summary: `Updated order ${orderNumber || orderId} to ${STATUS_LABELS[status]}.`,
      metadata: {
        status,
        orderNumber,
        customNote: customNote || null,
        emailSent: emailResult?.sent || false,
        notifyCustomer,
      },
    });
  }, [sendTransactionalEmail, user?.id]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      status,
      userId,
      orderNumber,
      customNote,
      customerEmail,
      customerName,
    }: {
      orderId: string;
      status: OrderStatus;
      userId?: string;
      orderNumber?: string;
      customNote?: string;
      customerEmail?: string | null;
      customerName?: string | null;
    }) => {
      await applyOrderStatusChange({
        orderId,
        status,
        userId,
        orderNumber,
        customNote,
        customerEmail,
        customerName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Order status updated and customer notified');
      setStatusNotes({});
    },
    onError: (error: Error) => {
      console.error('Mutation error:', error);
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const updateGroupStatusMutation = useMutation({
    mutationFn: async ({
      cluster,
      status,
      customNote,
    }: {
      cluster: GroupOrderCluster<AdminOrder>;
      status: OrderStatus;
      customNote?: string;
    }) => {
      if (cluster.masterOrder) {
        await applyOrderStatusChange({
          orderId: cluster.masterOrder.id,
          status,
          orderNumber: cluster.masterOrder.order_number,
          notifyCustomer: false,
        });
      }

      const participantOrders =
        cluster.childOrders.length > 0
          ? cluster.childOrders
          : cluster.masterOrder
            ? []
            : cluster.allOrders;

      for (const order of participantOrders) {
        await applyOrderStatusChange({
          orderId: order.id,
          status,
          userId: order.user_id,
          orderNumber: order.order_number,
          customNote,
          customerEmail: order.profiles?.email,
          customerName: order.profiles?.name,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Group order status updated for every participant');
      setStatusNotes({});
    },
    onError: (error: Error) => {
      console.error('Group mutation error:', error);
      toast.error(`Failed to update group order: ${error.message}`);
    },
  });

  const updateDeliveryDatesMutation = useMutation({
    mutationFn: async ({
      orderId,
      startDate,
      endDate,
      userId,
      orderNumber,
      customerEmail,
      customerName,
    }: {
      orderId: string;
      startDate: string;
      endDate: string;
      userId?: string;
      orderNumber?: string;
      customerEmail?: string | null;
      customerName?: string | null;
    }) => {
      const { error } = await supabase
        .from('orders')
        .update({ 
          estimated_delivery_start: startDate,
          estimated_delivery_end: endDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
      
      if (error) {
        console.error('Update delivery dates error:', error);
        throw error;
      }

      if (userId) {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: 'Estimated Delivery Updated',
          message: `Your order #${orderNumber} is estimated to arrive between ${format(new Date(startDate), 'PP')} and ${format(new Date(endDate), 'PP')}.`,
          type: 'order_status',
          data: { orderId, startDate, endDate },
        });

        try {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              user_id: userId,
              title: `Order ${orderNumber || ''} Delivery Update`,
              body: `Estimated arrival: ${format(new Date(startDate), 'PP')} - ${format(new Date(endDate), 'PP')}`,
              data: { orderId, type: 'delivery_update' },
            },
          });
        } catch (pushError) {
          console.log('Push notification not sent:', pushError);
        }
      }

      const startDateLabel = format(new Date(startDate), 'PP');
      const endDateLabel = format(new Date(endDate), 'PP');

      const emailResult = await sendTransactionalEmail({
        to: customerEmail,
        subject: buildDeliveryWindowEmailSubject({
          orderNumber: orderNumber || 'your order',
        }),
        html: buildDeliveryWindowEmailHtml({
          customerName: customerName || 'there',
          orderNumber: orderNumber || 'your order',
          startDateLabel,
          endDateLabel,
        }),
        text: buildDeliveryWindowEmailText({
          customerName: customerName || 'there',
          orderNumber: orderNumber || 'your order',
          startDateLabel,
          endDateLabel,
        }),
        type: 'delivery_update',
        relatedEntityId: orderId,
        metadata: { orderNumber, startDate, endDate, customerEmail },
      });

      await logAdminAction({
        actorUserId: user?.id,
        action: 'order.delivery_window_updated',
        entityType: 'order',
        entityId: orderId,
        summary: `Updated delivery window for ${orderNumber || orderId}.`,
        metadata: {
          startDate,
          endDate,
          emailSent: emailResult?.sent || false,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Estimated delivery dates updated');
      setDeliveryDates({ orderId: '', start: '', end: '' });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const addTrackingMutation = useMutation({
    mutationFn: async ({
      orderId,
      courierName,
      courierTrackingNumber,
      deliveryFee,
      ...tracking
    }: {
      orderId: string;
      status: string;
      location_name: string;
      latitude?: number;
      longitude?: number;
      notes?: string;
      courierName?: string;
      courierTrackingNumber?: string;
      deliveryFee?: number;
    }) => {
      const { error } = await supabase
        .from('order_tracking')
        .insert({
          order_id: orderId,
          status: tracking.status,
          location_name: tracking.location_name,
          latitude: tracking.latitude,
          longitude: tracking.longitude,
          notes: tracking.notes,
        });
      if (error) throw error;

      const metadataPatch: Record<string, unknown> = {};
      if (courierName) metadataPatch.courier_name = courierName;
      if (courierTrackingNumber) metadataPatch.courier_tracking_number = courierTrackingNumber;
      if (deliveryFee != null && !Number.isNaN(deliveryFee)) metadataPatch.delivery_fee = deliveryFee;

      if (Object.keys(metadataPatch).length > 0) {
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({
            ...metadataPatch,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        if (orderUpdateError) throw orderUpdateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Tracking updated');
      setTrackingLocation({ lat: '', lng: '', location: '', notes: '', courierName: '', courierTrackingNumber: '', deliveryFee: '' });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const saveFulfillmentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFulfillmentOrder) return;

      const { error } = await supabase
        .from('orders')
        .update({
          fulfillment_stage: fulfillmentDraft.stage,
          fulfillment_checks: {
            picked: fulfillmentDraft.picked,
            quality_checked: fulfillmentDraft.quality_checked,
            packed: fulfillmentDraft.packed,
            awaiting_dispatch: fulfillmentDraft.awaiting_dispatch,
          },
          courier_name: fulfillmentDraft.courierName || null,
          courier_tracking_number: fulfillmentDraft.courierTrackingNumber || null,
          delivery_fee: fulfillmentDraft.deliveryFee ? Number.parseFloat(fulfillmentDraft.deliveryFee) : null,
          proof_of_delivery_note: fulfillmentDraft.proofNote || null,
          proof_of_delivery_image_url: fulfillmentDraft.proofImageUrl || null,
          proof_of_delivery_recipient_name: fulfillmentDraft.recipientName || null,
          proof_of_delivery_recipient_phone: fulfillmentDraft.recipientPhone || null,
          proof_of_delivery_relationship: fulfillmentDraft.recipientRelationship || null,
          proof_of_delivery_signature_name: fulfillmentDraft.signatureName || null,
          proof_of_delivery_verification_code: fulfillmentDraft.verificationCode
            ? fulfillmentDraft.verificationCode
            : (
                fulfillmentDraft.courierConfirmed ||
                fulfillmentDraft.proofNote ||
                fulfillmentDraft.proofImageUrl ||
                fulfillmentDraft.signatureName ||
                fulfillmentDraft.recipientName
              )
                ? generateProofVerificationCode()
                : null,
          courier_confirmed_at: fulfillmentDraft.courierConfirmed ? new Date().toISOString() : null,
          proof_of_delivery_at:
            fulfillmentDraft.courierConfirmed ||
            fulfillmentDraft.proofNote ||
            fulfillmentDraft.proofImageUrl ||
            fulfillmentDraft.signatureName ||
            fulfillmentDraft.recipientName
            ? new Date().toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedFulfillmentOrder.id);

      if (error) throw error;

      await logAdminAction({
        actorUserId: user?.id,
        action: 'order.fulfillment_saved',
        entityType: 'order',
        entityId: selectedFulfillmentOrder.id,
        summary: `Saved fulfillment details for ${selectedFulfillmentOrder.order_number}.`,
        metadata: {
          stage: fulfillmentDraft.stage,
          courierName: fulfillmentDraft.courierName || null,
          hasProofImage: Boolean(fulfillmentDraft.proofImageUrl),
          recipientName: fulfillmentDraft.recipientName || null,
          courierConfirmed: fulfillmentDraft.courierConfirmed,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Fulfillment details saved');
      setSelectedFulfillmentOrder(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save fulfillment details');
    },
  });

  const openFulfillmentDialog = (order: AdminOrder) => {
    const checks = getFulfillmentChecks(order.fulfillment_checks);

    setSelectedFulfillmentOrder(order);
    setFulfillmentDraft({
      stage: order.fulfillment_stage || 'new',
      picked: !!checks.picked,
      quality_checked: !!checks.quality_checked,
      packed: !!checks.packed,
      awaiting_dispatch: !!checks.awaiting_dispatch,
      courierName: order.courier_name || '',
      courierTrackingNumber: order.courier_tracking_number || '',
      deliveryFee: order.delivery_fee != null ? String(order.delivery_fee) : '',
      proofNote: order.proof_of_delivery_note || '',
      proofImageUrl: normalizeProofOfDeliveryPath(order.proof_of_delivery_image_url) || '',
      recipientName: order.proof_of_delivery_recipient_name || '',
      recipientPhone: order.proof_of_delivery_recipient_phone || '',
      recipientRelationship: order.proof_of_delivery_relationship || '',
      signatureName: order.proof_of_delivery_signature_name || '',
      verificationCode: order.proof_of_delivery_verification_code || '',
      courierConfirmed: Boolean(order.courier_confirmed_at),
    });
  };

  useEffect(() => {
    if (!fulfillmentDraft.proofImageUrl) {
      setProofImagePreviewUrl('');
      return;
    }

    let cancelled = false;

    void getProofOfDeliverySignedUrl(fulfillmentDraft.proofImageUrl)
      .then((url) => {
        if (!cancelled) {
          setProofImagePreviewUrl(url || '');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProofImagePreviewUrl(fulfillmentDraft.proofImageUrl);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fulfillmentDraft.proofImageUrl]);

  const resetRefundDialog = () => {
    setSelectedRefundOrder(null);
    setRefundDraft({
      refundChannel: 'original_payment',
      walletCreditAmount: '',
      adminNotes: '',
    });
  };

  const openRefundDialog = (order: AdminOrder) => {
    const suggestedWalletCredit = getSuggestedRefundWalletCredit(order);
    const hasShippingRefundHint = /(shipping|buffer|delivery)/i.test(
      `${order.refund_request?.reason || ''} ${order.refund_request?.details || ''}`,
    );

    setSelectedRefundOrder(order);
    setRefundDraft({
      refundChannel:
        order.refund_request?.refund_channel === 'wallet_credit' || order.refund_request?.refund_channel === 'mixed'
          ? order.refund_request.refund_channel
          : 'original_payment',
      walletCreditAmount:
        order.refund_request?.wallet_credit_amount
          ? String(order.refund_request.wallet_credit_amount)
          : suggestedWalletCredit > 0 && hasShippingRefundHint
            ? String(suggestedWalletCredit)
            : '',
      adminNotes: order.refund_request?.admin_notes || order.admin_notes || '',
    });
  };

  const handleProofFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedFulfillmentOrder) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Proof image is too large. Max 5MB.');
      return;
    }

    try {
      setIsUploadingProof(true);
      const proofPath = await uploadProofOfDelivery(selectedFulfillmentOrder.id, file);
      setFulfillmentDraft((prev) => ({ ...prev, proofImageUrl: proofPath }));
      toast.success('Proof image uploaded');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload proof image');
    } finally {
      setIsUploadingProof(false);
      if (proofUploadInputRef.current) {
        proofUploadInputRef.current.value = '';
      }
    }
  };

  const saveAdminNotesMutation = useMutation({
    mutationFn: async ({ orderId, notes }: { orderId: string; notes: string }) => {
      const { error } = await supabase
        .from('orders')
        .update({ admin_notes: notes, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Admin note saved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save admin note');
    },
  });

  const processRefundMutation = useMutation({
    mutationFn: async (order: AdminOrder) => {
      const walletCredit = Number.parseFloat(refundDraft.walletCreditAmount || '0') || 0;
      const maxRefundAmount = Number(order.refund_request?.refund_amount || order.total_amount || 0);

      if (walletCredit < 0) {
        throw new Error('Wallet credit amount cannot be negative.');
      }

      if (refundDraft.refundChannel !== 'original_payment' && walletCredit <= 0) {
        throw new Error('Add a wallet credit amount for wallet-based refunds.');
      }

      if (walletCredit > maxRefundAmount) {
        throw new Error('Wallet credit amount cannot exceed the refund total.');
      }

      if (order.refund_request) {
        const { error: refundRequestError } = await supabase
          .from('refund_requests')
          .update({
            status: 'processed',
            admin_notes: refundDraft.adminNotes || null,
            refund_channel: refundDraft.refundChannel,
            wallet_credit_amount: walletCredit,
            processed_at: new Date().toISOString(),
            processed_by: user?.id || null,
          })
          .eq('id', order.refund_request.id);

        if (refundRequestError) throw refundRequestError;
      }

      if (walletCredit > 0) {
        await creditWalletByAdmin({
          userId: order.user_id,
          amount: walletCredit,
          description: `Refund credit for order ${order.order_number}`,
          createdBy: user?.id,
          orderId: order.id,
          referenceKey: `order-refund:${order.id}:${order.refund_request?.id || 'manual'}:wallet-credit`,
          notificationTitle: 'Wallet Refund Received',
          notificationMessage: `${formatPrice(walletCredit)} has been credited to your AJYN wallet for order ${order.order_number}.`,
        });
      }

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'refunded',
          admin_notes: refundDraft.adminNotes || order.admin_notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      const refundTrackingNoteParts = [
        walletCredit > 0
          ? `Refund processed. ${formatPrice(walletCredit)} credited to the customer's wallet.`
          : 'Refund processed and recorded by support.',
      ];

      if (refundDraft.refundChannel === 'mixed') {
        refundTrackingNoteParts.push('Remaining balance was marked for original payment refund.');
      } else if (refundDraft.refundChannel === 'original_payment') {
        refundTrackingNoteParts.push('Customer should receive the refund through the original payment channel.');
      }

      if (refundDraft.adminNotes.trim()) {
        refundTrackingNoteParts.push(refundDraft.adminNotes.trim());
      }

      const { error: trackingError } = await supabase.from('order_tracking').insert({
        order_id: order.id,
        status: 'refunded',
        location_name: 'AJYN Support Desk',
        notes: refundTrackingNoteParts.join(' '),
      });

      if (trackingError) throw trackingError;

      const statusMessage = walletCredit > 0
        ? refundDraft.refundChannel === 'mixed'
          ? `Your refund has been processed. ${formatPrice(walletCredit)} was credited to your wallet and the remaining balance will be completed via your original payment channel.`
          : `Your refund has been processed. ${formatPrice(walletCredit)} was credited to your wallet for future checkout use.`
        : 'Your refund has been processed! Please check your original payment channel.';

      await supabase.from('notifications').insert({
        user_id: order.user_id,
        title: 'Refund Processed',
        message: statusMessage,
        type: 'refund_status',
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          refund_channel: refundDraft.refundChannel,
          wallet_credit_amount: walletCredit,
        },
      });

      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            user_id: order.user_id,
            title: `Refund for order ${order.order_number}`,
            body: statusMessage,
            data: {
              type: 'refund_status',
              orderId: order.id,
              orderNumber: order.order_number,
              refund_channel: refundDraft.refundChannel,
              wallet_credit_amount: walletCredit,
            },
          },
        });
      } catch (pushError) {
        console.log('Push notification failed:', pushError);
      }

      const emailResult = order.profiles?.email
        ? await supabase.functions.invoke('send-transactional-email', {
            body: {
              to: order.profiles.email,
              subject: buildRefundEmailSubject({
                orderNumber: order.order_number,
                statusLabel: 'processed',
              }),
              html: buildRefundEmailHtml({
                customerName: order.profiles?.name || 'there',
                orderNumber: order.order_number,
                statusLabel: 'processed',
                message: statusMessage,
                adminNotes: refundDraft.adminNotes || undefined,
              }),
              text: buildRefundEmailText({
                customerName: order.profiles?.name || 'there',
                orderNumber: order.order_number,
                statusLabel: 'processed',
                message: statusMessage,
                adminNotes: refundDraft.adminNotes || undefined,
              }),
              type: 'refund_status',
              relatedEntityType: order.refund_request ? 'refund_request' : 'order',
              relatedEntityId: order.refund_request?.id || order.id,
              requestedBy: user?.id,
              metadata: {
                orderId: order.id,
                orderNumber: order.order_number,
                refundChannel: refundDraft.refundChannel,
                walletCreditAmount: walletCredit,
                source: order.refund_request ? 'refund_request' : 'manual_order_refund',
              },
            },
          })
        : { data: { sent: false, skipped: true }, error: null };

      if (emailResult.error) throw emailResult.error;

      await logAdminAction({
        actorUserId: user?.id,
        action: order.refund_request ? 'refund_request.processed' : 'order.refunded',
        entityType: order.refund_request ? 'refund_request' : 'order',
        entityId: order.refund_request?.id || order.id,
        summary: `Processed refund for order ${order.order_number}.`,
        metadata: {
          orderId: order.id,
          orderNumber: order.order_number,
          refundRequestId: order.refund_request?.id || null,
          refundChannel: refundDraft.refundChannel,
          walletCredit,
          emailSent: emailResult.data?.sent || false,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-refund-requests'] });
      queryClient.invalidateQueries({ queryKey: ['refund-requests'] });
      toast.success('Refund processed');
      resetRefundDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to process refund');
    },
  });

  const addCustomerNoteMutation = useMutation({
    mutationFn: async ({
      orderId,
      orderStatus,
      note,
      userId,
      customerEmail,
      customerName,
      orderNumber,
    }: {
      orderId: string;
      orderStatus: OrderStatus;
      note: string;
      userId?: string;
      customerEmail?: string | null;
      customerName?: string | null;
      orderNumber?: string;
    }) => {
      const trimmed = note.trim();
      if (!trimmed) {
        throw new Error('Enter a note for the customer first');
      }

      const { error: trackingError } = await supabase
        .from('order_tracking')
        .insert({
          order_id: orderId,
          status: orderStatus,
          location_name: STATUS_LABELS[orderStatus],
          notes: trimmed,
        });

      if (trackingError) throw trackingError;

      await supabase
        .from('orders')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (userId) {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: 'Order Update',
          message: trimmed,
          type: 'order_status',
          data: { orderId, status: orderStatus, note: trimmed },
        });
      }

      const emailResult = await sendTransactionalEmail({
        to: customerEmail,
        subject: buildOrderStatusEmailSubject({
          orderNumber: orderNumber || 'your order',
          statusLabel: STATUS_LABELS[orderStatus],
        }),
        html: buildOrderStatusEmailHtml({
          customerName: customerName || 'there',
          orderNumber: orderNumber || 'your order',
          statusLabel: STATUS_LABELS[orderStatus],
          message: 'There is a new note on your order.',
          note: trimmed,
        }),
        text: buildOrderStatusEmailText({
          customerName: customerName || 'there',
          orderNumber: orderNumber || 'your order',
          statusLabel: STATUS_LABELS[orderStatus],
          message: 'There is a new note on your order.',
          note: trimmed,
        }),
        type: 'order_note',
        relatedEntityId: orderId,
        metadata: { orderNumber, orderStatus, customerEmail },
      });

      await logAdminAction({
        actorUserId: user?.id,
        action: 'order.customer_note_added',
        entityType: 'order',
        entityId: orderId,
        summary: 'Added a customer-visible order note.',
        metadata: {
          orderStatus,
          noteLength: trimmed.length,
          emailSent: emailResult?.sent || false,
        },
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setStatusNotes((prev) => ({ ...prev, [variables.orderId]: '' }));
      toast.success('Customer note added');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add customer note');
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-muted text-muted-foreground';
      case 'payment_received': return 'bg-green-100 text-green-800';
      case 'order_placed': return 'bg-blue-100 text-blue-800';
      case 'order_processed': return 'bg-blue-200 text-blue-900';
      case 'confirmed': return 'bg-primary/20 text-primary';
      case 'processing': return 'bg-accent text-accent-foreground';
      case 'packed_for_delivery': return 'bg-purple-100 text-purple-800';
      case 'shipped': return 'bg-primary/30 text-primary';
      case 'in_transit': return 'bg-primary/40 text-primary';
      case 'in_ghana': return 'bg-orange-100 text-orange-800';
      case 'ready_for_delivery': return 'bg-cyan-100 text-cyan-800';
      case 'handed_to_courier': return 'bg-indigo-100 text-indigo-800';
      case 'out_for_delivery': return 'bg-primary/50 text-primary-foreground';
      case 'delivered': return 'bg-primary text-primary-foreground';
      case 'cancelled': return 'bg-destructive/20 text-destructive';
      case 'refunded': return 'bg-destructive/30 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <SwipeHintOverlay />
      {newOrderAlert && (
        <Alert className="mb-4 border-green-500/50 bg-green-500/10">
          <BellRing className="h-4 w-4 text-green-600" />
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-green-700 font-medium">New order received! The list has been updated.</span>
            <Button variant="ghost" size="sm" onClick={() => setNewOrderAlert(false)}>Dismiss</Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold font-serif text-foreground md:text-3xl">Orders Management</h1>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 sm:w-64"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const data = filteredOrders.map((card) => ({
                'Order Number':
                  card.kind === 'group'
                    ? card.cluster.displayOrderNumber
                    : card.order.order_number,
                'Customer':
                  card.kind === 'group'
                    ? `${card.cluster.participantCount} participants`
                    : card.order.profiles?.name || 'Unknown',
                'Email':
                  card.kind === 'group'
                    ? ''
                    : card.order.profiles?.email || '',
                'Status':
                  STATUS_LABELS[
                    (card.kind === 'group' ? card.cluster.status : card.order.status) as OrderStatus
                  ] || (card.kind === 'group' ? card.cluster.status : card.order.status),
                'Total':
                  Number(
                    card.kind === 'group' ? card.cluster.totalAmount : card.order.total_amount,
                  ).toFixed(2),
                'Date':
                  format(
                    new Date(card.kind === 'group' ? card.cluster.createdAt : card.order.created_at),
                    'yyyy-MM-dd HH:mm',
                  ),
              }));
              const headers = Object.keys(data[0] || {}).join(',');
              const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(','));
              const csv = [headers, ...rows].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `orders-${format(new Date(), 'yyyy-MM-dd')}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
          {selectedOrders.size > 0 && (
            <Select
              onValueChange={(status) => {
                selectedOrders.forEach(orderId => {
                  const order = orders?.find(o => o.id === orderId);
                  if (order) {
                    updateStatusMutation.mutate({
                      orderId,
                      status: status as OrderStatus,
                      userId: order.user_id,
                      orderNumber: order.order_number,
                      customerEmail: order.profiles?.email,
                      customerName: order.profiles?.name,
                    });
                  }
                });
                setSelectedOrders(new Set());
              }}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder={`Bulk update (${selectedOrders.size})`} />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {ORDER_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <ScrollArea className="w-full whitespace-nowrap mb-6">
          <TabsList className="inline-flex h-auto gap-1 p-1.5">
            {STATUS_TABS.map((tab) => {
              const Icon = tab.icon;
              const count = getOrderCountForTab(tab.value);
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {count}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <TabsContent value={activeTab} className="mt-0">
          <div className="space-y-4">
            {filteredOrders.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No orders in {activeTab === 'all' ? 'any category' : STATUS_TABS.find(t => t.value === activeTab)?.label}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredOrders.map((card) => {
                if (card.kind === 'group') {
                  const { cluster } = card;
                  const groupStatus = (cluster.status || 'pending') as OrderStatus;
                  const currentIdx = ORDER_STATUSES.indexOf(groupStatus);
                  const nextStatus = currentIdx >= 0 && currentIdx < ORDER_STATUSES.length - 1
                    ? ORDER_STATUSES[currentIdx + 1]
                    : undefined;
                  const prevStatus = currentIdx > 0 ? ORDER_STATUSES[currentIdx - 1] : undefined;
                  const childOrders = cluster.childOrders.length > 0 ? cluster.childOrders : cluster.allOrders;
                  const groupItems = childOrders.flatMap((order) => order.order_items || []);
                  const primaryProductName = groupItems[0]?.product_name || 'Group buy order';
                  const primaryProductImage = groupItems[0]?.image_url || null;

                  return (
                    <SwipeableOrderCard
                      key={card.id}
                      rightLabel={nextStatus ? `-> ${STATUS_LABELS[nextStatus]}` : 'No next status'}
                      leftLabel={prevStatus ? `${STATUS_LABELS[prevStatus]} <-` : 'No previous status'}
                      onSwipeRight={
                        nextStatus
                          ? () =>
                              updateGroupStatusMutation.mutate({
                                cluster,
                                status: nextStatus,
                                customNote: statusNotes[card.id],
                              })
                          : undefined
                      }
                      onSwipeLeft={
                        prevStatus
                          ? () =>
                              updateGroupStatusMutation.mutate({
                                cluster,
                                status: prevStatus,
                                customNote: statusNotes[card.id],
                              })
                          : undefined
                      }
                    >
                      <Card>
                        <Collapsible>
                          <CardHeader className="pb-2">
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className="group flex min-w-0 items-center justify-between gap-3 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                              >
                                <div className="flex min-w-0 flex-1 items-start gap-3">
                                  <AdminOrderThumbnail
                                    imageUrl={primaryProductImage}
                                    alt={primaryProductName}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-lg font-medium text-foreground">
                                        Group Order #{cluster.displayOrderNumber}
                                      </p>
                                      <Badge variant="outline">Group Buy</Badge>
                                      <Badge className={getStatusColor(groupStatus)}>
                                        {STATUS_LABELS[groupStatus] || groupStatus.replace('_', ' ')}
                                      </Badge>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                      <span className="max-w-[12rem] truncate sm:max-w-none">
                                        {primaryProductName}
                                      </span>
                                      <span>{cluster.participantCount} participants</span>
                                      <span>{formatPrice(Number(cluster.totalAmount))}</span>
                                      <span>{format(new Date(cluster.createdAt), 'MMM d, yyyy')}</span>
                                    </div>
                                  </div>
                                </div>
                                <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                              </button>
                            </CollapsibleTrigger>
                          </CardHeader>
                          <CollapsibleContent>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                                <div>
                                  <p className="text-sm text-muted-foreground">Product</p>
                                  <p className="font-medium text-foreground">{primaryProductName}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Participants</p>
                                  <p className="font-medium text-foreground">{cluster.participantCount}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Related Orders</p>
                                  <p className="font-medium text-foreground">{childOrders.length}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Total</p>
                                  <p className="text-xl font-bold text-primary">
                                    {formatPrice(Number(cluster.totalAmount))}
                                  </p>
                                </div>
                              </div>

                              <div className="rounded-lg border border-border bg-muted/40 p-4">
                                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <p className="text-sm font-semibold text-foreground">
                                      Master Status Control
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      Changing this updates every participant order in the group.
                                    </p>
                                  </div>
                                  <Select
                                    onValueChange={(value) =>
                                      updateGroupStatusMutation.mutate({
                                        cluster,
                                        status: value as OrderStatus,
                                        customNote: statusNotes[card.id],
                                      })
                                    }
                                  >
                                    <SelectTrigger className="w-full sm:w-64">
                                      <SelectValue placeholder="Update all participant orders" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover z-50">
                                      {ORDER_STATUS_OPTIONS.map((status) => (
                                        <SelectItem key={status} value={status}>
                                          {STATUS_LABELS[status]}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Textarea
                                  value={statusNotes[card.id] ?? ''}
                                  placeholder="Optional note to send with the group status update..."
                                  className="min-h-[60px] text-sm"
                                  onChange={(event) =>
                                    setStatusNotes((prev) => ({
                                      ...prev,
                                      [card.id]: event.target.value,
                                    }))
                                  }
                                />
                              </div>

                              <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
                                <div>
                                  <p className="text-sm font-semibold text-foreground">Participants</p>
                                  <p className="text-sm text-muted-foreground">
                                    Address, quantity, payment status, and join details for everyone in this group.
                                  </p>
                                </div>
                                <GroupBuyParticipantList groupBuyId={cluster.groupBuyId} />
                              </div>

                              <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
                                <div>
                                  <p className="text-sm font-semibold text-foreground">Related Child Orders</p>
                                  <p className="text-sm text-muted-foreground">
                                    The storefront orders linked to this master group order.
                                  </p>
                                </div>
                                <div className="space-y-3">
                                  {childOrders.map((order) => {
                                    const shippingAddress = getShippingAddress(order.shipping_address);
                                    const totalQuantity = order.order_items.reduce(
                                      (sum, item) => sum + Number(item.quantity || 0),
                                      0,
                                    );

                                    return (
                                      <div
                                        key={order.id}
                                        className="rounded-lg border border-border bg-background p-3"
                                      >
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                          <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <p className="font-medium text-foreground">
                                                #{order.order_number}
                                              </p>
                                              <Badge className={getStatusColor((order.status || 'pending') as OrderStatus)}>
                                                {STATUS_LABELS[(order.status || 'pending') as OrderStatus] || order.status}
                                              </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                              {order.profiles?.name || 'Unknown customer'}
                                              {order.profiles?.email ? ` - ${order.profiles.email}` : ''}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                              {totalQuantity} item{totalQuantity === 1 ? '' : 's'}
                                              {shippingAddress?.city ? ` - ${shippingAddress.city}` : ''}
                                              {shippingAddress?.phone ? ` - ${shippingAddress.phone}` : ''}
                                            </p>
                                          </div>
                                          <p className="font-semibold text-primary">
                                            {formatPrice(Number(order.total_amount))}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </CardContent>
                          </CollapsibleContent>
                        </Collapsible>
                      </Card>
                    </SwipeableOrderCard>
                  );
                }

                const order = card.order;
                const currentIdx = ORDER_STATUSES.indexOf(order.status as OrderStatus);
                const nextStatus = currentIdx >= 0 && currentIdx < ORDER_STATUSES.length - 1
                  ? ORDER_STATUSES[currentIdx + 1]
                  : undefined;
                const prevStatus = currentIdx > 0 ? ORDER_STATUSES[currentIdx - 1] : undefined;
                const checkpoints = getCheckpointsForOrder(order.status || 'pending');
                const isCancelled = ['cancelled', 'refunded'].includes(order.status || '');
                const primaryProductName = order.order_items[0]?.product_name || 'this order';
                const primaryProductImage = order.order_items[0]?.image_url || null;
                return (
                <SwipeableOrderCard
                  key={order.id}
                  rightLabel={nextStatus ? `-> ${STATUS_LABELS[nextStatus]}` : 'No next status'}
                  leftLabel={prevStatus ? `${STATUS_LABELS[prevStatus]} <-` : 'No previous status'}
                  onSwipeRight={
                    nextStatus
                      ? () =>
                          updateStatusMutation.mutate({
                            orderId: order.id,
                            status: nextStatus,
                            userId: order.user_id,
                            orderNumber: order.order_number,
                            customerEmail: order.profiles?.email,
                            customerName: order.profiles?.name,
                          })
                      : undefined
                  }
                  onSwipeLeft={
                    prevStatus
                      ? () =>
                          updateStatusMutation.mutate({
                            orderId: order.id,
                            status: prevStatus,
                            userId: order.user_id,
                            orderNumber: order.order_number,
                            customerEmail: order.profiles?.email,
                            customerName: order.profiles?.name,
                          })
                      : undefined
                  }
                >
                <Card>
                  <Collapsible>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        aria-label={`Select order #${order.order_number}`}
                        checked={selectedOrders.has(order.id)}
                        onChange={(e) => {
                          const next = new Set(selectedOrders);
                          if (e.target.checked) next.add(order.id);
                          else next.delete(order.id);
                          setSelectedOrders(next);
                        }}
                        className="h-4 w-4 rounded border-border"
                      />
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="group flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <AdminOrderThumbnail
                              imageUrl={primaryProductImage}
                              alt={primaryProductName}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-lg font-medium text-foreground">
                                  Order #{order.order_number}
                                </p>
                                <Badge className={getStatusColor(order.status || 'pending')}>
                                  {STATUS_LABELS[order.status as OrderStatus] || order.status?.replace('_', ' ')}
                                </Badge>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span className="max-w-[12rem] truncate sm:max-w-none">
                                  {order.profiles?.name || 'Unknown customer'}
                                </span>
                                <span>{formatPrice(Number(order.total_amount))}</span>
                                <span>{format(new Date(order.created_at), 'MMM d, yyyy')}</span>
                                {order.refund_request && (
                                  <span>Refund: {getRefundStatusLabel(order.refund_request.status)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                        </button>
                      </CollapsibleTrigger>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                  <CardContent>
                    <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-5">
                      <div>
                        <p className="text-sm text-muted-foreground">Customer</p>
                        <p className="font-medium text-foreground">
                          {order.profiles?.name || 'Unknown'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {order.profiles?.email}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Order Date</p>
                        <p className="font-medium text-foreground">
                          {format(new Date(order.created_at), 'PPp')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="font-bold text-primary text-xl">
                          {formatPrice(Number(order.total_amount))}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Est. Delivery</p>
                        {order.estimated_delivery_start && order.estimated_delivery_end ? (
                          <p className="font-medium text-foreground text-sm">
                            {format(new Date(order.estimated_delivery_start), 'PP')} - {format(new Date(order.estimated_delivery_end), 'PP')}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">Not set</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Refund</p>
                        {order.refund_request ? (
                          <div className="space-y-1">
                            <Badge variant="secondary" className="w-fit">
                              {getRefundStatusLabel(order.refund_request.status)}
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              {formatPrice(Number(order.refund_request.refund_amount || order.total_amount))}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">No refund request</p>
                        )}
                      </div>
                    </div>

                    {!isCancelled && (
                      <div className="mb-4 grid gap-4 rounded-lg border border-border bg-muted/40 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,1fr)]">
                        <div className="space-y-3">
                          <Progress value={getProgressPercentage(order.status || 'pending', checkpoints)} className="h-2.5" />
                          <div className="flex justify-between gap-2">
                            {checkpoints.map((checkpoint) => {
                              const checkpointStatus = getCheckpointStatus(
                                order.status || 'pending',
                                checkpoint.key,
                                checkpoints,
                              );

                              return (
                                <div key={checkpoint.key} className="flex flex-1 flex-col items-center">
                                  <div
                                    className={`mb-1 h-3 w-3 rounded-full ${
                                      checkpointStatus === 'done'
                                        ? 'bg-primary'
                                        : checkpointStatus === 'current'
                                          ? 'bg-primary/50 ring-2 ring-primary/30'
                                          : 'bg-muted-foreground/20'
                                    }`}
                                  />
                                  <span
                                    className={`text-center text-[10px] leading-tight ${
                                      checkpointStatus === 'done'
                                        ? 'font-medium text-primary'
                                        : checkpointStatus === 'current'
                                          ? 'text-foreground'
                                          : 'text-muted-foreground'
                                    }`}
                                  >
                                    {checkpoint.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="space-y-3">
                            {(order.order_tracking.length > 0 ? [...order.order_tracking].reverse() : [{
                              id: `fallback-${order.id}`,
                              created_at: order.created_at,
                              status: order.status || 'pending',
                              notes: null,
                              location_name: null,
                              latitude: null,
                              longitude: null,
                              order_id: order.id,
                            }]).map((track, index, items) => (
                              <div key={track.id} className="flex gap-3">
                                <div className="flex flex-col items-center">
                                  <div className={`h-3 w-3 rounded-full ${index === 0 ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                                  {index < items.length - 1 && <div className="my-1 h-full w-0.5 bg-muted-foreground/20" />}
                                </div>
                                <div className="min-w-0 flex-1 pb-2">
                                  <p className={`text-sm font-medium ${index === 0 ? 'text-primary' : 'text-foreground'}`}>
                                    {STATUS_LABELS[track.status as OrderStatus] || track.status.replaceAll('_', ' ')}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(track.created_at), 'MMM d, h:mm a')}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {track.notes || getAutoNote(track.status, primaryProductName)}
                                  </p>
                                  {track.location_name && (
                                    <p className="mt-1 text-[11px] text-muted-foreground/80">{track.location_name}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Order Items with Full Details */}
                    <div className="mb-4 p-4 bg-muted rounded-lg">
                      <p className="text-sm font-semibold text-foreground mb-3">Order Items:</p>
                      <div className="space-y-3">
                        {order.order_items?.map((item) => (
                          <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex min-w-0 flex-1 gap-3">
                              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                                {item.image_url ? (
                                  <img
                                    src={item.image_url}
                                    alt={item.product_name}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                    <Package className="h-5 w-5" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-foreground">{item.product_name}</p>
                                {item.variant_details && (
                                  <p className="text-sm text-primary mt-1">
                                    Variant: {item.variant_details}
                                  </p>
                                )}
                                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                  <span>Qty: <strong className="text-foreground">{item.quantity}</strong></span>
                                  <span>Unit Price: <strong className="text-foreground">{formatPrice(Number(item.unit_price))}</strong></span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-primary">{formatPrice(Number(item.total_price))}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Order Summary */}
                      <div className="mt-4 pt-3 border-t border-border">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="font-medium">{formatPrice(Number(order.subtotal))}</span>
                        </div>
                        {order.shipping_price && (
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-muted-foreground">Shipping</span>
                            <span className="font-medium">{formatPrice(Number(order.shipping_price))}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-bold mt-2 pt-2 border-t border-border">
                          <span>Total</span>
                          <span className="text-primary">{formatPrice(Number(order.total_amount))}</span>
                        </div>
                      </div>
                    </div>

                    {/* Admin Notes */}
                    <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <StickyNote className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Admin Notes</span>
                      </div>
                      <div className="space-y-2">
                        <Textarea
                          value={adminNotes[order.id] ?? order.admin_notes ?? ''}
                          placeholder="Add internal notes about this order..."
                          className="text-sm min-h-[60px]"
                          onChange={(e) =>
                            setAdminNotes((prev) => ({ ...prev, [order.id]: e.target.value }))
                          }
                        />
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              saveAdminNotesMutation.mutate({
                                orderId: order.id,
                                notes: adminNotes[order.id] ?? order.admin_notes ?? '',
                              })
                            }
                            disabled={saveAdminNotesMutation.isPending}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Save Note
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="mb-4 rounded-lg border border-border bg-background p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">Fulfillment</p>
                          <p className="text-xs text-muted-foreground">
                            Stage: {(order.fulfillment_stage || 'new').replaceAll('_', ' ')}
                            {order.courier_name ? ` - ${order.courier_name}` : ''}
                            {order.courier_tracking_number ? ` - ${order.courier_tracking_number}` : ''}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openFulfillmentDialog(order)}
                        >
                          <PackageCheck className="h-4 w-4 mr-1" />
                          Fulfillment
                        </Button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {/* Status Update with Custom Note */}
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <Select
                            value={order.status || 'pending'}
                            onValueChange={(value) => updateStatusMutation.mutate({ 
                              orderId: order.id, 
                              status: value as OrderStatus,
                              userId: order.user_id,
                              orderNumber: order.order_number,
                              customNote: statusNotes[order.id] || undefined,
                              customerEmail: order.profiles?.email,
                              customerName: order.profiles?.name,
                            })}
                            disabled={updateStatusMutation.isPending}
                          >
                            <SelectTrigger className="w-full sm:w-52">
                              <SelectValue placeholder="Update status" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover z-50">
                              {ORDER_STATUS_OPTIONS.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {STATUS_LABELS[status]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {templates.length > 0 && (
                          <Select
                            value=""
                            onValueChange={(templateId) => {
                              const tpl = templates.find((t) => t.id === templateId);
                              if (!tpl) return;
                              setStatusNotes((prev) => ({
                                ...prev,
                                [order.id]: prev[order.id]
                                  ? `${prev[order.id]} ${tpl.content}`
                                  : tpl.content,
                              }));
                              toast.success(`Inserted template: ${tpl.name}`);
                            }}
                          >
                            <SelectTrigger className="w-full sm:w-52 text-sm">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                                <SelectValue placeholder="Insert template..." />
                              </div>
                            </SelectTrigger>
                            <SelectContent className="bg-popover z-50 max-h-72">
                              {templates.map((tpl) => (
                                <SelectItem key={tpl.id} value={tpl.id}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{tpl.name}</span>
                                    <span className="text-xs text-muted-foreground line-clamp-1">
                                      {tpl.content}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Input
                          placeholder="Add a note for the customer (optional)..."
                          value={statusNotes[order.id] || ''}
                          onChange={(e) => setStatusNotes(prev => ({ ...prev, [order.id]: e.target.value }))}
                          className="text-sm"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              addCustomerNoteMutation.mutate({
                                orderId: order.id,
                                orderStatus: order.status as OrderStatus,
                                note: statusNotes[order.id] || '',
                                userId: order.user_id,
                                customerEmail: order.profiles?.email,
                                customerName: order.profiles?.name,
                                orderNumber: order.order_number,
                              })
                            }
                            disabled={!statusNotes[order.id]?.trim() || addCustomerNoteMutation.isPending}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Note
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const content = (statusNotes[order.id] || '').trim();
                              if (!content) {
                                toast.error('Type a note before saving a template');
                                return;
                              }

                              const defaultName = `${STATUS_LABELS[order.status as OrderStatus]} Note`;
                              const name = window.prompt('Template name', defaultName)?.trim();
                              if (!name) return;

                              await saveTemplateMutation.mutateAsync({
                                name,
                                content,
                                category: 'Order Updates',
                              });
                              toast.success('Template saved');
                            }}
                            disabled={!statusNotes[order.id]?.trim() || saveTemplateMutation.isPending}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Save as Template
                          </Button>
                        </div>
                      </div>

                      {/* Set Estimated Delivery Dialog */}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setDeliveryDates({
                              orderId: order.id,
                              start: order.estimated_delivery_start || '',
                              end: order.estimated_delivery_end || ''
                            })}
                          >
                            <Calendar className="h-4 w-4 mr-1" />
                            Set Delivery
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto bg-background">
                          <DialogHeader>
                            <DialogTitle>Set Estimated Delivery for #{order.order_number}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Estimated Delivery Start</Label>
                              <Input
                                type="date"
                                value={deliveryDates.orderId === order.id ? deliveryDates.start : order.estimated_delivery_start || ''}
                                onChange={(e) => setDeliveryDates(prev => ({ ...prev, orderId: order.id, start: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Estimated Delivery End</Label>
                              <Input
                                type="date"
                                value={deliveryDates.orderId === order.id ? deliveryDates.end : order.estimated_delivery_end || ''}
                                onChange={(e) => setDeliveryDates(prev => ({ ...prev, orderId: order.id, end: e.target.value }))}
                              />
                            </div>
                            <Button
                              onClick={() => updateDeliveryDatesMutation.mutate({
                                orderId: order.id,
                                startDate: deliveryDates.start,
                                endDate: deliveryDates.end,
                                userId: order.user_id,
                                orderNumber: order.order_number,
                                customerEmail: order.profiles?.email,
                                customerName: order.profiles?.name,
                              })}
                              disabled={!deliveryDates.start || !deliveryDates.end || updateDeliveryDatesMutation.isPending}
                              className="w-full"
                            >
                              {updateDeliveryDatesMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : null}
                              Save Delivery Dates
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-background">
                          <DialogHeader>
                            <DialogTitle>Order #{order.order_number}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <h4 className="mb-2 font-semibold">Order Items</h4>
                              <div className="space-y-2">
                                {order.order_items?.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-3"
                                  >
                                    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-background">
                                      {item.image_url ? (
                                        <img
                                          src={item.image_url}
                                          alt={item.product_name}
                                          className="h-full w-full object-cover"
                                          loading="lazy"
                                        />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                          <Package className="h-4 w-4" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-foreground">{item.product_name}</p>
                                      {item.variant_details && (
                                        <p className="mt-1 text-sm text-primary">Variant: {item.variant_details}</p>
                                      )}
                                      <p className="mt-1 text-sm text-muted-foreground">
                                        Qty {item.quantity} at {formatPrice(Number(item.unit_price))}
                                      </p>
                                    </div>
                                    <p className="text-sm font-semibold text-primary">
                                      {formatPrice(Number(item.total_price))}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold mb-2">Shipping Address</h4>
                              {getShippingAddress(order.shipping_address) ? (
                                <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                                  <p className="font-medium text-foreground">{getShippingAddress(order.shipping_address)?.full_name}</p>
                                  <p>{getShippingAddress(order.shipping_address)?.address_line1}</p>
                                  {getShippingAddress(order.shipping_address)?.address_line2 && <p>{getShippingAddress(order.shipping_address)?.address_line2}</p>}
                                  <p>{getShippingAddress(order.shipping_address)?.city}, {getShippingAddress(order.shipping_address)?.state} {getShippingAddress(order.shipping_address)?.postal_code}</p>
                                  <p>{getShippingAddress(order.shipping_address)?.country}</p>
                                  <p className="mt-2">Phone: {getShippingAddress(order.shipping_address)?.phone}</p>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">No address provided</p>
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold mb-2">Tracking History</h4>
                              <div className="space-y-2">
                                {order.order_tracking?.length > 0 ? (
                                  order.order_tracking?.map((track) => (
                                    <div key={track.id} className="p-2 bg-muted rounded text-sm">
                                      <p className="font-medium">{track.status}</p>
                                      <p className="text-muted-foreground">{track.location_name}</p>
                                      {track.notes && <p className="text-muted-foreground">{track.notes}</p>}
                                      <p className="text-xs text-muted-foreground">
                                        {format(new Date(track.created_at), 'PPp')}
                                      </p>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm text-muted-foreground">No tracking updates yet</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRefundDialog(order)}
                        disabled={order.status === 'refunded' || processRefundMutation.isPending}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        {order.refund_request ? 'Process Refund' : 'Manual Refund'}
                      </Button>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MapPin className="h-4 w-4 mr-1" />
                            Add Tracking
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto bg-background">
                          <DialogHeader>
                            <DialogTitle>Add Tracking Update</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Location / Description</Label>
                              <Input
                                value={trackingLocation.location}
                                onChange={(e) => setTrackingLocation(prev => ({ ...prev, location: e.target.value }))}
                                placeholder="e.g., Arrived at warehouse"
                              />
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Courier Name (optional)</Label>
                                <Input
                                  value={trackingLocation.courierName}
                                  onChange={(e) => setTrackingLocation(prev => ({ ...prev, courierName: e.target.value }))}
                                  placeholder="e.g., DHL, FedEx"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Courier Tracking # (optional)</Label>
                                <Input
                                  value={trackingLocation.courierTrackingNumber}
                                  onChange={(e) => setTrackingLocation(prev => ({ ...prev, courierTrackingNumber: e.target.value }))}
                                  placeholder="e.g., DHL123456"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Delivery Fee (optional)</Label>
                              <Input
                                value={trackingLocation.deliveryFee}
                                onChange={(e) => setTrackingLocation(prev => ({ ...prev, deliveryFee: e.target.value }))}
                                placeholder="e.g., 50.00"
                              />
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Latitude (optional)</Label>
                                <Input
                                  type="number"
                                  value={trackingLocation.lat}
                                  onChange={(e) => setTrackingLocation(prev => ({ ...prev, lat: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Longitude (optional)</Label>
                                <Input
                                  type="number"
                                  value={trackingLocation.lng}
                                  onChange={(e) => setTrackingLocation(prev => ({ ...prev, lng: e.target.value }))}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Notes for Customer</Label>
                              <Textarea
                                value={trackingLocation.notes}
                                onChange={(e) => setTrackingLocation(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Custom note visible to the customer..."
                                rows={2}
                              />
                            </div>
                            <Button
                              onClick={() => {
                                // Build comprehensive notes
                                let fullNotes = trackingLocation.notes || '';
                                if (trackingLocation.courierName) {
                                  fullNotes = `[${trackingLocation.courierName}] ${fullNotes}`;
                                }
                                if (trackingLocation.courierTrackingNumber) {
                                  fullNotes += ` Tracking: ${trackingLocation.courierTrackingNumber}`;
                                }
                                if (trackingLocation.deliveryFee) {
                                  fullNotes += ` | Delivery fee: GHS ${trackingLocation.deliveryFee}`;
                                }
                                addTrackingMutation.mutate({
                                  orderId: order.id,
                                  status: order.status || 'pending',
                                  location_name: trackingLocation.location,
                                  latitude: trackingLocation.lat ? parseFloat(trackingLocation.lat) : undefined,
                                  longitude: trackingLocation.lng ? parseFloat(trackingLocation.lng) : undefined,
                                  notes: fullNotes.trim() || undefined,
                                  courierName: trackingLocation.courierName || undefined,
                                  courierTrackingNumber: trackingLocation.courierTrackingNumber || undefined,
                                  deliveryFee: trackingLocation.deliveryFee ? parseFloat(trackingLocation.deliveryFee) : undefined,
                                });
                              }}
                              disabled={!trackingLocation.location}
                            >
                              Add Tracking
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                  </CollapsibleContent>
                  </Collapsible>
                </Card>
                </SwipeableOrderCard>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedRefundOrder} onOpenChange={(open) => !open && resetRefundDialog()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-background sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedRefundOrder?.refund_request ? 'Process Refund' : 'Manual Refund'}
              {selectedRefundOrder ? ` for #${selectedRefundOrder.order_number}` : ''}
            </DialogTitle>
          </DialogHeader>

          {selectedRefundOrder && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Refund Summary</p>
                    <p className="text-sm text-muted-foreground">
                      Order total: {formatPrice(Number(selectedRefundOrder.total_amount))}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Customer: {selectedRefundOrder.profiles?.name || 'Unknown'}
                    </p>
                  </div>
                  {selectedRefundOrder.refund_request ? (
                    <Badge variant="secondary">
                      {getRefundStatusLabel(selectedRefundOrder.refund_request.status)}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Manual refund</Badge>
                  )}
                </div>

                {selectedRefundOrder.refund_request ? (
                  <div className="mt-3 space-y-2 text-sm">
                    <p>
                      <span className="font-medium text-foreground">Requested amount:</span>{' '}
                      {formatPrice(
                        Number(
                          selectedRefundOrder.refund_request.refund_amount || selectedRefundOrder.total_amount,
                        ),
                      )}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Reason:</span>{' '}
                      {selectedRefundOrder.refund_request.reason}
                    </p>
                    {selectedRefundOrder.refund_request.details && (
                      <p className="text-muted-foreground">{selectedRefundOrder.refund_request.details}</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    This order has no customer refund request yet. Processing here will mark the order as refunded,
                    add a tracking update, and notify the customer.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="refund-channel">Refund route</Label>
                <Select
                  value={refundDraft.refundChannel}
                  onValueChange={(value) =>
                    setRefundDraft((prev) => ({ ...prev, refundChannel: value as RefundChannel }))
                  }
                >
                  <SelectTrigger id="refund-channel">
                    <SelectValue placeholder="Select refund route" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="original_payment">Original payment method</SelectItem>
                    <SelectItem value="wallet_credit">Wallet credit only</SelectItem>
                    <SelectItem value="mixed">Mixed refund + wallet credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {refundDraft.refundChannel !== 'original_payment' && (
                <div className="space-y-2">
                  <Label htmlFor="refund-wallet-credit">Wallet credit amount</Label>
                  <Input
                    id="refund-wallet-credit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={refundDraft.walletCreditAmount}
                    onChange={(e) =>
                      setRefundDraft((prev) => ({ ...prev, walletCreditAmount: e.target.value }))
                    }
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Suggested for shipping or buffer adjustments:{' '}
                    {formatPrice(getSuggestedRefundWalletCredit(selectedRefundOrder))}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="refund-admin-notes">Admin notes</Label>
                <Textarea
                  id="refund-admin-notes"
                  value={refundDraft.adminNotes}
                  onChange={(e) => setRefundDraft((prev) => ({ ...prev, adminNotes: e.target.value }))}
                  placeholder="Add notes about how this refund was handled..."
                  rows={4}
                />
              </div>

              <Alert>
                <AlertDescription>
                  This records the refund in the order timeline and notifies the customer. Any original-payment
                  transfer still needs to be completed through your payment operations flow.
                </AlertDescription>
              </Alert>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={resetRefundDialog} disabled={processRefundMutation.isPending}>
                  Cancel
                </Button>
                <Button
                  onClick={() => processRefundMutation.mutate(selectedRefundOrder)}
                  disabled={processRefundMutation.isPending}
                >
                  {processRefundMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-2 h-4 w-4" />
                  )}
                  Process Refund
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedFulfillmentOrder} onOpenChange={(open) => !open && setSelectedFulfillmentOrder(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-background sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Fulfillment Details {selectedFulfillmentOrder ? `for #${selectedFulfillmentOrder.order_number}` : ''}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Fulfillment Stage</Label>
              <Select
                value={fulfillmentDraft.stage}
                onValueChange={(value) => setFulfillmentDraft((prev) => ({ ...prev, stage: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="new">Queued</SelectItem>
                  <SelectItem value="picked">Picked</SelectItem>
                  <SelectItem value="quality_checked">Quality Checked</SelectItem>
                  <SelectItem value="packed">Packed</SelectItem>
                  <SelectItem value="awaiting_dispatch">Awaiting Dispatch</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <Checkbox
                  checked={fulfillmentDraft.picked}
                  onCheckedChange={(checked) =>
                    setFulfillmentDraft((prev) => ({ ...prev, picked: !!checked }))
                  }
                />
                Picked from inventory
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <Checkbox
                  checked={fulfillmentDraft.quality_checked}
                  onCheckedChange={(checked) =>
                    setFulfillmentDraft((prev) => ({ ...prev, quality_checked: !!checked }))
                  }
                />
                Quality checked
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <Checkbox
                  checked={fulfillmentDraft.packed}
                  onCheckedChange={(checked) =>
                    setFulfillmentDraft((prev) => ({ ...prev, packed: !!checked }))
                  }
                />
                Packed
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <Checkbox
                  checked={fulfillmentDraft.awaiting_dispatch}
                  onCheckedChange={(checked) =>
                    setFulfillmentDraft((prev) => ({ ...prev, awaiting_dispatch: !!checked }))
                  }
                />
                Awaiting dispatch
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Courier Name</Label>
                <Input
                  value={fulfillmentDraft.courierName}
                  onChange={(e) => setFulfillmentDraft((prev) => ({ ...prev, courierName: e.target.value }))}
                  placeholder="DHL, local rider, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Courier Tracking Number</Label>
                <Input
                  value={fulfillmentDraft.courierTrackingNumber}
                  onChange={(e) => setFulfillmentDraft((prev) => ({ ...prev, courierTrackingNumber: e.target.value }))}
                  placeholder="Tracking reference"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Delivery Fee on Receipt</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={fulfillmentDraft.deliveryFee}
                onChange={(e) => setFulfillmentDraft((prev) => ({ ...prev, deliveryFee: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Proof of Delivery Note</Label>
              <Textarea
                value={fulfillmentDraft.proofNote}
                onChange={(e) => setFulfillmentDraft((prev) => ({ ...prev, proofNote: e.target.value }))}
                placeholder="Who received it, condition, signature note, etc."
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Recipient Name</Label>
                <Input
                  value={fulfillmentDraft.recipientName}
                  onChange={(e) => setFulfillmentDraft((prev) => ({ ...prev, recipientName: e.target.value }))}
                  placeholder="Name of person who received the order"
                />
              </div>
              <div className="space-y-2">
                <Label>Recipient Phone</Label>
                <Input
                  value={fulfillmentDraft.recipientPhone}
                  onChange={(e) => setFulfillmentDraft((prev) => ({ ...prev, recipientPhone: e.target.value }))}
                  placeholder="Phone used at handoff"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Recipient Relationship</Label>
                <Input
                  value={fulfillmentDraft.recipientRelationship}
                  onChange={(e) => setFulfillmentDraft((prev) => ({ ...prev, recipientRelationship: e.target.value }))}
                  placeholder="Customer, spouse, receptionist, security, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Typed Signature</Label>
                <Input
                  value={fulfillmentDraft.signatureName}
                  onChange={(e) => setFulfillmentDraft((prev) => ({ ...prev, signatureName: e.target.value }))}
                  placeholder="Type receiver's signature name"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
              <Checkbox
                checked={fulfillmentDraft.courierConfirmed}
                onCheckedChange={(checked) =>
                  setFulfillmentDraft((prev) => ({ ...prev, courierConfirmed: !!checked }))
                }
              />
              Courier handoff confirmed
            </label>

            <div className="space-y-2">
              <Label>Proof Verification Code</Label>
              <Input
                value={fulfillmentDraft.verificationCode}
                onChange={(e) => setFulfillmentDraft((prev) => ({ ...prev, verificationCode: e.target.value.toUpperCase() }))}
                placeholder="Auto-generated on save if left blank"
              />
            </div>

            <div className="space-y-2">
              <Label>Proof of Delivery Image Path or URL</Label>
              <Input
                value={fulfillmentDraft.proofImageUrl}
                onChange={(e) => setFulfillmentDraft((prev) => ({ ...prev, proofImageUrl: e.target.value }))}
                placeholder="Stored proof path or an external backup URL"
              />
              <input
                ref={proofUploadInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProofFileSelected}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => proofUploadInputRef.current?.click()}
                  disabled={isUploadingProof}
                >
                  {isUploadingProof ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Upload Proof Image
                </Button>
                {proofImagePreviewUrl && (
                  <a
                    href={proofImagePreviewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-sm text-primary underline"
                  >
                    Preview upload
                  </a>
                )}
              </div>
            </div>

            <Button
              onClick={() => saveFulfillmentMutation.mutate()}
              disabled={saveFulfillmentMutation.isPending}
              className="w-full"
            >
              {saveFulfillmentMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PackageCheck className="h-4 w-4 mr-2" />
              )}
              Save Fulfillment Details
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
