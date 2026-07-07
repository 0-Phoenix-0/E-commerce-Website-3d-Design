'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatCents, formatDate, shortId } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import type { Order } from '@/types';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) { router.replace('/login'); return; }
      api.get<Order>(`/orders/my/${id}`).then((res) => {
        if (res.success && res.data) setOrder(res.data);
        else setNotFound(true);
        setLoading(false);
      });
    }
  }, [user, authLoading, router, id]);

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-pulse">
        <div className="h-4 w-48 bg-gray-100 rounded mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
          </div>
          <div className="h-56 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <p className="text-xl font-bold text-gray-900 mb-2">Order not found</p>
        <p className="text-gray-400 mb-8">This order doesn&apos;t exist or you don&apos;t have access to it.</p>
        <Link href="/orders" className="px-6 py-3 bg-gray-900 text-white text-sm font-semibold rounded-full hover:bg-gray-800 transition-colors">
          Back to Orders
        </Link>
      </div>
    );
  }

  const isNew = order.status === 'pending';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
          <Link href="/orders" className="hover:text-gray-600 transition-colors">My Orders</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">{shortId(order._id)}</span>
        </nav>

        {/* Success banner for fresh orders */}
        {isNew && (
          <div className="mb-8 rounded-2xl bg-green-50 border border-green-200 px-6 py-5 flex items-start gap-4">
            <div className="shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-green-800">Order placed successfully!</p>
              <p className="text-sm text-green-700 mt-0.5">
                We&apos;ve received your order and it&apos;s being processed. We&apos;ll notify you when it ships.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* Items */}
          <div className="md:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Items Ordered</h2>
                <StatusBadge status={order.status} />
              </div>
              <div className="divide-y divide-gray-50">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 px-6 py-4">
                    {/* Image thumbnail */}
                    <div className="w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-200">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatCents(item.price)} × {item.quantity}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-gray-900">
                      {formatCents(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 px-6 py-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal</span>
                  <span className="font-medium text-gray-800">{formatCents(order.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Shipping</span>
                  <span className="font-medium text-green-600">Free</span>
                </div>
                <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-100 pt-2">
                  <span>Total</span>
                  <span>{formatCents(order.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Info sidebar */}
          <div className="space-y-4">
            {/* Order info */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Order Info</h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-gray-400 text-xs">Order ID</dt>
                  <dd className="font-mono font-medium text-gray-800 mt-0.5">{shortId(order._id)}</dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-xs">Placed</dt>
                  <dd className="font-medium text-gray-800 mt-0.5">{formatDate(order.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-xs">Status</dt>
                  <dd className="mt-1"><StatusBadge status={order.status} /></dd>
                </div>
              </dl>
            </div>

            {/* Shipping address */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Ship To</h3>
              <address className="text-sm text-gray-700 not-italic space-y-0.5">
                <p className="font-semibold text-gray-900">{order.shippingAddress.fullName}</p>
                <p>{order.shippingAddress.addressLine1}</p>
                {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</p>
                <p>{order.shippingAddress.country}</p>
              </address>
            </div>

            <Link href="/orders" className="block w-full py-2.5 text-center text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
              ← Back to all orders
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
