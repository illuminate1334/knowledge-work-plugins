import React from 'react';

// Pre-filled, fully editable rate form — the human confirmation layer between
// AI-retrieved tariff data and the engine.
export default function RateEditor({ draft, setDraft }) {
  const rate = draft.rate;
  const setRate = (patch) => setDraft({ ...draft, rate: { ...rate, ...patch } });
  const setNM = (patch) => setDraft({ ...draft, netMetering: { ...draft.netMetering, ...patch } });

  const setType = (type) => {
    const base = { name: rate.name, type, rate: rate.rate || 0.13, fixedCharge: rate.fixedCharge || 0 };
    if (type === 'tiered') base.tiers = rate.tiers || [{ limit: 750, rate: 0.12 }, { limit: Infinity, rate: 0.15 }];
    if (type === 'tou') base.periods = rate.periods || {
      peak: { hours: [14, 19], rate: 0.28 },
      offPeak: { rate: 0.11 },
    };
    setDraft({ ...draft, rate: base });
  };

  const setTier = (i, key, value) => {
    const tiers = rate.tiers.map((t, idx) => (idx === i ? { ...t, [key]: value } : t));
    setRate({ tiers });
  };

  const setPeriod = (name, patch) => {
    setRate({ periods: { ...rate.periods, [name]: { ...rate.periods[name], ...patch } } });
  };

  return (
    <div className="card" style={{ background: '#f8fafc' }}>
      <h2 style={{ fontSize: 16 }}>Confirm rate details — {draft.utility}</h2>
      <div className="row">
        <div className="field">
          <label>Plan name</label>
          <input value={rate.name} onChange={(e) => setRate({ name: e.target.value })} />
        </div>
        <div className="field">
          <label>Rate structure</label>
          <select value={rate.type} onChange={(e) => setType(e.target.value)}>
            <option value="flat">Flat</option>
            <option value="tiered">Tiered</option>
            <option value="tou">Time-of-use</option>
          </select>
        </div>
        <div className="field">
          <label>Fixed charge ($/mo)</label>
          <input type="number" step="0.01" value={rate.fixedCharge} onChange={(e) => setRate({ fixedCharge: parseFloat(e.target.value) || 0 })} />
        </div>
      </div>

      {rate.type === 'flat' && (
        <div className="row">
          <div className="field">
            <label>Rate ($/kWh)</label>
            <input type="number" step="0.001" value={rate.rate} onChange={(e) => setRate({ rate: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
      )}

      {rate.type === 'tiered' && rate.tiers.map((t, i) => (
        <div className="row" key={i}>
          <div className="field">
            <label>Tier {i + 1} up to (kWh/mo)</label>
            <input
              type="number"
              value={Number.isFinite(t.limit) ? t.limit : ''}
              placeholder="∞ (last tier)"
              disabled={i === rate.tiers.length - 1}
              onChange={(e) => setTier(i, 'limit', parseFloat(e.target.value) || Infinity)}
            />
          </div>
          <div className="field">
            <label>Rate ($/kWh)</label>
            <input type="number" step="0.001" value={t.rate} onChange={(e) => setTier(i, 'rate', parseFloat(e.target.value) || 0)} />
          </div>
        </div>
      ))}

      {rate.type === 'tou' && (
        <>
          <div className="row">
            <div className="field">
              <label>Peak start (hour 0–23)</label>
              <input type="number" min="0" max="23" value={rate.periods.peak.hours[0]} onChange={(e) => setPeriod('peak', { hours: [parseInt(e.target.value) || 0, rate.periods.peak.hours[1]] })} />
            </div>
            <div className="field">
              <label>Peak end</label>
              <input type="number" min="0" max="24" value={rate.periods.peak.hours[1]} onChange={(e) => setPeriod('peak', { hours: [rate.periods.peak.hours[0], parseInt(e.target.value) || 0] })} />
            </div>
            <div className="field">
              <label>Peak rate ($/kWh)</label>
              <input type="number" step="0.001" value={rate.periods.peak.rate} onChange={(e) => setPeriod('peak', { rate: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="field">
              <label>Off-peak rate ($/kWh)</label>
              <input type="number" step="0.001" value={rate.periods.offPeak.rate} onChange={(e) => setPeriod('offPeak', { rate: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <label className="note">
              <input
                type="checkbox"
                checked={!!rate.periods.superOffPeak}
                onChange={(e) => {
                  const periods = { ...rate.periods };
                  if (e.target.checked) periods.superOffPeak = { hours: [22, 6], rate: 0.07 };
                  else delete periods.superOffPeak;
                  setRate({ periods });
                }}
              />{' '}
              Has super-off-peak period
            </label>
            {rate.periods.superOffPeak && (
              <>
                <div className="field">
                  <label>Start (may wrap midnight)</label>
                  <input type="number" min="0" max="23" value={rate.periods.superOffPeak.hours[0]} onChange={(e) => setPeriod('superOffPeak', { hours: [parseInt(e.target.value) || 0, rate.periods.superOffPeak.hours[1]] })} />
                </div>
                <div className="field">
                  <label>End</label>
                  <input type="number" min="0" max="24" value={rate.periods.superOffPeak.hours[1]} onChange={(e) => setPeriod('superOffPeak', { hours: [rate.periods.superOffPeak.hours[0], parseInt(e.target.value) || 0] })} />
                </div>
                <div className="field">
                  <label>Rate ($/kWh)</label>
                  <input type="number" step="0.001" value={rate.periods.superOffPeak.rate} onChange={(e) => setPeriod('superOffPeak', { rate: parseFloat(e.target.value) || 0 })} />
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div className="row" style={{ marginTop: 10 }}>
        <label className="note">
          <input type="checkbox" checked={draft.netMetering.available} onChange={(e) => setNM({ available: e.target.checked })} />{' '}
          Net metering available
        </label>
        {draft.netMetering.available && (
          <div className="field">
            <label>Export credit (% of retail)</label>
            <input
              type="number" min="0" max="100"
              value={Math.round(draft.netMetering.creditRate * 100)}
              onChange={(e) => setNM({ creditRate: (parseFloat(e.target.value) || 0) / 100 })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
