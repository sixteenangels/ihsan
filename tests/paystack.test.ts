import { beforeEach, describe, expect, it, vi } from 'vitest';

const SCRIPT_SELECTOR = 'script[src="https://js.paystack.co/v1/inline.js"]';

describe('loadPaystack', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.useRealTimers();
    document.body.innerHTML = '';
    delete window.PaystackPop;
  });

  it('returns an existing Paystack loader without injecting a script tag', async () => {
    const existingPaystack = {
      setup: vi.fn(),
    };

    window.PaystackPop = existingPaystack;

    const { loadPaystack } = await import('@/lib/paystack');

    await expect(loadPaystack()).resolves.toBe(existingPaystack);
    expect(document.querySelector(SCRIPT_SELECTOR)).toBeNull();
  });

  it('injects the Paystack script and resolves once the loader is ready', async () => {
    vi.useFakeTimers();

    const readyPaystack = {
      setup: vi.fn(),
    };
    const { loadPaystack } = await import('@/lib/paystack');

    const pendingLoader = loadPaystack();
    const script = document.querySelector(SCRIPT_SELECTOR) as HTMLScriptElement | null;

    expect(script).not.toBeNull();

    window.PaystackPop = readyPaystack;
    script?.dispatchEvent(new Event('load'));

    await expect(pendingLoader).resolves.toBe(readyPaystack);
    expect(script?.dataset.paystackLoaded).toBe('true');
  });

  it('rejects with a helpful message when the script fails to load', async () => {
    vi.useFakeTimers();

    const { loadPaystack } = await import('@/lib/paystack');

    const pendingLoader = loadPaystack();
    const script = document.querySelector(SCRIPT_SELECTOR) as HTMLScriptElement | null;

    expect(script).not.toBeNull();

    script?.dispatchEvent(new Event('error'));

    await expect(pendingLoader).rejects.toThrow(
      'Unable to load the payment gateway. Please try again.',
    );
  });
});
