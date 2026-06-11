// All model constants live here and are surfaced in the editable Assumptions panel.
// Nothing in the engine hardcodes a number that belongs in this file.

export const DEFAULTS = {
  solarCostPerWatt: 2.70,          // installed cost, $/W DC (was hardcoded $3.00 in v1)
  baseYieldKWhPerKW: 1350,         // Missouri-typical annual yield; v1 used 1200 nationwide
  panelDegradation: 0.005,         // 0.5%/yr
  itcRate: 0.30,                   // federal Investment Tax Credit
  batteryUsableKWh: 13.5,
  batteryCostPerKWh: 900,
  batteryRoundTripEff: 0.90,
  batteryCyclesPerYear: 300,
  co2TonsPerKWh: 0.000637,         // eGRID SRMW subregion, not the generic 0.0007
  discountRate: 0.05,
  analysisYears: 25,
};

export const ORIENTATION = {
  south: 1.0,
  southeast: 0.94,
  southwest: 0.94,
  east: 0.85,
  west: 0.85,
  north: 0.65,
};

export const SHADE = {
  minimal: 0.95,
  moderate: 0.75,
  heavy: 0.50,
};

// Typical residential hourly load shape (relative weights, midnight..11pm).
// Used to allocate monthly usage across TOU periods.
export const HOURLY_PROFILE = [
  0.55, 0.50, 0.48, 0.47, 0.48, 0.55,
  0.70, 0.85, 0.90, 0.88, 0.85, 0.85,
  0.88, 0.90, 0.95, 1.05, 1.20, 1.40,
  1.55, 1.50, 1.35, 1.15, 0.90, 0.70,
];

// Growth scenarios for sensitivity analysis: utility cost escalation and
// household consumption growth, per year.
export const SCENARIOS = {
  low:  { cost: 0.02, consumption: 0.000 },
  base: { cost: 0.03, consumption: 0.005 },
  high: { cost: 0.045, consumption: 0.010 },
};
