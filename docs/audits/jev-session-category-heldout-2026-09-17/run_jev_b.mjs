// Held-out candidate: Jev B (criteria-B.json, 9 options) on heldout-150. Key from ORK_TYPESAFE_API_KEY, never printed.
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const apiKey = (process.env.ORK_TYPESAFE_API_KEY || '').trim();
if (!apiKey) { console.error('no key'); process.exit(3); }
const criteria = JSON.parse(readFileSync(`${dir}criteria-B.json`, 'utf8'));
export const INSTR = 'Which SINGLE category best fits the coding work this session is about to do, judging from `first_prompt` (the first user prompt of the session) and `git_branch`?';
const rows = readFileSync(`${dir}heldout-150.jsonl`, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const out = [];
for (const r of rows) {
  const t0 = Date.now(); const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const res = await fetch('https://api.typesafe.ai/v1/systemone', { method: 'POST', signal: ctl.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: { git_branch: r.branch, first_prompt: r.prompt }, model: 'jev-1.13.0',
        questions: { work_category: { type: 'choice', instructions: INSTR, criteria } } }) });
    const ms = Date.now() - t0;
    if (!res.ok) { out.push({ id: r.id, category: null, error: `http ${res.status}`, latency_ms: ms }); continue; }
    const b = await res.json(); const a = b?.answers?.work_category;
    out.push({ id: r.id, category: a?.choice ?? null, confidence: a?.confidence ?? null, latency_ms: ms, input_tokens: b?.usage?.input_tokens ?? null, error: a?.choice ? null : 'malformed' });
  } catch (e) { out.push({ id: r.id, category: null, error: ctl.signal.aborted ? 'timeout' : e.name, latency_ms: Date.now() - t0 }); }
  finally { clearTimeout(timer); }
}
writeFileSync(`${dir}heldout-150-jev-B.jsonl`, out.map((x) => JSON.stringify(x)).join('\n') + '\n');
console.log('jev-B wrote', out.length, 'errors', out.filter((x) => x.error).length);
