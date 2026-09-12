import { DAYS_IN_MONTH } from './assumptions.js';
import { sizeSystem, grossSystemCost, measuredYieldForGeometry } from './production.js';
import { buildProductionShape } from './solarShape.js';
import { buildLoadShape } from './loadShape.js';
import { solarSavings } from './netting.js';
import { dispatch, batteryCost } from './battery.js';
import { lifecycleCost } from './lifecycle.js';
import { runSensitivity, project, annualizedReturn } from './projections.js';
import { walkAwayPricePerWatt } from './walkAway.js';
import { recommend } from './recommendations.js';
import { auditQuote } from './quoteAudit.js';
import { SCENARIOS } from './assumptions.js';

// One entry point for every mode (explore / audit / advise). The UI holds no
// modelling logic of its own — it renders whatever this returns.
export function buildModel({
  monthlyUsage,        // [12] kWh from the user's bills
  rate,
  netMetering,
  property,            // { roofSqFt, orientation, shade }
  financing,
  assumptions: a,
  quote = null,        // audit mode: { systemKW, totalPrice, ... }
  weather = null,      // { annualKWhPerKW, monthly[12], source, ... }
}) {
  const yearlyUsage = monthlyUsage.reduce((s, v) => s + (v || 0), 0);
  const creditRate = netMetering?.available ? (netMetering.creditRate ?? 1) : 0;

  const loadShape = buildLoadShape(monthlyUsage);

  // Audit mode takes the system from the quote; otherwise size it ourselves.
  const sized = sizeSystem({
    yearlyUsage,
    roofSqFt: property.roofSqFt,
    orientation: property.orientation,
    shade: property.shade,
    a,
    measuredYieldPerKW: measuredYieldForGeometry(weather, {
      orientation: property.orientation,
      tiltDegrees: a.tiltDegrees,
    }),
  });
  const systemKW = quote?.systemKW > 0 ? quote.systemKW : sized.systemKW;
  const year1Production = quote?.systemKW > 0
    ? systemKW * sized.effectiveYield
    : sized.year1Production;

  const productionShape = buildProductionShape(year1Production, {
    latitude: a.latitude,
    tiltDegrees: a.tiltDegrees,
    orientation: property.orientation,
    monthlyWeights: weather?.monthly ?? null,
  });

  const solarGross = quote?.totalPrice > 0 ? quote.totalPrice : grossSystemCost(systemKW, a);
  const battCost = batteryCost(a);

  // Year-1 netting, with and without storage.
  const netNoBatt = solarSavings({ productionShape, loadShape, rate, creditRate });
  const shift = dispatch({ productionShape, loadShape, rate, creditRate, a });
  const netWithBatt = solarSavings({ productionShape, loadShape, rate, creditRate, batteryShift: shift });

  const common = { loadShape, productionShape, rate, creditRate, systemKW, financing, a };
  const solarOnly = runSensitivity({ ...common, grossCost: solarGross, hasBattery: false });
  const solarBattery = runSensitivity({ ...common, grossCost: solarGross + battCost, hasBattery: true });

  const lifecycleTotal = Array.from({ length: a.analysisYears }, (_, i) =>
    lifecycleCost(i + 1, { systemKW, hasBattery: false, a }).cost,
  ).reduce((x, y) => x + y, 0);

  // Walk-away price: hold everything else fixed, solve for $/W where NPV = 0.
  const walkAway = walkAwayPricePerWatt((perWatt) =>
    project({
      ...common,
      a: { ...a, solarCostPerWatt: perWatt },
      grossCost: systemKW * 1000 * perWatt,
      hasBattery: false,
      scenario: SCENARIOS.base,
    }).npv,
  );

  const rec = recommend([
    { name: 'Solar only', sens: solarOnly, invested: solarOnly.base.totalInvested, years: a.analysisYears },
    { name: 'Solar + battery', sens: solarBattery, invested: solarBattery.base.totalInvested, years: a.analysisYears },
  ]);

  const audit = quote
    ? auditQuote({
        quote,
        rate,
        creditRate,
        a,
        model: {
          year1Production,
          year1Savings: netNoBatt.savings,
          itc: solarOnly.base.itc,
          monthlyPayment: solarOnly.base.monthlyPayment,
          laterMonthlyPayment: solarOnly.base.laterMonthlyPayment,
          lifecycleTotal,
          roofMaxKW: sized.roofMaxKW,
          selfConsumptionRate: netNoBatt.selfConsumptionRate,
        },
      })
    : null;

  return {
    yearlyUsage,
    creditRate,
    weather,
    sized,
    systemKW,
    year1Production,
    productionShape,
    loadShape,
    batteryShift: shift,
    solarGross,
    batteryCost: battCost,
    netNoBatt,
    netWithBatt,
    batteryAnnualValue: netWithBatt.savings - netNoBatt.savings,
    solarOnly,
    solarBattery,
    lifecycleTotal,
    walkAway,
    rec,
    audit,
    co2TonsYr1: year1Production * a.co2TonsPerKWh,
    annualizedReturn: annualizedReturn(
      solarOnly.base.totalInvested,
      solarOnly.base.netGain,
      a.analysisYears,
    ),
    monthlyShape: productionShape.map((day, m) => ({
      month: m,
      production: day.reduce((x, y) => x + y, 0) * DAYS_IN_MONTH[m],
      load: loadShape[m].reduce((x, y) => x + y, 0) * DAYS_IN_MONTH[m],
    })),
  };
}
