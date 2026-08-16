import { DAYS_IN_MONTH, ORIENTATION_AZIMUTH } from './assumptions.js';

// Hourly production shape from solar geometry.
//
// v2 netted production against load ANNUALLY, which is only correct under 1:1
// net metering. Under a partial export credit (NEM 3.0 and its imitators) the
// midday surplus is exported cheap and bought back expensive after sunset —
// annual netting hides that entirely. This module produces the WHEN; the
// annual total still comes from production.js, so orientation is not
// double-counted (the shape is normalized to sum to exactly 1.0 per year).

const DEG = Math.PI / 180;

// Representative day-of-year per month (~the 16th).
const REP_DAY = [16, 46, 75, 105, 136, 166, 197, 228, 258, 289, 319, 350];

export function declination(dayOfYear) {
  return 23.45 * Math.sin(DEG * 360 * (284 + dayOfYear) / 365);
}

// Relative plane-of-array irradiance for one hour. Clear-sky proxy: beam
// attenuated by air mass, plus an isotropic diffuse term. Units are arbitrary
// because the result is normalized.
export function poaFactor({ lat, dec, hour, tilt, azimuth }) {
  const omega = 15 * (hour + 0.5 - 12); // hour angle at mid-hour, degrees
  const sinAlt =
    Math.sin(DEG * lat) * Math.sin(DEG * dec) +
    Math.cos(DEG * lat) * Math.cos(DEG * dec) * Math.cos(DEG * omega);
  if (sinAlt <= 0) return 0; // sun below horizon

  const alt = Math.asin(Math.min(1, sinAlt));
  // Solar azimuth measured from due south, positive toward west.
  const solarAz = Math.atan2(
    Math.sin(DEG * omega),
    Math.sin(DEG * lat) * Math.cos(DEG * omega) - Math.cos(DEG * lat) * Math.tan(DEG * dec),
  );

  const airMass = 1 / Math.max(sinAlt, 0.05);
  const dni = 1.353 * Math.pow(0.7, Math.pow(airMass, 0.678));

  const cosInc =
    Math.sin(alt) * Math.cos(DEG * tilt) +
    Math.cos(alt) * Math.sin(DEG * tilt) * Math.cos(solarAz - DEG * azimuth);

  const beam = Math.max(0, cosInc) * dni;
  const diffuse = 0.10 * dni * sinAlt * (1 + Math.cos(DEG * tilt)) / 2;
  return beam + diffuse;
}

// Returns daily[month][hour] = kWh produced in that hour on an average day of
// that month, such that Σ_month days[month] × Σ_hour daily = annualProduction.
export function buildProductionShape(annualProduction, { latitude, tiltDegrees, orientation }) {
  const azimuth = ORIENTATION_AZIMUTH[orientation] ?? 0;
  const raw = REP_DAY.map((day) => {
    const dec = declination(day);
    return Array.from({ length: 24 }, (_, hour) =>
      poaFactor({ lat: latitude, dec, hour, tilt: tiltDegrees, azimuth }),
    );
  });

  const total = raw.reduce(
    (sum, dayCurve, m) => sum + DAYS_IN_MONTH[m] * dayCurve.reduce((a, b) => a + b, 0),
    0,
  );
  if (total <= 0) return raw.map((r) => r.map(() => 0));

  return raw.map((dayCurve) => dayCurve.map((v) => (annualProduction * v) / total));
}
