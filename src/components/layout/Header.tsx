import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Menu, User, LogOut, Settings, Package, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationBell } from './NotificationBell';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { BrandMark } from '@/components/brand/BrandMark';

export function Header() {
  const { totalItems } = useCart();
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { isEnabled } = useFeatureFlags();
  const mobileActionColor = '#ff8a33';

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Products', href: '/products' },
    { name: 'Flash Deals', href: '/flash-deals' },
    { name: 'Group Buys', href: '/group-buys' },
    { name: 'Categories', href: '/categories' },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#101010] text-primary-foreground shadow-[0_8px_28px_-24px_hsl(var(--foreground)/0.55)] backdrop-blur-xl md:border-border/70 md:bg-background/[0.92] md:text-foreground md:supports-[backdrop-filter]:bg-background/75">
      <div className="container flex h-16 items-center justify-between gap-2 px-3 sm:px-6 md:h-16">
        {/* Logo */}
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <BrandMark size="sm" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              {link.name}
            </Link>
          ))}
          {isAdmin && (
            <Link
              to="/admin"
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Right Side Actions */}
        <div
          className="flex items-center gap-0.5 sm:gap-2 md:text-foreground [&_button]:hover:bg-white/10 md:[&_button]:text-foreground md:[&_button]:hover:bg-accent md:[&_button]:hover:text-accent-foreground"
          style={{ color: mobileActionColor }}
        >
          {/* Notifications */}
          <NotificationBell />

          {/* User */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hidden sm:flex">
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5 text-sm font-medium">
                  {user.email}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/my-orders')}>
                  <Package className="mr-2 h-4 w-4" />
                  My Orders
                </DropdownMenuItem>
                {isEnabled('wishlist') && (
                  <DropdownMenuItem onClick={() => navigate('/wishlist')}>
                    <Heart className="mr-2 h-4 w-4" />
                    Wishlist
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate('/admin')}>
                    <Settings className="mr-2 h-4 w-4" />
                    Admin Dashboard
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth">
              <Button variant="ghost" size="icon" className="hidden sm:flex">
                <User className="h-4 w-4" />
              </Button>
            </Link>
          )}

          {/* Cart */}
          <Link to="/cart" className="hidden md:block">
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground sm:h-10 sm:w-10 md:text-foreground md:hover:bg-accent md:hover:text-accent-foreground"
            >
              <ShoppingCart className="h-4 w-4" />
              {totalItems > 0 && (
                <Badge
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {totalItems}
                </Badge>
              )}
            </Button>
          </Link>

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full hover:bg-white/10"
                style={{ color: mobileActionColor }}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-sm rounded-l-3xl border-l border-border/70 bg-background/95 px-5 backdrop-blur-xl">
              <nav className="mt-8 flex flex-col gap-3">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    to={link.href}
                    className="rounded-xl px-3 py-2 text-base font-medium text-foreground transition-colors hover:bg-muted hover:text-primary"
                  >
                    {link.name}
                  </Link>
                ))}
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="rounded-xl px-3 py-2 text-base font-medium text-primary transition-colors hover:bg-primary/5 hover:text-primary/80"
                  >
                    Admin Dashboard
                  </Link>
                )}
                <div className="border-t border-border pt-4 mt-4">
                  {user ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground truncate">
                        {user.email}
                      </p>
                      <Button className="w-full" variant="outline" onClick={handleSignOut}>
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                      </Button>
                    </div>
                  ) : (
                    <Link to="/auth">
                      <Button className="w-full" variant="outline">
                        <User className="h-4 w-4 mr-2" />
                        Sign In
                      </Button>
                    </Link>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>

    </header>
  );
}
