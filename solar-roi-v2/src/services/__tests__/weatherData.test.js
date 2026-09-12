import { describe, it, expect } from 'vitest';
import { normalizePVWatts, parseMonthlySeries, toPVWattsAzimuth, PVWATTS_URL } from '../weatherData.js';

// Shaped like a real PVWatts v8 payload for a 4 kW system.
const PAYLOAD = {
  inputs: { system_capacity: '4', dataset: 'nsrdb' },
  errors: [],
  warnings: [],
  station_info: { location: 'Columbia', distance: 3400 },
  outputs: {
    ac_monthly: [397.04, 429.90, 570.64, 598.79, 609.83, 609.15, 599.89, 583.93, 544.99, 485.94, 412.04, 366.75],
    solrad_monthly: [3.81, 4.71, 5.75, 6.28, 6.40, 6.97, 6.68, 6.46, 6.08, 5.07, 4.25, 3.53],
    ac_annual: 6208.89,
  },
};

describe('PVWatts azimuth conversion', () => {
  it('maps our south-relative convention onto PVWatts north-relative degrees', () => {
    expect(toPVWattsAzimuth(0)).toBe(180);   // south
    expect(toPVWattsAzimuth(90)).toBe(270);  // west
    expect(toPVWattsAzimuth(-90)).toBe(90);  // east
    expect(toPVWattsAzimuth(180)).toBe(0);   // north wraps
  });
});

describe('PVWatts endpoint', () => {
  it('calls the current NLR developer host, not the retired nrel.gov API domain', () => {
    expect(PVWATTS_URL).toBe('https://developer.nlr.gov/api/pvwatts/v8.json');
    expect(PVWATTS_URL).not.toMatch(/nrel\.gov/);
  });
});

describe('normalizePVWatts', () => {
  it('derives specific yield and carries provenance', () => {
    const r = normalizePVWatts(PAYLOAD, 4);
    expect(r.error).toBeUndefined();
    expect(r.annualKWhPerKW).toBeCloseTo(6208.89 / 4, 2);
    expect(r.monthly).toHaveLength(12);
    expect(r.source).toMatch(/PVWatts/);
    expect(r.station).toBe('Columbia');
    expect(r.accountsForOrientation).toBe(true);
  });

  it('falls back to summing months when ac_annual is absent', () => {
    const { ac_annual, ...rest } = PAYLOAD.outputs;
    const r = normalizePVWatts({ ...PAYLOAD, outputs: rest }, 4);
    expect(r.annualKWhPerKW).toBeCloseTo(PAYLOAD.outputs.ac_monthly.reduce((x, y) => x + y, 0) / 4, 2);
  });

  it('rejects malformed payloads rather than modelling on garbage', () => {
    expect(normalizePVWatts({ errors: ['bad key'] }).error).toMatch(/bad key/);
    expect(normalizePVWatts({ outputs: { ac_monthly: [1, 2, 3] } }, 4).error).toMatch(/12 monthly/);
    expect(normalizePVWatts({ outputs: { ac_monthly: new Array(12).fill('x') } }, 4).error).toMatch(/12 monthly/);
  });
});

describe('parseMonthlySeries (the no-network path)', () => {
  it('accepts comma, space, or newline separated values', () => {
    const r = parseMonthlySeries('397, 430, 571, 599, 610, 609, 600, 584, 545, 486, 412, 367', { systemCapacityKW: 4 });
    expect(r.error).toBeUndefined();
    expect(r.monthly).toHaveLength(12);
    expect(r.annualKWhPerKW).toBeCloseTo(6210 / 4, 0);
    expect(parseMonthlySeries('1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12').monthly).toHaveLength(12);
  });

  it('refuses the wrong count or bad values', () => {
    expect(parseMonthlySeries('1 2 3').error).toMatch(/found 3/);
    expect(parseMonthlySeries(new Array(12).fill('-1').join(' ')).error).toMatch(/negative/);
    expect(parseMonthlySeries(new Array(12).fill('0').join(' ')).error).toMatch(/greater than zero/);
  });
});
