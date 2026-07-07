'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { useAuth } from '@/lib/auth';
import { formatCents } from '@/lib/utils';
import type { Cart, CartItem } from '@/types';

export default function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const { removeFromCart, updateQuantity } = useCart();
  const router = useRouter();

  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState('');

  const fetchCart = useCallback(async () => {
    const res = await api.get<Cart>('/cart');
    if (res.success && res.data) setCart(res.data);
    setLoading(false);
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

  async function handleQuantityChange(productId: string, qty: number) {
    setUpdatingId(productId);
    await updateQuantity(productId, qty);
    await fetchCart();
    setUpdatingId(null);
  }

  async function handleRemove(productId: string) {
    setUpdatingId(productId);
    await removeFromCart(productId);
    await fetchCart();
    setUpdatingId(null);
  }

  function handleApplyCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCouponError('');
    if (couponCode.toUpperCase() === 'PROMO20') {
      setDiscountPercent(0.20); // 20% off
      setCouponApplied(true);
      setCouponCode('');
    } else {
      setCouponError('Invalid coupon code. Try "PROMO20".');
      setCouponApplied(false);
      setDiscountPercent(0);
    }
  }

  function handleRemoveCoupon() {
    setDiscountPercent(0);
    setCouponApplied(false);
    setCouponError('');
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-pulse">
        <div className="h-8 w-32 bg-gray-200 rounded-lg mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-2xl border border-gray-150" />
            ))}
          </div>
          <div className="h-64 bg-gray-100 rounded-2xl border border-gray-150" />
        </div>
      </div>
    );
  }

  const items: CartItem[] = cart?.items ?? [];
  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const discount = Math.round(subtotal * discountPercent);
  const discountedSubtotal = subtotal - discount;
  const shipping = subtotal >= 7500 || subtotal === 0 ? 0 : 599; // Free over $75
  const tax = Math.round(discountedSubtotal * 0.08); // 8% tax rate
  const total = discountedSubtotal + shipping + tax;

  const isEmpty = items.length === 0;

  return (
    <div className="min-h-screen bg-gray-50/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-8">Shopping Cart</h1>

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-3xl border border-gray-150 p-6 shadow-sm/5">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 mb-4 border border-gray-100">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
              </svg>
            </div>
            <p className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</p>
            <p className="text-sm text-gray-450 mb-8 max-w-sm">Looks like you haven&apos;t added any items to your shopping cart yet.</p>
            <Link href="/products" className="px-8 py-3 bg-gray-950 text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-gray-900 transition-all shadow-md active:scale-98">
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

            {/* Cart Items list */}
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => {
                const p = item.product;
                const isUpdating = updatingId === p._id;
                return (
                  <div
                    key={p._id}
                    className={`flex gap-4 bg-white rounded-2xl border border-gray-150 p-4 transition-all hover:shadow-sm/5 ${isUpdating ? 'opacity-50' : ''}`}
                  >
                    {/* Image */}
                    <Link href={`/products/${p.slug}`} className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                      {p.images[0] ? (
                        <Image src={p.images[0].url} alt={p.name} fill className="object-cover" sizes="96px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-200">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909" />
                          </svg>
                        </div>
                      )}
                    </Link>

                    {/* Details */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <Link href={`/products/${p.slug}`} className="block text-sm font-bold text-gray-900 hover:text-blue-600 transition-colors line-clamp-1">
                          {p.name}
                        </Link>
                        <p className="text-xs font-semibold text-gray-400 mt-0.5">
                          {typeof p.category === 'object' ? p.category.name : 'Shop'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-4 mt-2">
                        {/* Qty adjustment controls */}
                        <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white shrink-0">
                          <button
                            onClick={() => handleQuantityChange(p._id, Math.max(1, item.quantity - 1))}
                            disabled={isUpdating || item.quantity <= 1}
                            className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
                            </svg>
                          </button>
                          <span className="w-8 text-center text-xs font-bold text-gray-900">{item.quantity}</span>
                          <button
                            onClick={() => handleQuantityChange(p._id, Math.min(p.stock, item.quantity + 1))}
                            disabled={isUpdating || item.quantity >= p.stock}
                            className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                            </svg>
                          </button>
                        </div>

                        {/* Remove item button */}
                        <button
                          onClick={() => handleRemove(p._id)}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors p-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Total price for current item line */}
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-gray-900">{formatCents(p.price * item.quantity)}</p>
                    </div>

                  </div>
                );
              })}
            </div>

            {/* Cart Summary Panel */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-3xl border border-gray-150 p-6 sticky top-24 shadow-sm/5 space-y-6">
                <h2 className="text-lg font-bold text-gray-900">Order Summary</h2>

                {/* Pricing sub-metrics */}
                <div className="space-y-3.5 text-xs sm:text-sm border-b border-gray-100 pb-5">
                  <div className="flex justify-between text-gray-500 font-medium">
                    <span>Subtotal ({items.length} {items.length === 1 ? 'item' : 'items'})</span>
                    <span className="font-bold text-gray-900">{formatCents(subtotal)}</span>
                  </div>

                  {couponApplied && (
                    <div className="flex justify-between text-green-600 font-semibold bg-green-50/50 p-2.5 rounded-xl border border-green-100/50">
                      <span>Promo Discount (20%)</span>
                      <span>-{formatCents(discount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-gray-500 font-medium">
                    <span>Estimated Shipping</span>
                    <span className={`font-bold ${shipping === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                      {shipping === 0 ? 'Free' : formatCents(shipping)}
                    </span>
                  </div>

                  <div className="flex justify-between text-gray-500 font-medium">
                    <span>Estimated Tax (8%)</span>
                    <span className="font-bold text-gray-900">{formatCents(tax)}</span>
                  </div>
                </div>

                {/* Coupon form input */}
                <div>
                  {couponApplied ? (
                    <div className="flex items-center justify-between text-xs bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <span className="font-bold text-gray-600">Code applied: PROMO20</span>
                      <button
                        onClick={handleRemoveCoupon}
                        className="text-red-500 hover:text-red-700 font-semibold uppercase tracking-wider text-[10px]"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleApplyCoupon} className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder="Coupon Code"
                        className="flex-grow rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-semibold focus:border-gray-900 focus:outline-none transition-colors"
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 text-xs font-bold transition-all shrink-0 active:scale-95"
                      >
                        Apply
                      </button>
                    </form>
                  )}
                  {couponError && (
                    <p className="text-[10px] font-semibold text-red-500 mt-1.5">{couponError}</p>
                  )}
                </div>

                {/* Grand Total */}
                <div className="flex justify-between text-base font-extrabold text-gray-900">
                  <span>Grand Total</span>
                  <span>{formatCents(total)}</span>
                </div>

                {/* Action buttons */}
                <div className="space-y-2">
                  <Link
                    href="/checkout"
                    className="block w-full py-3.5 text-center text-xs font-bold uppercase tracking-wider text-white bg-gray-950 hover:bg-gray-900 rounded-full transition-all shadow-md active:scale-98"
                  >
                    Proceed to Checkout
                  </Link>

                  <Link
                    href="/products"
                    className="block w-full py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-gray-900 rounded-full border border-gray-200 hover:bg-gray-50 transition-all"
                  >
                    Continue Shopping
                  </Link>
                </div>

              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
