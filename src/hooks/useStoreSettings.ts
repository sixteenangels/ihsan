import { useQuery } from '@tanstack/react-query';
import { fetchPublicStoreSettings } from '@/lib/storeSettings';

export function useStoreSettings() {
  return useQuery({
    queryKey: ['store-settings'],
    queryFn: fetchPublicStoreSettings,
  });
}

export function formatPrice(amount: number): string {
  return `GHS ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
