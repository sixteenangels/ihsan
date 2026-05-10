import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, Loader2, CreditCard } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';
import { getErrorMessage } from '@/lib/errors';
import { loadPaystack, type PaystackTransactionResponse } from '@/lib/paystack';

interface StartGroupBuyDialogProps {
  product: {
    id: string;
    name: string;
    base_price: number;
    group_buy_price: number | null;
  };
}

export function StartGroupBuyDialog({ product }: StartGroupBuyDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { formatPrice } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [participantCount, setParticipantCount] = useState('5');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [step, setStep] = useState<'setup' | 'payment'>('setup');
  const [isPaying, setIsPaying] = useState(false);
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

  const hasVariants = (variants?.length ?? 0) > 0;
  const offeredUnitPrice = product.group_buy_price ?? product.base_price;
  const discountPercentage = product.base_price > 0
    ? Math.max(0, Math.round(((product.base_price - offeredUnitPrice) / product.base_price) * 100))
    : 0;
  const normalizedQuantity = Math.max(1, Number.parseInt(quantity || '1', 10) || 1);
  const normalizedParticipantCount = Math.max(2, Number.parseInt(participantCount || '2', 10) || 2);
  const totalAmount = offeredUnitPrice * normalizedQuantity;

  const resetForm = () => {
    setParticipantCount('5');
    setSelectedVariantId('');
    setQuantity('1');
    setStep('setup');
  };

  const handleOpen = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handlePayAndCreate = async () => {
    if (!user) return;
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
      callbackFiredRef.current = false;

      const handler = paystack.setup({
        key: keyData.publicKey,
        email: customerEmail,
        amount: amountInPesewas,
        currency: 'GHS',
        ref: reference,
        metadata: { type: 'group_buy_start', product_id: product.id, user_id: user.id },
        callback: async (response: PaystackTransactionResponse) => {
          callbackFiredRef.current = true;
          await verifyAndCreateGroupBuy(response.reference, amountInPesewas);
        },
        onClose: () => {
          setTimeout(() => {
            if (!callbackFiredRef.current) {
              setIsPaying(false);
              toast.info('Payment cancelled. You were not charged.');
            }
          }, 500);
        },
      });

      if (handler) {
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

      if (verification.amount !== expectedAmount) {
        toast.error(`Payment amount mismatch. Contact support with ref: ${paymentRef}`);
        setIsPaying(false);
        return;
      }

      if (verification.currency !== 'GHS') {
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
      setIsPaying(false);
      resetForm();
      return;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

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

    const addressData = defaultAddress ? {
      full_name: defaultAddress.full_name,
      phone: defaultAddress.phone,
      address_line1: defaultAddress.address_line1,
      address_line2: defaultAddress.address_line2,
      city: defaultAddress.city,
      state: defaultAddress.state,
      country: defaultAddress.country,
    } : null;

    const { error: participantError } = await supabase.from('group_buy_participants').insert({
      group_buy_id: gbData.id,
      user_id: user.id,
      quantity: normalizedQuantity,
      variant_id: selectedVariantId || null,
      payment_reference: paymentRef,
      payment_status: 'paid',
      shipping_address: addressData,
      unit_price_at_join: offeredUnitPrice,
      tier_label_at_join: 'Base group price',
    });

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
    setIsPaying(false);
    resetForm();
  };

  if (!user) {
    return (
      <Button variant="secondary" onClick={() => toast.info('Please sign in to start a group buy')}>
        <Users className="h-4 w-4 mr-2" /> Start Group Buy
      </Button>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Users className="h-4 w-4 mr-2" /> Start Group Buy
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start a Group Buy</DialogTitle>
          <DialogDescription>Create a shared offer for "{product.name}"</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === 'setup' ? (
            <>
              <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">Regular price:</span>
                  <span className="line-through text-muted-foreground">{formatPrice(product.base_price)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Group price:</span>
                  <span className="text-xl font-bold text-primary">{formatPrice(offeredUnitPrice)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Participants Needed</Label>
                <Input
                  type="number"
                  min="2"
                  max="100"
                  value={participantCount}
                  onChange={(e) => setParticipantCount(e.target.value)}
                />
              </div>

              {variants && variants.length > 0 && (
                <div className="space-y-2">
                  <Label>Your Variant</Label>
                  <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                    <SelectTrigger><SelectValue placeholder="Choose variant" /></SelectTrigger>
                    <SelectContent>
                      {variants.map((variant) => (
                        <SelectItem key={variant.id} value={variant.id}>
                          {[variant.color, variant.size].filter(Boolean).join(' • ') || variant.sku || 'Default'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Your Quantity</Label>
                <Input type="number" min="1" max="10" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button
                  className="flex-1"
                  disabled={normalizedParticipantCount < 2 || (hasVariants && !selectedVariantId)}
                  onClick={() => setStep('payment')}
                >
                  Next: Pay and Start
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 border">
                <h4 className="font-medium mb-2">Summary</h4>
                <div className="text-sm space-y-1">
                  <p>Participants needed: {participantCount}</p>
                  <p>Your quantity: {quantity}</p>
                  <p className="font-bold text-primary">Your payment: {formatPrice(totalAmount)}</p>
                </div>
              </div>

              <Button className="w-full" onClick={handlePayAndCreate} disabled={isPaying}>
                {isPaying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
                Pay {formatPrice(totalAmount)} and Start Group Buy
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setStep('setup')}>Back</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
