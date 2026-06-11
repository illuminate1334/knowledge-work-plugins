import React, { useMemo, useState } from 'react';
import { lookupUtilityRates } from '../../services/rateIntelligence.js';
import { reconcile } from '../../engine/reconciliation.js';
import RateEditor from '../RateEditor.jsx';

const BLANK_RATE = { name: 'Manual entry', type: 'flat', rate: 0.13, fixedCharge: 12 };

// AI lookup → candidate cards → editable confirmation → reconciliation gate.
// The AI's answer is never authoritative: the user selects, edits, and the model
// must then reproduce their actual bills before they can continue.
export default function RateIntelligence({ bills, rateInfo, setRateInfo, next, back }) {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(rateInfo || null);

  const parsedBills = useMemo(
    () => bills.map((b) => ({ usage: parseFloat(b.usage) || 0, cost: parseFloat(b.cost) || 0 })),
    [bills],
  );
  const gate = useMemo(() => (draft ? reconcile(parsedBills, draft.rate) : null), [parsedBills, draft]);

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
    setDraft({ utility: c.utility, rate: c.rate, netMetering: c.netMetering, asOfDate: c.asOfDate, sources: c.sources });
  };

  const manual = () => {
    setSelected(null);
    setDraft({ utility: 'Manual entry', rate: { ...BLANK_RATE }, netMetering: { available: true, creditRate: 1.0, description: '' }, asOfDate: null, sources: [] });
  };

  const confirm = () => {
    setRateInfo(draft);
    next();
  };

  return (
    <div className="card">
      <h2>Your utility rate plan</h2>
      <p className="sub">Look it up from your address, or enter it manually. Everything stays editable.</p>

      <div className="row">
        <div className="field" style={{ flex: 3 }}>
          <label>Street address (incl. city, state)</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, Columbia, MO" />
        </div>
        <button className="primary" disabled={!address.trim() || loading} onClick={search}>
          {loading ? 'Searching…' : 'Find my rates'}
        </button>
        <button onClick={manual}>Enter manually</button>
      </div>

      {error && <div className="warnbox">{error}</div>}

      {candidates.map((c, i) => (
        <div key={i} className={`candidate ${selected === i ? 'selected' : ''}`} onClick={() => pick(c, i)}>
          <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <strong>{c.utility}</strong>
            <span>
              <span className={`badge ${c.confidence}`}>{c.confidence} confidence</span>
              {c.asOfDate && <span className="note" style={{ marginLeft: 8 }}>as of {c.asOfDate}</span>}
            </span>
          </div>
          <div className="note">
            {c.rate.name} — {c.rate.type}
            {c.rate.type === 'flat' && ` @ $${c.rate.rate}/kWh`}
            {' · '}net metering credit {Math.round((c.netMetering.creditRate ?? 1) * 100)}% of retail
          </div>
          {c.sources.length > 0 && <div className="sources">Sources: {c.sources.slice(0, 3).join(' · ')}</div>}
        </div>
      ))}

      {draft && (
        <>
          <RateEditor draft={draft} setDraft={setDraft} />
          {gate && gate.status !== 'unknown' && (
            <div className={`gate ${gate.status}`}>
              {gate.status === 'match' && <>✓ Model matches your bills within 3% (modeled ${gate.modeled.toFixed(0)} vs actual ${gate.actual.toFixed(0)}/yr).</>}
              {gate.status === 'close' && <>Model is within {Math.abs(gate.gap * 100).toFixed(1)}% of your bills — acceptable, but double-check the plan details.</>}
              {gate.status === 'mismatch' && <>⚠ Model is off by {Math.abs(gate.gap * 100).toFixed(0)}% (modeled ${gate.modeled.toFixed(0)} vs actual ${gate.actual.toFixed(0)}/yr). Recheck the rate plan before continuing — projections built on the wrong tariff are worthless.</>}
            </div>
          )}
        </>
      )}

      <div className="nav">
        <button onClick={back}>Back</button>
        <button className="primary" disabled={!draft || !gate || gate.status === 'mismatch'} onClick={confirm}>
          Confirm rate plan
        </button>
      </div>
    </div>
  );
}
