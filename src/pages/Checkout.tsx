import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Plus, Ship, Plane, Package, CreditCard, Check, Tag, X, AlertTriangle, Wallet, Shield } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWalletBalance } from '@/hooks/useWallet';

interface Address {
  id: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state?: string;
  country: string;
  postal_code?: string;
  is_default: boolean;
  label?: string;
}

interface ShippingClass {
  id: string;
  name: string;
  base_price: number;
  estimated_days_min: number;
  estimated_days_max: number;
  shipping_type: {
    id: string;
    name: string;
  };
}

interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_order_amount: number | null;
  current_uses: number;
}

declare global {
  interface Window {
    PaystackPop: any;
  }
}

export default function Checkout() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { items, subtotal, clearCart } = useCart();
  const { formatPrice, currency } = useCurrency();
  
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [shippingClasses, setShippingClasses] = useState<ShippingClass[]>([]);
  const [selectedShippingId, setSelectedShippingId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [pendingPaymentRef, setPendingPaymentRef] = useState<string | null>(null);
  const [showPaymentRecovery, setShowPaymentRecovery] = useState(false);
  const [courierAcknowledged, setCourierAcknowledged] = useState(false);
  const callbackFiredRef = useRef(false);
  const [orderCreationInProgress, setOrderCreationInProgress] = useState(false);

  // Wallet redemption
  const walletBalance = useWalletBalance();
  const [useWalletCredit, setUseWalletCredit] = useState(false);

  // Fragile / packaging — keyed by product_id
  const [productMeta, setProductMeta] = useState<Record<string, { is_fragile: boolean; reinforced_cost: number; is_free_shipping: boolean }>>({});
  const [globalReinforcedCost, setGlobalReinforcedCost] = useState<number>(0);
  const [packagingChoice, setPackagingChoice] = useState<'standard' | 'reinforced'>('reinforced');
  const [showStandardWarning, setShowStandardWarning] = useState(false);
  const [newAddress, setNewAddress] = useState({
    full_name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    label: '',
  });

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      toast.error('Please sign in to checkout');
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      navigate('/cart');
    }
  }, [items, navigate]);

  // Load Paystack script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Fetch addresses and shipping classes
  useEffect(() => {
    if (user) {
      fetchAddresses();
      fetchShippingClasses();
    }
  }, [user]);

  const fetchAddresses = async () => {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .order('is_default', { ascending: false });
    
    if (data) {
      setAddresses(data);
      const defaultAddress = data.find(a => a.is_default);
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
      } else if (data.length > 0) {
        setSelectedAddressId(data[0].id);
      }
    }
  };

  // Get product IDs from cart
  const cartProductIds = useMemo(() => {
    return [...new Set(items.map(item => item.product.id))];
  }, [items]);

  // Fetch product meta (fragile / reinforced cost / free shipping) + global default reinforced cost
  useEffect(() => {
    if (cartProductIds.length === 0) return;
    (async () => {
      const [{ data: products }, { data: settings }] = await Promise.all([
        supabase
          .from('products')
          .select('id, is_fragile, reinforced_packaging_cost, is_free_shipping')
          .in('id', cartProductIds),
        supabase
          .from('store_settings')
          .select('value')
          .eq('key', 'reinforcedPackagingCost')
          .maybeSingle(),
      ]);
      const meta: Record<string, { is_fragile: boolean; reinforced_cost: number; is_free_shipping: boolean }> = {};
      (products || []).forEach((p: any) => {
        meta[p.id] = {
          is_fragile: !!p.is_fragile,
          reinforced_cost: Number(p.reinforced_packaging_cost) || 0,
          is_free_shipping: !!p.is_free_shipping,
        };
      });
      setProductMeta(meta);
      const globalDefault = Number((settings as any)?.value) || 0;
      setGlobalReinforcedCost(globalDefault);
    })();
  }, [cartProductIds.join(',')]);

  // Cart-level fragile / free shipping detection
  const hasFragile = items.some((it) => productMeta[it.product.id]?.is_fragile);
  const allFreeShipping = items.length > 0 && items.every((it) =>
    productMeta[it.product.id]?.is_free_shipping || it.product.isFreeShippingEligible
  );

  // Reinforced packaging cost = sum of per-product overrides, falling back to global default
  const reinforcedPackagingCost = useMemo(() => {
    if (!hasFragile || packagingChoice !== 'reinforced') return 0;
    let total = 0;
    items.forEach((it) => {
      const m = productMeta[it.product.id];
      if (!m?.is_fragile) return;
      const cost = m.reinforced_cost > 0 ? m.reinforced_cost : globalReinforcedCost;
      total += cost * it.quantity;
    });
    return total;
  }, [items, productMeta, globalReinforcedCost, hasFragile, packagingChoice]);

  // Fetch shipping classes that are allowed for ALL products in cart
  const fetchShippingClasses = async () => {
    if (cartProductIds.length === 0) {
      setShippingClasses([]);
      return;
    }

    // Get all shipping rules for products in cart - only active shipping classes
    const { data: shippingRules, error: rulesError } = await supabase
      .from('product_shipping_rules')
      .select(`
        product_id,
        shipping_class_id,
        price,
        is_allowed,
        shipping_classes!inner(
          id,
          name,
          base_price,
          estimated_days_min,
          estimated_days_max,
          is_active,
          shipping_types!inner(id, name, is_active)
        )
      `)
      .in('product_id', cartProductIds)
      .eq('is_allowed', true)
      .eq('shipping_classes.is_active', true);

    if (rulesError) {
      console.error('Error fetching shipping rules:', rulesError);
      return;
    }

    // Find shipping classes that are allowed for ALL products
    const shippingClassCounts = new Map<string, { count: number; data: ShippingClass; totalPrice: number }>();
    
    shippingRules?.forEach((rule: any) => {
      const sc = rule.shipping_classes;
      if (!sc || !sc.is_active) return;
      
      const existing = shippingClassCounts.get(sc.id);
      if (existing) {
        existing.count++;
        existing.totalPrice += rule.price;
      } else {
        shippingClassCounts.set(sc.id, {
          count: 1,
          totalPrice: rule.price,
          data: {
            id: sc.id,
            name: sc.name,
            base_price: sc.base_price,
            estimated_days_min: sc.estimated_days_min,
            estimated_days_max: sc.estimated_days_max,
            shipping_type: sc.shipping_types ? {
              id: sc.shipping_types.id,
              name: sc.shipping_types.name
            } : { id: '', name: '' }
          }
        });
      }
    });

    // Only include shipping classes available for ALL cart products
    const validClasses: ShippingClass[] = [];
    shippingClassCounts.forEach((value, key) => {
      if (value.count >= cartProductIds.length) {
        // Use the sum of per-product prices
        validClasses.push({
          ...value.data,
          base_price: value.totalPrice
        });
      }
    });

    setShippingClasses(validClasses);
    if (validClasses.length > 0 && !selectedShippingId) {
      setSelectedShippingId(validClasses[0].id);
    }
  };

  const handleAddAddress = async () => {
    if (!newAddress.full_name || !newAddress.phone || !newAddress.address_line1 || !newAddress.city || !newAddress.country) {
      toast.error('Please fill in all required fields');
      return;
    }

    const { data, error } = await supabase
      .from('addresses')
      .insert({
        ...newAddress,
        user_id: user?.id,
        is_default: addresses.length === 0,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to add address');
      return;
    }

    if (data) {
      setAddresses([...addresses, data]);
      setSelectedAddressId(data.id);
      setIsAddressDialogOpen(false);
      setNewAddress({
        full_name: '',
        phone: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        country: '',
        postal_code: '',
        label: '',
      });
      toast.success('Address added successfully');
    }
  };

  const selectedShipping = shippingClasses.find(s => s.id === selectedShippingId);
  // Free shipping override: if every cart item is marked free shipping, force shipping cost to 0
  const rawShippingCost = selectedShipping?.base_price || 0;
  const shippingCost = allFreeShipping ? 0 : rawShippingCost;

  // Calculate discount
  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'percentage') {
      return (subtotal * appliedCoupon.value) / 100;
    }
    return appliedCoupon.value;
  };

  const discount = calculateDiscount();
  const subtotalBeforeWallet = subtotal + shippingCost + reinforcedPackagingCost - discount;
  const walletApplied = useWalletCredit ? Math.min(walletBalance, subtotalBeforeWallet) : 0;
  const total = Math.max(0, subtotalBeforeWallet - walletApplied);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }
    
    setIsApplyingCoupon(true);
    
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', couponCode.toUpperCase())
      .eq('is_active', true)
      .single();
    
    if (error || !data) {
      toast.error('Invalid coupon code');
      setIsApplyingCoupon(false);
      return;
    }
    
    // Check if coupon is expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      toast.error('This coupon has expired');
      setIsApplyingCoupon(false);
      return;
    }
    
    // Check minimum order amount
    if (data.min_order_amount && subtotal < data.min_order_amount) {
      toast.error(`Minimum order amount of ${formatPrice(data.min_order_amount)} required`);
      setIsApplyingCoupon(false);
      return;
    }
    
    // Check max uses
    if (data.max_uses && data.current_uses >= data.max_uses) {
      toast.error('This coupon has reached its usage limit');
      setIsApplyingCoupon(false);
      return;
    }
    
    setAppliedCoupon(data as Coupon);
    toast.success('Coupon applied successfully!');
    setIsApplyingCoupon(false);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  const getShippingIcon = (typeName: string) => {
    const lower = typeName.toLowerCase();
    if (lower.includes('sea')) return <Ship className="h-5 w-5" />;
    if (lower.includes('express')) return <Package className="h-5 w-5" />;
    return <Plane className="h-5 w-5" />;
  };

  const handlePaystackPayment = async () => {
    if (!selectedAddressId) {
      toast.error('Please select a delivery address');
      return;
    }
    if (!selectedShippingId) {
      toast.error('Please select a shipping method');
      return;
    }
    // Check courier acknowledgment
    const isCourierShipping = selectedShipping?.name.toLowerCase().includes('courier');
    if (isCourierShipping && !courierAcknowledged) {
      toast.error('Please acknowledge the courier delivery fee terms');
      return;
    }
    if (!user?.email) {
      toast.error('User email not found');
      return;
    }

    if (!window.PaystackPop) {
      toast.error('Payment system is loading. Please try again in a moment.');
      return;
    }

    setIsProcessing(true);

    try {
      const { data: configData, error: configError } = await supabase.functions.invoke('get-paystack-key');
      
      if (configError || !configData?.publicKey) {
        toast.error('Unable to connect to payment service. Please try again.');
        setIsProcessing(false);
        return;
      }

      const reference = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setPendingPaymentRef(reference);
      callbackFiredRef.current = false;

      const handler = window.PaystackPop.setup({
        key: configData.publicKey,
        email: user.email,
        amount: Math.round(total * 100),
        currency: 'GHS',
        ref: reference,
        callback: function(response: { reference: string }) {
          callbackFiredRef.current = true;
          verifyAndCreateOrder(response.reference).catch((err) => {
            console.error('Order creation error:', err);
            toast.error('Order creation failed. Please contact support with ref: ' + response.reference);
            setIsProcessing(false);
          });
        },
        onClose: function() {
          // Only show cancel UI if callback never fired (genuine cancel)
          // Paystack fires onClose AFTER callback on success — ignore it then
          setTimeout(() => {
            // Use a small delay to let callback set the flag first
            if (!callbackFiredRef.current) {
              setIsProcessing(false);
              if (pendingPaymentRef) {
                setShowPaymentRecovery(true);
              }
            }
          }, 500);
        },
      });

      handler.openIframe();
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error?.message || 'Payment initialization failed. Please try again.');
      setIsProcessing(false);
    }
  };

  const verifyAndCreateOrder = async (paymentReference: string) => {
    // Fix #8: Duplicate order guard
    if (orderCreationInProgress) {
      console.warn('Order creation already in progress, ignoring duplicate call');
      return;
    }
    setOrderCreationInProgress(true);

    const selectedAddress = addresses.find(a => a.id === selectedAddressId);
    
    try {
      // Step 1: Server-side verification (Fix #1)
      const { data: verification, error: verifyError } = await supabase.functions.invoke(
        'verify-paystack-payment',
        { body: { reference: paymentReference } }
      );

      if (verifyError) {
        console.error('Verification call failed:', verifyError);
        toast.error('Payment verification failed. Contact support with ref: ' + paymentReference);
        setIsProcessing(false);
        setOrderCreationInProgress(false);
        return;
      }

      if (!verification?.verified) {
        console.error('Payment not verified:', verification);
        toast.error('Payment could not be confirmed. If you were charged, contact support with ref: ' + paymentReference);
        setIsProcessing(false);
        setOrderCreationInProgress(false);
        return;
      }

      // Step 2: Verify amount matches
      const expectedAmount = Math.round(total * 100);
      if (verification.amount !== expectedAmount) {
        console.error(`Amount mismatch: expected ${expectedAmount}, got ${verification.amount}`);
        toast.error('Payment amount mismatch. Contact support with ref: ' + paymentReference);
        setIsProcessing(false);
        setOrderCreationInProgress(false);
        return;
      }

      // Step 3: Check no order already exists with this reference (Fix #8)
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('payment_reference', paymentReference)
        .maybeSingle();

      if (existingOrder) {
        console.warn('Order already exists for this payment reference');
        toast.success('Order already created!');
        clearCart();
        navigate(`/order-confirmation/${existingOrder.id}`);
        return;
      }

      // Step 4: Create order with verified payment (Fix #4: payment_received)
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          order_number: `IHS-${Date.now()}`,
          user_id: user?.id as string,
          subtotal,
          shipping_price: shippingCost,
          total_amount: total,
          shipping_class_id: selectedShippingId,
          shipping_address: JSON.parse(JSON.stringify(selectedAddress || {})),
          status: 'payment_received' as const,
          payment_reference: paymentReference,
          notes: null,
          estimated_delivery_start: new Date(Date.now() + (selectedShipping?.estimated_days_min || 7) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          estimated_delivery_end: new Date(Date.now() + (selectedShipping?.estimated_days_max || 14) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          packaging_type: hasFragile ? packagingChoice : null,
          packaging_cost: reinforcedPackagingCost,
          wallet_credit_used: walletApplied,
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Debit wallet if used
      if (walletApplied > 0 && user?.id) {
        try {
          await (supabase as any).from('wallet_transactions').insert({
            user_id: user.id,
            amount: walletApplied,
            type: 'debit',
            description: `Used for order ${order.order_number}`,
            order_id: order.id,
            created_by: user.id,
          });
        } catch (e) {
          console.error('Wallet debit failed (non-blocking):', e);
        }
      }

      // Create order items
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_variant_id: item.variant.id,
        product_name: item.product.name,
        variant_details: `${item.variant.color || ''}${item.variant.size ? ` • ${item.variant.size}` : ''}`,
        quantity: item.quantity,
        unit_price: item.variant.price,
        total_price: item.variant.price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Create initial tracking entry
      await supabase
        .from('order_tracking')
        .insert({
          order_id: order.id,
          status: 'Payment Received',
          location_name: 'Payment Gateway',
          notes: 'Payment verified successfully via Paystack.',
        });

      // Fix #5: Increment coupon current_uses
      if (appliedCoupon) {
        await supabase
          .from('coupons')
          .update({ current_uses: appliedCoupon.current_uses + 1 })
          .eq('id', appliedCoupon.id);
      }

      // Award loyalty points based on store_settings
      try {
        const { data: settingsData } = await supabase
          .from('store_settings')
          .select('key, value')
          .in('key', ['loyaltyEnabled', 'loyaltyPointsPerOrder', 'loyaltyMinOrderAmount']);
        
        const sMap: Record<string, any> = {};
        settingsData?.forEach(r => { sMap[r.key] = r.value; });
        
        const loyaltyEnabled = sMap.loyaltyEnabled !== false; // default true
        const pointsPerGhs = typeof sMap.loyaltyPointsPerOrder === 'number' ? sMap.loyaltyPointsPerOrder : 1;
        const minAmount = typeof sMap.loyaltyMinOrderAmount === 'number' ? sMap.loyaltyMinOrderAmount : 0;

        if (loyaltyEnabled && total >= minAmount && user?.id) {
          const pointsToAward = Math.floor(total * pointsPerGhs);
          if (pointsToAward > 0) {
            await supabase.from('loyalty_points').insert({
              user_id: user.id,
              points: pointsToAward,
              type: 'earn',
              description: `Order #${order.order_number} — ${pointsToAward} points earned`,
              order_id: order.id,
            });
          }
        }
      } catch (loyaltyErr) {
        console.error('Loyalty points error (non-blocking):', loyaltyErr);
      }

      // Notify all admins/managers about the new order
      try {
        const { data: adminRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['admin', 'manager']);

        if (adminRoles && adminRoles.length > 0) {
          const adminNotifications = adminRoles.map(r => ({
            user_id: r.user_id,
            title: '🛍️ New Order Received',
            message: `Order ${order.order_number} — ${formatPrice(total)} placed.`,
            type: 'new_order',
            data: { orderId: order.id, orderNumber: order.order_number, total },
          }));
          await supabase.from('notifications').insert(adminNotifications);
        }
      } catch (notifErr) {
        console.error('Admin notification error (non-blocking):', notifErr);
      }

      // Fix #6: clearCart only after ALL DB writes succeed
      setPendingPaymentRef(null);
      clearCart();
      toast.success('Order placed successfully!');
      navigate(`/order-confirmation/${order.id}`);
      // Fix #7: Reset processing state after navigation
      setIsProcessing(false);
      setOrderCreationInProgress(false);
    } catch (error) {
      console.error('Order creation error:', error);
      toast.error('Failed to create order. Contact support with ref: ' + paymentReference);
      setIsProcessing(false);
      setOrderCreationInProgress(false);
    }
  };

  const handleRecoveryCheck = async () => {
    if (!pendingPaymentRef) return;
    setIsProcessing(true);
    
    try {
      const { data: verification } = await supabase.functions.invoke(
        'verify-paystack-payment',
        { body: { reference: pendingPaymentRef } }
      );

      if (verification?.verified) {
        toast.success('Payment found! Creating your order...');
        await verifyAndCreateOrder(pendingPaymentRef);
      } else {
        toast.info('No payment found for this reference. You were not charged.');
        setPendingPaymentRef(null);
        setShowPaymentRecovery(false);
      }
    } catch {
      toast.error('Could not check payment status. Please contact support.');
    }
    setIsProcessing(false);
  };

  if (authLoading || items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-16">
          <div className="text-center">Loading...</div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <Link
          to="/cart"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Cart
        </Link>

        <h1 className="text-3xl font-bold font-serif text-foreground mb-8">
          Checkout
        </h1>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Delivery Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                {addresses.length > 0 ? (
                  <RadioGroup value={selectedAddressId} onValueChange={setSelectedAddressId}>
                    <div className="space-y-3">
                      {addresses.map((address) => (
                        <div
                          key={address.id}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            selectedAddressId === address.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => setSelectedAddressId(address.id)}
                        >
                          <div className="flex items-start gap-3">
                            <RadioGroupItem value={address.id} id={address.id} className="mt-1" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-foreground">{address.full_name}</span>
                                {address.label && (
                                  <span className="text-xs bg-muted px-2 py-0.5 rounded">{address.label}</span>
                                )}
                                {address.is_default && (
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Default</span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {address.address_line1}
                                {address.address_line2 && `, ${address.address_line2}`}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {address.city}, {address.state} {address.postal_code}
                              </p>
                              <p className="text-sm text-muted-foreground">{address.country}</p>
                              <p className="text-sm text-muted-foreground mt-1">{address.phone}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                ) : (
                  <p className="text-muted-foreground mb-4">No saved addresses</p>
                )}

                <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="mt-4">
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Address
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Address</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <Label>Full Name *</Label>
                          <Input
                            value={newAddress.full_name}
                            onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })}
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <Label>Phone *</Label>
                          <Input
                            value={newAddress.phone}
                            onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <Label>Label (optional)</Label>
                          <Input
                            placeholder="Home, Office, etc."
                            value={newAddress.label}
                            onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>Address Line 1 *</Label>
                          <Input
                            value={newAddress.address_line1}
                            onChange={(e) => setNewAddress({ ...newAddress, address_line1: e.target.value })}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>Address Line 2</Label>
                          <Input
                            value={newAddress.address_line2}
                            onChange={(e) => setNewAddress({ ...newAddress, address_line2: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>City *</Label>
                          <Input
                            value={newAddress.city}
                            onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>State</Label>
                          <Input
                            value={newAddress.state}
                            onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Country *</Label>
                          <Input
                            value={newAddress.country}
                            onChange={(e) => setNewAddress({ ...newAddress, country: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Postal Code</Label>
                          <Input
                            value={newAddress.postal_code}
                            onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })}
                          />
                        </div>
                      </div>
                      <Button onClick={handleAddAddress} className="w-full">
                        Save Address
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Shipping Method */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Shipping Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={selectedShippingId} onValueChange={(id) => {
                  setSelectedShippingId(id);
                  setCourierAcknowledged(false);
                }}>
                  <div className="space-y-3">
                    {shippingClasses.map((shipping) => {
                      const isCourier = shipping.name.toLowerCase().includes('courier');
                      return (
                        <div
                          key={shipping.id}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            selectedShippingId === shipping.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => { setSelectedShippingId(shipping.id); setCourierAcknowledged(false); }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value={shipping.id} id={shipping.id} />
                              <div className="text-primary">
                                {getShippingIcon(shipping.shipping_type?.name || shipping.name)}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{shipping.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {shipping.estimated_days_min}-{shipping.estimated_days_max} days delivery
                                </p>
                              </div>
                            </div>
                            <p className="font-semibold text-foreground">
                              {formatPrice(shipping.base_price)}
                            </p>
                          </div>
                          {/* Courier acknowledgment checkbox */}
                          {isCourier && selectedShippingId === shipping.id && (
                            <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                              <div className="flex items-start gap-2">
                                <Checkbox
                                  id="courier-ack"
                                  checked={courierAcknowledged}
                                  onCheckedChange={(checked) => setCourierAcknowledged(!!checked)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-0.5"
                                />
                                <label
                                  htmlFor="courier-ack"
                                  className="text-xs text-amber-800 dark:text-amber-200 cursor-pointer leading-relaxed"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="font-semibold">I understand</span> that I will pay the courier service directly for delivery upon receipt.
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Fragile Packaging */}
            {hasFragile && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Packaging for Fragile Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={packagingChoice}
                    onValueChange={(v) => {
                      if (v === 'standard') {
                        setShowStandardWarning(true);
                      } else {
                        setPackagingChoice('reinforced');
                      }
                    }}
                  >
                    <div className="space-y-3">
                      <div
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          packagingChoice === 'reinforced' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => setPackagingChoice('reinforced')}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value="reinforced" id="pack-reinforced" />
                            <div>
                              <p className="font-medium text-foreground">Reinforced Protection</p>
                              <p className="text-sm text-muted-foreground">
                                Extra cushioning and protection for fragile items.
                              </p>
                            </div>
                          </div>
                          <p className="font-semibold text-foreground">
                            +{formatPrice(reinforcedPackagingCost || globalReinforcedCost)}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          packagingChoice === 'standard' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => setShowStandardWarning(true)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value="standard" id="pack-standard" />
                            <div>
                              <p className="font-medium text-foreground">Standard Packaging</p>
                              <p className="text-sm text-muted-foreground">
                                Factory packaging only — no extra protection.
                              </p>
                            </div>
                          </div>
                          <p className="font-semibold text-foreground">Free</p>
                        </div>
                      </div>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
            )}

            {/* Wallet credit */}
            {walletBalance > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    Wallet Credit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={useWalletCredit}
                      onCheckedChange={(c) => setUseWalletCredit(!!c)}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-foreground">
                        Use wallet credit ({formatPrice(walletBalance)} available)
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Apply your store credit toward this order. Cannot be withdrawn.
                      </p>
                    </div>
                  </label>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Order Items ({items.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={item.product.images[0]}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground line-clamp-1">{item.product.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {item.variant.color} {item.variant.size && `• ${item.variant.size}`} × {item.quantity}
                        </p>
                      </div>
                      <p className="font-medium text-foreground">
                        {formatPrice(item.variant.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Coupon Code */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Coupon Code
                  </Label>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <div>
                        <p className="font-medium text-foreground">{appliedCoupon.code}</p>
                        <p className="text-sm text-muted-foreground">
                          {appliedCoupon.type === 'percentage' 
                            ? `${appliedCoupon.value}% off` 
                            : `${formatPrice(appliedCoupon.value)} off`}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={removeCoupon}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter code"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        className="flex-1"
                      />
                      <Button 
                        variant="outline" 
                        onClick={handleApplyCoupon}
                        disabled={isApplyingCoupon}
                      >
                        {isApplyingCoupon ? 'Applying...' : 'Apply'}
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Shipping{allFreeShipping && rawShippingCost > 0 ? ' (free)' : ''}
                    </span>
                    <span className="text-foreground">{formatPrice(shippingCost)}</span>
                  </div>
                  {reinforcedPackagingCost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Reinforced Packaging</span>
                      <span className="text-foreground">{formatPrice(reinforcedPackagingCost)}</span>
                    </div>
                  )}
                  {appliedCoupon && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>-{formatPrice(discount)}</span>
                    </div>
                  )}
                  {walletApplied > 0 && (
                    <div className="flex justify-between text-sm text-primary">
                      <span>Wallet Credit</span>
                      <span>-{formatPrice(walletApplied)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="text-xl font-bold text-primary">{formatPrice(total)}</span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handlePaystackPayment}
                  disabled={isProcessing || !selectedAddressId || !selectedShippingId}
                >
                  {isProcessing ? (
                    'Processing...'
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Pay with Paystack
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Check className="h-3 w-3" />
                  Secure payment powered by Paystack
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Payment Recovery Dialog */}
      <Dialog open={showPaymentRecovery} onOpenChange={setShowPaymentRecovery}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment Interrupted</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              The payment window was closed. If you completed payment, we can check the status.
              If not, you were not charged.
            </p>
            {pendingPaymentRef && (
              <p className="text-xs font-mono bg-muted p-2 rounded break-all">
                Ref: {pendingPaymentRef}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowPaymentRecovery(false);
                  setPendingPaymentRef(null);
                }}
              >
                I Didn't Pay
              </Button>
              <Button
                className="flex-1"
                onClick={handleRecoveryCheck}
                disabled={isProcessing}
              >
                {isProcessing ? 'Checking...' : 'Check My Payment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Standard Packaging Damage Disclaimer */}
      <Dialog open={showStandardWarning} onOpenChange={setShowStandardWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Damage Disclaimer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-foreground">
              By choosing <span className="font-semibold">Standard Packaging</span>, you accept full
              responsibility for any physical damage during transit. No refunds or replacements
              will be issued with this option.
            </p>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => {
                  setPackagingChoice('reinforced');
                  setShowStandardWarning(false);
                }}
              >
                Switch to Reinforced
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setPackagingChoice('standard');
                  setShowStandardWarning(false);
                }}
              >
                Proceed Anyway
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
