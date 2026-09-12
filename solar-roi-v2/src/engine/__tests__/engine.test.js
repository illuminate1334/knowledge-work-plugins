import { describe, it, expect } from 'vitest';
import { DEFAULTS, DAYS_IN_MONTH, SCENARIOS } from '../assumptions.js';
import { monthlyCost, periodForHour, marginalRate, avgRetailRate } from '../utilityCosts.js';
import { sizeSystem, measuredYieldForGeometry } from '../production.js';
import { buildProductionShape } from '../solarShape.js';
import { buildLoadShape } from '../loadShape.js';
import { solarSavings } from '../netting.js';
import { dispatch } from '../battery.js';
import { itcSchedule } from '../incentives.js';
import { lifecycleCost } from '../lifecycle.js';
import { loanPayment, loanSchedule, annualDebtService } from '../financing.js';
import { project, annualizedReturn } from '../projections.js';
import { impliedEscalator } from '../quoteAudit.js';
import { reconcile } from '../reconciliation.js';
import { buildModel } from '../model.js';
import { resolveMonthlyUsage } from '../billEstimate.js';

const a = { ...DEFAULTS };
const FLAT = { type: 'flat', rate: 0.13, fixedCharge: 12 };
const TIERED = { type: 'tiered', fixedCharge: 10, tiers: [{ limit: 750, rate: 0.10 }, { limit: Infinity, rate: 0.20 }] };
const TOU = {
  type: 'tou',
  fixedCharge: 10,
  periods: {
    peak: { hours: [14, 19], rate: 0.30 },
    offPeak: { rate: 0.12 },
    superOffPeak: { hours: [22, 6], rate: 0.07 },
  },
};

const MONTHLY = new Array(12).fill(1000); // 12,000 kWh/yr

describe('utilityCosts', () => {
  it('flat rate', () => {
    expect(monthlyCost(1000, FLAT)).toBeCloseTo(142);
  });

  it('tiered charges each tier its own marginal price', () => {
    expect(monthlyCost(1000, TIERED, false)).toBeCloseTo(125);
    expect(monthlyCost(500, TIERED, false)).toBeCloseTo(50);
  });

  it('marginalRate returns the price of the next kWh, not the average', () => {
    expect(marginalRate(1000, TIERED)).toBe(0.20);
    expect(marginalRate(500, TIERED)).toBe(0.10);
    // The average at 1000 kWh is 0.125 — solar displaces at 0.20.
    expect(avgRetailRate(12000, TIERED)).toBeLessThan(marginalRate(1000, TIERED));
  });

  it('super-off-peak wraps midnight', () => {
    expect(periodForHour(23, TOU.periods)).toBe('superOffPeak');
    expect(periodForHour(3, TOU.periods)).toBe('superOffPeak');
    expect(periodForHour(16, TOU.periods)).toBe('peak');
    expect(periodForHour(10, TOU.periods)).toBe('offPeak');
  });

  it('non-wrapping super-off-peak window stays bounded', () => {
    const periods = { ...TOU.periods, superOffPeak: { hours: [1, 6], rate: 0.07 } };
    expect(periodForHour(3, periods)).toBe('superOffPeak');
    expect(periodForHour(0, periods)).toBe('offPeak');
    expect(periodForHour(12, periods)).toBe('offPeak');
    expect(periodForHour(23, periods)).toBe('offPeak');
  });
});

describe('solar shape', () => {
  const shape = buildProductionShape(12000, { latitude: 38.6, tiltDegrees: 25, orientation: 'south' });

  it('normalizes to exactly the annual production it was given', () => {
    const total = shape.reduce((s, day, m) => s + day.reduce((x, y) => x + y, 0) * DAYS_IN_MONTH[m], 0);
    expect(total).toBeCloseTo(12000, 6);
  });

  it('produces nothing at night and peaks near solar noon', () => {
    const june = shape[5];
    expect(june[2]).toBe(0);
    expect(june[23]).toBe(0);
    const peakHour = june.indexOf(Math.max(...june));
    expect(peakHour).toBeGreaterThanOrEqual(11);
    expect(peakHour).toBeLessThanOrEqual(13);
  });

  it('generates more in summer than winter at mid-latitude', () => {
    const june = shape[5].reduce((x, y) => x + y, 0);
    const december = shape[11].reduce((x, y) => x + y, 0);
    expect(june).toBeGreaterThan(december * 1.5);
  });

  it('shifts the peak later for west-facing arrays', () => {
    const west = buildProductionShape(12000, { latitude: 38.6, tiltDegrees: 25, orientation: 'west' });
    const southPeak = shape[5].indexOf(Math.max(...shape[5]));
    const westPeak = west[5].indexOf(Math.max(...west[5]));
    expect(westPeak).toBeGreaterThan(southPeak);
  });
});

describe('weather-driven production', () => {
  // A deliberately un-clear-sky year: a wet summer and a bright winter. If the
  // model ignored these weights the months would follow geometry instead.
  const ODD = [900, 850, 700, 600, 400, 300, 300, 350, 500, 700, 850, 950];

  it('redistributes energy across months to match measured weather', () => {
    const shape = buildProductionShape(12000, {
      latitude: 38.6, tiltDegrees: 25, orientation: 'south', monthlyWeights: ODD,
    });
    const monthly = shape.map((day, m) => day.reduce((x, y) => x + y, 0) * DAYS_IN_MONTH[m]);
    const total = monthly.reduce((x, y) => x + y, 0);
    expect(total).toBeCloseTo(12000, 4);
    // January now beats June, the reverse of the clear-sky ordering.
    expect(monthly[0]).toBeGreaterThan(monthly[5]);
    const wSum = ODD.reduce((x, y) => x + y, 0);
    expect(monthly[0]).toBeCloseTo((12000 * ODD[0]) / wSum, 4);
  });

  it('keeps the intra-day curve geometric even when months are reweighted', () => {
    const shape = buildProductionShape(12000, {
      latitude: 38.6, tiltDegrees: 25, orientation: 'south', monthlyWeights: ODD,
    });
    expect(shape[5][2]).toBe(0);  // still nothing at 2am
    const peak = shape[5].indexOf(Math.max(...shape[5]));
    expect(peak).toBeGreaterThanOrEqual(11);
    expect(peak).toBeLessThanOrEqual(13);
  });

  it('ignores malformed weights and falls back to clear sky', () => {
    const clear = buildProductionShape(12000, { latitude: 38.6, tiltDegrees: 25, orientation: 'south' });
    for (const bad of [[1, 2, 3], new Array(12).fill(0), new Array(12).fill(NaN), null]) {
      const s = buildProductionShape(12000, {
        latitude: 38.6, tiltDegrees: 25, orientation: 'south', monthlyWeights: bad,
      });
      expect(s[5][12]).toBeCloseTo(clear[5][12], 6);
    }
  });

  it('does not double-count orientation when yield already accounts for it', () => {
    const args = { yearlyUsage: 12000, roofSqFt: 2000, shade: 'minimal', a };
    // West-facing: the clear-sky path applies a 0.85 orientation derate...
    const assumed = sizeSystem({ ...args, orientation: 'west' });
    // ...but a measured yield for a west-facing array already includes it.
    const measured = sizeSystem({ ...args, orientation: 'west', measuredYieldPerKW: a.baseYieldKWhPerKW });
    expect(assumed.effectiveYield).toBeCloseTo(a.baseYieldKWhPerKW * 0.85 * 0.95, 6);
    expect(measured.effectiveYield).toBeCloseTo(a.baseYieldKWhPerKW * 0.95, 6);
    expect(measured.usingMeasuredYield).toBe(true);
  });

  it('re-derates measured yield when the array orientation no longer matches the snapshot', () => {
    const weather = {
      annualKWhPerKW: 1500,
      accountsForOrientation: true,
      orientation: 'south',
      tiltDegrees: 25,
    };
    const south = measuredYieldForGeometry(weather, { orientation: 'south', tiltDegrees: 25 });
    const west = measuredYieldForGeometry(weather, { orientation: 'west', tiltDegrees: 25 });
    expect(south).toBeCloseTo(1500);
    expect(west).toBeCloseTo(1500 * 0.85);
    expect(measuredYieldForGeometry(weather, { orientation: 'south', tiltDegrees: 30 })).toBeNull();
  });

  it('does not keep a south-facing PVWatts yield after the array is turned west', () => {
    const weather = {
      annualKWhPerKW: 1500,
      monthly: ODD,
      source: 'test',
      accountsForOrientation: true,
      orientation: 'south',
      tiltDegrees: 25,
    };
    const inputs = {
      monthlyUsage: MONTHLY,
      rate: FLAT,
      netMetering: { available: true, creditRate: 1 },
      financing: { type: 'cash', applyITC: true },
      assumptions: a,
    };
    const south = buildModel({ ...inputs, property: { roofSqFt: 2000, orientation: 'south', shade: 'minimal' }, weather });
    const west = buildModel({ ...inputs, property: { roofSqFt: 2000, orientation: 'west', shade: 'minimal' }, weather });
    expect(west.sized.usingMeasuredYield).toBe(true);
    expect(west.sized.effectiveYield).toBeLessThan(south.sized.effectiveYield);
    expect(west.sized.effectiveYield).toBeCloseTo(south.sized.effectiveYield * 0.85, 4);
    expect(west.sized.systemKW).toBeGreaterThan(south.sized.systemKW);
  });

  it('flows weather through buildModel and changes the outcome', () => {
    const inputs = {
      monthlyUsage: MONTHLY,
      rate: FLAT,
      netMetering: { available: true, creditRate: 1 },
      property: { roofSqFt: 1200, orientation: 'south', shade: 'minimal' },
      financing: { type: 'cash', applyITC: true },
      assumptions: a,
    };
    const sunny = buildModel({ ...inputs, weather: { annualKWhPerKW: 1750, monthly: ODD, source: 'test' } });
    const cloudy = buildModel({ ...inputs, weather: { annualKWhPerKW: 950, monthly: ODD, source: 'test' } });
    expect(sunny.sized.usingMeasuredYield).toBe(true);
    expect(sunny.year1Production).toBeGreaterThan(cloudy.year1Production);
    expect(sunny.solarOnly.base.npv).toBeGreaterThan(cloudy.solarOnly.base.npv);
  });
});

describe('hourly netting (the v2 structural flaw)', () => {
  const loadShape = buildLoadShape(MONTHLY);
  const productionShape = buildProductionShape(11000, { latitude: 38.6, tiltDegrees: 25, orientation: 'south' });

  it('self-consumption is well below 100% even when annual production < annual load', () => {
    const r = solarSavings({ productionShape, loadShape, rate: FLAT, creditRate: 1 });
    // v2 assumed min(annual prod, annual load) => ~92% self-consumed.
    expect(r.selfConsumptionRate).toBeLessThan(0.75);
    expect(r.selfConsumptionRate).toBeGreaterThan(0.2);
  });

  it('partial export credit slashes savings relative to 1:1 net metering', () => {
    const full = solarSavings({ productionShape, loadShape, rate: FLAT, creditRate: 1 });
    const partial = solarSavings({ productionShape, loadShape, rate: FLAT, creditRate: 0.25 });
    expect(partial.savings).toBeLessThan(full.savings * 0.85);
    expect(partial.savings).toBeGreaterThan(0);
  });

  it('true 1:1 net metering values every kWh at the retail rate', () => {
    const r = solarSavings({ productionShape, loadShape, rate: FLAT, creditRate: 1 });
    expect(r.savings / 11000).toBeCloseTo(FLAT.rate, 4);
  });

  it('nets kWh before applying the tier schedule, dropping the household out of the top tier', () => {
    const r = solarSavings({ productionShape, loadShape, rate: TIERED, creditRate: 1 });
    const perKWh = r.savings / 11000;
    // Beats the flat average (0.125) because solar peels off tier-2 kWh first,
    // but below the 0.20 marginal rate because netting also empties tier 1.
    expect(perKWh).toBeGreaterThan(avgRetailRate(12000, TIERED));
    expect(perKWh).toBeLessThan(marginalRate(1000, TIERED));
  });

  it('the fixed charge survives solar', () => {
    const r = solarSavings({ productionShape, loadShape, rate: FLAT, creditRate: 1 });
    expect(r.solarBill).toBeGreaterThanOrEqual(12 * 12 - 0.01);
  });
});

describe('battery dispatch', () => {
  const loadShape = buildLoadShape(MONTHLY);
  const productionShape = buildProductionShape(11000, { latitude: 38.6, tiltDegrees: 25, orientation: 'south' });

  const valueOf = (rate, creditRate) => {
    const shift = dispatch({ productionShape, loadShape, rate, creditRate, a });
    const without = solarSavings({ productionShape, loadShape, rate, creditRate });
    const withB = solarSavings({ productionShape, loadShape, rate, creditRate, batteryShift: shift });
    return withB.savings - without.savings;
  };

  it('is worth real money on a FLAT rate when export credit is partial', () => {
    // v2 reported $0 here because it only modelled TOU arbitrage.
    expect(valueOf(FLAT, 0.25)).toBeGreaterThan(100);
  });

  it('LOSES money on a flat rate under true 1:1 net metering', () => {
    // Nothing to arbitrage and the grid already banks surplus at full value,
    // so all a battery can do is burn round-trip losses. Honest answer: negative.
    const v = valueOf(FLAT, 1);
    expect(v).toBeLessThan(0);
    expect(v).toBeGreaterThan(-150);
  });

  it('captures TOU arbitrage', () => {
    expect(valueOf(TOU, 1)).toBeGreaterThan(0);
  });

  it('never moves more than its usable capacity per day', () => {
    const shift = dispatch({ productionShape, loadShape, rate: TOU, creditRate: 0.25, a });
    for (const day of shift) {
      const charged = day.filter((v) => v > 0).reduce((x, y) => x + y, 0);
      expect(charged).toBeLessThanOrEqual(a.batteryUsableKWh * a.batteryMaxCycleDepth + 1e-6);
    }
  });
});

describe('incentives — the ITC is non-refundable', () => {
  it('caps realization at annual tax liability and carries forward', () => {
    const r = itcSchedule(30000, { ...a, annualTaxLiability: 3000, itcCarryforwardYears: 5 });
    expect(r.credit).toBeCloseTo(9000);
    expect(r.realized[0]).toBe(3000);
    expect(r.totalRealized).toBeCloseTo(9000);
    expect(r.fullyUsable).toBe(true);
  });

  it('forfeits credit that carryforward cannot absorb', () => {
    const r = itcSchedule(30000, { ...a, annualTaxLiability: 1000, itcCarryforwardYears: 5 });
    expect(r.totalRealized).toBeCloseTo(5000);
    expect(r.forfeited).toBeCloseTo(4000);
    expect(r.fullyUsable).toBe(false);
  });

  it('realizes nothing with zero tax liability', () => {
    const r = itcSchedule(30000, { ...a, annualTaxLiability: 0 });
    expect(r.totalRealized).toBe(0);
    expect(r.forfeited).toBeCloseTo(9000);
  });
});

describe('lifecycle costs', () => {
  it('charges the inverter in its replacement year only', () => {
    const on = lifecycleCost(a.inverterReplacementYear, { systemKW: 8, hasBattery: false, a });
    const off = lifecycleCost(a.inverterReplacementYear + 1, { systemKW: 8, hasBattery: false, a });
    expect(on.cost - off.cost).toBeGreaterThan(a.inverterCostPerKW * 8 * 0.9);
    expect(on.items.some((i) => /Inverter/.test(i.label))).toBe(true);
  });

  it('charges O&M every year', () => {
    expect(lifecycleCost(3, { systemKW: 8, hasBattery: false, a }).om).toBeGreaterThan(0);
  });
});

describe('financing', () => {
  it('amortizes correctly', () => {
    expect(loanPayment(20000, 7.5, 15)).toBeCloseTo(185.4, 0);
    expect(loanPayment(12000, 0, 10)).toBeCloseTo(100);
  });

  it('does not skip debt when the term is zero or invalid', () => {
    expect(loanPayment(12000, 0, 0)).toBeCloseTo(1000); // clamped to 1 year
    expect(loanPayment(12000, 0, -5)).toBeCloseTo(1000);
    const s = loanSchedule({ principal: 20000, apr: 6, termYears: 0, itcPaydown: 0 });
    expect(s.months).toBe(12);
    expect(annualDebtService(s, 1)).toBeGreaterThan(0);
    expect(annualDebtService(s, 1)).toBeCloseTo(s.initialPayment * 12);
  });

  it('quotes the teaser and recasts upward if the ITC paydown never arrives', () => {
    const withPaydown = loanSchedule({
      principal: 30000, apr: 7.5, termYears: 20, itcExpected: 9000, applyPaydown: true,
    });
    const without = loanSchedule({
      principal: 30000, apr: 7.5, termYears: 20, itcExpected: 9000, applyPaydown: false,
    });
    expect(withPaydown.quotedPayment).toBeLessThan(loanPayment(30000, 7.5, 20));
    expect(withPaydown.trapPayment).toBeGreaterThan(withPaydown.quotedPayment * 1.05);
    expect(without.laterPayment).toBeGreaterThan(without.initialPayment * 1.05);
    expect(without.laterPayment).toBeCloseTo(without.trapPayment);
    expect(withPaydown.laterPayment).toBeLessThan(without.laterPayment);
  });

  it('stops charging debt service after the term', () => {
    const s = loanSchedule({ principal: 20000, apr: 6, termYears: 10, itcPaydown: 0 });
    expect(annualDebtService(s, 10)).toBeGreaterThan(0);
    expect(annualDebtService(s, 11)).toBe(0);
  });
});

describe('projections', () => {
  const loadShape = buildLoadShape(MONTHLY);
  const productionShape = buildProductionShape(11000, { latitude: 38.6, tiltDegrees: 25, orientation: 'south' });
  const base = {
    loadShape,
    productionShape,
    rate: FLAT,
    creditRate: 1,
    systemKW: 8,
    grossCost: 25000,
    scenario: SCENARIOS.base,
    financing: { type: 'cash', applyITC: true },
    a,
  };

  it('treats the ITC as cash arriving at tax time, not a capex discount', () => {
    const r = project(base);
    expect(r.rows[0].net).toBeCloseTo(-25000); // full gross out the door
    expect(r.rows[1].itc).toBeGreaterThan(0);  // credit lands in year 1
  });

  it('subtracts lifecycle costs every year', () => {
    const r = project(base);
    expect(r.rows[5].lifecycle).toBeGreaterThan(0);
  });

  it('escalates savings cumulatively', () => {
    const r = project(base);
    const growth = r.rows[3].savings / r.rows[2].savings;
    expect(growth).toBeGreaterThan(1.02);
    expect(growth).toBeLessThan(1.031);
  });

  it('treats year 1 as the unelevated baseline (factor 1.0)', () => {
    const r = project(base);
    expect(r.rows[1].savings).toBeCloseTo(r.year1.savings, 4);
    const y2overY1 = r.rows[2].savings / r.rows[1].savings;
    expect(y2overY1).toBeGreaterThan(1.02);
    expect(y2overY1).toBeLessThan(1.04);
  });

  it('does not count the ITC as cash when it is applied to loan principal', () => {
    const loan = { type: 'loan', apr: 7.5, termYears: 20, down: 0, applyITC: true, itcPaydown: true };
    const r = project({ ...base, grossCost: 30000, financing: loan });
    const itcCash = r.rows.reduce((s, row) => s + row.itc, 0);
    expect(r.itc.totalRealized).toBeGreaterThan(0);
    expect(itcCash).toBe(0);
  });

  it('counts the ITC as a cash inflow when it is not applied to principal', () => {
    const r = project({
      ...base,
      grossCost: 30000,
      financing: { type: 'loan', apr: 7.5, termYears: 20, down: 0, applyITC: true, itcPaydown: false },
    });
    expect(r.rows.reduce((s, row) => s + row.itc, 0)).toBeCloseTo(r.itc.totalRealized);
  });

  it('does not inflate loan+paydown NPV by both the credit and the reduced debt', () => {
    const common = { ...base, grossCost: 30000 };
    const paydown = project({
      ...common,
      financing: { type: 'loan', apr: 7.5, termYears: 20, down: 0, applyITC: true, itcPaydown: true },
    });
    const keep = project({
      ...common,
      financing: { type: 'loan', apr: 7.5, termYears: 20, down: 0, applyITC: true, itcPaydown: false },
    });
    // Double-counting would make paydown better by roughly the PV of the
    // credit (~$9k). After the fix the gap is the interest-rate differential.
    expect(paydown.npv - keep.npv).toBeLessThan(paydown.itc.totalRealized * 0.4);
  });

  it('still subtracts debt when termYears is 0', () => {
    const r = project({
      ...base,
      financing: { type: 'loan', apr: 6, termYears: 0, down: 0, applyITC: false, itcPaydown: false },
    });
    const totalDebt = r.rows.reduce((s, row) => s + row.debt, 0);
    expect(totalDebt).toBeGreaterThan(0);
    expect(r.rows[1].debt).toBeGreaterThan(0);
  });

  it('surfaces a payment jump if the tax credit is not applied to principal', () => {
    const r = project({
      ...base,
      grossCost: 30000,
      financing: { type: 'loan', apr: 7.5, termYears: 20, down: 0, applyITC: true, itcPaydown: true },
    });
    expect(r.monthlyPayment).toBeGreaterThan(0);
    expect(r.laterMonthlyPayment).toBeGreaterThan(r.monthlyPayment * 1.05);
  });

  it('a zero-tax-liability household gets a materially worse outcome', () => {
    const rich = project(base);
    const poor = project({ ...base, a: { ...a, annualTaxLiability: 0 } });
    expect(poor.npv).toBeLessThan(rich.npv);
    expect(rich.npv - poor.npv).toBeGreaterThan(5000);
  });

  it('signed annualized return reports losses as losses', () => {
    expect(annualizedReturn(20000, -5000)).toBeLessThan(0);
    expect(annualizedReturn(20000, 20000)).toBeGreaterThan(0);
    expect(annualizedReturn(20000, -20000)).toBe(-100);
  });
});

describe('quote audit', () => {
  it('backs out the escalation rate a lifetime claim requires', () => {
    const g = impliedEscalator(25 * 1000 * 1.6, 1000, 25);
    expect(g).toBeGreaterThan(0.03);
    expect(g).toBeLessThan(0.08);
  });

  it('returns null when no plausible rate reaches the claim', () => {
    expect(impliedEscalator(10_000_000, 1000, 25)).toBeNull();
  });
});

describe('reconciliation gate', () => {
  const bills = Array.from({ length: 12 }, () => ({ usage: 1000, cost: 142 }));
  it('passes when the model matches actual bills', () => {
    expect(reconcile(bills, FLAT).status).toBe('match');
  });
  it('fails when the tariff is wrong', () => {
    expect(reconcile(bills, { type: 'flat', rate: 0.20, fixedCharge: 12 }).status).toBe('mismatch');
  });
});

describe('buildModel end to end', () => {
  const inputs = {
    monthlyUsage: MONTHLY,
    rate: FLAT,
    netMetering: { available: true, creditRate: 1 },
    property: { roofSqFt: 1200, orientation: 'south', shade: 'minimal' },
    financing: { type: 'cash', applyITC: true },
    assumptions: a,
  };

  it('produces a coherent model with a walk-away price', () => {
    const m = buildModel(inputs);
    expect(m.systemKW).toBeGreaterThan(0);
    expect(m.year1Production).toBeGreaterThan(0);
    expect(m.solarOnly.base.rows).toHaveLength(a.analysisYears + 1);
    expect(m.walkAway.price).toBeGreaterThan(0);
    expect(m.rec.scored).toHaveLength(2);
  });

  it('walk-away price is the NPV break-even, so cheaper is better', () => {
    const m = buildModel(inputs);
    const cheap = buildModel({ ...inputs, assumptions: { ...a, solarCostPerWatt: m.walkAway.price - 0.5 } });
    const dear = buildModel({ ...inputs, assumptions: { ...a, solarCostPerWatt: m.walkAway.price + 0.5 } });
    expect(cheap.solarOnly.base.npv).toBeGreaterThan(0);
    expect(dear.solarOnly.base.npv).toBeLessThan(0);
  });

  it('flags a quoted array that will not fit the usable roof', () => {
    const m = buildModel({
      ...inputs,
      property: { roofSqFt: 300, orientation: 'south', shade: 'minimal' },
      quote: { systemKW: 20, totalPrice: 54000, annualProductionKWh: 0, firstYearSavings: 0, lifetimeSavings: 0, includesLifecycleCosts: true },
    });
    expect(m.audit.findings.some((f) => /fit the usable roof/i.test(f.title))).toBe(true);
  });

  it('flags the re-amortization trap when the payment would jump without ITC paydown', () => {
    const m = buildModel({
      ...inputs,
      financing: { type: 'loan', apr: 7.5, termYears: 20, down: 0, applyITC: true, itcPaydown: true },
      quote: {
        systemKW: 8, totalPrice: 32000, annualProductionKWh: 0, firstYearSavings: 0,
        lifetimeSavings: 0, monthlyPayment: 0, includesLifecycleCosts: true,
      },
    });
    expect(m.solarOnly.base.laterMonthlyPayment).toBeGreaterThan(m.solarOnly.base.monthlyPayment * 1.05);
    expect(m.audit.findings.some((f) => /credit is not applied to principal/i.test(f.title))).toBe(true);
  });

  it('audits a quote and flags an inflated production claim', () => {
    const m = buildModel({
      ...inputs,
      quote: { systemKW: 8, totalPrice: 32000, annualProductionKWh: 16000, firstYearSavings: 2400, lifetimeSavings: 90000, includesLifecycleCosts: false },
    });
    expect(m.audit.findings.some((f) => /production/i.test(f.title))).toBe(true);
    expect(m.audit.verdict).toMatch(/do not hold up/i);
  });
});

describe('resolveMonthlyUsage', () => {
  it('does not mix the average-bill estimate into an incomplete detailed table', () => {
    const partial = [1000, 1000, 1000, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(resolveMonthlyUsage({ billMode: 'detailed', detailedUsage: partial, avgBill: 160, rate: FLAT })).toEqual([]);
    const full = new Array(12).fill(900);
    expect(resolveMonthlyUsage({ billMode: 'detailed', detailedUsage: full, avgBill: 160, rate: FLAT })).toEqual(full);
  });

  it('uses the average-bill path only in quick mode', () => {
    const usage = resolveMonthlyUsage({ billMode: 'quick', detailedUsage: [], avgBill: 160, rate: FLAT });
    expect(usage).toHaveLength(12);
    expect(usage.some((u) => u > 0)).toBe(true);
  });
});
