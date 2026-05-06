import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Plus, Ship, Plane, Package, CreditCard, Check, Tag, X, AlertTriangle, Wallet, Shield } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { isVariantPlaceholder, useCart } from '@/contexts/CartContext';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWalletBalance } from '@/hooks/useWallet';
import { useLoyaltyPoints } from '@/hooks/useLoyaltyPoints';
import { useStoreSettings } from '@/hooks/useStoreSettings';

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
  product_prices: Record<string, number>;
  shipping_type: {
    id: string;
    name: string;
  };
}

interface VariantOption {
  id: string;
  color: string | null;
  size: string | null;
  price_override: number | null;
  stock: number | null;
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
  const {
    items,
    selectedItems,
    subtotal,
    selectedSubtotal,
    updateVariant,
    clearSelectedItems,
  } = useCart();
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
  const [showCourierDialog, setShowCourierDialog] = useState(false);
  const [pendingCourierShippingId, setPendingCourierShippingId] = useState<string | null>(null);
  const callbackFiredRef = useRef(false);
  const [orderCreationInProgress, setOrderCreationInProgress] = useState(false);

  // Wallet redemption
  const walletBalance = useWalletBalance();
  const [useWalletCredit, setUseWalletCredit] = useState(false);
  const { totalPoints } = useLoyaltyPoints();
  const { data: storeSettings } = useStoreSettings();
  const [useLoyaltyCredit, setUseLoyaltyCredit] = useState(false);
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState('');

  // Fragile / packaging — keyed by product_id
  const [productMeta, setProductMeta] = useState<Record<string, {
    is_fragile: boolean;
    reinforced_cost: number;
    is_free_shipping: boolean;
    allow_standard_packaging: boolean;
    allow_reinforced_packaging: boolean;
  }>>({});
  const [productVariantOptions, setProductVariantOptions] = useState<Record<string, VariantOption[]>>({});
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
    if (items.length === 0 || selectedItems.length === 0) {
      navigate('/cart');
    }
  }, [items.length, selectedItems.length, navigate]);

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
    }
  }, [user]);

  useEffect(() => {
    fetchShippingClasses();
  }, [cartProductIds.join(','), JSON.stringify(productMeta)]);

  const fetchAddresses = async () => {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user!.id)
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
    return [...new Set(selectedItems.map(item => item.product.id))];
  }, [selectedItems]);

  // Fetch product meta (fragile / reinforced cost / free shipping) + global default reinforced cost
  useEffect(() => {
    if (cartProductIds.length === 0) {
      setProductMeta({});
      setProductVariantOptions({});
      return;
    }

    (async () => {
      const [{ data: products }, { data: variants }, { data: settings }] = await Promise.all([
        supabase
          .from('products')
          .select('id, is_fragile, reinforced_packaging_cost, is_free_shipping, allow_standard_packaging, allow_reinforced_packaging')
          .in('id', cartProductIds),
        supabase
          .from('product_variants')
          .select('id, product_id, color, size, price_override, stock')
          .in('product_id', cartProductIds)
          .eq('is_active', true),
        supabase
          .from('store_settings')
          .select('value')
          .eq('key', 'reinforcedPackagingCost')
          .maybeSingle(),
      ]);
      const meta: Record<string, {
        is_fragile: boolean;
        reinforced_cost: number;
        is_free_shipping: boolean;
        allow_standard_packaging: boolean;
        allow_reinforced_packaging: boolean;
      }> = {};
      (products || []).forEach((p: any) => {
        meta[p.id] = {
          is_fragile: !!p.is_fragile,
          reinforced_cost: Number(p.reinforced_packaging_cost) || 0,
          is_free_shipping: !!p.is_free_shipping,
          allow_standard_packaging: p.allow_standard_packaging !== false,
          allow_reinforced_packaging: p.allow_reinforced_packaging !== false,
        };
      });
      setProductMeta(meta);

      const variantsMap: Record<string, VariantOption[]> = {};
      (variants || []).forEach((variant: any) => {
        if (!variantsMap[variant.product_id]) {
          variantsMap[variant.product_id] = [];
        }
        variantsMap[variant.product_id].push({
          id: variant.id,
          color: variant.color,
          size: variant.size,
          price_override: variant.price_override != null ? Number(variant.price_override) : null,
          stock: variant.stock,
        });
      });
      setProductVariantOptions(variantsMap);

      const globalDefault = Number((settings as any)?.value) || 0;
      setGlobalReinforcedCost(globalDefault);
    })();
  }, [cartProductIds.join(',')]);

  // Cart-level fragile / free shipping detection for the selected checkout items
  const hasFragile = selectedItems.some((it) => productMeta[it.product.id]?.is_fragile);
  const allFreeShipping = selectedItems.length > 0 && selectedItems.every((it) =>
    productMeta[it.product.id]?.is_free_shipping || it.product.isFreeShippingEligible
  );
  const allowsStandardPackaging = selectedItems.every((it) =>
    !productMeta[it.product.id]?.is_fragile || productMeta[it.product.id]?.allow_standard_packaging
  );
  const allowsReinforcedPackaging = selectedItems.every((it) =>
    !productMeta[it.product.id]?.is_fragile || productMeta[it.product.id]?.allow_reinforced_packaging
  );

  useEffect(() => {
    if (!hasFragile) return;

    if (!allowsReinforcedPackaging) {
      setPackagingChoice('standard');
      return;
    }

    if (!allowsStandardPackaging) {
      setPackagingChoice('reinforced');
    }
  }, [allowsReinforcedPackaging, allowsStandardPackaging, hasFragile]);

  // Reinforced packaging cost = sum of per-product overrides, falling back to global default
  const reinforcedPackagingCost = useMemo(() => {
    if (!hasFragile || packagingChoice !== 'reinforced') return 0;
    let total = 0;
    selectedItems.forEach((it) => {
      const m = productMeta[it.product.id];
      if (!m?.is_fragile) return;
      const cost = m.reinforced_cost > 0 ? m.reinforced_cost : globalReinforcedCost;
      total += cost * it.quantity;
    });
    return total;
  }, [selectedItems, productMeta, globalReinforcedCost, hasFragile, packagingChoice]);

  // Fetch shipping classes that are allowed for ALL products in cart
  const fetchShippingClasses = async () => {
    if (cartProductIds.length === 0) {
      setShippingClasses([]);
      setSelectedShippingId('');
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

      const productIsFreeShipping =
        productMeta[rule.product_id]?.is_free_shipping ||
        selectedItems.some((item) =>
          item.product.id === rule.product_id && item.product.isFreeShippingEligible
        );
      
      const existing = shippingClassCounts.get(sc.id);
      if (existing) {
        existing.count++;
        existing.totalPrice += productIsFreeShipping ? 0 : Number(rule.price || 0);
        existing.data.product_prices[rule.product_id] = Number(rule.price || 0);
      } else {
        shippingClassCounts.set(sc.id, {
          count: 1,
          totalPrice: productIsFreeShipping ? 0 : Number(rule.price || 0),
          data: {
            id: sc.id,
            name: sc.name,
            base_price: sc.base_price,
            estimated_days_min: sc.estimated_days_min,
            estimated_days_max: sc.estimated_days_max,
            product_prices: {
              [rule.product_id]: Number(rule.price || 0),
            },
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
    if (validClasses.length === 0) {
      setSelectedShippingId('');
      return;
    }

    const stillAvailable = validClasses.some((shippingClass) => shippingClass.id === selectedShippingId);
    if (!stillAvailable) {
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
  const rawShippingCost = selectedShipping?.base_price || 0;
  const shippingCost = allFreeShipping ? 0 : rawShippingCost;

  // Calculate discount
  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'percentage') {
      return (selectedSubtotal * appliedCoupon.value) / 100;
    }
    return appliedCoupon.value;
  };

  const discount = calculateDiscount();
  const subtotalBeforeCredits = Math.max(0, selectedSubtotal + shippingCost + reinforcedPackagingCost - discount);
  const loyaltyRate = typeof storeSettings?.loyaltyPointsToCurrencyRate === 'number'
    ? storeSettings.loyaltyPointsToCurrencyRate
    : 0.01;
  const loyaltyMinRedeemPoints = typeof storeSettings?.loyaltyMinRedeemPoints === 'number'
    ? storeSettings.loyaltyMinRedeemPoints
    : 100;
  const maxPointsByOrderValue = loyaltyRate > 0 ? Math.floor(subtotalBeforeCredits / loyaltyRate) : 0;
  const maxRedeemablePoints = Math.max(0, Math.min(totalPoints, maxPointsByOrderValue));
  const requestedLoyaltyPoints = Math.max(0, Math.min(Number(loyaltyPointsToRedeem || 0), maxRedeemablePoints));
  const loyaltyPointsApplied = useLoyaltyCredit && requestedLoyaltyPoints >= loyaltyMinRedeemPoints
    ? requestedLoyaltyPoints
    : 0;
  const loyaltyDiscount = loyaltyPointsApplied * loyaltyRate;
  const subtotalAfterLoyalty = Math.max(0, subtotalBeforeCredits - loyaltyDiscount);
  const walletApplied = useWalletCredit ? Math.min(walletBalance, subtotalAfterLoyalty) : 0;
  const total = Math.max(0, subtotalAfterLoyalty - walletApplied);

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
    if (data.min_order_amount && selectedSubtotal < data.min_order_amount) {
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

  const unresolvedVariantItems = selectedItems.filter((item) =>
    isVariantPlaceholder(item.variant.id) && (productVariantOptions[item.product.id] || []).length > 0
  );

  const handleShippingSelection = (id: string) => {
    const shipping = shippingClasses.find((shippingClass) => shippingClass.id === id);
    if (!shipping) return;

    if (shipping.name.toLowerCase().includes('courier')) {
      setPendingCourierShippingId(id);
      setShowCourierDialog(true);
      return;
    }

    setSelectedShippingId(id);
    setCourierAcknowledged(false);
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
    if (unresolvedVariantItems.length > 0) {
      toast.error('Choose variants for all selected items before payment');
      return;
    }

    const isCourierShipping = selectedShipping?.name.toLowerCase().includes('courier');
    if (isCourierShipping && !courierAcknowledged) {
      toast.error('Confirm the courier delivery fee terms before payment');
      return;
    }
    if (!user?.email) {
      toast.error('User email not found');
      return;
    }
    if (useLoyaltyCredit && requestedLoyaltyPoints > 0 && requestedLoyaltyPoints < loyaltyMinRedeemPoints) {
      toast.error(`Redeem at least ${loyaltyMinRedeemPoints} points.`);
      return;
    }
    if (useLoyaltyCredit && requestedLoyaltyPoints > totalPoints) {
      toast.error('You do not have enough loyalty points.');
      return;
    }
    if (total <= 0) {
      if (orderCreationInProgress) return;
      setOrderCreationInProgress(true);
      setIsProcessing(true);
      await finalizeOrder(null);
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

  const finalizeOrder = async (paymentReference: string | null) => {
    const selectedAddress = addresses.find(a => a.id === selectedAddressId);

    try {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          order_number: `IHS-${Date.now()}`,
          user_id: user?.id as string,
          subtotal: selectedSubtotal,
          shipping_price: shippingCost,
          total_amount: total,
          shipping_class_id: selectedShippingId,
          shipping_address: JSON.parse(JSON.stringify(selectedAddress || {})),
          status: 'payment_received' as const,
          payment_reference: paymentReference,
          notes: loyaltyPointsApplied > 0 ? `Loyalty redeemed: ${loyaltyPointsApplied} points` : null,
          estimated_delivery_start: new Date(Date.now() + (selectedShipping?.estimated_days_min || 7) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          estimated_delivery_end: new Date(Date.now() + (selectedShipping?.estimated_days_max || 14) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          packaging_type: hasFragile ? packagingChoice : null,
          packaging_cost: reinforcedPackagingCost,
          wallet_credit_used: walletApplied,
        } as any])
        .select()
        .single();

      if (orderError) throw orderError;

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

      if (loyaltyPointsApplied > 0 && user?.id) {
        try {
          await supabase.from('loyalty_points').insert({
            user_id: user.id,
            points: loyaltyPointsApplied,
            type: 'redeem',
            description: `Order #${order.order_number} - redeemed ${loyaltyPointsApplied} points`,
            order_id: order.id,
          });
        } catch (e) {
          console.error('Loyalty redemption failed (non-blocking):', e);
        }
      }

      const orderItems = selectedItems.map(item => ({
        order_id: order.id,
        product_variant_id: item.variant.id,
        product_name: item.product.name,
        variant_details: `${item.variant.color || ''}${item.variant.size ? ` â€¢ ${item.variant.size}` : ''}`,
        quantity: item.quantity,
        unit_price: item.variant.price,
        total_price: item.variant.price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      await supabase
        .from('order_tracking')
        .insert({
          order_id: order.id,
          status: 'payment_received',
          location_name: paymentReference ? 'Payment Gateway' : 'Checkout',
          notes: paymentReference ? 'Payment verified successfully via Paystack.' : 'Order covered by wallet and loyalty credits.',
        });

      if (appliedCoupon) {
        await supabase
          .from('coupons')
          .update({ current_uses: appliedCoupon.current_uses + 1 })
          .eq('id', appliedCoupon.id);
      }

      try {
        const { data: settingsData } = await supabase
          .from('store_settings')
          .select('key, value')
          .in('key', ['loyaltyEnabled', 'loyaltyPointsPerOrder', 'loyaltyMinOrderAmount']);

        const sMap: Record<string, any> = {};
        settingsData?.forEach(r => { sMap[r.key] = r.value; });

        const loyaltyEnabled = sMap.loyaltyEnabled !== false;
        const pointsPerGhs = typeof sMap.loyaltyPointsPerOrder === 'number' ? sMap.loyaltyPointsPerOrder : 1;
        const minAmount = typeof sMap.loyaltyMinOrderAmount === 'number' ? sMap.loyaltyMinOrderAmount : 0;

        if (loyaltyEnabled && total >= minAmount && user?.id) {
          const pointsToAward = Math.floor(total * pointsPerGhs);
          if (pointsToAward > 0) {
            await supabase.from('loyalty_points').insert({
              user_id: user.id,
              points: pointsToAward,
              type: 'earn',
              description: `Order #${order.order_number} â€” ${pointsToAward} points earned`,
              order_id: order.id,
            });
          }
        }
      } catch (loyaltyErr) {
        console.error('Loyalty points error (non-blocking):', loyaltyErr);
      }

      try {
        const { data: adminRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['admin', 'manager']);

        if (adminRoles && adminRoles.length > 0) {
          const adminNotifications = adminRoles.map(r => ({
            user_id: r.user_id,
            title: 'ðŸ›ï¸ New Order Received',
            message: `Order ${order.order_number} â€” ${formatPrice(total)} placed.`,
            type: 'new_order',
            data: { orderId: order.id, orderNumber: order.order_number, total },
          }));
          await supabase.from('notifications').insert(adminNotifications);
        }
      } catch (notifErr) {
        console.error('Admin notification error (non-blocking):', notifErr);
      }

      setPendingPaymentRef(null);
      clearSelectedItems();
      toast.success('Order placed successfully!');
      navigate(`/order-confirmation/${order.id}`);
      setIsProcessing(false);
      setOrderCreationInProgress(false);
    } catch (error) {
      console.error('Order finalization error:', error);
      toast.error(paymentReference
        ? 'Failed to create order. Contact support with your payment reference.'
        : 'Failed to place order. Please try again.');
      setIsProcessing(false);
      setOrderCreationInProgress(false);
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
        clearSelectedItems();
        setPendingPaymentRef(null);
        setIsProcessing(false);
        setOrderCreationInProgress(false);
        navigate(`/order-confirmation/${existingOrder.id}`);
        return;
      }

      await finalizeOrder(paymentReference);
      return;

      // Step 4: Create order with verified payment (Fix #4: payment_received)
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          order_number: `IHS-${Date.now()}`,
          user_id: user?.id as string,
          subtotal: selectedSubtotal,
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
      const orderItems = selectedItems.map(item => ({
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
          status: 'payment_received',
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

      // Remove only the items that were actually checked out.
      setPendingPaymentRef(null);
      clearSelectedItems();
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

  if (authLoading || items.length === 0 || selectedItems.length === 0) {
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
                <RadioGroup value={selectedShippingId} onValueChange={handleShippingSelection}>
                  <div className="space-y-3">
                    {shippingClasses.length === 0 && (
                      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                        No shared shipping method is available for the items you selected.
                      </div>
                    )}
                    {shippingClasses.map((shipping) => {
                      return (
                        <div
                          key={shipping.id}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            selectedShippingId === shipping.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => handleShippingSelection(shipping.id)}
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
                      {allowsReinforcedPackaging && (
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
                      )}
                      {allowsStandardPackaging && (
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
                      )}
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
            )}

            {totalPoints > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="h-5 w-5 text-primary" />
                    Loyalty Points
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={useLoyaltyCredit}
                      onCheckedChange={(checked) => {
                        const enabled = !!checked;
                        setUseLoyaltyCredit(enabled);
                        if (enabled && !loyaltyPointsToRedeem) {
                          setLoyaltyPointsToRedeem(String(maxRedeemablePoints));
                        }
                      }}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-foreground">
                        Redeem loyalty points ({totalPoints.toLocaleString()} available)
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {loyaltyMinRedeemPoints} point minimum. {formatPrice(loyaltyRate)} per point.
                      </p>
                    </div>
                  </label>

                  {useLoyaltyCredit && (
                    <div className="space-y-2">
                      <Label htmlFor="loyalty-points">Points to redeem</Label>
                      <Input
                        id="loyalty-points"
                        type="number"
                        min={loyaltyMinRedeemPoints}
                        max={maxRedeemablePoints}
                        step="1"
                        value={loyaltyPointsToRedeem}
                        onChange={(event) => setLoyaltyPointsToRedeem(event.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Up to {maxRedeemablePoints.toLocaleString()} points can be used on this order.
                      </p>
                    </div>
                  )}
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

            {unresolvedVariantItems.length > 0 && (
              <Card className="border-amber-500/40 bg-amber-500/5">
                <CardHeader>
                  <CardTitle className="text-base">Choose Variants Before Payment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {unresolvedVariantItems.map((item) => (
                    <div key={item.id} className="space-y-2">
                      <div>
                        <p className="font-medium text-foreground">{item.product.name}</p>
                        <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                      </div>
                      <Select
                        value=""
                        onValueChange={(variantId) => {
                          const variant = (productVariantOptions[item.product.id] || []).find((option) => option.id === variantId);
                          if (!variant) return;

                          updateVariant(item.id, {
                            id: variant.id,
                            color: variant.color || undefined,
                            size: variant.size || undefined,
                            price: variant.price_override ?? item.product.basePrice,
                            stock: variant.stock || 0,
                          });
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select variant" />
                        </SelectTrigger>
                        <SelectContent>
                          {(productVariantOptions[item.product.id] || []).map((variant) => (
                            <SelectItem key={variant.id} value={variant.id}>
                              {[variant.color, variant.size].filter(Boolean).join(' / ') || 'Default'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Order Items ({selectedItems.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {selectedItems.map((item) => (
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
                    <span className="text-foreground">{formatPrice(selectedSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Shipping{allFreeShipping && rawShippingCost > 0 ? ' (free)' : shippingCost < rawShippingCost ? ' (free items excluded)' : ''}
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
                  {loyaltyDiscount > 0 && (
                    <div className="flex justify-between text-sm text-primary">
                      <span>Loyalty Credit</span>
                      <span>-{formatPrice(loyaltyDiscount)}</span>
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
                  disabled={isProcessing || !selectedAddressId || !selectedShippingId || unresolvedVariantItems.length > 0}
                >
                  {isProcessing ? (
                    'Processing...'
                  ) : total <= 0 ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Place Order
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Pay with Paystack
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Check className="h-3 w-3" />
                  {total <= 0 ? 'Covered fully by wallet and loyalty credits' : 'Secure payment powered by Paystack'}
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

      <Dialog
        open={showCourierDialog}
        onOpenChange={(open) => {
          setShowCourierDialog(open);
          if (!open) {
            setPendingCourierShippingId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Courier Delivery Fee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-foreground">
              Standard Courier means your package will be delivered first, and you will pay the courier fee on receipt.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowCourierDialog(false);
                  setPendingCourierShippingId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  if (!pendingCourierShippingId) return;
                  setSelectedShippingId(pendingCourierShippingId);
                  setCourierAcknowledged(true);
                  setShowCourierDialog(false);
                  setPendingCourierShippingId(null);
                }}
              >
                I Understand
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
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setPackagingChoice('standard');
                  setShowStandardWarning(false);
                }}
              >
                Proceed Anyway
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setPackagingChoice('reinforced');
                  setShowStandardWarning(false);
                }}
              >
                Switch to Reinforced
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
