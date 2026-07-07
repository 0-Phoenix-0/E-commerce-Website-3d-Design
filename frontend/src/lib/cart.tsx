'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface CartContextValue {
  itemCount: number;
  addToCart: (productId: string, quantity?: number) => Promise<string | null>;
  removeFromCart: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [itemCount, setItemCount] = useState(0);

  const refreshCart = useCallback(async () => {
    if (!user) {
      setItemCount(0);
      return;
    }
    const res = await api.get<{ itemCount: number }>('/cart');
    if (res.success && res.data) {
      setItemCount(res.data.itemCount);
    }
  }, [user]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addToCart = useCallback(
    async (productId: string, quantity = 1): Promise<string | null> => {
      const res = await api.post<{ itemCount: number }>('/cart/add', { productId, quantity });
      if (res.success && res.data) {
        setItemCount(res.data.itemCount);
        return null;
      }
      return res.message ?? 'Failed to add to cart';
    },
    []
  );

  const removeFromCart = useCallback(async (productId: string): Promise<void> => {
    const res = await api.delete<{ itemCount: number }>(`/cart/${productId}`);
    if (res.success && res.data) setItemCount(res.data.itemCount);
  }, []);

  const updateQuantity = useCallback(
    async (productId: string, quantity: number): Promise<void> => {
      const res = await api.patch<{ itemCount: number }>(`/cart/${productId}`, { quantity });
      if (res.success && res.data) setItemCount(res.data.itemCount);
    },
    []
  );

  return (
    <CartContext.Provider value={{ itemCount, addToCart, removeFromCart, updateQuantity, refreshCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
