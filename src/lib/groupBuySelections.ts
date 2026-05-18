import type { Json } from '@/integrations/supabase/types';

export interface GroupBuyVariantOption {
  id: string;
  color: string | null;
  size: string | null;
  sku?: string | null;
  price_override: number | string | null;
  stock?: number | null;
}

export interface GroupBuyVariantSelection {
  variantId: string;
  quantity: number;
  unitPrice: number;
  label: string;
}

const GROUP_BUY_SELECTIONS_KEY = 'group_buy_variant_selections';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeQuantity(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function normalizePrice(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getGroupBuyVariantLabel(variant: Pick<GroupBuyVariantOption, 'color' | 'size' | 'sku'>): string {
  return [variant.color, variant.size].filter(Boolean).join(' / ') || variant.sku || 'Default';
}

export function getGroupBuyVariantUnitPrice({
  variant,
  basePrice,
  groupPrice,
  discountPercentage,
}: {
  variant: GroupBuyVariantOption;
  basePrice: number;
  groupPrice: number | null;
  discountPercentage: number | null;
}): number {
  if (groupPrice != null) {
    return Number(groupPrice);
  }

  const variantBasePrice = variant.price_override != null
    ? Number(variant.price_override)
    : Number(basePrice);
  const normalizedDiscount = Number(discountPercentage ?? 0);

  return variantBasePrice * (1 - normalizedDiscount / 100);
}

export function buildGroupBuyVariantSelections({
  quantitiesByVariantId,
  variants,
  basePrice,
  groupPrice,
  discountPercentage,
}: {
  quantitiesByVariantId: Record<string, string | number>;
  variants: GroupBuyVariantOption[];
  basePrice: number;
  groupPrice: number | null;
  discountPercentage: number | null;
}): GroupBuyVariantSelection[] {
  const variantsById = new Map(variants.map((variant) => [variant.id, variant]));

  return Object.entries(quantitiesByVariantId)
    .map(([variantId, rawQuantity]) => {
      const quantity = normalizeQuantity(rawQuantity);
      if (quantity <= 0) return null;

      const variant = variantsById.get(variantId);
      if (!variant) return null;

      return {
        variantId,
        quantity,
        unitPrice: getGroupBuyVariantUnitPrice({
          variant,
          basePrice,
          groupPrice,
          discountPercentage,
        }),
        label: getGroupBuyVariantLabel(variant),
      };
    })
    .filter((selection): selection is GroupBuyVariantSelection => selection !== null);
}

export function getGroupBuySelectionsTotalQuantity(selections: GroupBuyVariantSelection[]): number {
  return selections.reduce((total, selection) => total + selection.quantity, 0);
}

export function getGroupBuySelectionsTotalAmount(selections: GroupBuyVariantSelection[]): number {
  return selections.reduce((total, selection) => total + (selection.quantity * selection.unitPrice), 0);
}

export function withGroupBuySelectionsInShippingAddress<T extends Record<string, unknown>>(
  address: T | null,
  selections: GroupBuyVariantSelection[],
): T | (T & { group_buy_variant_selections: GroupBuyVariantSelection[] }) | null {
  if (selections.length === 0) {
    return address;
  }

  return {
    ...((address || {}) as T),
    [GROUP_BUY_SELECTIONS_KEY]: selections,
  };
}

export function extractGroupBuySelectionsFromShippingAddress(value: Json | null): GroupBuyVariantSelection[] {
  if (!isRecord(value)) return [];

  const rawSelections = value[GROUP_BUY_SELECTIONS_KEY];
  if (!Array.isArray(rawSelections)) return [];

  return rawSelections
    .map((entry) => {
      if (!isRecord(entry)) return null;

      const variantId = typeof entry.variantId === 'string' ? entry.variantId : '';
      const label = typeof entry.label === 'string' ? entry.label : '';
      const quantity = normalizeQuantity(entry.quantity);
      const unitPrice = normalizePrice(entry.unitPrice);

      if (!variantId || !label || quantity <= 0) {
        return null;
      }

      return {
        variantId,
        label,
        quantity,
        unitPrice,
      } satisfies GroupBuyVariantSelection;
    })
    .filter((selection): selection is GroupBuyVariantSelection => selection !== null);
}
