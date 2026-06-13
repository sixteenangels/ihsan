import { describe, expect, it } from 'vitest';
import {
  buildSafeAppUrl,
  sanitizeEmailUrl,
  sanitizeInternalPath,
  sanitizePushNavigationUrl,
} from '@/lib/security-url';

describe('security-url', () => {
  it('rejects unsafe internal paths', () => {
    expect(sanitizeInternalPath('//evil.com')).toBe('/checkout');
    expect(sanitizeInternalPath('https://evil.com')).toBe('/checkout');
    expect(sanitizeInternalPath('/checkout@evil.com')).toBe('/checkout');
    expect(sanitizeInternalPath('/checkout?step=1')).toBe('/checkout?step=1');
  });

  it('builds safe app urls', () => {
    expect(buildSafeAppUrl('/checkout', 'https://www.ajynworld.com')).toBe(
      'https://www.ajynworld.com/checkout',
    );
    expect(buildSafeAppUrl('//evil.com', 'https://www.ajynworld.com')).toBe(
      'https://www.ajynworld.com/checkout',
    );
  });

  it('sanitizes email urls', () => {
    expect(sanitizeEmailUrl('https://www.ajynworld.com/track-order/123')).toContain('https://');
    expect(sanitizeEmailUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeEmailUrl('data:text/html,hello')).toBeNull();
  });

  it('restricts push navigation urls to same origin paths', () => {
    expect(sanitizePushNavigationUrl('/notifications', 'https://www.ajynworld.com')).toBe(
      'https://www.ajynworld.com/notifications',
    );
    expect(sanitizePushNavigationUrl('https://evil.com/phish', 'https://www.ajynworld.com')).toBe(
      'https://www.ajynworld.com/notifications',
    );
  });
});
