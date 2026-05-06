import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Button } from '@/components/ui/button';
import { ShoppingCart, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

export function AbandonedCartReminder() {
  const { isEnabled } = useFeatureFlags();
  const { totalItems } = useCart();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (totalItems > 0 && user && !dismissed) {
      const timer = setTimeout(() => setShow(true), 30000); // Show after 30s
      return () => clearTimeout(timer);
    }
    setShow(false);
  }, [totalItems, user, dismissed]);

  if (!show || !isEnabled('abandoned_cart')) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80 z-40 animate-in slide-in-from-bottom-4">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4">
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
