import { Link, useNavigate } from 'react-router-dom';
import { Check, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { isVariantPlaceholder, useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/hooks/useCurrency';
import type { ProductVariant } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

function getVariantLabel(variant: ProductVariant) {
  const parts = [variant.color, variant.size].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : 'Standard option';
}

export default function Cart() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const {
    items,
    selectedItemIds,
    removeFromCart,
    updateQuantity,
    updateVariant,
    toggleItemSelection,
    setSelectedItemIds,
    clearCart,
    selectedSubtotal,
  } = useCart();

  const unresolvedItems = items.filter((item) => isVariantPlaceholder(item.variant.id));
  const allSelected = items.length > 0 && selectedItemIds.length === items.length;
  const checkoutSubtotal = selectedItemIds.length > 0 ? selectedSubtotal : 0;

  const handleCheckout = () => {
    if (selectedItemIds.length === 0) {
      toast.error('Select at least one item to continue');
      return;
    }

    navigate('/checkout');
  };

  const handleResolveVariants = () => {
    const firstUnresolvedItem = unresolvedItems[0];
    if (!firstUnresolvedItem) return;

    document
      .getElementById(`cart-item-${firstUnresolvedItem.id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

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
      <main className="container px-3 py-6 pb-28 sm:px-6 md:py-8 md:pb-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-5 border-b border-border/60 pb-4">
            <h1 className="text-2xl font-bold text-foreground">
              Your Cart ({items.length})
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review your items and complete your order
            </p>
          </div>

          {unresolvedItems.length > 0 ? (
            <Card className="mb-4 rounded-2xl border border-amber-500/30 bg-card shadow-sm">
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {unresolvedItems.length} item{unresolvedItems.length === 1 ? '' : 's'} need{' '}
                    variant selection
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Select variants so we can sync your cart across devices.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 shrink-0 rounded-xl border-amber-500/40 px-4 text-primary"
                  onClick={handleResolveVariants}
                >
                  Resolve
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <div className="space-y-4">
            {items.map((item) => {
              const variantOptions = item.product.variants || [];
              const hasSelectableVariants = variantOptions.length > 0;
              const selectedVariantId = isVariantPlaceholder(item.variant.id)
                ? undefined
                : item.variant.id;

              return (
                <Card
                  key={item.id}
                  id={`cart-item-${item.id}`}
                  className="overflow-hidden rounded-[1.4rem] border border-border/70 bg-card shadow-sm"
                >
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        aria-pressed={selectedItemIds.includes(item.id)}
                        aria-label={`Select ${item.product.name}`}
                        onClick={() => toggleItemSelection(item.id)}
                        className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          selectedItemIds.includes(item.id)
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-transparent'
                        }`}
                      >
                        <Check className="h-3 w-3" />
                      </button>

                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-muted">
                        <img
                          src={item.product.images[0] || '/placeholder.svg'}
                          alt={item.product.name}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
                              {item.product.name}
                            </h2>
                            <p
                              className={`mt-1 text-sm ${
                                isVariantPlaceholder(item.variant.id)
                                  ? 'font-medium text-destructive'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {isVariantPlaceholder(item.variant.id)
                                ? 'Variant: Not selected'
                                : `Variant: ${getVariantLabel(item.variant)}`}
                            </p>
                            <p className="mt-2 text-xl font-semibold text-primary">
                              {formatPrice(item.variant.price * item.quantity)}
                            </p>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="mt-4 space-y-3">
                          <Select
                            value={selectedVariantId}
                            onValueChange={(variantId) => {
                              const variant = variantOptions.find((option) => option.id === variantId);
                              if (!variant) return;

                              updateVariant(item.id, variant);
                            }}
                            disabled={!hasSelectableVariants}
                          >
                            <SelectTrigger className="h-11 rounded-xl border-border/70 bg-background px-4 text-left">
                              <SelectValue
                                placeholder={
                                  hasSelectableVariants
                                    ? 'Select variant'
                                    : 'No variants available'
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {variantOptions.map((variant) => (
                                <SelectItem
                                  key={variant.id}
                                  value={variant.id}
                                  disabled={variant.stock <= 0}
                                >
                                  {getVariantLabel(variant)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <div className="flex items-center gap-3">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-10 w-10 rounded-xl border-border/70 bg-background"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center text-base font-medium text-foreground">
                              {item.quantity}
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-10 w-10 rounded-xl border-border/70 bg-background"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-4 space-y-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl border-border/70 bg-card"
              onClick={() => setSelectedItemIds(allSelected ? [] : items.map((item) => item.id))}
            >
              {allSelected ? 'Unselect All' : 'Select All'}
            </Button>
            <Button
              type="button"
              className="h-11 w-full rounded-xl"
              onClick={clearCart}
            >
              Clear Cart
            </Button>
          </div>

          <Card className="mt-5 rounded-[1.4rem] border border-border/70 bg-card shadow-sm">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cart subtotal</span>
                  <span className="text-foreground">{formatPrice(checkoutSubtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="text-muted-foreground">Calculated at checkout</span>
                </div>
                <div className="h-px bg-border/70" />
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-foreground">Total</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatPrice(checkoutSubtotal)}
                  </span>
                </div>
                {selectedItemIds.length !== items.length ? (
                  <p className="text-xs text-muted-foreground">
                    Total reflects selected items only.
                  </p>
                ) : null}
              </div>

              <Button
                type="button"
                className="mt-5 h-12 w-full rounded-xl"
                size="lg"
                onClick={handleCheckout}
              >
                Proceed to Checkout
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
