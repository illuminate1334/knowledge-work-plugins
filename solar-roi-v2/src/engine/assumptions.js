// All model constants live here and are surfaced in the editable Assumptions panel.
// Nothing in the engine hardcodes a number that belongs in this file.

export const DEFAULTS = {
  // --- Cost & production ---
  solarCostPerWatt: 2.70,          // installed cost, $/W DC
  baseYieldKWhPerKW: 1350,         // annual yield at ideal orientation, no shade
  panelDegradation: 0.005,         // 0.5%/yr
  latitude: 38.6,                  // drives the hourly production shape
  tiltDegrees: 25,                 // roof pitch; ~lat is optimal, 25° is a common roof

  // --- Incentives ---
  itcRate: 0.30,                   // federal Investment Tax Credit
  annualTaxLiability: 8000,        // ITC is NON-refundable — this caps what you can use
  itcCarryforwardYears: 5,

  // --- Battery ---
  batteryUsableKWh: 13.5,
  batteryCostPerKWh: 900,
  batteryRoundTripEff: 0.90,
  batteryMaxCycleDepth: 1.0,       // fraction of usable capacity cycled per day, max
  batteryReplacementYear: 15,
  batteryReplacementCostFactor: 0.55, // replacement cost as fraction of original

  // --- Lifecycle costs (v1/v2 ignored these entirely) ---
  inverterReplacementYear: 13,
  inverterCostPerKW: 180,
  annualOMPerKW: 18,               // monitoring, cleaning, minor repair
  omInflation: 0.025,
  insurancePerYear: 0,             // some carriers add a premium
  roofReplacementYear: null,       // if set, panels come off and go back on
  roofReworkCost: 4000,

  // --- Environment ---
  co2TonsPerKWh: 0.000637,         // eGRID SRMW subregion

  // --- Financial ---
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

// Panel azimuth in degrees from due south, positive toward west.
// Drives WHEN production happens (the shape); ORIENTATION drives HOW MUCH.
export const ORIENTATION_AZIMUTH = {
  south: 0,
  southeast: -45,
  southwest: 45,
  east: -90,
  west: 90,
  north: 180,
};

export const SHADE = {
  minimal: 0.95,
  moderate: 0.75,
  heavy: 0.50,
};

// Typical residential hourly load shape (relative weights, midnight..11pm).
// Scaled per-month by the user's actual billed kWh, so seasonality comes from
// their real bills rather than from this curve.
export const HOURLY_PROFILE = [
  0.55, 0.50, 0.48, 0.47, 0.48, 0.55,
  0.70, 0.85, 0.90, 0.88, 0.85, 0.85,
  0.88, 0.90, 0.95, 1.05, 1.20, 1.40,
  1.55, 1.50, 1.35, 1.15, 0.90, 0.70,
];

export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Growth scenarios for sensitivity analysis: utility cost escalation and
// household consumption growth, per year.
export const SCENARIOS = {
  low:  { cost: 0.02, consumption: 0.000 },
  base: { cost: 0.03, consumption: 0.005 },
  high: { cost: 0.045, consumption: 0.010 },
};
