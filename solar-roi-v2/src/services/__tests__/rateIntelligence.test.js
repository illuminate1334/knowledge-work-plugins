import { describe, it, expect } from 'vitest';
import { normalizeCandidate } from '../rateIntelligence.js';

const touCandidate = (periods) => ({
  utility: 'Test Electric',
  confidence: 'high',
  rates: { standard: { name: 'TOU-A', type: 'tou', fixedCharge: 10, rate: 0 } },
  netMetering: { available: true, creditRate: 1.0 },
  ...(periods !== undefined && { rates: { standard: { name: 'TOU-A', type: 'tou', fixedCharge: 10, periods } } }),
});

describe('normalizeCandidate', () => {
  it('rejects a candidate missing required fields for its type', () => {
    expect(normalizeCandidate(null)).toBeNull();
    expect(normalizeCandidate({ utility: 'X' })).toBeNull();
    // TOU without peak hours
    expect(normalizeCandidate(touCandidate({ offPeak: { rate: 0.12 } }))).toBeNull();
    // tiered without tiers
    expect(
      normalizeCandidate({ utility: 'X', rates: { standard: { type: 'tiered', name: 'T' } } }),
    ).toBeNull();
  });

  it('drops a malformed superOffPeak instead of rejecting the candidate', () => {
    const c = normalizeCandidate(
      touCandidate({
        peak: { hours: [14, 19], rate: 0.3 },
        offPeak: { rate: 0.12 },
        superOffPeak: { rate: 0.07 }, // no hours — would crash periodForHour
      }),
    );
    expect(c).not.toBeNull();
    expect(c.rate.periods.superOffPeak).toBeUndefined();
    expect(c.rate.periods.peak.rate).toBe(0.3);
  });

  it('keeps a well-formed superOffPeak', () => {
    const c = normalizeCandidate(
      touCandidate({
        peak: { hours: [14, 19], rate: 0.3 },
        offPeak: { rate: 0.12 },
        superOffPeak: { hours: [1, 6], rate: 0.07 },
      }),
    );
    expect(c.rate.periods.superOffPeak).toEqual({ hours: [1, 6], rate: 0.07 });
  });

  it('maps null tier limits to Infinity and clamps confidence', () => {
    const c = normalizeCandidate({
      utility: 'X',
      confidence: 'very sure', // not a valid value
      rates: { standard: { type: 'tiered', name: 'T', tiers: [{ limit: 750, rate: 0.1 }, { limit: null, rate: 0.2 }] } },
    });
    expect(c.rate.tiers[1].limit).toBe(Infinity);
    expect(c.confidence).toBe('low');
  });
});
