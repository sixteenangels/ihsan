import { describe, expect, it, vi } from 'vitest';

import {
  APP_BACKGROUND_REFRESH_MS,
  createBackgroundVisibilityRefresh,
  shouldRefreshAfterBackground,
} from '@/lib/backgroundRefresh';

describe('background refresh helpers', () => {
  it('does not refresh when away for less than five minutes', () => {
    const hiddenAt = 1_000_000;
    const now = hiddenAt + APP_BACKGROUND_REFRESH_MS - 1;

    expect(shouldRefreshAfterBackground(hiddenAt, now)).toBe(false);
  });

  it('refreshes when away for at least five minutes', () => {
    const hiddenAt = 1_000_000;
    const now = hiddenAt + APP_BACKGROUND_REFRESH_MS;

    expect(shouldRefreshAfterBackground(hiddenAt, now)).toBe(true);
  });

  it('only refreshes on visibility return after the threshold', () => {
    const onRefresh = vi.fn();
    const { handleVisibilityChange } = createBackgroundVisibilityRefresh(onRefresh);
    const hiddenAt = 5_000_000;

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    vi.spyOn(Date, 'now').mockReturnValueOnce(hiddenAt);
    handleVisibilityChange();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    vi.spyOn(Date, 'now').mockReturnValueOnce(hiddenAt + APP_BACKGROUND_REFRESH_MS - 1);
    handleVisibilityChange();
    expect(onRefresh).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    const secondHiddenAt = hiddenAt + APP_BACKGROUND_REFRESH_MS + 1_000;
    vi.spyOn(Date, 'now').mockReturnValueOnce(secondHiddenAt);
    handleVisibilityChange();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    vi.spyOn(Date, 'now').mockReturnValueOnce(secondHiddenAt + APP_BACKGROUND_REFRESH_MS);
    handleVisibilityChange();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
