import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { STORAGE_KEYS, getStoredItem, removeStoredItems } from '@/lib/brand';
import { CartItem, Product, ProductVariant, ShippingOption } from '@/types';

type CartSyncState = 'local' | 'syncing' | 'synced' | 'error';

interface CartContextType {
  items: CartItem[];
  selectedItems: CartItem[];
  selectedShipping: ShippingOption | null;
  selectedItemIds: string[];
  cartSyncState: CartSyncState;
  lastSyncedAt: string | null;
  localOnlyItemCount: number;
  addToCart: (
    product: Product,
    variant: ProductVariant | null,
    quantity?: number,
    selectionMode?: 'preserve' | 'include' | 'only',
  ) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateVariant: (itemId: string, variant: ProductVariant) => void;
  clearCart: () => void;
  clearSelectedItems: () => void;
  setShipping: (shipping: ShippingOption) => void;
  toggleItemSelection: (itemId: string) => void;
  setSelectedItemIds: (ids: string[]) => void;
  totalItems: number;
  subtotal: number;
  selectedSubtotal: number;
  shippingCost: number;
  total: number;
}

type CartProductRow = Pick<
  Database['public']['Tables']['products']['Row'],
  | 'id'
  | 'name'
  | 'description'
  | 'base_price'
  | 'is_group_buy_eligible'
  | 'is_flash_deal'
  | 'is_free_shipping'
  | 'rating'
  | 'review_count'
> & {
  categories: {
    name: string;
  } | null;
};

type CartVariantRow = Pick<
  Database['public']['Tables']['product_variants']['Row'],
  'id' | 'product_id' | 'size' | 'color' | 'price_override' | 'stock' | 'variant_image_url'
> & {
  product: CartProductRow | null;
};

type RemoteCartRow = Pick<
  Database['public']['Tables']['cart_items']['Row'],
  'product_variant_id' | 'quantity'
> & {
  product_variants: CartVariantRow | null;
};

type ProductImageRow = Pick<
  Database['public']['Tables']['product_images']['Row'],
  'product_id' | 'image_url' | 'order_index'
>;

type ShippingRuleRow = Pick<
  Database['public']['Tables']['product_shipping_rules']['Row'],
  'id' | 'product_id' | 'shipping_class_id' | 'price' | 'is_allowed'
> & {
  shipping_classes: {
    id: string;
    name: string;
    description: string | null;
    estimated_days_min: number;
    estimated_days_max: number;
    shipping_types: {
      id: string;
      name: string;
      description: string | null;
    } | null;
  } | null;
};

const STORAGE_KEY = STORAGE_KEYS.cart;
const LEGACY_STORAGE_KEYS = STORAGE_KEYS.cartLegacy;
const PLACEHOLDER_IMAGE = '/placeholder.svg';

const CartContext = createContext<CartContextType | undefined>(undefined);

function createPlaceholderVariant(product: Product): ProductVariant {
  return {
    id: `__novariant__${product.id}`,
    color: undefined,
    size: undefined,
    price: product.basePrice,
    stock: 0,
  };
}

function buildCartItemId(productId: string, variantId: string): string {
  return `${productId}:${variantId}`;
}

function normalizeCartItem(item: CartItem): CartItem {
  return {
    ...item,
    id: buildCartItemId(item.product.id, item.variant.id),
  };
}

function mergeCartItems(items: CartItem[]): CartItem[] {
  const merged = new Map<string, CartItem>();

  items.forEach((rawItem) => {
    const item = normalizeCartItem(rawItem);
    const existingItem = merged.get(item.id);

    if (existingItem) {
      merged.set(item.id, {
        ...item,
        quantity: Math.max(existingItem.quantity, item.quantity),
      });
      return;
    }

    merged.set(item.id, item);
  });

  return Array.from(merged.values());
}

function getCartSignature(items: CartItem[]): string {
  return mergeCartItems(items)
    .map((item) => `${item.id}:${item.quantity}`)
    .sort()
    .join('|');
}

function getShippingType(name?: string | null): ShippingOption['type'] {
  const normalized = name?.toLowerCase() || '';

  if (normalized.includes('sea')) {
    return 'sea';
  }

  if (normalized.includes('express')) {
    return 'air_express';
  }

  return 'air_normal';
}

function buildCartProduct(
  product: CartProductRow,
  variants: CartVariantRow[],
  shippingRules: ShippingRuleRow[],
  images: string[],
): Product {
  return {
    id: product.id,
    name: product.name,
    description: product.description || '',
    category: product.categories?.name || 'Uncategorized',
    basePrice: Number(product.base_price),
    images: images.length > 0 ? images : [PLACEHOLDER_IMAGE],
    variants: variants.map((variant) => ({
      id: variant.id,
      size: variant.size || undefined,
      color: variant.color || undefined,
      price:
        variant.price_override != null
          ? Number(variant.price_override)
          : Number(product.base_price),
      stock: variant.stock || 0,
      image_url: variant.variant_image_url || null,
    })),
    shippingOptions: shippingRules
      .filter((rule) => rule.is_allowed && rule.shipping_classes)
      .map((rule) => ({
        id: rule.id,
        type: getShippingType(rule.shipping_classes?.shipping_types?.name),
        name: rule.shipping_classes?.name || '',
        details:
          rule.shipping_classes?.description ||
          rule.shipping_classes?.shipping_types?.description ||
          undefined,
        price: Number(rule.price),
        estimatedDays: rule.shipping_classes
          ? `${rule.shipping_classes.estimated_days_min}-${rule.shipping_classes.estimated_days_max} days`
          : '',
        available: true,
      })),
    isGroupBuyEligible: product.is_group_buy_eligible || false,
    isFlashDeal: product.is_flash_deal || false,
    isFreeShippingEligible: product.is_free_shipping || false,
    rating: product.rating ? Number(product.rating) : 0,
    reviewCount: product.review_count || 0,
  };
}

async function loadRemoteCartItems(localItems: CartItem[], userId: string): Promise<{
  mergedItems: CartItem[];
  restoredCount: number;
}> {
  const { data: remoteCartRows, error: remoteCartError } = await supabase
    .from('cart_items')
    .select(`
      product_variant_id,
      quantity,
      product_variants!inner(
        id,
        product_id,
        size,
        color,
        price_override,
        stock,
        variant_image_url,
        product:products!product_variants_product_id_fkey(
          id,
          name,
          description,
          base_price,
          is_group_buy_eligible,
          is_flash_deal,
          is_free_shipping,
          rating,
          review_count,
          categories(name)
        )
      )
    `)
    .eq('user_id', userId);

  if (remoteCartError) {
    throw remoteCartError;
  }

  const cartRows = ((remoteCartRows || []) as unknown[]).map((row) => {
    const typedRow = row as {
      product_variant_id: string;
      quantity: number;
      product_variants: CartVariantRow | null;
    };

    return {
      product_variant_id: typedRow.product_variant_id,
      quantity: typedRow.quantity,
      product_variants: typedRow.product_variants,
    } satisfies RemoteCartRow;
  });

  const productIds = Array.from(
    new Set(
      cartRows
        .map((row) => row.product_variants?.product_id)
        .filter((productId): productId is string => Boolean(productId)),
    ),
  );

  if (productIds.length === 0) {
    return {
      mergedItems: mergeCartItems(localItems),
      restoredCount: 0,
    };
  }

  const [
    { data: imagesData, error: imagesError },
    { data: variantsData, error: variantsError },
    { data: shippingRulesData, error: shippingRulesError },
  ] = await Promise.all([
    supabase
      .from('product_images')
      .select('product_id, image_url, order_index')
      .in('product_id', productIds)
      .order('order_index'),
    supabase
      .from('product_variants')
      .select('id, product_id, size, color, price_override, stock, variant_image_url')
      .in('product_id', productIds)
      .eq('is_active', true),
    supabase
      .from('product_shipping_rules')
      .select(`
        id,
        product_id,
        shipping_class_id,
        price,
        is_allowed,
        shipping_classes(
          id,
          name,
          description,
          estimated_days_min,
          estimated_days_max,
          shipping_types(id, name, description)
        )
      `)
      .in('product_id', productIds),
  ]);

  if (imagesError) {
    throw imagesError;
  }

  if (variantsError) {
    throw variantsError;
  }

  if (shippingRulesError) {
    throw shippingRulesError;
  }

  const imagesMap = new Map<string, string[]>();
  (imagesData as ProductImageRow[] | null)?.forEach((image) => {
    const existingImages = imagesMap.get(image.product_id) || [];
    existingImages.push(image.image_url);
    imagesMap.set(image.product_id, existingImages);
  });

  const variantsMap = new Map<string, CartVariantRow[]>();
  ((variantsData as unknown[]) || []).forEach((variant) => {
    const typedVariant = variant as CartVariantRow;
    const existingVariants = variantsMap.get(typedVariant.product_id) || [];
    existingVariants.push(typedVariant);
    variantsMap.set(typedVariant.product_id, existingVariants);
  });

  const shippingRulesMap = new Map<string, ShippingRuleRow[]>();
  ((shippingRulesData as unknown[]) || []).forEach((rule) => {
    const typedRule = rule as ShippingRuleRow;
    const existingRules = shippingRulesMap.get(typedRule.product_id) || [];
    existingRules.push(typedRule);
    shippingRulesMap.set(typedRule.product_id, existingRules);
  });

  const remoteItems = cartRows.flatMap((row) => {
    const variant = row.product_variants;
    const product = variant?.product;

    if (!variant || !product) {
      return [];
    }

    const resolvedVariant: ProductVariant = {
      id: variant.id,
      size: variant.size || undefined,
      color: variant.color || undefined,
      price:
        variant.price_override != null
          ? Number(variant.price_override)
          : Number(product.base_price),
      stock: variant.stock || 0,
      image_url: variant.variant_image_url || null,
    };

    return [
      {
        id: buildCartItemId(product.id, variant.id),
        product: buildCartProduct(
          product,
          variantsMap.get(product.id) || [variant],
          shippingRulesMap.get(product.id) || [],
          imagesMap.get(product.id) || [],
        ),
        variant: resolvedVariant,
        quantity: row.quantity,
      } satisfies CartItem,
    ];
  });

  const normalizedLocalItems = mergeCartItems(localItems);
  const localQuantities = new Map(
    normalizedLocalItems.map((item) => [item.id, item.quantity]),
  );
  const restoredCount = remoteItems.filter((item) => {
    const localQuantity = localQuantities.get(item.id);
    return localQuantity == null || localQuantity < item.quantity;
  }).length;

  return {
    mergedItems: mergeCartItems([...localItems, ...remoteItems]),
    restoredCount,
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const storedCart = getStoredItem(localStorage, [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]);
      if (!storedCart) {
        return [];
      }

      return mergeCartItems(JSON.parse(storedCart.value) as CartItem[]);
    } catch {
      return [];
    }
  });
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [selectedItemIds, setSelectedItemIdsState] = useState<string[]>([]);
  const [cartSyncState, setCartSyncState] = useState<CartSyncState>('local');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [hasLoadedRemoteCart, setHasLoadedRemoteCart] = useState(false);
  const latestItemsRef = useRef(items);

  useEffect(() => {
    latestItemsRef.current = items;
  }, [items]);

  // Persist cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      removeStoredItems(localStorage, LEGACY_STORAGE_KEYS);
    } catch {
      // ignore quota errors
    }
  }, [items]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    let ignore = false;

    if (!user) {
      setCartSyncState('local');
      setLastSyncedAt(null);
      setHasLoadedRemoteCart(true);

      setItems((currentItems) => {
        const normalizedItems = mergeCartItems(currentItems);
        return getCartSignature(currentItems) === getCartSignature(normalizedItems)
          ? currentItems
          : normalizedItems;
      });

      return () => {
        ignore = true;
      };
    }

    setCartSyncState('syncing');
    setHasLoadedRemoteCart(false);

    void (async () => {
      try {
        const { mergedItems, restoredCount } = await loadRemoteCartItems(
          latestItemsRef.current,
          user.id,
        );

        if (ignore) {
          return;
        }

        setItems((currentItems) => {
          return getCartSignature(currentItems) === getCartSignature(mergedItems)
            ? currentItems
            : mergedItems;
        });

        if (restoredCount > 0) {
          toast.success(
            `Restored ${restoredCount} saved cart item${restoredCount === 1 ? '' : 's'}.`,
          );
        }

        setCartSyncState('synced');
        setLastSyncedAt(new Date().toISOString());
      } catch (error) {
        console.error('Failed to restore saved cart:', error);
        if (!ignore) {
          toast.error('Could not restore your saved cart. Your local cart is still here.');
          setCartSyncState('error');
        }
      } finally {
        if (!ignore) {
          setHasLoadedRemoteCart(true);
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [authLoading, user]);

  useEffect(() => {
    if (!user || authLoading || !hasLoadedRemoteCart) {
      return;
    }

    let ignore = false;
    const syncableItems = mergeCartItems(latestItemsRef.current).filter(
      (item) => !isVariantPlaceholder(item.variant.id),
    );

    void (async () => {
      try {
        setCartSyncState('syncing');

        const { data: remoteCartRows, error: remoteCartError } = await supabase
          .from('cart_items')
          .select('product_variant_id')
          .eq('user_id', user.id);

        if (remoteCartError) {
          throw remoteCartError;
        }

        if (syncableItems.length > 0) {
          const { error: upsertError } = await supabase
            .from('cart_items')
            .upsert(
              syncableItems.map((item) => ({
                user_id: user.id,
                product_variant_id: item.variant.id,
                quantity: item.quantity,
              })),
              { onConflict: 'user_id,product_variant_id' },
            );

          if (upsertError) {
            throw upsertError;
          }
        }

        const syncedVariantIds = new Set(syncableItems.map((item) => item.variant.id));
        const remoteVariantIds =
          remoteCartRows?.map((row) => row.product_variant_id).filter(Boolean) || [];
        const variantIdsToDelete = remoteVariantIds.filter(
          (variantId) => !syncedVariantIds.has(variantId),
        );

        if (variantIdsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('cart_items')
            .delete()
            .eq('user_id', user.id)
            .in('product_variant_id', variantIdsToDelete);

          if (deleteError) {
            throw deleteError;
          }
        }

        if (!ignore) {
          setCartSyncState('synced');
          setLastSyncedAt(new Date().toISOString());
        }
      } catch (error) {
        console.error('Failed to sync cart:', error);
        if (!ignore) {
          setCartSyncState('error');
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [authLoading, hasLoadedRemoteCart, items, user]);

  // Keep selection in sync with cart contents while preserving intentional unchecks.
  useEffect(() => {
    setSelectedItemIdsState((prev) => {
      const itemIds = items.map((item) => item.id);
      const stillPresent = prev.filter((id) => itemIds.includes(id));
      const newIds = itemIds.filter((id) => !stillPresent.includes(id));
      return [...stillPresent, ...newIds];
    });
  }, [items]);

  const addToCart = (
    product: Product,
    variant: ProductVariant | null,
    quantity = 1,
    selectionMode: 'preserve' | 'include' | 'only' = 'preserve',
  ) => {
    setItems((prev) => {
      const effectiveVariant = variant ?? createPlaceholderVariant(product);
      const normalizedVariantId = buildCartItemId(product.id, effectiveVariant.id);
      const existingItem = prev.find((item) => item.id === normalizedVariantId);

      if (existingItem) {
        if (selectionMode !== 'preserve') {
          setSelectedItemIdsState((prevSelectedIds) =>
            selectionMode === 'only'
              ? [existingItem.id]
              : prevSelectedIds.includes(existingItem.id)
                ? prevSelectedIds
                : [...prevSelectedIds, existingItem.id],
          );
        }

        return prev.map((item) =>
          item.id === existingItem.id
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }

      const nextItemId = buildCartItemId(product.id, effectiveVariant.id);

      if (selectionMode !== 'preserve') {
        setSelectedItemIdsState((prevSelectedIds) =>
          selectionMode === 'only' ? [nextItemId] : [...prevSelectedIds, nextItemId],
        );
      }

      return [
        ...prev,
        {
          id: nextItemId,
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
      prev.map((item) => (item.id === itemId ? { ...item, quantity } : item)),
    );
  };

  const updateVariant = (itemId: string, variant: ProductVariant) => {
    setItems((prev) => {
      const sourceItem = prev.find((item) => item.id === itemId);
      if (!sourceItem) {
        return prev;
      }

      const nextItemId = buildCartItemId(sourceItem.product.id, variant.id);
      const targetItem = prev.find((item) => item.id === nextItemId);

      setSelectedItemIdsState((prevSelectedIds) => {
        const sourceSelected = prevSelectedIds.includes(itemId);
        const remainingIds = prevSelectedIds.filter((id) => id !== itemId);

        if (!sourceSelected || remainingIds.includes(nextItemId)) {
          return remainingIds;
        }

        return [...remainingIds, nextItemId];
      });

      if (targetItem && targetItem.id !== itemId) {
        return prev
          .filter((item) => item.id !== itemId)
          .map((item) =>
            item.id === targetItem.id
              ? {
                  ...item,
                  quantity: item.quantity + sourceItem.quantity,
                }
              : item,
          );
      }

      return prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              id: nextItemId,
              variant,
            }
          : item,
      );
    });
  };

  const clearCart = () => {
    setItems([]);
    setSelectedShipping(null);
    setSelectedItemIdsState([]);
  };

  const clearSelectedItems = () => {
    setItems((prev) => prev.filter((item) => !selectedItemIds.includes(item.id)));
    setSelectedItemIdsState([]);
  };

  const setShipping = (shipping: ShippingOption) => {
    setSelectedShipping(shipping);
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIdsState((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
    );
  };

  const setSelectedItemIds = (ids: string[]) => setSelectedItemIdsState(ids);

  const selectedItems = items.filter((item) => selectedItemIds.includes(item.id));
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.variant.price * item.quantity, 0);
  const selectedSubtotal = selectedItems.reduce(
    (sum, item) => sum + item.variant.price * item.quantity,
    0,
  );
  const shippingCost = selectedShipping?.price || 0;
  const total = subtotal + shippingCost;
  const localOnlyItemCount = useMemo(
    () => items.filter((item) => isVariantPlaceholder(item.variant.id)).length,
    [items],
  );

  return (
    <CartContext.Provider
      value={{
        items,
        selectedItems,
        selectedShipping,
        selectedItemIds,
        cartSyncState,
        lastSyncedAt,
        localOnlyItemCount,
        addToCart,
        removeFromCart,
        updateQuantity,
        updateVariant,
        clearCart,
        clearSelectedItems,
        setShipping,
        toggleItemSelection,
        setSelectedItemIds,
        totalItems,
        subtotal,
        selectedSubtotal,
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
