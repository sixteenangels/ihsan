import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductCard } from '@/components/products/ProductCard';
import { Badge } from '@/components/ui/badge';
import { Zap, Clock, Loader2, Ban } from 'lucide-react';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Product, ProductVariant } from '@/types';

interface FlashDealImage {
  image_url: string;
  order_index: number | null;
}

interface FlashDealVariant {
  id: string;
  size: string | null;
  color: string | null;
  price_override: number | null;
  stock: number | null;
  is_active: boolean | null;
}

interface FlashDealProductRecord {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  is_group_buy_eligible: boolean | null;
  is_free_shipping: boolean | null;
  rating: number | null;
  review_count: number | null;
  flash_deal_ends_at: string | null;
  product_images: FlashDealImage[];
  product_variants: FlashDealVariant[];
  categories: { name: string } | null;
}

function CountdownTimer({ endsAt }: { endsAt: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date().getTime();
      const end = new Date(endsAt).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft('Ended');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  return (
    <Badge variant="destructive" className="gap-1">
      <Clock className="h-3 w-3" />
      {timeLeft}
    </Badge>
  );
}

function toProduct(record: FlashDealProductRecord): Product {
  const images = (record.product_images || [])
    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
    .map((image) => image.image_url);

  const variants = (record.product_variants || [])
    .filter((variant) => variant.is_active)
    .map<ProductVariant>((variant) => ({
      id: variant.id,
      size: variant.size || undefined,
      color: variant.color || undefined,
      price: variant.price_override || record.base_price,
      stock: variant.stock || 0,
    }));

  return {
    id: record.id,
    name: record.name,
    description: record.description || '',
    category: record.categories?.name || 'Uncategorized',
    basePrice: record.base_price,
    images: images.length > 0 ? images : ['/placeholder.svg'],
    variants,
    shippingOptions: [],
    isGroupBuyEligible: record.is_group_buy_eligible || false,
    isFlashDeal: true,
    isFreeShippingEligible: record.is_free_shipping || false,
    rating: record.rating || 0,
    reviewCount: record.review_count || 0,
  };
}

export default function FlashDeals() {
  const { isEnabled } = useFeatureFlags();
  const flashDealsEnabled = isEnabled('flash_deals');

  const { data: flashProducts, isLoading } = useQuery({
    queryKey: ['flash-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          description,
          base_price,
          is_group_buy_eligible,
          is_free_shipping,
          rating,
          review_count,
          flash_deal_ends_at,
          product_images (image_url, order_index),
          product_variants (id, size, color, price_override, stock, is_active),
          categories (name)
        `)
        .eq('is_flash_deal', true)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as FlashDealProductRecord[];
    },
    enabled: flashDealsEnabled,
  });

  if (!flashDealsEnabled) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container px-4 py-16 text-center sm:px-6">
          <Ban className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Feature Disabled</h1>
          <p className="text-muted-foreground">Flash Deals is currently disabled.</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-3 py-6 pb-28 sm:px-6 md:py-8 md:pb-8">
        <div className="mb-8 flex items-start gap-3 sm:items-center">
          <div className="rounded-full bg-destructive/10 p-2">
            <Zap className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-serif text-foreground sm:text-3xl">Flash Deals</h1>
            <p className="text-sm text-muted-foreground sm:text-base">Limited time offers - grab them before they are gone.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !flashProducts?.length ? (
          <div className="text-center py-16">
            <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">No flash deals right now. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {flashProducts.map((product) => (
              <div key={product.id} className="relative">
                {product.flash_deal_ends_at ? (
                  <div className="absolute top-2 right-2 z-10">
                    <CountdownTimer endsAt={product.flash_deal_ends_at} />
                  </div>
                ) : null}
                <ProductCard product={toProduct(product)} />
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
