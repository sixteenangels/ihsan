import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type StoreSettings = Record<string, Json>;

interface StoreSettingsRow {
  key: string;
  value: Json;
}

export async function fetchPublicStoreSettings(): Promise<StoreSettings> {
  const { data, error } = await supabase.rpc('get_public_store_settings' as never);

  if (error) {
    throw error;
  }

  const settings: StoreSettings = {};
  ((data as StoreSettingsRow[] | null) || []).forEach((row) => {
    settings[row.key] = row.value;
  });

  return settings;
}

export async function upsertStoreSetting(key: string, value: Json) {
  const payload = {
    key,
    value: JSON.parse(JSON.stringify(value)) as Json,
  };

  const { data: existing, error: existingError } = await supabase
    .from('store_settings')
    .select('id')
    .eq('key', key)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    const { error } = await supabase
      .from('store_settings')
      .update({
        value: payload.value,
        updated_at: new Date().toISOString(),
      })
      .eq('key', key);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase.from('store_settings').insert(payload);
  if (error) {
    throw error;
  }
}
