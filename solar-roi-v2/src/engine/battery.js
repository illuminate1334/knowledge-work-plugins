import { DAYS_IN_MONTH } from './assumptions.js';
import { marginalRate, rateForHour } from './utilityCosts.js';
import { netHourly } from './netting.js';

// Daily dispatch simulation.
//
// v2 valued a battery purely as TOU arbitrage and therefore reported $0 on any
// flat or tiered plan. That misses the value driver that dominates under modern
// tariffs: when the export credit is below retail, every kWh you store instead
// of exporting is worth (retail − export credit), with no TOU spread required.
//
// Returns shift[month][hour] = change in NET GRID FLOW, in kWh per average day:
//   > 0  grid supplies more (charging: less export, or more import)
//   < 0  grid supplies less (discharging: less import)

function hourValue(hour, rate, monthlyUsage) {
  const hourly = rateForHour(hour, rate);
  return hourly == null ? marginalRate(monthlyUsage, rate) : hourly;
}

export function dispatch({ productionShape, loadShape, rate, creditRate, a }) {
  const capacity = a.batteryUsableKWh * a.batteryMaxCycleDepth;
  const eff = a.batteryRoundTripEff;

  return productionShape.map((prodDay, m) => {
    const loadDay = loadShape[m];
    const monthlyUsage = loadDay.reduce((x, y) => x + y, 0) * DAYS_IN_MONTH[m];
    const { exported, imported } = netHourly(prodDay, loadDay);
    const shift = new Array(24).fill(0);

    const value = Array.from({ length: 24 }, (_, h) => hourValue(h, rate, monthlyUsage));
    // Storing solar instead of exporting earns (retail − export credit).
    const solarStoreGain = value.map((v) => v * (1 - creditRate));

    // 1) Charge from surplus, cheapest-opportunity-cost first (i.e. the hours
    //    whose exports are worth least). Bounded by capacity.
    let stored = 0;
    const surplusHours = exported
      .map((kWh, h) => ({ h, kWh, gain: solarStoreGain[h] }))
      .filter((x) => x.kWh > 0)
      .sort((x, y) => y.gain - x.gain);
    for (const { h, kWh } of surplusHours) {
      if (stored >= capacity) break;
      const take = Math.min(kWh, capacity - stored);
      shift[h] += take; // less export
      stored += take;
    }

    // 2) Discharge into the most expensive import hours.
    let deliverable = stored * eff;
    const deficitHours = imported
      .map((kWh, h) => ({ h, kWh, v: value[h] }))
      .filter((x) => x.kWh > 0)
      .sort((x, y) => y.v - x.v);
    for (const { h, kWh } of deficitHours) {
      if (deliverable <= 0) break;
      const give = Math.min(kWh, deliverable);
      shift[h] -= give; // less import
      deliverable -= give;
    }

    // 3) TOU arbitrage with leftover capacity: buy cheap, serve expensive.
    //    Only worthwhile if the spread beats round-trip losses.
    if (rate.type === 'tou' && stored < capacity) {
      let room = capacity - stored;
      const cheap = [...Array(24).keys()]
        .filter((h) => shift[h] === 0)
        .sort((x, y) => value[x] - value[y])[0];
      const remainingDeficit = deficitHours
        .map(({ h, kWh, v }) => ({ h, kWh: kWh + Math.min(0, shift[h]), v }))
        .filter((x) => x.kWh > 0)
        .sort((x, y) => y.v - x.v);
      if (cheap != null && remainingDeficit.length > 0) {
        for (const { h, kWh, v } of remainingDeficit) {
          if (room <= 0) break;
          if (v * eff <= value[cheap]) break; // spread doesn't cover losses
          const give = Math.min(kWh, room * eff);
          shift[h] -= give;
          shift[cheap] += give / eff; // grid charging raises import
          room -= give / eff;
        }
      }
    }

    return shift;
  });
}

export function batteryCost(a) {
  return a.batteryUsableKWh * a.batteryCostPerKWh;
}
