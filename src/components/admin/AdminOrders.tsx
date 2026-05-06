import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { toast } from 'sonner';
import { Loader2, Eye, MapPin, Package, Calendar, Clock, CreditCard, ShoppingBag, PackageCheck, Truck, Plane, MapPinned, Home, CheckCircle, XCircle, RotateCcw, Search, Download, StickyNote, CheckSquare, BellRing, MessageSquare, Plus } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { useCurrency } from '@/hooks/useCurrency';
import { useMessageTemplates, useSaveTemplate } from '@/hooks/useMessageTemplates';
import { SwipeableOrderCard } from './SwipeableOrderCard';
import { SwipeHintOverlay } from './SwipeHintOverlay';
import { useAuth } from '@/contexts/AuthContext';
import { logAdminAction } from '@/lib/audit-log';
import { generateProofVerificationCode, uploadProofOfDelivery } from '@/lib/proof-of-delivery';
import {
  buildDeliveryWindowEmailHtml,
  buildDeliveryWindowEmailSubject,
  buildDeliveryWindowEmailText,
  buildOrderStatusEmailHtml,
  buildOrderStatusEmailSubject,
  buildOrderStatusEmailText,
} from '@/lib/email-templates';

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

const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  'pending',
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
  icon: any;
  statuses: OrderStatus[];
}

const STATUS_TABS: StatusTabConfig[] = [
  { value: 'all', label: 'All Orders', icon: Package, statuses: ORDER_STATUSES as unknown as OrderStatus[] },
  { value: 'pending', label: 'Pending', icon: Clock, statuses: ['pending'] },
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

export function AdminOrders() {
  const queryClient = useQueryClient();
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const { data: templates = [] } = useMessageTemplates();
  const saveTemplateMutation = useSaveTemplate();
  const proofUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [trackingLocation, setTrackingLocation] = useState({ lat: '', lng: '', location: '', notes: '', courierName: '', courierTrackingNumber: '', deliveryFee: '' });
  const [deliveryDates, setDeliveryDates] = useState<{ orderId: string; start: string; end: string }>({ orderId: '', start: '', end: '' });
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [statusNotes, setStatusNotes] = useState<Record<string, string>>({});
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [selectedFulfillmentOrder, setSelectedFulfillmentOrder] = useState<any>(null);
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

  // Real-time subscription for new/updated orders
  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
          setNewOrderAlert(true);
          toast.success('🛍️ New order received!', { duration: 5000 });
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
  }, [queryClient]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async (): Promise<any[]> => {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            id,
            product_name,
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
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const userIds = [...new Set(ordersData?.map(o => o.user_id) || [])];
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, name, email')
          .in('user_id', userIds);

        const profilesMap = new Map(
          profilesData?.map(p => [p.user_id, p]) || []
        );

        return ordersData?.map(order => ({
          ...order,
          profiles: profilesMap.get(order.user_id) || null
        })) || [];
      }

      return ordersData || [];
    },
  });

  const filteredOrders = orders?.filter(order => {
    // Tab filter
    const tabMatch = activeTab === 'all' || STATUS_TABS.find(t => t.value === activeTab)?.statuses.includes(order.status as OrderStatus);
    if (!tabMatch) return false;
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (order.profiles as any)?.name?.toLowerCase() || '';
      const email = (order.profiles as any)?.email?.toLowerCase() || '';
      const orderNum = order.order_number?.toLowerCase() || '';
      return name.includes(q) || email.includes(q) || orderNum.includes(q);
    }
    return true;
  }) || [];

  const getOrderCountForTab = (tabValue: string) => {
    if (tabValue === 'all') return orders?.length || 0;
    const tabConfig = STATUS_TABS.find(t => t.value === tabValue);
    return orders?.filter(o => tabConfig?.statuses.includes(o.status as OrderStatus)).length || 0;
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
      const { error } = await supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      
      if (error) {
        console.error('Update error:', error);
        throw error;
      }

      // Auto-create tracking entry with note
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
        ? (autoNotes[status] ? `${autoNotes[status]} — ${customNote}` : customNote)
        : (autoNotes[status] || '');

      await supabase.from('order_tracking').insert({
        order_id: orderId,
        status: status,
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

      if (userId) {
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
      }

      const emailResult = await sendTransactionalEmail({
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
        },
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
        const { error: orderUpdateError } = await (supabase as any)
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

      const { error } = await (supabase as any)
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

  const openFulfillmentDialog = (order: any) => {
    const checks =
      order.fulfillment_checks && typeof order.fulfillment_checks === 'object'
        ? order.fulfillment_checks
        : {};

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
      proofImageUrl: order.proof_of_delivery_image_url || '',
      recipientName: order.proof_of_delivery_recipient_name || '',
      recipientPhone: order.proof_of_delivery_recipient_phone || '',
      recipientRelationship: order.proof_of_delivery_relationship || '',
      signatureName: order.proof_of_delivery_signature_name || '',
      verificationCode: order.proof_of_delivery_verification_code || '',
      courierConfirmed: Boolean(order.courier_confirmed_at),
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
      const publicUrl = await uploadProofOfDelivery(selectedFulfillmentOrder.id, file);
      setFulfillmentDraft((prev) => ({ ...prev, proofImageUrl: publicUrl }));
      toast.success('Proof image uploaded');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to upload proof image');
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
          <AlertDescription className="flex items-center justify-between">
            <span className="text-green-700 font-medium">New order received! The list has been updated.</span>
            <Button variant="ghost" size="sm" onClick={() => setNewOrderAlert(false)}>Dismiss</Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold font-serif text-foreground">Orders Management</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const data = filteredOrders.map(o => ({
                'Order Number': o.order_number,
                'Customer': (o.profiles as any)?.name || 'Unknown',
                'Email': (o.profiles as any)?.email || '',
                'Status': STATUS_LABELS[o.status as OrderStatus] || o.status,
                'Total': Number(o.total_amount).toFixed(2),
                'Date': format(new Date(o.created_at), 'yyyy-MM-dd HH:mm'),
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
          <TabsList className="inline-flex h-auto p-1 gap-1">
            {STATUS_TABS.map((tab) => {
              const Icon = tab.icon;
              const count = getOrderCountForTab(tab.value);
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
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
              filteredOrders.map((order) => {
                const currentIdx = ORDER_STATUSES.indexOf(order.status as OrderStatus);
                const nextStatus = currentIdx >= 0 && currentIdx < ORDER_STATUSES.length - 1
                  ? ORDER_STATUSES[currentIdx + 1]
                  : undefined;
                const prevStatus = currentIdx > 0 ? ORDER_STATUSES[currentIdx - 1] : undefined;
                return (
                <SwipeableOrderCard
                  key={order.id}
                  rightLabel={nextStatus ? `→ ${STATUS_LABELS[nextStatus]}` : 'No next status'}
                  leftLabel={prevStatus ? `${STATUS_LABELS[prevStatus]} ←` : 'No previous status'}
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
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedOrders.has(order.id)}
                        onChange={(e) => {
                          const next = new Set(selectedOrders);
                          if (e.target.checked) next.add(order.id);
                          else next.delete(order.id);
                          setSelectedOrders(next);
                        }}
                        className="h-4 w-4 rounded border-border"
                      />
                      <div className="flex items-center justify-between flex-1">
                        <CardTitle className="text-lg font-medium">
                          Order #{order.order_number}
                        </CardTitle>
                        <Badge className={getStatusColor(order.status || 'pending')}>
                          {STATUS_LABELS[order.status as OrderStatus] || order.status?.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Customer</p>
                        <p className="font-medium text-foreground">
                          {(order.profiles as any)?.name || 'Unknown'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {(order.profiles as any)?.email}
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
                    </div>

                    {/* Order Items with Full Details */}
                    <div className="mb-4 p-4 bg-muted rounded-lg">
                      <p className="text-sm font-semibold text-foreground mb-3">Order Items:</p>
                      <div className="space-y-3">
                        {order.order_items?.map((item: any) => (
                          <div key={item.id} className="flex justify-between items-start p-3 bg-background rounded-lg border border-border">
                            <div className="flex-1">
                              <p className="font-medium text-foreground">{item.product_name}</p>
                              {item.variant_details && (
                                <p className="text-sm text-primary mt-1">
                                  Variant: {item.variant_details}
                                </p>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span>Qty: <strong className="text-foreground">{item.quantity}</strong></span>
                                <span>Unit Price: <strong className="text-foreground">{formatPrice(Number(item.unit_price))}</strong></span>
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
                            {order.courier_name ? ` • ${order.courier_name}` : ''}
                            {order.courier_tracking_number ? ` • ${order.courier_tracking_number}` : ''}
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
                    <div className="flex flex-wrap gap-2">
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
                                <SelectValue placeholder="Insert template…" />
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
                        <DialogContent className="bg-background">
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
                        <DialogContent className="max-w-2xl bg-background">
                          <DialogHeader>
                            <DialogTitle>Order #{order.order_number}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-semibold mb-2">Shipping Address</h4>
                              {order.shipping_address ? (
                                <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                                  <p className="font-medium text-foreground">{(order.shipping_address as any)?.full_name}</p>
                                  <p>{(order.shipping_address as any)?.address_line1}</p>
                                  {(order.shipping_address as any)?.address_line2 && <p>{(order.shipping_address as any)?.address_line2}</p>}
                                  <p>{(order.shipping_address as any)?.city}, {(order.shipping_address as any)?.state} {(order.shipping_address as any)?.postal_code}</p>
                                  <p>{(order.shipping_address as any)?.country}</p>
                                  <p className="mt-2">Phone: {(order.shipping_address as any)?.phone}</p>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">No address provided</p>
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold mb-2">Tracking History</h4>
                              <div className="space-y-2">
                                {order.order_tracking?.length > 0 ? (
                                  order.order_tracking?.map((track: any) => (
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

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MapPin className="h-4 w-4 mr-1" />
                            Add Tracking
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-background">
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
                            <div className="grid grid-cols-2 gap-2">
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
                            <div className="grid grid-cols-2 gap-2">
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
                                  fullNotes += ` | Delivery fee: ₵${trackingLocation.deliveryFee}`;
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
                </Card>
                </SwipeableOrderCard>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedFulfillmentOrder} onOpenChange={(open) => !open && setSelectedFulfillmentOrder(null)}>
        <DialogContent className="bg-background sm:max-w-xl">
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
              <Label>Proof of Delivery Image URL</Label>
              <Input
                value={fulfillmentDraft.proofImageUrl}
                onChange={(e) => setFulfillmentDraft((prev) => ({ ...prev, proofImageUrl: e.target.value }))}
                placeholder="Paste an uploaded photo URL if available"
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
                {fulfillmentDraft.proofImageUrl && (
                  <a
                    href={fulfillmentDraft.proofImageUrl}
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
