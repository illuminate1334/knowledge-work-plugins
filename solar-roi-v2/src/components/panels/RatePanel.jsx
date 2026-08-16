import React, { useState } from 'react';
import { lookupUtilityRates } from '../../services/rateIntelligence.js';
import RateEditor from '../RateEditor.jsx';

const BLANK_RATE = { name: 'Manual entry', type: 'flat', rate: 0.13, fixedCharge: 12 };

export default function RatePanel({ rateInfo, setRateInfo, bills, billMode, gate }) {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);

  const search = async () => {
    setLoading(true);
    setError(null);
    const result = await lookupUtilityRates(address);
    setLoading(false);
    if (result.error) setError(result.error);
    setCandidates(result.candidates || []);
  };

  const pick = (c, i) => {
    setSelected(i);
    setRateInfo({ utility: c.utility, rate: c.rate, netMetering: c.netMetering, asOfDate: c.asOfDate, sources: c.sources });
  };

  const manual = () => {
    setSelected(null);
    setRateInfo({
      utility: 'Manual entry', rate: { ...BLANK_RATE },
      netMetering: { available: true, creditRate: 1.0, description: '' }, asOfDate: null, sources: [],
    });
  };

  // When the model can't reproduce the bills, say what the bills actually imply
  // instead of only reporting that something is wrong.
  let diagnosis = null;
  if (gate && gate.status === 'mismatch' && billMode === 'detailed') {
    const totalUsage = bills.reduce((s, b) => s + (parseFloat(b.usage) || 0), 0);
    const totalCost = bills.reduce((s, b) => s + (parseFloat(b.cost) || 0), 0);
    const fixed = (rateInfo?.rate?.fixedCharge || 0) * 12;
    if (totalUsage > 0) {
      diagnosis = `Your bills imply about $${((totalCost - fixed) / totalUsage).toFixed(3)}/kWh all-in (after the $${(rateInfo?.rate?.fixedCharge || 0).toFixed(2)}/mo fixed charge). Adjust the rate or fixed charge until this reconciles.`;
    }
  }

  return (
    <section className="card">
      <h2>1 · Utility rate plan</h2>
      <div className="row">
        <div className="field" style={{ flex: 2 }}>
          <label>Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, Columbia, MO" />
        </div>
        <button className="primary" disabled={!address.trim() || loading} onClick={search}>
          {loading ? 'Searching…' : 'Look up'}
        </button>
        <button onClick={manual}>Manual</button>
      </div>

      {error && <div className="warnbox">{error}</div>}

      {candidates.map((c, i) => (
        <div key={i} className={`candidate ${selected === i ? 'selected' : ''}`} onClick={() => pick(c, i)}>
          <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <strong>{c.utility}</strong>
            <span>
              <span className={`badge ${c.confidence}`}>{c.confidence}</span>
              {c.asOfDate && <span className="note" style={{ marginLeft: 6 }}>as of {c.asOfDate}</span>}
            </span>
          </div>
          <div className="note">
            {c.rate.name} — {c.rate.type} · export credit {Math.round((c.netMetering.creditRate ?? 1) * 100)}%
          </div>
          {c.sources.length > 0 && <div className="sources">{c.sources.slice(0, 2).join(' · ')}</div>}
        </div>
      ))}

      {rateInfo && <RateEditor draft={rateInfo} setDraft={setRateInfo} />}

      {gate && gate.status !== 'unknown' && (
        <div className={`gate ${gate.status}`}>
          {gate.status === 'match' && <>✓ Model reproduces your bills within 3%.</>}
          {gate.status === 'close' && <>Within {Math.abs(gate.gap * 100).toFixed(1)}% of your bills.</>}
          {gate.status === 'mismatch' && (
            <>
              ⚠ Model is off by {Math.abs(gate.gap * 100).toFixed(0)}% (modeled ${gate.modeled.toFixed(0)} vs actual ${gate.actual.toFixed(0)}/yr).
              {diagnosis && <div style={{ marginTop: 6 }}>{diagnosis}</div>}
            </>
          )}
        </div>
      )}
    </section>
  );
}
