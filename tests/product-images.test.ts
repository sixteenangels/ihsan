import { describe, expect, it } from 'vitest';

import { buildDetailGalleryImages, getSharedProductImages } from '@/lib/product-images';

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

  it('puts the selected variant image first without duplicating the carousel', () => {
    expect(
      buildDetailGalleryImages(productImages, variants, 'https://cdn.example.com/blue-variant.jpg'),
    ).toEqual([
      'https://cdn.example.com/blue-variant.jpg',
      'https://cdn.example.com/lifestyle.jpg',
    ]);
  });

  it('falls back to product images when no shared shots exist', () => {
    expect(buildDetailGalleryImages(['https://cdn.example.com/tan-variant.jpg'], variants, null)).toEqual([
      'https://cdn.example.com/tan-variant.jpg',
    ]);
  });
});
