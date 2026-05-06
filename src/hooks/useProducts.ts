import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProductWithDetails {
  id: string;
  name: string;
  description: string | null;
  item_code: string;
  product_number: string | null;
  base_price: number;
  is_group_buy_eligible: boolean | null;
  is_flash_deal: boolean | null;
  is_free_shipping: boolean | null;
  is_active: boolean | null;
  rating: number | null;
  review_count: number | null;
  category_id: string | null;
  category_name: string | null;
  images: string[];
  variants: {
    id: string;
    size: string | null;
    color: string | null;
    price: number;
    stock: number | null;
    sku: string | null;
  }[];
  shipping_rules: {
    id: string;
    shipping_class_id: string;
    price: number;
    is_allowed: boolean | null;
    shipping_class: {
      id: string;
      name: string;
      estimated_days_min: number;
      estimated_days_max: number;
      shipping_type: {
        id: string;
        name: string;
      } | null;
    } | null;
  }[];
}

async function fetchProducts(): Promise<ProductWithDetails[]> {
  // Fetch products with categories
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(`
      *,
      categories(name)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (productsError) throw productsError;

  // Fetch images for all products
  const { data: images, error: imagesError } = await supabase
    .from('product_images')
    .select('product_id, image_url, order_index')
    .order('order_index');

  if (imagesError) throw imagesError;

  // Fetch variants for all products
  const { data: variants, error: variantsError } = await supabase
    .from('product_variants')
    .select('*')
    .eq('is_active', true);

  if (variantsError) throw variantsError;

  // Fetch shipping rules with shipping classes
  const { data: shippingRules, error: shippingError } = await supabase
    .from('product_shipping_rules')
    .select(`
      *,
      shipping_classes(
        id,
        name,
        estimated_days_min,
        estimated_days_max,
        shipping_types(id, name)
      )
    `);

  if (shippingError) throw shippingError;

  // Map images, variants, and shipping rules to products
  const imagesMap = new Map<string, string[]>();
  images?.forEach((img) => {
    const existing = imagesMap.get(img.product_id) || [];
    existing.push(img.image_url);
    imagesMap.set(img.product_id, existing);
  });

  const variantsMap = new Map<string, typeof variants>();
  variants?.forEach((v) => {
    const existing = variantsMap.get(v.product_id) || [];
    existing.push(v);
    variantsMap.set(v.product_id, existing);
  });

  const shippingMap = new Map<string, typeof shippingRules>();
  shippingRules?.forEach((rule) => {
    const existing = shippingMap.get(rule.product_id) || [];
    existing.push(rule);
    shippingMap.set(rule.product_id, existing);
  });

  return (products || []).map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    item_code: product.item_code,
    product_number: product.product_number,
    base_price: Number(product.base_price),
    is_group_buy_eligible: product.is_group_buy_eligible,
    is_flash_deal: product.is_flash_deal,
    is_free_shipping: product.is_free_shipping,
    is_active: product.is_active,
    rating: product.rating ? Number(product.rating) : null,
    review_count: product.review_count,
    category_id: product.category_id,
    category_name: (product.categories as { name: string } | null)?.name || null,
    images: imagesMap.get(product.id) || [],
    variants: (variantsMap.get(product.id) || []).map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      price: v.price_override ? Number(v.price_override) : Number(product.base_price),
      stock: v.stock,
      sku: v.sku,
    })),
    shipping_rules: (shippingMap.get(product.id) || []).map((rule) => ({
      id: rule.id,
      shipping_class_id: rule.shipping_class_id,
      price: Number(rule.price),
      is_allowed: rule.is_allowed,
      shipping_class: rule.shipping_classes ? {
        id: rule.shipping_classes.id,
        name: rule.shipping_classes.name,
        estimated_days_min: rule.shipping_classes.estimated_days_min,
        estimated_days_max: rule.shipping_classes.estimated_days_max,
        shipping_type: rule.shipping_classes.shipping_types,
      } : null,
    })),
  }));
}

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });
}

async function fetchProductById(id: string): Promise<ProductWithDetails | null> {
  const { data: product, error: productError } = await supabase
    .from('products')
    .select(`
      *,
      categories(name)
    `)
    .eq('id', id)
    .maybeSingle();

  if (productError) throw productError;
  if (!product) return null;

  // Fetch images
  const { data: images } = await supabase
    .from('product_images')
    .select('image_url, order_index')
    .eq('product_id', id)
    .order('order_index');

  // Fetch variants
  const { data: variants } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', id)
    .eq('is_active', true);

  // Fetch shipping rules
  const { data: shippingRules } = await supabase
    .from('product_shipping_rules')
    .select(`
      *,
      shipping_classes(
        id,
        name,
        estimated_days_min,
        estimated_days_max,
        shipping_types(id, name)
      )
    `)
    .eq('product_id', id);

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    item_code: product.item_code,
    product_number: product.product_number,
    base_price: Number(product.base_price),
    is_group_buy_eligible: product.is_group_buy_eligible,
    is_flash_deal: product.is_flash_deal,
    is_free_shipping: product.is_free_shipping,
    is_active: product.is_active,
    rating: product.rating ? Number(product.rating) : null,
    review_count: product.review_count,
    category_id: product.category_id,
    category_name: (product.categories as { name: string } | null)?.name || null,
    images: (images || []).map((img) => img.image_url),
    variants: (variants || []).map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      price: v.price_override ? Number(v.price_override) : Number(product.base_price),
      stock: v.stock,
      sku: v.sku,
    })),
    shipping_rules: (shippingRules || []).map((rule) => ({
      id: rule.id,
      shipping_class_id: rule.shipping_class_id,
      price: Number(rule.price),
      is_allowed: rule.is_allowed,
      shipping_class: rule.shipping_classes ? {
        id: rule.shipping_classes.id,
        name: rule.shipping_classes.name,
        estimated_days_min: rule.shipping_classes.estimated_days_min,
        estimated_days_max: rule.shipping_classes.estimated_days_max,
        shipping_type: rule.shipping_classes.shipping_types,
      } : null,
    })),
  };
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => (id ? fetchProductById(id) : null),
    enabled: !!id,
  });
}
