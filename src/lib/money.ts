export function toMoney(value: unknown) {
  const numberValue = Number(value || 0);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.round((numberValue + Number.EPSILON) * 100) / 100;
}
