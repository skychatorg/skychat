/** One line of a user's money history: amount is negative when money is spent */
export type MoneyChange = { date: number; amount: number; reason: string };

/**
 * User money is stored in cents. Whole amounts show without decimals: $10, $2.59
 */
export function formatMoney(cents: number): string {
    const sign = cents < 0 ? '−' : '';
    const dollars = Math.abs(cents) / 100;
    return `${sign}$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}
