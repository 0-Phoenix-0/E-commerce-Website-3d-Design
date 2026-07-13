'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatCents, formatDate } from '@/lib/utils';
import ProductModal from '@/components/admin/ProductModal';
import BulkProductModal from '@/components/admin/BulkProductModal';
import type { Category, Product, ThreeDModel } from '@/types';

interface ProductList {
  data: Product[];
  total: number;
  page: number;
  pages: number;
}

type ThreeDRowState = {
  status: 'none' | 'processing' | 'ready' | 'failed';
  loading: boolean;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Per-product 3D state tracked locally (avoids full re-fetch for status changes)
  const [threeDStates, setThreeDStates] = useState<Record<string, ThreeDRowState>>({});
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchProducts = useCallback(async (p = 1) => {
    setLoading(true);
    const res = await api.get<ProductList>(`/products?page=${p}&limit=20`);
    if (res.success && res.data) {
      const envelope = res as unknown as ProductList & { success: boolean };
      const prods = envelope.data ?? [];
      setProducts(prods);
      setTotal(envelope.total ?? 0);
      setPage(envelope.page ?? 1);
      setPages(envelope.pages ?? 1);

      // Seed the 3D state map from the product data
      const initial: Record<string, ThreeDRowState> = {};
      prods.forEach((p) => {
        initial[p._id] = {
          status: (p.threeD?.status as ThreeDRowState['status']) ?? 'none',
          loading: false,
        };
      });
      setThreeDStates(initial);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
    api.get<Category[]>('/categories').then((res) => {
      if (res.success && res.data) setCategories(res.data);
    });
  }, [fetchProducts]);

  // ── 3D polling: poll every 5s for any rows that are processing ──────────
  useEffect(() => {
    const pollProcessing = async () => {
      const processingIds = Object.entries(threeDStates)
        .filter(([, s]) => s.status === 'processing')
        .map(([id]) => id);

      if (processingIds.length === 0) return;

      await Promise.all(
        processingIds.map(async (id) => {
          try {
            const res = await api.get<any>(`/products/${id}/3d`);
            if (res.success && res.data) {
              const status = (res.data as any).status as ThreeDRowState['status'];
              setThreeDStates((prev) => ({
                ...prev,
                [id]: { ...prev[id], status: status ?? 'none' },
              }));
            }
          } catch {
            // Ignore poll errors silently
          }
        })
      );
    };

    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    pollingIntervalRef.current = setInterval(pollProcessing, 5000);
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [threeDStates]);

  async function handleEnable3D(product: Product) {
    setThreeDStates((prev) => ({
      ...prev,
      [product._id]: { status: 'processing', loading: true },
    }));
    try {
      const res = await api.post<ThreeDModel>(`/products/${product._id}/3d/generate`, {});
      const newStatus = res.success ? 'processing' : 'failed';
      setThreeDStates((prev) => ({
        ...prev,
        [product._id]: { status: newStatus as ThreeDRowState['status'], loading: false },
      }));
    } catch {
      setThreeDStates((prev) => ({
        ...prev,
        [product._id]: { status: 'failed', loading: false },
      }));
    }
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openBulkCreate() {
    setBulkModalOpen(true);
  }

  function handleBulkModalSaved() {
    setBulkModalOpen(false);
    fetchProducts(page);
  }

  async function openEdit(product: Product) {
    const res = await api.get<Product>(`/products/${product._id}`);
    if (res.success && res.data) setEditing(res.data);
    setModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this product? This action is reversible only by an engineer.')) return;
    setDeletingId(id);
    await api.delete(`/products/${id}`);
    setDeletingId(null);
    fetchProducts(page);
  }

  function handleModalSaved() {
    setModalOpen(false);
    fetchProducts(page);
  }

  function categoryName(cat: Product['category']): string {
    return typeof cat === 'object' ? cat.name : '—';
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
          {!loading && <p className="text-sm text-gray-500 mt-0.5">{total} total</p>}
        </div>
        <div className="flex gap-2">
          <button
            id="bulk-product-btn"
            onClick={openBulkCreate}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4.5 h-4.5 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Multiple Products
          </button>
          <button
            id="new-product-btn"
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Product
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-100">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-lg animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">No products yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['Product', 'Category', 'Price', 'Stock', '3D Model', 'Added', 'Actions'].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((p) => {
                    const rowThreeD = threeDStates[p._id] ?? { status: 'none', loading: false };
                    return (
                      <tr key={p._id} className="hover:bg-gray-50 transition-colors">
                        {/* Product */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-gray-100 shrink-0 bg-gray-50">
                              {p.images[0] ? (
                                <Image src={p.images[0].url} alt={p.name} fill className="object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <span className="text-sm font-medium text-gray-900 line-clamp-1">{p.name}</span>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="px-6 py-4 text-sm text-gray-500">{categoryName(p.category)}</td>

                        {/* Price */}
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatCents(p.price)}</td>

                        {/* Stock */}
                        <td className="px-6 py-4">
                          <span className={`text-sm font-medium ${p.stock === 0 ? 'text-red-600' : p.stock < 10 ? 'text-yellow-600' : 'text-gray-900'}`}>
                            {p.stock}
                          </span>
                        </td>

                        {/* 3D Model Column */}
                        <td className="px-6 py-4">
                          <ThreeDCell
                            productId={p._id}
                            productSlug={p.slug}
                            state={rowThreeD}
                            onEnable={() => handleEnable3D(p)}
                          />
                        </td>

                        {/* Added */}
                        <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{formatDate(p.createdAt)}</td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <button onClick={() => openEdit(p)} className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">Edit</button>
                            <button
                              onClick={() => handleDelete(p._id)}
                              disabled={deletingId === p._id}
                              className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-40 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">Page {page} of {pages}</p>
                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => { setPage(page - 1); fetchProducts(page - 1); }}
                    className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page === pages}
                    onClick={() => { setPage(page + 1); fetchProducts(page + 1); }}
                    className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {modalOpen && (
        <ProductModal
          product={editing}
          categories={categories}
          onClose={() => setModalOpen(false)}
          onSaved={handleModalSaved}
        />
      )}

      {bulkModalOpen && (
        <BulkProductModal
          categories={categories}
          onClose={() => setBulkModalOpen(false)}
          onSaved={handleBulkModalSaved}
        />
      )}
    </div>
  );
}

// ── 3D Cell sub-component ────────────────────────────────────────────────────
function ThreeDCell({
  productId,
  productSlug,
  state,
  onEnable,
}: {
  productId: string;
  productSlug: string;
  state: ThreeDRowState;
  onEnable: () => void;
}) {
  if (state.status === 'ready') {
    return (
      <Link
        href={`/products/${productSlug}?view=3d`}
        target="_blank"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-2.5 py-1 rounded-full transition-colors"
        title="View 3D model"
      >
        <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        3D Ready
      </Link>
    );
  }

  if (state.status === 'processing') {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
        <span className="w-2.5 h-2.5 border-2 border-indigo-400/40 border-t-indigo-600 rounded-full animate-spin" />
        Generating…
      </div>
    );
  }

  if (state.status === 'failed') {
    return (
      <button
        id={`retry-3d-${productId}`}
        onClick={onEnable}
        disabled={state.loading}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
        title="Retry 3D generation"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
        Retry 3D
      </button>
    );
  }

  // Status is 'none' — show Enable button
  return (
    <button
      id={`enable-3d-${productId}`}
      onClick={onEnable}
      disabled={state.loading}
      className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
      title="Generate 3D model"
    >
      {state.loading ? (
        <span className="w-2.5 h-2.5 border-2 border-indigo-400/40 border-t-indigo-600 rounded-full animate-spin" />
      ) : (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      )}
      Enable 3D
    </button>
  );
}
