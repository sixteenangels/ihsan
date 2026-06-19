import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Package, FolderTree, Users, LayoutDashboard, ShoppingCart, Truck, Tag, Star, MessageCircle, FileText, Bell, Settings, AlertTriangle, RefreshCcw, HelpCircle, Award, Link2, Wallet, MessageSquare, Gift, ScrollText, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminProducts } from '@/components/admin/AdminProducts';
import { AdminCategories } from '@/components/admin/AdminCategories';
import { AdminGroupBuys } from '@/components/admin/AdminGroupBuys';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminOrders } from '@/components/admin/AdminOrders';
import { AdminShipping } from '@/components/admin/AdminShipping';
import { AdminPromotions } from '@/components/admin/AdminPromotions';
import { AdminUsers } from '@/components/admin/AdminUsers';
import { AdminReviews } from '@/components/admin/AdminReviews';
import { AdminSupport } from '@/components/admin/AdminSupport';
import { AdminReceipts } from '@/components/admin/AdminReceipts';
import { AdminNotifications } from '@/components/admin/AdminNotifications';
import { AdminSettings } from '@/components/admin/AdminSettings';
import { AdminRefunds } from '@/components/admin/AdminRefunds';
import { StockManagement } from '@/components/admin/StockManagement';
import { AdminQA } from '@/components/admin/AdminQA';
import { CustomerLeaderboard } from '@/components/admin/CustomerLeaderboard';
import { AdminBundles } from '@/components/admin/AdminBundles';
import { AdminLoyalty } from '@/components/admin/AdminLoyalty';
import { AdminWallet } from '@/components/admin/AdminWallet';
import { AdminMessageTemplates } from '@/components/admin/AdminMessageTemplates';
import { AdminGiftCards } from '@/components/admin/AdminGiftCards';
import { AdminAuditLogs } from '@/components/admin/AdminAuditLogs';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { BrandMark } from '@/components/brand/BrandMark';

// Permission slug for each nav item
const ALL_NAV_ITEMS = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, permission: null }, // always shown
  { name: 'Products', href: '/admin/products', icon: Package, permission: 'products' },
  { name: 'Stock Alerts', href: '/admin/stock', icon: AlertTriangle, permission: 'stock' },
  { name: 'Orders', href: '/admin/orders', icon: ShoppingCart, permission: 'orders' },
  { name: 'Refunds', href: '/admin/refunds', icon: RefreshCcw, permission: 'refunds' },
  { name: 'Shipping', href: '/admin/shipping', icon: Truck, permission: 'shipping' },
  { name: 'Group Buys', href: '/admin/group-buys', icon: Users, permission: 'group-buys' },
  { name: 'Categories', href: '/admin/categories', icon: FolderTree, permission: 'categories' },
  { name: 'Promotions', href: '/admin/promotions', icon: Tag, permission: 'promotions' },
  { name: 'Bundles', href: '/admin/bundles', icon: Link2, permission: 'bundles' },
  { name: 'Loyalty', href: '/admin/loyalty', icon: Award, permission: 'loyalty' },
  { name: 'Wallets', href: '/admin/wallets', icon: Wallet, permission: 'wallets' },
  { name: 'Gift Cards', href: '/admin/gift-cards', icon: Gift, permission: 'wallets' },
  { name: 'Templates', href: '/admin/templates', icon: MessageSquare, permission: 'templates' },
  { name: 'Reviews', href: '/admin/reviews', icon: Star, permission: 'reviews' },
  { name: 'Q&A', href: '/admin/qa', icon: HelpCircle, permission: 'qa' },
  { name: 'Leaderboard', href: '/admin/leaderboard', icon: Star, permission: 'leaderboard' },
  { name: 'Support', href: '/admin/support', icon: MessageCircle, permission: 'support' },
  { name: 'Receipts', href: '/admin/receipts', icon: FileText, permission: 'receipts' },
  { name: 'Users & Roles', href: '/admin/users', icon: Users, permission: '_admin_only' },
  { name: 'Notifications', href: '/admin/notifications', icon: Bell, permission: 'notifications' },
  { name: 'Audit Logs', href: '/admin/audit-logs', icon: ScrollText, permission: '_admin_only' },
  { name: 'Settings', href: '/admin/settings', icon: Settings, permission: '_admin_only' },
];

export default function Admin() {
  const { user, isAdmin, isLoading, isRoleReady, userRole, managerPermissions } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mainContentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isLoading && isRoleReady && (!user || !isAdmin)) {
      navigate('/auth');
    }
  }, [user, isAdmin, isLoading, isRoleReady, navigate]);

  // Redirect managers from routes they cannot access
  useEffect(() => {
    if (!isLoading && isRoleReady && userRole === 'manager') {
      const currentItem = ALL_NAV_ITEMS.find((item) => isActivePath(location.pathname, item.href));
      if (!currentItem) {
        return;
      }

      if (currentItem.permission === '_admin_only') {
        navigate('/admin');
        return;
      }

      if (
        currentItem.permission &&
        currentItem.permission !== '_admin_only' &&
        !managerPermissions.includes(currentItem.permission)
      ) {
        navigate('/admin');
      }
    }
  }, [location.pathname, userRole, isLoading, isRoleReady, navigate, managerPermissions]);

  const navItems = useMemo(() => {
    if (userRole === 'admin') return ALL_NAV_ITEMS;
    // Manager: show Dashboard always + items they have permission for
    return ALL_NAV_ITEMS.filter(item => {
      if (item.permission === null) return true; // Dashboard
      if (item.permission === '_admin_only') return false;
      return managerPermissions.includes(item.permission);
    });
  }, [userRole, managerPermissions]);

  const currentSection = useMemo(
    () => navItems.find((item) => isActivePath(location.pathname, item.href))?.name || 'Dashboard',
    [location.pathname, navItems],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      mainContentRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

  if (isLoading || !isRoleReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  const isActive = (href: string) => {
    return isActivePath(location.pathname, href);
  };

  return (
    <div className="min-h-dvh bg-background md:flex md:h-screen md:overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden h-screen w-64 border-r border-border bg-card md:flex md:flex-col">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-2">
            <BrandMark />
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">Admin Dashboard</p>
        </div>
        <ScrollArea className="flex-1 px-4">
          <nav className="space-y-1 pb-4">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            ))}
          </nav>
        </ScrollArea>
        <div className="border-t border-border p-4">
          <Link to="/">
            <Button variant="outline" className="w-full">
              Back to Store
            </Button>
          </Link>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-card/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-4 w-4" />
            <span className="sr-only">Open admin menu</span>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <BrandMark size="sm" />
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Admin</span>
            </div>
            <p className="truncate text-xs text-muted-foreground">{currentSection}</p>
          </div>
          <Link to="/" className="shrink-0">
            <Button variant="outline" size="sm">
              Store
            </Button>
          </Link>
        </div>
      </div>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-sm p-0">
          <div className="flex h-full min-h-0 flex-col bg-card">
            <SheetHeader className="border-b border-border px-5 py-4 text-left">
              <SheetTitle className="font-serif text-primary">Admin Menu</SheetTitle>
            </SheetHeader>
            <ScrollArea className="min-h-0 flex-1">
              <nav className="space-y-1 p-4">
                {navItems.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                      isActive(item.href)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate">{item.name}</span>
                  </Link>
                ))}
              </nav>
            </ScrollArea>
            <div className="border-t border-border p-4">
              <Link to="/" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full">
                  Back to Store
                </Button>
              </Link>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main
        ref={mainContentRef}
        className="min-w-0 px-3 pb-24 pt-20 sm:px-4 md:min-h-0 md:flex-1 md:overflow-x-auto md:overflow-y-auto md:p-8"
      >
        <div className="mx-auto w-full max-w-full">
          <ErrorBoundary>
            <Routes>
            <Route index element={<AdminPermissionRoute permission={null}><AdminDashboard /></AdminPermissionRoute>} />
            <Route path="products" element={<AdminPermissionRoute permission="products"><AdminProducts /></AdminPermissionRoute>} />
            <Route path="stock" element={<AdminPermissionRoute permission="stock"><StockManagement /></AdminPermissionRoute>} />
            <Route path="orders" element={<AdminPermissionRoute permission="orders"><AdminOrders /></AdminPermissionRoute>} />
            <Route path="refunds" element={<AdminPermissionRoute permission="refunds"><AdminRefunds /></AdminPermissionRoute>} />
            <Route path="shipping" element={<AdminPermissionRoute permission="shipping"><AdminShipping /></AdminPermissionRoute>} />
            <Route path="group-buys" element={<AdminPermissionRoute permission="group-buys"><AdminGroupBuys /></AdminPermissionRoute>} />
            <Route path="categories" element={<AdminPermissionRoute permission="categories"><AdminCategories /></AdminPermissionRoute>} />
            <Route path="promotions" element={<AdminPermissionRoute permission="promotions"><AdminPromotions /></AdminPermissionRoute>} />
            <Route path="bundles" element={<AdminPermissionRoute permission="bundles"><AdminBundles /></AdminPermissionRoute>} />
            <Route path="loyalty" element={<AdminPermissionRoute permission="loyalty"><AdminLoyalty /></AdminPermissionRoute>} />
            <Route path="wallets" element={<AdminPermissionRoute permission="wallets"><AdminWallet /></AdminPermissionRoute>} />
            <Route path="gift-cards" element={<AdminPermissionRoute permission="wallets"><AdminGiftCards /></AdminPermissionRoute>} />
            <Route path="templates" element={<AdminPermissionRoute permission="templates"><AdminMessageTemplates /></AdminPermissionRoute>} />
            <Route path="reviews" element={<AdminPermissionRoute permission="reviews"><AdminReviews /></AdminPermissionRoute>} />
            <Route path="qa" element={<AdminPermissionRoute permission="qa"><AdminQA /></AdminPermissionRoute>} />
            <Route path="leaderboard" element={<AdminPermissionRoute permission="leaderboard"><CustomerLeaderboard /></AdminPermissionRoute>} />
            <Route path="support" element={<AdminPermissionRoute permission="support"><AdminSupport /></AdminPermissionRoute>} />
            <Route path="receipts" element={<AdminPermissionRoute permission="receipts"><AdminReceipts /></AdminPermissionRoute>} />
            <Route path="users" element={<AdminPermissionRoute permission="_admin_only"><AdminUsers /></AdminPermissionRoute>} />
            <Route path="notifications" element={<AdminPermissionRoute permission="notifications"><AdminNotifications /></AdminPermissionRoute>} />
            <Route path="audit-logs" element={<AdminPermissionRoute permission="_admin_only"><AdminAuditLogs /></AdminPermissionRoute>} />
            <Route path="settings" element={<AdminPermissionRoute permission="_admin_only"><AdminSettings /></AdminPermissionRoute>} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}

function isActivePath(pathname: string, href: string) {
  if (href === '/admin') {
    return pathname === '/admin';
  }
  return pathname.startsWith(href);
}

function AdminPermissionRoute({
  permission,
  children,
}: {
  permission: string | null | '_admin_only';
  children: ReactNode;
}) {
  const { userRole, managerPermissions, isRoleReady } = useAuth();
  const navigate = useNavigate();

  const allowed = useMemo(() => {
    if (!isRoleReady) {
      return false;
    }

    if (userRole === 'admin') {
      return true;
    }

    if (permission === null) {
      return true;
    }

    if (permission === '_admin_only') {
      return false;
    }

    return managerPermissions.includes(permission);
  }, [isRoleReady, managerPermissions, permission, userRole]);

  useEffect(() => {
    if (isRoleReady && !allowed) {
      navigate('/admin');
    }
  }, [allowed, isRoleReady, navigate]);

  if (!isRoleReady) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
