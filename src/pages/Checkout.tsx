import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Gift, MapPin, Package, Plane, Plus, Ship, Tag, X, AlertTriangle, Shield } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { isVariantPlaceholder, useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWalletBalance } from '@/hooks/useWallet';
import { useLoyaltyPoints } from '@/hooks/useLoyaltyPoints';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useCheckoutFeatureFlags } from '@/hooks/useCheckoutFeatureFlags';
import { loadPaystack, type PaystackTransactionResponse } from '@/lib/paystack';
import {
  clearCheckoutRecoverySnapshot,
  saveCheckoutRecoverySnapshot,
} from '@/lib/checkoutRecovery';
import { getErrorMessage, getSupabaseFunctionErrorMessage } from '@/lib/errors';
import { trackRecommendationEvent } from '@/lib/recommendationEvents';
import { PurchaseSummary } from '@/components/checkout/PurchaseSummary';
import { toMoney } from '@/lib/money';
import {
  getCouponDiscountAmount,
  getCouponIneligibilityMessage,
  isCouponEligibleForOrder,
  normalizeCoupon,
  type CheckoutCoupon,
} from '@/lib/coupons';

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

function hasText(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasCompleteDeliveryDetails(address: Address | undefined, email: string | null | undefined) {
  return (
    !!address &&
    hasText(address.full_name) &&
    hasText(address.phone) &&
    hasText(address.address_line1) &&
    hasText(address.city) &&
    hasText(address.country) &&
    hasText(email)
  );
}

export default function Checkout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
  const [appliedCoupon, setAppliedCoupon] = useState<CheckoutCoupon | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [giftCardCode, setGiftCardCode] = useState('');
  const [isRedeemingGiftCard, setIsRedeemingGiftCard] = useState(false);
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
  const { couponsEnabled, giftCardsEnabled, loyaltyEnabled } = useCheckoutFeatureFlags();
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
  const [isCheckoutCatalogLoading, setIsCheckoutCatalogLoading] = useState(false);
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
      setIsCheckoutCatalogLoading(false);
      return;
    }

    let cancelled = false;
    setIsCheckoutCatalogLoading(true);

    (async () => {
      try {
        const [{ data: products, error: productsError }, { data: variants, error: variantsError }] = await Promise.all([
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

        if (cancelled) {
          return;
        }

        if (productsError) throw productsError;
        if (variantsError) throw variantsError;

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
      } catch (error) {
        console.error('Failed to load checkout product data:', error);
        toast.error('Could not verify checkout item options. Please try again.');
      } finally {
        if (!cancelled) {
          setIsCheckoutCatalogLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
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
  const hasReadyDeliveryDetails = hasCompleteDeliveryDetails(selectedAddressDetails, user?.email);
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
  const isCouponEligible = useCallback((coupon: CheckoutCoupon) => {
    return isCouponEligibleForOrder(coupon, selectedSubtotal, userOrderCount);
  }, [selectedSubtotal, userOrderCount]);

  const getCouponDiscount = useCallback((coupon: CheckoutCoupon) => {
    return getCouponDiscountAmount(coupon, selectedSubtotal);
  }, [selectedSubtotal]);

  const calculateDiscount = () => {
    if (!appliedCoupon || !isCouponEligible(appliedCoupon)) return 0;
    return getCouponDiscount(appliedCoupon);
  };

  const discount = calculateDiscount();
  const subtotalBeforeCredits = toMoney(Math.max(0, selectedSubtotal + shippingCost + reinforcedPackagingCost - discount));
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
  const loyaltyDiscount = toMoney(loyaltyPointsApplied * loyaltyRate);
  const subtotalAfterLoyalty = toMoney(Math.max(0, subtotalBeforeCredits - loyaltyDiscount));
  const walletApplied = useWalletCredit ? toMoney(Math.min(walletBalance, subtotalAfterLoyalty)) : 0;
  const total = toMoney(Math.max(0, subtotalAfterLoyalty - walletApplied));
  const itemCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleApplyCoupon = async () => {
    if (!couponsEnabled) {
      toast.error('Coupons are currently disabled.');
      return;
    }

    if (!user) {
      toast.error('Sign in to apply a coupon');
      return;
    }

    if (!couponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }
    
    setIsApplyingCoupon(true);
    
    try {
      const { data, error } = await supabase.rpc('validate_coupon_by_code' as never, {
        coupon_code_input: couponCode.trim(),
        order_subtotal_input: selectedSubtotal,
      } as never);

      if (error) {
        throw error;
      }

      const { count: latestOrderCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('status', 'eq', 'cancelled');

      const orderCount = latestOrderCount || 0;
      setUserOrderCount(orderCount);

      const typedCoupon = normalizeCoupon(data);
      if (!typedCoupon) {
        throw new Error('Invalid coupon response. Please try again.');
      }

      if (!isCouponEligibleForOrder(typedCoupon, selectedSubtotal, orderCount)) {
        toast.error(getCouponIneligibilityMessage(typedCoupon, selectedSubtotal, orderCount));
        return;
      }

      setAppliedCoupon(typedCoupon);
      setCouponCode(typedCoupon.code);
      toast.success('Coupon applied successfully!');
      setIsSavingsDialogOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Invalid coupon code'));
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  const handleRedeemGiftCard = async () => {
    if (!giftCardsEnabled) {
      toast.error('Gift card redemption is currently disabled.');
      return;
    }

    if (!user) {
      toast.error('Sign in to redeem a gift card');
      return;
    }

    const code = giftCardCode.trim();
    if (!code) {
      toast.error('Please enter a gift card code');
      return;
    }

    setIsRedeemingGiftCard(true);

    try {
      const { data, error } = await supabase.rpc('redeem_gift_card' as never, {
        input_code: code,
      } as never);

      if (error) {
        throw error;
      }

      const redeemed = data as { amount?: number | string; code?: string } | null;
      const amount = toMoney(redeemed?.amount || 0);
      setGiftCardCode('');
      await queryClient.refetchQueries({ queryKey: ['wallet-transactions', user.id] });
      if (amount > 0) {
        setUseWalletCredit(true);
        toast.success(`Gift card redeemed: ${formatPrice(amount)} added to your wallet.`);
      } else {
        toast.success('Gift card redeemed and added to your wallet.');
      }
      setIsSavingsDialogOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Gift card could not be redeemed.'));
    } finally {
      setIsRedeemingGiftCard(false);
    }
  };

  useEffect(() => {
    if (!appliedCoupon) return;
    if (!isCouponEligible(appliedCoupon)) {
      setAppliedCoupon(null);
      setCouponCode('');
      toast.error('Your coupon is no longer eligible for this order.');
    }
  }, [appliedCoupon, isCouponEligible]);

  useEffect(() => {
    if (!couponsEnabled || !user || appliedCoupon || selectedSubtotal <= 0) return;

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('is_active', true)
        .eq('auto_apply', true);

      if (error || cancelled || !data?.length) return;

      const validatedCoupons: CheckoutCoupon[] = [];

      for (const row of data) {
        const normalized = normalizeCoupon(row);
        if (!normalized) continue;

        const { data: validated, error: validateError } = await supabase.rpc(
          'validate_coupon_by_code' as never,
          {
            coupon_code_input: normalized.code,
            order_subtotal_input: selectedSubtotal,
          } as never,
        );

        if (validateError || cancelled) continue;

        const typedCoupon = normalizeCoupon(validated);
        if (typedCoupon) {
          validatedCoupons.push(typedCoupon);
        }
      }

      if (cancelled || validatedCoupons.length === 0) return;

      const bestCoupon = validatedCoupons
        .sort((a, b) => getCouponDiscount(b) - getCouponDiscount(a))[0];

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
  }, [couponsEnabled, user, appliedCoupon, selectedSubtotal, userOrderCount, getCouponDiscount, isCouponEligible]);

  const getShippingIcon = (typeName?: string | null) => {
    const lower = typeName?.toLowerCase() || '';
    if (lower.includes('sea')) return Ship;
    if (lower.includes('courier') || lower.includes('express')) return Package;
    return Plane;
  };

  const unresolvedVariantItems = selectedItems.filter((item) =>
    isVariantPlaceholder(item.variant.id) &&
    ((productVariantOptions[item.product.id] || []).length > 0 || item.product.variants.length > 0)
  );
  const isCheckingVariantRequirements =
    isCheckoutCatalogLoading && selectedItems.some((item) => isVariantPlaceholder(item.variant.id));
  const firstUnresolvedVariantItem = unresolvedVariantItems[0];
  const showSavingsSection =
    couponsEnabled || giftCardsEnabled || loyaltyEnabled || walletBalance > 0 || totalPoints > 0;
  const accordionDefaultSections = [
    'items',
    unresolvedVariantItems.length > 0 ? 'variants' : null,
    hasFragile ? 'packaging' : null,
  ].filter((value): value is string => Boolean(value));
  const checkoutSteps = [
    {
      id: 'address',
      label: 'Address',
      complete: hasReadyDeliveryDetails,
      detail: selectedAddressDetails
        ? hasReadyDeliveryDetails
          ? `${selectedAddressDetails.city}, ${selectedAddressDetails.country}`
          : 'Complete phone and delivery address before payment.'
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
      complete: hasReadyDeliveryDetails && !!selectedShippingId && unresolvedVariantItems.length === 0,
      detail:
        unresolvedVariantItems.length > 0
          ? 'Choose variants before payment.'
          : !hasReadyDeliveryDetails
            ? 'Complete delivery details before payment.'
          : total <= 0
            ? 'Your order is fully covered.'
            : 'Review the total and complete payment.',
    },
  ];
  const completedCheckoutSteps = checkoutSteps.filter((step) => step.complete).length;
  const isPaymentDisabled =
    isProcessing ||
    isCheckingVariantRequirements ||
    !hasReadyDeliveryDetails ||
    !selectedShippingId ||
    unresolvedVariantItems.length > 0;
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
    : isCheckingVariantRequirements
      ? 'Checking item options before payment.'
    : !selectedAddressId
      ? 'Select a delivery address to continue.'
      : !hasReadyDeliveryDetails
        ? 'Complete your delivery address to continue.'
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
      setIsShippingPickerOpen(false);
      setShowCourierDialog(true);
      return;
    }

    setSelectedShippingId(id);
    setCourierAcknowledged(false);
    setIsShippingPickerOpen(false);
  };

  const handleAddressSelection = (id: string) => {
    setSelectedAddressId(id);
    setIsAddressPickerOpen(false);
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
    if (!hasReadyDeliveryDetails) {
      toast.error('Complete your delivery address before payment.');
      setIsAddressPickerOpen(true);
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
    if (isCheckingVariantRequirements) {
      toast.info('Checking item options before payment. Please wait a moment.');
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
      if (!selectedAddress || !hasCompleteDeliveryDetails(selectedAddress, user?.email)) {
        throw new Error('Complete your delivery address before placing the order.');
      }

      const { data, error } = await supabase.functions.invoke('create-checkout-order', {
        body: {
          flow: 'cart',
          paymentReference,
          addressId: selectedAddress.id,
          shippingClassId: selectedShippingId,
          packagingChoice: hasFragile ? packagingChoice : null,
          couponId: appliedCoupon && isCouponEligible(appliedCoupon) ? appliedCoupon.id : null,
          loyaltyPointsToRedeem: loyaltyPointsApplied,
          useWalletCredit,
          recoverySnapshotId: checkoutRecoverySnapshotIdRef.current,
          expectedTotal: total,
          items: selectedItems.map((item) => ({
            productId: item.product.id,
            productVariantId: isVariantPlaceholder(item.variant.id) ? null : item.variant.id,
            quantity: item.quantity,
          })),
        },
      });

      if (error) {
        throw new Error(await getSupabaseFunctionErrorMessage(error, 'Order could not be created.'));
      }

      const order = (data as {
        order?: { id: string; order_number?: string; total_amount?: number };
        alreadyExists?: boolean;
        error?: string;
      } | null)?.order;

      if (!order?.id) {
        throw new Error((data as { error?: string } | null)?.error || 'Order could not be created.');
      }

      selectedItems.forEach((item) => {
        trackRecommendationEvent({
          productId: item.product.id,
          eventType: 'order_complete',
          source: 'checkout',
          weight: item.quantity,
          productVariantId: isVariantPlaceholder(item.variant.id) ? null : item.variant.id,
          orderId: order.id,
        });
      });

      setPendingPaymentRef(null);
      clearCheckoutRecoverySnapshot();
      clearSelectedItems();
      toast.success((data as { alreadyExists?: boolean } | null)?.alreadyExists ? 'Order already created!' : 'Order placed successfully!');
      navigate(`/order-confirmation/${order.id}`);
      setIsProcessing(false);
      setOrderCreationInProgress(false);
    } catch (error) {
      console.error('Order finalization error:', error);
      const message = error instanceof Error ? error.message : 'Failed to place order. Please try again.';
      toast.error(paymentReference ? `${message} Keep this payment reference for support.` : message);
      if (paymentReference) {
        setPendingPaymentRef(paymentReference);
        setShowPaymentRecovery(true);
      }
      setIsProcessing(false);
      setOrderCreationInProgress(false);
    }
  };

  const verifyAndCreateOrder = async (paymentReference: string) => {
    if (orderCreationInProgress) {
      console.warn('Order creation already in progress, ignoring duplicate call');
      return;
    }
    setOrderCreationInProgress(true);
    
    try {
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
      <main className="container px-3 py-5 pb-10 sm:px-6 md:py-8">
        <div className="mx-auto max-w-md">
          <div className="mb-5 flex items-start gap-4">
            <Link
              to="/cart"
              className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-primary"
              aria-label="Back to cart"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Instant Checkout</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Review your order details and pay in one step.
              </p>
            </div>
          </div>

          <PurchaseSummary
            showTitle={false}
            shipping={{
              title: 'Shipping Method',
              detail: selectedShipping
                ? `${selectedShipping.name} (${selectedShipping.estimated_days_min}-${selectedShipping.estimated_days_max} days)`
                : 'Choose a shipping method',
              amount: selectedShipping ? (shippingCost === 0 ? 'FREE' : formatPrice(shippingCost)) : null,
              icon: selectedShipping
                ? getShippingIcon(selectedShipping.shipping_type?.name || selectedShipping.name)
                : Package,
              onClick: () => setIsShippingPickerOpen(true),
            }}
            address={{
              title: 'Delivery Address',
              detail: formatAddressLine(selectedAddressDetails),
              subdetail: formatAddressReference(selectedAddressDetails),
              icon: MapPin,
              onClick: () => setIsAddressPickerOpen(true),
            }}
            itemsTitle={`Selected Variants (${selectedItems.length})`}
            itemsSubtitle={`You've selected ${itemCount} item${itemCount === 1 ? '' : 's'}`}
            items={selectedItems.map((item) => {
              const needsVariant = unresolvedVariantItems.some(
                (unresolvedItem) => unresolvedItem.id === item.id,
              );
              const variantName = needsVariant
                ? 'Variant not selected'
                : formatVariantLabel(item.variant.color, item.variant.size);

              return {
                id: item.id,
                title: item.product.name,
                imageUrl: item.variant.image_url || item.product.images?.[0] || '/placeholder.svg',
                quantity: item.quantity,
                amount: formatPrice(Number(item.variant.price || 0) * item.quantity),
                subtitle: item.variant.color ? `Color: ${item.variant.color}` : variantName,
                details: item.variant.size ? [`Size: ${item.variant.size}`] : [],
                warning: needsVariant ? 'Choose a variant to continue' : null,
                action: needsVariant ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-xl"
                    onClick={() => sendToProductVariantSelection(item.product.id)}
                  >
                    Select on product page
                  </Button>
                ) : null,
              };
            })}
            totals={[
              { label: `Subtotal (${itemCount} items)`, value: formatPrice(selectedSubtotal) },
              { label: 'Shipping', value: shippingCost === 0 ? 'FREE' : formatPrice(shippingCost) },
              ...(reinforcedPackagingCost > 0
                ? [{ label: 'Reinforced Packaging', value: formatPrice(reinforcedPackagingCost) }]
                : []),
              ...(discount > 0
                ? [{ label: 'Coupon', value: `-${formatPrice(discount)}`, tone: 'primary' as const }]
                : []),
              ...(loyaltyDiscount > 0
                ? [{ label: 'Loyalty Points', value: `-${formatPrice(loyaltyDiscount)}`, tone: 'primary' as const }]
                : []),
              ...(walletApplied > 0
                ? [{ label: 'Wallet Credit', value: `-${formatPrice(walletApplied)}`, tone: 'primary' as const }]
                : []),
              { label: 'Total', value: formatPrice(total), emphasis: true },
            ]}
            makeChangesLabel="Make Changes"
            payLabel={paymentButtonText}
            secureText={paymentSupportText}
            isProcessing={isProcessing}
            payDisabled={isPaymentDisabled}
            onMakeChanges={() => navigate('/cart')}
            onPay={handlePaystackPayment}
          >
          {showSavingsSection ? (
            <button
              type="button"
              className="w-full rounded-2xl border border-border/70 bg-card/90 p-4 text-left shadow-sm transition-colors hover:border-primary/45"
              onClick={() => setIsSavingsDialogOpen(true)}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                  <Tag className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Coupons & Gift Cards</p>
                  <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                    {savingsSummaryText}
                  </p>
                </div>
                {totalSavings > 0 ? (
                  <p className="shrink-0 text-xs font-semibold text-primary">
                    -{formatPrice(totalSavings)}
                  </p>
                ) : null}
              </div>
            </button>
          ) : null}
          </PurchaseSummary>
        </div>
      </main>

      <Dialog open={isAddressPickerOpen} onOpenChange={setIsAddressPickerOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-background">
          <DialogHeader>
            <DialogTitle>Choose Delivery Address</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {addresses.length > 0 ? (
              <RadioGroup value={selectedAddressId} onValueChange={handleAddressSelection}>
                <div className="space-y-3">
                  {addresses.map((address) => (
                    <div
                      key={address.id}
                      className={`cursor-pointer rounded-2xl border p-3.5 transition-all sm:p-4 ${
                        selectedAddressId === address.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => handleAddressSelection(address.id)}
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
              {shippingClasses.map((shipping) => {
                const ShippingIcon = getShippingIcon(shipping.shipping_type?.name || shipping.name);

                return (
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
                        <ShippingIcon className="h-5 w-5" />
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
                );
              })}
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

            {couponsEnabled ? (
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
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleApplyCoupon();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
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
            ) : null}

            {giftCardsEnabled ? (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Gift Card
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Enter gift card code"
                  value={giftCardCode}
                  onChange={(event) => setGiftCardCode(event.target.value.toUpperCase())}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleRedeemGiftCard();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRedeemGiftCard}
                  disabled={isRedeemingGiftCard}
                  className="w-full sm:w-auto"
                >
                  {isRedeemingGiftCard ? 'Redeeming...' : 'Redeem'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Gift cards are added to your wallet, then wallet credit can be applied below.
              </p>
            </div>
            ) : null}

            {loyaltyEnabled && totalPoints > 0 ? (
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
            <DialogTitle>Payment Recovery</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              If payment completed but your order did not appear, check the payment status and try
              creating the order again. If you did not complete payment, you were not charged.
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
