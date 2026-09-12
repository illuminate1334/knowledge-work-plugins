// Location-specific production data.
//
// Without this, the model uses a single `baseYieldKWhPerKW` assumption for
// everywhere on earth — so Seattle and Phoenix produce identically — and
// distributes it across months by clear-sky geometry, which cannot know that
// a Pacific-Northwest December is overcast.
//
// Two things a weather source can supply:
//   annualKWhPerKW  specific yield — replaces the global assumption
//   monthly[12]     relative monthly energy — replaces clear-sky seasonality
//
// PVWatts supplies both. Manual entry supplies both. Anything that supplies
// only monthly shape still improves the self-consumption split.
//
// PROVENANCE IS PART OF THE DATA. Every result carries where it came from and
// what it is, because a number that changes an NPV by five figures should never
// appear in this app without the user being able to see its source.

export const PVWATTS_URL = 'https://developer.nlr.gov/api/pvwatts/v8.json';

// PVWatts azimuth is degrees clockwise from NORTH (180 = due south).
// Our internal convention is degrees from SOUTH, positive toward west.
export function toPVWattsAzimuth(azimuthFromSouth) {
  return ((180 + azimuthFromSouth) % 360 + 360) % 360;
}

// Fetch modelled production for a specific location and array geometry.
//
// NOTE: array geometry (tilt/azimuth) is sent to PVWatts, so the returned yield
// ALREADY accounts for orientation. Callers must not re-apply an orientation
// derate on top of it — see production.js.
export async function fetchPVWatts({
  latitude,
  longitude,
  tiltDegrees,
  azimuthFromSouth,
  systemCapacityKW = 4,
  losses = 14,
  arrayType = 1, // 1 = fixed roof mount
  moduleType = 0, // 0 = standard
  dataset = 'nsrdb', // 'intl' outside NSRDB coverage
  apiKey = import.meta.env?.VITE_NREL_API_KEY,
} = {}) {
  if (!apiKey) {
    return { error: 'No NREL API key configured — enter monthly production manually.' };
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { error: 'Latitude and longitude are required for a weather lookup.' };
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    lat: String(latitude),
    lon: String(longitude),
    system_capacity: String(systemCapacityKW),
    azimuth: String(toPVWattsAzimuth(azimuthFromSouth)),
    tilt: String(tiltDegrees),
    array_type: String(arrayType),
    module_type: String(moduleType),
    losses: String(losses),
    timeframe: 'monthly',
    dataset,
  });

  let res;
  try {
    res = await fetch(`${PVWATTS_URL}?${params}`);
  } catch {
    return { error: 'Could not reach the NREL service — enter monthly production manually.' };
  }
  if (!res.ok) {
    return { error: `Weather lookup failed (HTTP ${res.status}) — enter monthly production manually.` };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return { error: 'Unreadable response from NREL — enter monthly production manually.' };
  }

  const normalized = normalizePVWatts(data, systemCapacityKW);
  if (normalized.error) return normalized;
  return {
    ...normalized,
    tiltDegrees,
    azimuthFromSouth,
  };
}

// Exported for tests: turn a PVWatts payload into our internal shape.
export function normalizePVWatts(data, systemCapacityKW) {
  if (data?.errors?.length) return { error: data.errors.join('; ') };

  const monthly = data?.outputs?.ac_monthly;
  if (!Array.isArray(monthly) || monthly.length !== 12 || !monthly.every((v) => Number.isFinite(v))) {
    return { error: 'Response did not contain 12 monthly production values.' };
  }

  const annual = Number.isFinite(data?.outputs?.ac_annual)
    ? data.outputs.ac_annual
    : monthly.reduce((x, y) => x + y, 0);

  const capacity = Number(data?.inputs?.system_capacity) || systemCapacityKW;
  if (!(capacity > 0)) return { error: 'Missing system capacity — cannot derive specific yield.' };

  const st = data.station_info || {};
  return {
    annualKWhPerKW: annual / capacity,
    monthly,
    solradMonthly: data?.outputs?.solrad_monthly || null,
    source: 'NREL PVWatts v8',
    station: st.location || st.city || null,
    stationDistanceM: st.distance ?? null,
    dataset: data?.inputs?.dataset || null,
    accountsForOrientation: true,
    warnings: data?.warnings || [],
  };
}

// Manual path — works with no network at all. A user can run PVWatts (or any
// modelling tool) in their own browser and paste the twelve monthly figures.
export function parseMonthlySeries(text, { systemCapacityKW = null } = {}) {
  const nums = String(text)
    .split(/[\s,;]+/)
    .map((t) => parseFloat(t.replace(/[$,]/g, '')))
    .filter((n) => Number.isFinite(n));

  if (nums.length !== 12) {
    return { error: `Expected 12 monthly values, found ${nums.length}.` };
  }
  if (nums.some((n) => n < 0)) return { error: 'Monthly values cannot be negative.' };
  if (!nums.some((n) => n > 0)) return { error: 'At least one month must be greater than zero.' };

  const annual = nums.reduce((x, y) => x + y, 0);
  return {
    annualKWhPerKW: systemCapacityKW > 0 ? annual / systemCapacityKW : null,
    monthly: nums,
    source: 'Manual entry',
    accountsForOrientation: true,
    warnings: [],
  };
}
