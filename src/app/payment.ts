/**
 * Manual UPI payment details. Nothing here is hard-coded: the UPI ID, payee name, price and
 * period come from the build's environment. If any is missing or invalid, the app says payments
 * are not open yet instead of showing made-up numbers.
 */

export interface PaymentConfig {
  upiId: string;
  payeeName: string;
  priceInr: number;
  periodDays: number;
}

const UPI_ID = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

export function readPaymentConfig(env: Record<string, string | undefined>): PaymentConfig | null {
  const upiId = env.VITE_UPI_ID?.trim() ?? '';
  const payeeName = env.VITE_UPI_PAYEE_NAME?.trim() ?? '';
  const priceInr = Number(env.VITE_PRO_PRICE_INR);
  const periodDays = Number(env.VITE_PRO_PERIOD_DAYS);
  if (!UPI_ID.test(upiId) || !payeeName) return null;
  if (!Number.isFinite(priceInr) || priceInr <= 0 || priceInr > 100_000) return null;
  if (!Number.isInteger(periodDays) || periodDays <= 0 || periodDays > 3660) return null;
  return { upiId, payeeName, priceInr, periodDays };
}

export const paymentConfig = readPaymentConfig(import.meta.env);

/**
 * A standard UPI payment link. The note carries a short account reference so the administrator
 * can match the payment. It never includes anything secret.
 */
export function upiLink(config: PaymentConfig, accountRef: string): string {
  const params = new URLSearchParams({
    pa: config.upiId,
    pn: config.payeeName,
    am: config.priceInr.toFixed(2),
    cu: 'INR',
    tn: `Overload Pro ${accountRef}`,
  });
  return `upi://pay?${params.toString()}`;
}

/** Short, non-secret reference for an account: the first 8 characters of its id. */
export const accountRef = (userId: string) => userId.replace(/-/g, '').slice(0, 8).toUpperCase();

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}
