import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Plus, Ship, Plane, Package, CreditCard, Check, Tag, X, AlertTriangle, Wallet, Shield, ChevronRight } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { isVariantPlaceholder, useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useWalletBalance } from '@/hooks/useWallet';
import { useLoyaltyPoints } from '@/hooks/useLoyaltyPoints';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { loadPaystack, type PaystackTransactionResponse } from '@/lib/paystack';
import {
  clearCheckoutRecoverySnapshot,
  saveCheckoutRecoverySnapshot,
} from '@/lib/checkoutRecovery';
import { trackRecommendationEvent } from '@/lib/recommendationEvents';

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
  description?: string | null;
  estimated_days_min: number;
  estimated_days_max: number;
  product_prices: Record<string, number>;
  shipping_type: {
    id: string;
    name: string;
    description?: string | null;
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
  type: 'percentage' | 'fixed_amount';
  value: number;
  min_order_amount: number | null;
  current_uses: number | null;
  max_uses?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  auto_apply?: boolean | null;
  first_order_only?: boolean | null;
  marketing_label?: string | null;
}

interface ShippingRuleRow {
  product_id: string;
  shipping_class_id: string;
  price: number | null;
  is_allowed: boolean;
  shipping_classes: {
    id: string;
    name: string;
    base_price: number | null;
    description: string | null;
    estimated_days_min: number;
    estimated_days_max: number;
    is_active: boolean | null;
    shipping_types: {
      id: string;
      name: string;
      description: string | null;
      is_active: boolean | null;
    } | null;
  } | null;
}

interface ProductMetaRow {
  id: string;
  is_fragile: boolean | null;
  reinforced_packaging_cost: number | null;
  is_free_shipping: boolean | null;
  allow_standard_packaging: boolean | null;
  allow_reinforced_packaging: boolean | null;
}

interface ProductVariantRow {
  id: string;
  product_id: string;
  color: string | null;
  size: string | null;
  price_override: number | null;
  stock: number | null;
}

type WalletTransactionInsert = Database['public']['Tables']['wallet_transactions']['Insert'];

function formatVariantLabel(color?: string | null, size?: string | null) {
  const parts = [color, size].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : 'Standard option';
}

function formatAddressLine(address?: Address) {
  if (!address) {
    return 'Add a delivery address';
  }

  const place = [address.city, address.country].filter(Boolean).join(', ');
  return place || address.address_line1;
}

function formatAddressReference(address?: Address) {
  if (!address) {
    return 'No saved address selected';
  }

  return [address.state, address.phone].filter(Boolean).join(' - ') || address.address_line1;
}

export default function Checkout() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const {
    items,
    selectedItems,
    selectedItemIds,
    selectedSubtotal,
    setSelectedItemIds,
    clearSelectedItems,
  } = useCart();
  const { formatPrice } = useCurrency();
  
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [shippingClasses, setShippingClasses] = useState<ShippingClass[]>([]);
  const [selectedShippingId, setSelectedShippingId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
  const [isAddressPickerOpen, setIsAddressPickerOpen] = useState(false);
  const [isShippingPickerOpen, setIsShippingPickerOpen] = useState(false);
  const [isSavingsDialogOpen, setIsSavingsDialogOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [userOrderCount, setUserOrderCount] = useState(0);
  const [pendingPaymentRef, setPendingPaymentRef] = useState<string | null>(null);
  const [showPaymentRecovery, setShowPaymentRecovery] = useState(false);
  const [courierAcknowledged, setCourierAcknowledged] = useState(false);
  const [showCourierDialog, setShowCourierDialog] = useState(false);
  const [pendingCourierShippingId, setPendingCourierShippingId] = useState<string | null>(null);
  const callbackFiredRef = useRef(false);
  const [orderCreationInProgress, setOrderCreationInProgress] = useState(false);
  const checkoutRecoverySnapshotIdRef = useRef<string | null>(null);

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

  // Get product IDs from cart
  const cartProductIds = useMemo(() => {
    return [...new Set(selectedItems.map(item => item.product.id))];
  }, [selectedItems]);

  const fetchAddresses = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)
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
  }, [user]);

  const fetchUserOrderCount = useCallback(async () => {
    if (!user) return;

    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('status', 'eq', 'cancelled');

    setUserOrderCount(count || 0);
  }, [user]);

  const fetchShippingClasses = useCallback(async () => {
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
          description,
          estimated_days_min,
          estimated_days_max,
          is_active,
          shipping_types!inner(id, name, description, is_active)
        )
      `)
      .in('product_id', cartProductIds)
      .eq('is_allowed', true)
      .eq('shipping_classes.is_active', true);

    if (rulesError) {
      console.error('Error fetching shipping rules:', rulesError);
      return;
    }

    const shippingClassCounts = new Map<string, { count: number; data: ShippingClass; totalPrice: number }>();

    (shippingRules as ShippingRuleRow[] | null)?.forEach((rule) => {
      const sc = rule.shipping_classes;
      if (!sc || !sc.is_active) return;
      const productQuantity = selectedItems
        .filter((item) => item.product.id === rule.product_id)
        .reduce((sum, item) => sum + item.quantity, 0);
      const unitShippingPrice = Number(rule.price ?? sc.base_price ?? 0);

      const productIsFreeShipping =
        productMeta[rule.product_id]?.is_free_shipping ||
        selectedItems.some((item) =>
          item.product.id === rule.product_id && item.product.isFreeShippingEligible
        );
      const productShippingTotal = productIsFreeShipping ? 0 : unitShippingPrice * productQuantity;

      const existing = shippingClassCounts.get(sc.id);
      if (existing) {
        existing.count++;
        existing.totalPrice += productShippingTotal;
        existing.data.product_prices[rule.product_id] = unitShippingPrice;
      } else {
        shippingClassCounts.set(sc.id, {
          count: 1,
          totalPrice: productShippingTotal,
          data: {
            id: sc.id,
            name: sc.name,
            base_price: Number(sc.base_price || 0),
            description: sc.description,
            estimated_days_min: sc.estimated_days_min,
            estimated_days_max: sc.estimated_days_max,
            product_prices: {
              [rule.product_id]: unitShippingPrice,
            },
            shipping_type: sc.shipping_types ? {
              id: sc.shipping_types.id,
              name: sc.shipping_types.name,
              description: sc.shipping_types.description,
            } : { id: '', name: '', description: null }
          }
        });
      }
    });

    const validClasses: ShippingClass[] = [];
    shippingClassCounts.forEach((value) => {
      if (value.count >= cartProductIds.length) {
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
  }, [cartProductIds, productMeta, selectedItems, selectedShippingId]);

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
      return;
    }

    if (selectedItemIds.length === 0) {
      setSelectedItemIds(items.map((item) => item.id));
      return;
    }

    if (selectedItems.length === 0) {
      navigate('/cart');
    }
  }, [items, navigate, selectedItemIds.length, selectedItems.length, setSelectedItemIds]);

  useEffect(() => {
    void loadPaystack().catch((error) => {
      console.warn('Paystack preload failed; checkout will retry when payment starts.', error);
    });
  }, []);

  useEffect(() => {
    if (user) {
      fetchAddresses();
      fetchUserOrderCount();
    }
  }, [user, fetchAddresses, fetchUserOrderCount]);

  useEffect(() => {
    fetchShippingClasses();
  }, [fetchShippingClasses]);

  // Fetch product meta (fragile / reinforced cost / free shipping) + global default reinforced cost
  useEffect(() => {
    if (cartProductIds.length === 0) {
      setProductMeta({});
      setProductVariantOptions({});
      return;
    }

    (async () => {
      const [{ data: products }, { data: variants }] = await Promise.all([
        supabase
          .from('products')
          .select('id, is_fragile, reinforced_packaging_cost, is_free_shipping, allow_standard_packaging, allow_reinforced_packaging')
          .in('id', cartProductIds),
        supabase
          .from('product_variants')
          .select('id, product_id, color, size, price_override, stock')
          .in('product_id', cartProductIds)
          .eq('is_active', true),
      ]);
      const meta: Record<string, {
        is_fragile: boolean;
        reinforced_cost: number;
        is_free_shipping: boolean;
        allow_standard_packaging: boolean;
        allow_reinforced_packaging: boolean;
      }> = {};
      (products as ProductMetaRow[] | null || []).forEach((p) => {
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
      (variants as ProductVariantRow[] | null || []).forEach((variant) => {
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

      const globalDefault = typeof storeSettings?.reinforcedPackagingCost === 'number'
        ? storeSettings.reinforcedPackagingCost
        : 0;
      setGlobalReinforcedCost(globalDefault);
    })();
  }, [cartProductIds, storeSettings]);

  // Cart-level fragile / free shipping detection for the selected checkout items
  const hasFragile = selectedItems.some((it) => productMeta[it.product.id]?.is_fragile);
  const allFreeShipping = selectedItems.length > 0 && selectedItems.every((it) =>
    productMeta[it.product.id]?.is_free_shipping || it.product.isFreeShippingEligible
  );
  const hasFreeShippingItems = selectedItems.some((it) =>
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
  const selectedAddressDetails = addresses.find((address) => address.id === selectedAddressId);
  const rawShippingCost = selectedShipping?.base_price || 0;

  useEffect(() => {
    if (selectedItems.length === 0) {
      clearCheckoutRecoverySnapshot();
      if (user) {
        void supabase
          .from('checkout_recovery_snapshots' as never)
          .update({
            status: 'dismissed',
            updated_at: new Date().toISOString(),
          } as never)
          .eq('user_id', user.id)
          .eq('status', 'active');
      }
      return;
    }

    const productNames = [...new Set(selectedItems.map((item) => item.product.name))];
    const itemCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
    const now = new Date();
    const reminderDueAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

    saveCheckoutRecoverySnapshot({
      itemCount,
      subtotal: selectedSubtotal,
      productNames,
      shippingLabel: selectedShipping?.name || null,
      updatedAt: now.toISOString(),
    });

    selectedItems.forEach((item) => {
      trackRecommendationEvent({
        productId: item.product.id,
        eventType: 'checkout_seed',
        source: 'checkout_recovery',
        weight: item.quantity,
        productVariantId: item.variant.id,
      });
    });

    if (!user) {
      return;
    }

    void (async () => {
      const { data, error } = await supabase
        .from('checkout_recovery_snapshots' as never)
        .upsert(
          {
            user_id: user.id,
            item_count: itemCount,
            subtotal: selectedSubtotal,
            product_names: productNames,
            shipping_label: selectedShipping?.name || null,
            checkout_path: '/checkout',
            status: 'active',
            last_seen_at: now.toISOString(),
            reminder_due_at: reminderDueAt,
            reminded_at: null,
            updated_at: now.toISOString(),
          } as never,
          { onConflict: 'user_id' },
        )
        .select('id')
        .single();

      if (!error && data) {
        checkoutRecoverySnapshotIdRef.current = (data as { id: string }).id;
      }
    })();
  }, [selectedItems, selectedShipping?.name, selectedSubtotal, user]);
  const shippingCost = allFreeShipping ? 0 : rawShippingCost;

  // Calculate discount
  const isCouponEligible = useCallback((coupon: Coupon) => {
    if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
      return false;
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return false;
    }

    if (coupon.min_order_amount && selectedSubtotal < coupon.min_order_amount) {
      return false;
    }

    if (coupon.max_uses && (coupon.current_uses || 0) >= coupon.max_uses) {
      return false;
    }

    if (coupon.first_order_only && userOrderCount > 0) {
      return false;
    }

    return true;
  }, [selectedSubtotal, userOrderCount]);

  const getCouponDiscount = useCallback((coupon: Coupon) => {
    if (coupon.type === 'percentage') {
      return (selectedSubtotal * coupon.value) / 100;
    }

    return coupon.value;
  }, [selectedSubtotal]);

  const calculateDiscount = () => {
    if (!appliedCoupon || !isCouponEligible(appliedCoupon)) return 0;
    return getCouponDiscount(appliedCoupon);
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
  const itemCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

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
    
    const typedCoupon = data as Coupon;

    if (!isCouponEligible(typedCoupon)) {
      if (typedCoupon.first_order_only && userOrderCount > 0) {
        toast.error('This coupon is only available for first orders');
      } else if (typedCoupon.starts_at && new Date(typedCoupon.starts_at) > new Date()) {
        toast.error('This coupon is not active yet');
      } else if (typedCoupon.expires_at && new Date(typedCoupon.expires_at) < new Date()) {
        toast.error('This coupon has expired');
      } else if (typedCoupon.min_order_amount && selectedSubtotal < typedCoupon.min_order_amount) {
        toast.error(`Minimum order amount of ${formatPrice(typedCoupon.min_order_amount)} required`);
      } else if (typedCoupon.max_uses && (typedCoupon.current_uses || 0) >= typedCoupon.max_uses) {
        toast.error('This coupon has reached its usage limit');
      } else {
        toast.error('This coupon is not eligible for this order');
      }
      setIsApplyingCoupon(false);
      return;
    }
    
    setAppliedCoupon(typedCoupon);
    toast.success('Coupon applied successfully!');
    setIsApplyingCoupon(false);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  useEffect(() => {
    if (!user || appliedCoupon || selectedSubtotal <= 0) return;

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('is_active', true)
        .eq('auto_apply', true);

      if (error || cancelled) return;

      const eligibleCoupons = ((data || []) as Coupon[])
        .filter(isCouponEligible)
        .sort((a, b) => getCouponDiscount(b) - getCouponDiscount(a));

      const bestCoupon = eligibleCoupons[0];
      if (!bestCoupon) return;

      setAppliedCoupon(bestCoupon);
      setCouponCode(bestCoupon.code);
      toast.success(
        bestCoupon.marketing_label
          ? `${bestCoupon.marketing_label} applied automatically`
          : `${bestCoupon.code} applied automatically`,
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [user, appliedCoupon, selectedSubtotal, userOrderCount, getCouponDiscount, isCouponEligible]);

  const getShippingIcon = (typeName: string) => {
    const lower = typeName.toLowerCase();
    if (lower.includes('sea')) return <Ship className="h-5 w-5" />;
    if (lower.includes('express')) return <Package className="h-5 w-5" />;
    return <Plane className="h-5 w-5" />;
  };

  const unresolvedVariantItems = selectedItems.filter((item) =>
    isVariantPlaceholder(item.variant.id) && (productVariantOptions[item.product.id] || []).length > 0
  );
  const firstUnresolvedVariantItem = unresolvedVariantItems[0];
  const showSavingsSection = true;
  const accordionDefaultSections = [
    'items',
    unresolvedVariantItems.length > 0 ? 'variants' : null,
    hasFragile ? 'packaging' : null,
  ].filter((value): value is string => Boolean(value));
  const checkoutSteps = [
    {
      id: 'address',
      label: 'Address',
      complete: !!selectedAddressId,
      detail: selectedAddressDetails
        ? `${selectedAddressDetails.city}, ${selectedAddressDetails.country}`
        : 'Choose where the order should go.',
    },
    {
      id: 'shipping',
      label: 'Shipping',
      complete: !!selectedShippingId,
      detail: selectedShipping
        ? `${selectedShipping.name} · ${formatPrice(shippingCost)}`
        : 'Pick the delivery speed and method.',
    },
    {
      id: 'review',
      label: 'Review & Pay',
      complete: !!selectedAddressId && !!selectedShippingId && unresolvedVariantItems.length === 0,
      detail:
        unresolvedVariantItems.length > 0
          ? 'Choose variants before payment.'
          : total <= 0
            ? 'Your order is fully covered.'
            : 'Review the total and complete payment.',
    },
  ];
  const completedCheckoutSteps = checkoutSteps.filter((step) => step.complete).length;
  const isPaymentDisabled =
    isProcessing || !selectedAddressId || !selectedShippingId || unresolvedVariantItems.length > 0;
  const requiresPayment = total > 0;
  const paymentButtonText = isProcessing
    ? 'Processing...'
    : !requiresPayment
      ? 'Place Order'
      : 'Pay Now';
  const paymentSupportText = !requiresPayment
    ? 'Covered fully by wallet and loyalty credits'
    : 'Secure encrypted payment';
  const mobileCheckoutHint = unresolvedVariantItems.length > 0
    ? 'Choose variants to unlock payment.'
    : !selectedAddressId
      ? 'Select a delivery address to continue.'
      : !selectedShippingId
        ? 'Choose a shipping method to continue.'
        : paymentSupportText;
  const totalSavings = discount + loyaltyDiscount + walletApplied;
  const savingsSummaryText =
    totalSavings > 0
      ? [
          appliedCoupon ? appliedCoupon.code : null,
          loyaltyDiscount > 0 ? 'Loyalty applied' : null,
          walletApplied > 0 ? 'Wallet applied' : null,
        ]
          .filter(Boolean)
          .join(' - ')
      : 'Apply coupons, loyalty points, or wallet balance';

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

  const sendToProductVariantSelection = (productId: string) => {
    toast.info('Select a variant on the product page before checkout.');
    navigate(`/product/${productId}?selectVariant=1`);
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
      if (firstUnresolvedVariantItem) {
        sendToProductVariantSelection(firstUnresolvedVariantItem.product.id);
      }
      return;
    }

    const isCourierShipping = selectedShipping?.name.toLowerCase().includes('courier');
    if (isCourierShipping && !courierAcknowledged) {
      toast.error('Confirm the courier delivery fee terms before payment');
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

    if (!user?.email) {
      toast.error('User email not found');
      return;
    }

    setIsProcessing(true);

    try {
      const paystack = await loadPaystack();
      const { data: configData, error: configError } = await supabase.functions.invoke('get-paystack-key');
      
      if (configError || !configData?.publicKey) {
        toast.error('Unable to connect to payment service. Please try again.');
        setIsProcessing(false);
        return;
      }

      const reference = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setPendingPaymentRef(reference);
      callbackFiredRef.current = false;

      const handler = paystack.setup({
        key: configData.publicKey,
        email: user.email,
        amount: Math.round(total * 100),
        currency: 'GHS',
        ref: reference,
        metadata: {
          type: 'checkout',
          user_id: user.id,
        },
        callback: function(response: PaystackTransactionResponse) {
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
              setPendingPaymentRef(reference);
              setShowPaymentRecovery(true);
            }
          }, 500);
        },
      });

      handler.openIframe();
    } catch (error: unknown) {
      console.error('Payment error:', error);
      toast.error(error instanceof Error ? error.message : 'Payment initialization failed. Please try again.');
      setIsProcessing(false);
    }
  };

  const finalizeOrder = async (paymentReference: string | null) => {
    const selectedAddress = addresses.find(a => a.id === selectedAddressId);

    try {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          order_number: `AJYN-${Date.now()}`,
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
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      if (walletApplied > 0 && user?.id) {
        try {
          const walletTransaction: WalletTransactionInsert = {
            user_id: user.id,
            amount: walletApplied,
            type: 'debit',
            description: `Used for order ${order.order_number}`,
            order_id: order.id,
            created_by: user.id,
          };
          await supabase.from('wallet_transactions').insert(walletTransaction);
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
        product_id: item.product.id,
        product_variant_id: isVariantPlaceholder(item.variant.id) ? null : item.variant.id,
        product_name: item.product.name,
        variant_details: [item.variant.color, item.variant.size].filter(Boolean).join(' - '),
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
          notes: paymentReference ? 'Payment verified successfully.' : 'Order covered by wallet and loyalty credits.',
        });

      if (appliedCoupon) {
        const { error: couponRedemptionError } = await supabase.rpc('mark_coupon_redeemed' as never, {
          coupon_id_input: appliedCoupon.id,
          order_id_input: order.id,
          discount_amount_input: discount,
        } as never);

        if (couponRedemptionError) {
          console.error('Coupon redemption logging failed:', couponRedemptionError);
        }
      }

      if (user) {
        const recoveryUpdate = supabase
          .from('checkout_recovery_snapshots' as never)
          .update({
            status: 'recovered',
            recovered_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as never);

        if (checkoutRecoverySnapshotIdRef.current) {
          await recoveryUpdate.eq('id', checkoutRecoverySnapshotIdRef.current);
        } else {
          await recoveryUpdate.eq('user_id', user.id);
        }
      }

      selectedItems.forEach((item) => {
        trackRecommendationEvent({
          productId: item.product.id,
          eventType: 'order_complete',
          source: 'checkout',
          weight: item.quantity,
          productVariantId: item.variant.id,
          orderId: order.id,
        });
      });

      try {
        const loyaltyEnabled = storeSettings?.loyaltyEnabled !== false;
        const pointsPerGhs = typeof storeSettings?.loyaltyPointsPerOrder === 'number' ? storeSettings.loyaltyPointsPerOrder : 1;
        const minAmount = typeof storeSettings?.loyaltyMinOrderAmount === 'number' ? storeSettings.loyaltyMinOrderAmount : 0;

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
            title: 'New Order Received',
            message: `Order ${order.order_number} - ${formatPrice(total)} placed.`,
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

      if (verification.currency !== 'GHS') {
        console.error(`Currency mismatch: expected GHS, got ${verification.currency}`);
        toast.error('Payment currency mismatch. Contact support with ref: ' + paymentReference);
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
        <main className="container px-3 py-16 pb-28 sm:px-6 md:pb-8">
          <div className="text-center">Loading...</div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-3 py-5 pb-10 sm:px-6 md:py-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-5 flex items-start justify-between gap-3 border-b border-border/60 pb-4">
            <div className="flex min-w-0 items-start gap-3">
              <Link
                to="/cart"
                className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:text-primary"
                aria-label="Back to cart"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-foreground">Checkout</h1>
                <p className="text-sm text-muted-foreground">Review and place your order</p>
              </div>
            </div>

            <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              <Shield className="h-3.5 w-3.5" />
              <span className="hidden min-[420px]:inline">Secure checkout</span>
              <span className="min-[420px]:hidden">Secure</span>
            </div>
          </div>

          <div className="space-y-4">
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Delivery</p>
                      <p className="mt-1 text-sm text-foreground">{formatAddressLine(selectedAddressDetails)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatAddressReference(selectedAddressDetails)}</p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-full shrink-0 rounded-xl px-4 min-[420px]:w-auto"
                    onClick={() => setIsAddressPickerOpen(true)}
                  >
                    Change
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 shrink-0 text-primary">
                      {selectedShipping ? getShippingIcon(selectedShipping.shipping_type?.name || selectedShipping.name) : <Package className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Shipping Method</p>
                      <p className="mt-1 text-sm text-foreground">
                        {selectedShipping ? selectedShipping.name : 'Choose a shipping method'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedShipping
                          ? `${selectedShipping.estimated_days_min}-${selectedShipping.estimated_days_max} days delivery`
                          : 'Select the shared delivery method for these items.'}
                        {selectedShipping ? (
                          <span className="ml-1 font-medium text-primary">
                            {shippingCost === 0 ? 'FREE' : formatPrice(shippingCost)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-full shrink-0 rounded-xl px-4 min-[420px]:w-auto"
                    onClick={() => setIsShippingPickerOpen(true)}
                  >
                    Change
                  </Button>
                </div>
              </CardContent>
            </Card>

            <button
              type="button"
              className="w-full text-left"
              onClick={() => setIsSavingsDialogOpen(true)}
            >
              <Card className="rounded-2xl border-border/70 shadow-sm transition-colors hover:border-primary/40">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <Tag className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">Savings & Credits</p>
                        <p className="mt-1 text-xs text-muted-foreground">{savingsSummaryText}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </button>

            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardContent className="p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    Order Items ({selectedItems.length})
                  </p>
                  <Link
                    to="/cart"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary"
                  >
                    Edit Cart
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>

                {unresolvedVariantItems.length > 0 ? (
                  <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                    <p className="font-medium text-foreground">Variants still need your selection</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Select the remaining options on the product page to unlock payment.
                    </p>
                  </div>
                ) : null}

                <div className="space-y-4">
                  {selectedItems.map((item, index) => {
                    const needsVariant = unresolvedVariantItems.some((unresolvedItem) => unresolvedItem.id === item.id);

                    return (
                      <div
                        key={item.id}
                        className={index === 0 ? '' : 'border-t border-border/60 pt-4'}
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                            <img
                              src={item.product.images[0]}
                              alt={item.product.name}
                              className="h-full w-full object-cover"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="line-clamp-2 text-sm font-semibold text-foreground">
                                  {item.product.name}
                                </h3>
                                <p className={`mt-1 text-sm ${needsVariant ? 'text-destructive' : 'text-muted-foreground'}`}>
                                  {needsVariant
                                    ? 'Variant not selected'
                                    : formatVariantLabel(item.variant.color, item.variant.size)}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">Qty: {item.quantity}</p>
                              </div>

                              <p className="shrink-0 text-sm font-semibold text-foreground">
                                {formatPrice(item.variant.price * item.quantity)}
                              </p>
                            </div>

                            {needsVariant ? (
                              <div className="mt-3">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-11 rounded-xl"
                                  onClick={() => sendToProductVariantSelection(item.product.id)}
                                >
                                  Select on product page
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 text-muted-foreground">Subtotal ({itemCount} items)</span>
                  <span className="shrink-0 text-right text-foreground">{formatPrice(selectedSubtotal)}</span>
                </div>
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 text-muted-foreground">Shipping</span>
                  <span className={`shrink-0 text-right ${shippingCost === 0 ? 'font-medium text-primary' : 'text-foreground'}`}>
                    {shippingCost === 0 ? 'FREE' : formatPrice(shippingCost)}
                  </span>
                </div>
                {reinforcedPackagingCost > 0 ? (
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0 text-muted-foreground">Reinforced Packaging</span>
                    <span className="shrink-0 text-right text-foreground">{formatPrice(reinforcedPackagingCost)}</span>
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 text-muted-foreground">Savings</span>
                  <span className={`shrink-0 text-right ${totalSavings > 0 ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
                    -{formatPrice(totalSavings)}
                  </span>
                </div>
                <div className="h-px bg-border/70" />
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-base font-semibold text-foreground">Total</span>
                  <span className="shrink-0 text-right text-2xl font-bold text-primary">{formatPrice(total)}</span>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-12 min-w-0 justify-center gap-2 overflow-hidden rounded-xl"
                onClick={() => navigate('/cart')}
              >
                <span className="truncate">Make Changes</span>
              </Button>
              <Button
                type="button"
                className="h-12 min-w-0 justify-center gap-2 overflow-hidden rounded-xl"
                onClick={handlePaystackPayment}
                disabled={isPaymentDisabled}
              >
                {isProcessing ? 'Processing...' : (
                  <>
                    {requiresPayment ? (
                      <CreditCard className="h-4 w-4 shrink-0" />
                    ) : (
                      <Check className="h-4 w-4 shrink-0" />
                    )}
                    <span className="truncate">{paymentButtonText}</span>
                  </>
                )}
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground">{paymentSupportText}</p>

            <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
              <div className="rounded-full border border-border/60 px-2 py-2">Secure payments</div>
              <div className="rounded-full border border-border/60 px-2 py-2">Easy returns</div>
              <div className="rounded-full border border-border/60 px-2 py-2">24/7 support</div>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={isAddressPickerOpen} onOpenChange={setIsAddressPickerOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-background">
          <DialogHeader>
            <DialogTitle>Choose Delivery Address</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {addresses.length > 0 ? (
              <RadioGroup value={selectedAddressId} onValueChange={setSelectedAddressId}>
                <div className="space-y-3">
                  {addresses.map((address) => (
                    <div
                      key={address.id}
                      className={`cursor-pointer rounded-2xl border p-3.5 transition-all sm:p-4 ${
                        selectedAddressId === address.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedAddressId(address.id)}
                    >
                      <div className="flex items-start gap-3">
                        <RadioGroupItem value={address.id} id={`address-${address.id}`} className="mt-1" />
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="font-medium text-foreground">{address.full_name}</span>
                            {address.label ? (
                              <span className="rounded bg-muted px-2 py-0.5 text-xs">{address.label}</span>
                            ) : null}
                            {address.is_default ? (
                              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">Default</span>
                            ) : null}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {address.address_line1}
                            {address.address_line2 ? `, ${address.address_line2}` : ''}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {[address.city, address.state, address.postal_code].filter(Boolean).join(', ')}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">{address.country}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{address.phone}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                No saved addresses yet.
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl"
              onClick={() => {
                setIsAddressPickerOpen(false);
                setIsAddressDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add New Address
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isShippingPickerOpen} onOpenChange={setIsShippingPickerOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-background">
          <DialogHeader>
            <DialogTitle>Choose Shipping Method</DialogTitle>
          </DialogHeader>
          <RadioGroup value={selectedShippingId} onValueChange={handleShippingSelection}>
            <div className="space-y-3">
              {shippingClasses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                  No shared shipping method is available for the items you selected.
                </div>
              ) : null}
              {shippingClasses.map((shipping) => (
                <div
                  key={shipping.id}
                  className={`cursor-pointer rounded-2xl border p-3.5 transition-all sm:p-4 ${
                    selectedShippingId === shipping.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => handleShippingSelection(shipping.id)}
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value={shipping.id} id={`shipping-${shipping.id}`} className="mt-1" />
                    <div className="mt-0.5 text-primary">
                      {getShippingIcon(shipping.shipping_type?.name || shipping.name)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{shipping.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {shipping.estimated_days_min}-{shipping.estimated_days_max} days delivery
                          </p>
                          {shipping.description || shipping.shipping_type?.description ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {shipping.description || shipping.shipping_type?.description}
                            </p>
                          ) : null}
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {shipping.base_price === 0 ? 'FREE' : formatPrice(shipping.base_price)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </RadioGroup>
        </DialogContent>
      </Dialog>

      <Dialog open={isSavingsDialogOpen} onOpenChange={setIsSavingsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-background">
          <DialogHeader>
            <DialogTitle>Savings & Credits</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {hasFragile ? (
              <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <Shield className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Packaging for fragile items</p>
                    <p className="text-sm text-muted-foreground">
                      Choose the protection level before payment.
                    </p>
                  </div>
                </div>

                <RadioGroup
                  value={packagingChoice}
                  onValueChange={(value) => {
                    if (value === 'standard') {
                      setShowStandardWarning(true);
                    } else {
                      setPackagingChoice('reinforced');
                    }
                  }}
                >
                  <div className="space-y-3">
                    {allowsReinforcedPackaging ? (
                      <div
                        className={`cursor-pointer rounded-2xl border p-3.5 transition-all ${
                          packagingChoice === 'reinforced'
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => setPackagingChoice('reinforced')}
                      >
                        <div className="flex items-start gap-3">
                          <RadioGroupItem value="reinforced" id="savings-pack-reinforced" className="mt-1" />
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-foreground">Reinforced Protection</p>
                                <p className="text-sm text-muted-foreground">
                                  Extra cushioning and protection for fragile items.
                                </p>
                              </div>
                              <p className="text-sm font-semibold text-foreground">
                                +{formatPrice(reinforcedPackagingCost || globalReinforcedCost)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {allowsStandardPackaging ? (
                      <div
                        className={`cursor-pointer rounded-2xl border p-3.5 transition-all ${
                          packagingChoice === 'standard'
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => setShowStandardWarning(true)}
                      >
                        <div className="flex items-start gap-3">
                          <RadioGroupItem value="standard" id="savings-pack-standard" className="mt-1" />
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-foreground">Standard Packaging</p>
                                <p className="text-sm text-muted-foreground">
                                  Factory packaging only with no extra transit protection.
                                </p>
                              </div>
                              <p className="text-sm font-semibold text-foreground">Free</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </RadioGroup>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Coupon Code
              </Label>
              {appliedCoupon ? (
                <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/10 p-3">
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
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder="Enter code"
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={handleApplyCoupon}
                    disabled={isApplyingCoupon}
                    className="w-full sm:w-auto"
                  >
                    {isApplyingCoupon ? 'Applying...' : 'Apply'}
                  </Button>
                </div>
              )}
            </div>

            {totalPoints > 0 ? (
              <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
                <label className="flex cursor-pointer items-start gap-3">
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

                {useLoyaltyCredit ? (
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
                ) : null}
              </div>
            ) : null}

            {walletBalance > 0 ? (
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={useWalletCredit}
                    onCheckedChange={(checked) => setUseWalletCredit(!!checked)}
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
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Address</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      {/* Payment Recovery Dialog */}
      <Dialog open={showPaymentRecovery} onOpenChange={setShowPaymentRecovery}>
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-background">
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
            <div className="flex flex-col gap-2 sm:flex-row">
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
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-background">
          <DialogHeader>
            <DialogTitle>Courier Delivery Fee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-foreground">
              Standard Courier means your package will be delivered first, and you will pay the courier fee on receipt.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
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
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-background">
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
            <div className="flex flex-col gap-2 sm:flex-row">
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
