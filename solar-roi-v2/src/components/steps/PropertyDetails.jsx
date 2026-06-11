import React from 'react';
import AssumptionsPanel from '../AssumptionsPanel.jsx';

export default function PropertyDetails({ property, setProperty, financing, setFinancing, assumptions, setAssumptions, next, back }) {
  const setP = (patch) => setProperty({ ...property, ...patch });
  const setF = (patch) => setFinancing({ ...financing, ...patch });

  return (
    <div className="card">
      <h2>Property & financing</h2>
      <p className="sub">These inputs drive system sizing and the cash-flow model.</p>

      <div className="row">
        <div className="field">
          <label>Usable roof area (sq ft)</label>
          <input type="number" min="0" value={property.roofSqFt} onChange={(e) => setP({ roofSqFt: parseFloat(e.target.value) || 0 })} />
        </div>
        <div className="field">
          <label>Primary roof orientation</label>
          <select value={property.orientation} onChange={(e) => setP({ orientation: e.target.value })}>
            <option value="south">South</option>
            <option value="southeast">Southeast</option>
            <option value="southwest">Southwest</option>
            <option value="east">East</option>
            <option value="west">West</option>
            <option value="north">North</option>
          </select>
        </div>
        <div className="field">
          <label>Shading</label>
          <select value={property.shade} onChange={(e) => setP({ shade: e.target.value })}>
            <option value="minimal">Minimal</option>
            <option value="moderate">Moderate</option>
            <option value="heavy">Heavy</option>
          </select>
        </div>
      </div>

      <h2 style={{ fontSize: 16, marginTop: 18 }}>Financing</h2>
      <div className="row">
        <div className="field">
          <label>Payment method</label>
          <select value={financing.type} onChange={(e) => setF({ type: e.target.value })}>
            <option value="cash">Cash</option>
            <option value="loan">Loan</option>
          </select>
        </div>
        {financing.type === 'loan' && (
          <>
            <div className="field">
              <label>APR (%)</label>
              <input type="number" step="0.1" value={financing.apr} onChange={(e) => setF({ apr: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="field">
              <label>Term (years)</label>
              <input type="number" value={financing.termYears} onChange={(e) => setF({ termYears: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="field">
              <label>Down payment ($)</label>
              <input type="number" value={financing.down} onChange={(e) => setF({ down: parseFloat(e.target.value) || 0 })} />
            </div>
          </>
        )}
        <label className="note" style={{ alignSelf: 'center' }}>
          <input type="checkbox" checked={financing.applyITC} onChange={(e) => setF({ applyITC: e.target.checked })} />{' '}
          Apply 30% federal tax credit
        </label>
      </div>

      <AssumptionsPanel assumptions={assumptions} setAssumptions={setAssumptions} />

      <div className="nav">
        <button onClick={back}>Back</button>
        <button className="primary" disabled={!(property.roofSqFt > 0)} onClick={next}>Run analysis</button>
      </div>
    </div>
  );
}
