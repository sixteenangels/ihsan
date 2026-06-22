import { describe, expect, it } from 'vitest';

import { buildDetailGalleryImages, getSharedProductImages, normalizeImageUrl } from '@/lib/product-images';

describe('product image gallery helpers', () => {
  const productImages = [
    'https://cdn.example.com/lifestyle.jpg',
    'https://cdn.example.com/tan-variant.jpg',
    'https://cdn.example.com/blue-variant.jpg',
  ];

  const variants = [
    { image_url: 'https://cdn.example.com/tan-variant.jpg' },
    { image_url: 'https://cdn.example.com/blue-variant.jpg' },
  ];

  it('removes variant-only images from the shared product gallery', () => {
    expect(getSharedProductImages(productImages, variants)).toEqual([
      'https://cdn.example.com/lifestyle.jpg',
    ]);
  });

  it('matches variant URLs even when query params differ', () => {
    const imagesWithCacheBust = [
      'https://cdn.example.com/lifestyle.jpg',
      'https://cdn.example.com/tan-variant.jpg?v=2',
    ];

    expect(getSharedProductImages(imagesWithCacheBust, variants)).toEqual([
      'https://cdn.example.com/lifestyle.jpg',
    ]);
  });

  it('keeps variant images out of the product gallery even when a variant is selected', () => {
    expect(buildDetailGalleryImages(productImages, variants)).toEqual([
      'https://cdn.example.com/lifestyle.jpg',
    ]);
  });

  it('shows placeholder when only variant images exist in product_images', () => {
    expect(buildDetailGalleryImages(['https://cdn.example.com/tan-variant.jpg'], variants)).toEqual([
      '/placeholder.svg',
    ]);
  });

  it('normalizes image URLs for stable comparison', () => {
    expect(normalizeImageUrl('https://CDN.example.com/path/file.jpg?token=abc')).toBe(
      'https://cdn.example.com/path/file.jpg',
    );
  });
});
