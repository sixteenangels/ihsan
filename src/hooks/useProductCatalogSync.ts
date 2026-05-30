import { useEffect } from 'react';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const CATALOG_TABLES = [
  'products',
  'product_variants',
  'product_images',
  'product_shipping_rules',
] as const;

const CATALOG_QUERY_KEYS = [
  ['products'],
  ['product'],
  ['categories'],
  ['related-products'],
  ['group-buys'],
  ['group-buy-detail'],
  ['product-active-group-buys'],
  ['group-buy-shipping-rules'],
  ['admin-products'],
  ['admin-procurement-products'],
  ['admin-flash-deals-products'],
] as const;

export function invalidateProductCatalogQueries(queryClient: QueryClient) {
  CATALOG_QUERY_KEYS.forEach((queryKey) => {
    void queryClient.invalidateQueries({ queryKey });
  });
}

export function useProductCatalogSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refreshCatalog = () => invalidateProductCatalogQueries(queryClient);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshCatalog();
      }
    };

    window.addEventListener('focus', refreshCatalog);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const channel = supabase.channel('product-catalog-sync');
    CATALOG_TABLES.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        refreshCatalog,
      );
    });

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        refreshCatalog();
      }
    });

    return () => {
      window.removeEventListener('focus', refreshCatalog);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
