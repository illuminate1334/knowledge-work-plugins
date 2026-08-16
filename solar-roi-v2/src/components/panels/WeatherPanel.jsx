import React, { useState } from 'react';
import { fetchPVWatts, parseMonthlySeries } from '../../services/weatherData.js';
import { ORIENTATION_AZIMUTH } from '../../engine/assumptions.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function WeatherPanel({ weather, setWeather, property, assumptions, setAssumptions, coordinates }) {
  const [lat, setLat] = useState(coordinates?.lat ?? assumptions.latitude);
  const [lon, setLon] = useState(coordinates?.lon ?? -92.33);

  // Adopt coordinates resolved from the address lookup, until the user edits them.
  const [touched, setTouched] = useState(false);
  React.useEffect(() => {
    if (!touched && coordinates) {
      setLat(coordinates.lat);
      setLon(coordinates.lon);
    }
  }, [coordinates, touched]);
  const [capacity, setCapacity] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [paste, setPaste] = useState('');

  const lookup = async () => {
    setBusy(true);
    setError(null);
    const r = await fetchPVWatts({
      latitude: lat,
      longitude: lon,
      tiltDegrees: assumptions.tiltDegrees,
      azimuthFromSouth: ORIENTATION_AZIMUTH[property.orientation] ?? 0,
      systemCapacityKW: capacity,
    });
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    setWeather(r);
    setAssumptions({ ...assumptions, latitude: lat });
  };

  const applyPaste = () => {
    const r = parseMonthlySeries(paste, { systemCapacityKW: capacity });
    if (r.error) { setError(r.error); return; }
    setError(null);
    setWeather(r);
  };

  return (
    <section className="card">
      <h2>Location & weather</h2>
      <p className="sub">
        Without this the model assumes {assumptions.baseYieldKWhPerKW} kWh/kW/yr everywhere and spreads it
        by clear-sky geometry — the same output in Seattle as in Phoenix.
      </p>

      <div className="row">
        <div className="field"><label>Latitude</label>
          <input type="number" step="0.01" value={lat}
            onChange={(e) => { setTouched(true); setLat(parseFloat(e.target.value) || 0); }} />
        </div>
        <div className="field"><label>Longitude</label>
          <input type="number" step="0.01" value={lon}
            onChange={(e) => { setTouched(true); setLon(parseFloat(e.target.value) || 0); }} />
        </div>
        <div className="field"><label>Ref. system (kW)</label>
          <input type="number" step="0.5" value={capacity} onChange={(e) => setCapacity(parseFloat(e.target.value) || 1)} />
        </div>
        <button className="primary" disabled={busy} onClick={lookup}>{busy ? 'Fetching…' : 'Fetch PVWatts'}</button>
      </div>

      {error && <div className="warnbox">{error}</div>}

      <details style={{ marginTop: 8 }}>
        <summary className="note" style={{ cursor: 'pointer' }}>
          Or paste 12 monthly kWh figures (works with no API key)
        </summary>
        <p className="note" style={{ marginTop: 6 }}>
          Run <code>pvwatts.nrel.gov</code> in your browser for this address, then paste its
          twelve monthly AC output values here, Jan first.
        </p>
        <textarea
          rows={3}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="397, 430, 571, 599, 610, 609, 600, 584, 545, 486, 412, 367"
          style={{ width: '100%', padding: 8, border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }}
        />
        <button onClick={applyPaste} disabled={!paste.trim()}>Apply monthly figures</button>
      </details>

      {weather && (
        <div className="gate match" style={{ marginTop: 10 }}>
          <div>
            ✓ Using <strong>{weather.source}</strong>
            {weather.station && <> · station {weather.station}</>}
            {weather.annualKWhPerKW && <> · {Math.round(weather.annualKWhPerKW)} kWh/kW/yr</>}
          </div>
          <div className="note" style={{ marginTop: 4 }}>
            {MONTHS.map((m, i) => `${m} ${Math.round(weather.monthly[i])}`).join(' · ')}
          </div>
          <button className="link" onClick={() => setWeather(null)}>Clear and use clear-sky model</button>
        </div>
      )}
      {weather?.warnings?.length > 0 && <div className="warnbox">{weather.warnings.join(' ')}</div>}
    </section>
  );
}
