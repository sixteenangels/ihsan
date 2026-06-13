const DEFAULT_APP_ORIGIN = 'https://www.ajynworld.com';

const ALLOWED_INTERNAL_PATH =
  /^\/[A-Za-z0-9][A-Za-z0-9/_?=&%.+-]*$/;

export function sanitizeInternalPath(path: string | null | undefined, fallback = '/checkout') {
  const trimmed = String(path || '').trim();
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('@')) {
    return fallback;
  }

  if (!ALLOWED_INTERNAL_PATH.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}

export function buildSafeAppUrl(path: string, appOrigin = DEFAULT_APP_ORIGIN) {
  const safePath = sanitizeInternalPath(path);
  return new URL(safePath, appOrigin).toString();
}

export function sanitizeEmailUrl(url: string | null | undefined) {
  const trimmed = String(url || '').trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }

    if (parsed.username || parsed.password) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function isSameOriginAppUrl(url: string | null | undefined, appOrigin = DEFAULT_APP_ORIGIN) {
  const trimmed = String(url || '').trim();
  if (!trimmed) {
    return false;
  }

  try {
    const parsed = new URL(trimmed, appOrigin);
    const origin = new URL(appOrigin).origin;
    return parsed.origin === origin;
  } catch {
    return false;
  }
}

export function sanitizePushNavigationUrl(
  url: string | null | undefined,
  appOrigin = DEFAULT_APP_ORIGIN,
  fallbackPath = '/notifications',
) {
  const trimmed = String(url || '').trim();
  if (!trimmed) {
    return buildSafeAppUrl(fallbackPath, appOrigin);
  }

  if (trimmed.startsWith('/')) {
    return buildSafeAppUrl(trimmed, appOrigin);
  }

  if (isSameOriginAppUrl(trimmed, appOrigin)) {
    return trimmed;
  }

  return buildSafeAppUrl(fallbackPath, appOrigin);
}
