import { describe, it, expect } from 'vitest';
import { toNumber, formatCurrency } from '../lib/utils';

describe('Budget & Cost Formatter Helpers', () => {
  describe('toNumber', () => {
    it('returns 0 for null, undefined, and empty string', () => {
      expect(toNumber(null)).toBe(0);
      expect(toNumber(undefined)).toBe(0);
      expect(toNumber('')).toBe(0);
    });

    it('returns 0 for NaN and invalid strings', () => {
      expect(toNumber(NaN)).toBe(0);
      expect(toNumber('abc')).toBe(0);
      expect(toNumber('not-a-number')).toBe(0);
    });

    it('converts valid string numbers to floats', () => {
      expect(toNumber('45.00')).toBe(45);
      expect(toNumber('9.50')).toBe(9.5);
      expect(toNumber('010.00')).toBe(10);
      expect(toNumber('1500')).toBe(1500);
    });

    it('handles numeric inputs directly', () => {
      expect(toNumber(45.5)).toBe(45.5);
      expect(toNumber(0)).toBe(0);
      expect(toNumber(-10)).toBe(-10);
    });

    it('prevents string concatenation when summing', () => {
      const stringCosts = ['45.00', '9.00', '010.00'];
      const total = stringCosts.reduce((acc, c) => acc + toNumber(c), 0);
      expect(total).toBe(64);
      expect(typeof total).toBe('number');
    });
  });

  describe('formatCurrency', () => {
    it('formats numbers with 2 decimal places and dollar sign', () => {
      expect(formatCurrency(45)).toBe('$45.00');
      expect(formatCurrency(9.5)).toBe('$9.50');
      expect(formatCurrency(120.999)).toBe('$121.00');
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('formats string numbers correctly with 2 decimal places', () => {
      expect(formatCurrency('45.00')).toBe('$45.00');
      expect(formatCurrency('9')).toBe('$9.00');
      expect(formatCurrency('010.00')).toBe('$10.00');
    });

    it('handles null, undefined, and NaN gracefully as $0.00', () => {
      expect(formatCurrency(null)).toBe('$0.00');
      expect(formatCurrency(undefined)).toBe('$0.00');
      expect(formatCurrency(NaN)).toBe('$0.00');
      expect(formatCurrency('invalid')).toBe('$0.00');
    });

    it('supports custom currency symbols', () => {
      expect(formatCurrency(100, '€')).toBe('€100.00');
      expect(formatCurrency(500, '£')).toBe('£500.00');
      expect(formatCurrency(1000, '¥')).toBe('¥1000.00');
    });
  });
});
