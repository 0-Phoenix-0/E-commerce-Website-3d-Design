'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import type { Category, Product } from '@/types';

type SortOption = 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'rating_desc';

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  price_asc: 'Price: Low to High',
  price_desc: 'Price: High to Low',
  rating_desc: 'Top Rated',
};

function ProductsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL state
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [categoryId, setCategoryId] = useState(searchParams.get('category') ?? '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') ?? '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') ?? '');
  const [sort, setSort] = useState<SortOption>((searchParams.get('sort') as SortOption) ?? 'newest');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1'));

  // Filter States
  const [selectedBrand, setSelectedBrand] = useState(searchParams.get('brand') ?? '');
  const [availability, setAvailability] = useState<'all' | 'in-stock' | 'out-of-stock'>('all');
  const [minRating, setMinRating] = useState<number>(0);
  const [onlyDiscounted, setOnlyDiscounted] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Sync state variables with URL params
  const buildQuery = useCallback((overrides: Record<string, string | number> = {}) => {
    const params: Record<string, string> = {};
    if (q) params.q = q;
    if (categoryId) params.category = categoryId;
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    if (selectedBrand) params.brand = selectedBrand;
    if (sort !== 'newest') params.sort = sort;
    if (page > 1) params.page = String(page);
    
    Object.entries(overrides).forEach(([k, v]) => {
      if (v !== '' && v !== 0) params[k] = String(v);
      else delete params[k];
    });
    return new URLSearchParams(params).toString();
  }, [q, categoryId, minPrice, maxPrice, selectedBrand, sort, page]);

  // Load Categories and Brands
  useEffect(() => {
    api.get<Category[]>('/categories').then((res) => {
      if (res.success && res.data) setCategories(res.data);
    });
    // Fetch first 100 products to extract unique brands dynamically
    api.get<Product[]>('/products?limit=100').then((res) => {
      if (res.success && res.data) {
        const uniqueBrands = Array.from(
          new Set(res.data.map((p) => p.name.split(' ')[0]))
        ).filter(Boolean);
        setBrands(uniqueBrands);
      }
    });
  }, []);

  const fetchProducts = useCallback(
    async (p = page) => {
      setLoading(true);
      const params = new URLSearchParams({ limit: '12', sort, page: String(p) });
      
      // Combine search query and brand name for text-based backend retrieval
      const searchTerms = [q.trim(), selectedBrand].filter(Boolean).join(' ');
      if (searchTerms) params.set('q', searchTerms);
      
      if (categoryId) params.set('category', categoryId);
      if (minPrice) params.set('minPrice', String(Math.round(parseFloat(minPrice) * 100)));
      if (maxPrice) params.set('maxPrice', String(Math.round(parseFloat(maxPrice) * 100)));

      const res = await api.get<Product[]>(`/products?${params.toString()}`);
      if (res.success) {
        let list = res.data ?? [];
        
        // Availability client-side filter
        if (availability !== 'all') {
          list = list.filter((prod) =>
            availability === 'in-stock' ? prod.stock > 0 : prod.stock === 0
          );
        }

        // Rating client-side filter
        if (minRating > 0) {
          list = list.filter((prod) => {
            const code = prod._id.charCodeAt(prod._id.length - 1);
            const rating = 3.8 + (code % 13) / 10;
            return rating >= minRating;
          });
        }

        // Discount client-side filter
        if (onlyDiscounted) {
          list = list.filter((prod) => prod.compareAtPrice && prod.compareAtPrice > prod.price);
        }

        // Handle rating sorting on frontend if selected
        if (sort === 'rating_desc') {
          list = [...list].sort((a, b) => {
            const codeA = a._id.charCodeAt(a._id.length - 1);
            const ratingA = 3.8 + (codeA % 13) / 10;
            const codeB = b._id.charCodeAt(b._id.length - 1);
            const ratingB = 3.8 + (codeB % 13) / 10;
            return ratingB - ratingA;
          });
        }

        setProducts(list);
        setTotal(res.total ?? 0);
        setPages(res.pages ?? 1);
      }
      setLoading(false);
    },
    [q, selectedBrand, categoryId, minPrice, maxPrice, sort, page, availability, minRating, onlyDiscounted]
  );

  useEffect(() => {
    fetchProducts(page);
    router.replace(`/products?${buildQuery()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, selectedBrand, categoryId, minPrice, maxPrice, sort, page, availability, minRating, onlyDiscounted]);

  function clearFilters() {
    setQ('');
    setCategoryId('');
    setMinPrice('');
    setMaxPrice('');
    setSelectedBrand('');
    setAvailability('all');
    setMinRating(0);
    setOnlyDiscounted(false);
    setSort('newest');
    setPage(1);
    setFiltersOpen(false);
  }

  const hasActiveFilters = !!(
    q ||
    categoryId ||
    minPrice ||
    maxPrice ||
    selectedBrand ||
    availability !== 'all' ||
    minRating > 0 ||
    onlyDiscounted ||
    sort !== 'newest'
  );

  // Sidebar Filter Layout
  const SidebarContent = () => (
    <div className="space-y-6">
      
      {/* Categories */}
      <div>
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-3">Categories</h3>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => { setCategoryId(''); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              !categoryId
                ? 'bg-gray-950 text-white border-gray-950 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat._id}
              onClick={() => { setCategoryId(cat._id); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                categoryId === cat._id
                  ? 'bg-gray-950 text-white border-gray-950 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Brands */}
      <div>
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-3">Brands</h3>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => { setSelectedBrand(''); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              !selectedBrand
                ? 'bg-gray-950 text-white border-gray-950 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            All Brands
          </button>
          {brands.map((b) => (
            <button
              key={b}
              onClick={() => { setSelectedBrand(b); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                selectedBrand === b
                  ? 'bg-gray-950 text-white border-gray-950 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Price filter inputs */}
      <div>
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-3">Price Range (USD)</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-0 transition-colors bg-white"
          />
          <span className="text-gray-400 text-sm shrink-0">–</span>
          <input
            type="number"
            min="0"
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-0 transition-colors bg-white"
          />
        </div>
      </div>

      {/* Availability selector */}
      <div>
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-3">Availability</h3>
        <select
          value={availability}
          onChange={(e) => { setAvailability(e.target.value as any); setPage(1); }}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white text-gray-700 focus:border-gray-900 focus:outline-none transition-colors"
        >
          <option value="all">Show All Items</option>
          <option value="in-stock">In Stock Only</option>
          <option value="out-of-stock">Out of Stock</option>
        </select>
      </div>

      {/* Star Ratings */}
      <div>
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-3">Customer Rating</h3>
        <ul className="space-y-1.5">
          {[0, 4, 3, 2].map((stars) => (
            <li key={stars}>
              <button
                type="button"
                onClick={() => { setMinRating(stars); setPage(1); }}
                className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  minRating === stars
                    ? 'bg-gray-950 text-white border-gray-950 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-150 hover:bg-gray-50'
                }`}
              >
                <span>{stars === 0 ? 'All Ratings' : `${stars} ★ & Above`}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Sale filter toggle */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <label htmlFor="onlyDiscounted" className="text-xs font-bold text-gray-900 uppercase tracking-widest cursor-pointer select-none">
          Sale Items Only
        </label>
        <input
          id="onlyDiscounted"
          type="checkbox"
          checked={onlyDiscounted}
          onChange={(e) => { setOnlyDiscounted(e.target.checked); setPage(1); }}
          className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900 focus:ring-0 cursor-pointer"
        />
      </div>

      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="w-full py-2.5 mt-2 text-xs font-bold uppercase tracking-wider text-red-600 border border-red-200 bg-red-50/50 hover:bg-red-50 hover:text-red-700 rounded-xl transition-all"
        >
          Clear all filters
        </button>
      )}

    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">

        {/* Page header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              {categoryId
                ? (categories.find((c) => c._id === categoryId)?.name ?? 'Products')
                : q
                ? `Results for "${q}"`
                : 'All Products'}
            </h1>
            {!loading && (
              <p className="text-sm font-medium text-gray-400 mt-1">
                {total} {total === 1 ? 'product' : 'products'} available
              </p>
            )}
          </div>
          
          {/* Sorting controls */}
          <div className="flex items-center gap-3 self-end">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider shrink-0">Sort By</span>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value as SortOption); setPage(1); }}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 font-semibold focus:border-gray-950 focus:outline-none transition-colors shadow-sm"
            >
              {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">

          {/* Sidebar — desktop */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="bg-white rounded-2xl border border-gray-150 p-6 sticky top-24 shadow-sm/5 max-h-[80vh] overflow-y-auto">
              <SidebarContent />
            </div>
          </aside>

          {/* Main content grid */}
          <div className="flex-1 min-w-0">

            {/* Toolbar for mobile filter toggle */}
            <div className="flex items-center gap-3 mb-6 lg:hidden">
              <button
                onClick={() => setFiltersOpen(true)}
                className="flex items-center gap-2 px-4 py-3 w-full rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-gray-300 transition-colors shadow-sm justify-center"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                Filter & Sort Settings
                {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-blue-600" />}
              </button>
            </div>

            {/* Product display grid */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-2xl bg-white border border-gray-100 overflow-hidden animate-pulse shadow-sm/5">
                    <div className="aspect-square bg-gray-100" />
                    <div className="p-4 space-y-2.5">
                      <div className="h-3 w-20 bg-gray-100 rounded" />
                      <div className="h-4 w-full bg-gray-100 rounded" />
                      <div className="h-3.5 w-16 bg-gray-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-28 text-center bg-white rounded-2xl border border-gray-200/50 p-6 shadow-sm/5">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 mb-4 border border-gray-100">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">No Products Found</h3>
                <p className="text-sm text-gray-400 max-w-sm mb-6">Try adjusting your filters, modifying your search text, or select another category option.</p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center justify-center py-2.5 px-6 rounded-full bg-gray-950 text-white text-xs font-bold hover:bg-gray-800 transition-all active:scale-95 shadow"
                  >
                    Reset All Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-6">
                {products.map((p) => (
                  <ProductCard key={p._id} product={p} />
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {pages > 1 && !loading && (
              <div className="flex items-center justify-center gap-3 mt-12 border-t border-gray-100 pt-6">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  Previous
                </button>
                <span className="text-xs font-bold text-gray-500 tracking-wider">
                  Page {page} of {pages}
                </span>
                <button
                  disabled={page === pages}
                  onClick={() => setPage(page + 1)}
                  className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  Next
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Mobile filter drawer overlay */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setFiltersOpen(false)} />
          <div className="relative ml-auto w-80 h-full bg-white shadow-2xl overflow-y-auto p-6 flex flex-col justify-between animate-slide-in">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
                <h2 className="text-base font-bold text-gray-900 uppercase tracking-wider">Filters</h2>
                <button onClick={() => setFiltersOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-50 transition-colors">
                  <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <SidebarContent />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center text-sm font-semibold text-gray-400">Loading shop catalog...</div>}>
      <ProductsContent />
    </Suspense>
  );
}
