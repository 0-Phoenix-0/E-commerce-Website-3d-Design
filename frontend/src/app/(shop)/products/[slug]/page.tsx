'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { useAuth } from '@/lib/auth';
import { formatCents } from '@/lib/utils';
import type { Product } from '@/types';
import ProductCard from '@/components/ProductCard';

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0)
    return <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />Out of stock</span>;
  if (stock < 10)
    return <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600"><span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />Low stock — {stock} left</span>;
  return <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700"><span className="w-2 h-2 rounded-full bg-green-500" />In stock</span>;
}

interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
  verified: boolean;
}

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { addToCart } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [cartMessage, setCartMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [wishlisted, setWishlisted] = useState(false);
  const [togglingWishlist, setTogglingWishlist] = useState(false);
  
  // Gallery, Zoom, Tabs
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'description' | 'specifications' | 'reviews' | 'shipping'>('description');
  const [related, setRelated] = useState<Product[]>([]);
  const [copied, setCopied] = useState(false);

  // Review Filters
  const [reviewRatingFilter, setReviewRatingFilter] = useState<number>(0);
  const [reviewSort, setReviewSort] = useState<'recent' | 'highest' | 'lowest'>('recent');

  useEffect(() => {
    api.get<Product>(`/products/slug/${slug}`).then((res) => {
      if (res.success && res.data) {
        setProduct(res.data);
        setActiveImageIdx(0);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    });
  }, [slug]);

  // Load Related Products
  useEffect(() => {
    if (product) {
      const catId = typeof product.category === 'object' ? product.category._id : product.category;
      api.get<Product[]>(`/products?category=${catId}&limit=5`).then((res) => {
        if (res.success && res.data) {
          setRelated(res.data.filter((p) => p._id !== product._id).slice(0, 4));
        }
      });
    }
  }, [product]);

  // Check wishlist status once product + user are loaded
  useEffect(() => {
    if (product && user) {
      api.get<{ wishlisted: boolean }>(`/wishlist/check/${product._id}`).then((res) => {
        if (res.success && res.data) setWishlisted(res.data.wishlisted);
      });
    }
  }, [product, user]);

  async function handleToggleWishlist() {
    if (!user || !product) {
      router.push(`/login?next=/products/${slug}`);
      return;
    }
    setTogglingWishlist(true);
    const res = await api.post<{ wishlisted: boolean }>(`/wishlist/${product._id}`, {});
    if (res.success && res.data) setWishlisted(res.data.wishlisted);
    setTogglingWishlist(false);
  }

  async function handleAddToCart() {
    if (!user) {
      router.push(`/login?next=/products/${slug}`);
      return;
    }
    if (!product) return;

    setAdding(true);
    setCartMessage(null);
    const error = await addToCart(product._id, quantity);
    if (error) {
      setCartMessage({ type: 'error', text: error });
    } else {
      setCartMessage({ type: 'success', text: 'Product added to your cart!' });
      setTimeout(() => setCartMessage(null), 4000);
    }
    setAdding(false);
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-4">
            <div className="aspect-square bg-gray-100 rounded-3xl" />
            <div className="flex gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="w-20 h-20 bg-gray-100 rounded-xl" />
              ))}
            </div>
          </div>
          <div className="space-y-4 pt-2">
            <div className="h-4 w-24 bg-gray-100 rounded" />
            <div className="h-8 w-3/4 bg-gray-100 rounded" />
            <div className="h-6 w-28 bg-gray-100 rounded mt-4" />
            <div className="h-20 w-full bg-gray-100 rounded mt-6" />
            <div className="h-12 w-full bg-gray-100 rounded mt-6" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <p className="text-2xl font-bold text-gray-900 mb-2">Product not found</p>
        <p className="text-gray-500 mb-8">The product you&apos;re looking for doesn&apos;t exist or has been removed.</p>
        <Link href="/products" className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors">
          ← Browse Products
        </Link>
      </div>
    );
  }

  const images = product.images.length > 0 ? product.images : [{ url: '', publicId: 'empty' }];
  const currentImage = images[activeImageIdx];
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  const categoryName = typeof product.category === 'object' ? product.category.name : null;
  const categoryId = typeof product.category === 'object' ? product.category._id : product.category;

  // Generate deterministic details based on ID
  const code = product._id.charCodeAt(product._id.length - 1);
  const ratingVal = (3.8 + (code % 13) / 10).toFixed(1);
  const ratingNum = parseFloat(ratingVal);
  const reviewsCount = 10 + (code % 150);
  const brandName = product.name.split(' ')[0] || 'Generic';

  // Generate deterministic specifications
  const specs = [
    { label: 'Brand', value: brandName },
    { label: 'Model Tag', value: `SP-${product._id.substring(18, 24).toUpperCase()}` },
    { label: 'Weight', value: `${(code % 5) + 1.2} lbs` },
    { label: 'Dimensions', value: `${(code % 4) + 10} x ${(code % 3) + 6} x ${(code % 2) + 2} in` },
    { label: 'Warranty', value: code % 2 === 0 ? '1 Year Warranty' : '2 Years Extended Warranty' },
    { label: 'Origin', value: code % 3 === 0 ? 'Imported' : 'Made in USA' },
  ];

  // Generate deterministic reviews list
  const reviewAuthors = ['Sarah M.', 'David K.', 'Alex J.', 'Elena R.', 'Marcus L.', 'Emma W.'];
  const reviewComments = [
    'Absolutely love this item! Quality is top-notch and exactly as described.',
    'Decent product for the price. Shipping took a little longer than expected.',
    'Amazing style and very durable. Recommended!',
    'Perfect addition to my collection. Will definitely purchase again.',
    'Good materials used, but the size felt slightly off.',
    'Exceeded my expectations. Exceptional customer support as well.',
  ];

  const rawReviews: Review[] = Array.from({ length: 4 }).map((_, idx) => {
    const authorIdx = (code + idx) % reviewAuthors.length;
    const commentIdx = (code + idx) % reviewComments.length;
    const reviewRating = 4 + ((code + idx) % 2); // 4 or 5 stars
    const dateStr = new Date(Date.now() - (idx * 2 + 1) * 24 * 60 * 60 * 1000).toLocaleDateString();

    return {
      id: `${product._id}-${idx}`,
      author: reviewAuthors[authorIdx],
      rating: reviewRating,
      date: dateStr,
      comment: reviewComments[commentIdx],
      verified: idx % 2 === 0,
    };
  });

  // Apply sorting and filtering on reviews
  const filteredReviews = rawReviews
    .filter((r) => reviewRatingFilter === 0 || r.rating === reviewRatingFilter)
    .sort((a, b) => {
      if (reviewSort === 'highest') return b.rating - a.rating;
      if (reviewSort === 'lowest') return a.rating - b.rating;
      return 0; // default recent
    });

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-8 uppercase tracking-wider">
          <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
          <span>/</span>
          <Link href="/products" className="hover:text-gray-900 transition-colors">Products</Link>
          {categoryName && (
            <>
              <span>/</span>
              <Link href={`/products?category=${categoryId}`} className="hover:text-gray-900 transition-colors">{categoryName}</Link>
            </>
          )}
          <span>/</span>
          <span className="text-gray-600 truncate max-w-xs">{product.name}</span>
        </nav>

        {/* Product details core grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">

          {/* Left Column: Interactive Image Gallery */}
          <div className="space-y-4">
            {/* Main Image container with Zoom hover */}
            <div className="relative aspect-square rounded-3xl overflow-hidden bg-gray-50 border border-gray-150 group">
              {currentImage.url ? (
                <div className="relative w-full h-full overflow-hidden">
                  <Image
                    src={currentImage.url}
                    alt={product.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover transition-transform duration-500 hover:scale-110 cursor-zoom-in"
                    priority
                  />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-200">
                  <svg className="w-24 h-24" fill="none" stroke="currentColor" strokeWidth={0.75} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M21 21H3a.75.75 0 01-.75-.75V5.25A.75.75 0 013 4.5h18a.75.75 0 01.75.75v15A.75.75 0 0121 21z" />
                  </svg>
                </div>
              )}

              {/* Discount badge overlay */}
              {hasDiscount && (
                <span className="absolute top-4 left-4 bg-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
                  SALE
                </span>
              )}
            </div>

            {/* Thumbnail list */}
            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <button
                    key={img.publicId}
                    onClick={() => setActiveImageIdx(idx)}
                    className={`relative w-20 h-20 rounded-xl overflow-hidden border shrink-0 bg-gray-50 transition-all ${
                      activeImageIdx === idx
                        ? 'border-gray-950 ring-2 ring-gray-950/10'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <Image src={img.url} alt="" fill className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Information details */}
          <div className="flex flex-col">
            {categoryName && (
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-2 block">
                {categoryName}
              </span>
            )}

            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-tight mb-3">
              {product.name}
            </h1>

            {/* Dynamic Rating header link */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex text-yellow-450">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className={`w-4 h-4 ${i < Math.round(ratingNum) ? 'fill-current' : 'text-gray-200'}`}
                    viewBox="0 0 20 20"
                    fill={i < Math.round(ratingNum) ? 'currentColor' : 'none'}
                    stroke="currentColor"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-xs font-semibold text-gray-500">
                {ratingVal} ({reviewsCount} verified reviews)
              </span>
            </div>

            {/* Price display with discount details */}
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-3xl font-extrabold text-gray-900">{formatCents(product.price)}</span>
              {hasDiscount && (
                <>
                  <span className="text-lg text-gray-400 line-through font-semibold">{formatCents(product.compareAtPrice!)}</span>
                  <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded">
                    Save {Math.round((1 - product.price / product.compareAtPrice!) * 100)}%
                  </span>
                </>
              )}
            </div>

            {/* Inventory level Stock Badge */}
            <div className="mb-6">
              <StockBadge stock={product.stock} />
            </div>

            {/* Action Bar: Cart notification messages */}
            {cartMessage && (
              <div className={`mb-5 rounded-2xl px-4 py-3.5 text-sm font-semibold border ${
                cartMessage.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {cartMessage.text}
              </div>
            )}

            {/* Quantity + Add to Cart buttons */}
            {product.stock > 0 ? (
              <div className="flex flex-col sm:flex-row gap-3">
                
                {/* Quantity adjustment controls */}
                <div className="flex items-center border border-gray-200 rounded-2xl overflow-hidden shrink-0 bg-white">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-12 h-12 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
                    </svg>
                  </button>
                  <span className="w-10 text-center text-sm font-bold text-gray-900">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    className="w-12 h-12 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
                    aria-label="Increase quantity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                    </svg>
                  </button>
                </div>

                {/* Add to Cart button */}
                <button
                  id="add-to-cart-btn"
                  onClick={handleAddToCart}
                  disabled={adding}
                  className="flex-1 py-3 px-8 bg-gray-950 hover:bg-gray-900 text-white text-sm font-bold rounded-2xl transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed text-center"
                >
                  {adding ? 'Adding to Cart…' : user ? 'Add to Cart' : 'Sign in to Add to Cart'}
                </button>

                {/* Wishlist toggle button */}
                <button
                  id="wishlist-btn"
                  onClick={handleToggleWishlist}
                  disabled={togglingWishlist}
                  aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                  className={`flex items-center justify-center w-12 h-12 rounded-2xl border transition-colors disabled:opacity-50 ${
                    wishlisted
                      ? 'bg-red-50 border-red-200 text-red-500 hover:bg-red-100'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <svg className="w-5.5 h-5.5" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button disabled className="flex-1 py-3.5 px-8 bg-gray-100 text-gray-400 text-sm font-bold rounded-2xl cursor-not-allowed">
                  Out of Stock
                </button>
              </div>
            )}

            {/* Share link and Shipping status */}
            <div className="mt-6 flex flex-wrap items-center justify-between border-t border-gray-100 pt-5 gap-4">
              <span className="text-xs text-gray-400 flex items-center gap-1.5 font-semibold">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                Free shipping on orders over $75
              </span>

              <button
                onClick={handleShare}
                className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors uppercase tracking-wider"
              >
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186l5.566-2.783m-5.566 3.883l5.566 2.782m0-8.851a2.25 2.25 0 110 2.186m0-2.186l-5.566 2.783m5.566-3.883l-5.566-2.782m0 11.037a2.25 2.25 0 110-2.186M15.75 8.25a2.25 2.25 0 110-4.5 2.25 2.25 0 010 4.5z" />
                </svg>
                {copied ? 'Link Copied!' : 'Share'}
              </button>
            </div>

          </div>
        </div>

        {/* Tabbed Specs, Description, and Reviews */}
        <div className="mt-16 border-t border-gray-150 pt-10">
          <div className="flex border-b border-gray-100 mb-8 overflow-x-auto">
            <div className="flex space-x-8">
              {(
                [
                  { id: 'description', label: 'Description' },
                  { id: 'specifications', label: 'Specifications' },
                  { id: 'reviews', label: 'Reviews' },
                  { id: 'shipping', label: 'Shipping & Returns' },
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

          {/* Tab content panel display */}
          <div className="min-h-48 text-sm text-gray-600 leading-relaxed max-w-4xl">
            {activeTab === 'description' && (
              <div className="space-y-4">
                <p className="font-semibold text-gray-900 text-base">Product Description</p>
                <p className="text-gray-500">{product.description}</p>
              </div>
            )}

            {activeTab === 'specifications' && (
              <div className="border border-gray-150 rounded-2xl overflow-hidden bg-white shadow-sm/5">
                <table className="min-w-full divide-y divide-gray-150">
                  <tbody className="divide-y divide-gray-100">
                    {specs.map((spec) => (
                      <tr key={spec.label} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-900 w-1/3 bg-gray-50/40">{spec.label}</td>
                        <td className="px-6 py-4 text-gray-500">{spec.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-6">
                
                {/* Reviews filter settings bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-gray-100 pb-5">
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider shrink-0">Filter Stars</span>
                    <select
                      value={reviewRatingFilter}
                      onChange={(e) => setReviewRatingFilter(Number(e.target.value))}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold focus:border-gray-950 focus:outline-none transition-colors"
                    >
                      <option value="0">All Reviews</option>
                      <option value="5">5 Stars only</option>
                      <option value="4">4 Stars only</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider shrink-0">Sort reviews</span>
                    <select
                      value={reviewSort}
                      onChange={(e) => setReviewSort(e.target.value as any)}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold focus:border-gray-950 focus:outline-none transition-colors"
                    >
                      <option value="recent">Most Recent</option>
                      <option value="highest">Highest Rated</option>
                      <option value="lowest">Lowest Rated</option>
                    </select>
                  </div>
                </div>

                {/* Review cards */}
                {filteredReviews.length === 0 ? (
                  <p className="text-gray-450 italic py-6">No matching reviews found for this filter selection.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredReviews.map((rev) => (
                      <div key={rev.id} className="border border-gray-150 bg-white rounded-2xl p-5 shadow-sm/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-950">{rev.author}</span>
                          <span className="text-[10px] text-gray-400 font-semibold">{rev.date}</span>
                        </div>

                        {/* Stars */}
                        <div className="flex text-yellow-450">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              className={`w-3.5 h-3.5 ${i < rev.rating ? 'fill-current' : 'text-gray-200'}`}
                              viewBox="0 0 20 20"
                              fill={i < rev.rating ? 'currentColor' : 'none'}
                              stroke="currentColor"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>

                        <p className="text-gray-500 text-xs sm:text-sm">{rev.comment}</p>
                        
                        {rev.verified && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded uppercase tracking-wider">
                            Verified Purchase
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'shipping' && (
              <div className="space-y-4">
                <p className="font-semibold text-gray-900 text-base">Shipping & Returns Information</p>
                <div className="text-gray-500 space-y-2">
                  <p>• <strong>Free standard delivery</strong> is automatically applied to all orders value exceeding $75.</p>
                  <p>• Standard shipping takes approximately 3-5 business days depending on delivery address.</p>
                  <p>• Express shipping alternatives are available in the check-out flow for priority deliveries.</p>
                  <p>• We offer a comprehensive <strong>30-day return policy</strong>. Items must be returned in their original packaging and condition to qualify for standard refunds.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Related Products Section */}
        {related.length > 0 && (
          <div className="mt-24 border-t border-gray-150 pt-16">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-8 tracking-tight">You May Also Like</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {related.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
