import { Link, useLocation } from 'react-router-dom';
import { Home, Search, ShoppingCart, User } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useState, useCallback } from 'react';

const navItems = [
  { icon: Home, label: 'Home', href: '/' },
  { icon: Search, label: 'Browse', href: '/products' },
  { icon: ShoppingCart, label: 'Cart', href: '/cart', showBadge: true },
  { icon: User, label: 'Account', href: '/profile' },
];

// Haptic feedback for iOS
const triggerHaptic = () => {
  if ('vibrate' in navigator) {
    navigator.vibrate(10);
  }
};

export function MobileNavBar() {
  const location = useLocation();
  const { totalItems } = useCart();
  const [pressedItem, setPressedItem] = useState<string | null>(null);

  const handleTouchStart = useCallback((href: string) => {
    setPressedItem(href);
    triggerHaptic();
  }, []);

  const handleTouchEnd = useCallback(() => {
    setPressedItem(null);
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/80 backdrop-blur-xl border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const isPressed = pressedItem === item.href;
          const Icon = item.icon!;

          return (
            <Link
              key={item.href}
              to={item.href}
              onTouchStart={() => handleTouchStart(item.href)}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all duration-150",
                isActive ? "text-primary" : "text-muted-foreground",
                isPressed && "scale-90 opacity-70"
              )}
            >
              <div className={cn(
                "relative transition-transform duration-200 ease-out",
                isActive && "animate-bounce-subtle"
              )}>
                <Icon 
                  className={cn(
                    "h-6 w-6 transition-all duration-200",
                    isActive && "stroke-[2.5px]",
                    isPressed && "scale-110"
                  )} 
                />
                {item.showBadge && totalItems > 0 && (
                  <Badge
                    className="absolute -top-1.5 -right-2 h-4 min-w-4 flex items-center justify-center p-0 text-[10px] animate-scale-in"
                  >
                    {totalItems > 99 ? '99+' : totalItems}
                  </Badge>
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-all duration-200",
                isActive && "font-semibold text-primary"
              )}>
                {item.label}
              </span>
              {/* Active indicator dot */}
              <div className={cn(
                "absolute bottom-1 w-1 h-1 rounded-full bg-primary transition-all duration-300",
                isActive ? "opacity-100 scale-100" : "opacity-0 scale-0"
              )} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
