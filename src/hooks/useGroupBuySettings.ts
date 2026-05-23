import { useMemo } from 'react';

import { useStoreSettings } from './useStoreSettings';
import {
  DEFAULT_GROUP_BUY_SETTINGS,
  GROUP_BUY_SETTINGS_STORE_KEY,
  parseGroupBuySettings,
} from '@/lib/groupBuyConfig';

export function useGroupBuySettings() {
  const { data, ...query } = useStoreSettings();

  const settings = useMemo(
    () => parseGroupBuySettings(data?.[GROUP_BUY_SETTINGS_STORE_KEY]),
    [data],
  );

  return {
    ...query,
    data,
    settings: settings || DEFAULT_GROUP_BUY_SETTINGS,
  };
}
