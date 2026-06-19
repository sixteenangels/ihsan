import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useCheckoutFeatureFlags } from '@/hooks/useCheckoutFeatureFlags';
import { useLoyaltyPoints } from '@/hooks/useLoyaltyPoints';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useWalletBalance } from '@/hooks/useWallet';
import {
  getCouponDiscountAmount,
  getCouponIneligibilityMessage,
  isCouponEligibleForOrder,
  normalizeCoupon,
  type CheckoutCoupon,
} from '@/lib/coupons';
import { getErrorMessage } from '@/lib/errors';
import { toMoney } from '@/lib/money';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PurchaseSummaryTotalRow } from '@/components/checkout/PurchaseSummary';

interface UseCheckoutSavingsOptions {
  subtotal: number;
  shippingCost?: number;
  extraCosts?: number;
}

function buildSavingsSummaryText(
  totalSavings: number,
  appliedCoupon: CheckoutCoupon | null,
  loyaltyDiscount: number,
  walletApplied: number,
  couponsEnabled: boolean,
  giftCardsEnabled: boolean,
) {
  if (totalSavings <= 0) {
    if (couponsEnabled && giftCardsEnabled) {
      return 'Apply coupons, loyalty points, or wallet balance';
    }
    if (couponsEnabled) {
      return 'Apply coupons or loyalty points';
    }
    if (giftCardsEnabled) {
      return 'Redeem gift cards or use wallet balance';
    }
    return 'Apply loyalty points or wallet balance';
  }

  return [
    appliedCoupon ? appliedCoupon.code : null,
    loyaltyDiscount > 0 ? 'Loyalty applied' : null,
    walletApplied > 0 ? 'Wallet applied' : null,
  ]
    .filter(Boolean)
    .join(' - ');
}

export function useCheckoutSavings({
  subtotal,
  shippingCost = 0,
  extraCosts = 0,
}: UseCheckoutSavingsOptions) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { couponsEnabled, giftCardsEnabled, loyaltyEnabled } = useCheckoutFeatureFlags();
  const walletBalance = useWalletBalance();
  const { totalPoints } = useLoyaltyPoints();
  const { data: storeSettings } = useStoreSettings();

  const [isSavingsDialogOpen, setIsSavingsDialogOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CheckoutCoupon | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [giftCardCode, setGiftCardCode] = useState('');
  const [isRedeemingGiftCard, setIsRedeemingGiftCard] = useState(false);
  const [userOrderCount, setUserOrderCount] = useState(0);
  const [useWalletCredit, setUseWalletCredit] = useState(false);
  const [useLoyaltyCredit, setUseLoyaltyCredit] = useState(false);
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState('');

  const fetchUserOrderCount = useCallback(async () => {
    if (!user) return;

    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('status', 'eq', 'cancelled');

    setUserOrderCount(count || 0);
  }, [user]);

  useEffect(() => {
    if (user) {
      void fetchUserOrderCount();
    }
  }, [user, fetchUserOrderCount]);

  const isCouponEligible = useCallback(
    (coupon: CheckoutCoupon) => isCouponEligibleForOrder(coupon, subtotal, userOrderCount),
    [subtotal, userOrderCount],
  );

  const getCouponDiscount = useCallback(
    (coupon: CheckoutCoupon) => getCouponDiscountAmount(coupon, subtotal),
    [subtotal],
  );

  const discount =
    couponsEnabled && appliedCoupon && isCouponEligible(appliedCoupon)
      ? getCouponDiscount(appliedCoupon)
      : 0;
  const subtotalBeforeCredits = toMoney(
    Math.max(0, subtotal + shippingCost + extraCosts - discount),
  );
  const loyaltyRate =
    typeof storeSettings?.loyaltyPointsToCurrencyRate === 'number'
      ? storeSettings.loyaltyPointsToCurrencyRate
      : 0.01;
  const loyaltyMinRedeemPoints =
    typeof storeSettings?.loyaltyMinRedeemPoints === 'number'
      ? storeSettings.loyaltyMinRedeemPoints
      : 100;
  const maxPointsByOrderValue =
    loyaltyRate > 0 ? Math.floor(subtotalBeforeCredits / loyaltyRate) : 0;
  const maxRedeemablePoints = Math.max(0, Math.min(totalPoints, maxPointsByOrderValue));
  const requestedLoyaltyPoints = Math.max(
    0,
    Math.min(Number(loyaltyPointsToRedeem || 0), maxRedeemablePoints),
  );
  const loyaltyPointsApplied =
    loyaltyEnabled && useLoyaltyCredit && requestedLoyaltyPoints >= loyaltyMinRedeemPoints
      ? requestedLoyaltyPoints
      : 0;
  const loyaltyDiscount = toMoney(loyaltyPointsApplied * loyaltyRate);
  const subtotalAfterLoyalty = toMoney(Math.max(0, subtotalBeforeCredits - loyaltyDiscount));
  const walletApplied =
    useWalletCredit && walletBalance > 0
      ? toMoney(Math.min(walletBalance, subtotalAfterLoyalty))
      : 0;
  const total = toMoney(Math.max(0, subtotalAfterLoyalty - walletApplied));
  const totalSavings = discount + loyaltyDiscount + walletApplied;
  const savingsSummaryText = buildSavingsSummaryText(
    totalSavings,
    appliedCoupon,
    loyaltyDiscount,
    walletApplied,
    couponsEnabled,
    giftCardsEnabled,
  );
  const showSavingsSection = couponsEnabled || giftCardsEnabled || loyaltyEnabled || walletBalance > 0;
  const couponId =
    couponsEnabled && appliedCoupon && isCouponEligible(appliedCoupon) ? appliedCoupon.id : null;

  useEffect(() => {
    if (!couponsEnabled && appliedCoupon) {
      setAppliedCoupon(null);
      setCouponCode('');
    }
  }, [appliedCoupon, couponsEnabled]);

  useEffect(() => {
    if (!appliedCoupon || !couponsEnabled) return;
    if (!isCouponEligible(appliedCoupon)) {
      setAppliedCoupon(null);
      setCouponCode('');
      toast.error('Your coupon is no longer eligible for this order.');
    }
  }, [appliedCoupon, couponsEnabled, isCouponEligible]);

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
        order_subtotal_input: subtotal,
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

      if (!isCouponEligibleForOrder(typedCoupon, subtotal, orderCount)) {
        toast.error(getCouponIneligibilityMessage(typedCoupon, subtotal, orderCount));
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

  return {
    couponsEnabled,
    giftCardsEnabled,
    loyaltyEnabled,
    showSavingsSection,
    isSavingsDialogOpen,
    setIsSavingsDialogOpen,
    couponCode,
    setCouponCode,
    appliedCoupon,
    isApplyingCoupon,
    giftCardCode,
    setGiftCardCode,
    isRedeemingGiftCard,
    useWalletCredit,
    setUseWalletCredit,
    useLoyaltyCredit,
    setUseLoyaltyCredit,
    loyaltyPointsToRedeem,
    setLoyaltyPointsToRedeem,
    walletBalance,
    totalPoints,
    maxRedeemablePoints,
    loyaltyMinRedeemPoints,
    loyaltyRate,
    discount,
    loyaltyDiscount,
    walletApplied,
    loyaltyPointsApplied,
    total,
    totalSavings,
    savingsSummaryText,
    couponId,
    handleApplyCoupon,
    removeCoupon,
    handleRedeemGiftCard,
  };
}

export function buildCheckoutSavingsTotalRows(
  savings: ReturnType<typeof useCheckoutSavings>,
  formatPrice: (amount: number) => string,
  baseRows: PurchaseSummaryTotalRow[],
): PurchaseSummaryTotalRow[] {
  return [
    ...baseRows,
    ...(savings.discount > 0
      ? [{ label: 'Coupon', value: `-${formatPrice(savings.discount)}`, tone: 'primary' as const }]
      : []),
    ...(savings.loyaltyDiscount > 0
      ? [
          {
            label: 'Loyalty Points',
            value: `-${formatPrice(savings.loyaltyDiscount)}`,
            tone: 'primary' as const,
          },
        ]
      : []),
    ...(savings.walletApplied > 0
      ? [
          {
            label: 'Wallet Credit',
            value: `-${formatPrice(savings.walletApplied)}`,
            tone: 'primary' as const,
          },
        ]
      : []),
    { label: 'Total', value: formatPrice(savings.total), emphasis: true },
  ];
}
