import type { Expense, ExpenseDraft, Settlement } from './types';
export const MAX_MINOR = 1_000_000_000_000;
export function integer(value: number, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new Error('Money must be a safe non-negative integer.');
  return value;
}
export function parseMoney(text: string): number {
  if (!/^\d{1,11}(\.\d{0,2})?$/.test(text)) throw new Error('Enter an amount with at most two decimal places.');
  const [whole = '0', fraction = ''] = text.split('.');
  return integer(Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))), MAX_MINOR);
}
export function money(value: number, currency = 'INR'): string {
  integer(Math.abs(value));
  // Only display formatting uses decimal major units. Calculations use minor units.
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value / 100);
}
export function validateCurrency(currency: string): void {
  if (!/^[A-Z]{3}$/.test(currency) || new Intl.NumberFormat('en-IN', {style:'currency',currency}).resolvedOptions().maximumFractionDigits !== 2) {
    throw new Error('Choose a two-decimal currency such as INR, USD, EUR or GBP.');
  }
}
export function amountText(value: number): string { integer(value); return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`; }
export function payerShare(expense: Pick<ExpenseDraft, 'amount_minor' | 'split_type' | 'split'>): number {
  const total = integer(expense.amount_minor, MAX_MINOR);
  switch (expense.split_type) {
    case 'equal': return Math.ceil(total / 2); // payer takes the odd minor unit
    case 'paid_for_partner': return 0;
    case 'paid_for_me': return total;
    case 'custom': return integer(expense.split.payer_minor ?? -1, total);
    case 'percent': {
      const bps = integer(expense.split.payer_bps ?? -1, 10_000);
      return Number((BigInt(total) * BigInt(bps) + 5000n) / 10_000n);
    }
  }
}
/** Positive means partner owes viewer. Payments from viewer reduce their debt. */
export function balances(expenses: readonly Expense[], settlements: readonly Settlement[], viewer: string): Record<string, number> {
  const totals: Record<string, bigint> = {};
  for (const e of expenses) {
    if (e.deleted_at) continue;
    const share = BigInt(integer(e.amount_minor) - payerShare(e));
    totals[e.currency] = (totals[e.currency] ?? 0n) + (e.paid_by === viewer ? share : -share);
  }
  for (const s of settlements) totals[s.currency] = (totals[s.currency] ?? 0n) + (s.from_user === viewer ? BigInt(integer(s.amount_minor)) : -BigInt(integer(s.amount_minor)));
  return Object.fromEntries(Object.entries(totals).map(([currency, amount]) => { const value = Number(amount); integer(Math.abs(value)); return [currency, value]; }));
}
/** Manual rate is a rational pair of integers; currencies never merge implicitly. */
export function convertMinor(amount: number, rate: string): number {
  integer(Math.abs(amount));
  if (!/^\d{1,8}(\.\d{1,6})?$/.test(rate)) throw new Error('Enter a positive rate with up to six decimal places.');
  const [whole = '0', fraction = ''] = rate.split('.');
  const numerator = BigInt(whole + fraction); const denominator = 10n ** BigInt(fraction.length);
  if (numerator === 0n) throw new Error('Conversion rate must be positive.');
  return integer(Number((BigInt(Math.abs(amount)) * numerator + denominator / 2n) / denominator)) * Math.sign(amount);
}
export function csv(expenses: readonly Expense[], month: string): string {
  const cell = (value: string | number) => `"${String(value).replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`;
  return [['Date','Category','Note','Paid by','Amount minor','Currency','Split'], ...expenses.filter(e => !e.deleted_at && e.spent_on.startsWith(month)).map(e => [e.spent_on,e.category,e.note ?? '',e.paid_by,e.amount_minor,e.currency,e.split_type])].map(row => row.map(cell).join(',')).join('\r\n');
}
export function localDate(date = new Date()): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function validDate(value: string): boolean { const d = new Date(`${value}T12:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === value; }
export function nextMonth(date: string): string {
  const d = new Date(`${date}T12:00:00Z`); const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate())); return d.toISOString().slice(0,10);
}
