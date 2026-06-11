# Reusable pattern: AI lookup → human-editable confirmation → reconciliation gate

This project doubles as a reference implementation of a team pattern for any
tool where an AI fetches authoritative-looking data that then feeds a
calculation or an action. The solar app applies it to utility tariffs; the same
shape applies directly to a **config delta agent** (and to pricing tables,
compliance rules, vendor catalogs — anything where "the AI looked it up" is not
good enough on its own).

## The three layers

```
/engine        pure functions, no I/O, unit-tested     ← the only place math lives
/services      AI/network calls, normalized to engine shapes, every failure
               path returns a usable "enter manually" fallback
/components    UI: candidate cards → editable form → gate → analysis
```

Rules that make it work:

1. **The engine never sees the AI.** Services return data in exactly the shape
   the engine consumes (`normalizeCandidate()` in `rateIntelligence.js` rejects
   anything malformed). The engine is testable without mocking a model.
2. **AI output is a *candidate*, never a *decision*.** Each candidate carries a
   confidence badge, an as-of date, and source links — retrieved data must never
   look more authoritative than it is. The user selects one, and every field is
   editable before confirmation. Manual entry is always one tap away.
3. **A reconciliation gate sits between confirmation and consequence.** Before
   the confirmed data drives anything, the system checks it against ground truth
   the user already has (here: 12 months of actual bills, modeled vs actual).
   Within 3% → proceed; within 10% → warn; beyond → block with a specific
   message about what's probably wrong. This catches both AI mistakes and user
   typos with one mechanism.
4. **Every failure path lands on the manual escape hatch.** No API key, network
   error, refusal, unparseable response — all return
   `{candidates: [], error: "… — enter manually"}`, never a dead end.

## Mapping to the config delta agent

The config delta agent is the same CR review-gate shape applied to config data:

| Solar ROI v2 | Config delta agent |
|---|---|
| Address → Claude + web search → rate plan candidates | Target environment → agent → proposed config delta candidates |
| Candidate cards (confidence, as-of date, sources) | Delta summary (which keys, why, source CR / ticket links) |
| Editable rate form before confirm | Editable diff before apply — human can amend any line |
| Reconciliation gate: modeled bills vs actual bills | Dry-run gate: apply delta to a shadow copy, diff resulting state vs expected state from the CR |
| >10% gap blocks with "recheck the plan" | Unexpected drift blocks with the specific keys that diverged |
| Manual rate entry escape hatch | Hand-written delta escape hatch |
| Pure engine = tariff math | Pure engine = delta computation/merge logic, unit-tested with no agent in the loop |

The load-bearing insight in both: **find a piece of ground truth the user
already possesses and force the AI-derived data to reproduce it before it's
allowed to matter.** For tariffs that's last year's bills; for config deltas
it's the current live config plus the CR's stated intent. The gate converts
"trust the model" into "verify cheaply, then trust."

## Checklist for new applications of the pattern

- [ ] Engine pure and unit-tested; constants in one editable assumptions module
- [ ] Service normalizes/validates AI output into engine shapes; rejects partial data
- [ ] Candidates carry confidence + provenance (as-of date, sources)
- [ ] Human confirmation step where every field is editable
- [ ] Manual entry path with parity to the AI path
- [ ] Reconciliation gate against user-held ground truth, with graduated
      thresholds (pass / warn / block) and a specific block message
- [ ] All service failures land on the manual path, never a dead end
