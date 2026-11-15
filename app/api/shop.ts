/** How long a custom colour can be rented for, and its price in cents. Longer is cheaper per day */
export const COLOR_RENTALS = {
    week: { days: 7, price: 750 * 100 },
    month: { days: 30, price: 2000 * 100 },
} as const;

export type ColorRental = keyof typeof COLOR_RENTALS;
