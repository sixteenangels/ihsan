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
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 md:hidden">
      <div className="pointer-events-auto mx-3 mb-2 flex items-center justify-around rounded-[1.65rem] border border-border/80 bg-background/90 px-2 py-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.375rem)] shadow-[0_18px_44px_-22px_hsl(var(--foreground)/0.75)] backdrop-blur-xl">
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
                "relative mx-0.5 flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl transition-all duration-150",
                isActive ? "bg-primary/12 text-primary shadow-sm" : "text-muted-foreground",
                isPressed && "scale-90 opacity-70"
              )}
            >
              <div className={cn(
                "relative transition-transform duration-200 ease-out",
                isActive && "animate-bounce-subtle"
              )}>
                <Icon 
                  className={cn(
                    "h-5 w-5 transition-all duration-200",
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
