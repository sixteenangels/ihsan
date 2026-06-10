import { Link, useLocation } from 'react-router-dom';
import { Heart, Home, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useCallback } from 'react';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

const navItems = [
  { icon: Home, label: 'Home', href: '/' },
  { icon: Search, label: 'Browse', href: '/products' },
  { icon: Heart, label: 'Wishlist', href: '/wishlist', feature: 'wishlist' as const },
  { icon: User, label: 'Account', href: '/profile' },
];

const brandOrange = 'hsl(var(--primary))';
const brandOrangeMuted = 'hsl(var(--primary) / 0.78)';

// Haptic feedback for iOS
const triggerHaptic = () => {
  if ('vibrate' in navigator) {
    navigator.vibrate(10);
  }
};

export function MobileNavBar() {
  const location = useLocation();
  const { isEnabled } = useFeatureFlags();
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
      <div className="pointer-events-auto mx-3 mb-2 flex items-center justify-around rounded-[1.65rem] border border-white/10 bg-[#101010]/95 px-4 py-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.375rem)] shadow-[0_18px_44px_-18px_hsl(0_0%_0%/0.85)] backdrop-blur-xl">
        {navItems.filter((item) => !item.feature || isEnabled(item.feature)).map((item) => {
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
              style={{ color: isActive ? brandOrange : brandOrangeMuted }}
              className={cn(
                "relative mx-0.5 flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl transition-all duration-150",
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
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-all duration-200",
                isActive && "font-semibold"
              )}>
                {item.label}
              </span>
              {/* Active indicator dot */}
              <div className={cn(
                "absolute bottom-1 h-1 w-1 rounded-full transition-all duration-300",
                isActive ? "opacity-100 scale-100" : "opacity-0 scale-0"
              )}
                style={{ backgroundColor: brandOrange }}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
