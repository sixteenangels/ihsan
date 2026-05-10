import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, ShoppingBag } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useCurrency } from '@/hooks/useCurrency';
import {
  CHECKOUT_RECOVERY_EVENT,
  loadCheckoutRecoverySnapshot,
  type CheckoutRecoverySnapshot,
} from '@/lib/checkoutRecovery';

export function ResumeCheckoutBanner() {
  const { formatPrice } = useCurrency();
  const [snapshot, setSnapshot] = useState<CheckoutRecoverySnapshot | null>(null);

  useEffect(() => {
    const syncSnapshot = () => {
      setSnapshot(loadCheckoutRecoverySnapshot());
    };

    syncSnapshot();
    window.addEventListener('storage', syncSnapshot);
    window.addEventListener(CHECKOUT_RECOVERY_EVENT, syncSnapshot);

    return () => {
      window.removeEventListener('storage', syncSnapshot);
      window.removeEventListener(CHECKOUT_RECOVERY_EVENT, syncSnapshot);
    };
  }, []);

  if (!snapshot) {
    return null;
  }

  return (
    <Alert className="border-primary/20 bg-primary/5">
      <ShoppingBag className="h-4 w-4" />
      <AlertTitle>Resume your checkout</AlertTitle>
      <AlertDescription className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span>
            {snapshot.itemCount} item{snapshot.itemCount === 1 ? '' : 's'} ready
          </span>
          <span>{formatPrice(snapshot.subtotal)} selected</span>
          {snapshot.shippingLabel ? <span>{snapshot.shippingLabel}</span> : null}
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            Updated {new Date(snapshot.updatedAt).toLocaleString()}
          </span>
        </div>

        {snapshot.productNames.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {snapshot.productNames.slice(0, 3).join(', ')}
            {snapshot.productNames.length > 3 ? ` +${snapshot.productNames.length - 3} more` : ''}
          </p>
        ) : null}

        <Link to="/checkout">
          <Button size="sm">
            Continue Checkout
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </AlertDescription>
    </Alert>
  );
}
