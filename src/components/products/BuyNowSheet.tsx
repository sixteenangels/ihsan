import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  Minus,
  Package,
  Plus,
  Ship,
  Truck,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/hooks/useCurrency';
import { useIsMobile } from '@/hooks/use-mobile';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import type { ProductWithDetails } from '@/hooks/useProducts';
import { getErrorMessage } from '@/lib/errors';
import { hasRequiredGroupBuyDeliveryDetails } from '@/lib/groupBuyCheckout';
import { loadPaystack, type PaystackTransactionResponse } from '@/lib/paystack';
import { trackRecommendationEvent } from '@/lib/recommendationEvents';
import { toast } from 'sonner';

interface SelectedVariantChoice {
  id: string;
  size: string | null;
  color: string | null;
  price: number;
  stock: number | null;
  quantity: number;
}

interface Address {
  id: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state?: string | null;
  country: string;
  postal_code?: string | null;
  is_default: boolean;
  label?: string | null;
}

interface BuyNowSheetProps {
  product: ProductWithDetails;
  selectedVariants: SelectedVariantChoice[];
  selectedShippingRuleId?: string | null;
  triggerClassName?: string;
  triggerSize?: React.ComponentProps<typeof Button>['size'];
}

interface NewAddressFormState {
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  label: string;
}

const EMPTY_ADDRESS_FORM: NewAddressFormState = {
  full_name: '',
  phone: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  country: '',
  postal_code: '',
  label: '',
};

function buildVariantLabel(variant: { color: string | null; size: string | null }) {
  return [variant.color, variant.size].filter(Boolean).join(' / ') || 'Standard option';
}

function getShippingIcon(name: string | undefined) {
  const normalized = name?.toLowerCase() || '';

  if (normalized.includes('sea')) {
    return Ship;
  }

  if (normalized.includes('courier')) {
    return Truck;
  }

  return Package;
}

export function BuyNowSheet({
  product,
  selectedVariants,
  selectedShippingRuleId,
  triggerClassName,
  triggerSize = 'sm',
}: BuyNowSheetProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { data: storeSettings } = useStoreSettings();
  const isMobile = useIsMobile();
  const callbackFiredRef = useRef(false);
  const orderCreationInProgressRef = useRef(false);

  const availableShippingRules = useMemo(
    () => product.shipping_rules.filter((rule) => rule.is_allowed && rule.shipping_class),
    [product.shipping_rules],
  );
  const requiresVariantSelection = product.variants.length > 0;
  const seededVariant = selectedVariants.length === 1 ? selectedVariants[0] : null;

  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    seededVariant?.id ?? (product.variants.length === 1 ? product.variants[0].id : null),
  );
  const [quantity, setQuantity] = useState<number>(Math.max(1, seededVariant?.quantity ?? 1));
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [selectedShippingId, setSelectedShippingId] = useState<string>(
    selectedShippingRuleId || (availableShippingRules.length === 1 ? availableShippingRules[0].id : ''),
  );
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState<NewAddressFormState>(EMPTY_ADDRESS_FORM);

  const {
    data: addresses = [],
    isLoading: addressesLoading,
    refetch: refetchAddresses,
  } = useQuery({
    queryKey: ['buy-now-addresses', user?.id],
    queryFn: async () => {
      if (!user) return [] as Address[];

      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as Address[];
    },
    enabled: !!user,
  });

  const defaultAddress = useMemo(
    () => addresses.find((address) => address.is_default) || null,
    [addresses],
  );
  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId) || null,
    [addresses, selectedAddressId],
  );
  const resolvedAddress = selectedAddress || defaultAddress;
  const selectedVariant =
    product.variants.find((variant) => variant.id === selectedVariantId) || null;
  const selectedShippingRule =
    availableShippingRules.find((rule) => rule.id === selectedShippingId) || null;
  const resolvedShippingRule =
    selectedShippingRule || (availableShippingRules.length === 1 ? availableShippingRules[0] : null);
  const effectiveShippingCost =
    product.is_free_shipping || !resolvedShippingRule ? 0 : Number(resolvedShippingRule.price || 0);
  const unitPrice = selectedVariant?.price ?? product.base_price;
  const subtotal = unitPrice * quantity;
  const total = subtotal + effectiveShippingCost;
  const variantLabel = selectedVariant ? buildVariantLabel(selectedVariant) : 'Choose a variant';
  const addressLabel = resolvedAddress
    ? [resolvedAddress.full_name, resolvedAddress.city, resolvedAddress.country]
        .filter(Boolean)
        .join(', ')
    : 'Choose a delivery address';
  const shippingLabel = resolvedShippingRule?.shipping_class
    ? `${resolvedShippingRule.shipping_class.name} (${resolvedShippingRule.shipping_class.estimated_days_min}-${resolvedShippingRule.shipping_class.estimated_days_max} days)`
    : 'Choose a shipping method';
  const hasValidAddressSelection = hasRequiredGroupBuyDeliveryDetails({
    address: resolvedAddress,
    email: user?.email,
  });
  const variantMissing = requiresVariantSelection && !selectedVariant;
  const addressMissing = !hasValidAddressSelection;
  const shippingMissing = availableShippingRules.length > 0 && !resolvedShippingRule;
  const hasMissingRequirements = variantMissing || addressMissing || shippingMissing;

  useEffect(() => {
    if (isOpen) {
      return;
    }

    setSelectedVariantId(
      selectedVariants.length === 1
        ? selectedVariants[0].id
        : product.variants.length === 1
          ? product.variants[0].id
          : null,
    );
    setQuantity(Math.max(1, selectedVariants.length === 1 ? selectedVariants[0].quantity : 1));
    setSelectedShippingId(
      selectedShippingRuleId || (availableShippingRules.length === 1 ? availableShippingRules[0].id : ''),
    );
  }, [availableShippingRules, isOpen, product.variants, selectedShippingRuleId, selectedVariants]);

  useEffect(() => {
    if (!defaultAddress) {
      return;
    }

    setSelectedAddressId((current) => current || defaultAddress.id);
  }, [defaultAddress]);

  useEffect(() => {
    if (addresses.length === 0) {
      setShowAddressForm(true);
    }
  }, [addresses.length]);

  const resolveDefaultOrSelectedAddress = async () => {
    if (selectedAddress) {
      return selectedAddress;
    }

    if (defaultAddress) {
      setSelectedAddressId(defaultAddress.id);
      return defaultAddress;
    }

    const refreshed = await refetchAddresses();
    const nextAddresses = refreshed.data || [];
    const nextDefaultAddress = nextAddresses.find((address) => address.is_default) || null;

    if (nextDefaultAddress) {
      setSelectedAddressId(nextDefaultAddress.id);
    }

    return nextDefaultAddress;
  };

  const resetInlineAddressForm = () => {
    setNewAddress(EMPTY_ADDRESS_FORM);
    setShowAddressForm(addresses.length === 0);
  };

  const handleOpenQuickCheckout = async () => {
    if (!user) {
      toast.info('Please sign in to use instant checkout.');
      navigate('/auth');
      return;
    }

    const resolvedAddress = await resolveDefaultOrSelectedAddress();
    const readyForDirectPay =
      (!requiresVariantSelection || !!selectedVariant) &&
      hasRequiredGroupBuyDeliveryDetails({
        address: resolvedAddress,
        email: user?.email,
      }) &&
        (!!resolvedShippingRule || availableShippingRules.length === 1);

    if (availableShippingRules.length === 1 && !selectedShippingId) {
      setSelectedShippingId(availableShippingRules[0].id);
    }

    if (readyForDirectPay) {
      await handlePayNow({
        address: resolvedAddress,
        shippingRule: resolvedShippingRule || availableShippingRules[0] || null,
        variant: selectedVariant,
      });
      return;
    }

    setIsOpen(true);
  };

  const handleAddressSave = async () => {
    if (!user) {
      toast.error('Please sign in to add an address.');
      return;
    }

    if (
      !newAddress.full_name ||
      !newAddress.phone ||
      !newAddress.address_line1 ||
      !newAddress.city ||
      !newAddress.country
    ) {
      toast.error('Fill in the required address fields.');
      return;
    }

    const isFirstAddress = addresses.length === 0;
    const { data, error } = await supabase
      .from('addresses')
      .insert({
        ...newAddress,
        user_id: user.id,
        is_default: isFirstAddress,
      })
      .select()
      .single();

    if (error) {
      toast.error('Could not save the address.');
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['buy-now-addresses', user.id] });
    setSelectedAddressId(data.id);
    setShowAddressForm(false);
    setNewAddress(EMPTY_ADDRESS_FORM);
    toast.success('Address saved.');
  };

  const finalizeOrder = async (
    paymentReference: string | null,
    orderAddress: Address,
    shippingRule: ProductWithDetails['shipping_rules'][number] | null,
    variant: ProductWithDetails['variants'][number] | null,
  ) => {
    try {
      const estimatedDaysMin = shippingRule?.shipping_class?.estimated_days_min || 7;
      const estimatedDaysMax = shippingRule?.shipping_class?.estimated_days_max || 14;
      const shippingPrice = product.is_free_shipping ? 0 : Number(shippingRule?.price || 0);

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            order_number: `AJYN-${Date.now()}`,
            user_id: user?.id as string,
            subtotal,
            shipping_price: shippingPrice,
            total_amount: total,
            shipping_class_id: shippingRule?.shipping_class_id || null,
            shipping_address: JSON.parse(JSON.stringify(orderAddress)),
            status: 'payment_received' as const,
            payment_reference: paymentReference,
            notes: 'Instant checkout via Buy Now',
            estimated_delivery_start: new Date(
              Date.now() + estimatedDaysMin * 24 * 60 * 60 * 1000,
            )
              .toISOString()
              .split('T')[0],
            estimated_delivery_end: new Date(
              Date.now() + estimatedDaysMax * 24 * 60 * 60 * 1000,
            )
              .toISOString()
              .split('T')[0],
            packaging_type: null,
            packaging_cost: 0,
            wallet_credit_used: 0,
          },
        ])
        .select()
        .single();

      if (orderError) throw orderError;

      const { error: orderItemError } = await supabase.from('order_items').insert({
        order_id: order.id,
        product_id: product.id,
        product_variant_id: variant?.id || null,
        product_name: product.name,
        variant_details: variant ? buildVariantLabel(variant) : 'Standard option',
        quantity,
        unit_price: unitPrice,
        total_price: subtotal,
      });

      if (orderItemError) throw orderItemError;

      await supabase.from('order_tracking').insert({
        order_id: order.id,
        status: 'payment_received',
        location_name: paymentReference ? 'Payment Gateway' : 'Instant Checkout',
        notes: paymentReference
          ? 'Payment verified successfully via Buy Now.'
          : 'Order completed without gateway payment.',
      });

      trackRecommendationEvent({
        productId: product.id,
        eventType: 'order_complete',
        source: 'buy_now',
        weight: quantity,
        productVariantId: variant?.id || null,
        orderId: order.id,
      });

      try {
        const loyaltyEnabled = storeSettings?.loyaltyEnabled !== false;
        const pointsPerGhs =
          typeof storeSettings?.loyaltyPointsPerOrder === 'number'
            ? storeSettings.loyaltyPointsPerOrder
            : 1;
        const minAmount =
          typeof storeSettings?.loyaltyMinOrderAmount === 'number'
            ? storeSettings.loyaltyMinOrderAmount
            : 0;

        if (loyaltyEnabled && total >= minAmount && user?.id) {
          const pointsToAward = Math.floor(total * pointsPerGhs);
          if (pointsToAward > 0) {
            await supabase.from('loyalty_points').insert({
              user_id: user.id,
              points: pointsToAward,
              type: 'earn',
              description: `Order #${order.order_number} - ${pointsToAward} points earned`,
              order_id: order.id,
            });
          }
        }
      } catch (loyaltyError) {
        console.error('Buy now loyalty award failed:', loyaltyError);
      }

      try {
        const { data: adminRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['admin', 'manager']);

        if (adminRoles?.length) {
          await supabase.from('notifications').insert(
            adminRoles.map((role) => ({
              user_id: role.user_id,
              title: 'New Buy Now Order',
              message: `${product.name} instant checkout placed for ${formatPrice(total)}.`,
              type: 'new_order',
              data: {
                orderId: order.id,
                orderNumber: order.order_number,
                total,
                source: 'buy_now',
              },
            })),
          );
        }
      } catch (notificationError) {
        console.error('Buy now admin notification failed:', notificationError);
      }

      toast.success('Order placed successfully!');
      setIsOpen(false);
      setIsProcessing(false);
      orderCreationInProgressRef.current = false;
      navigate(`/order-confirmation/${order.id}`);
    } catch (error) {
      console.error('Buy now order finalization error:', error);
      toast.error(
        paymentReference
          ? 'Payment was verified, but the order could not be created. Contact support with your payment reference.'
          : 'Could not place your order. Please try again.',
      );
      setIsProcessing(false);
      orderCreationInProgressRef.current = false;
    }
  };

  const verifyAndCreateOrder = async (
    paymentReference: string,
    orderAddress: Address,
    shippingRule: ProductWithDetails['shipping_rules'][number] | null,
    variant: ProductWithDetails['variants'][number] | null,
  ) => {
    if (orderCreationInProgressRef.current) {
      return;
    }

    orderCreationInProgressRef.current = true;

    try {
      const { data: verification, error: verifyError } = await supabase.functions.invoke(
        'verify-paystack-payment',
        { body: { reference: paymentReference } },
      );

      if (verifyError) {
        throw verifyError;
      }

      if (!verification?.verified) {
        throw new Error('Payment could not be confirmed.');
      }

      if (verification.amount !== Math.round(total * 100)) {
        throw new Error('Payment amount mismatch.');
      }

      if (verification.currency !== 'GHS') {
        throw new Error('Payment currency mismatch.');
      }

      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('payment_reference', paymentReference)
        .maybeSingle();

      if (existingOrder) {
        toast.success('This payment already has an order.');
        setIsProcessing(false);
        orderCreationInProgressRef.current = false;
        navigate(`/order-confirmation/${existingOrder.id}`);
        return;
      }

      await finalizeOrder(paymentReference, orderAddress, shippingRule, variant);
    } catch (error) {
      console.error('Buy now verification failed:', error);
      toast.error(`${getErrorMessage(error, 'Payment verification failed')} Contact support with ref: ${paymentReference}`);
      setIsProcessing(false);
      orderCreationInProgressRef.current = false;
    }
  };

  const handlePayNow = async (overrides?: {
    address?: Address | null;
    shippingRule?: ProductWithDetails['shipping_rules'][number] | null;
    variant?: ProductWithDetails['variants'][number] | null;
  }) => {
    if (!user) {
      toast.error('Please sign in to continue.');
      return;
    }

    const address = overrides?.address ?? resolvedAddress;
    const shippingRule = overrides?.shippingRule ?? resolvedShippingRule;
    const variant = overrides?.variant ?? selectedVariant;

    if (requiresVariantSelection && !variant) {
      setIsOpen(true);
      toast.error('Choose a variant to continue.');
      return;
    }

    if (
      !hasRequiredGroupBuyDeliveryDetails({
        address,
        email: user?.email,
      })
    ) {
      setIsOpen(true);
      toast.error('Choose a delivery address to continue.');
      return;
    }

    if (availableShippingRules.length > 0 && !shippingRule) {
      setIsOpen(true);
      toast.error('Choose a shipping method to continue.');
      return;
    }

    trackRecommendationEvent({
      productId: product.id,
      eventType: 'checkout_seed',
      source: 'buy_now',
      weight: quantity,
      productVariantId: variant?.id || null,
      metadata: {
        flow: 'instant_checkout',
      },
    });

    setIsProcessing(true);

    try {
      if (total <= 0) {
        await finalizeOrder(null, address, shippingRule, variant);
        return;
      }

      const paystack = await loadPaystack();
      const { data: keyData, error: keyError } = await supabase.functions.invoke('get-paystack-key');

      if (keyError || !keyData?.publicKey) {
        throw new Error('Unable to connect to payment service.');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', user.id)
        .maybeSingle();

      const customerEmail = profile?.email || user.email;
      if (!customerEmail) {
        throw new Error('Add an email address to continue with payment.');
      }

      const reference = `BUY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      callbackFiredRef.current = false;

      const handler = paystack.setup({
        key: keyData.publicKey,
        email: customerEmail,
        amount: Math.round(total * 100),
        currency: 'GHS',
        ref: reference,
        metadata: {
          type: 'buy_now',
          user_id: user.id,
          product_id: product.id,
          quantity,
          variant_id: variant?.id || null,
          shipping_class_id: shippingRule?.shipping_class_id || null,
        },
        callback: (response: PaystackTransactionResponse) => {
          callbackFiredRef.current = true;
          void verifyAndCreateOrder(response.reference, address, shippingRule, variant);
        },
        onClose: () => {
          setTimeout(() => {
            if (!callbackFiredRef.current) {
              setIsProcessing(false);
              toast.info('Payment cancelled. You were not charged.');
            }
          }, 500);
        },
      });

      handler.openIframe();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not start payment.'));
      setIsProcessing(false);
    }
  };

  const incrementQuantity = () => {
    setQuantity((current) => current + 1);
  };

  const decrementQuantity = () => {
    setQuantity((current) => Math.max(1, current - 1));
  };

  return (
    <>
      <Button
        size={triggerSize}
        className={triggerClassName}
        onClick={handleOpenQuickCheckout}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Zap className="mr-1 h-4 w-4" />
        )}
        Buy
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className="max-h-[92vh] overflow-y-auto rounded-t-3xl border-border/70 px-4 pb-6 pt-8 sm:max-w-lg sm:rounded-none sm:px-6"
        >
          <SheetHeader className="space-y-2 text-left">
            <SheetTitle>Instant Checkout</SheetTitle>
            <SheetDescription>
              Resolve only what is missing, then pay for this product directly.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {variantMissing && (
              <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Select variant</p>
                  <p className="text-xs text-muted-foreground">
                    Buy Now checks out one exact option at a time.
                  </p>
                </div>
                <RadioGroup
                  value={selectedVariantId || ''}
                  onValueChange={(value) => {
                    setSelectedVariantId(value);
                    setQuantity(1);
                  }}
                  className="space-y-2"
                >
                  {product.variants.map((variant) => {
                    const stock = variant.stock || 0;
                    const disabled = stock <= 0;
                    const label = buildVariantLabel(variant);

                    return (
                      <label
                        key={variant.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-all ${
                          selectedVariantId === variant.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border/70'
                        } ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-primary/40'}`}
                      >
                        <RadioGroupItem value={variant.id} disabled={disabled} className="mt-1" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium text-foreground">{label}</p>
                            <p className="font-semibold text-primary">{formatPrice(variant.price)}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {stock > 0 ? `${stock} in stock` : 'Out of stock'}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </RadioGroup>
              </section>
            )}

            {addressMissing && (
              <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Delivery address</p>
                  <p className="text-xs text-muted-foreground">
                    Choose a saved address or add one now.
                  </p>
                </div>

                {addressesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading your addresses...
                  </div>
                ) : addresses.length > 0 ? (
                  <RadioGroup
                    value={selectedAddressId}
                    onValueChange={setSelectedAddressId}
                    className="space-y-2"
                  >
                    {addresses.map((address) => (
                      <label
                        key={address.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-all ${
                          selectedAddressId === address.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border/70 hover:border-primary/40'
                        }`}
                      >
                        <RadioGroupItem value={address.id} className="mt-1" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-foreground">
                              {address.label || address.full_name}
                            </p>
                            {address.is_default ? (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                Default
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {[address.address_line1, address.city, address.country]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                          <p className="text-xs text-muted-foreground">{address.phone}</p>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                ) : null}

                {showAddressForm ? (
                  <div className="space-y-3 rounded-2xl border border-dashed border-border/80 p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="buy-now-full-name">Full name</Label>
                        <Input
                          id="buy-now-full-name"
                          value={newAddress.full_name}
                          onChange={(event) =>
                            setNewAddress((current) => ({ ...current, full_name: event.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="buy-now-phone">Phone</Label>
                        <Input
                          id="buy-now-phone"
                          value={newAddress.phone}
                          onChange={(event) =>
                            setNewAddress((current) => ({ ...current, phone: event.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="buy-now-label">Label</Label>
                      <Input
                        id="buy-now-label"
                        placeholder="Home, Office"
                        value={newAddress.label}
                        onChange={(event) =>
                          setNewAddress((current) => ({ ...current, label: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="buy-now-address-line1">Address line 1</Label>
                      <Input
                        id="buy-now-address-line1"
                        value={newAddress.address_line1}
                        onChange={(event) =>
                          setNewAddress((current) => ({ ...current, address_line1: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="buy-now-address-line2">Address line 2</Label>
                      <Input
                        id="buy-now-address-line2"
                        value={newAddress.address_line2}
                        onChange={(event) =>
                          setNewAddress((current) => ({ ...current, address_line2: event.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="buy-now-city">City</Label>
                        <Input
                          id="buy-now-city"
                          value={newAddress.city}
                          onChange={(event) =>
                            setNewAddress((current) => ({ ...current, city: event.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="buy-now-country">Country</Label>
                        <Input
                          id="buy-now-country"
                          value={newAddress.country}
                          onChange={(event) =>
                            setNewAddress((current) => ({ ...current, country: event.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="buy-now-state">State / Region</Label>
                        <Input
                          id="buy-now-state"
                          value={newAddress.state}
                          onChange={(event) =>
                            setNewAddress((current) => ({ ...current, state: event.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="buy-now-postal-code">Postal code</Label>
                        <Input
                          id="buy-now-postal-code"
                          value={newAddress.postal_code}
                          onChange={(event) =>
                            setNewAddress((current) => ({ ...current, postal_code: event.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={handleAddressSave}>
                        Save address
                      </Button>
                      {addresses.length > 0 ? (
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={resetInlineAddressForm}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full rounded-xl"
                    onClick={() => setShowAddressForm(true)}
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    Add address
                  </Button>
                )}
              </section>
            )}

            {shippingMissing && (
              <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Shipping method</p>
                  <p className="text-xs text-muted-foreground">
                    Pick how this order should move.
                  </p>
                </div>
                <RadioGroup
                  value={selectedShippingId}
                  onValueChange={setSelectedShippingId}
                  className="space-y-2"
                >
                  {availableShippingRules.map((rule) => {
                    const ShippingIcon = getShippingIcon(rule.shipping_class?.shipping_type?.name);

                    return (
                      <label
                        key={rule.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-all ${
                          selectedShippingId === rule.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border/70 hover:border-primary/40'
                        }`}
                      >
                        <RadioGroupItem value={rule.id} className="mt-1" />
                        <div className="rounded-xl bg-primary/10 p-2 text-primary">
                          <ShippingIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium text-foreground">
                              {rule.shipping_class?.name}
                            </p>
                            <p className="font-semibold text-primary">
                              {product.is_free_shipping ? 'Free' : formatPrice(Number(rule.price || 0))}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {rule.shipping_class?.estimated_days_min}-{rule.shipping_class?.estimated_days_max} days
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </RadioGroup>
              </section>
            )}

            <section className="space-y-4 rounded-2xl border border-primary/15 bg-primary/5 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-muted">
                  <img
                    src={product.images[0] || '/placeholder.svg'}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="line-clamp-2 font-semibold text-foreground">{product.name}</p>
                  <p className="text-sm text-muted-foreground">{variantLabel}</p>
                  <p className="text-sm font-medium text-primary">{formatPrice(unitPrice)} each</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Quantity</p>
                  <p className="text-xs text-muted-foreground">Single-product instant checkout</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 rounded-xl"
                    onClick={decrementQuantity}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-semibold text-foreground">{quantity}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 rounded-xl"
                    onClick={incrementQuantity}
                    disabled={selectedVariant ? quantity >= (selectedVariant.stock || 0) : false}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-2xl bg-background/70 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Shipping</p>
                  <p className="mt-1 font-medium text-foreground">{shippingLabel}</p>
                </div>
                <div className="rounded-2xl bg-background/70 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Delivery address</p>
                  <p className="mt-1 font-medium text-foreground">{addressLabel}</p>
                </div>
              </div>

              <div className="space-y-2 rounded-2xl bg-background/70 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium text-foreground">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-medium text-foreground">
                    {product.is_free_shipping ? 'Free' : formatPrice(effectiveShippingCost)}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Final total</span>
                  <span className="text-xl font-bold text-primary">{formatPrice(total)}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => setIsOpen(false)}
                >
                  Make Changes
                </Button>
                <Button
                  className="flex-1 rounded-xl"
                  onClick={() => void handlePayNow()}
                  disabled={isProcessing || hasMissingRequirements}
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" />
                  )}
                  Pay Now
                </Button>
              </div>

              {!hasMissingRequirements ? (
                <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  Everything required for instant checkout is ready.
                </div>
              ) : null}
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
