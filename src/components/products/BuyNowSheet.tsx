import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PurchaseSummary } from '@/components/checkout/PurchaseSummary';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/hooks/useCurrency';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ProductWithDetails } from '@/hooks/useProducts';
import { savePendingBuyNowSession } from '@/lib/buyNowSession';
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
  image_url?: string | null;
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
  triggerLabel?: string;
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

function formatItemCount(count: number) {
  return `${count} item${count === 1 ? '' : 's'}`;
}

export function BuyNowSheet({
  product,
  selectedVariants,
  selectedShippingRuleId,
  triggerClassName,
  triggerLabel = 'Buy',
  triggerSize = 'sm',
}: BuyNowSheetProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const isMobile = useIsMobile();
  const callbackFiredRef = useRef(false);
  const orderCreationInProgressRef = useRef(false);

  const availableShippingRules = useMemo(
    () => product.shipping_rules.filter((rule) => rule.is_allowed && rule.shipping_class),
    [product.shipping_rules],
  );
  const requiresVariantSelection = product.variants.length > 0;
  const seededVariant = selectedVariants[0] || null;

  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    seededVariant?.id ?? null,
  );
  const [quantity, setQuantity] = useState<number>(Math.max(1, seededVariant?.quantity ?? 1));
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [selectedShippingId, setSelectedShippingId] = useState<string>(
    selectedShippingRuleId || (availableShippingRules.length === 1 ? availableShippingRules[0].id : ''),
  );
  const [isAddressPickerOpen, setIsAddressPickerOpen] = useState(false);
  const [isShippingPickerOpen, setIsShippingPickerOpen] = useState(false);
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
  const hasSelectedVariantChoices = selectedVariants.length > 0;
  const selectedVariant =
    product.variants.find((variant) => variant.id === selectedVariantId) || null;
  const selectedShippingRule =
    availableShippingRules.find((rule) => rule.id === selectedShippingId) || null;
  const resolvedShippingRule =
    selectedShippingRule || (availableShippingRules.length === 1 ? availableShippingRules[0] : null);
  const checkoutSelections = useMemo(() => {
    if (hasSelectedVariantChoices) {
      return selectedVariants.map((variant) => ({
        key: variant.id,
        variantId: variant.id,
        label: buildVariantLabel(variant),
        quantity: variant.quantity,
        unitPrice: variant.price,
        lineTotal: variant.price * variant.quantity,
        imageUrl: variant.image_url || product.images[0] || '/placeholder.svg',
      }));
    }

    const unitPrice = selectedVariant?.price ?? product.base_price;
    return [
      {
        key: selectedVariant?.id || 'standard',
        variantId: selectedVariant?.id || null,
        label: selectedVariant ? buildVariantLabel(selectedVariant) : 'Standard option',
        quantity,
        unitPrice,
        lineTotal: unitPrice * quantity,
        imageUrl: selectedVariant?.image_url || product.images[0] || '/placeholder.svg',
      },
    ];
  }, [hasSelectedVariantChoices, product.base_price, product.images, quantity, selectedVariant, selectedVariants]);
  const subtotal = checkoutSelections.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalQuantity = checkoutSelections.reduce((sum, item) => sum + item.quantity, 0);
  const shippingUnitCost =
    product.is_free_shipping || !resolvedShippingRule ? 0 : Number(resolvedShippingRule.price || 0);
  const effectiveShippingCost = shippingUnitCost * Math.max(1, totalQuantity);
  const total = subtotal + effectiveShippingCost;
  const primarySelection = checkoutSelections[0];
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
  const variantMissing = requiresVariantSelection && !hasSelectedVariantChoices && !selectedVariant;
  const addressMissing = !hasValidAddressSelection;
  const shippingMissing = availableShippingRules.length > 0 && !resolvedShippingRule;
  const hasMissingRequirements = variantMissing || addressMissing || shippingMissing;

  useEffect(() => {
    if (isOpen) {
      return;
    }

    setSelectedVariantId(selectedVariants[0]?.id ?? null);
    setQuantity(Math.max(1, selectedVariants[0]?.quantity ?? 1));
    setSelectedShippingId(
      selectedShippingRuleId || (availableShippingRules.length === 1 ? availableShippingRules[0].id : ''),
    );
  }, [availableShippingRules, isOpen, selectedShippingRuleId, selectedVariants]);

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

  const resolveDefaultOrSelectedAddress = useCallback(async () => {
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
  }, [defaultAddress, refetchAddresses, selectedAddress]);

  const resetInlineAddressForm = () => {
    setNewAddress(EMPTY_ADDRESS_FORM);
    setShowAddressForm(addresses.length === 0);
  };

  const redirectToAddressSetup = useCallback((
    shippingRule: ProductWithDetails['shipping_rules'][number] | null = resolvedShippingRule,
  ) => {
    const pendingVariants = hasSelectedVariantChoices
      ? selectedVariants.map((variant) => ({
          variantId: variant.id,
          quantity: variant.quantity,
        }))
      : selectedVariant
        ? [{ variantId: selectedVariant.id, quantity }]
        : [];

    savePendingBuyNowSession({
      productId: product.id,
      selectedVariants: pendingVariants,
      selectedShippingRuleId: shippingRule?.id || selectedShippingId || selectedShippingRuleId || null,
    });

    setIsOpen(false);
    toast.info('Add delivery address before using Buy Now.');
    navigate(
      `/profile?tab=addresses&openAddress=1&returnTo=${encodeURIComponent(`/product/${product.id}?resumeBuyNow=1`)}`,
    );
  }, [
    hasSelectedVariantChoices,
    navigate,
    product.id,
    quantity,
    resolvedShippingRule,
    selectedShippingId,
    selectedShippingRuleId,
    selectedVariant,
    selectedVariants,
  ]);

  const openAddressPicker = useCallback(() => {
    if (addressesLoading) {
      return;
    }

    if (addresses.length === 0) {
      redirectToAddressSetup(resolvedShippingRule);
      return;
    }

    setIsAddressPickerOpen(true);
  }, [addresses.length, addressesLoading, redirectToAddressSetup, resolvedShippingRule]);

  const openShippingPicker = useCallback(() => {
    if (availableShippingRules.length === 0) {
      return;
    }

    if (availableShippingRules.length === 1) {
      setSelectedShippingId(availableShippingRules[0].id);
      return;
    }

    setIsShippingPickerOpen(true);
  }, [availableShippingRules]);

  const handleOpenQuickCheckout = useCallback(async () => {
    if (!user) {
      toast.info('Please sign in to use instant checkout.');
      navigate('/auth');
      return;
    }

    if (variantMissing) {
      setIsOpen(false);
      toast.info('Select a variant on the product page before using Buy Now.');
      window.dispatchEvent(
        new CustomEvent('ajyn:focus-product-variants', {
          detail: { productId: product.id },
        }),
      );
      navigate(`/product/${product.id}?selectVariant=1`);
      return;
    }

    const resolvedAddress = await resolveDefaultOrSelectedAddress();
    const addressIsReady = hasRequiredGroupBuyDeliveryDetails({
      address: resolvedAddress,
      email: user?.email,
    });

    if (!addressIsReady) {
      redirectToAddressSetup(resolvedShippingRule || availableShippingRules[0] || null);
      return;
    }

    if (availableShippingRules.length === 1 && !selectedShippingId) {
      setSelectedShippingId(availableShippingRules[0].id);
    }

    setIsOpen(true);
  }, [
    availableShippingRules,
    navigate,
    product.id,
    redirectToAddressSetup,
    resolveDefaultOrSelectedAddress,
    resolvedShippingRule,
    selectedShippingId,
    user,
    variantMissing,
  ]);

  useEffect(() => {
    const handleOpenBuyNow = (event: Event) => {
      const detail = (event as CustomEvent<{ productId?: string }>).detail;
      if (detail?.productId && detail.productId !== product.id) {
        return;
      }

      void handleOpenQuickCheckout();
    };

    window.addEventListener('ajyn:open-buy-now', handleOpenBuyNow);
    return () => window.removeEventListener('ajyn:open-buy-now', handleOpenBuyNow);
  }, [handleOpenQuickCheckout, product.id]);

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
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-order', {
        body: {
          flow: 'buy_now',
          paymentReference,
          addressId: orderAddress.id,
          shippingClassId: shippingRule?.shipping_class_id || null,
          expectedTotal: total,
          items: checkoutSelections.map((item) => ({
            productId: product.id,
            productVariantId: item.variantId,
            quantity: item.quantity,
          })),
        },
      });

      if (error) throw error;

      const order = (data as {
        order?: { id: string; order_number?: string; total_amount?: number };
        alreadyExists?: boolean;
        error?: string;
      } | null)?.order;

      if (!order?.id) {
        throw new Error((data as { error?: string } | null)?.error || 'Order could not be created.');
      }

      checkoutSelections.forEach((item) => {
        trackRecommendationEvent({
          productId: product.id,
          eventType: 'order_complete',
          source: 'buy_now',
          weight: item.quantity,
          productVariantId: item.variantId,
          orderId: order.id,
        });
      });

      toast.success((data as { alreadyExists?: boolean } | null)?.alreadyExists ? 'Order already created!' : 'Order placed successfully!');
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
  ) => {
    if (orderCreationInProgressRef.current) {
      return;
    }

    orderCreationInProgressRef.current = true;

    try {
      await finalizeOrder(paymentReference, orderAddress, shippingRule);
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
  }) => {
    if (!user) {
      toast.error('Please sign in to continue.');
      return;
    }

    const address = overrides?.address ?? resolvedAddress;
    const shippingRule = overrides?.shippingRule ?? resolvedShippingRule;

    if (variantMissing) {
      setIsOpen(false);
      toast.info('Select a variant on the product page before using Buy Now.');
      window.dispatchEvent(
        new CustomEvent('ajyn:focus-product-variants', {
          detail: { productId: product.id },
        }),
      );
      navigate(`/product/${product.id}?selectVariant=1`);
      return;
    }

    if (
      !hasRequiredGroupBuyDeliveryDetails({
        address,
        email: user?.email,
      })
    ) {
      redirectToAddressSetup(shippingRule);
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
      weight: totalQuantity,
      productVariantId: primarySelection?.variantId || null,
      metadata: {
        flow: 'instant_checkout',
        selected_variant_count: checkoutSelections.length,
      },
    });

    setIsProcessing(true);

    try {
      if (total <= 0) {
        await finalizeOrder(null, address, shippingRule);
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
          quantity: totalQuantity,
          variant_id: primarySelection?.variantId || null,
          variant_ids: checkoutSelections
            .map((item) => item.variantId)
            .filter(Boolean)
            .join(','),
          shipping_class_id: shippingRule?.shipping_class_id || null,
        },
        callback: (response: PaystackTransactionResponse) => {
          callbackFiredRef.current = true;
          void verifyAndCreateOrder(response.reference, address, shippingRule);
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
        className={`min-w-0 gap-1.5 overflow-hidden ${triggerClassName || ''}`}
        onClick={handleOpenQuickCheckout}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <Zap className="h-4 w-4 shrink-0" />
        )}
        <span className="truncate">{triggerLabel}</span>
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className="max-h-[92vh] overflow-y-auto rounded-t-3xl border-border/70 px-4 pb-6 pt-8 sm:max-w-lg sm:rounded-none sm:px-6"
        >
          <SheetHeader className="space-y-2 text-left">
            <SheetTitle>Instant Checkout</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
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
                        onClick={() => setSelectedAddressId(address.id)}
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
                        onClick={() => setSelectedShippingId(rule.id)}
                      >
                        <RadioGroupItem value={rule.id} className="mt-1" />
                        <div className="rounded-xl bg-primary/10 p-2 text-primary">
                          <ShippingIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-col gap-1 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
                            <p className="line-clamp-2 font-medium text-foreground">
                              {rule.shipping_class?.name}
                            </p>
                            <p className="shrink-0 text-right font-semibold text-primary">
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

            <PurchaseSummary
              title="Instant Checkout"
              subtitle="Review your order details and pay in one step."
              shipping={{
                title: 'Shipping Method',
                detail: shippingLabel,
                amount: resolvedShippingRule
                  ? product.is_free_shipping
                    ? 'FREE'
                    : formatPrice(effectiveShippingCost)
                  : null,
                icon: getShippingIcon(resolvedShippingRule?.shipping_class?.shipping_type?.name),
                onClick: availableShippingRules.length > 0 ? openShippingPicker : undefined,
              }}
              address={{
                title: 'Delivery Address',
                detail: addressLabel,
                subdetail: resolvedAddress?.phone || null,
                icon: MapPin,
                onClick: openAddressPicker,
              }}
              itemsTitle={`Selected Variants (${checkoutSelections.length})`}
              itemsSubtitle={`You've selected ${formatItemCount(totalQuantity)}`}
              items={checkoutSelections.map((item) => ({
                id: item.key,
                title: product.name,
                imageUrl: item.imageUrl,
                quantity: item.quantity,
                amount: formatPrice(item.lineTotal),
                subtitle: item.label,
                details: [`${formatPrice(item.unitPrice)} each`],
                action:
                  hasSelectedVariantChoices || item.variantId ? null : (
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
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ),
              }))}
              totals={[
                { label: `Subtotal (${formatItemCount(totalQuantity)})`, value: formatPrice(subtotal) },
                {
                  label: 'Shipping',
                  value: product.is_free_shipping ? 'FREE' : formatPrice(effectiveShippingCost),
                },
                { label: 'Total', value: formatPrice(total), emphasis: true },
              ]}
              onMakeChanges={() => setIsOpen(false)}
              onPay={() => void handlePayNow()}
              isProcessing={isProcessing}
              payDisabled={hasMissingRequirements}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isAddressPickerOpen} onOpenChange={setIsAddressPickerOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Delivery Address</DialogTitle>
          </DialogHeader>

          <RadioGroup
            value={resolvedAddress?.id || selectedAddressId}
            onValueChange={(addressId) => {
              setSelectedAddressId(addressId);
              setIsAddressPickerOpen(false);
            }}
            className="space-y-2"
          >
            {addresses.map((address) => (
              <label
                key={address.id}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-all ${
                  (resolvedAddress?.id || selectedAddressId) === address.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border/70 hover:border-primary/40'
                }`}
                onClick={() => {
                  setSelectedAddressId(address.id);
                  setIsAddressPickerOpen(false);
                }}
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

          <Button
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => {
              setIsAddressPickerOpen(false);
              redirectToAddressSetup(resolvedShippingRule);
            }}
          >
            <MapPin className="mr-2 h-4 w-4" />
            Add new address
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={isShippingPickerOpen} onOpenChange={setIsShippingPickerOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Shipping Method</DialogTitle>
          </DialogHeader>

          <RadioGroup
            value={selectedShippingId}
            onValueChange={(shippingId) => {
              setSelectedShippingId(shippingId);
              setIsShippingPickerOpen(false);
            }}
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
                  onClick={() => {
                    setSelectedShippingId(rule.id);
                    setIsShippingPickerOpen(false);
                  }}
                >
                  <RadioGroupItem value={rule.id} className="mt-1" />
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <ShippingIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <p className="line-clamp-2 font-medium text-foreground">
                        {rule.shipping_class?.name}
                      </p>
                      <p className="shrink-0 text-right font-semibold text-primary">
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
        </DialogContent>
      </Dialog>
    </>
  );
}
