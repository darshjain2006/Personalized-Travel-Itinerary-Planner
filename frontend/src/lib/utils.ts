import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely converts any value to a number. Returns 0 for null, undefined, NaN, or non-finite numbers.
 */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Formats a monetary number into a string with 2 decimal places using toFixed(2) (e.g. "$45.00").
 */
export function formatCurrency(value: unknown, currencySymbol = '$'): string {
  const num = toNumber(value);
  return `${currencySymbol}${num.toFixed(2)}`;
}
