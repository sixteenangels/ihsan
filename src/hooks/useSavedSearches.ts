import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Json, Tables, TablesInsert } from '@/integrations/supabase/types';

export interface SavedSearchFilters {
  searchQuery: string;
  selectedCategory: string;
  sortBy: string;
  priceRange: [number, number];
  groupBuyOnly: boolean;
  flashDealsOnly: boolean;
  freeShippingOnly: boolean;
}

export interface SavedSearch extends Omit<Tables<'saved_searches'>, 'filters'> {
  filters: SavedSearchFilters;
}

interface SaveSavedSearchInput {
  name: string;
  filters: SavedSearchFilters;
}

const DEFAULT_SAVED_SEARCH_FILTERS: SavedSearchFilters = {
  searchQuery: '',
  selectedCategory: '',
  sortBy: 'newest',
  priceRange: [0, 10000],
  groupBuyOnly: false,
  flashDealsOnly: false,
  freeShippingOnly: false,
};

function isRecord(value: Json | null | undefined): value is Record<string, Json> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toSafeNumber(value: Json | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function normalizeSavedSearchFilters(value: Json | null | undefined): SavedSearchFilters {
  if (!isRecord(value)) {
    return DEFAULT_SAVED_SEARCH_FILTERS;
  }

  const range = Array.isArray(value.priceRange) ? value.priceRange : null;
  const min = toSafeNumber(range?.[0], DEFAULT_SAVED_SEARCH_FILTERS.priceRange[0]);
  const max = toSafeNumber(range?.[1], DEFAULT_SAVED_SEARCH_FILTERS.priceRange[1]);

  return {
    searchQuery: typeof value.searchQuery === 'string' ? value.searchQuery : '',
    selectedCategory: typeof value.selectedCategory === 'string' ? value.selectedCategory : '',
    sortBy: typeof value.sortBy === 'string' ? value.sortBy : DEFAULT_SAVED_SEARCH_FILTERS.sortBy,
    priceRange: [Math.max(0, min), Math.max(min, max)],
    groupBuyOnly: value.groupBuyOnly === true,
    flashDealsOnly: value.flashDealsOnly === true,
    freeShippingOnly: value.freeShippingOnly === true,
  };
}

export function useSavedSearches() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['saved-searches', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<SavedSearch[]> => {
      if (!user?.id) {
        return [];
      }

      const { data, error } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data || []).map((savedSearch) => ({
        ...savedSearch,
        filters: normalizeSavedSearchFilters(savedSearch.filters),
      }));
    },
  });
}

export function useSaveSavedSearch() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ name, filters }: SaveSavedSearchInput) => {
      if (!user?.id) {
        throw new Error('Sign in to save searches.');
      }

      const payload: TablesInsert<'saved_searches'> = {
        user_id: user.id,
        name,
        filters: filters as unknown as Json,
      };

      const { error } = await supabase.from('saved_searches').insert(payload);
      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-searches', user?.id] });
    },
  });
}

export function useDeleteSavedSearch() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) {
        throw new Error('Sign in to manage saved searches.');
      }

      const { error } = await supabase
        .from('saved_searches')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-searches', user?.id] });
    },
  });
}
