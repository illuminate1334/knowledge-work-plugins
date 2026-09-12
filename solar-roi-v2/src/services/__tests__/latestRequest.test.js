import { describe, it, expect } from 'vitest';
import { applyIfCurrent, createLatestRequestTracker } from '../latestRequest.js';

describe('createLatestRequestTracker', () => {
  it('marks only the latest start() as current and aborts the previous signal', () => {
    const tracker = createLatestRequestTracker();
    const first = tracker.start();
    const second = tracker.start();

    expect(first.isCurrent()).toBe(false);
    expect(second.isCurrent()).toBe(true);
    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
  });
});

describe('applyIfCurrent', () => {
  it('ignores a stale lookup so an earlier address cannot overwrite a newer search', () => {
    const tracker = createLatestRequestTracker();
    const first = tracker.start();
    tracker.start();
    const applied = [];

    const used = applyIfCurrent(first, { candidates: [{ utility: 'Old Co-op' }] }, (result) => {
      applied.push(result);
    });

    expect(used).toBe(false);
    expect(applied).toEqual([]);
  });

  it('applies the latest lookup result to the UI callback', () => {
    const tracker = createLatestRequestTracker();
    const latest = tracker.start();
    const applied = [];

    const used = applyIfCurrent(latest, { candidates: [{ utility: 'New Utility' }] }, (result) => {
      applied.push(result.candidates[0].utility);
    });

    expect(used).toBe(true);
    expect(applied).toEqual(['New Utility']);
  });

  it('ignores aborted results even if that generation is still current', () => {
    const tracker = createLatestRequestTracker();
    const req = tracker.start();
    const applied = [];

    expect(applyIfCurrent(req, { aborted: true, candidates: [{ utility: 'Nope' }] }, (r) => applied.push(r))).toBe(false);
    expect(applied).toEqual([]);
  });
});
