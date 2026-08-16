// AI rate lookup: ask Claude (with web search) which utility serves the address
// and what its current residential rate plans are. Returns structured candidates;
// the UI always lets the user edit every field before confirming, and manual
// entry is the permanent escape hatch.
//
// Auth: set VITE_ANTHROPIC_API_KEY in .env.local, or pass apiKey explicitly.
// The anthropic-dangerous-direct-browser-access header is required for browser
// calls; for anything beyond personal use, proxy this through a backend so the
// key never ships to the client.

const SCHEMA_PROMPT = `Identify the electric utility serving this address: "{ADDRESS}".
Search the web for its CURRENT residential rate plans and net metering policy.
Respond ONLY with raw JSON (no markdown fences, no preamble) in this schema:
{"candidates":[{
  "utility": "name",
  "confidence": "high|medium|low",
  "rates": {
    "standard": {"name":"","type":"flat|tiered|tou",
      "rate":0.0,
      "fixedCharge":0.0,
      "tiers":[{"limit":750,"rate":0.0},{"limit":null,"rate":0.0}],
      "periods":{"peak":{"hours":[14,19],"rate":0.0},"offPeak":{"rate":0.0},"superOffPeak":{"hours":[22,6],"rate":0.0}}}
  },
  "netMetering": {"available":true,"creditRate":1.0,"description":""},
  "coordinates": {"lat":0.0,"lon":0.0},
  "asOfDate": "YYYY-MM",
  "sources": ["url"]
}]}
Rules: rates in $/kWh. "coordinates" must be the approximate latitude/longitude of
the address itself, used for a solar-resource lookup. Omit "tiers" unless type is "tiered"; omit "periods" unless
type is "tou"; omit "superOffPeak" if the plan has none. The last tier's "limit"
must be null. "creditRate" is the export credit as a fraction of the retail rate.
Include up to 3 candidates if the address sits near a service-territory boundary.`;

export async function lookupUtilityRates(address, apiKey = import.meta.env?.VITE_ANTHROPIC_API_KEY) {
  if (!apiKey) {
    return { candidates: [], error: 'No API key configured — enter rates manually or set VITE_ANTHROPIC_API_KEY.' };
  }

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }],
        messages: [{ role: 'user', content: SCHEMA_PROMPT.replace('{ADDRESS}', address) }],
      }),
    });
  } catch {
    return { candidates: [], error: 'Network error reaching the Anthropic API — enter rates manually.' };
  }

  if (!response.ok) {
    return { candidates: [], error: `Rate lookup failed (HTTP ${response.status}) — enter rates manually.` };
  }

  const data = await response.json();
  if (data.stop_reason === 'refusal') {
    return { candidates: [], error: 'Rate lookup was declined — enter rates manually.' };
  }

  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  try {
    const parsed = JSON.parse(extractJson(text));
    const candidates = (parsed.candidates || []).map(normalizeCandidate).filter(Boolean);
    if (candidates.length === 0) {
      return { candidates: [], error: 'No rate plans found for that address — enter manually.' };
    }
    return { candidates };
  } catch {
    return { candidates: [], error: 'Could not parse rate data — enter manually.' };
  }
}

// The prompt forbids markdown, but defend against it anyway.
function extractJson(text) {
  const stripped = text.replace(/```json|```/g, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  return start >= 0 && end > start ? stripped.slice(start, end + 1) : stripped;
}

function validHours(hours) {
  return Array.isArray(hours) && hours.length === 2 && hours.every((h) => Number.isFinite(Number(h)));
}

// Coerce AI output into the engine's rate shape; reject candidates missing the
// fields the chosen rate type requires. Exported for tests.
export function normalizeCandidate(c) {
  const r = c?.rates?.standard;
  if (!c?.utility || !r?.type) return null;
  const rate = {
    name: r.name || `${c.utility} standard residential`,
    type: r.type,
    rate: Number(r.rate) || 0,
    fixedCharge: Number(r.fixedCharge) || 0,
  };
  if (r.type === 'tiered') {
    if (!Array.isArray(r.tiers) || r.tiers.length === 0) return null;
    rate.tiers = r.tiers.map((t) => ({ limit: t.limit == null ? Infinity : Number(t.limit), rate: Number(t.rate) || 0 }));
  }
  if (r.type === 'tou') {
    if (!validHours(r.periods?.peak?.hours) || r.periods?.offPeak?.rate == null) return null;
    rate.periods = r.periods;
    const s = r.periods.superOffPeak;
    if (s && (!validHours(s.hours) || s.rate == null)) {
      // Drop a malformed super-off-peak rather than rejecting the whole candidate.
      const { superOffPeak, ...rest } = r.periods;
      rate.periods = rest;
    }
  }
  return {
    utility: c.utility,
    confidence: ['high', 'medium', 'low'].includes(c.confidence) ? c.confidence : 'low',
    rate,
    netMetering: {
      available: c.netMetering?.available !== false,
      creditRate: c.netMetering?.creditRate ?? 1.0,
      description: c.netMetering?.description || '',
    },
    coordinates:
      Number.isFinite(Number(c.coordinates?.lat)) && Number.isFinite(Number(c.coordinates?.lon))
        ? { lat: Number(c.coordinates.lat), lon: Number(c.coordinates.lon) }
        : null,
    asOfDate: c.asOfDate || null,
    sources: Array.isArray(c.sources) ? c.sources : [],
  };
}
