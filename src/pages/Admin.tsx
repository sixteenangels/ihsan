import { useEffect, useMemo } from 'react';
import { useNavigate, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Package, FolderTree, Users, LayoutDashboard, ShoppingCart, Truck, Tag, Star, MessageCircle, FileText, Bell, Settings, AlertTriangle, RefreshCcw, HelpCircle, Award, Link2, Wallet, MessageSquare } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  { name: 'Templates', href: '/admin/templates', icon: MessageSquare, permission: 'templates' },
  { name: 'Reviews', href: '/admin/reviews', icon: Star, permission: 'reviews' },
  { name: 'Q&A', href: '/admin/qa', icon: HelpCircle, permission: 'qa' },
  { name: 'Leaderboard', href: '/admin/leaderboard', icon: Star, permission: 'leaderboard' },
  { name: 'Support', href: '/admin/support', icon: MessageCircle, permission: 'support' },
  { name: 'Receipts', href: '/admin/receipts', icon: FileText, permission: 'receipts' },
  { name: 'Users & Roles', href: '/admin/users', icon: Users, permission: '_admin_only' },
  { name: 'Notifications', href: '/admin/notifications', icon: Bell, permission: 'notifications' },
  { name: 'Settings', href: '/admin/settings', icon: Settings, permission: '_admin_only' },
];

export default function Admin() {
  const { user, isAdmin, isLoading, userRole, managerPermissions } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      navigate('/auth');
    }
  }, [user, isAdmin, isLoading, navigate]);

  // Redirect managers from admin-only routes
  useEffect(() => {
    if (!isLoading && userRole === 'manager') {
      const adminOnlyPaths = ['/admin/users', '/admin/settings'];
      if (adminOnlyPaths.some(p => location.pathname.startsWith(p))) {
        navigate('/admin');
      }
    }
  }, [location.pathname, userRole, isLoading, navigate]);

  const navItems = useMemo(() => {
    if (userRole === 'admin') return ALL_NAV_ITEMS;
    // Manager: show Dashboard always + items they have permission for
    return ALL_NAV_ITEMS.filter(item => {
      if (item.permission === null) return true; // Dashboard
      if (item.permission === '_admin_only') return false;
      return managerPermissions.includes(item.permission);
    });
  }, [userRole, managerPermissions]);

  if (isLoading) {
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
    if (href === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card hidden md:flex md:flex-col">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold font-serif text-primary">Ihsan</span>
          </Link>
          <p className="text-sm text-muted-foreground mt-1">Admin Dashboard</p>
        </div>
        <ScrollArea className="flex-1 px-4">
          <nav className="space-y-1 pb-4">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
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
        <div className="p-4 border-t border-border">
          <Link to="/">
            <Button variant="outline" className="w-full">
              Back to Store
            </Button>
          </Link>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border p-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-xl font-bold font-serif text-primary">
            Ihsan Admin
          </Link>
          <Link to="/">
            <Button variant="outline" size="sm">
              Back to Store
            </Button>
          </Link>
        </div>
        <ScrollArea className="mt-4">
          <nav className="flex gap-2 pb-2">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                  isActive(item.href)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            ))}
          </nav>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 mt-32 md:mt-0 overflow-auto">
        <Routes>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="/products" element={<AdminProducts />} />
          <Route path="/stock" element={<StockManagement />} />
          <Route path="/orders" element={<AdminOrders />} />
          <Route path="/refunds" element={<AdminRefunds />} />
          <Route path="/shipping" element={<AdminShipping />} />
          <Route path="/group-buys" element={<AdminGroupBuys />} />
          <Route path="/categories" element={<AdminCategories />} />
          <Route path="/promotions" element={<AdminPromotions />} />
          <Route path="/bundles" element={<AdminBundles />} />
          <Route path="/loyalty" element={<AdminLoyalty />} />
          <Route path="/wallets" element={<AdminWallet />} />
          <Route path="/templates" element={<AdminMessageTemplates />} />
          <Route path="/reviews" element={<AdminReviews />} />
          <Route path="/qa" element={<AdminQA />} />
          <Route path="/leaderboard" element={<CustomerLeaderboard />} />
          <Route path="/support" element={<AdminSupport />} />
          <Route path="/receipts" element={<AdminReceipts />} />
          <Route path="/users" element={<AdminUsers />} />
          <Route path="/notifications" element={<AdminNotifications />} />
          <Route path="/settings" element={<AdminSettings />} />
        </Routes>
      </main>
    </div>
  );
}
