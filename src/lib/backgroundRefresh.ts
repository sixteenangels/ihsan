/** Minimum time away before background return triggers a data refresh. */
export const APP_BACKGROUND_REFRESH_MS = 5 * 60 * 1000;

export function shouldRefreshAfterBackground(
  hiddenAt: number | null,
  now = Date.now(),
): boolean {
  if (hiddenAt == null) {
    return false;
  }

  return now - hiddenAt >= APP_BACKGROUND_REFRESH_MS;
}

export function createBackgroundVisibilityRefresh(onRefresh: () => void) {
  let hiddenAt: number | null = null;

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }

    if (document.visibilityState !== 'visible') {
      return;
    }

    if (shouldRefreshAfterBackground(hiddenAt)) {
      onRefresh();
    }

    hiddenAt = null;
  };

  return { handleVisibilityChange };
}
