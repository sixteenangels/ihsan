import { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Star, Truck, Users, Zap, Ship, Plane, Package, ShoppingCart, ArrowLeft, Loader2, Share2, Copy, Link as LinkIcon, Clock3, ShieldCheck } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useProduct, ProductWithDetails } from '@/hooks/useProducts';
import { useCart } from '@/contexts/CartContext';
import { ProductVariant, Product } from '@/types';
import { ProductReviews } from '@/components/products/ProductReviews';
import { RelatedProducts } from '@/components/products/RelatedProducts';
import { VariantSelector } from '@/components/products/VariantSelector';
import { ProductImageGallery } from '@/components/products/ProductImageGallery';
import { StartGroupBuyDialog } from '@/components/groupbuy/StartGroupBuyDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { RecentlyViewedProducts } from '@/components/products/RecentlyViewedProducts';
import { ProductQA } from '@/components/products/ProductQA';
import { FrequentlyBoughtTogether } from '@/components/products/FrequentlyBoughtTogether';
import { PriceDropAlert } from '@/components/products/PriceDropAlert';
import { BackInStockAlert } from '@/components/products/BackInStockAlert';
import { RestockReservationDialog } from '@/components/products/RestockReservationDialog';
import { useAuth } from '@/contexts/AuthContext';
import { trackRecommendationEvent } from '@/lib/recommendationEvents';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';

// Convert DB product to legacy Product type for cart
function toCartProduct(product: ProductWithDetails): Product {
  return {
    id: product.id,
    name: product.name,
    description: product.description || '',
    category: product.category_name || 'Uncategorized',
    basePrice: product.base_price,
    images: product.images.length > 0 ? product.images : ['https://via.placeholder.com/400'],
    variants: product.variants.map((v) => ({
      id: v.id,
      size: v.size || undefined,
      color: v.color || undefined,
      price: v.price,
      stock: v.stock || 0,
    })),
    shippingOptions: product.shipping_rules
      .filter((r) => r.is_allowed && r.shipping_class)
      .map((r) => ({
        id: r.id,
        type: (r.shipping_class?.shipping_type?.name?.toLowerCase().includes('sea')
          ? 'sea'
          : r.shipping_class?.shipping_type?.name?.toLowerCase().includes('express')
          ? 'air_express'
          : 'air_normal') as 'sea' | 'air_normal' | 'air_express',
        name: r.shipping_class?.name || '',
        details:
          r.shipping_class?.description || r.shipping_class?.shipping_type?.description || undefined,
        price: r.price,
        estimatedDays: r.shipping_class
          ? `${r.shipping_class.estimated_days_min}-${r.shipping_class.estimated_days_max} days`
          : '',
        available: true,
      })),
    isGroupBuyEligible: product.is_group_buy_eligible || false,
    isFlashDeal: product.is_flash_deal || false,
    isFreeShippingEligible: product.is_free_shipping || false,
    rating: product.rating || 0,
    reviewCount: product.review_count || 0,
  };
}

interface SelectedVariant {
  id: string;
  size: string | null;
  color: string | null;
  price: number;
  stock: number | null;
  quantity: number;
}

interface ShippingRule {
  id: string;
  shipping_class_id: string;
  price: number;
  is_allowed: boolean | null;
  shipping_class: {
    id: string;
    name: string;
    description: string | null;
    estimated_days_min: number;
    estimated_days_max: number;
    shipping_type: {
      id: string;
      name: string;
      description: string | null;
    } | null;
  } | null;
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: product, isLoading } = useProduct(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();
  const { addProduct } = useRecentlyViewed();
  const isMobile = useIsMobile();

  const [selectedVariants, setSelectedVariants] = useState<SelectedVariant[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingRule | null>(null);

  // Track recently viewed
  useEffect(() => {
    if (id) addProduct(id);
  }, [id, addProduct]);

  useEffect(() => {
    if (!product) {
      return;
    }

    trackRecommendationEvent({
      productId: product.id,
      userId: user?.id,
      eventType: 'view',
      source: 'product_detail',
    });
  }, [product, user?.id]);

  const handleVariantToggle = (variant: { id: string; size: string | null; color: string | null; price: number; stock: number | null }) => {
    const isSelected = selectedVariants.some((v) => v.id === variant.id);
    if (isSelected) {
      setSelectedVariants((prev) => prev.filter((v) => v.id !== variant.id));
    } else {
      setSelectedVariants((prev) => [...prev, { ...variant, quantity: 1 }]);
    }
  };

  const handleQuantityChange = (variantId: string, quantity: number) => {
    setSelectedVariants((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, quantity } : v))
    );
  };

  const totalPrice = useMemo(() => {
    return selectedVariants.reduce((sum, variant) => {
      return sum + variant.price * variant.quantity;
    }, 0);
  }, [selectedVariants]);

  const availableShipping = useMemo(
    () => product?.shipping_rules.filter((r) => r.is_allowed && r.shipping_class) || [],
    [product],
  );

  const totalAvailableStock = useMemo(
    () => product?.variants.reduce((sum, variant) => sum + Math.max(0, variant.stock || 0), 0) || 0,
    [product],
  );

  const hasAnyStock = totalAvailableStock > 0;
  const selectedVariantOutOfStock = selectedVariants.length === 1
    ? (selectedVariants[0].stock || 0) <= 0
    : false;
  const alertVariantId = selectedVariants.length === 1 ? selectedVariants[0].id : null;
  const showRestockAlert = selectedVariantOutOfStock || (!hasAnyStock && selectedVariants.length === 0);
  const reservationVariantLabel =
    selectedVariants.length === 1
      ? [selectedVariants[0].color, selectedVariants[0].size].filter(Boolean).join(' / ')
      : null;
  const highlightedShipping = selectedShipping || availableShipping[0] || null;
  const selectedItemCount = selectedVariants.reduce((sum, variant) => sum + variant.quantity, 0);

  const handleAddToCart = () => {
    if (!product) return;
    const cartProduct = toCartProduct(product);

    // If no variants chosen but the product has variants, add a placeholder so
    // the customer can choose at checkout.
    if (selectedVariants.length === 0) {
      addToCart(cartProduct, null, 1);
      trackRecommendationEvent({
        productId: product.id,
        userId: user?.id,
        eventType: 'cart_add',
        source: 'product_detail',
      });
      toast.success(product.variants.length > 0 ? 'Added to cart. Choose variant at checkout.' : 'Added to cart.');
      return;
    }

    selectedVariants.forEach((variant) => {
      const cartVariant: ProductVariant = {
        id: variant.id,
        size: variant.size || undefined,
        color: variant.color || undefined,
        price: variant.price,
        stock: variant.stock || 0,
      };
      addToCart(cartProduct, cartVariant, variant.quantity);
    });
    trackRecommendationEvent({
      productId: product.id,
      userId: user?.id,
      eventType: 'cart_add',
      source: 'product_detail',
      weight: selectedVariants.reduce((sum, variant) => sum + variant.quantity, 0),
    });
    toast.success(`Added ${selectedVariants.length} item(s) to cart`);
    setSelectedVariants([]);
  };

  const handleBuyNow = () => {
    if (!product) return;
    const cartProduct = toCartProduct(product);

    if (selectedVariants.length === 0) {
      addToCart(cartProduct, null, 1, 'only');
      trackRecommendationEvent({
        productId: product.id,
        userId: user?.id,
        eventType: 'cart_add',
        source: 'buy_now',
      });
    } else {
      selectedVariants.forEach((variant, index) => {
        const cartVariant: ProductVariant = {
          id: variant.id,
          size: variant.size || undefined,
          color: variant.color || undefined,
          price: variant.price,
          stock: variant.stock || 0,
        };
        addToCart(
          cartProduct,
          cartVariant,
          variant.quantity,
          index === 0 ? 'only' : 'include',
        );
      });
      trackRecommendationEvent({
        productId: product.id,
        userId: user?.id,
        eventType: 'cart_add',
        source: 'buy_now',
        weight: selectedVariants.reduce((sum, variant) => sum + variant.quantity, 0),
      });
    }

    navigate('/checkout');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied to clipboard!');
  };

  const handleShareWhatsApp = () => {
    if (!product) return;
    const text = `Check out ${product.name} on AJYN! ${formatPrice(product.base_price)} - ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const getShippingIcon = (typeName: string | undefined) => {
    if (!typeName) return <Plane className="h-5 w-5" />;
    const name = typeName.toLowerCase();
    if (name.includes('sea')) return <Ship className="h-5 w-5" />;
    if (name.includes('express')) return <Package className="h-5 w-5" />;
    return <Plane className="h-5 w-5" />;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container flex items-center justify-center px-3 py-16 pb-28 sm:px-6 md:pb-8">
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container px-3 py-12 pb-28 sm:px-6 md:py-16 md:pb-8">
          <div className="mx-auto max-w-md text-center">
            <h1 className="mb-4 text-2xl font-bold text-foreground">Product Not Found</h1>
            <p className="mb-6 text-muted-foreground">
              This item may have been removed or is no longer available.
            </p>
            <Link to="/products"><Button className="w-full sm:w-auto">Back to Products</Button></Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const expectedRestockDateLabel = product.expected_restock_date
    ? new Date(product.expected_restock_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;
  const groupBuySavings = product.group_buy_price != null && product.base_price > 0
    ? Math.max(0, Math.round(((product.base_price - product.group_buy_price) / product.base_price) * 100))
    : 0;
  const purchaseDisplayPrice = selectedVariants.length > 0 ? totalPrice : product.base_price;
  const selectedVariantPreview = selectedVariants.length > 0
    ? selectedVariants
        .slice(0, 2)
        .map((variant) => [variant.color, variant.size].filter(Boolean).join(' / ') || 'Standard')
        .join(', ')
    : product.variants.length > 0
      ? 'Choose variants now or finish selection at checkout.'
      : 'Standard configuration ready to order.';
  const shippingEtaLabel = highlightedShipping?.shipping_class
    ? `${highlightedShipping.shipping_class.estimated_days_min}-${highlightedShipping.shipping_class.estimated_days_max} days`
    : 'Shipping set at checkout';
  const purchaseSupportNote = selectedVariants.length > 0
    ? `${selectedItemCount} item${selectedItemCount === 1 ? '' : 's'} selected across ${selectedVariants.length} option${selectedVariants.length === 1 ? '' : 's'}.`
    : product.variants.length > 0
      ? 'Pick exact variants and sizes now for an exact total, or add first and confirm at checkout.'
      : 'Ready to add straight to cart with the current price and shipping options.';
  const stockStatusLabel = hasAnyStock
    ? `${totalAvailableStock} available now`
    : expectedRestockDateLabel
      ? `Expected restock ${expectedRestockDateLabel}`
      : 'Restock alerts available';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-3 py-5 pb-36 sm:px-6 md:py-8 md:pb-8">
        <Link to="/products" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Products
        </Link>

        <div className="grid gap-5 lg:grid-cols-2 lg:gap-12">
          <ProductImageGallery images={product.images} productName={product.name} />

          <div className="space-y-6">
            {/* Badges + Share */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {product.is_flash_deal && (
                  <Badge className="bg-destructive text-destructive-foreground">
                    <Zap className="h-3 w-3 mr-1" />
                    Flash Deal
                  </Badge>
                )}
                {product.is_group_buy_eligible && (
                  <Badge variant="secondary" className="bg-accent text-accent-foreground">
                    <Users className="h-3 w-3 mr-1" />
                    Group Buy Eligible
                  </Badge>
                )}
                {product.is_free_shipping && (
                  <Badge className="bg-primary text-primary-foreground">
                    <Truck className="h-3 w-3 mr-1" />
                    Free Shipping Available
                  </Badge>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="self-start">
                    <Share2 className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleCopyLink}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleShareWhatsApp}>
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Share on WhatsApp
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Start Group Buy Button */}
            {product.is_group_buy_eligible && (
              <div className="rounded-2xl border border-accent/20 bg-accent/10 p-3.5 sm:p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">Start a Group Buy</p>
                    <p className="text-sm text-muted-foreground">Lock in the group price and invite others to fill the target.</p>
                  </div>
                  <StartGroupBuyDialog product={{ id: product.id, name: product.name, base_price: product.base_price, group_buy_price: product.group_buy_price ?? null }} />
                </div>
              </div>
            )}

            {/* Title & Rating */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">{product.category_name || 'Uncategorized'}</p>
              <h1 className="mb-2 text-[1.65rem] font-bold font-serif leading-tight text-foreground sm:text-3xl">{product.name}</h1>
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  <Star className="h-5 w-5 fill-accent-foreground text-accent-foreground" />
                  <span className="ml-1 font-medium text-foreground">{product.rating || 0}</span>
                </div>
                <span className="text-muted-foreground">({product.review_count || 0} reviews)</span>
              </div>
            </div>

            <div>
              <p className="text-3xl font-bold text-primary">{formatPrice(product.base_price)}</p>
              <p className="text-sm text-muted-foreground mt-1">Starting from</p>
              {product.group_buy_price != null && product.group_buy_price < product.base_price && (
                <p className="text-sm text-primary mt-2">
                  Group buy price {formatPrice(product.group_buy_price)} available, saving {groupBuySavings}% when the group fills.
                </p>
              )}
            </div>

            <p className="text-sm leading-6 text-muted-foreground sm:text-base">{product.description}</p>

            <Card className="rounded-2xl border-primary/15 bg-primary/5 shadow-sm">
              <CardContent className="grid gap-4 p-3.5 sm:p-4 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Availability</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {hasAnyStock ? `${totalAvailableStock} unit(s) available across active variants` : 'Currently out of stock'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {hasAnyStock
                      ? 'Add to cart without locking the final shipping method. You can finish the choices at checkout.'
                      : 'Set a restock alert and we will notify you as soon as this item is available again.'}
                  </p>
                  {!hasAnyStock && expectedRestockDateLabel && (
                    <p className="mt-2 text-sm font-medium text-primary">
                      Expected restock: {expectedRestockDateLabel}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Delivery Window</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {highlightedShipping?.shipping_class
                      ? `${highlightedShipping.shipping_class.estimated_days_min}-${highlightedShipping.shipping_class.estimated_days_max} days`
                      : 'Shipping estimate set at checkout'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {highlightedShipping?.shipping_class?.description ||
                      highlightedShipping?.shipping_class?.shipping_type?.description ||
                      `${highlightedShipping?.shipping_class?.name || 'Choose your preferred shipping class'}.`}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Checkout Protection</p>
                  <p className="mt-1 font-semibold text-foreground">
                    Wallet credit, fragile packaging, and retry-safe checkout are available.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Payment interruptions keep your selected items in place so you can retry.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Select Options</h3>
              {product.variants.length === 0 ? (
                <p className="text-sm text-muted-foreground">No variants available</p>
              ) : (
                <VariantSelector
                  variants={product.variants}
                  selectedVariants={selectedVariants}
                  onVariantToggle={handleVariantToggle}
                  onQuantityChange={handleQuantityChange}
                />
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Shipping Options</h3>
              {availableShipping.length === 0 ? (
                <p className="text-sm text-muted-foreground">No shipping options available</p>
              ) : (
                <div className="space-y-3">
                  {availableShipping.map((option) => (
                    <Card
                      key={option.id}
                      className={`cursor-pointer rounded-2xl border-border/70 shadow-sm transition-all hover:border-primary/50 ${
                        selectedShipping?.id === option.id ? 'border-primary' : ''
                      }`}
                      onClick={() => setSelectedShipping(option)}
                    >
                      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl bg-primary/10 p-2 text-primary">
                            {getShippingIcon(option.shipping_class?.shipping_type?.name)}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{option.shipping_class?.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {option.shipping_class?.estimated_days_min}-{option.shipping_class?.estimated_days_max} days
                            </p>
                            {(option.shipping_class?.description ||
                              option.shipping_class?.shipping_type?.description) && (
                              <p className="text-sm text-muted-foreground">
                                {option.shipping_class?.description ||
                                  option.shipping_class?.shipping_type?.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <p className="pl-11 text-sm font-semibold text-primary sm:pl-0">{formatPrice(option.price)}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <Card className="overflow-hidden rounded-2xl border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary/80">
                          Purchase Snapshot
                        </p>
                        <p className="mt-2 text-3xl font-bold text-primary">
                          {formatPrice(purchaseDisplayPrice)}
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">{purchaseSupportNote}</p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {selectedVariantPreview}
                          {selectedVariants.length > 2 ? ` +${selectedVariants.length - 2} more` : ''}
                        </p>
                      </div>

                      <div className="hidden w-full max-w-xs flex-col gap-3 sm:flex">
                        <Button size="lg" className="w-full" variant="outline" onClick={handleAddToCart}>
                          <ShoppingCart className="h-5 w-5 mr-2" />
                          Add to Cart
                        </Button>
                        <Button size="lg" className="w-full" onClick={handleBuyNow}>
                          <Zap className="h-5 w-5 mr-2" />
                          Buy Now
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Selected</p>
                        <p className="mt-1 font-semibold text-foreground">
                          {selectedVariants.length > 0
                            ? `${selectedItemCount} item${selectedItemCount === 1 ? '' : 's'}`
                            : product.variants.length > 0
                              ? 'Pending choice'
                              : 'Ready now'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock3 className="h-4 w-4" />
                          <p className="text-xs uppercase tracking-[0.18em]">Delivery</p>
                        </div>
                        <p className="mt-1 font-semibold text-foreground">{shippingEtaLabel}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <ShieldCheck className="h-4 w-4" />
                          <p className="text-xs uppercase tracking-[0.18em]">Confidence</p>
                        </div>
                        <p className="mt-1 font-semibold text-foreground">{stockStatusLabel}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-wrap gap-2">
                <PriceDropAlert
                  productId={product.id}
                  productName={product.name}
                  currentPrice={product.base_price}
                />
                <BackInStockAlert
                  productId={product.id}
                  productName={product.name}
                  variantId={alertVariantId}
                  isOutOfStock={showRestockAlert}
                />
                {showRestockAlert ? (
                  <RestockReservationDialog
                    productId={product.id}
                    productName={product.name}
                    expectedRestockDate={product.expected_restock_date}
                    productVariantId={alertVariantId}
                    variantLabel={reservationVariantLabel}
                  />
                ) : null}
                {showRestockAlert && expectedRestockDateLabel && (
                  <p className="w-full text-sm text-muted-foreground">
                    We are currently expecting more stock around {expectedRestockDateLabel}.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Frequently Bought Together */}
        <FrequentlyBoughtTogether productId={product.id} />

        <div className="mt-10 space-y-8 sm:mt-12">
          <ProductReviews productId={product.id} productName={product.name} />
          <ProductQA productId={product.id} />
        </div>

        {/* Related Products */}
        <RelatedProducts productId={product.id} categoryId={product.category_id} />

        {/* Recently Viewed */}
        <RecentlyViewedProducts currentProductId={product.id} />
      </main>

      {isMobile && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-2">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-[1.35rem] border border-border/80 bg-background/95 px-3 pt-3 shadow-[0_18px_44px_-22px_hsl(var(--foreground)/0.75)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/90">
            <div className="min-w-0 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Ready to buy</p>
              <p className="text-lg font-semibold text-foreground">
                {formatPrice(purchaseDisplayPrice)}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {selectedVariants.length > 0
                  ? `${selectedItemCount} selected`
                  : product.variants.length > 0
                    ? 'Choose now or at checkout'
                    : 'Standard configuration'}
                {' - '}
                {shippingEtaLabel}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
              <Button size="sm" variant="outline" className="rounded-xl" onClick={handleAddToCart}>
                <ShoppingCart className="mr-1 h-4 w-4" />
                Add
              </Button>
              <Button size="sm" className="rounded-xl" onClick={handleBuyNow}>
                <Zap className="mr-1 h-4 w-4" />
                Buy
              </Button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
