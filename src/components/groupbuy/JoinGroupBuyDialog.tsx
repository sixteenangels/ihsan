import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, Loader2, Check, UserMinus, CreditCard } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';

interface JoinGroupBuyDialogProps {
  groupBuy: {
    id: string;
    product_id: string;
    min_participants: number;
    current_participants: number | null;
    discount_percentage: number | null;
    expires_at: string;
    product: {
      name: string;
      base_price: number;
    } | null;
  };
}

export function JoinGroupBuyDialog({ groupBuy }: JoinGroupBuyDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { formatPrice } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [step, setStep] = useState<'select' | 'payment'>('select');
  const [payingWithPaystack, setPayingWithPaystack] = useState(false);

  // Fetch product variants
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

  // Check if user already joined
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

  // Fetch user's default address
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

  const discountedPrice = groupBuy.product
    ? groupBuy.product.base_price * (1 - (groupBuy.discount_percentage || 0) / 100)
    : 0;

  const selectedVariant = variants?.find((v) => v.id === selectedVariantId);
  const unitPrice = selectedVariant?.price_override
    ? Number(selectedVariant.price_override) * (1 - (groupBuy.discount_percentage || 0) / 100)
    : discountedPrice;
  const totalAmount = unitPrice * parseInt(quantity || '1');

  const handlePaystackPayment = async () => {
    if (!user) return;
    setPayingWithPaystack(true);

    try {
      // Get Paystack key
      const { data: keyData, error: keyError } = await supabase.functions.invoke('get-paystack-key');
      if (keyError || !keyData?.publicKey) {
        throw new Error('Failed to initialize payment');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('email, name')
        .eq('user_id', user.id)
        .single();

      const reference = `GB-${groupBuy.id.slice(0, 8)}-${Date.now()}`;
      const amountInPesewas = Math.round(totalAmount * 100);

      // Load Paystack inline
      const handler = (window as any).PaystackPop?.setup({
        key: keyData.publicKey,
        email: profile?.email || user.email || '',
        amount: amountInPesewas,
        currency: 'GHS',
        ref: reference,
        metadata: {
          type: 'group_buy',
          group_buy_id: groupBuy.id,
          user_id: user.id,
          quantity: parseInt(quantity),
          variant_id: selectedVariantId || null,
        },
        callback: async (response: any) => {
          // Verify payment server-side before saving
          const { data: verification } = await supabase.functions.invoke(
            'verify-paystack-payment',
            { body: { reference: response.reference } }
          );

          if (verification?.verified) {
            await saveParticipant(response.reference);
          } else {
            toast.error('Payment could not be verified. If you were charged, contact support with ref: ' + response.reference);
            setPayingWithPaystack(false);
          }
        },
        onClose: () => {
          setPayingWithPaystack(false);
          toast.info('Payment cancelled. You were not charged.');
        },
      });

      if (handler) {
        handler.openIframe();
      } else {
        toast.error('Payment system not loaded. Please refresh and try again.');
        setPayingWithPaystack(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Payment failed');
      setPayingWithPaystack(false);
    }
  };

  const saveParticipant = async (paymentRef: string) => {
    if (!user) return;

    const addressData = defaultAddress ? {
      full_name: defaultAddress.full_name,
      phone: defaultAddress.phone,
      address_line1: defaultAddress.address_line1,
      address_line2: defaultAddress.address_line2,
      city: defaultAddress.city,
      state: defaultAddress.state,
      country: defaultAddress.country,
    } : null;

    const { error } = await supabase
      .from('group_buy_participants')
      .insert({
        group_buy_id: groupBuy.id,
        user_id: user.id,
        quantity: parseInt(quantity),
        variant_id: selectedVariantId || null,
        payment_reference: paymentRef,
        payment_status: 'paid',
        shipping_address: addressData,
      });

    if (error) {
      if (error.message.includes('duplicate') || error.code === '23505') {
        toast.error('You have already joined this group buy');
      } else {
        toast.error(error.message || 'Failed to join');
      }
    } else {
      queryClient.invalidateQueries({ queryKey: ['group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['group-buy-participation'] });
      queryClient.invalidateQueries({ queryKey: ['my-group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['group-buy-detail'] });
      toast.success('Successfully joined the group buy!');
      setIsOpen(false);
      setStep('select');
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

  const participantsNeeded = Math.max(0, groupBuy.min_participants - (groupBuy.current_participants || 0));
  const hasJoined = !!existingParticipation;

  if (!user) {
    return (
      <Button className="w-full" onClick={() => toast.info('Please sign in to join this group buy')}>
        <Users className="h-4 w-4 mr-2" />
        Join Group Buy
      </Button>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setStep('select'); }}>
      <DialogTrigger asChild>
        {hasJoined ? (
          <Button variant="outline" className="w-full gap-2">
            <Check className="h-4 w-4" /> Joined
          </Button>
        ) : (
          <Button className="w-full gap-2">
            <Users className="h-4 w-4" /> Join Group Buy
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{hasJoined ? 'Your Participation' : 'Join Group Buy'}</DialogTitle>
          <DialogDescription>{groupBuy.product?.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Price Info */}
          <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
            <div className="flex justify-between items-center mb-2">
              <span className="text-muted-foreground">Original:</span>
              <span className="line-through text-muted-foreground">{formatPrice(groupBuy.product?.base_price || 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Group Price:</span>
              <span className="text-xl font-bold text-primary">{formatPrice(discountedPrice)}</span>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Participants</span>
              <span className="font-medium">{groupBuy.current_participants || 0} / {groupBuy.min_participants}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${Math.min(100, ((groupBuy.current_participants || 0) / groupBuy.min_participants) * 100)}%` }} />
            </div>
            {participantsNeeded > 0 ? (
              <p className="text-xs text-muted-foreground">{participantsNeeded} more needed</p>
            ) : (
              <p className="text-xs text-primary font-medium">🎉 Goal reached!</p>
            )}
          </div>

          {hasJoined ? (
            <div className="space-y-4 pt-4 border-t">
              <div className="p-4 rounded-lg bg-primary/10">
                <p className="font-medium text-primary flex items-center gap-2">
                  <Check className="h-4 w-4" /> You've joined this group buy
                </p>
                <p className="text-sm text-muted-foreground mt-1">Qty: {existingParticipation.quantity}</p>
                {existingParticipation.payment_status === 'paid' && (
                  <p className="text-sm text-green-600 mt-1">✓ Payment confirmed</p>
                )}
              </div>
              <Button variant="destructive" className="w-full" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending}>
                {leaveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserMinus className="h-4 w-4 mr-2" />}
                Leave Group Buy
              </Button>
            </div>
          ) : step === 'select' ? (
            <>
              {/* Variant Selection */}
              {variants && variants.length > 0 && (
                <div className="space-y-2">
                  <Label>Select Variant</Label>
                  <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a variant" />
                    </SelectTrigger>
                    <SelectContent>
                      {variants.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {[v.color, v.size].filter(Boolean).join(' • ') || v.sku || 'Default'}{' '}
                          {v.price_override ? `— ${formatPrice(Number(v.price_override))}` : ''}
                          {v.stock !== null && v.stock <= 5 ? ` (${v.stock} left)` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="join-qty">Quantity</Label>
                <Input id="join-qty" type="number" min="1" max="10" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>

              {/* Address preview */}
              {defaultAddress && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <p className="font-medium text-foreground">Shipping to:</p>
                  <p className="text-muted-foreground">{defaultAddress.full_name}, {defaultAddress.city}</p>
                </div>
              )}

              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total to pay:</span>
                  <span className="text-xl font-bold text-primary">{formatPrice(totalAmount)}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button className="flex-1" onClick={() => setStep('payment')}>
                  <CreditCard className="h-4 w-4 mr-2" /> Proceed to Pay
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 border">
                <h4 className="font-medium mb-2">Order Summary</h4>
                <div className="text-sm space-y-1">
                  {selectedVariant && <p>Variant: {[selectedVariant.color, selectedVariant.size].filter(Boolean).join(' • ')}</p>}
                  <p>Quantity: {quantity}</p>
                  <p className="font-bold text-primary">Total: {formatPrice(totalAmount)}</p>
                </div>
              </div>

              <Button className="w-full" onClick={handlePaystackPayment} disabled={payingWithPaystack}>
                {payingWithPaystack ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                Pay {formatPrice(totalAmount)} with Paystack
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setStep('select')}>
                Back
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
