export interface GroupBuyPricingInput {
  basePrice: number;
  groupPrice: number | null;
  discountPercentage?: number | null;
}

export function getGroupBuyUnitPrice({
  basePrice,
  groupPrice,
  discountPercentage,
}: GroupBuyPricingInput): number {
  if (groupPrice != null) {
    return Number(groupPrice);
  }

  const safeDiscount = Number(discountPercentage || 0);
  return basePrice * (1 - safeDiscount / 100);
}

export function getGroupBuySavingsPercent(input: GroupBuyPricingInput): number {
  if (input.basePrice <= 0) {
    return 0;
  }

  const unitPrice = getGroupBuyUnitPrice(input);
  return Math.max(0, Math.round(((input.basePrice - unitPrice) / input.basePrice) * 100));
}
