import React from 'react';
import { DEFAULTS } from '../engine/assumptions.js';

const GROUPS = [
  ['Cost & production', [
    ['solarCostPerWatt', 'Solar cost ($/W)', 0.05],
    ['baseYieldKWhPerKW', 'Base yield (kWh/kW/yr)', 10],
    ['panelDegradation', 'Degradation (/yr)', 0.001],
    ['latitude', 'Latitude (°)', 0.5],
    ['tiltDegrees', 'Roof tilt (°)', 1],
  ]],
  ['Incentives', [
    ['itcRate', 'Federal ITC rate', 0.01],
    ['annualTaxLiability', 'Annual tax liability ($)', 500],
    ['itcCarryforwardYears', 'Carryforward (yrs)', 1],
  ]],
  ['Battery', [
    ['batteryUsableKWh', 'Usable capacity (kWh)', 0.5],
    ['batteryCostPerKWh', 'Cost ($/kWh)', 10],
    ['batteryRoundTripEff', 'Round-trip efficiency', 0.01],
    ['batteryReplacementYear', 'Replacement year', 1],
  ]],
  ['Ownership costs', [
    ['inverterReplacementYear', 'Inverter replaced (yr)', 1],
    ['inverterCostPerKW', 'Inverter cost ($/kW)', 10],
    ['annualOMPerKW', 'O&M ($/kW/yr)', 1],
    ['insurancePerYear', 'Insurance ($/yr)', 25],
    ['roofReplacementYear', 'Roof rework year (blank = none)', 1],
    ['roofReworkCost', 'Roof rework cost ($)', 250],
  ]],
  ['Financial', [
    ['discountRate', 'Discount rate', 0.005],
    ['analysisYears', 'Horizon (yrs)', 1],
    ['co2TonsPerKWh', 'CO₂ (tons/kWh)', 0.00001],
  ]],
];

export default function AssumptionsPanel({ assumptions, setAssumptions }) {
  return (
    <details className="assumptions">
      <summary>Model assumptions — all editable</summary>
      {GROUPS.map(([group, fields]) => (
        <div key={group}>
          <h3 className="agroup">{group}</h3>
          <div className="row">
            {fields.map(([key, label, step]) => (
              <div className="field" key={key} style={{ minWidth: 130 }}>
                <label>{label}</label>
                <input
                  type="number"
                  step={step}
                  value={assumptions[key] ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setAssumptions({ ...assumptions, [key]: raw === '' ? null : parseFloat(raw) || 0 });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <button className="link" onClick={() => setAssumptions({ ...DEFAULTS })}>Reset to defaults</button>
    </details>
  );
}
