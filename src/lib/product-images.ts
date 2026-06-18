type VariantImageSource = {
  image_url?: string | null;
};

function uniqueNonEmpty(urls: Array<string | null | undefined>): string[] {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))];
}

export function getVariantImageUrls(variants: VariantImageSource[]): string[] {
  return uniqueNonEmpty(variants.map((variant) => variant.image_url));
}

/** Shared product shots only — excludes URLs stored on individual variants. */
export function getSharedProductImages(productImages: string[], variants: VariantImageSource[]): string[] {
  const variantUrls = new Set(getVariantImageUrls(variants));
  const sharedImages = productImages.filter((url) => !variantUrls.has(url));

  return sharedImages.length > 0 ? sharedImages : productImages;
}

/** Product detail gallery: selected variant first, then shared lifestyle/detail shots. */
export function buildDetailGalleryImages(
  productImages: string[],
  variants: VariantImageSource[],
  selectedVariantImageUrl?: string | null,
): string[] {
  const sharedImages = getSharedProductImages(productImages, variants);

  if (selectedVariantImageUrl) {
    const remainingImages = sharedImages.filter((url) => url !== selectedVariantImageUrl);
    return uniqueNonEmpty([selectedVariantImageUrl, ...remainingImages]);
  }

  if (sharedImages.length > 0) {
    return sharedImages;
  }

  if (productImages.length > 0) {
    return productImages;
  }

  return ['/placeholder.svg'];
}
