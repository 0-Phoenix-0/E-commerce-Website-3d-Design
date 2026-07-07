'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatCents, formatDate, shortId } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import type { Order } from '@/types';

type ProfileTab = 'orders' | 'addresses' | 'settings';

interface SavedAddress {
  id: string;
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  isDefault: boolean;
}

function OrdersContent() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get active tab from URL query, default to 'orders'
  const activeTab = (searchParams.get('tab') as ProfileTab) || 'orders';

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Address State
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  
  const [addrName, setAddrName] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrZip, setAddrZip] = useState('');
  const [addrCountry, setAddrCountry] = useState('United States');

  // Settings State
  const [settingsName, setSettingsName] = useState('');
  const [settingsEmail, setSettingsEmail] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');

  const fetchOrders = useCallback(async (p = 1) => {
    setLoading(true);
    const res = await api.get<Order[]>(`/orders/my?page=${p}&limit=10`);
    if (res.success) {
      setOrders(res.data ?? []);
      setTotal(res.total ?? 0);
      setPage(res.page ?? 1);
      setPages(res.pages ?? 1);
    }
    setLoading(false);
  }, []);

  // Fetch initial data
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/login');
        return;
      }
      setSettingsName(user.name);
      setSettingsEmail(user.email);
      fetchOrders();

      // Load mock addresses from localStorage
      const saved = localStorage.getItem('profile_addresses');
      if (saved) {
        setAddresses(JSON.parse(saved));
      } else {
        const defaultList: SavedAddress[] = [
          {
            id: 'addr-1',
            name: 'Home Address',
            street: '123 Main Street, Apt 4B',
            city: 'New York',
            state: 'NY',
            zip: '10001',
            country: 'United States',
            isDefault: true,
          },
        ];
        setAddresses(defaultList);
        localStorage.setItem('profile_addresses', JSON.stringify(defaultList));
      }
    }
  }, [user, authLoading, router, fetchOrders]);

  function handleTabChange(tab: ProfileTab) {
    router.push(`/orders?tab=${tab}`);
  }

  // Address logic
  function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!addrName || !addrStreet || !addrCity || !addrState || !addrZip) return;

    let updated: SavedAddress[];
    if (editingAddressId) {
      updated = addresses.map((a) =>
        a.id === editingAddressId
          ? { ...a, name: addrName, street: addrStreet, city: addrCity, state: addrState, zip: addrZip, country: addrCountry }
          : a
      );
    } else {
      const newAddr: SavedAddress = {
        id: `addr-${Date.now()}`,
        name: addrName,
        street: addrStreet,
        city: addrCity,
        state: addrState,
        zip: addrZip,
        country: addrCountry,
        isDefault: addresses.length === 0,
      };
      updated = [...addresses, newAddr];
    }

    setAddresses(updated);
    localStorage.setItem('profile_addresses', JSON.stringify(updated));
    resetAddressForm();
  }

  function deleteAddress(id: string) {
    const updated = addresses.filter((a) => a.id !== id);
    // If we deleted the default address, make the first remaining default
    if (updated.length > 0 && !updated.some((a) => a.isDefault)) {
      updated[0].isDefault = true;
    }
    setAddresses(updated);
    localStorage.setItem('profile_addresses', JSON.stringify(updated));
  }

  function setAsDefaultAddress(id: string) {
    const updated = addresses.map((a) => ({ ...a, isDefault: a.id === id }));
    setAddresses(updated);
    localStorage.setItem('profile_addresses', JSON.stringify(updated));
  }

  function startEditAddress(addr: SavedAddress) {
    setEditingAddressId(addr.id);
    setAddrName(addr.name);
    setAddrStreet(addr.street);
    setAddrCity(addr.city);
    setAddrState(addr.state);
    setAddrZip(addr.zip);
    setAddrCountry(addr.country);
    setShowAddressForm(true);
  }

  function resetAddressForm() {
    setEditingAddressId(null);
    setAddrName('');
    setAddrStreet('');
    setAddrCity('');
    setAddrState('');
    setAddrZip('');
    setAddrCountry('United States');
    setShowAddressForm(false);
  }

  // Settings logic
  function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsMessage('Settings saved successfully!');
    setTimeout(() => setSettingsMessage(''), 3000);
  }

  if (authLoading || (loading && activeTab === 'orders')) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-pulse">
        <div className="h-8 w-40 bg-gray-250 rounded-lg mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-xl" />
            ))}
          </div>
          <div className="md:col-span-3 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-2xl" />
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
          
          {/* Sidebar Navigation */}
          <aside className="space-y-1 bg-white p-4 rounded-2xl border border-gray-150 shadow-sm/5">
            <div className="px-3 py-2.5 mb-2 border-b border-gray-100 pb-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">User Profile</p>
              <p className="text-sm font-bold text-gray-900 truncate mt-1">{user?.name}</p>
              <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
            </div>
            
            <button
              onClick={() => handleTabChange('orders')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'orders' ? 'bg-gray-950 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              My Orders
            </button>
            <Link
              href="/wishlist"
              className="block w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              My Wishlist
            </Link>
            <button
              onClick={() => handleTabChange('addresses')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'addresses' ? 'bg-gray-950 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              Addresses
            </button>
            <button
              onClick={() => handleTabChange('settings')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'settings' ? 'bg-gray-950 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              Settings
            </button>
            <hr className="my-2 border-gray-100" />
            <button
              onClick={async () => { await logout(); router.push('/'); }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-red-650 hover:bg-red-50 transition-colors"
            >
              Sign out
            </button>
          </aside>

          {/* Active Tab Panel */}
          <div className="md:col-span-3 min-h-64">

            {/* ORDERS TAB */}
            {activeTab === 'orders' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-gray-950 uppercase tracking-wider">Order History</h2>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{total} Orders total</span>
                </div>

                {orders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-gray-150 p-6 shadow-sm/5">
                    <p className="text-base font-bold text-gray-900 mb-1">No orders yet</p>
                    <p className="text-xs text-gray-400 mb-6 max-w-xs">Once you purchase items from the catalog shop, they will show up here.</p>
                    <Link href="/products" className="px-6 py-2.5 bg-gray-950 hover:bg-gray-900 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow transition-all active:scale-95">
                      Start Shopping
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((order) => (
                      <Link
                        key={order._id}
                        href={`/orders/${order._id}`}
                        className="block bg-white rounded-2xl border border-gray-150 hover:border-gray-250 hover:shadow-sm/5 transition-all p-5 shadow-sm/5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-xs font-mono font-bold text-gray-800 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
                                {shortId(order._id)}
                              </span>
                              <StatusBadge status={order.status} />
                            </div>
                            <p className="text-[10px] font-semibold text-gray-400 mt-2">
                              Ordered on {formatDate(order.createdAt)} · {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                              {order.items.map((i) => i.name).join(', ')}
                            </p>
                          </div>
                          <div className="shrink-0 text-right flex flex-col items-end">
                            <p className="text-sm font-extrabold text-gray-950">{formatCents(order.totalAmount)}</p>
                            <svg className="w-4 h-4 text-gray-400 mt-2" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </Link>
                    ))}

                    {/* Pagination */}
                    {pages > 1 && (
                      <div className="flex justify-center gap-2 mt-6">
                        <button
                          disabled={page === 1}
                          onClick={() => fetchOrders(page - 1)}
                          className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <button
                          disabled={page === pages}
                          onClick={() => fetchOrders(page + 1)}
                          className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ADDRESSES TAB */}
            {activeTab === 'addresses' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h2 className="text-base font-extrabold text-gray-950 uppercase tracking-wider">Address Book</h2>
                  {!showAddressForm && (
                    <button
                      onClick={() => setShowAddressForm(true)}
                      className="px-4 py-2 bg-gray-950 hover:bg-gray-900 text-white text-xs font-bold uppercase tracking-wider rounded-full transition-all"
                    >
                      Add Address
                    </button>
                  )}
                </div>

                {/* Add Address Form */}
                {showAddressForm && (
                  <form onSubmit={saveAddress} className="bg-white rounded-3xl border border-gray-150 p-6 shadow-sm/5 space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      {editingAddressId ? 'Edit Address' : 'New Address'}
                    </h3>
                    
                    <div className="space-y-3">
                      <input
                        type="text"
                        required
                        placeholder="Address Label (e.g. Home, Work)"
                        value={addrName}
                        onChange={(e) => setAddrName(e.target.value)}
                        className="block w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-semibold focus:border-gray-950 focus:outline-none"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Street Address Line 1"
                        value={addrStreet}
                        onChange={(e) => setAddrStreet(e.target.value)}
                        className="block w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-semibold focus:border-gray-950 focus:outline-none"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="City"
                          value={addrCity}
                          onChange={(e) => setAddrCity(e.target.value)}
                          className="block w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-semibold focus:border-gray-950 focus:outline-none"
                        />
                        <input
                          type="text"
                          required
                          placeholder="State"
                          value={addrState}
                          onChange={(e) => setAddrState(e.target.value)}
                          className="block w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-semibold focus:border-gray-950 focus:outline-none"
                        />
                        <input
                          type="text"
                          required
                          placeholder="ZIP / Postal"
                          value={addrZip}
                          onChange={(e) => setAddrZip(e.target.value)}
                          className="block w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-semibold focus:border-gray-950 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={resetAddressForm}
                        className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-500 text-xs font-bold rounded-xl transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-gray-950 hover:bg-gray-900 text-white text-xs font-bold rounded-xl transition-all shadow"
                      >
                        Save Address
                      </button>
                    </div>
                  </form>
                )}

                {/* Addresses display grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="bg-white rounded-2xl border border-gray-150 p-5 shadow-sm/5 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-gray-900">{addr.name}</span>
                          {addr.isDefault && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-green-700 bg-green-50 px-2 py-0.5 rounded">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          {addr.street} <br />
                          {addr.city}, {addr.state} {addr.zip} <br />
                          {addr.country}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 mt-4 border-t border-gray-50 pt-3">
                        <button
                          onClick={() => startEditAddress(addr)}
                          className="text-[10px] font-bold text-gray-500 hover:text-gray-900 uppercase tracking-wider"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteAddress(addr.id)}
                          className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase tracking-wider"
                        >
                          Delete
                        </button>
                        {!addr.isDefault && (
                          <button
                            onClick={() => setAsDefaultAddress(addr.id)}
                            className="text-[10px] font-bold text-blue-655 hover:text-blue-700 uppercase tracking-wider ml-auto"
                          >
                            Set Default
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <h2 className="text-base font-extrabold text-gray-950 uppercase tracking-wider border-b border-gray-100 pb-3">
                  Account Settings
                </h2>

                {settingsMessage && (
                  <div className="rounded-xl bg-green-50 border border-green-200 text-green-800 text-xs font-semibold px-4 py-3">
                    {settingsMessage}
                  </div>
                )}

                <form onSubmit={saveSettings} className="bg-white rounded-3xl border border-gray-150 p-6 shadow-sm/5 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Name</label>
                    <input
                      type="text"
                      required
                      value={settingsName}
                      onChange={(e) => setSettingsName(e.target.value)}
                      className="block w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold focus:border-gray-950 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={settingsEmail}
                      onChange={(e) => setSettingsEmail(e.target.value)}
                      className="block w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold focus:border-gray-950 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Account Role</label>
                    <input
                      disabled
                      type="text"
                      value={user?.role?.toUpperCase() || 'USER'}
                      className="block w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold bg-gray-50 text-gray-400 cursor-not-allowed"
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-gray-950 hover:bg-gray-900 text-white text-xs font-bold uppercase tracking-wider rounded-full transition-all shadow-md active:scale-95"
                  >
                    Save Settings
                  </button>
                </form>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center text-sm font-semibold text-gray-400">Loading profile panel...</div>}>
      <OrdersContent />
    </Suspense>
  );
}
