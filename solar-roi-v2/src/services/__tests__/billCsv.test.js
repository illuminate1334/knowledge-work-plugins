import { describe, it, expect } from 'vitest';
import { billsFromCsvRows, parseMonthToken } from '../billCsv.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function orderedYear({ usageCol = 'Usage kWh', costCol = 'Cost' } = {}) {
  return MONTHS.map((month, i) => ({
    [usageCol]: 100 + i,
    [costCol]: 20 + i,
  }));
}

describe('parseMonthToken', () => {
  it('reads full names, abbreviations, and 1–12 numbers', () => {
    expect(parseMonthToken('January')).toBe(0);
    expect(parseMonthToken('FEB')).toBe(1);
    expect(parseMonthToken('Sept')).toBe(8);
    expect(parseMonthToken('12')).toBe(11);
    expect(parseMonthToken('01')).toBe(0);
    expect(parseMonthToken(7)).toBe(6);
  });

  it('reads month from date-like values', () => {
    expect(parseMonthToken('2024-07-15')).toBe(6);
    expect(parseMonthToken('2024-07')).toBe(6);
    expect(parseMonthToken('July 2024')).toBe(6);
  });

  it('returns null for unrecognizable tokens instead of guessing an index', () => {
    expect(parseMonthToken('')).toBeNull();
    expect(parseMonthToken('kWh')).toBeNull();
    expect(parseMonthToken('13')).toBeNull();
  });
});

describe('billsFromCsvRows', () => {
  it('falls back to Jan–Dec by row index only when no month column exists', () => {
    const rows = orderedYear();
    const { bills, error } = billsFromCsvRows(rows, ['Usage kWh', 'Cost']);
    expect(error).toBeUndefined();
    expect(bills).toHaveLength(12);
    expect(bills[0]).toMatchObject({ month: 'Jan', usage: '100', cost: '20' });
    expect(bills[11]).toMatchObject({ month: 'Dec', usage: '111', cost: '31' });
  });

  it('assigns usage and cost by month name even when rows start mid-year', () => {
    // Fiscal / billed order: Jul … Jun. Index mapping would put July kWh on January.
    const rows = [
      { Month: 'Jul', 'Usage kWh': 700, Cost: 70 },
      { Month: 'Aug', 'Usage kWh': 800, Cost: 80 },
      { Month: 'Sep', 'Usage kWh': 900, Cost: 90 },
      { Month: 'Oct', 'Usage kWh': 1000, Cost: 100 },
      { Month: 'Nov', 'Usage kWh': 1100, Cost: 110 },
      { Month: 'Dec', 'Usage kWh': 1200, Cost: 120 },
      { Month: 'Jan', 'Usage kWh': 100, Cost: 10 },
      { Month: 'Feb', 'Usage kWh': 200, Cost: 20 },
      { Month: 'Mar', 'Usage kWh': 300, Cost: 30 },
      { Month: 'Apr', 'Usage kWh': 400, Cost: 40 },
      { Month: 'May', 'Usage kWh': 500, Cost: 50 },
      { Month: 'Jun', 'Usage kWh': 600, Cost: 60 },
    ];
    const { bills, error } = billsFromCsvRows(rows, ['Month', 'Usage kWh', 'Cost']);
    expect(error).toBeUndefined();
    expect(bills[0]).toMatchObject({ month: 'Jan', usage: '100', cost: '10' });
    expect(bills[5]).toMatchObject({ month: 'Jun', usage: '600', cost: '60' });
    expect(bills[6]).toMatchObject({ month: 'Jul', usage: '700', cost: '70' });
    expect(bills[11]).toMatchObject({ month: 'Dec', usage: '1200', cost: '120' });
  });

  it('reads numeric month values and does not treat row 0 as January', () => {
    const rows = [
      { month: '12', kwh: 12, amount: 1.2 },
      { month: '1', kwh: 1, amount: 0.1 },
      { month: '2', kwh: 2, amount: 0.2 },
      { month: '3', kwh: 3, amount: 0.3 },
      { month: '4', kwh: 4, amount: 0.4 },
      { month: '5', kwh: 5, amount: 0.5 },
      { month: '6', kwh: 6, amount: 0.6 },
      { month: '7', kwh: 7, amount: 0.7 },
      { month: '8', kwh: 8, amount: 0.8 },
      { month: '9', kwh: 9, amount: 0.9 },
      { month: '10', kwh: 10, amount: 1.0 },
      { month: '11', kwh: 11, amount: 1.1 },
    ];
    const { bills, error } = billsFromCsvRows(rows, ['month', 'kwh', 'amount']);
    expect(error).toBeUndefined();
    expect(bills[0]).toMatchObject({ month: 'Jan', usage: '1', cost: '0.1' });
    expect(bills[11]).toMatchObject({ month: 'Dec', usage: '12', cost: '1.2' });
  });

  it('does not fall back to row index when a month column is present but values are unparseable', () => {
    const rows = orderedYear().map((row, i) => ({ Month: `cycle ${i + 1}`, ...row }));
    const { error, bills } = billsFromCsvRows(rows, ['Month', 'Usage kWh', 'Cost']);
    expect(bills).toBeUndefined();
    expect(error).toMatch(/12 months are required/);
  });

  it('keeps the last occurrence when a month appears twice', () => {
    const rows = [
      ...MONTHS.map((Month, i) => ({ Month, 'Usage kWh': i + 1, Cost: i + 1 })),
      { Month: 'Jan', 'Usage kWh': 999, Cost: 88 },
    ];
    const { bills } = billsFromCsvRows(rows, ['Month', 'Usage kWh', 'Cost']);
    expect(bills[0]).toMatchObject({ usage: '999', cost: '88' });
    expect(bills[1]).toMatchObject({ usage: '2' });
  });

  it('reports missing usage/cost columns', () => {
    const { error } = billsFromCsvRows([{ Month: 'Jan' }], ['Month']);
    expect(error).toMatch(/usage\/cost/i);
  });

  it('requires 12 rows when mapping by index', () => {
    const { error } = billsFromCsvRows(orderedYear().slice(0, 6), ['Usage kWh', 'Cost']);
    expect(error).toMatch(/6 rows/);
  });
});
