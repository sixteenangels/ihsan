import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { CartItem, Product, ProductVariant, ShippingOption } from '@/types';

interface CartContextType {
  items: CartItem[];
  selectedShipping: ShippingOption | null;
  selectedItemIds: string[];
  addToCart: (product: Product, variant: ProductVariant | null, quantity?: number) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateVariant: (itemId: string, variant: ProductVariant) => void;
  clearCart: () => void;
  setShipping: (shipping: ShippingOption) => void;
  toggleItemSelection: (itemId: string) => void;
  setSelectedItemIds: (ids: string[]) => void;
  totalItems: number;
  subtotal: number;
  shippingCost: number;
  total: number;
}

const STORAGE_KEY = 'ihsan_cart_v2';

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [selectedItemIds, setSelectedItemIdsState] = useState<string[]>([]);

  // Persist cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore quota errors
    }
  }, [items]);

  // Default-select all items whenever the cart changes
  useEffect(() => {
    setSelectedItemIdsState(items.map((i) => i.id));
  }, [items.length]);

  const addToCart = (product: Product, variant: ProductVariant | null, quantity = 1) => {
    setItems((prev) => {
      // Build a synthetic "not selected" variant when none provided
      const effectiveVariant: ProductVariant =
        variant ?? {
          id: `__novariant__${product.id}`,
          color: undefined,
          size: undefined,
          price: product.basePrice,
          stock: 0,
        };

      const existingItem = prev.find(
        (item) => item.product.id === product.id && item.variant.id === effectiveVariant.id
      );

      if (existingItem) {
        return prev.map((item) =>
          item.id === existingItem.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [
        ...prev,
        {
          id: `${product.id}-${effectiveVariant.id}-${Date.now()}`,
          product,
          variant: effectiveVariant,
          quantity,
        },
      ];
    });
  };

  const removeFromCart = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantity } : item))
    );
  };

  const updateVariant = (itemId: string, variant: ProductVariant) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, variant } : item))
    );
  };

  const clearCart = () => {
    setItems([]);
    setSelectedShipping(null);
  };

  const setShipping = (shipping: ShippingOption) => {
    setSelectedShipping(shipping);
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIdsState((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const setSelectedItemIds = (ids: string[]) => setSelectedItemIdsState(ids);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce(
    (sum, item) => sum + item.variant.price * item.quantity,
    0
  );
  const shippingCost = selectedShipping?.price || 0;
  const total = subtotal + shippingCost;

  return (
    <CartContext.Provider
      value={{
        items,
        selectedShipping,
        selectedItemIds,
        addToCart,
        removeFromCart,
        updateQuantity,
        updateVariant,
        clearCart,
        setShipping,
        toggleItemSelection,
        setSelectedItemIds,
        totalItems,
        subtotal,
        shippingCost,
        total,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

// Helper for components that need to know whether a cart item has a real variant chosen
export function isVariantPlaceholder(variantId: string): boolean {
  return variantId.startsWith('__novariant__');
}
