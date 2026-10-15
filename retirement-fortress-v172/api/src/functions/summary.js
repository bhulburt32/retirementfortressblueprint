/* POST /api/summary  { prompt }  →  { json }
   The page builds the same prompts it uses inside claude.ai (sections 11, 12 and 16) and sends only
   the figures it has already parsed; this function adds the key and asks for JSON back.
   Model: ANTHROPIC_MODEL setting, else the default below — check the current name at docs.claude.com. */
const { app } = require('@azure/functions');
const { principal, getAnthropicKey, json, text } = require('../shared');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
const MAX_PROMPT = 120000;

app.http('summary', {
  methods: ['POST'], authLevel: 'anonymous', route: 'summary',
  handler: async (request, context) => {
    const me = principal(request); if (!me) return text(401, 'Sign in required.');
    if (process.env.SUMMARIES_ENABLED === 'false') return text(403, 'Summaries are switched off.');
    let body; try { body = await request.json(); } catch (e) { return text(400, 'Body must be JSON.'); }
    const prompt = String((body && body.prompt) || '').slice(0, MAX_PROMPT);
    if (prompt.length < 40) return text(400, 'Nothing to summarise.');
    const key = await getAnthropicKey();
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, system: 'Answer with a single JSON value and nothing else: no prose, no code fences.', messages: [{ role: 'user', content: prompt }] })
    });
    if (r.status === 429) return text(429, 'Claude is busy.');
    if (!r.ok) { context.log(`summary: upstream ${r.status} ${await r.text()}`); return text(502, 'The summary service did not answer.'); }
    const data = await r.json();
    const out = ((data.content || []).find(c => c.type === 'text') || {}).text || '';
    let parsed;
    try { parsed = JSON.parse(out.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
    catch (e) { context.log('summary: not JSON'); return text(502, 'The summary was not usable.'); }
    context.log(`summary ${me.id} ${prompt.length} chars`);
    return json(200, { json: parsed });
  }
});
