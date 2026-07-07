'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import ProductCard from '@/components/ProductCard';
import type { Product } from '@/types';

export default function WishlistPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWishlist = useCallback(async () => {
    const res = await api.get<Product[]>('/wishlist');
    if (res.success && res.data) setProducts(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/login');
        return;
      }
      fetchWishlist();
    }
  }, [user, authLoading, router, fetchWishlist]);

  if (authLoading || loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-pulse">
        <div className="h-8 w-40 bg-gray-200 rounded-lg mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-xl" />
            ))}
          </div>
          <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="aspect-square bg-gray-100 rounded-2xl border border-gray-150" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-8">My Account</h1>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
          
          {/* Shared Sidebar Navigation */}
          <aside className="space-y-1 bg-white p-4 rounded-2xl border border-gray-150 shadow-sm/5">
            <div className="px-3 py-2.5 mb-2 border-b border-gray-100 pb-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">User Profile</p>
              <p className="text-sm font-bold text-gray-900 truncate mt-1">{user?.name}</p>
              <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
            </div>
            
            <Link
              href="/orders"
              className="block w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              My Orders
            </Link>
            <Link
              href="/wishlist"
              className="block w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-gray-950 text-white shadow-sm"
            >
              My Wishlist
            </Link>
            <Link
              href="/orders?tab=addresses"
              className="block w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              Addresses
            </Link>
            <Link
              href="/orders?tab=settings"
              className="block w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              Settings
            </Link>
            <hr className="my-2 border-gray-100" />
            <button
              onClick={async () => { await logout(); router.push('/'); }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-red-650 hover:bg-red-50 transition-colors"
            >
              Sign out
            </button>
          </aside>

          {/* Wishlist Panel */}
          <div className="md:col-span-3 min-h-64 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-gray-950 uppercase tracking-wider">My Wishlist</h2>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                {products.length} {products.length === 1 ? 'item' : 'items'} saved
              </span>
            </div>

            {products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-gray-150 p-6 shadow-sm/5">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 mb-4 border border-gray-100">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                </div>
                <p className="text-base font-bold text-gray-900 mb-1">Your wishlist is empty</p>
                <p className="text-xs text-gray-400 mb-6 max-w-xs">Save products you love to your wishlist to keep track of them here.</p>
                <Link href="/products" className="px-6 py-2.5 bg-gray-950 hover:bg-gray-900 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow transition-all active:scale-95">
                  Browse Products
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {products.map((p) => (
                  <ProductCard key={p._id} product={p} />
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
