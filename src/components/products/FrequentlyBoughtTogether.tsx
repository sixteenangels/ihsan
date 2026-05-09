import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/hooks/useCurrency';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShoppingCart, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface Props {
  productId: string;
}

interface BundleProduct {
  id: string;
  name: string;
  base_price: number;
  product_images: Array<{
    image_url: string;
    order_index: number | null;
  }> | null;
}

interface ProductBundleResult {
  bundled_product: BundleProduct | null;
}

export function FrequentlyBoughtTogether({ productId }: Props) {
  const { formatPrice } = useCurrency();
  const { isEnabled } = useFeatureFlags();

  const { data: bundles } = useQuery({
    queryKey: ['product-bundles', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_bundles')
        .select(`
          bundled_product:products!product_bundles_bundled_product_id_fkey (
            id, name, base_price,
            product_images (image_url, order_index)
          )
        `)
        .eq('product_id', productId);

      if (error) throw error;
      const rows = (data || []) as ProductBundleResult[];
      return rows
        .map((bundle) => bundle.bundled_product)
        .filter((product): product is BundleProduct => Boolean(product));
    },
  });

  if (!bundles?.length || !isEnabled('bundles')) return null;

  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold text-foreground mb-4">Frequently Bought Together</h3>
      <div className="flex flex-wrap items-center gap-3">
        {bundles.map((product, i: number) => {
          const image = product.product_images?.[0]?.image_url || '/placeholder.svg';
          return (
            <div key={product.id} className="flex items-center gap-3">
              {i > 0 && <Plus className="h-5 w-5 text-muted-foreground" />}
              <Link to={`/product/${product.id}`}>
                <Card className="hover:shadow-md transition-shadow w-36">
                  <CardContent className="p-3">
                    <img src={image} alt={product.name} className="w-full h-24 object-cover rounded mb-2" />
                    <p className="text-xs font-medium text-foreground line-clamp-2">{product.name}</p>
                    <p className="text-sm font-bold text-primary mt-1">{formatPrice(product.base_price)}</p>
                  </CardContent>
                </Card>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
