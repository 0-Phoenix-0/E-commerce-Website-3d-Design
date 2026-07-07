'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { formatCents } from '@/lib/utils';
import type { Cart, CartItem, ShippingAddress, Order } from '@/types';

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
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [paymentErrors, setPaymentErrors] = useState<Record<string, string>>({});

  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const errs: Record<string, string> = {};
    if (!cardName.trim()) errs.cardName = 'Cardholder name is required';
    if (!cardNumber.trim() || cardNumber.replace(/\s/g, '').length !== 16) {
      errs.cardNumber = 'Card number must be 16 digits';
    }
    if (!cardExpiry.trim() || !/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      errs.cardExpiry = 'Expiry must be in MM/YY format';
    }
    if (!cardCvv.trim() || cardCvv.length < 3 || cardCvv.length > 4) {
      errs.cardCvv = 'CVV must be 3 or 4 digits';
    }

    setPaymentErrors(errs);
    return Object.keys(errs).length === 0;
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

    const res = await api.post<Order>('/orders', { shippingAddress: address });

    if (res.success && res.data) {
      await refreshCart();
      router.push(`/orders/${res.data._id}`);
    } else {
      setError(res.message ?? 'Failed to place order. Please try again.');
      setPlacing(false);
    }
  }

  const items: CartItem[] = cart?.items ?? [];
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const shipping = subtotal >= 7500 ? 0 : 599; // Free shipping over $75
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

            {/* Step 2: Payment Details Form */}
            {step === 'payment' && (
              <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-sm/5 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <h2 className="text-base font-extrabold text-gray-900 uppercase tracking-wider">Payment Details</h2>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="cardName" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Name on Card</label>
                    <input
                      id="cardName"
                      type="text"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className={inputClass}
                      placeholder="Jane Doe"
                    />
                    {paymentErrors.cardName && <p className="text-[10px] text-red-500 font-semibold mt-1">{paymentErrors.cardName}</p>}
                  </div>

                  <div>
                    <label htmlFor="cardNumber" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Card Number</label>
                    <input
                      id="cardNumber"
                      type="text"
                      maxLength={19}
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim())}
                      className={inputClass}
                      placeholder="4111 2222 3333 4444"
                    />
                    {paymentErrors.cardNumber && <p className="text-[10px] text-red-500 font-semibold mt-1">{paymentErrors.cardNumber}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="cardExpiry" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Expiration Date</label>
                      <input
                        id="cardExpiry"
                        type="text"
                        maxLength={5}
                        value={cardExpiry}
                        onChange={(e) => {
                          let val = e.target.value.replace(/\D/g, '');
                          if (val.length > 2) val = `${val.substring(0, 2)}/${val.substring(2, 4)}`;
                          setCardExpiry(val);
                        }}
                        className={inputClass}
                        placeholder="MM/YY"
                      />
                      {paymentErrors.cardExpiry && <p className="text-[10px] text-red-500 font-semibold mt-1">{paymentErrors.cardExpiry}</p>}
                    </div>

                    <div>
                      <label htmlFor="cardCvv" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">CVV Code</label>
                      <input
                        id="cardCvv"
                        type="password"
                        maxLength={4}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                        className={inputClass}
                        placeholder="•••"
                      />
                      {paymentErrors.cardCvv && <p className="text-[10px] text-red-500 font-semibold mt-1">{paymentErrors.cardCvv}</p>}
                    </div>
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
                    <p className="text-sm font-bold text-gray-900">Credit Card</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Cardholder: {cardName} <br />
                      Number: •••• •••• •••• {cardNumber.slice(-4)}
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
                    {placing ? 'Placing Order…' : 'Place Order Now'}
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
