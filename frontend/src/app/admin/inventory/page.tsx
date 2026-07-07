'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatCents } from '@/lib/utils';
import type { Product } from '@/types';

interface ProductEnvelope {
  data: Product[];
  total: number;
  page: number;
  pages: number;
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editingStock, setEditingStock] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchProducts = useCallback(async (p = 1) => {
    setLoading(true);
    const res = await api.get<ProductEnvelope>(`/products?page=${p}&limit=30`);
    const envelope = res as unknown as ProductEnvelope & { success: boolean };
    if (envelope.success) {
      setProducts(envelope.data ?? []);
      setTotal(envelope.total ?? 0);
      setPage(envelope.page ?? 1);
      setPages(envelope.pages ?? 1);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  function startEditStock(id: string, current: number) {
    setEditingStock((prev) => ({ ...prev, [id]: String(current) }));
  }

  function cancelEditStock(id: string) {
    setEditingStock((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function saveStock(id: string) {
    const newStock = parseInt(editingStock[id], 10);
    if (isNaN(newStock) || newStock < 0) return;
    setSavingId(id);
    const res = await api.patch(`/products/${id}/stock`, { stock: newStock });
    if (res.success) {
      setProducts((prev) =>
        prev.map((p) => (p._id === id ? { ...p, stock: newStock } : p))
      );
      cancelEditStock(id);
    }
    setSavingId(null);
  }

  function stockClass(stock: number) {
    if (stock === 0) return 'text-red-600 font-semibold';
    if (stock < 10) return 'text-yellow-600 font-semibold';
    return 'text-gray-900';
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Inventory</h1>
          {!loading && <p className="text-sm text-gray-500 mt-0.5">{total} products</p>}
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" /> Out of stock</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400" /> Low stock (&lt;10)</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-100">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="px-6 py-4 flex gap-6">
                <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">No products found.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['Product', 'Category', 'Price', 'Stock', 'Actions'].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((p) => {
                    const isEditing = editingStock[p._id] !== undefined;
                    return (
                      <tr key={p._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {typeof p.category === 'object' ? p.category.name : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{formatCents(p.price)}</td>
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={editingStock[p._id]}
                              onChange={(e) =>
                                setEditingStock((prev) => ({ ...prev, [p._id]: e.target.value }))
                              }
                              className="w-24 rounded-md border border-blue-400 px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <span className={`text-sm ${stockClass(p.stock)}`}>{p.stock}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => saveStock(p._id)}
                                disabled={savingId === p._id}
                                className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-40 transition-colors"
                              >
                                {savingId === p._id ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={() => cancelEditStock(p._id)}
                                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditStock(p._id, p.stock)}
                              className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                            >
                              Update stock
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">Page {page} of {pages}</p>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => fetchProducts(page - 1)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Previous</button>
                  <button disabled={page === pages} onClick={() => fetchProducts(page + 1)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
