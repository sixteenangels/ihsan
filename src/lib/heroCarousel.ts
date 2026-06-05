export interface HeroCarouselImage {
  id: string;
  url: string;
  position: string;
  uploadedAt?: string;
}

export const HERO_CAROUSEL_SETTING_KEY = 'heroCarouselImages';
export const HERO_CAROUSEL_STORAGE_BUCKET = 'product-images';
export const HERO_CAROUSEL_STORAGE_FOLDER = 'hero-carousel';
export const HERO_CAROUSEL_DEFAULT_POSITION = 'center';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizePosition(value: unknown) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : HERO_CAROUSEL_DEFAULT_POSITION;
}

export function createHeroCarouselImage(url: string): HeroCarouselImage {
  const randomToken =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 11);

  return {
    id: `${Date.now()}-${randomToken}`,
    url,
    position: HERO_CAROUSEL_DEFAULT_POSITION,
    uploadedAt: new Date().toISOString(),
  };
}

export function normalizeHeroCarouselImages(value: unknown): HeroCarouselImage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index): HeroCarouselImage | null => {
      if (typeof item === 'string') {
        const url = item.trim();
        if (!url) return null;

        return {
          id: `${index}-${url}`,
          url,
          position: HERO_CAROUSEL_DEFAULT_POSITION,
        };
      }

      if (!isRecord(item)) {
        return null;
      }

      const rawUrl = item.url ?? item.image ?? item.image_url;
      if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
        return null;
      }

      return {
        id:
          typeof item.id === 'string' && item.id.trim()
            ? item.id.trim()
            : `${index}-${rawUrl}`,
        url: rawUrl.trim(),
        position: sanitizePosition(item.position),
        uploadedAt:
          typeof item.uploadedAt === 'string' && item.uploadedAt.trim()
            ? item.uploadedAt.trim()
            : undefined,
      };
    })
    .filter((item): item is HeroCarouselImage => Boolean(item));
}
