import { DAYS_IN_MONTH } from './assumptions.js';
import { monthlyCost, monthlyCostFromHourly, marginalRate, rateForHour, periodForHour } from './utilityCosts.js';

// Hour-by-hour netting. Savings are computed by DIFFERENCING TWO BILLS —
// baseline (no solar) minus post-solar — so tiered marginal pricing, TOU period
// overlap, and partial export credits all fall out of the arithmetic instead of
// being approximated with an average rate.
//
// Two tariff regimes, because they are genuinely different mechanisms:
//
//   creditRate >= 1  TRUE NET METERING. The meter runs backward: kWh are netted
//                    and you are billed on net consumption, with surplus banked
//                    forward as kWh. Netting happens BEFORE the tier/period
//                    schedule is applied.
//   creditRate <  1  EXPORT COMPENSATION (NEM 3.0 and successors). Imports are
//                    billed at retail; exports are paid a fraction of it. The
//                    two are priced separately and never net against each other.

export function netHourly(productionDay, loadDay) {
  const selfUse = [];
  const exported = [];
  const imported = [];
  for (let h = 0; h < 24; h++) {
    const p = productionDay[h] || 0;
    const l = loadDay[h] || 0;
    const s = Math.min(p, l);
    selfUse.push(s);
    exported.push(p - s);
    imported.push(l - s);
  }
  return { selfUse, exported, imported };
}

// Apply a battery's grid-flow shift to one day's import/export profile.
//   shift > 0  grid supplies more (charging: less export first, then more import)
//   shift < 0  grid supplies less (discharging: less import first, then more export)
function applyShift(exported, imported, shiftDay) {
  const ex = [...exported];
  const im = [...imported];
  if (!shiftDay) return { ex, im };
  for (let h = 0; h < 24; h++) {
    const s = shiftDay[h];
    if (s > 0) {
      const fromExport = Math.min(s, ex[h]);
      ex[h] -= fromExport;
      im[h] += s - fromExport;
    } else if (s < 0) {
      const fromImport = Math.min(-s, im[h]);
      im[h] -= fromImport;
      ex[h] += -s - fromImport;
    }
  }
  return { ex, im };
}

const TOU_PERIODS = ['peak', 'offPeak', 'superOffPeak'];

export function annualBillWithSolar({ productionShape, loadShape, rate, creditRate, batteryShift = null }) {
  const trueNEM = creditRate >= 1;
  const isTOU = rate.type === 'tou';

  let bill = 0;
  let importCost = 0;
  let creditTotal = 0;
  let selfConsumed = 0;
  let exportedTotal = 0;
  let importedTotal = 0;

  // kWh banked forward under true net metering (per TOU period, or one pool).
  const bank = { peak: 0, offPeak: 0, superOffPeak: 0, all: 0 };

  for (let m = 0; m < 12; m++) {
    const days = DAYS_IN_MONTH[m];
    const prod = productionShape ? productionShape[m] : new Array(24).fill(0);
    const { selfUse, exported, imported } = netHourly(prod, loadShape[m]);
    const { ex, im } = applyShift(exported, imported, batteryShift ? batteryShift[m] : null);

    const monthExport = ex.reduce((x, y) => x + y, 0) * days;
    const monthImport = im.reduce((x, y) => x + y, 0) * days;

    if (trueNEM) {
      // Net kWh first, bank the surplus, then price what's left.
      if (isTOU) {
        const net = { peak: 0, offPeak: 0, superOffPeak: 0 };
        for (let h = 0; h < 24; h++) {
          net[periodForHour(h, rate.periods)] += (im[h] - ex[h]) * days;
        }
        let monthCost = 0;
        for (const p of TOU_PERIODS) {
          if (!rate.periods[p]) continue;
          let n = net[p];
          if (n < 0) {
            bank[p] += -n;
            n = 0;
          } else {
            const use = Math.min(bank[p], n);
            bank[p] -= use;
            n -= use;
          }
          monthCost += n * rate.periods[p].rate;
        }
        bill += monthCost + (rate.fixedCharge || 0);
        importCost += monthCost;
      } else {
        let n = monthImport - monthExport;
        if (n < 0) {
          bank.all += -n;
          n = 0;
        } else {
          const use = Math.min(bank.all, n);
          bank.all -= use;
          n -= use;
        }
        const monthCost = monthlyCost(n, rate, false);
        bill += monthCost + (rate.fixedCharge || 0);
        importCost += monthCost;
      }
    } else {
      // Imports billed at retail; exports compensated at a fraction of it.
      const cost = monthlyCostFromHourly(im, days, rate, true);
      let credit = 0;
      if (creditRate > 0) {
        credit = isTOU
          ? ex.reduce((sum, kWh, hour) => sum + kWh * days * rateForHour(hour, rate) * creditRate, 0)
          : monthExport * marginalRate(monthImport, rate) * creditRate;
      }
      bill += cost - credit;
      importCost += cost;
      creditTotal += credit;
    }

    // Self-consumption for reporting: direct use plus anything the battery
    // shifted out of export.
    const shifted = batteryShift ? batteryShift[m].filter((v) => v > 0).reduce((x, y) => x + y, 0) * days : 0;
    selfConsumed += selfUse.reduce((x, y) => x + y, 0) * days + shifted;
    exportedTotal += monthExport;
    importedTotal += monthImport;
  }

  return { bill, importCost, creditTotal, selfConsumed, exported: exportedTotal, imported: importedTotal, bankLeftover: bank };
}

// Year-1 solar savings = baseline bill − post-solar bill.
export function solarSavings({ productionShape, loadShape, rate, creditRate, batteryShift = null }) {
  const baseline = annualBillWithSolar({ productionShape: null, loadShape, rate, creditRate: 0 });
  const withSolar = annualBillWithSolar({ productionShape, loadShape, rate, creditRate, batteryShift });
  const production = productionShape.reduce(
    (sum, day, m) => sum + day.reduce((x, y) => x + y, 0) * DAYS_IN_MONTH[m],
    0,
  );
  return {
    baselineBill: baseline.bill,
    solarBill: withSolar.bill,
    savings: baseline.bill - withSolar.bill,
    selfConsumptionRate: production > 0 ? Math.min(1, withSolar.selfConsumed / production) : 0,
    ...withSolar,
  };
}
