'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { api } from '@/lib/api';
import type { Category, Product } from '@/types';

type TabType = 'new-arrivals' | 'trending' | 'best-sellers' | 'top-rated' | 'recommended';

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('new-arrivals');
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Category[]>('/categories'),
      api.get<Product[]>('/products?limit=30')
    ]).then(([catRes, prodRes]) => {
      if (catRes.success && catRes.data) {
        setCategories(catRes.data.slice(0, 8));
      }
      if (prodRes.success && prodRes.data) {
        setAllProducts(prodRes.data);
      }
      setLoading(false);
    });
  }, []);

  // Helper to generate deterministic ratings/stats per product
  const getProductStats = (p: Product) => {
    const code = p._id.charCodeAt(p._id.length - 1);
    const rating = (3.8 + (code % 13) / 10).toFixed(1);
    const reviewsCount = 10 + (code % 150);
    const discount = p.compareAtPrice && p.compareAtPrice > p.price
      ? Math.round((1 - p.price / p.compareAtPrice) * 100)
      : 0;
    return { rating, reviewsCount, discount };
  };

  // Dynamic tab partitioning
  const getTabProducts = (): Product[] => {
    switch (activeTab) {
      case 'trending':
        // Sort by discount level
        return [...allProducts]
          .sort((a, b) => getProductStats(b).discount - getProductStats(a).discount)
          .slice(0, 8);
      case 'best-sellers':
        // Sort by low stock (simulating high sales velocity) but still in stock
        return [...allProducts]
          .filter((p) => p.stock > 0)
          .sort((a, b) => a.stock - b.stock)
          .slice(0, 8);
      case 'top-rated':
        // Sort by deterministic rating
        return [...allProducts]
          .sort((a, b) => parseFloat(getProductStats(b).rating) - parseFloat(getProductStats(a).rating))
          .slice(0, 8);
      case 'recommended':
        // Show mid-range popular pricing
        return [...allProducts]
          .filter((p) => p.price > 1500 && p.price < 15000)
          .slice(0, 8);
      case 'new-arrivals':
      default:
        // Default API order (newest first)
        return allProducts.slice(0, 8);
    }
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 5000);
    }
  };

  return (
    <>
      <Navbar />

      <main className="overflow-hidden">
        {/* ── Hero Section ──────────────────────────────────────────────────── */}
        <section className="relative bg-background text-text-primary overflow-hidden py-20 lg:py-32">
          {/* Subtle grid background — adapts via --border token */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-60" />
          {/* Ambient accent glow */}
          <div className="absolute -top-32 -right-24 w-[32rem] h-[32rem] rounded-full bg-accent/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-40 -left-24 w-[28rem] h-[28rem] rounded-full bg-accent/10 blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">

              {/* Left Column: Headline */}
              <div className="space-y-6 max-w-xl">
                <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-border text-xs font-semibold tracking-wider text-text-secondary uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  New Collection — 2026
                </p>
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] text-text-primary">
                  Crafted for <br />
                  <span className="text-text-muted font-light">Excellence &amp; Style.</span>
                </h1>
                <p className="text-base sm:text-lg text-text-secondary leading-relaxed">
                  Curated premium products built to perform. Discover carefully engineered pieces designed to elevate your daily routine.
                </p>
                <div className="flex flex-wrap gap-4 pt-2">
                  <Link
                    href="/products"
                    className="inline-flex items-center gap-2 px-6 py-3.5 bg-accent text-white text-sm font-semibold rounded-full hover:bg-accent-hover transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 duration-200"
                  >
                    Shop Collection
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </Link>
                  <a
                    href="#categories"
                    className="inline-flex items-center px-6 py-3.5 border border-border text-sm font-semibold text-text-secondary rounded-full hover:border-text-muted hover:text-text-primary transition-all duration-200"
                  >
                    Browse Categories
                  </a>
                </div>
              </div>

              {/* Right Column: Hero Image with Floating UI */}
              <div className="relative flex justify-center lg:justify-end">
                <div className="relative w-full max-w-md aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl border border-border ring-1 ring-accent/10">
                  <Image
                    src="https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=800&auto=format&fit=crop"
                    alt="Premium Lifestyle Collection"
                    fill
                    priority
                    className="object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                </div>

                {/* Floating Badge 1: Rating */}
                <div className="absolute -left-6 top-1/4 bg-surface/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-border animate-bounce" style={{ animationDuration: '6s' }}>
                  <div className="p-2 rounded-xl bg-gold-royal text-white">
                    <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-text-primary">4.9 / 5 Rating</p>
                    <p className="text-[10px] text-text-muted font-medium">From 12k+ Customers</p>
                  </div>
                </div>

                {/* Floating Badge 2: Bestseller overlay */}
                <div className="absolute -right-4 bottom-1/4 bg-surface/95 backdrop-blur-md px-4 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border border-border animate-bounce" style={{ animationDuration: '5s' }}>
                  <span className="flex h-3.5 w-3.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-accent"></span>
                  </span>
                  <div>
                    <p className="text-xs font-bold text-text-primary leading-tight">Bestseller Item</p>
                    <p className="text-[10px] text-text-muted font-medium mt-0.5">Top trending this week</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Trust Banner Section ─────────────────────────────────────────── */}
        <section className="bg-white border-b border-gray-100 py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-50 rounded-2xl text-gray-800 shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.75A1.125 1.125 0 012.625 17.625V4.625A1.125 1.125 0 013.75 3.5h11.25A1.125 1.125 0 0116.125 4.625v1.875m-9 12.375h9m-9 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.75A1.125 1.125 0 012.625 17.625V4.625A1.125 1.125 0 013.75 3.5h11.25A1.125 1.125 0 0116.125 4.625v1.875" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Free Shipping</h4>
                  <p className="text-xs text-gray-500 mt-0.5">On all orders over ₹7,164</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-50 rounded-2xl text-gray-800 shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Secure Checkout</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Encrypted payment gateway</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-50 rounded-2xl text-gray-800 shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">30-Day Returns</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Easy returns and exchanges</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-50 rounded-2xl text-gray-800 shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">24/7 Support</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Friendly support staff ready</p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Category Section ─────────────────────────────────────────────── */}
        <section id="categories" className="py-24 bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
              <div>
                <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-2">Collections</p>
                <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Shop by Category</h2>
              </div>
              <Link
                href="/products"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
              >
                All Products
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-10">No categories found.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                {categories.map((cat, i) => {
                  const num = (cat._id.charCodeAt(cat._id.length - 1) % 15) + 8;
                  const isSeed = cat.description === 'Seeded from DummyJSON';
                  const count = isSeed ? num : null;
                  const displayDesc = isSeed
                    ? `${num} Products`
                    : (cat.description || 'Premium Collection');

                  const palettes = [
                    { grad: 'from-blue-500 to-indigo-600', soft: 'bg-blue-500/15', ring: 'group-hover:ring-blue-400/40', text: 'group-hover:text-blue-500' },
                    { grad: 'from-emerald-500 to-teal-600', soft: 'bg-emerald-500/15', ring: 'group-hover:ring-emerald-400/40', text: 'group-hover:text-emerald-500' },
                    { grad: 'from-fuchsia-500 to-purple-600', soft: 'bg-fuchsia-500/15', ring: 'group-hover:ring-fuchsia-400/40', text: 'group-hover:text-fuchsia-500' },
                    { grad: 'from-orange-500 to-rose-600', soft: 'bg-orange-500/15', ring: 'group-hover:ring-orange-400/40', text: 'group-hover:text-orange-500' },
                    { grad: 'from-cyan-500 to-blue-600', soft: 'bg-cyan-500/15', ring: 'group-hover:ring-cyan-400/40', text: 'group-hover:text-cyan-500' },
                    { grad: 'from-amber-500 to-orange-600', soft: 'bg-amber-500/15', ring: 'group-hover:ring-amber-400/40', text: 'group-hover:text-amber-500' },
                  ];
                  const p = palettes[i % palettes.length];

                  return (
                    <Link
                      key={cat._id}
                      href={`/products?category=${cat._id}`}
                      className={`group relative flex flex-col justify-between bg-white rounded-2xl border border-gray-200/80 ring-1 ring-transparent ${p.ring} p-5 h-40 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300`}
                    >
                      {/* Soft corner glow */}
                      <div className={`absolute -top-8 -right-8 w-28 h-28 rounded-full ${p.soft} blur-2xl opacity-70 group-hover:opacity-100 transition-opacity`} />

                      {/* Top row: gradient badge + arrow */}
                      <div className="relative z-10 flex items-start justify-between">
                        <span className={`inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br ${p.grad} text-white font-extrabold text-lg shadow-md`}>
                          {cat.name.charAt(0).toUpperCase()}
                        </span>
                        <svg className="w-5 h-5 text-gray-300 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </div>

                      {/* Bottom: name + count */}
                      <div className="relative z-10">
                        <h3 className={`text-lg font-bold text-gray-900 ${p.text} transition-colors leading-tight`}>
                          {cat.name}
                        </h3>
                        <span className="block text-xs font-semibold text-gray-500 mt-1">
                          {count !== null ? `${count} products` : displayDesc}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

          </div>
        </section>

        {/* ── Featured Showcase Tabs ─────────────────────────────────────────── */}
        <section className="py-24 bg-gray-50/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-2xl mx-auto mb-12">
              <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-2">Catalog</p>
              <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Featured Products</h2>
              <p className="text-sm text-gray-500 mt-2">Explore our dynamic selections of top trending and premium quality items.</p>
            </div>

            {/* Tab Switched Header */}
            <div className="flex justify-center border-b border-gray-200 mb-10 overflow-x-auto pb-px">
              <div className="flex space-x-6 sm:space-x-8">
                {(
                  [
                    { id: 'new-arrivals', label: 'New Arrivals' },
                    { id: 'trending', label: 'Trending' },
                    { id: 'best-sellers', label: 'Best Sellers' },
                    { id: 'top-rated', label: 'Top Rated' },
                    { id: 'recommended', label: 'Recommended' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`pb-4 text-sm font-semibold tracking-wide border-b-2 whitespace-nowrap transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'border-gray-950 text-gray-950'
                        : 'border-transparent text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Catalog Grid */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="space-y-4">
                    <div className="aspect-square bg-gray-200 rounded-2xl animate-pulse" />
                    <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 w-1/3 bg-gray-200 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : getTabProducts().length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-12">No products found under this section.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
                {getTabProducts().map((p) => (
                  <ProductCard key={p._id} product={p} />
                ))}
              </div>
            )}

            <div className="text-center mt-12">
              <Link
                href="/products"
                className="inline-flex items-center justify-center py-3 px-8 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 duration-200"
              >
                View Catalog
              </Link>
            </div>

          </div>
        </section>

        {/* ── Newsletter Section ───────────────────────────────────────────── */}
        <section className="bg-white border-t border-gray-100 py-24 relative overflow-hidden">
          <div className="absolute -left-16 -top-16 w-64 h-64 bg-blue-50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 pointer-events-none" />
          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-indigo-50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 pointer-events-none" />
          
          <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8 relative z-10 space-y-6">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
              Subscribe to our Newsletter
            </h2>
            <p className="text-base text-gray-500 max-w-xl mx-auto leading-relaxed">
              Stay updated with our latest collections, exclusive offers, and product releases. Never miss a single drop.
            </p>

            <form onSubmit={handleSubscribe} className="max-w-md mx-auto flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="flex-grow rounded-full border border-gray-300 px-5 py-3 text-sm focus:border-gray-950 focus:outline-none focus:ring-1 focus:ring-gray-950 transition-colors bg-gray-50/50"
              />
              <button
                type="submit"
                className="rounded-full bg-gray-950 hover:bg-gray-900 text-white px-6 py-3 text-sm font-semibold shadow-md hover:shadow-lg transition-all shrink-0 active:scale-98"
              >
                Subscribe
              </button>
            </form>

            {subscribed && (
              <p className="text-sm font-semibold text-green-600 animate-fade-in">
                Thank you for subscribing! Keep an eye on your inbox.
              </p>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
