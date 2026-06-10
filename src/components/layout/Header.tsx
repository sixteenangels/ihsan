import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  CircleHelp,
  FileText,
  Headphones,
  Heart,
  Home,
  Info,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  User,
  UsersRound,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet';
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
  const mobilePrimaryLinks = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Flash Deals', href: '/flash-deals', icon: Zap },
    { name: 'Group Buys', href: '/group-buys', icon: UsersRound },
  ];
  const mobileSupportLinks = [
    { name: 'Contact Support', href: '/contact', icon: Headphones },
    { name: 'Help Center', href: '/help', icon: CircleHelp },
    { name: 'About AJYN', href: '/about', icon: Info },
    { name: 'Terms & Policies', href: '/terms-of-service', icon: FileText },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const renderMobileMenuLink = (item: { name: string; href: string; icon: typeof Home }) => {
    const Icon = item.icon;

    return (
      <SheetClose asChild key={item.name}>
        <Link
          to={item.href}
          className="group flex h-11 items-center gap-3 rounded-xl px-2.5 text-sm font-medium text-[#ededed] transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          <Icon className="h-5 w-5 shrink-0 text-[#ff8a33]" />
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[#d6d6d6] transition-transform group-hover:translate-x-0.5 group-hover:text-[#ffb56e]" />
        </Link>
      </SheetClose>
    );
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
          <Link to="/cart" className="block" aria-label="Open cart">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open cart"
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
            <SheetContent
              side="right"
              className="bottom-auto top-0 h-[calc(100dvh-1.25rem)] w-[76vw] min-w-[16.5rem] max-w-[18rem] rounded-bl-3xl rounded-tl-3xl border-l border-white/10 bg-[#151515]/95 p-0 text-white shadow-[0_28px_70px_-28px_rgba(0,0,0,0.95)] backdrop-blur-2xl [&>button]:right-4 [&>button]:top-4 [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:bg-white/10 [&>button]:focus:ring-[#ff8a33]"
            >
              <nav className="flex h-full flex-col px-4 pb-5 pt-12">
                <div className="space-y-1">
                  {mobilePrimaryLinks.map(renderMobileMenuLink)}
                </div>

                <div className="my-4 h-px bg-white/10" />

                <div className="space-y-1">
                  {mobileSupportLinks.map(renderMobileMenuLink)}
                </div>

                {isAdmin && (
                  <>
                    <div className="my-4 h-px bg-white/10" />
                    {renderMobileMenuLink({ name: 'Admin Dashboard', href: '/admin', icon: Settings })}
                  </>
                )}

                <div className="mt-auto border-t border-white/10 pt-5">
                  {user ? (
                    <div className="space-y-3">
                      <p className="truncate text-sm text-[#ededed]">
                        {user.email}
                      </p>
                      <Button
                        className="h-11 w-full rounded-lg border border-[#ff8a33]/80 bg-transparent text-sm font-medium text-[#ff8a33] hover:bg-[#ff8a33]/10 hover:text-[#ffb56e]"
                        variant="outline"
                        onClick={handleSignOut}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                      </Button>
                    </div>
                  ) : (
                    <SheetClose asChild>
                      <Link to="/auth">
                        <Button className="h-11 w-full rounded-lg border border-[#ff8a33]/80 bg-transparent text-sm font-medium text-[#ff8a33] hover:bg-[#ff8a33]/10 hover:text-[#ffb56e]" variant="outline">
                          <User className="mr-2 h-4 w-4" />
                        Sign In
                        </Button>
                      </Link>
                    </SheetClose>
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
