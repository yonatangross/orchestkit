// Held-out control: haiku via claude -p with the SAME criteria-B.json and question, using the
// product's stripped child context (neutral cwd, no MCP, no plugins, no hooks). 5 in parallel.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
const dir = new URL('.', import.meta.url).pathname;
const criteria = JSON.parse(readFileSync(`${dir}criteria-B.json`, 'utf8'));
const cats = Object.keys(criteria);
const rows = readFileSync(`${dir}heldout-150.jsonl`, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const limit = Number(process.argv[2] || rows.length);
function prompt(r) {
  return [
    'You classify coding sessions. Output STRICT JSON only, no prose, no code fences: {"category":"<one of: ' + cats.join(', ') + '>"}',
    'Which SINGLE category best fits the coding work this session is about to do, judging from first_prompt (the first user prompt of the session) and git_branch?',
    'Categories, each with what it is, what it is not for, and examples:',
    JSON.stringify(criteria, null, 1),
    'State:',
    JSON.stringify({ git_branch: r.branch, first_prompt: r.prompt }),
  ].join('\n');
}
function run(r) {
  return new Promise((resolve) => {
    const t0 = Date.now(); let stdout = '';
    const child = spawn('claude', ['-p', '--model', 'haiku', '--output-format', 'json', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
      '--disable-slash-commands', '--settings', '{"disableAllHooks":true,"enabledPlugins":{}}', prompt(r)],
      { cwd: tmpdir(), stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, ORK_SESSION_IDENTITY_CHILD: '1' } });
    const timer = setTimeout(() => child.kill('SIGKILL'), 60000);
    child.stdout.on('data', (d) => { stdout += d; });
    child.on('close', () => {
      clearTimeout(timer); const ms = Date.now() - t0;
      try {
        const env = JSON.parse(stdout); const txt = String(env.result || '');
        const m = txt.match(/\{[^{}]*\}/); const cat = m ? String(JSON.parse(m[0]).category || '').toLowerCase().trim() : '';
        resolve({ id: r.id, category: cats.includes(cat) ? cat : null, latency_ms: ms, cost_usd: env.total_cost_usd ?? null,
          input_tokens: env.usage ? (env.usage.input_tokens || 0) + (env.usage.cache_read_input_tokens || 0) + (env.usage.cache_creation_input_tokens || 0) : null,
          error: cats.includes(cat) ? null : (env.is_error ? 'cli error' : 'unparseable') });
      } catch { resolve({ id: r.id, category: null, latency_ms: ms, error: 'no json envelope' }); }
    });
    child.on('error', () => resolve({ id: r.id, category: null, latency_ms: Date.now() - t0, error: 'spawn failed' }));
  });
}
const todo = rows.slice(0, limit); const out = []; let next = 0;
await Promise.all(Array.from({ length: 5 }, async () => { while (next < todo.length) { const r = todo[next++]; out.push(await run(r)); } }));
out.sort((a, b) => a.id - b.id);
const file = limit === rows.length ? 'heldout-150-haiku-B.jsonl' : 'haiku-B-probe.jsonl';
writeFileSync(`${dir}${file}`, out.map((x) => JSON.stringify(x)).join('\n') + '\n');
console.log('haiku-B wrote', out.length, 'to', file, 'errors', out.filter((x) => x.error).length, 'cost_usd', out.reduce((s, x) => s + (x.cost_usd || 0), 0).toFixed(4));
