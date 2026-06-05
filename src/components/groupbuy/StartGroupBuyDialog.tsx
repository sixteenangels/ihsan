import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { MapPin, Package, Plane, Ship, Truck, Users } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';
import { getErrorMessage } from '@/lib/errors';
import { loadPaystack, type PaystackTransactionResponse } from '@/lib/paystack';
import { isPaystackAmountValid } from '@/lib/paymentVerification';
import { VariantQuantityStepper } from '@/components/groupbuy/VariantQuantityStepper';
import {
  buildGroupBuyVariantSelections,
  getGroupBuySelectionsTotalAmount,
  getGroupBuySelectionsTotalQuantity,
  getGroupBuyVariantLabel,
  getGroupBuyVariantUnitPrice,
  withGroupBuySelectionsInShippingAddress,
} from '@/lib/groupBuySelections';
import {
  getGroupBuyAddressSetupPath,
  hasRequiredGroupBuyDeliveryDetails,
} from '@/lib/groupBuyCheckout';
import { useGroupBuySettings } from '@/hooks/useGroupBuySettings';
import { PurchaseSummary } from '@/components/checkout/PurchaseSummary';
import {
  buildGroupBuySettingsSnapshot,
  formatGroupBuyDuration,
  groupBuyDurationToMilliseconds,
} from '@/lib/groupBuyConfig';

interface StartGroupBuyDialogProps {
  product: {
    id: string;
    name: string;
    base_price: number;
    group_buy_price: number | null;
  };
  triggerClassName?: string;
}

interface GroupBuyAddress {
  id: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state?: string | null;
  country: string;
  postal_code?: string | null;
  label?: string | null;
  is_default: boolean;
}

interface GroupBuyShippingRule {
  id: string;
  shipping_class_id: string;
  price: number | null;
  is_allowed: boolean | null;
  shipping_classes: {
    id: string;
    name: string;
    base_price: number | null;
    estimated_days_min: number;
    estimated_days_max: number;
    shipping_types: {
      id: string;
      name: string;
    } | null;
  } | null;
}

function getShippingIcon(typeName?: string | null) {
  const normalized = typeName?.toLowerCase() || '';

  if (normalized.includes('sea')) return Ship;
  if (normalized.includes('courier')) return Truck;
  if (normalized.includes('air') || normalized.includes('express')) return Plane;
  return Package;
}

function formatAddressLine(address?: GroupBuyAddress | null) {
  if (!address) return 'Choose a delivery address';
  return [address.full_name, address.city, address.country].filter(Boolean).join(', ');
}

function buildAddressPayload(
  address: GroupBuyAddress | null,
  shippingRule: GroupBuyShippingRule | null,
) {
  if (!address) return null;

  return {
    full_name: address.full_name,
    phone: address.phone,
    address_line1: address.address_line1,
    address_line2: address.address_line2,
    city: address.city,
    state: address.state,
    country: address.country,
    shipping_method: shippingRule?.shipping_classes
      ? {
          id: shippingRule.shipping_class_id,
          name: shippingRule.shipping_classes.name,
          price: Number(shippingRule.price ?? shippingRule.shipping_classes.base_price ?? 0),
          estimated_days_min: shippingRule.shipping_classes.estimated_days_min,
          estimated_days_max: shippingRule.shipping_classes.estimated_days_max,
        }
      : null,
  };
}

export function StartGroupBuyDialog({ product, triggerClassName }: StartGroupBuyDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { formatPrice } = useCurrency();
  const { settings: groupBuySettings } = useGroupBuySettings();
  const [isOpen, setIsOpen] = useState(false);
  const [participantCount, setParticipantCount] = useState(String(groupBuySettings.minParticipantsRequired));
  const [quantity, setQuantity] = useState('1');
  const [variantQuantities, setVariantQuantities] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'setup' | 'payment'>('setup');
  const [isPaying, setIsPaying] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [selectedShippingRuleId, setSelectedShippingRuleId] = useState('');
  const [isAddressPickerOpen, setIsAddressPickerOpen] = useState(false);
  const [isShippingPickerOpen, setIsShippingPickerOpen] = useState(false);
  const callbackFiredRef = useRef(false);

  const { data: variants } = useQuery({
    queryKey: ['product-variants', product.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', product.id)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: addresses = [], isLoading: addressesLoading } = useQuery({
    queryKey: ['group-buy-addresses', user?.id],
    queryFn: async () => {
      if (!user) return [] as GroupBuyAddress[];
      const { data } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });
      return (data || []) as GroupBuyAddress[];
    },
    enabled: !!user,
  });

  const { data: shippingRules = [] } = useQuery({
    queryKey: ['group-buy-shipping-rules', product.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_shipping_rules')
        .select(`
          id,
          shipping_class_id,
          price,
          is_allowed,
          shipping_classes!inner(
            id,
            name,
            base_price,
            estimated_days_min,
            estimated_days_max,
            shipping_types(id, name)
          )
        `)
        .eq('product_id', product.id)
        .eq('is_allowed', true)
        .eq('shipping_classes.is_active', true);

      if (error) throw error;
      return (data || []) as GroupBuyShippingRule[];
    },
  });

  const selectedAddress =
    addresses.find((address) => address.id === selectedAddressId) ||
    addresses.find((address) => address.is_default) ||
    addresses[0] ||
    null;
  const selectedShippingRule =
    shippingRules.find((rule) => rule.id === selectedShippingRuleId) ||
    shippingRules[0] ||
    null;

  useEffect(() => {
    if (selectedAddressId || addresses.length === 0) return;
    setSelectedAddressId((addresses.find((address) => address.is_default) || addresses[0]).id);
  }, [addresses, selectedAddressId]);

  useEffect(() => {
    if (selectedShippingRuleId || shippingRules.length === 0) return;
    setSelectedShippingRuleId(shippingRules[0].id);
  }, [selectedShippingRuleId, shippingRules]);

  const hasVariants = (variants?.length ?? 0) > 0;
  const offeredUnitPrice = product.group_buy_price ?? product.base_price;
  const discountPercentage = product.base_price > 0
    ? Math.max(0, Math.round(((product.base_price - offeredUnitPrice) / product.base_price) * 100))
    : 0;
  const normalizedQuantity = Math.max(1, Number.parseInt(quantity || '1', 10) || 1);
  const requestedParticipantCount = Number.parseInt(participantCount || '', 10);
  const hasValidParticipantCount =
    Number.isFinite(requestedParticipantCount) &&
    requestedParticipantCount >= groupBuySettings.minParticipantsRequired &&
    requestedParticipantCount <= groupBuySettings.maxParticipantsAllowed;
  const normalizedParticipantCount = hasValidParticipantCount
    ? requestedParticipantCount
    : groupBuySettings.minParticipantsRequired;
  const variantSelections = hasVariants
    ? buildGroupBuyVariantSelections({
        quantitiesByVariantId: variantQuantities,
        variants: variants || [],
        basePrice: product.base_price,
        groupPrice: product.group_buy_price,
        discountPercentage,
      })
    : [];
  const totalSelectedQuantity = hasVariants
    ? getGroupBuySelectionsTotalQuantity(variantSelections)
    : normalizedQuantity;
  const totalAmount = hasVariants
    ? getGroupBuySelectionsTotalAmount(variantSelections)
    : offeredUnitPrice * normalizedQuantity;
  const primaryVariantId = variantSelections[0]?.variantId ?? null;
  const averageUnitPrice = totalSelectedQuantity > 0
    ? totalAmount / totalSelectedQuantity
    : offeredUnitPrice;
  const exceedsParticipantLimitPerUser = totalSelectedQuantity > groupBuySettings.participantLimitPerUser;
  const hasDeliveryDetails = hasRequiredGroupBuyDeliveryDetails({
    address: selectedAddress,
    email: user?.email,
  });

  const resetForm = () => {
    setParticipantCount(String(groupBuySettings.minParticipantsRequired));
    setQuantity('1');
    setVariantQuantities({});
    setStep('setup');
    setIsPaying(false);
  };

  const handleOpen = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handleVariantQuantityChange = (variantId: string, nextValue: string) => {
    setVariantQuantities((current) => ({
      ...current,
      [variantId]: nextValue,
    }));
  };

  const clampParticipantCount = () => {
    const parsed = Number.parseInt(participantCount || '', 10);
    if (!Number.isFinite(parsed)) {
      setParticipantCount(String(groupBuySettings.minParticipantsRequired));
      return;
    }

    setParticipantCount(
      String(
        Math.min(
          groupBuySettings.maxParticipantsAllowed,
          Math.max(groupBuySettings.minParticipantsRequired, parsed),
        ),
      ),
    );
  };

  const handleContinueToPayment = () => {
    if (!hasDeliveryDetails) {
      toast.error('Add delivery address before starting this group buy.');
      navigate(getGroupBuyAddressSetupPath());
      return;
    }

    if (!hasValidParticipantCount) {
      toast.error(
        `Choose between ${groupBuySettings.minParticipantsRequired} and ${groupBuySettings.maxParticipantsAllowed} participants`,
      );
      return;
    }

    if (exceedsParticipantLimitPerUser) {
      toast.error(`This group buy allows up to ${groupBuySettings.participantLimitPerUser} item(s) per shopper.`);
      return;
    }

    setStep('payment');
  };

  const handlePayAndCreate = async () => {
    if (!user) return;

    if (!hasDeliveryDetails) {
      toast.error('Add delivery address before starting this group buy.');
      navigate(getGroupBuyAddressSetupPath());
      return;
    }

    if (!hasValidParticipantCount) {
      toast.error(
        `Choose between ${groupBuySettings.minParticipantsRequired} and ${groupBuySettings.maxParticipantsAllowed} participants`,
      );
      setStep('setup');
      return;
    }

    if (hasVariants && totalSelectedQuantity <= 0) {
      toast.error('Choose at least one variant to continue');
      return;
    }

    if (!hasVariants && normalizedQuantity <= 0) {
      toast.error('Choose a valid quantity to continue');
      return;
    }

    if (exceedsParticipantLimitPerUser) {
      toast.error(`This group buy allows up to ${groupBuySettings.participantLimitPerUser} item(s) per shopper.`);
      return;
    }

    setIsPaying(true);

    try {
      const paystack = await loadPaystack();
      const { data: keyData, error: keyError } = await supabase.functions.invoke('get-paystack-key');
      if (keyError || !keyData?.publicKey) throw new Error('Failed to initialize payment');

      const { data: profile } = await supabase
        .from('profiles')
        .select('email, name')
        .eq('user_id', user.id)
        .single();

      const customerEmail = profile?.email || user.email;
      if (!customerEmail) {
        throw new Error('Add an email address to continue with payment');
      }

      const reference = `GB-NEW-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const amountInPesewas = Math.round(totalAmount * 100);
      if (amountInPesewas <= 0) {
        throw new Error('Choose a paid group buy quantity before continuing');
      }
      callbackFiredRef.current = false;

      const handler = paystack.setup({
        key: keyData.publicKey,
        email: customerEmail,
        amount: amountInPesewas,
        currency: 'GHS',
        ref: reference,
        metadata: {
          type: 'group_buy_start',
          product_id: product.id,
          user_id: user.id,
          quantity: totalSelectedQuantity,
          variant_id: primaryVariantId,
          variant_selections: variantSelections,
        },
        callback: function(response: PaystackTransactionResponse) {
          callbackFiredRef.current = true;
          verifyAndCreateGroupBuy(response.reference, amountInPesewas).catch((error) => {
            toast.error(getErrorMessage(error, `Failed to create group buy. Contact support with ref: ${response.reference}`));
            setIsPaying(false);
          });
        },
        onClose: () => {
          setTimeout(() => {
            if (!callbackFiredRef.current) {
              setIsPaying(false);
              setStep('payment');
              setIsOpen(true);
              toast.info('Payment cancelled. You were not charged.');
            }
          }, 500);
        },
      });

      if (handler) {
        flushSync(() => setIsOpen(false));
        handler.openIframe();
      } else {
        toast.error('Payment system not loaded. Please refresh and try again.');
        setIsPaying(false);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Payment failed'));
      setIsPaying(false);
    }
  };

  const verifyAndCreateGroupBuy = async (paymentRef: string, expectedAmount: number) => {
    try {
      const { data: verification, error: verificationError } = await supabase.functions.invoke(
        'verify-paystack-payment',
        { body: { reference: paymentRef } }
      );

      if (verificationError) {
        toast.error(`Payment verification failed. Contact support with ref: ${paymentRef}`);
        setIsPaying(false);
        return;
      }

      if (!verification?.verified) {
        toast.error(`Payment could not be verified. Contact support with ref: ${paymentRef}`);
        setIsPaying(false);
        return;
      }

      if (!isPaystackAmountValid(verification, expectedAmount)) {
        toast.error(`Payment amount mismatch. Contact support with ref: ${paymentRef}`);
        setIsPaying(false);
        return;
      }

      if (verification.currency?.toUpperCase() !== 'GHS') {
        toast.error(`Payment currency mismatch. Contact support with ref: ${paymentRef}`);
        setIsPaying(false);
        return;
      }

      await createGroupBuy(paymentRef);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, `Failed to create group buy. Contact support with ref: ${paymentRef}`));
      setIsPaying(false);
    }
  };

  const createGroupBuy = async (paymentRef: string) => {
    if (!user) return;

    const { data: existingParticipant } = await supabase
      .from('group_buy_participants')
      .select('group_buy_id')
      .eq('payment_reference', paymentRef)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingParticipant) {
      queryClient.invalidateQueries({ queryKey: ['group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['my-group-buys'] });
      toast.success('Your group buy was already created.');
      setIsOpen(false);
      resetForm();
      return;
    }

    const expiresAt = new Date(
      Date.now() +
        groupBuyDurationToMilliseconds(
          groupBuySettings.countdownDurationValue,
          groupBuySettings.countdownDurationUnit,
        ),
    );
    const settingsSnapshot = buildGroupBuySettingsSnapshot({
      ...groupBuySettings,
      minParticipantsRequired: normalizedParticipantCount,
      maxParticipantsAllowed: normalizedParticipantCount,
    });

    const { data: gbData, error: gbError } = await supabase
      .from('group_buys')
      .insert({
        product_id: product.id,
        title: `${product.name} Group Buy`,
        min_participants: normalizedParticipantCount,
        max_participants: normalizedParticipantCount,
        discount_percentage: discountPercentage > 0 ? discountPercentage : 0,
        group_price: offeredUnitPrice,
        expires_at: expiresAt.toISOString(),
        created_by: user.id,
        status: 'open',
        current_participants: 0,
        settings: settingsSnapshot as unknown as Json,
      })
      .select()
      .single();

    if (gbError) {
      toast.error(gbError.message);
      setIsPaying(false);
      return;
    }

    await supabase.from('group_buy_tiers' as never).insert({
      group_buy_id: gbData.id,
      min_participants: normalizedParticipantCount,
      group_price: offeredUnitPrice,
      discount_percentage: discountPercentage > 0 ? discountPercentage : null,
      reward_coupon_percent: 5,
      label: 'Base group price',
    } as never);

    const addressData = buildAddressPayload(selectedAddress, selectedShippingRule);

    const { error: participantError } = await supabase.rpc('join_group_buy_after_payment' as never, {
      p_group_buy_id: gbData.id,
      p_quantity: totalSelectedQuantity,
      p_variant_id: primaryVariantId,
      p_payment_reference: paymentRef,
      p_shipping_address: withGroupBuySelectionsInShippingAddress(addressData, variantSelections),
      p_invite_code: null,
      p_referred_by_user_id: null,
      p_unit_price_at_join: averageUnitPrice,
      p_tier_label_at_join: 'Base group price',
    } as never);

    if (participantError) {
      await supabase.from('group_buys').delete().eq('id', gbData.id).eq('created_by', user.id);
      toast.error(participantError.message || 'Payment was verified but the group buy could not be created.');
      setIsPaying(false);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['group-buys'] });
    queryClient.invalidateQueries({ queryKey: ['my-group-buys'] });
    toast.success('Group buy started! Share it with friends.');
    setIsOpen(false);
    resetForm();
  };

  if (!user) {
    return (
      <Button variant="secondary" className={triggerClassName} onClick={() => toast.info('Please sign in to start a group buy')}>
        <Users className="mr-2 h-4 w-4" /> Start Group Buy
      </Button>
    );
  }

  if (!addressesLoading && !hasDeliveryDetails) {
    return (
      <Button
        variant="secondary"
        className={triggerClassName}
        onClick={() => {
          toast.error('Add delivery address before starting this group buy.');
          navigate(getGroupBuyAddressSetupPath());
        }}
      >
        <Users className="mr-2 h-4 w-4" /> Start Group Buy
      </Button>
    );
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className={triggerClassName}>
          <Users className="mr-2 h-4 w-4" /> Start Group Buy
        </Button>
      </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a Group Buy</DialogTitle>
          <DialogDescription>
            Create a {formatGroupBuyDuration(groupBuySettings.countdownDurationValue, groupBuySettings.countdownDurationUnit)} shared offer for "{product.name}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === 'setup' ? (
            <>
              <div className="rounded-2xl border border-accent/20 bg-accent/10 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-muted-foreground">Regular price:</span>
                  <span className="text-muted-foreground line-through">{formatPrice(product.base_price)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Group price:</span>
                  <span className="text-xl font-bold text-primary">{formatPrice(offeredUnitPrice)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Participants Needed</Label>
                <Input
                  type="number"
                  min={groupBuySettings.minParticipantsRequired}
                  max={groupBuySettings.maxParticipantsAllowed}
                  value={participantCount}
                  onChange={(event) => setParticipantCount(event.target.value)}
                  onBlur={clampParticipantCount}
                />
                <p className="text-xs text-muted-foreground">
                  Group buys need {groupBuySettings.minParticipantsRequired}-{groupBuySettings.maxParticipantsAllowed} participants.
                </p>
                <p className="text-xs text-muted-foreground">
                  New group buys stay open for {formatGroupBuyDuration(groupBuySettings.countdownDurationValue, groupBuySettings.countdownDurationUnit)}. If yours is still unfilled in the final hour, you can extend it once.
                </p>
                <p className="text-xs text-muted-foreground">
                  Each shopper can commit up to {groupBuySettings.participantLimitPerUser} item(s) in this deal.
                </p>
              </div>

              {variants && variants.length > 0 ? (
                <div className="space-y-3">
                  <Label>Your Variant Quantities</Label>
                  <div className="space-y-2">
                    {variants.map((variant) => {
                      const variantUnitPrice = getGroupBuyVariantUnitPrice({
                        variant,
                        basePrice: product.base_price,
                        groupPrice: product.group_buy_price,
                        discountPercentage,
                      });

                      return (
                        <div key={variant.id} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/70 p-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{getGroupBuyVariantLabel(variant)}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatPrice(variantUnitPrice)}
                              {variant.stock != null && variant.stock <= 5 ? ` - ${variant.stock} left` : ''}
                            </p>
                          </div>
                          <VariantQuantityStepper
                            id={`start-group-buy-variant-${variant.id}`}
                            value={variantQuantities[variant.id] ?? ''}
                            max={variant.stock != null ? Math.max(0, variant.stock) : undefined}
                            onChange={(nextValue) => handleVariantQuantityChange(variant.id, nextValue)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Your Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    max={groupBuySettings.participantLimitPerUser}
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                </div>
              )}

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Your payment:</span>
                  <span className="text-xl font-bold text-primary">{formatPrice(totalAmount)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Total items: {totalSelectedQuantity}</p>
              </div>

              <div className="flex flex-col gap-2 pt-4 sm:flex-row">
                <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button
                  className="h-11 flex-1 rounded-xl"
                  disabled={
                    !hasValidParticipantCount ||
                    exceedsParticipantLimitPerUser ||
                    (hasVariants ? totalSelectedQuantity <= 0 : normalizedQuantity <= 0)
                  }
                  onClick={handleContinueToPayment}
                >
                  Next: Pay and Start
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <PurchaseSummary
                title="Group Buy Checkout"
                subtitle="Review your group buy reservation before payment."
                shipping={
                  shippingRules.length > 0
                    ? {
                        title: 'Shipping Method',
                        detail: selectedShippingRule?.shipping_classes
                          ? `${selectedShippingRule.shipping_classes.name} (${selectedShippingRule.shipping_classes.estimated_days_min}-${selectedShippingRule.shipping_classes.estimated_days_max} days)`
                          : 'Choose a shipping method',
                        amount: selectedShippingRule ? 'Selected' : null,
                        icon: getShippingIcon(selectedShippingRule?.shipping_classes?.shipping_types?.name),
                        onClick: () => setIsShippingPickerOpen(true),
                      }
                    : null
                }
                address={{
                  title: 'Delivery Address',
                  detail: formatAddressLine(selectedAddress),
                  subdetail: selectedAddress?.phone || null,
                  icon: MapPin,
                  onClick: () => setIsAddressPickerOpen(true),
                }}
                itemsTitle="Selected Items"
                itemsSubtitle={`You've selected ${totalSelectedQuantity} item${totalSelectedQuantity === 1 ? '' : 's'}`}
                items={
                  hasVariants
                    ? variantSelections.map((selection) => ({
                        id: selection.variantId,
                        title: product.name,
                        subtitle: selection.label,
                        quantity: selection.quantity,
                        amount: formatPrice(selection.unitPrice * selection.quantity),
                        details: [`${formatPrice(selection.unitPrice)} each`],
                      }))
                    : [
                        {
                          id: product.id,
                          title: product.name,
                          subtitle: 'Group buy reservation',
                          quantity,
                          amount: formatPrice(totalAmount),
                          details: [`${formatPrice(offeredUnitPrice)} each`],
                        },
                      ]
                }
                totals={[
                  { label: 'Participants needed', value: String(normalizedParticipantCount) },
                  { label: 'Total items', value: String(totalSelectedQuantity) },
                  { label: 'Total', value: formatPrice(totalAmount), emphasis: true },
                ]}
                makeChangesLabel="Back"
                payLabel="Pay Now and Start Group Buy"
                isProcessing={isPaying}
                onMakeChanges={() => setStep('setup')}
                onPay={handlePayAndCreate}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={isAddressPickerOpen} onOpenChange={setIsAddressPickerOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Delivery Address</DialogTitle>
          <DialogDescription>Select the saved address for this group buy.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {addresses.map((address) => (
            <button
              key={address.id}
              type="button"
              className={`w-full rounded-2xl border p-3 text-left transition-all ${
                selectedAddress?.id === address.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border/70 hover:border-primary/40'
              }`}
              onClick={() => {
                setSelectedAddressId(address.id);
                setIsAddressPickerOpen(false);
              }}
            >
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {address.label || address.full_name}
                    {address.is_default ? (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                        Default
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[address.address_line1, address.city, address.country].filter(Boolean).join(', ')}
                  </p>
                  <p className="text-xs text-muted-foreground">{address.phone}</p>
                </div>
              </div>
            </button>
          ))}
          <Button
            variant="outline"
            className="h-11 w-full rounded-xl"
            onClick={() => {
              setIsAddressPickerOpen(false);
              navigate(getGroupBuyAddressSetupPath());
            }}
          >
            Add new address
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isShippingPickerOpen} onOpenChange={setIsShippingPickerOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Shipping Method</DialogTitle>
          <DialogDescription>This preference is saved for fulfillment after the group buy fills.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {shippingRules.map((rule) => {
            const ShippingIcon = getShippingIcon(rule.shipping_classes?.shipping_types?.name);

            return (
              <button
                key={rule.id}
                type="button"
                className={`w-full rounded-2xl border p-3 text-left transition-all ${
                  selectedShippingRule?.id === rule.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border/70 hover:border-primary/40'
                }`}
                onClick={() => {
                  setSelectedShippingRuleId(rule.id);
                  setIsShippingPickerOpen(false);
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <ShippingIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{rule.shipping_classes?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {rule.shipping_classes?.estimated_days_min}-{rule.shipping_classes?.estimated_days_max} days
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-primary">
                    {formatPrice(Number(rule.price ?? rule.shipping_classes?.base_price ?? 0))}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
