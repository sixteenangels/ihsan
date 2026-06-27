import { Gift, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrency } from '@/hooks/useCurrency';
import type { useCheckoutSavings } from '@/hooks/useCheckoutSavings';

type CheckoutSavingsState = ReturnType<typeof useCheckoutSavings>;

interface CheckoutSavingsCardProps {
  savings: CheckoutSavingsState;
}

export function CheckoutSavingsCard({ savings }: CheckoutSavingsCardProps) {
  const { formatPrice } = useCurrency();

  if (!savings.showSavingsSection) {
    return null;
  }

  return (
    <button
      type="button"
      className="w-full rounded-2xl border border-border/70 bg-card/90 p-4 text-left shadow-sm transition-colors hover:border-primary/45"
      onClick={() => savings.setIsSavingsDialogOpen(true)}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
          <Tag className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Coupons & Gift Cards</p>
          <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
            {savings.savingsSummaryText}
          </p>
        </div>
        {savings.totalSavings > 0 ? (
          <p className="shrink-0 text-xs font-semibold text-primary">
            -{formatPrice(savings.totalSavings)}
          </p>
        ) : null}
      </div>
    </button>
  );
}

interface CheckoutSavingsDialogProps {
  savings: CheckoutSavingsState;
  loyaltyPointsInputId?: string;
}

export function CheckoutSavingsDialog({
  savings,
  loyaltyPointsInputId = 'checkout-loyalty-points',
}: CheckoutSavingsDialogProps) {
  const { formatPrice } = useCurrency();

  if (!savings.showSavingsSection) {
    return null;
  }

  return (
    <Dialog open={savings.isSavingsDialogOpen} onOpenChange={savings.setIsSavingsDialogOpen}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>Savings & Credits</DialogTitle>
          <DialogDescription>
            Apply coupons, redeem gift cards, or use wallet and loyalty credits.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {savings.couponsEnabled ? (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Coupon Code
              </Label>
              {savings.appliedCoupon ? (
                <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/10 p-3">
                  <div>
                    <p className="font-medium text-foreground">{savings.appliedCoupon.code}</p>
                    <p className="text-sm text-muted-foreground">
                      {savings.appliedCoupon.type === 'percentage'
                        ? `${savings.appliedCoupon.value}% off`
                        : `${formatPrice(savings.appliedCoupon.value)} off`}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={savings.removeCoupon}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder="Enter code"
                    value={savings.couponCode}
                    onChange={(event) => savings.setCouponCode(event.target.value.toUpperCase())}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void savings.handleApplyCoupon();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void savings.handleApplyCoupon()}
                    disabled={savings.isApplyingCoupon}
                    className="w-full sm:w-auto"
                  >
                    {savings.isApplyingCoupon ? 'Applying...' : 'Apply'}
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          {savings.giftCardsEnabled ? (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Gift Card
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Enter gift card code"
                  value={savings.giftCardCode}
                  onChange={(event) => savings.setGiftCardCode(event.target.value.toUpperCase())}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void savings.handleRedeemGiftCard();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void savings.handleRedeemGiftCard()}
                  disabled={savings.isRedeemingGiftCard}
                  className="w-full sm:w-auto"
                >
                  {savings.isRedeemingGiftCard ? 'Redeeming...' : 'Redeem'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Gift cards are added to your wallet, then wallet credit can be applied below.
              </p>
            </div>
          ) : null}

          {savings.loyaltyEnabled && savings.totalPoints > 0 ? (
            <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={savings.useLoyaltyCredit}
                  onCheckedChange={(checked) => {
                    const enabled = !!checked;
                    savings.setUseLoyaltyCredit(enabled);
                    if (enabled && !savings.loyaltyPointsToRedeem) {
                      savings.setLoyaltyPointsToRedeem(String(savings.maxRedeemablePoints));
                    }
                  }}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-foreground">
                    Redeem loyalty points ({savings.totalPoints.toLocaleString()} available)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {savings.loyaltyMinRedeemPoints} point minimum. {formatPrice(savings.loyaltyRate)} per point.
                  </p>
                </div>
              </label>

              {savings.useLoyaltyCredit ? (
                <div className="space-y-2">
                  <Label htmlFor={loyaltyPointsInputId}>Points to redeem</Label>
                  <Input
                    id={loyaltyPointsInputId}
                    type="number"
                    min={savings.loyaltyMinRedeemPoints}
                    max={savings.maxRedeemablePoints}
                    step="1"
                    value={savings.loyaltyPointsToRedeem}
                    onChange={(event) => savings.setLoyaltyPointsToRedeem(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Up to {savings.maxRedeemablePoints.toLocaleString()} points can be used on this order.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {savings.walletBalance > 0 ? (
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={savings.useWalletCredit}
                  onCheckedChange={(checked) => savings.setUseWalletCredit(!!checked)}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-foreground">
                    Use wallet credit ({formatPrice(savings.walletBalance)} available)
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
  );
}
