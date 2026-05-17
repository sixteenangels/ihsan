import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Button } from '@/components/ui/button';
import { ShoppingCart, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

interface AbandonedCartReminderProps {
  suppressed?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
}

export function AbandonedCartReminder({
  suppressed = false,
  onVisibilityChange,
}: AbandonedCartReminderProps) {
  const { isEnabled } = useFeatureFlags();
  const { totalItems } = useCart();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (suppressed) {
      setShow(false);
      return;
    }

    if (totalItems > 0 && user && !dismissed) {
      const timer = setTimeout(() => setShow(true), 30000); // Show after 30s
      return () => clearTimeout(timer);
    }
    setShow(false);
  }, [dismissed, suppressed, totalItems, user]);

  useEffect(() => {
    const isVisible = show && !suppressed && isEnabled('abandoned_cart');
    onVisibilityChange?.(isVisible);

    return () => {
      onVisibilityChange?.(false);
    };
  }, [isEnabled, onVisibilityChange, show, suppressed]);

  if (!show || suppressed || !isEnabled('abandoned_cart')) return null;

  return (
    <div className="fixed left-4 right-4 bottom-[5.15rem] z-40 animate-in slide-in-from-bottom-4 md:bottom-6 md:left-auto md:right-6 md:w-80">
      <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-xl">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <ShoppingCart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">
                You have {totalItems} item{totalItems > 1 ? 's' : ''} in your cart
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Complete your purchase before they're gone!
              </p>
            </div>
          </div>
          <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <Link to="/cart" className="block mt-3">
          <Button size="sm" className="w-full">
            View Cart
          </Button>
        </Link>
      </div>
    </div>
  );
}
