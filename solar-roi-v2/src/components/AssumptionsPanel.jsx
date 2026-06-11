import React from 'react';
import { DEFAULTS } from '../engine/assumptions.js';

const FIELDS = [
  ['solarCostPerWatt', 'Solar cost ($/W installed)', 0.05],
  ['baseYieldKWhPerKW', 'Base yield (kWh/kW/yr)', 10],
  ['panelDegradation', 'Panel degradation (/yr)', 0.001],
  ['itcRate', 'Federal ITC rate', 0.01],
  ['batteryUsableKWh', 'Battery usable (kWh)', 0.5],
  ['batteryCostPerKWh', 'Battery cost ($/kWh)', 10],
  ['batteryRoundTripEff', 'Battery round-trip eff.', 0.01],
  ['batteryCyclesPerYear', 'Battery cycles/yr', 10],
  ['discountRate', 'Discount rate (NPV)', 0.005],
  ['analysisYears', 'Analysis horizon (yrs)', 1],
];

export default function AssumptionsPanel({ assumptions, setAssumptions }) {
  return (
    <details className="assumptions" style={{ marginTop: 18 }}>
      <summary>Model assumptions (editable)</summary>
      <div className="row" style={{ marginTop: 12 }}>
        {FIELDS.map(([key, label, step]) => (
          <div className="field" key={key} style={{ minWidth: 150, maxWidth: 200 }}>
            <label>{label}</label>
            <input
              type="number"
              step={step}
              value={assumptions[key]}
              onChange={(e) => setAssumptions({ ...assumptions, [key]: parseFloat(e.target.value) || 0 })}
            />
          </div>
        ))}
      </div>
      <button className="link" onClick={() => setAssumptions({ ...DEFAULTS })}>Reset to defaults</button>
    </details>
  );
}
