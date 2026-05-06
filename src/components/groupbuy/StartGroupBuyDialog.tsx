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
import { Users, Loader2, Calendar, CreditCard } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';

interface StartGroupBuyDialogProps {
  product: {
    id: string;
    name: string;
    base_price: number;
  };
}

export function StartGroupBuyDialog({ product }: StartGroupBuyDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { formatPrice } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [minParticipants, setMinParticipants] = useState('5');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('15');
  const [expiresAt, setExpiresAt] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [step, setStep] = useState<'setup' | 'payment'>('setup');
  const [isPaying, setIsPaying] = useState(false);

  // Fetch variants
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

  // Fetch default address
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

  const discountedPrice = product.base_price * (1 - Number(discountPercentage) / 100);
  const selectedVariant = variants?.find((v) => v.id === selectedVariantId);
  const unitPrice = selectedVariant?.price_override
    ? Number(selectedVariant.price_override) * (1 - Number(discountPercentage) / 100)
    : discountedPrice;
  const totalAmount = unitPrice * parseInt(quantity || '1');

  const getDefaultExpiry = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().slice(0, 16);
  };

  const handleOpen = (open: boolean) => {
    setIsOpen(open);
    if (open && !expiresAt) setExpiresAt(getDefaultExpiry());
    if (!open) { setStep('setup'); }
  };

  const handlePayAndCreate = async () => {
    if (!user) return;
    setIsPaying(true);

    try {
      // Get Paystack key
      const { data: keyData, error: keyError } = await supabase.functions.invoke('get-paystack-key');
      if (keyError || !keyData?.publicKey) throw new Error('Failed to initialize payment');

      const { data: profile } = await supabase
        .from('profiles')
        .select('email, name')
        .eq('user_id', user.id)
        .single();

      const reference = `GB-NEW-${Date.now()}`;
      const amountInPesewas = Math.round(totalAmount * 100);

      const handler = (window as any).PaystackPop?.setup({
        key: keyData.publicKey,
        email: profile?.email || user.email || '',
        amount: amountInPesewas,
        currency: 'GHS',
        ref: reference,
        metadata: { type: 'group_buy_start', product_id: product.id, user_id: user.id },
        callback: async (response: any) => {
          // Verify payment server-side before creating group buy
          const { data: verification } = await supabase.functions.invoke(
            'verify-paystack-payment',
            { body: { reference: response.reference } }
          );

          if (verification?.verified) {
            await createGroupBuy(response.reference);
          } else {
            toast.error('Payment could not be verified. If you were charged, contact support with ref: ' + response.reference);
            setIsPaying(false);
          }
        },
        onClose: () => {
          setIsPaying(false);
          toast.info('Payment cancelled. You were not charged.');
        },
      });

      if (handler) {
        handler.openIframe();
      } else {
        toast.error('Payment system not loaded. Please refresh and try again.');
        setIsPaying(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Payment failed');
      setIsPaying(false);
    }
  };

  const createGroupBuy = async (paymentRef: string) => {
    if (!user) return;

    const { data: gbData, error: gbError } = await supabase
      .from('group_buys')
      .insert({
        product_id: product.id,
        title: title || `${product.name} Group Buy`,
        min_participants: parseInt(minParticipants),
        max_participants: maxParticipants ? parseInt(maxParticipants) : null,
        discount_percentage: parseFloat(discountPercentage),
        expires_at: new Date(expiresAt).toISOString(),
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

    // Auto-join creator
    const addressData = defaultAddress ? {
      full_name: defaultAddress.full_name,
      phone: defaultAddress.phone,
      address_line1: defaultAddress.address_line1,
      city: defaultAddress.city,
      country: defaultAddress.country,
    } : null;

    await supabase.from('group_buy_participants').insert({
      group_buy_id: gbData.id,
      user_id: user.id,
      quantity: parseInt(quantity),
      variant_id: selectedVariantId || null,
      payment_reference: paymentRef,
      payment_status: 'paid',
      shipping_address: addressData,
    });

    queryClient.invalidateQueries({ queryKey: ['group-buys'] });
    queryClient.invalidateQueries({ queryKey: ['my-group-buys'] });
    toast.success('Group buy started! Share it with friends.');
    setIsOpen(false);
    setStep('setup');
    setIsPaying(false);
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setMinParticipants('5');
    setMaxParticipants('');
    setDiscountPercentage('15');
    setExpiresAt('');
    setSelectedVariantId('');
    setQuantity('1');
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
          <DialogDescription>Create a group buy for "{product.name}"</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === 'setup' ? (
            <>
              {/* Price Preview */}
              <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">Original:</span>
                  <span className="line-through text-muted-foreground">{formatPrice(product.base_price)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Group Price:</span>
                  <span className="text-xl font-bold text-primary">{formatPrice(discountedPrice)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gb-title">Group Buy Title</Label>
                <Input id="gb-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${product.name} Group Buy`} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Participants</Label>
                  <Input type="number" min="2" max="100" value={minParticipants} onChange={(e) => setMinParticipants(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Discount %</Label>
                  <Input type="number" min="5" max="50" value={discountPercentage} onChange={(e) => setDiscountPercentage(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Max Participants (optional)</Label>
                <Input type="number" min="" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} placeholder="No limit" />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Deadline</Label>
                <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
              </div>

              {/* Variant for creator */}
              {variants && variants.length > 0 && (
                <div className="space-y-2">
                  <Label>Your Variant</Label>
                  <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                    <SelectTrigger><SelectValue placeholder="Choose variant" /></SelectTrigger>
                    <SelectContent>
                      {variants.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {[v.color, v.size].filter(Boolean).join(' • ') || v.sku || 'Default'}
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
                  disabled={!expiresAt || parseInt(minParticipants) < 2 || (variants && variants.length > 0 && !selectedVariantId)}
                  onClick={() => setStep('payment')}
                >
                  {variants && variants.length > 0 && !selectedVariantId ? 'Select a variant' : 'Next: Pay & Create'}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 border">
                <h4 className="font-medium mb-2">Summary</h4>
                <div className="text-sm space-y-1">
                  <p>Title: {title || `${product.name} Group Buy`}</p>
                  <p>Min Participants: {minParticipants}</p>
                  <p>Discount: {discountPercentage}%</p>
                  <p>Your Qty: {quantity}</p>
                  <p className="font-bold text-primary">Your Payment: {formatPrice(totalAmount)}</p>
                </div>
              </div>

              <Button className="w-full" onClick={handlePayAndCreate} disabled={isPaying}>
                {isPaying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
                Pay {formatPrice(totalAmount)} & Start Group Buy
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setStep('setup')}>Back</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
