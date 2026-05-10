import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompareProvider } from "@/contexts/CompareContext";
import { CompareBar } from "@/components/compare/CompareBar";
import { MobileNavBar } from "@/components/layout/MobileNavBar";
import { LiveChatWidget } from "@/components/support/LiveChatWidget";
import { AbandonedCartReminder } from "@/components/cart/AbandonedCartReminder";
import { CookieConsent } from "@/components/CookieConsent";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { MaintenanceMode } from "@/components/MaintenanceMode";
import { missingSupabaseEnvVars, supabaseConfigError } from "@/integrations/supabase/client";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense, useLayoutEffect } from "react";
import { Loader2 } from "lucide-react";

// Lazy load all pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Products = lazy(() => import("./pages/Products"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));
const MyOrders = lazy(() => import("./pages/MyOrders"));
const GroupBuys = lazy(() => import("./pages/GroupBuys"));
const GroupBuyDetail = lazy(() => import("./pages/GroupBuyDetail"));
const Categories = lazy(() => import("./pages/Categories"));
const Auth = lazy(() => import("./pages/Auth"));
const Admin = lazy(() => import("./pages/Admin"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));
const Profile = lazy(() => import("./pages/Profile"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const Compare = lazy(() => import("./pages/Compare"));
const Help = lazy(() => import("./pages/Help"));
const FlashDeals = lazy(() => import("./pages/FlashDeals"));
const DeliveryZones = lazy(() => import("./pages/DeliveryZones"));
const CustomsDutyEstimator = lazy(() => import("./pages/CustomsDutyEstimator"));
const ReceiptVerify = lazy(() => import("./pages/ReceiptVerify"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function SupabaseConfigScreen() {
  return (
    <div className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 rounded-3xl border border-border bg-card p-8 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-primary">Deployment Setup</p>
          <h1 className="text-3xl font-semibold">Supabase environment variables are missing</h1>
          <p className="text-muted-foreground">
            This deployment cannot start because the Vercel project was built without the required
            Supabase configuration.
          </p>
        </div>

        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {supabaseConfigError}
        </div>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Add these environment variables in Vercel, then redeploy the project:</p>
          <div className="rounded-2xl border border-border bg-muted/40 p-4 font-mono text-foreground">
            {missingSupabaseEnvVars.map((variable) => (
              <div key={variable}>{variable}</div>
            ))}
          </div>
          <p>
            After redeploying, hard refresh the site once so any old cached service worker assets are
            replaced.
          </p>
        </div>
      </div>
    </div>
  );
}

function AppRouterContent() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <MaintenanceMode>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/products" element={<Products />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />
          <Route path="/my-orders" element={<MyOrders />} />
          <Route path="/group-buys" element={<GroupBuys />} />
          <Route path="/group-buy/:id" element={<GroupBuyDetail />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/admin/*" element={<Admin />} />
          <Route path="/track-order" element={<TrackOrder />} />
          <Route path="/track-order/:orderId" element={<TrackOrder />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/help" element={<Help />} />
          <Route path="/receipt/:receiptNumber" element={<ReceiptVerify />} />
          <Route path="/flash-deals" element={<FlashDeals />} />
          <Route path="/delivery-zones" element={<DeliveryZones />} />
          <Route path="/customs-estimator" element={<CustomsDutyEstimator />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      {!isAdminRoute && (
        <>
          <CompareBar />
          <MobileNavBar />
          <LiveChatWidget />
          <AbandonedCartReminder />
          <WelcomeModal />
          <CookieConsent />
        </>
      )}
    </MaintenanceMode>
  );
}

const App = () => {
  if (supabaseConfigError) {
    return <SupabaseConfigScreen />;
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <CartProvider>
              <CompareProvider>
                <ErrorBoundary>
                  <Toaster />
                  <Sonner />
                  <BrowserRouter
                    future={{
                      v7_startTransition: true,
                      v7_relativeSplatPath: true,
                    }}
                  >
                    <AppRouterContent />
                  </BrowserRouter>
                </ErrorBoundary>
              </CompareProvider>
            </CartProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
