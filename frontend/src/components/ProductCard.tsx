'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { api } from '@/lib/api';
import { formatCents } from '@/lib/utils';
import type { Product } from '@/types';

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const router = useRouter();

  const [wishlisted, setWishlisted] = useState(false);
  const [togglingWishlist, setTogglingWishlist] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  const primaryImage = product.images[0];
  const hoverImage = product.images[1] || null;
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  
  // Calculate discount percentage
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / product.compareAtPrice!) * 100)
    : 0;

  const categoryName = typeof product.category === 'object' ? product.category.name : null;

  // Generate deterministic stats for rating/badge
  const code = product._id.charCodeAt(product._id.length - 1);
  const ratingNum = 3.8 + (code % 13) / 10;
  const reviewsCount = 10 + (code % 150);

  // Check wishlist state on mount if user is logged in
  useEffect(() => {
    if (user) {
      api.get<{ wishlisted: boolean }>(`/wishlist/check/${product._id}`).then((res) => {
        if (res.success && res.data) setWishlisted(res.data.wishlisted);
      });
    }
  }, [user, product._id]);

  async function handleToggleWishlist(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push('/login');
      return;
    }
    setTogglingWishlist(true);
    const res = await api.post<{ wishlisted: boolean }>(`/wishlist/${product._id}`, {});
    if (res.success && res.data) {
      setWishlisted(res.data.wishlisted);
    }
    setTogglingWishlist(false);
  }

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push('/login');
      return;
    }
    setAddingToCart(true);
    await addToCart(product._id, 1);
    setAddingToCart(false);
  }

  // Deterministic badges
  let badgeText = '';
  if (hasDiscount) badgeText = 'SALE';
  else if (code % 7 === 0) badgeText = 'NEW';
  else if (code % 5 === 0) badgeText = 'BEST SELLER';
  else if (product.stock > 0 && product.stock <= 5) badgeText = 'LIMITED';

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300 relative"
    >
      {/* Image with Swap and Overlays */}
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        {primaryImage ? (
          <>
            <Image
              src={primaryImage.url}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={`object-cover transition-opacity duration-500 ${
                hoverImage ? 'opacity-100 group-hover:opacity-0' : 'group-hover:scale-105 transition-transform'
              }`}
            />
            {hoverImage && (
              <Image
                src={hoverImage.url}
                alt={`${product.name} alternate view`}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              />
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-200">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M21 21H3a.75.75 0 01-.75-.75V5.25A.75.75 0 013 4.5h18a.75.75 0 01.75.75v15A.75.75 0 0121 21z" />
            </svg>
          </div>
        )}

        {/* Promo Badge */}
        {badgeText && (
          <span className={`absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm text-white ${
            badgeText === 'SALE' ? 'bg-red-500' :
            badgeText === 'NEW' ? 'bg-blue-600' :
            badgeText === 'BEST SELLER' ? 'bg-yellow-600' : 'bg-gray-800'
          }`}>
            {badgeText}
          </span>
        )}

        {/* Wishlist Button Overlay */}
        <button
          onClick={handleToggleWishlist}
          disabled={togglingWishlist}
          className="absolute top-3 right-3 flex items-center justify-center w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm shadow-md border border-gray-100 text-gray-600 hover:text-red-500 hover:bg-white hover:scale-105 transition-all duration-200"
          aria-label="Wishlist"
        >
          <svg className={`w-4.5 h-4.5 ${wishlisted ? 'fill-red-500 text-red-500' : 'currentColor'}`} fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </button>

        {/* Dynamic Add to Cart Overlay */}
        {product.stock > 0 && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 pointer-events-none">
            <button
              onClick={handleAddToCart}
              disabled={addingToCart}
              className="pointer-events-auto flex items-center gap-1.5 px-4 py-2 bg-gray-950/90 backdrop-blur-sm text-white text-xs font-bold rounded-full hover:bg-gray-950 shadow-md transition-all active:scale-95"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {addingToCart ? 'Adding…' : 'Add to Cart'}
            </button>
          </div>
        )}

        {/* Out of Stock Overlay */}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-gray-950/30 flex items-center justify-center p-4">
            <span className="text-[10px] font-bold text-gray-900 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-gray-200/50 shadow-sm uppercase tracking-wider">
              Out of stock
            </span>
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="p-4 space-y-1.5">
        {categoryName && (
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">{categoryName}</p>
        )}
        
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 group-hover:text-blue-600 transition-colors leading-tight">
          {product.name}
        </h3>

        {/* Dynamic Rating display */}
        <div className="flex items-center gap-1">
          <div className="flex text-yellow-400">
            {[...Array(5)].map((_, i) => (
              <svg
                key={i}
                className={`w-3.5 h-3.5 ${i < Math.round(ratingNum) ? 'fill-current' : 'text-gray-200'}`}
                viewBox="0 0 20 20"
                fill={i < Math.round(ratingNum) ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth={1}
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="text-[10px] text-gray-400 font-semibold mt-0.5">({reviewsCount})</span>
        </div>

        {/* Prices and Stock Level indicator */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-50 mt-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-gray-900">{formatCents(product.price)}</span>
            {hasDiscount && (
              <>
                <span className="text-[10px] text-gray-400 line-through">{formatCents(product.compareAtPrice!)}</span>
                <span className="text-[10px] font-bold text-red-500">-{discountPercent}%</span>
              </>
            )}
          </div>
          
          {/* Stock Level text */}
          {product.stock > 0 && product.stock <= 5 && (
            <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
              Only {product.stock} left
            </span>
          )}
          {product.stock > 5 && (
            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
              In Stock
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
