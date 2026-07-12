'use client';

export interface RazorpayCheckoutResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayDisplayBlock {
  name: string;
  instruments: { method: string; flows?: string[]; apps?: string[] }[];
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  handler: (response: RazorpayCheckoutResponse) => void;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
  config?: {
    display: {
      blocks?: Record<string, RazorpayDisplayBlock>;
      sequence?: string[];
      preferences?: { show_default_blocks?: boolean };
    };
  };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (response: unknown) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'all';

/**
 * Builds the Razorpay checkout `config.display` for a chosen payment method,
 * pinning that method's block to the top of the modal.
 * 'all' returns undefined → Razorpay shows its default layout.
 */
export function buildDisplayConfig(method: PaymentMethod): RazorpayOptions['config'] {
  if (method === 'all') return undefined;

  const blocks: Record<string, RazorpayDisplayBlock> = {
    upi: {
      name: 'Pay via UPI',
      instruments: [{ method: 'upi', flows: ['collect', 'intent', 'qr'] }],
    },
    card: {
      name: 'Pay via Card',
      instruments: [{ method: 'card' }],
    },
    netbanking: {
      name: 'Pay via Netbanking',
      instruments: [{ method: 'netbanking' }],
    },
  };

  return {
    display: {
      blocks: { [method]: blocks[method] },
      sequence: [`block.${method}`],
      preferences: { show_default_blocks: true },
    },
  };
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function openRazorpayCheckout(options: RazorpayOptions): RazorpayInstance {
  if (!window.Razorpay) {
    throw new Error('Razorpay script not loaded');
  }
  const instance = new window.Razorpay(options);
  instance.open();
  return instance;
}
