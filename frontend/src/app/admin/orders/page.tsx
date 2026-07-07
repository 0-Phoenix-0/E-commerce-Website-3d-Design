'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatCents, formatDate, shortId } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import type { Order, OrderStatus, User } from '@/types';

const STATUSES: OrderStatus[] = [
  'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled',
];

interface OrderEnvelope {
  data: (Order & { user: User })[];
  total: number;
  page: number;
  pages: number;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<(Order & { user: User })[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = useCallback(
    async (p = 1, status = statusFilter) => {
      setLoading(true);
      const query = status ? `&status=${status}` : '';
      const res = await api.get<OrderEnvelope>(`/admin/orders?page=${p}&limit=20${query}`);
      const envelope = res as unknown as OrderEnvelope & { success: boolean };
      if (envelope.success) {
        setOrders(envelope.data ?? []);
        setTotal(envelope.total ?? 0);
        setPage(envelope.page ?? 1);
        setPages(envelope.pages ?? 1);
      }
      setLoading(false);
    },
    [statusFilter]
  );

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function handleStatusChange(orderId: string, status: OrderStatus) {
    setUpdatingId(orderId);
    await api.patch(`/admin/orders/${orderId}/status`, { status });
    setUpdatingId(null);
    fetchOrders(page);
  }

  function handleFilterChange(s: string) {
    setStatusFilter(s);
    setPage(1);
    fetchOrders(1, s);
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>
          {!loading && <p className="text-sm text-gray-500 mt-0.5">{total} total</p>}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-100">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-6 py-4 flex gap-6">
                <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">No orders found.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['Order', 'Customer', 'Items', 'Total', 'Status', 'Date', 'Update Status'].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order) => (
                    <tr key={order._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono font-medium text-gray-700">{shortId(order._id)}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{order.user?.name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{order.user?.email ?? ''}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{order.items.length}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatCents(order.totalAmount)}</td>
                      <td className="px-6 py-4"><StatusBadge status={order.status} /></td>
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{formatDate(order.createdAt)}</td>
                      <td className="px-6 py-4">
                        <select
                          value={order.status}
                          disabled={updatingId === order._id}
                          onChange={(e) => handleStatusChange(order._id, e.target.value as OrderStatus)}
                          className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s} className="capitalize">
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">Page {page} of {pages}</p>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => fetchOrders(page - 1)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Previous</button>
                  <button disabled={page === pages} onClick={() => fetchOrders(page + 1)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
