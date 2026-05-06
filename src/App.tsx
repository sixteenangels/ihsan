import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import { ThemeProvider } from "next-themes";
import { lazy, Suspense } from "react";
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
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

const App = () => (
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
                        <Route path="/flash-deals" element={<FlashDeals />} />
                        <Route path="/delivery-zones" element={<DeliveryZones />} />
                        <Route path="/customs-estimator" element={<CustomsDutyEstimator />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                    <CompareBar />
                    <MobileNavBar />
                    <LiveChatWidget />
                    <AbandonedCartReminder />
                    <WelcomeModal />
                    <CookieConsent />
                  </MaintenanceMode>
                </BrowserRouter>
              </ErrorBoundary>
            </CompareProvider>
          </CartProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
