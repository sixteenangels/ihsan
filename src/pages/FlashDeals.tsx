import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductCard } from '@/components/products/ProductCard';
import { Badge } from '@/components/ui/badge';
import { Zap, Clock, Loader2, Ban } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Product } from '@/types';

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

export default function FlashDeals() {
  const { formatPrice } = useCurrency();
  const { isEnabled } = useFeatureFlags();

  if (!isEnabled('flash_deals')) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-16 text-center">
          <Ban className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Feature Disabled</h1>
          <p className="text-muted-foreground">Flash Deals is currently disabled.</p>
        </main>
        <Footer />
      </div>
    );
  }

  const { data: flashProducts, isLoading } = useQuery({
    queryKey: ['flash-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_images (image_url, order_index),
          product_variants (id, size, color, price_override, stock, is_active),
          categories (name)
        `)
        .eq('is_flash_deal', true)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const toProduct = (p: any): Product => {
    const images = (p.product_images || [])
      .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
      .map((img: any) => img.image_url);
    const variants = (p.product_variants || []).filter((v: any) => v.is_active);

    return {
      id: p.id,
      name: p.name,
      description: p.description || '',
      category: p.categories?.name || 'Uncategorized',
      basePrice: p.base_price,
      images: images.length > 0 ? images : ['/placeholder.svg'],
      variants: variants.map((v: any) => ({
        id: v.id,
        size: v.size || undefined,
        color: v.color || undefined,
        price: v.price_override || p.base_price,
        stock: v.stock || 0,
      })),
      shippingOptions: [],
      isGroupBuyEligible: p.is_group_buy_eligible || false,
      isFlashDeal: true,
      isFreeShippingEligible: p.is_free_shipping || false,
      rating: p.rating || 0,
      reviewCount: p.review_count || 0,
    };
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-full bg-destructive/10">
            <Zap className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-serif text-foreground">Flash Deals</h1>
            <p className="text-muted-foreground">Limited time offers — grab them before they're gone!</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {flashProducts.map((p: any) => (
              <div key={p.id} className="relative">
                {p.flash_deal_ends_at && (
                  <div className="absolute top-2 right-2 z-10">
                    <CountdownTimer endsAt={p.flash_deal_ends_at} />
                  </div>
                )}
                <ProductCard product={toProduct(p)} />
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
