import { describe, it, expect } from 'vitest';
import { DEFAULTS } from '../assumptions.js';
import { monthlyCost, periodForHour, avgRetailRate } from '../utilityCosts.js';
import { sizeSystem } from '../production.js';
import { batteryEconomics } from '../battery.js';
import { loanPayment } from '../financing.js';
import { project, annualizedReturn } from '../projections.js';
import { reconcile } from '../reconciliation.js';

const a = { ...DEFAULTS };

const TOU = {
  type: 'tou',
  fixedCharge: 10,
  periods: {
    peak: { hours: [14, 19], rate: 0.30 },
    offPeak: { rate: 0.12 },
    superOffPeak: { hours: [22, 6], rate: 0.07 },
  },
};

describe('utilityCosts', () => {
  it('flat rate', () => {
    expect(monthlyCost(1000, { type: 'flat', rate: 0.13, fixedCharge: 12 })).toBeCloseTo(142);
  });

  it('tiered rate charges each tier its own marginal price', () => {
    const rate = { type: 'tiered', fixedCharge: 0, tiers: [{ limit: 750, rate: 0.10 }, { limit: Infinity, rate: 0.20 }] };
    // 750 @ 0.10 + 250 @ 0.20 = 75 + 50
    expect(monthlyCost(1000, rate)).toBeCloseTo(125);
    expect(monthlyCost(500, rate)).toBeCloseTo(50);
  });

  it('super-off-peak wraps midnight (precedence fix #8)', () => {
    expect(periodForHour(23, TOU.periods)).toBe('superOffPeak');
    expect(periodForHour(3, TOU.periods)).toBe('superOffPeak');
    expect(periodForHour(16, TOU.periods)).toBe('peak');
    expect(periodForHour(10, TOU.periods)).toBe('offPeak');
  });

  it('non-wrapping super-off-peak window stays bounded', () => {
    const periods = { ...TOU.periods, superOffPeak: { hours: [1, 6], rate: 0.07 } };
    expect(periodForHour(3, periods)).toBe('superOffPeak');
    expect(periodForHour(0, periods)).toBe('offPeak');
    expect(periodForHour(8, periods)).toBe('offPeak');
    expect(periodForHour(12, periods)).toBe('offPeak');
    expect(periodForHour(21, periods)).toBe('offPeak');
    expect(periodForHour(23, periods)).toBe('offPeak');
    expect(periodForHour(16, periods)).toBe('peak');
  });

  it('avgRetailRate excludes the fixed charge', () => {
    const rate = { type: 'flat', rate: 0.13, fixedCharge: 50 };
    expect(avgRetailRate(12000, rate)).toBeCloseTo(0.13);
  });
});

describe('production (fix #4: property inputs drive output)', () => {
  it('north-facing heavy shade produces far less than south minimal', () => {
    const south = sizeSystem({ yearlyUsage: 12000, roofSqFt: 2000, orientation: 'south', shade: 'minimal', a });
    const north = sizeSystem({ yearlyUsage: 12000, roofSqFt: 2000, orientation: 'north', shade: 'heavy', a });
    expect(north.derate).toBeLessThan(south.derate * 0.5);
    expect(north.systemKW).toBeGreaterThan(south.systemKW); // needs more kW for same usage
  });

  it('flags roof-limited systems', () => {
    const tiny = sizeSystem({ yearlyUsage: 20000, roofSqFt: 200, orientation: 'south', shade: 'minimal', a });
    expect(tiny.roofLimited).toBe(true);
    expect(tiny.offsetPct).toBeLessThan(1);
  });
});

describe('battery (fix #7: physics, not 15% magic)', () => {
  it('returns $0 savings on flat plans with an explanatory basis', () => {
    const r = batteryEconomics({ rate: { type: 'flat', rate: 0.13 }, a });
    expect(r.annualSavings).toBe(0);
    expect(r.basis).toMatch(/backup/i);
  });

  it('computes spread-based arbitrage on TOU', () => {
    const r = batteryEconomics({ rate: TOU, a });
    // (0.30-0.07) * 13.5 * 0.9 * 300
    expect(r.annualSavings).toBeCloseTo(0.23 * 13.5 * 0.9 * 300, 0);
  });
});

describe('financing', () => {
  it('amortizes correctly', () => {
    // $20k, 7.5% APR, 15yr → ~$185.40/mo
    expect(loanPayment(20000, 7.5, 15)).toBeCloseTo(185.4, 0);
  });
  it('handles 0% APR', () => {
    expect(loanPayment(12000, 0, 10)).toBeCloseTo(100);
  });
});

describe('projections', () => {
  const params = {
    baseUsage: 12000,
    year1Production: 11000,
    avgRetailRate: 0.13,
    nmCreditRate: 1.0,
    batteryAnnual: 0,
    grossCost: 25000,
    scenario: { cost: 0.03, consumption: 0.005 },
    financing: { type: 'cash', applyITC: true },
    a,
  };

  it('applies the ITC to capex (fix #5)', () => {
    const r = project(params);
    expect(r.netCapex).toBeCloseTo(25000 * 0.7);
  });

  it('escalator compounds cumulatively (fix #9)', () => {
    const r = project(params);
    const y1 = r.rows[1].solarSavings;
    const y2 = r.rows[2].solarSavings;
    // year-over-year growth ≈ cost escalation, damped slightly by degradation
    const growth = y2 / y1;
    expect(growth).toBeGreaterThan(1.02);
    expect(growth).toBeLessThan(1.031);
  });

  it('loan: down payment is the upfront outflow, payments hit each term year', () => {
    const r = project({ ...params, financing: { type: 'loan', apr: 7.5, termYears: 15, down: 2000, applyITC: true } });
    expect(r.rows[0].net).toBeCloseTo(-2000);
    expect(r.rows[1].loanPayments).toBeGreaterThan(0);
    expect(r.rows[16].loanPayments).toBe(0);
  });

  it('annualizedReturn is signed — losses report as losses (fix #6)', () => {
    expect(annualizedReturn(20000, -5000)).toBeLessThan(0);
    expect(annualizedReturn(20000, 20000)).toBeGreaterThan(0);
    expect(annualizedReturn(20000, -20000)).toBe(-100);
  });
});

describe('reconciliation gate (fix #10)', () => {
  const bills = Array.from({ length: 12 }, () => ({ usage: 1000, cost: 142 }));
  it('passes when the model matches actual bills', () => {
    const r = reconcile(bills, { type: 'flat', rate: 0.13, fixedCharge: 12 });
    expect(r.status).toBe('match');
  });
  it('fails when the tariff is wrong', () => {
    const r = reconcile(bills, { type: 'flat', rate: 0.20, fixedCharge: 12 });
    expect(r.status).toBe('mismatch');
  });
});
