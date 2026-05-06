import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  product_count: number;
  is_active: boolean | null;
}

async function fetchCategories(): Promise<Category[]> {
  // Get categories
  const { data: cats, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;

  // Get live product counts
  const { data: products } = await supabase
    .from('products')
    .select('category_id')
    .eq('is_active', true);

  const countMap: Record<string, number> = {};
  products?.forEach(p => {
    if (p.category_id) {
      countMap[p.category_id] = (countMap[p.category_id] || 0) + 1;
    }
  });

  return (cats || []).map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    icon: cat.icon,
    product_count: countMap[cat.id] || 0,
    is_active: cat.is_active,
  }));
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });
}
