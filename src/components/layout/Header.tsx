import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, Menu, User, LogOut, Settings, Package, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
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
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const { isEnabled } = useFeatureFlags();

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const showSearchSurface =
    !location.pathname.startsWith('/admin') &&
    !location.pathname.startsWith('/product/') &&
    !location.pathname.startsWith('/track-order') &&
    !location.pathname.startsWith('/order-confirmation') &&
    location.pathname !== '/products' &&
    location.pathname !== '/checkout' &&
    location.pathname !== '/auth';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/[0.92] shadow-[0_8px_28px_-24px_hsl(var(--foreground)/0.55)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
      <div className="container flex h-14 items-center justify-between gap-2 px-3 sm:h-16 sm:px-6">
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
        <div className="flex items-center gap-0.5 sm:gap-2">
          {/* Search */}
          {showSearchSurface && (
            <form onSubmit={handleSearch} className="hidden md:flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search products, brands, or categories"
                  aria-label="Search products, brands, or categories"
                  className="w-56 rounded-full border-border/70 bg-background pl-10 lg:w-72"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </form>
          )}

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
          <Link to="/cart">
            <Button variant="ghost" size="icon" className="relative h-9 w-9 sm:h-10 sm:w-10">
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
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
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

      {showSearchSurface && (
        <div className="border-t border-border/60 px-3 py-2.5 md:hidden sm:px-6">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products, brands, or categories"
                aria-label="Search products, brands, or categories"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 rounded-2xl border-border/70 bg-card pl-10 shadow-sm"
              />
            </div>
          </form>
        </div>
      )}
    </header>
  );
}
