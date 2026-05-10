export interface PaystackHandler {
  openIframe: () => void;
}

export interface PaystackTransactionResponse {
  reference: string;
}

export interface PaystackPop {
  setup: (options: Record<string, unknown>) => PaystackHandler;
}

export type PaystackWindow = Window & {
  PaystackPop?: PaystackPop;
};

declare global {
  interface Window {
    PaystackPop?: PaystackPop;
  }
}

const PAYSTACK_SCRIPT_SRC = 'https://js.paystack.co/v1/inline.js';

let paystackLoaderPromise: Promise<PaystackPop> | null = null;

export const loadPaystack = async (): Promise<PaystackPop> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Payment can only be initialized in the browser.');
  }

  const paystackWindow = window as PaystackWindow;
  if (paystackWindow.PaystackPop) {
    return paystackWindow.PaystackPop;
  }

  if (paystackLoaderPromise) {
    return paystackLoaderPromise;
  }

  paystackLoaderPromise = new Promise<PaystackPop>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${PAYSTACK_SCRIPT_SRC}"]`);
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      rejectWithMessage('Payment gateway took too long to load. Please try again.');
    }, 15000);

    const cleanup = (script: HTMLScriptElement | null, handleLoad: () => void, handleError: () => void) => {
      window.clearTimeout(timeoutId);
      script?.removeEventListener('load', handleLoad);
      script?.removeEventListener('error', handleError);
    };

    const rejectWithMessage = (message: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      paystackLoaderPromise = null;
      reject(new Error(message));
    };

    const resolveIfReady = (script: HTMLScriptElement | null, handleLoad: () => void, handleError: () => void) => {
      if (settled) return;

      const paystack = paystackWindow.PaystackPop;
      if (!paystack) {
        rejectWithMessage('Payment gateway failed to finish loading.');
        return;
      }

      settled = true;
      if (script) {
        script.dataset.paystackLoaded = 'true';
      }
      cleanup(script, handleLoad, handleError);
      resolve(paystack);
    };

    const attachListeners = (script: HTMLScriptElement) => {
      const handleLoad = () => resolveIfReady(script, handleLoad, handleError);
      const handleError = () => {
        cleanup(script, handleLoad, handleError);
        rejectWithMessage('Unable to load the payment gateway. Please try again.');
      };

      if (script.dataset.paystackLoaded === 'true' && paystackWindow.PaystackPop) {
        resolveIfReady(script, handleLoad, handleError);
        return;
      }

      script.addEventListener('load', handleLoad);
      script.addEventListener('error', handleError);

      // If another screen already loaded the script, resolve immediately.
      if (paystackWindow.PaystackPop) {
        resolveIfReady(script, handleLoad, handleError);
      }
    };

    if (existingScript) {
      attachListeners(existingScript);
      return;
    }

    const script = document.createElement('script');
    script.src = PAYSTACK_SCRIPT_SRC;
    script.async = true;
    attachListeners(script);
    document.body.appendChild(script);
  });

  return paystackLoaderPromise;
};
