import { Link, useNavigate } from 'react-router-dom';
import {
  Trash2,
  Minus,
  Plus,
  ArrowLeft,
  ShoppingBag,
  Cloud,
  CloudOff,
  CheckCircle2,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { isVariantPlaceholder, useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/hooks/useCurrency';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ResumeCheckoutBanner } from '@/components/checkout/ResumeCheckoutBanner';
import { RecommendedProductsSection } from '@/components/products/RecommendedProductsSection';
import { toast } from 'sonner';

export default function Cart() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const {
    items,
    selectedItemIds,
    removeFromCart,
    updateQuantity,
    toggleItemSelection,
    setSelectedItemIds,
    clearCart,
    subtotal,
    selectedSubtotal,
    cartSyncState,
    lastSyncedAt,
    localOnlyItemCount,
  } = useCart();

  const handleCheckout = () => {
    if (selectedItemIds.length === 0) {
      toast.error('Select at least one item to continue');
      return;
    }

    navigate('/checkout');
  };

  const allSelected = items.length > 0 && selectedItemIds.length === items.length;
  const showSyncNotice = cartSyncState !== 'local' || localOnlyItemCount > 0;
  const SyncIcon =
    cartSyncState === 'synced'
      ? CheckCircle2
      : cartSyncState === 'error'
        ? CloudOff
        : Cloud;
  const syncTitle =
    cartSyncState === 'synced'
      ? 'Cart saved to your account'
      : cartSyncState === 'error'
        ? 'Cart sync is temporarily unavailable'
        : 'Cart saved on this device';
  const syncDescription =
    cartSyncState === 'synced'
      ? 'Your saved items can be restored when you sign in on another device.'
      : cartSyncState === 'error'
        ? 'Your items are still safe on this device, but account sync could not finish just now.'
        : 'Your cart is stored locally and will stay here while you continue shopping.';

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container px-3 py-12 pb-28 sm:px-6 md:py-16 md:pb-8">
          <div className="mx-auto max-w-md text-center">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-border bg-card p-6">
              <ShoppingBag className="h-12 w-12 text-muted-foreground" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-foreground">
              Your cart is empty
            </h1>
            <p className="mb-6 text-muted-foreground">
              Discover amazing products from around the world
            </p>
            <Link to="/products">
              <Button size="lg" className="w-full sm:w-auto">Start Shopping</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-3 py-6 pb-28 sm:px-6 md:py-8 md:pb-8">
        <Link
          to="/products"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Continue Shopping
        </Link>

        <h1 className="mb-6 text-2xl font-bold font-serif text-foreground md:mb-8 md:text-3xl">
          Shopping Cart
        </h1>

        <div className="mb-6">
          <ResumeCheckoutBanner />
        </div>

        {showSyncNotice ? (
          <Alert className="mb-6 border-border bg-card/70">
            <SyncIcon className="h-4 w-4" />
            <AlertTitle>{syncTitle}</AlertTitle>
            <AlertDescription className="space-y-1">
              <p>{syncDescription}</p>
              {lastSyncedAt ? (
                <p className="text-xs text-muted-foreground">
                  Last synced {new Date(lastSyncedAt).toLocaleString()}
                </p>
              ) : null}
              {localOnlyItemCount > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {localOnlyItemCount} item{localOnlyItemCount === 1 ? '' : 's'} still need a
                  final variant choice before they can sync across devices.
                </p>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden rounded-2xl border-border/70 bg-card shadow-sm">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex gap-3 sm:gap-4">
                    <div className="pt-1">
                      <Checkbox
                        checked={selectedItemIds.includes(item.id)}
                        onCheckedChange={() => toggleItemSelection(item.id)}
                        aria-label={`Select ${item.product.name}`}
                      />
                    </div>
                    <div className="h-[4.5rem] w-[4.5rem] flex-shrink-0 overflow-hidden rounded-xl bg-muted sm:h-24 sm:w-24">
                      <img
                        src={item.product.images[0]}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground sm:text-base">
                            {item.product.name}
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                            {isVariantPlaceholder(item.variant.id)
                              ? 'Variant will be selected at checkout'
                              : [item.variant.color, item.variant.size].filter(Boolean).join(' - ') || 'Standard option'}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-medium text-foreground">
                            {item.quantity}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-sm font-semibold text-primary sm:text-base">
                          {formatPrice(item.variant.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() =>
                  setSelectedItemIds(allSelected ? [] : items.map((item) => item.id))
                }
              >
                {allSelected ? 'Unselect All' : 'Select All'}
              </Button>
              <Button
                variant="outline"
                className="w-full text-muted-foreground sm:w-auto"
                onClick={clearCart}
              >
                Clear Cart
              </Button>
            </div>
          </div>

          <div className="lg:col-span-1">
            <Card className="rounded-2xl border-border/70 bg-card shadow-sm lg:sticky lg:top-24">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cart subtotal</span>
                    <span className="text-foreground">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Selected for checkout</span>
                    <span className="text-foreground">
                      {selectedItemIds.length} item{selectedItemIds.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-semibold text-foreground">Selected subtotal</span>
                    <span className="text-xl font-bold text-primary">
                      {formatPrice(selectedSubtotal)}
                    </span>
                  </div>
                </div>

                <Button
                  className="h-11 w-full rounded-xl"
                  size="lg"
                  onClick={handleCheckout}
                >
                  Proceed to Checkout
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Shipping and any missing variant choices will be completed at checkout
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-10">
          <RecommendedProductsSection
            title="Add a few smart extras"
            description="These picks lean toward the same categories, delivery style, and value range already in your cart."
            seedProductIds={items.map((item) => item.product.id)}
            excludeProductIds={items.map((item) => item.product.id)}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}
