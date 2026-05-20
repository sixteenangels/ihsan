import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
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
import { Users, Loader2, Check, UserMinus, CreditCard } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';
import { getErrorMessage } from '@/lib/errors';
import { loadPaystack, type PaystackTransactionResponse } from '@/lib/paystack';
import { VariantQuantityStepper } from '@/components/groupbuy/VariantQuantityStepper';
import { cn } from '@/lib/utils';
import {
  buildGroupBuyVariantSelections,
  getGroupBuySelectionsTotalAmount,
  getGroupBuySelectionsTotalQuantity,
  getGroupBuyVariantLabel,
  getGroupBuyVariantUnitPrice,
  withGroupBuySelectionsInShippingAddress,
} from '@/lib/groupBuySelections';

interface JoinGroupBuyDialogProps {
  inviteCode?: string | null;
  triggerClassName?: string;
  triggerLabel?: string;
  joinedLabel?: string;
  signedOutLabel?: string;
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

export function JoinGroupBuyDialog({
  groupBuy,
  inviteCode,
  triggerClassName,
  triggerLabel = 'Join Group Buy',
  joinedLabel = 'Joined',
  signedOutLabel = 'Join Group Buy',
}: JoinGroupBuyDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { formatPrice } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [variantQuantities, setVariantQuantities] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'select' | 'payment'>('select');
  const [payingWithPaystack, setPayingWithPaystack] = useState(false);
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

  const { data: defaultAddress } = useQuery({
    queryKey: ['default-address', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: invite } = useQuery({
    queryKey: ['group-buy-invite', inviteCode],
    queryFn: async () => {
      if (!inviteCode) return null;
      const { data } = await supabase
        .from('group_buy_invites' as never)
        .select('invite_code, inviter_user_id')
        .eq('invite_code', inviteCode)
        .maybeSingle();

      return data as unknown as { invite_code: string; inviter_user_id: string } | null;
    },
    enabled: !!inviteCode,
  });

  const hasVariants = (variants?.length ?? 0) > 0;
  const currentParticipants = groupBuy.current_participants || 0;
  const participantCap = groupBuy.max_participants ?? groupBuy.min_participants;
  const isAtParticipantCap = currentParticipants >= participantCap;
  const isClosedForNewParticipants = groupBuy.status !== 'open' || isAtParticipantCap;
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

  const handlePaystackPayment = async () => {
    if (!user) return;

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

    setPayingWithPaystack(true);

    try {
      const paystack = await loadPaystack();
      const { data: keyData, error: keyError } = await supabase.functions.invoke('get-paystack-key');
      if (keyError || !keyData?.publicKey) {
        throw new Error('Failed to initialize payment');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('email, name')
        .eq('user_id', user.id)
        .single();

      const customerEmail = profile?.email || user.email;
      if (!customerEmail) {
        throw new Error('Add an email address to continue with payment');
      }

      const reference = `GB-${groupBuy.id.slice(0, 8)}-${Date.now()}`;
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

      if (verification.amount !== expectedAmount) {
        toast.error(`Payment amount mismatch. Contact support with ref: ${paymentRef}`);
        setPayingWithPaystack(false);
        return;
      }

      if (verification.currency !== 'GHS') {
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

    if (existingParticipant?.payment_status === 'paid') {
      queryClient.invalidateQueries({ queryKey: ['group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['group-buy-participation'] });
      queryClient.invalidateQueries({ queryKey: ['my-group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['group-buy-detail'] });
      toast.success('You are already in this group buy.');
      setIsOpen(false);
      resetForm();
      return;
    }

    const addressData = defaultAddress ? {
      full_name: defaultAddress.full_name,
      phone: defaultAddress.phone,
      address_line1: defaultAddress.address_line1,
      address_line2: defaultAddress.address_line2,
      city: defaultAddress.city,
      state: defaultAddress.state,
      country: defaultAddress.country,
    } : null;

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
      toast.success('Successfully joined the group buy!');
      setIsOpen(false);
      resetForm();
    }

    setPayingWithPaystack(false);
  };

  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Please sign in');
      const { error } = await supabase
        .from('group_buy_participants')
        .delete()
        .eq('group_buy_id', groupBuy.id)
        .eq('user_id', user.id);
      if (error) throw error;
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
  const hasJoined = !!existingParticipation;

  if (!user) {
    return (
      <Button className={cn('w-full', triggerClassName)} onClick={() => toast.info('Please sign in to join this group buy')}>
        <Users className="h-4 w-4 mr-2" />
        {signedOutLabel}
      </Button>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          resetForm();
        }
      }}
    >
      <DialogTrigger asChild>
        {hasJoined ? (
          <Button variant="outline" className={cn('h-11 w-full gap-2 rounded-xl', triggerClassName)}>
            <Check className="h-4 w-4" /> {joinedLabel}
          </Button>
        ) : (
          <Button className={cn('h-11 w-full gap-2 rounded-xl', triggerClassName)} disabled={isClosedForNewParticipants}>
            <Users className="h-4 w-4" />
            {isAtParticipantCap ? 'Group Full' : triggerLabel}
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
              </div>
              <Button variant="destructive" className="h-11 w-full rounded-xl" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending}>
                {leaveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserMinus className="mr-2 h-4 w-4" />}
                Leave Group Buy
              </Button>
            </div>
          ) : step === 'select' ? (
            <>
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
                  <Input id="join-qty" type="number" min="1" max="10" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                </div>
              )}

              {defaultAddress ? (
                <div className="rounded-2xl bg-muted/50 p-3 text-sm">
                  <p className="font-medium text-foreground">Shipping to:</p>
                  <p className="text-muted-foreground">{defaultAddress.full_name}, {defaultAddress.city}</p>
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
              </div>

              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button
                  className="h-11 flex-1 rounded-xl"
                  disabled={hasVariants ? totalSelectedQuantity <= 0 : normalizedQuantity <= 0}
                  onClick={() => setStep('payment')}
                >
                  <CreditCard className="mr-2 h-4 w-4" /> Proceed to Pay
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-muted/50 p-4">
                <h4 className="mb-2 font-medium">Order Summary</h4>
                <div className="space-y-1 text-sm">
                  {hasVariants ? (
                    variantSelections.map((selection) => (
                      <p key={selection.variantId}>
                        {selection.label}: {selection.quantity}
                      </p>
                    ))
                  ) : (
                    <p>Quantity: {quantity}</p>
                  )}
                  {hasVariants ? <p>Total items: {totalSelectedQuantity}</p> : null}
                  <p className="font-bold text-primary">Total: {formatPrice(totalAmount)}</p>
                </div>
              </div>

              <Button className="h-11 w-full rounded-xl" onClick={handlePaystackPayment} disabled={payingWithPaystack}>
                {payingWithPaystack ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                Pay Now
              </Button>
              <Button variant="outline" className="h-11 w-full rounded-xl" onClick={() => setStep('select')}>
                Back
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
