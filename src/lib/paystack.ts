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
