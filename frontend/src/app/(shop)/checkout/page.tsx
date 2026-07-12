'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { formatCents } from '@/lib/utils';
import { loadRazorpayScript, openRazorpayCheckout } from '@/lib/razorpay';
import type { Cart, CartItem, ShippingAddress, Order, CreateOrderResponse } from '@/types';

const EMPTY_ADDRESS: ShippingAddress = {
  fullName: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'United States',
};

const inputClass =
  'block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-950 focus:outline-none transition-colors bg-white';

type CheckoutStep = 'shipping' | 'payment' | 'review';

export default function CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const { refreshCart } = useCart();
  const router = useRouter();

  const [cart, setCart] = useState<Cart | null>(null);
  const [cartLoading, setCartLoading] = useState(true);
  
  // Multi-step state
  const [step, setStep] = useState<CheckoutStep>('shipping');
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS);
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});

  // Payment mock fields
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preload the Razorpay checkout script
  useEffect(() => {
    loadRazorpayScript();
  }, []);

  const fetchCart = useCallback(async () => {
    const res = await api.get<Cart>('/cart');
    if (res.success && res.data) setCart(res.data);
    setCartLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/login');
        return;
      }
      fetchCart();
    }
  }, [user, authLoading, router, fetchCart]);

  // Redirect if cart becomes empty after load
  useEffect(() => {
    if (!cartLoading && cart && cart.items.length === 0) {
      router.replace('/cart');
    }
  }, [cartLoading, cart, router]);

  function handleField(field: keyof ShippingAddress, value: string) {
    setAddress((prev) => ({ ...prev, [field]: value }));
    if (addressErrors[field]) {
      setAddressErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function validateShipping() {
    const errs: Record<string, string> = {};
    if (!address.fullName.trim()) errs.fullName = 'Full Name is required';
    if (!address.addressLine1.trim()) errs.addressLine1 = 'Address Line 1 is required';
    if (!address.city.trim()) errs.city = 'City is required';
    if (!address.state.trim()) errs.state = 'State / Province is required';
    if (!address.postalCode.trim()) errs.postalCode = 'Postal Code is required';
    if (!address.country.trim()) errs.country = 'Country is required';
    
    setAddressErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validatePayment() {
    return true; // Payment is handled by Razorpay at order placement
  }

  function goToPayment() {
    if (validateShipping()) {
      setStep('payment');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function goToReview() {
    if (validatePayment()) {
      setStep('review');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function handlePlaceOrder() {
    setError(null);
    setPlacing(true);

    // 1. Create the order + Razorpay order on the backend
    const res = await api.post<CreateOrderResponse>('/orders', { shippingAddress: address });

    if (!res.success || !res.data) {
      setError(res.message ?? 'Failed to place order. Please try again.');
      setPlacing(false);
      return;
    }

    const { order, razorpayOrderId, amount, currency, keyId } = res.data;
    await refreshCart();

    // 2. Open the Razorpay checkout modal
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      setError('Failed to load Razorpay. Please check your connection and retry from your orders page.');
      setPlacing(false);
      return;
    }

    try {
      openRazorpayCheckout({
        key: keyId,
        amount,
        currency,
        name: 'ShopCo',
        description: `Order #${order._id.slice(-8).toUpperCase()}`,
        order_id: razorpayOrderId,
        prefill: {
          name: address.fullName,
          email: user?.email,
        },
        theme: { color: '#0a0a0a' },
        modal: {
          ondismiss: () => {
            setPlacing(false);
            setError('Payment was cancelled. You can retry from your orders page.');
            router.push(`/orders/${order._id}`);
          },
        },
        handler: async (response) => {
          // 3. Verify the payment signature on the backend
          const verifyRes = await api.post<Order>(`/orders/${order._id}/verify-payment`, {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });

          if (verifyRes.success) {
            router.push(`/orders/${order._id}`);
          } else {
            setError(verifyRes.message ?? 'Payment verification failed. Contact support.');
            setPlacing(false);
          }
        },
      });
    } catch {
      setError('Could not open Razorpay checkout. Please try again.');
      setPlacing(false);
    }
  }

  const items: CartItem[] = cart?.items ?? [];
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const shipping = subtotal >= 716400 ? 0 : 57200; // Free shipping over ₹7,164 ($75 @ 95.52)
  const tax = Math.round(subtotal * 0.08); // 8% Tax
  const total = subtotal + shipping + tax;

  if (authLoading || cartLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-pulse">
        <div className="h-8 w-32 bg-gray-200 rounded-lg mb-10" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-3 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-xl" />
            ))}
          </div>
          <div className="lg:col-span-2 h-64 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        
        {/* Progress Stepper */}
        <div className="mb-10 max-w-xl mx-auto">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-gray-200 -z-10" />
            
            {/* Step 1: Shipping */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === 'shipping' ? 'bg-gray-950 text-white ring-4 ring-gray-950/10' : 'bg-green-600 text-white'
              }`}>
                {step !== 'shipping' ? '✓' : '1'}
              </div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-2">Shipping</span>
            </div>

            {/* Step 2: Payment */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === 'payment' ? 'bg-gray-950 text-white ring-4 ring-gray-950/10' :
                step === 'review' ? 'bg-green-600 text-white' : 'bg-white border border-gray-250 text-gray-400'
              }`}>
                {step === 'review' ? '✓' : '2'}
              </div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-2">Payment</span>
            </div>

            {/* Step 3: Review */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === 'review' ? 'bg-gray-950 text-white ring-4 ring-gray-950/10' : 'bg-white border border-gray-250 text-gray-400'
              }`}>
                3
              </div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-2">Review</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-start">
          
          {/* Main Form Fields */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Step 1: Shipping Address Form */}
            {step === 'shipping' && (
              <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-sm/5">
                <h2 className="text-base font-extrabold text-gray-900 uppercase tracking-wider mb-5">Shipping Address</h2>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="fullName" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Full Name</label>
                    <input
                      id="fullName"
                      type="text"
                      value={address.fullName}
                      onChange={(e) => handleField('fullName', e.target.value)}
                      className={inputClass}
                      placeholder="Jane Doe"
                    />
                    {addressErrors.fullName && <p className="text-[10px] text-red-500 font-semibold mt-1">{addressErrors.fullName}</p>}
                  </div>

                  <div>
                    <label htmlFor="addressLine1" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Address Line 1</label>
                    <input
                      id="addressLine1"
                      type="text"
                      value={address.addressLine1}
                      onChange={(e) => handleField('addressLine1', e.target.value)}
                      className={inputClass}
                      placeholder="123 Main Street"
                    />
                    {addressErrors.addressLine1 && <p className="text-[10px] text-red-500 font-semibold mt-1">{addressErrors.addressLine1}</p>}
                  </div>

                  <div>
                    <label htmlFor="addressLine2" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      Address Line 2 <span className="text-gray-400 font-medium">(optional)</span>
                    </label>
                    <input
                      id="addressLine2"
                      type="text"
                      value={address.addressLine2 ?? ''}
                      onChange={(e) => handleField('addressLine2', e.target.value)}
                      className={inputClass}
                      placeholder="Apt, Suite, Unit…"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="city" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">City</label>
                      <input
                        id="city"
                        type="text"
                        value={address.city}
                        onChange={(e) => handleField('city', e.target.value)}
                        className={inputClass}
                        placeholder="New York"
                      />
                      {addressErrors.city && <p className="text-[10px] text-red-500 font-semibold mt-1">{addressErrors.city}</p>}
                    </div>
                    <div>
                      <label htmlFor="state" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">State / Province</label>
                      <input
                        id="state"
                        type="text"
                        value={address.state}
                        onChange={(e) => handleField('state', e.target.value)}
                        className={inputClass}
                        placeholder="NY"
                      />
                      {addressErrors.state && <p className="text-[10px] text-red-500 font-semibold mt-1">{addressErrors.state}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="postalCode" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Postal Code</label>
                      <input
                        id="postalCode"
                        type="text"
                        value={address.postalCode}
                        onChange={(e) => handleField('postalCode', e.target.value)}
                        className={inputClass}
                        placeholder="10001"
                      />
                      {addressErrors.postalCode && <p className="text-[10px] text-red-500 font-semibold mt-1">{addressErrors.postalCode}</p>}
                    </div>
                    <div>
                      <label htmlFor="country" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Country</label>
                      <input
                        id="country"
                        type="text"
                        value={address.country}
                        onChange={(e) => handleField('country', e.target.value)}
                        className={inputClass}
                        placeholder="United States"
                      />
                      {addressErrors.country && <p className="text-[10px] text-red-500 font-semibold mt-1">{addressErrors.country}</p>}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={goToPayment}
                  className="mt-6 w-full py-3.5 bg-gray-950 hover:bg-gray-900 text-white text-xs font-bold uppercase tracking-wider rounded-full transition-all shadow-md active:scale-98"
                >
                  Continue to Payment
                </button>
              </div>
            )}

            {/* Step 2: Payment Method */}
            {step === 'payment' && (
              <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-sm/5 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <h2 className="text-base font-extrabold text-gray-900 uppercase tracking-wider">Payment Method</h2>

                <div className="rounded-2xl border-2 border-gray-950 bg-gray-50/60 p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#0f2d5c] flex items-center justify-center shrink-0">
                    <span className="text-white font-black text-lg">R</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Razorpay Secure Checkout</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Pay securely with UPI, Cards, Netbanking or Wallets. The Razorpay payment
                      window will open when you place your order.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('shipping')}
                    className="w-1/3 py-3 border border-gray-200 hover:bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider rounded-full transition-all"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={goToReview}
                    className="flex-1 py-3 bg-gray-950 hover:bg-gray-900 text-white text-xs font-bold uppercase tracking-wider rounded-full transition-all shadow-md"
                  >
                    Continue to Review
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Review Details Panel */}
            {step === 'review' && (
              <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-sm/5 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <h2 className="text-base font-extrabold text-gray-900 uppercase tracking-wider">Review Order</h2>

                {error && (
                  <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3.5 text-xs font-semibold text-red-700">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-gray-100 pb-6">
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Shipping Information</h3>
                    <p className="text-sm font-bold text-gray-900">{address.fullName}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {address.addressLine1} {address.addressLine2 && `, ${address.addressLine2}`} <br />
                      {address.city}, {address.state} {address.postalCode} <br />
                      {address.country}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Payment Method</h3>
                    <p className="text-sm font-bold text-gray-900">Razorpay</p>
                    <p className="text-xs text-gray-500 mt-1">
                      UPI, Cards, Netbanking &amp; Wallets <br />
                      Secure payment window opens on placing the order
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('payment')}
                    className="w-1/3 py-3 border border-gray-200 hover:bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider rounded-full transition-all"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handlePlaceOrder}
                    disabled={placing}
                    className="flex-1 py-3.5 bg-gray-950 hover:bg-gray-900 text-white text-xs font-bold uppercase tracking-wider rounded-full transition-all shadow-md active:scale-98"
                  >
                    {placing ? 'Processing Payment…' : 'Pay & Place Order'}
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Right Column: Checkout Summary info */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl border border-gray-150 p-6 sticky top-24 shadow-sm/5 space-y-6">
              <h2 className="text-lg font-bold text-gray-900">Checkout items</h2>

              {/* Items grid */}
              <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.product._id} className="flex items-center gap-3">
                    <div className="relative w-12 h-12 shrink-0 rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                      {item.product.images[0] && (
                        <Image src={item.product.images[0].url} alt={item.product.name} fill className="object-cover" sizes="48px" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{item.product.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Quantity: {item.quantity}</p>
                    </div>
                    <span className="text-xs font-extrabold text-gray-900 shrink-0">
                      {formatCents(item.product.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals panel */}
              <div className="space-y-3.5 text-xs sm:text-sm border-t border-gray-100 pt-5">
                <div className="flex justify-between text-gray-500 font-medium">
                  <span>Subtotal</span>
                  <span className="font-bold text-gray-900">{formatCents(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-500 font-medium">
                  <span>Shipping</span>
                  <span className={`font-bold ${shipping === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                    {shipping === 0 ? 'Free' : formatCents(shipping)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-500 font-medium">
                  <span>Estimated Tax (8%)</span>
                  <span className="font-bold text-gray-900">{formatCents(tax)}</span>
                </div>
                <hr className="border-gray-100" />
                <div className="flex justify-between text-base font-extrabold text-gray-900">
                  <span>Grand Total</span>
                  <span>{formatCents(total)}</span>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
