const CURRENCY = { code: 'GHS', symbol: '₵', name: 'Ghana Cedis' } as const;

export function useCurrency() {
  const formatPrice = (amount: number): string => {
    return `${CURRENCY.symbol}${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return {
    currency: CURRENCY,
    formatPrice,
    isLoading: false,
  };
}
