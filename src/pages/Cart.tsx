import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { isVariantPlaceholder, useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/hooks/useCurrency';
import type { CartItem, Product, ProductVariant } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

function getVariantLabel(variant: ProductVariant) {
  const parts = [variant.color, variant.size].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : 'Standard option';
}

function createPlaceholderVariant(product: Product): ProductVariant {
  return {
    id: `__novariant__${product.id}`,
    color: undefined,
    size: undefined,
    price: product.basePrice,
    stock: 0,
  };
}

interface ProductGroup {
  product: Product;
  items: CartItem[];
}

export default function Cart() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const {
    items,
    selectedItems,
    selectedItemIds,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateVariant,
    clearCart,
  } = useCart();
  const [variantDialogProductId, setVariantDialogProductId] = useState<string | null>(null);

  const duplicatePlaceholderIds = useMemo(() => {
    const itemsByProduct = new Map<string, CartItem[]>();

    items.forEach((item) => {
      const existingItems = itemsByProduct.get(item.product.id) || [];
      existingItems.push(item);
      itemsByProduct.set(item.product.id, existingItems);
    });

    return Array.from(itemsByProduct.values()).flatMap((productItems) => {
      const hasResolvedVariant = productItems.some(
        (item) => !isVariantPlaceholder(item.variant.id),
      );

      if (!hasResolvedVariant) {
        return [];
      }

      return productItems
        .filter((item) => isVariantPlaceholder(item.variant.id))
        .map((item) => item.id);
    });
  }, [items]);

  const duplicatePlaceholderIdSet = useMemo(
    () => new Set(duplicatePlaceholderIds),
    [duplicatePlaceholderIds],
  );

  const visibleItems = useMemo(
    () => items.filter((item) => !duplicatePlaceholderIdSet.has(item.id)),
    [duplicatePlaceholderIdSet, items],
  );

  const visibleSelectedItems = useMemo(
    () => selectedItems.filter((item) => !duplicatePlaceholderIdSet.has(item.id)),
    [duplicatePlaceholderIdSet, selectedItems],
  );

  const visibleSelectedItemIds = useMemo(
    () => selectedItemIds.filter((itemId) => !duplicatePlaceholderIdSet.has(itemId)),
    [duplicatePlaceholderIdSet, selectedItemIds],
  );

  useEffect(() => {
    if (duplicatePlaceholderIds.length === 0) {
      return;
    }

    duplicatePlaceholderIds.forEach((itemId) => removeFromCart(itemId));
  }, [duplicatePlaceholderIds, removeFromCart]);

  const groupedProducts = useMemo(() => {
    const groups = new Map<string, ProductGroup>();

    visibleItems.forEach((item) => {
      const existingGroup = groups.get(item.product.id);
      if (existingGroup) {
        existingGroup.items.push(item);
        return;
      }

      groups.set(item.product.id, {
        product: item.product,
        items: [item],
      });
    });

    return Array.from(groups.values());
  }, [visibleItems]);

  const selectedQuantityCount = visibleSelectedItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const checkoutSubtotal =
    visibleSelectedItemIds.length > 0
      ? visibleSelectedItems.reduce(
          (sum, item) => sum + item.variant.price * item.quantity,
          0,
        )
      : 0;
  const activeGroup =
    groupedProducts.find((group) => group.product.id === variantDialogProductId) || null;

  const handleCheckout = () => {
    if (visibleSelectedItemIds.length === 0) {
      toast.error('Select at least one item to continue');
      return;
    }

    navigate('/checkout');
  };

  const handleRemoveProduct = (productId: string) => {
    const matchingItemIds = visibleItems
      .filter((item) => item.product.id === productId)
      .map((item) => item.id);

    matchingItemIds.forEach((itemId) => removeFromCart(itemId));
  };

  const handleAddVariant = (group: ProductGroup, variant: ProductVariant) => {
    const unresolvedItem = group.items.find((item) => isVariantPlaceholder(item.variant.id));

    if (unresolvedItem) {
      updateVariant(unresolvedItem.id, variant);
    } else {
      addToCart(group.product, variant, 1, 'include');
    }

    setVariantDialogProductId(null);
  };

  const handleClearVariantSelection = (group: ProductGroup, item: CartItem) => {
    if (group.items.length === 1) {
      updateVariant(item.id, createPlaceholderVariant(group.product));
      return;
    }

    removeFromCart(item.id);
  };

  if (visibleItems.length === 0) {
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
      <main className="container px-3 py-4 pb-28 sm:px-6 md:py-8 md:pb-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 border-b border-border/60 pb-4">
            <h1 className="text-2xl font-bold text-foreground">
              Your Cart ({groupedProducts.length})
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review your items and complete your order
            </p>
          </div>

          <div className="space-y-4">
            {groupedProducts.map((group) => {
              const variantCount = group.items.length;

              return (
                <Card
                  key={group.product.id}
                  className="overflow-hidden rounded-[1.4rem] border border-border/70 bg-card shadow-sm"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-muted">
                        <img
                          src={group.product.images[0] || '/placeholder.svg'}
                          alt={group.product.name}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="line-clamp-2 text-lg font-semibold leading-tight text-foreground">
                              {group.product.name}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Base price: {formatPrice(group.product.basePrice)}
                            </p>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveProduct(group.product.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">Selected Variants</p>
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          {variantCount} variant{variantCount === 1 ? '' : 's'}
                        </span>
                      </div>

                      {group.product.variants.length > 0 ? (
                        <button
                          type="button"
                          className="text-sm font-medium text-primary"
                          onClick={() => setVariantDialogProductId(group.product.id)}
                        >
                          + Add another variant
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-3 space-y-3">
                      {group.items.map((item) => {
                        const needsVariant = isVariantPlaceholder(item.variant.id);

                        return (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-border/70 bg-background/60 p-3"
                          >
                            <div className="flex items-start gap-3">
                              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                                <img
                                  src={item.product.images[0] || '/placeholder.svg'}
                                  alt={item.product.name}
                                  className="h-full w-full object-cover"
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <h3 className="line-clamp-1 text-sm font-semibold text-foreground">
                                      {needsVariant ? 'Variant not selected' : getVariantLabel(item.variant)}
                                    </h3>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                      {item.variant.size || item.variant.color || 'Standard option'}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {formatPrice(item.variant.price)} each
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    className="mt-1 shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                                    onClick={() => handleClearVariantSelection(group, item)}
                                    aria-label={`Remove ${getVariantLabel(item.variant)}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>

                                {needsVariant ? (
                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <p className="text-xs font-medium text-destructive">
                                      Choose a variant to continue
                                    </p>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-9 rounded-xl"
                                      onClick={() => setVariantDialogProductId(group.product.id)}
                                    >
                                      Select variant
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="mt-3 flex items-end justify-between gap-3">
                                    <div className="flex items-center gap-2 rounded-xl border border-border/70 px-2 py-1">
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 rounded-lg"
                                        onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                      >
                                        <Minus className="h-4 w-4" />
                                      </Button>
                                      <span className="w-6 text-center text-sm font-semibold text-foreground">
                                        {item.quantity}
                                      </span>
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 rounded-lg"
                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    </div>

                                    <p className="text-sm font-semibold text-primary">
                                      {formatPrice(item.variant.price * item.quantity)}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="mt-4 overflow-hidden rounded-[1.4rem] border border-border/70 bg-card shadow-sm">
            <CardContent className="p-0">
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Subtotal ({selectedQuantityCount} item{selectedQuantityCount === 1 ? '' : 's'})
                  </span>
                  <span className="text-foreground">{formatPrice(checkoutSubtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="text-muted-foreground">Calculated at checkout</span>
                </div>
                <div className="h-px bg-border/70" />
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-foreground">Total</span>
                  <span className="text-3xl font-bold text-primary">
                    {formatPrice(checkoutSubtotal)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-xl border-primary/40 text-primary"
              onClick={clearCart}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear Cart
            </Button>
            <Button
              type="button"
              className="h-12 rounded-xl"
              onClick={handleCheckout}
            >
              Proceed to Checkout
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>

      <Dialog open={!!activeGroup} onOpenChange={(open) => setVariantDialogProductId(open ? variantDialogProductId : null)}>
        <DialogContent className="max-w-md bg-background">
          <DialogHeader>
            <DialogTitle>Add another variant</DialogTitle>
          </DialogHeader>

          {activeGroup ? (
            <div className="space-y-3">
              {activeGroup.product.variants.length > 0 ? (
                activeGroup.product.variants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-2xl border border-border/70 px-4 py-3 text-left transition-colors hover:border-primary/40"
                    disabled={variant.stock <= 0}
                    onClick={() => handleAddVariant(activeGroup, variant)}
                  >
                    <div>
                      <p className="font-medium text-foreground">{getVariantLabel(variant)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatPrice(variant.price)} {variant.stock > 0 ? `- ${variant.stock} in stock` : '- Out of stock'}
                      </p>
                    </div>
                    <Plus className="h-4 w-4 text-primary" />
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No additional variants are available for this product.
                </p>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
