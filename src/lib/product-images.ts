type VariantImageSource = {
  image_url?: string | null;
};

function uniqueNonEmpty(urls: Array<string | null | undefined>): string[] {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))];
}

/** Compare storage URLs regardless of query params or encoding differences. */
export function normalizeImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname).replace(/\/+$/, '');
    return `${parsed.origin}${pathname}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase().split(/[?#]/)[0];
  }
}

export function getVariantImageUrls(variants: VariantImageSource[]): string[] {
  return uniqueNonEmpty(variants.map((variant) => variant.image_url));
}

function isVariantImageUrl(url: string, variantUrls: Set<string>): boolean {
  return variantUrls.has(normalizeImageUrl(url));
}

/** Shared product shots only — excludes URLs stored on individual variants. */
export function getSharedProductImages(productImages: string[], variants: VariantImageSource[]): string[] {
  const variantUrls = new Set(getVariantImageUrls(variants).map(normalizeImageUrl));
  return productImages.filter((url) => !isVariantImageUrl(url, variantUrls));
}

/** Product detail gallery: selected variant first, then shared lifestyle/detail shots. */
export function buildDetailGalleryImages(
  productImages: string[],
  variants: VariantImageSource[],
  selectedVariantImageUrl?: string | null,
): string[] {
  const sharedImages = getSharedProductImages(productImages, variants);

  if (selectedVariantImageUrl) {
    const selectedKey = normalizeImageUrl(selectedVariantImageUrl);
    const remainingImages = sharedImages.filter((url) => normalizeImageUrl(url) !== selectedKey);
    return uniqueNonEmpty([selectedVariantImageUrl, ...remainingImages]);
  }

  if (sharedImages.length > 0) {
    return sharedImages;
  }

  return ['/placeholder.svg'];
}
