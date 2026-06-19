import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { MapPin, Package, Plane, Ship, Truck, Users, Loader2, Check, UserMinus, CreditCard } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';
import { getErrorMessage } from '@/lib/errors';
import { loadPaystack, type PaystackTransactionResponse } from '@/lib/paystack';
import { isPaystackAmountValid } from '@/lib/paymentVerification';
import { VariantQuantityStepper } from '@/components/groupbuy/VariantQuantityStepper';
import {
  formatGroupBuyTimeRemaining,
  getLeaveWindowInfo,
} from '@/lib/groupBuyTiming';
import { cn } from '@/lib/utils';
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
import { buildCheckoutSavingsTotalRows, useCheckoutSavings } from '@/hooks/useCheckoutSavings';
import { resolveGroupBuySettings } from '@/lib/groupBuyConfig';
import { PurchaseSummary } from '@/components/checkout/PurchaseSummary';
import {
  CheckoutSavingsCard,
  CheckoutSavingsDialog,
} from '@/components/checkout/CheckoutSavingsControls';

interface JoinGroupBuyDialogProps {
  inviteCode?: string | null;
  triggerClassName?: string;
  triggerLabel?: string;
  joinedLabel?: string;
  signedOutLabel?: string;
  disableDialogWhenJoined?: boolean;
  groupBuy: {
    id: string;
    product_id: string;
    min_participants: number;
    max_participants: number | null;
    current_participants: number | null;
    discount_percentage: number | null;
    group_price: number | null;
    expires_at: string;
    status: string | null;
    settings?: unknown;
    product: {
      name: string;
      base_price: number;
    } | null;
    tiers?: Array<{
      id: string;
      min_participants: number;
      group_price: number | null;
      discount_percentage: number | null;
      label: string;
    }>;
  };
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

export function JoinGroupBuyDialog({
  groupBuy,
  inviteCode,
  triggerClassName,
  triggerLabel = 'Join Group Buy',
  joinedLabel = 'Joined',
  signedOutLabel = 'Join Group Buy',
  disableDialogWhenJoined = false,
}: JoinGroupBuyDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { formatPrice } = useCurrency();
  const { settings: defaultGroupBuySettings } = useGroupBuySettings();
  const [isOpen, setIsOpen] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [variantQuantities, setVariantQuantities] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'select' | 'payment'>('select');
  const [payingWithPaystack, setPayingWithPaystack] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [selectedShippingRuleId, setSelectedShippingRuleId] = useState('');
  const [isAddressPickerOpen, setIsAddressPickerOpen] = useState(false);
  const [isShippingPickerOpen, setIsShippingPickerOpen] = useState(false);
  const callbackFiredRef = useRef(false);

  const { data: variants } = useQuery({
    queryKey: ['product-variants', groupBuy.product_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', groupBuy.product_id)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: existingParticipation } = useQuery({
    queryKey: ['group-buy-participation', groupBuy.id, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('group_buy_participants')
        .select('*')
        .eq('group_buy_id', groupBuy.id)
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
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
    queryKey: ['group-buy-shipping-rules', groupBuy.product_id],
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
        .eq('product_id', groupBuy.product_id)
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

  const { data: invite } = useQuery({
    queryKey: ['group-buy-invite', groupBuy.id, inviteCode],
    queryFn: async () => {
      if (!inviteCode) return null;
      const { data, error } = await supabase.rpc('resolve_group_buy_invite' as never, {
        invite_code_input: inviteCode,
      } as never);

      if (error) {
        throw error;
      }

      const resolvedInvite = (((data as unknown[]) || [])[0] || null) as
        | { invite_code: string; inviter_user_id: string; group_buy_id: string }
        | null;

      if (!resolvedInvite || resolvedInvite.group_buy_id !== groupBuy.id) {
        return null;
      }

      return resolvedInvite;
    },
    enabled: !!inviteCode,
  });

  const hasVariants = (variants?.length ?? 0) > 0;
  const resolvedGroupBuySettings = resolveGroupBuySettings(defaultGroupBuySettings, groupBuy.settings);
  const currentParticipants = groupBuy.current_participants || 0;
  const participantCap = groupBuy.max_participants ?? groupBuy.min_participants;
  const isAtParticipantCap = currentParticipants >= participantCap;
  const isClosedForNewParticipants =
    groupBuy.status !== 'open' || isAtParticipantCap || !resolvedGroupBuySettings.participationOpen;
  const effectiveParticipantCount = currentParticipants + 1;
  const activeTier = [...(groupBuy.tiers || [])]
    .filter((tier) => effectiveParticipantCount >= tier.min_participants)
    .sort((left, right) => right.min_participants - left.min_participants)[0];
  const discountedPrice = groupBuy.group_price != null
    ? activeTier?.group_price ?? groupBuy.group_price
    : groupBuy.product
      ? groupBuy.product.base_price * (1 - ((activeTier?.discount_percentage ?? groupBuy.discount_percentage) || 0) / 100)
      : 0;
  const normalizedQuantity = Math.max(1, Number.parseInt(quantity || '1', 10) || 1);
  const variantSelections = hasVariants
    ? buildGroupBuyVariantSelections({
        quantitiesByVariantId: variantQuantities,
        variants: variants || [],
        basePrice: Number(groupBuy.product?.base_price || 0),
        groupPrice: activeTier?.group_price ?? groupBuy.group_price,
        discountPercentage: activeTier?.discount_percentage ?? groupBuy.discount_percentage,
      })
    : [];
  const totalSelectedQuantity = hasVariants
    ? getGroupBuySelectionsTotalQuantity(variantSelections)
    : normalizedQuantity;
  const totalAmount = hasVariants
    ? getGroupBuySelectionsTotalAmount(variantSelections)
    : discountedPrice * normalizedQuantity;
  const primaryVariantId = variantSelections[0]?.variantId ?? null;
  const averageUnitPrice = totalSelectedQuantity > 0
    ? totalAmount / totalSelectedQuantity
    : discountedPrice;
  const savings = useCheckoutSavings({ subtotal: totalAmount, shippingCost: 0 });
  const checkoutTotals = buildCheckoutSavingsTotalRows(
    savings,
    formatPrice,
    [
      ...(activeTier ? [{ label: 'Tier', value: activeTier.label }] : []),
      { label: 'Total items', value: String(totalSelectedQuantity) },
      { label: 'Subtotal', value: formatPrice(totalAmount) },
    ],
  );
  const existingQuantity = Math.max(0, Number(existingParticipation?.quantity || 0));
  const desiredTotalQuantity =
    existingParticipation && resolvedGroupBuySettings.allowDuplicateParticipation
      ? existingQuantity + totalSelectedQuantity
      : totalSelectedQuantity;
  const exceedsParticipantLimitPerUser =
    desiredTotalQuantity > resolvedGroupBuySettings.participantLimitPerUser;

  const resetForm = () => {
    setQuantity('1');
    setVariantQuantities({});
    setStep('select');
    setPayingWithPaystack(false);
  };

  const handleVariantQuantityChange = (variantId: string, nextValue: string) => {
    setVariantQuantities((current) => ({
      ...current,
      [variantId]: nextValue,
    }));
  };

  const handleContinueToPayment = () => {
    if (!hasDeliveryDetails) {
      redirectToAddressSetup();
      return;
    }

    setStep('payment');
  };

  const handlePaystackPayment = async () => {
    if (!user) return;

    if (!hasDeliveryDetails) {
      redirectToAddressSetup();
      return;
    }

    if (isClosedForNewParticipants) {
      toast.error('This group buy is already full.');
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
      toast.error(`This group buy allows up to ${resolvedGroupBuySettings.participantLimitPerUser} item(s) per shopper.`);
      return;
    }

    setPayingWithPaystack(true);

    try {
      const paystack = await loadPaystack();
      const { data: keyData, error: keyError } = await supabase.functions.invoke('get-paystack-key');
      if (keyError || !keyData?.publicKey) {
        throw new Error('Failed to initialize payment');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email, name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        throw new Error('Could not load your profile for payment.');
      }

      const customerEmail = profile?.email || user.email;
      if (!customerEmail) {
        throw new Error('Add an email address to continue with payment');
      }

      const reference = `GB-${groupBuy.id.slice(0, 8)}-${Date.now()}`;
      if (savings.total <= 0) {
        toast.error('Group buy checkout requires a card payment. Reduce wallet or loyalty credit applied.');
        setPayingWithPaystack(false);
        return;
      }
      const amountInPesewas = Math.round(savings.total * 100);
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
          type: 'group_buy',
          group_buy_id: groupBuy.id,
          user_id: user.id,
          quantity: totalSelectedQuantity,
          variant_id: primaryVariantId,
          variant_selections: variantSelections,
        },
        callback: function(response: PaystackTransactionResponse) {
          callbackFiredRef.current = true;
          verifyAndSaveParticipant(response.reference, amountInPesewas).catch((error) => {
            toast.error(getErrorMessage(error, `Failed to join the group buy. Contact support with ref: ${response.reference}`));
            setPayingWithPaystack(false);
          });
        },
        onClose: () => {
          setTimeout(() => {
            if (!callbackFiredRef.current) {
              setPayingWithPaystack(false);
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
        setPayingWithPaystack(false);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Payment failed'));
      setPayingWithPaystack(false);
    }
  };

  const verifyAndSaveParticipant = async (paymentRef: string, expectedAmount: number) => {
    try {
      const { data: verification, error: verificationError } = await supabase.functions.invoke(
        'verify-paystack-payment',
        { body: { reference: paymentRef } }
      );

      if (verificationError) {
        toast.error(`Payment verification failed. Contact support with ref: ${paymentRef}`);
        setPayingWithPaystack(false);
        return;
      }

      if (!verification?.verified) {
        toast.error(`Payment could not be verified. If you were charged, contact support with ref: ${paymentRef}`);
        setPayingWithPaystack(false);
        return;
      }

      if (!isPaystackAmountValid(verification, expectedAmount)) {
        toast.error(`Payment amount mismatch. Contact support with ref: ${paymentRef}`);
        setPayingWithPaystack(false);
        return;
      }

      if (verification.currency?.toUpperCase() !== 'GHS') {
        toast.error(`Payment currency mismatch. Contact support with ref: ${paymentRef}`);
        setPayingWithPaystack(false);
        return;
      }

      await saveParticipant(paymentRef);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to join the group buy after payment verification'));
      setPayingWithPaystack(false);
    }
  };

  const saveParticipant = async (paymentRef: string) => {
    if (!user) return;

    const { data: existingParticipant } = await supabase
      .from('group_buy_participants')
      .select('id, payment_status')
      .eq('group_buy_id', groupBuy.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingParticipant?.payment_status === 'paid' && !resolvedGroupBuySettings.allowDuplicateParticipation) {
      queryClient.invalidateQueries({ queryKey: ['group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['group-buy-participation'] });
      queryClient.invalidateQueries({ queryKey: ['my-group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['group-buy-detail'] });
      toast.success('You are already in this group buy.');
      setIsOpen(false);
      resetForm();
      return;
    }

    const addressData = buildAddressPayload(selectedAddress, selectedShippingRule);

    const referredByUserId =
      invite?.inviter_user_id && invite.inviter_user_id !== user.id
        ? invite.inviter_user_id
        : null;

    const { error } = await supabase.rpc('join_group_buy_after_payment' as never, {
      p_group_buy_id: groupBuy.id,
      p_quantity: totalSelectedQuantity,
      p_variant_id: primaryVariantId,
      p_payment_reference: paymentRef,
      p_shipping_address: withGroupBuySelectionsInShippingAddress(addressData, variantSelections),
      p_invite_code: invite?.invite_code || null,
      p_referred_by_user_id: referredByUserId,
      p_unit_price_at_join: averageUnitPrice,
      p_tier_label_at_join: activeTier?.label || null,
    } as never);

    if (error) {
      if (error.message.includes('duplicate') || error.code === '23505') {
        toast.success('You are already in this group buy.');
        queryClient.invalidateQueries({ queryKey: ['group-buys'] });
        queryClient.invalidateQueries({ queryKey: ['group-buy-participation'] });
        queryClient.invalidateQueries({ queryKey: ['my-group-buys'] });
        queryClient.invalidateQueries({ queryKey: ['group-buy-detail'] });
        setIsOpen(false);
        resetForm();
      } else {
        toast.error(`${error.message || 'Failed to join'}. Contact support with ref: ${paymentRef}`);
      }
    } else {
      queryClient.invalidateQueries({ queryKey: ['group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['group-buy-participation'] });
      queryClient.invalidateQueries({ queryKey: ['my-group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['group-buy-detail'] });
      toast.success(
        existingParticipant?.payment_status === 'paid' && resolvedGroupBuySettings.allowDuplicateParticipation
          ? 'Successfully added more items to this group buy!'
          : 'Successfully joined the group buy!',
      );
      setIsOpen(false);
      resetForm();
    }

    setPayingWithPaystack(false);
  };

  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Please sign in');
      const { data, error } = await supabase
        .from('group_buy_participants')
        .delete()
        .eq('group_buy_id', groupBuy.id)
        .eq('user_id', user.id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('You can only leave within one hour of joining while the group is still open.');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['group-buy-participation'] });
      queryClient.invalidateQueries({ queryKey: ['my-group-buys'] });
      toast.success('Left the group buy');
      setIsOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to leave group buy');
    },
  });

  const participantsNeeded = Math.max(0, groupBuy.min_participants - currentParticipants);
  const hasJoined = !!existingParticipation && !resolvedGroupBuySettings.allowDuplicateParticipation;
  const hasExistingParticipation = !!existingParticipation;
  const hasDeliveryDetails = hasRequiredGroupBuyDeliveryDetails({
    address: selectedAddress,
    email: user?.email,
  });
  const leaveWindow = existingParticipation
    ? getLeaveWindowInfo({
        currentParticipants,
        joinedAt: existingParticipation.joined_at,
        minParticipants: groupBuy.min_participants,
        status: groupBuy.status,
      })
    : null;
  const joinedButtonDisabled = hasJoined && disableDialogWhenJoined;

  const redirectToAddressSetup = () => {
    toast.error('Add delivery address before joining this group buy.');
    navigate(getGroupBuyAddressSetupPath());
  };

  if (!user) {
    return (
      <Button className={cn('w-full', triggerClassName)} onClick={() => toast.info('Please sign in to join this group buy')}>
        <Users className="h-4 w-4 mr-2" />
        {signedOutLabel}
      </Button>
    );
  }

  if (!hasJoined && !addressesLoading && !hasDeliveryDetails) {
    return (
      <Button
        className={cn('w-full', triggerClassName)}
        onClick={redirectToAddressSetup}
        variant="outline"
      >
        <Users className="h-4 w-4 mr-2" />
        {triggerLabel}
      </Button>
    );
  }

  return (
    <>
    <Dialog
      open={joinedButtonDisabled ? false : isOpen}
      onOpenChange={(open) => {
        if (joinedButtonDisabled) {
          return;
        }
        setIsOpen(open);
        if (!open) {
          resetForm();
        }
      }}
    >
      <DialogTrigger asChild>
        {hasJoined ? (
          <Button
            variant="outline"
            className={cn('h-11 w-full gap-2 rounded-xl', triggerClassName)}
            disabled={joinedButtonDisabled}
          >
            <Check className="h-4 w-4" /> {joinedLabel}
          </Button>
        ) : (
          <Button className={cn('h-11 w-full gap-2 rounded-xl', triggerClassName)} disabled={isClosedForNewParticipants}>
            <Users className="h-4 w-4" />
            {isAtParticipantCap
              ? 'Group Full'
              : hasExistingParticipation && resolvedGroupBuySettings.allowDuplicateParticipation
                ? 'Add More'
                : triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{hasJoined ? 'Your Participation' : 'Join Group Buy'}</DialogTitle>
          <DialogDescription>{groupBuy.product?.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-2xl border border-accent/20 bg-accent/10 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-muted-foreground">Original:</span>
              <span className="text-muted-foreground line-through">{formatPrice(groupBuy.product?.base_price || 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">{activeTier ? activeTier.label : 'Group Price'}:</span>
              <span className="text-xl font-bold text-primary">{formatPrice(discountedPrice)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Participants</span>
              <span className="font-medium">{currentParticipants} / {participantCap}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (currentParticipants / participantCap) * 100)}%` }} />
            </div>
            {participantsNeeded > 0 ? (
              <p className="text-xs text-muted-foreground">{participantsNeeded} more needed</p>
            ) : (
              <p className="text-xs font-medium text-primary">Goal reached!</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatGroupBuyTimeRemaining(groupBuy.expires_at)}
            </p>
          </div>

          {hasJoined ? (
            <div className="space-y-4 border-t pt-4">
              <div className="rounded-2xl bg-primary/10 p-4">
                <p className="flex items-center gap-2 font-medium text-primary">
                  <Check className="h-4 w-4" /> You've joined this group buy
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Qty: {existingParticipation.quantity}</p>
                {existingParticipation.payment_status === 'paid' ? (
                  <p className="mt-1 text-sm text-green-600">Payment confirmed</p>
                ) : null}
                <p className="mt-1 text-sm text-muted-foreground">
                  {leaveWindow?.canLeave
                    ? `You can still leave for ${leaveWindow.remainingMinutes} more minute${leaveWindow.remainingMinutes === 1 ? '' : 's'}.`
                    : 'Your participation is now locked in.'}
                </p>
              </div>
              <Button
                variant="destructive"
                className="h-11 w-full rounded-xl"
                onClick={() => leaveMutation.mutate()}
                disabled={leaveMutation.isPending || !leaveWindow?.canLeave}
              >
                {leaveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserMinus className="mr-2 h-4 w-4" />}
                Leave Group Buy
              </Button>
            </div>
          ) : step === 'select' ? (
            <>
              {hasExistingParticipation && resolvedGroupBuySettings.allowDuplicateParticipation ? (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
                  <p className="font-medium text-primary">You already joined this group buy.</p>
                  <p className="mt-1 text-muted-foreground">
                    Current quantity: {existingQuantity}. You can add more as long as you stay within the limit of {resolvedGroupBuySettings.participantLimitPerUser} item(s).
                  </p>
                </div>
              ) : null}
              {variants && variants.length > 0 ? (
                <div className="space-y-3">
                  <Label>Choose Variant Quantities</Label>
                  <div className="space-y-2">
                    {variants.map((variant) => {
                      const variantUnitPrice = getGroupBuyVariantUnitPrice({
                        variant,
                        basePrice: Number(groupBuy.product?.base_price || 0),
                        groupPrice: activeTier?.group_price ?? groupBuy.group_price,
                        discountPercentage: activeTier?.discount_percentage ?? groupBuy.discount_percentage,
                      });

                      return (
                        <div key={variant.id} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/70 p-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{getGroupBuyVariantLabel(variant)}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatPrice(variantUnitPrice)}
                              {variant.stock !== null && variant.stock <= 5 ? ` - ${variant.stock} left` : ''}
                            </p>
                          </div>
                          <VariantQuantityStepper
                            id={`join-group-buy-variant-${variant.id}`}
                            value={variantQuantities[variant.id] ?? ''}
                            max={variant.stock != null ? Math.max(0, variant.stock) : undefined}
                            onChange={(nextValue) => handleVariantQuantityChange(variant.id, nextValue)}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Choose one or more variants for this payment.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="join-qty">Quantity</Label>
                  <Input
                    id="join-qty"
                    type="number"
                    min="1"
                    max={resolvedGroupBuySettings.participantLimitPerUser}
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                </div>
              )}

              {selectedAddress ? (
                <div className="rounded-2xl bg-muted/50 p-3 text-sm">
                  <p className="font-medium text-foreground">Shipping to:</p>
                  <p className="text-muted-foreground">{selectedAddress.full_name}, {selectedAddress.city}</p>
                </div>
              ) : null}

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total to pay:</span>
                  <span className="text-xl font-bold text-primary">{formatPrice(totalAmount)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Total items: {totalSelectedQuantity}</p>
                {activeTier ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    This join uses tier: {activeTier.label}
                  </p>
                ) : null}
                {invite ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Invite reward will be credited after your join is confirmed.
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  Per-user limit for this group buy: {resolvedGroupBuySettings.participantLimitPerUser} item(s).
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button
                  className="h-11 flex-1 rounded-xl"
                  disabled={
                    exceedsParticipantLimitPerUser ||
                    (hasVariants ? totalSelectedQuantity <= 0 : normalizedQuantity <= 0)
                  }
                  onClick={handleContinueToPayment}
                >
                  <CreditCard className="mr-2 h-4 w-4" /> Proceed to Pay
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <PurchaseSummary
                title="Group Buy Checkout"
                subtitle="Review your join details before payment."
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
                        title: groupBuy.product?.name || 'Group buy item',
                        subtitle: selection.label,
                        quantity: selection.quantity,
                        amount: formatPrice(selection.unitPrice * selection.quantity),
                        details: [`${formatPrice(selection.unitPrice)} each`],
                      }))
                    : [
                        {
                          id: groupBuy.id,
                          title: groupBuy.product?.name || 'Group buy item',
                          subtitle: activeTier ? activeTier.label : 'Group buy reservation',
                          quantity,
                          amount: formatPrice(totalAmount),
                          details: [`${formatPrice(discountedPrice)} each`],
                        },
                      ]
                }
                totals={checkoutTotals}
                makeChangesLabel="Back"
                payLabel="Pay Now"
                isProcessing={payingWithPaystack}
                onMakeChanges={() => setStep('select')}
                onPay={handlePaystackPayment}
              >
                <CheckoutSavingsCard savings={savings} />
              </PurchaseSummary>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    <CheckoutSavingsDialog savings={savings} loyaltyPointsInputId="join-group-buy-loyalty-points" />
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
