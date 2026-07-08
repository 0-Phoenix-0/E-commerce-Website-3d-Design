'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Product } from '@/types';

interface AdminReview {
  reviewId: string;
  productName: string;
  productId: string;
  user?: string;
  reviewerName: string;
  rating: number;
  title: string;
  comment: string;
  date: string;
  verifiedPurchase: boolean;
  images?: { url: string; publicId: string }[];
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedRating, setSelectedRating] = useState('');
  const [selectedVerified, setSelectedVerified] = useState('all');

  // Pagination
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Fetch unique products list for the filter dropdown
  useEffect(() => {
    api.get<Product[]>('/products?limit=100').then((res) => {
      if (res.success && res.data) {
        setProductsList(res.data);
      }
    });
  }, []);

  const fetchReviews = useCallback(async (p = 1) => {
    setLoading(true);
    const query = new URLSearchParams({
      page: String(p),
      limit: '15',
    });

    if (search.trim()) query.set('search', search.trim());
    if (selectedProduct) query.set('productId', selectedProduct);
    if (selectedRating) query.set('rating', selectedRating);
    if (selectedVerified !== 'all') {
      query.set('verifiedPurchase', selectedVerified === 'verified' ? 'true' : 'false');
    }

    const res = await api.get<any>(`/admin/reviews?${query.toString()}`);
    if (res.success && res.data) {
      setReviews(res.data);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setPages(res.pages || 1);
    }
    setLoading(false);
  }, [search, selectedProduct, selectedRating, selectedVerified]);

  useEffect(() => {
    fetchReviews(1);
  }, [fetchReviews]);

  async function handleDelete(reviewId: string) {
    if (!confirm('Are you sure you want to delete this customer review?')) return;
    setDeletingId(reviewId);
    const res = await api.delete(`/admin/reviews/${reviewId}`);
    setDeletingId(null);
    if (res.success) {
      fetchReviews(page);
    } else {
      alert(res.message || 'Failed to delete review');
    }
  }

  return (
    <div className="p-8 max-w-6xl w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Reviews</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and moderate customer reviews across your store</p>
        </div>
        <div className="text-sm font-bold text-gray-400 uppercase bg-gray-50 border border-gray-150 px-3 py-1.5 rounded-lg">
          {total} Total Reviews
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm/5 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Search Input */}
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider">Search Reviews</label>
          <input
            type="text"
            placeholder="Search comment, title, name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-gray-950 focus:outline-none transition-colors"
          />
        </div>

        {/* Product Filter */}
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider">Filter by Product</label>
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-gray-950 focus:outline-none transition-colors bg-white"
          >
            <option value="">All Products</option>
            {productsList.map((p) => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Rating Filter */}
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider">Filter by Rating</label>
          <select
            value={selectedRating}
            onChange={(e) => setSelectedRating(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-gray-950 focus:outline-none transition-colors bg-white"
          >
            <option value="">All Ratings</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>{r} Stars</option>
            ))}
          </select>
        </div>

        {/* Verified Purchase Filter */}
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider">Verified Purchase</label>
          <select
            value={selectedVerified}
            onChange={(e) => setSelectedVerified(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-gray-950 focus:outline-none transition-colors bg-white"
          >
            <option value="all">All Purchases</option>
            <option value="verified">Verified Purchases Only</option>
            <option value="unverified">Standard Reviews Only</option>
          </select>
        </div>
      </div>

      {/* Reviews Table/List container */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm/5">
        {loading ? (
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="h-4 w-1/4 bg-gray-155 rounded" />
                <div className="h-4 w-2/4 bg-gray-155 rounded" />
                <div className="h-4 w-1/4 bg-gray-155 rounded" />
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400 italic">No reviews found matching the selected filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Reviewer</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Rating & Content</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {reviews.map((rev) => (
                  <tr key={rev.reviewId} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 w-1/5 max-w-[200px] truncate">
                      {rev.productName}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-950 w-1/6">
                      <div className="flex flex-col">
                        <span className="font-semibold">{rev.reviewerName}</span>
                        {rev.verifiedPurchase && (
                          <span className="inline-block self-start text-[8px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200 mt-1 uppercase tracking-wider">
                            Verified
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-500 max-w-sm">
                      <div className="flex flex-col space-y-1">
                        <div className="flex text-yellow-455">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              className={`w-3.5 h-3.5 ${i < rev.rating ? 'fill-current' : 'text-gray-250'}`}
                              viewBox="0 0 20 20"
                              fill={i < rev.rating ? 'currentColor' : 'none'}
                              stroke="currentColor"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        {rev.title && (
                          <span className="font-extrabold text-gray-900 text-xs">
                            {rev.title}
                          </span>
                        )}
                        <p className="text-xs text-gray-600 leading-normal">{rev.comment}</p>
                        {rev.images && rev.images.length > 0 && (
                          <div className="flex gap-1.5 mt-2">
                            {rev.images.map((img, idx) => (
                              <a
                                key={idx}
                                href={img.url}
                                target="_blank"
                                rel="noreferrer"
                                className="w-10 h-10 rounded border border-gray-200 bg-gray-50 overflow-hidden relative shrink-0 block"
                              >
                                <img src={img.url} alt="" className="object-cover w-full h-full" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-xs font-semibold text-gray-400 w-24">
                      {formatDate(rev.date)}
                    </td>

                    <td className="px-6 py-4 w-20">
                      <button
                        onClick={() => handleDelete(rev.reviewId)}
                        disabled={deletingId === rev.reviewId}
                        className="text-xs font-bold text-red-650 hover:text-red-700 transition-colors disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => fetchReviews(page - 1)}
            disabled={page === 1}
            className="px-3.5 py-1.5 border border-gray-300 text-xs font-bold text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-xs font-bold text-gray-400">
            Page {page} of {pages}
          </span>
          <button
            onClick={() => fetchReviews(page + 1)}
            disabled={page === pages}
            className="px-3.5 py-1.5 border border-gray-300 text-xs font-bold text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
