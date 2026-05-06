import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface StoreSettings {
  [key: string]: any;
}

async function fetchStoreSettings(): Promise<StoreSettings> {
  const { data, error } = await supabase
    .from('store_settings')
    .select('key, value');

  if (error) throw error;

  const settings: StoreSettings = {};
  data?.forEach((row) => {
    settings[row.key] = row.value;
  });

  return settings;
}

export function useStoreSettings() {
  return useQuery({
    queryKey: ['store-settings'],
    queryFn: fetchStoreSettings,
  });
}

export function formatPrice(amount: number): string {
  return `₵${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
