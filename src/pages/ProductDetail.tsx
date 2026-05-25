import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Ellipsis,
  Link as LinkIcon,
  Loader2,
  Minus,
  Package,
  Plane,
  Plus,
  Search,
  Share2,
  Ship,
  ShoppingCart,
  Star,
  Trash2,
  Truck,
  Users,
  Zap,
} from 'lucide-react';
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
import { JoinGroupBuyDialog } from '@/components/groupbuy/JoinGroupBuyDialog';
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
import { BuyNowSheet } from '@/components/products/BuyNowSheet';
import { useAuth } from '@/contexts/AuthContext';
import { trackRecommendationEvent } from '@/lib/recommendationEvents';
import { useProductActiveGroupBuys } from '@/hooks/useProductActiveGroupBuys';
import { formatGroupBuyTimeRemaining } from '@/lib/groupBuyTiming';
import { useGroupBuySettings } from '@/hooks/useGroupBuySettings';
import { formatGroupBuyDuration } from '@/lib/groupBuyConfig';
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
      image_url: v.image_url || null,
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
  image_url?: string | null;
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

function getVariantSummaryLabel(variant: { color: string | null; size: string | null }) {
  return [variant.color, variant.size].filter(Boolean).join(' / ') || 'Standard option';
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { data: product, isLoading } = useProduct(id);
  const { user } = useAuth();
  const { addToCart, totalItems } = useCart();
  const { formatPrice } = useCurrency();
  const { addProduct } = useRecentlyViewed();
  const { settings: groupBuySettings } = useGroupBuySettings();
  const isMobile = useIsMobile();

  const [selectedVariants, setSelectedVariants] = useState<SelectedVariant[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingRule | null>(null);
  const [desktopPreviewVariantId, setDesktopPreviewVariantId] = useState<string | null>(null);
  const [mobileVariantId, setMobileVariantId] = useState<string | null>(null);
  const [activeMobileImageIndex, setActiveMobileImageIndex] = useState(0);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const mobileGalleryRef = useRef<HTMLDivElement | null>(null);
  const preferredGroupBuyId = searchParams.get('groupBuy');

  const { data: activeProductGroupBuys = [] } = useProductActiveGroupBuys({
    productId: id,
    userId: user?.id,
  });

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

  const handleAddVariantSelection = (variant: { id: string; size: string | null; color: string | null; price: number; stock: number | null; image_url?: string | null }, quantity: number) => {
    const normalizedQuantity = Math.max(1, quantity);
    const existingSelection = selectedVariants.find((selectedVariant) => selectedVariant.id === variant.id);

    if (existingSelection) {
      handleQuantityChange(variant.id, normalizedQuantity);
      return;
    }

    setSelectedVariants((prev) => [...prev, { ...variant, quantity: normalizedQuantity }]);
  };

  const handleQuantityChange = (variantId: string, quantity: number) => {
    setSelectedVariants((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, quantity } : v))
    );
  };

  const handleRemoveSelectedVariant = (variantId: string) => {
    setSelectedVariants((prev) => prev.filter((variant) => variant.id !== variantId));
  };

  const handleClearSelectedVariants = () => {
    setSelectedVariants([]);
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
  const defaultMobileVariant = useMemo(
    () => product?.variants.find((variant) => (variant.stock || 0) > 0) || product?.variants[0] || null,
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

  useEffect(() => {
    if (!product) {
      return;
    }

    setMobileVariantId((current) =>
      current && product.variants.some((variant) => variant.id === current)
        ? current
        : defaultMobileVariant?.id || null,
    );
  }, [defaultMobileVariant, product]);

  const mobileActiveVariant = useMemo(() => {
    if (!product) {
      return null;
    }

    return (
      product.variants.find((variant) => variant.id === mobileVariantId) ||
      defaultMobileVariant ||
      null
    );
  }, [defaultMobileVariant, mobileVariantId, product]);

  const desktopPreviewVariant = useMemo(() => {
    if (!product) {
      return null;
    }

    return product.variants.find((variant) => variant.id === desktopPreviewVariantId) || null;
  }, [desktopPreviewVariantId, product]);

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
        image_url: variant.image_url || null,
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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied to clipboard!');
  };

  const handleShareWhatsApp = () => {
    if (!product) return;
    const text = `Check out ${product.name} on AJYN! ${formatPrice(product.base_price)} - ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleMobileShare = async () => {
    if (!product) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `Check out ${product.name} on AJYN!`,
          url: window.location.href,
        });
        return;
      } catch {
        return;
      }
    }

    handleCopyLink();
  };

  const handlePreviewImage = () => {
    const image = galleryImages[activeMobileImageIndex] || heroImage;
    if (!image) return;
    window.open(image, '_blank', 'noopener,noreferrer');
  };

  const handleMobileGalleryScroll = () => {
    const container = mobileGalleryRef.current;
    if (!container || container.clientWidth === 0) return;

    const nextIndex = Math.round(container.scrollLeft / container.clientWidth);
    setActiveMobileImageIndex(Math.min(Math.max(nextIndex, 0), Math.max(0, galleryImages.length - 1)));
  };

  const resetMobileGallery = () => {
    setActiveMobileImageIndex(0);
    mobileGalleryRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
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
  const mobilePreviewUnitPrice = mobileActiveVariant?.price ?? product.base_price;
  const previewShippingCost =
    product.is_free_shipping || !highlightedShipping ? 0 : Number(highlightedShipping.price || 0);
  const mobileEstimatedTotal =
    (selectedVariants.length > 0 ? totalPrice : mobilePreviewUnitPrice) + previewShippingCost;
  const preferredProductGroupBuy = activeProductGroupBuys.find((groupBuy) => groupBuy.id === preferredGroupBuyId) || null;
  const joinedProductGroupBuy = activeProductGroupBuys.find((groupBuy) => groupBuy.viewer_has_joined) || null;
  const activeProductGroupBuy = preferredProductGroupBuy || joinedProductGroupBuy || activeProductGroupBuys[0] || null;
  const hasLiveProductGroupBuy = activeProductGroupBuys.length > 0;
  const descriptionText = product.description?.trim() || '';
  const hasLongDescription = descriptionText.length > 180;
  const previewVariant = isMobile ? mobileActiveVariant : desktopPreviewVariant;
  const heroImage = previewVariant?.image_url || selectedVariants[0]?.image_url || product.images[0] || '/placeholder.svg';
  const galleryImages = heroImage
    ? [heroImage, ...product.images.filter((image) => image !== heroImage)]
    : product.images;
  const groupBuyPanel = product.is_group_buy_eligible ? (
    isMobile ? (
      <div className="rounded-[1.45rem] border border-border/70 bg-card/80 p-3.5 shadow-sm">
        <div className="grid grid-cols-[minmax(0,1fr),auto] items-start gap-2.5">
          <div className="row-span-2 flex min-w-0 items-start gap-3 rounded-[1.15rem] bg-background/70 p-3">
            <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Start a Group Buy</p>
              <p className="mt-1 text-[11px] leading-[18px] text-muted-foreground">
                Lock in the group price for {formatGroupBuyDuration(groupBuySettings.countdownDurationValue, groupBuySettings.countdownDurationUnit)} and invite others to fill the target.
              </p>
              {activeProductGroupBuy ? (
                <p className="mt-1 text-[11px] text-primary">
                  Live group ends {formatGroupBuyTimeRemaining(activeProductGroupBuy.expires_at)}.
                </p>
              ) : null}
            </div>
          </div>
          <StartGroupBuyDialog
            triggerClassName="h-10 min-w-[126px] overflow-hidden rounded-xl px-4 text-xs font-semibold"
            product={{ id: product.id, name: product.name, base_price: product.base_price, group_buy_price: product.group_buy_price ?? null }}
          />
          {activeProductGroupBuy ? (
            <JoinGroupBuyDialog
              disableDialogWhenJoined
              triggerLabel="Join Existing"
              joinedLabel="Joined"
              triggerClassName="h-9 min-w-[126px] overflow-hidden rounded-xl border-border/70 bg-background/70 text-xs font-medium"
              groupBuy={{
                id: activeProductGroupBuy.id,
                product_id: activeProductGroupBuy.product_id,
                min_participants: activeProductGroupBuy.min_participants,
                max_participants: activeProductGroupBuy.max_participants,
                current_participants: activeProductGroupBuy.current_participants,
                discount_percentage: activeProductGroupBuy.discount_percentage,
                group_price: activeProductGroupBuy.group_price,
                expires_at: activeProductGroupBuy.expires_at,
                settings: activeProductGroupBuy.settings,
                status: activeProductGroupBuy.status,
                product: {
                  name: product.name,
                  base_price: product.base_price,
                },
                tiers: activeProductGroupBuy.tiers,
              }}
            />
          ) : (
            <Button variant="outline" className="h-9 min-w-[126px] overflow-hidden rounded-xl border-border/70 bg-background/70 text-xs font-medium" disabled={!hasLiveProductGroupBuy}>
              <Users className="mr-1.5 h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Join Existing</span>
            </Button>
          )}
        </div>
      </div>
    ) : (
      <div className="rounded-[1.5rem] border border-accent/20 bg-accent/10 p-4">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="font-medium text-foreground">Start a Group Buy</p>
            <p className="text-sm text-muted-foreground">
              Lock in the group price for {formatGroupBuyDuration(groupBuySettings.countdownDurationValue, groupBuySettings.countdownDurationUnit)} and invite others to fill the target.
            </p>
            {activeProductGroupBuy ? (
              <p className="text-xs text-primary">
                An open group is already live for this item. {formatGroupBuyTimeRemaining(activeProductGroupBuy.expires_at)}.
              </p>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <StartGroupBuyDialog
              triggerClassName="h-11 w-full min-w-0 overflow-hidden rounded-2xl"
              product={{ id: product.id, name: product.name, base_price: product.base_price, group_buy_price: product.group_buy_price ?? null }}
            />
            {activeProductGroupBuy ? (
              <JoinGroupBuyDialog
                disableDialogWhenJoined
                triggerLabel="Join Existing"
                joinedLabel="Joined"
                triggerClassName="h-11 w-full min-w-0 overflow-hidden rounded-2xl"
                groupBuy={{
                  id: activeProductGroupBuy.id,
                  product_id: activeProductGroupBuy.product_id,
                  min_participants: activeProductGroupBuy.min_participants,
                  max_participants: activeProductGroupBuy.max_participants,
                  current_participants: activeProductGroupBuy.current_participants,
                  discount_percentage: activeProductGroupBuy.discount_percentage,
                  group_price: activeProductGroupBuy.group_price,
                  expires_at: activeProductGroupBuy.expires_at,
                  settings: activeProductGroupBuy.settings,
                  status: activeProductGroupBuy.status,
                  product: {
                    name: product.name,
                    base_price: product.base_price,
                  },
                  tiers: activeProductGroupBuy.tiers,
                }}
              />
            ) : (
              <Button variant="outline" className="h-11 min-w-0 overflow-hidden rounded-2xl" disabled={!hasLiveProductGroupBuy}>
                <Users className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">Join Existing</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  ) : null;

  return (
    <div className="min-h-screen bg-background">
      {!isMobile && <Header />}
      <main className="container px-3 py-5 pb-36 sm:px-6 md:py-8 md:pb-8">
        {isMobile ? (
          <div className="space-y-4">
            <div className="sticky top-0 z-40 -mx-3 border-b border-border/70 bg-background/95 px-3 py-3 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <Link
                  to="/products"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  aria-label="Back to products"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    onClick={handleMobileShare}
                    aria-label="Share product"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Link to="/cart">
                    <Button variant="outline" size="icon" className="relative h-10 w-10 rounded-full" aria-label="Open cart">
                      <ShoppingCart className="h-4 w-4" />
                      {totalItems > 0 ? (
                        <Badge className="absolute -right-1 -top-1 h-5 w-5 justify-center p-0 text-[11px]">
                          {totalItems}
                        </Badge>
                      ) : null}
                    </Button>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" aria-label="More product actions">
                        <Ellipsis className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleCopyLink}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleShareWhatsApp}>
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Share on WhatsApp
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[1.8rem] border border-border/70 bg-card/80 shadow-sm">
              <div className="relative overflow-hidden rounded-[1.65rem] bg-muted">
                <div
                  ref={mobileGalleryRef}
                  className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [touch-action:pan-x]"
                  onScroll={handleMobileGalleryScroll}
                >
                  {galleryImages.map((image, index) => (
                    <div key={`${image}-${index}`} className="w-full flex-none snap-center">
                      <img
                        src={image}
                        alt={`${product.name} image ${index + 1}`}
                        className="h-[320px] w-full object-cover"
                        draggable={false}
                      />
                    </div>
                  ))}
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
                  <span className="rounded-full border border-white/15 bg-background/75 px-2.5 py-1 text-[11px] font-medium text-foreground backdrop-blur-md">
                    {Math.min(activeMobileImageIndex + 1, Math.max(1, galleryImages.length))}/{Math.max(1, galleryImages.length)}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-full border-white/20 bg-background/75 backdrop-blur-md"
                    onClick={handlePreviewImage}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <section className="space-y-2 px-0.5">
              <h1 className="text-[1.32rem] font-semibold leading-tight text-foreground">
                {product.name}
              </h1>
              <div className="flex items-end gap-2">
                <p className="text-[1.75rem] font-bold leading-none text-primary">{formatPrice(product.base_price)}</p>
                {product.group_buy_price != null && product.group_buy_price < product.base_price ? (
                  <p className="pb-0.5 text-[11px] font-medium text-primary">
                    Save {groupBuySavings}%
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1 font-medium text-primary">
                  <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                  {product.rating || 0}
                </span>
                <span>({product.review_count || 0} reviews)</span>
                <span className={hasAnyStock ? 'text-emerald-500' : 'text-destructive'}>
                  {hasAnyStock ? 'In stock' : 'Out of stock'}
                </span>
              </div>
              {descriptionText ? (
                <div>
                  <div className="relative">
                    <p
                      className={`text-[11px] leading-5 text-muted-foreground ${
                        !isDescriptionExpanded && hasLongDescription ? 'line-clamp-3' : ''
                      }`}
                    >
                      {descriptionText}
                    </p>
                    {!isDescriptionExpanded && hasLongDescription ? (
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background via-background/85 to-transparent" />
                    ) : null}
                  </div>
                  {hasLongDescription ? (
                    <button
                      type="button"
                      className="mt-1 text-[11px] font-semibold text-primary"
                      onClick={() => setIsDescriptionExpanded((current) => !current)}
                    >
                      {isDescriptionExpanded ? 'Show Less' : 'Read More'}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </section>

            {groupBuyPanel}

            <div className="space-y-2">
              <PriceDropAlert
                productId={product.id}
                productName={product.name}
                currentPrice={product.base_price}
                triggerMode="row"
              />
              {showRestockAlert ? (
                <div className="rounded-[1.35rem] border border-border/70 bg-card/80 p-3.5">
                  <BackInStockAlert
                    productId={product.id}
                    productName={product.name}
                    variantId={alertVariantId}
                    isOutOfStock={showRestockAlert}
                  />
                  <div className="mt-2">
                    <RestockReservationDialog
                      productId={product.id}
                      productName={product.name}
                      expectedRestockDate={product.expected_restock_date}
                      productVariantId={alertVariantId}
                      variantLabel={reservationVariantLabel}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <section className="space-y-3">
              {product.variants.length === 0 ? (
                <p className="text-sm text-muted-foreground">No variants available</p>
              ) : (
                <VariantSelector
                  mode="mobile"
                  variants={product.variants}
                  selectedVariants={selectedVariants}
                  onAddVariantSelection={handleAddVariantSelection}
                  onRemoveVariantSelection={handleRemoveSelectedVariant}
                  onQuantityChange={handleQuantityChange}
                  onClearAll={handleClearSelectedVariants}
                  onCurrentVariantChange={(variant) => {
                    setMobileVariantId(variant?.id || null);
                    resetMobileGallery();
                  }}
                />
              )}
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">
                    Shipping Options
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Choose how this product should move.
                  </p>
                </div>
                {product.is_free_shipping ? (
                  <Badge className="rounded-full bg-primary text-primary-foreground">Free Shipping</Badge>
                ) : null}
              </div>

              {availableShipping.length === 0 ? (
                <p className="text-sm text-muted-foreground">No shipping options available</p>
              ) : (
                <div className="space-y-2 rounded-[1.5rem] border border-border/70 bg-card/80 p-3.5">
                  {availableShipping.map((option) => {
                    const isSelected = (selectedShipping?.id || availableShipping[0]?.id) === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`flex w-full items-start gap-3 rounded-[1.35rem] border px-4 py-3 text-left transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/6 shadow-sm'
                            : 'border-border/70 bg-background hover:border-primary/40'
                        }`}
                        onClick={() => setSelectedShipping(option)}
                      >
                        <div className="mt-1 shrink-0">
                          {isSelected ? (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border border-border/70 bg-card" />
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-2 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
                          <div className="flex min-w-0 gap-3">
                            <div className="rounded-xl bg-primary/10 p-2 text-primary">
                              {getShippingIcon(option.shipping_class?.shipping_type?.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="line-clamp-2 font-medium text-foreground">{option.shipping_class?.name}</p>
                              <p className="line-clamp-2 text-xs text-muted-foreground">
                                Typically takes {option.shipping_class?.estimated_days_min}-{option.shipping_class?.estimated_days_max} days.
                              </p>
                            </div>
                          </div>
                          <p className="shrink-0 text-right text-sm font-semibold text-primary">
                            {product.is_free_shipping ? 'Free' : formatPrice(option.price)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

          </div>
        ) : (
          <>
            <Link to="/products" className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-primary">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Products
            </Link>

            <div className="grid gap-5 lg:grid-cols-2 lg:gap-12">
              <ProductImageGallery
                key={galleryImages[0] || product.id}
                images={galleryImages}
                productName={product.name}
              />

              <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {product.is_flash_deal && (
                      <Badge className="bg-destructive text-destructive-foreground">
                        <Zap className="mr-1 h-3 w-3" />
                        Flash Deal
                      </Badge>
                    )}
                    {product.is_group_buy_eligible && (
                      <Badge variant="secondary" className="bg-accent text-accent-foreground">
                        <Users className="mr-1 h-3 w-3" />
                        Group Buy Eligible
                      </Badge>
                    )}
                    {product.is_free_shipping && (
                      <Badge className="bg-primary text-primary-foreground">
                        <Truck className="mr-1 h-3 w-3" />
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
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleShareWhatsApp}>
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Share on WhatsApp
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div>
                  <p className="mb-1 text-sm text-muted-foreground">{product.category_name || 'Uncategorized'}</p>
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
                  <p className="mt-1 text-sm text-muted-foreground">Starting from</p>
                  {product.group_buy_price != null && product.group_buy_price < product.base_price && (
                    <p className="mt-2 text-sm text-primary">
                      Group buy price {formatPrice(product.group_buy_price)} available, saving {groupBuySavings}% when the group fills.
                    </p>
                  )}
                </div>

                {descriptionText ? (
                  <div>
                    <div className="relative">
                      <p
                        className={`text-sm leading-6 text-muted-foreground sm:text-base ${
                          !isDescriptionExpanded && hasLongDescription ? 'line-clamp-3' : ''
                        }`}
                      >
                        {descriptionText}
                      </p>
                      {!isDescriptionExpanded && hasLongDescription ? (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background via-background/90 to-transparent" />
                      ) : null}
                    </div>
                    {hasLongDescription ? (
                      <button
                        type="button"
                        className="mt-2 text-sm font-semibold text-primary"
                        onClick={() => setIsDescriptionExpanded((current) => !current)}
                      >
                        {isDescriptionExpanded ? 'Show Less' : 'Read More'}
                      </button>
                    ) : null}
                  </div>
                ) : null}

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

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-semibold text-foreground">Select Options</h3>
                  {product.variants.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No variants available</p>
                  ) : (
                    <VariantSelector
                      variants={product.variants}
                      selectedVariants={selectedVariants}
                      onAddVariantSelection={handleAddVariantSelection}
                      onRemoveVariantSelection={handleRemoveSelectedVariant}
                      onQuantityChange={handleQuantityChange}
                      onClearAll={handleClearSelectedVariants}
                      onCurrentVariantChange={(variant) => setDesktopPreviewVariantId(variant?.id || null)}
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
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                                {getShippingIcon(option.shipping_class?.shipping_type?.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="line-clamp-2 font-medium text-foreground">{option.shipping_class?.name}</p>
                                <p className="line-clamp-2 text-sm text-muted-foreground">
                                  {option.shipping_class?.estimated_days_min}-{option.shipping_class?.estimated_days_max} days
                                </p>
                                {(option.shipping_class?.description ||
                                  option.shipping_class?.shipping_type?.description) && (
                                  <p className="line-clamp-2 text-sm text-muted-foreground">
                                    {option.shipping_class?.description ||
                                      option.shipping_class?.shipping_type?.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <p className="shrink-0 pl-11 text-right text-sm font-semibold text-primary sm:pl-0">{formatPrice(option.price)}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {groupBuyPanel}
              </div>
            </div>
          </>
        )}

        <FrequentlyBoughtTogether productId={product.id} />

        <div className="mt-10 space-y-8 sm:mt-12">
          <ProductReviews productId={product.id} productName={product.name} />
          <ProductQA productId={product.id} />
        </div>

        <RelatedProducts productId={product.id} categoryId={product.category_id} />
        <RecentlyViewedProducts currentProductId={product.id} />
      </main>

      {isMobile && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-2">
          <div className="mx-auto rounded-[1.2rem] border border-border/80 bg-background/95 px-3 pt-3 shadow-[0_18px_44px_-22px_hsl(var(--foreground)/0.75)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/90">
            <div className="grid grid-cols-[minmax(0,1fr),auto,auto] items-end gap-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.55rem)]">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground">
                {selectedVariants.length > 0 ? `${selectedItemCount} item${selectedItemCount === 1 ? '' : 's'} selected` : 'Ready to buy'}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Total (Est.)
                </p>
                <div className="flex items-end gap-1.5">
                  <p className="text-[1.55rem] font-semibold leading-none text-primary">
                    {formatPrice(mobileEstimatedTotal)}
                  </p>
                </div>
                <p className="truncate pt-0.5 text-[11px] text-muted-foreground">
                  {selectedVariants.length > 0 ? `${selectedItemCount} selected` : 'Choose now or at checkout'} {' '}
                  <span className="text-primary">^</span>
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-11 min-w-[98px] gap-1.5 overflow-hidden rounded-xl border-border/70 bg-background/70 px-3"
                onClick={handleAddToCart}
              >
                <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Add to Cart</span>
              </Button>
              <BuyNowSheet
                product={product}
                selectedVariants={selectedVariants}
                selectedShippingRuleId={selectedShipping?.id || null}
                triggerClassName="h-11 min-w-[98px] gap-1.5 overflow-hidden rounded-xl px-3"
                triggerLabel="Buy Now"
                triggerSize="sm"
              />
            </div>
          </div>
        </div>
      )}
      {!isMobile && <Footer />}
    </div>
  );
}
