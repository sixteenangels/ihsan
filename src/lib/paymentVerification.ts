export interface PaystackVerificationResult {
  amount?: number | null;
  requestedAmount?: number | null;
}

function toSubunitAmount(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  return Math.round(numberValue);
}

export function isPaystackAmountValid(
  verification: PaystackVerificationResult | null | undefined,
  expectedAmount: number,
) {
  const paidAmount = toSubunitAmount(verification?.amount);
  const requestedAmount = toSubunitAmount(verification?.requestedAmount);
  const expectedSubunitAmount = toSubunitAmount(expectedAmount);

  if (expectedSubunitAmount == null) return false;
  if (paidAmount === expectedSubunitAmount) return true;

  return (
    requestedAmount === expectedSubunitAmount &&
    paidAmount != null &&
    paidAmount >= expectedSubunitAmount
  );
}
