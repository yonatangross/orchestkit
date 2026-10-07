// Spike genui-mcp-spike: the smallest MCP server that returns a glyph-style
// result as an MCP App (UI resource) with a plain-text fallback.
//
// No SDK, no network, no build step. `handleRpc` is a pure function over one
// JSON-RPC message, so it is unit-testable and can sit behind any transport
// (stdio below, Streamable HTTP in a real connector).
//
// Field names follow the vendor pages, read 2026-10-07:
//   - tool `_meta.ui.resourceUri`, resource mime `text/html;profile=mcp-app`
//     (developers.openai.com/apps-sdk/build/chatgpt-ui, claude.com/docs/connectors/building/mcp-apps/quickstart)
//   - ChatGPT alias `_meta["openai/outputTemplate"]` (same OpenAI page)
//   - legacy flat key `ui/resourceUri` (Claude quickstart, "the helper also writes")
//   - UI reads `structuredContent`; `content` text is for hosts that render no UI

import { createServer } from 'node:http'
import { createInterface } from 'node:readline'

export const GLYPH_UI_URI = 'ui://ork-glyph/card-v1' // new HTML = new URI (OpenAI cache-key rule)
export const MCP_APP_MIME = 'text/html;profile=mcp-app'
const TOOL_NAME = 'render_glyph_card'
const BAR_CELLS = 10
/** @typedef {'ok' | 'warn' | 'bad'} Status */
/** @type {Record<Status, string>} */
const ICONS = { ok: '🟢', warn: '🟡', bad: '🔴' }
const STATUSES = /** @type {Status[]} */ (Object.keys(ICONS))
/** @param {unknown} v @returns {v is Status} */
const isStatus = (v) => typeof v === 'string' && STATUSES.some((s) => s === v)

const TOOL = {
  name: TOOL_NAME,
  title: 'Render glyph card',
  description:
    'Render labelled numbers as a glyph card: one bar per row, a total, a status per row. ' +
    'Shows an interactive card in hosts that support MCP Apps, a text card elsewhere.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', maxLength: 80 },
      rows: {
        type: 'array',
        minItems: 1,
        maxItems: 12,
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', maxLength: 40 },
            value: { type: 'number', minimum: 0 },
            unit: { type: 'string', maxLength: 6 },
            status: { type: 'string', enum: STATUSES },
          },
          required: ['label', 'value'],
        },
      },
    },
    required: ['title', 'rows'],
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  _meta: {
    ui: { resourceUri: GLYPH_UI_URI },
    'ui/resourceUri': GLYPH_UI_URI,
    'openai/outputTemplate': GLYPH_UI_URI,
  },
}

// The iframe app. Renders with textContent only, so a hostile label cannot
// become markup. No external origin, so no CSP entry is needed.
const CARD_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"><title>Glyph card</title>
<style>
  body { font: 14px system-ui, sans-serif; margin: 0; padding: 12px; }
  h1 { font-size: 15px; margin: 0 0 8px; }
  .row { display: grid; grid-template-columns: 1.5em 9em 1fr 5em; gap: 8px; align-items: center; margin: 4px 0; }
  .bar { height: 10px; border-radius: 5px; background: color-mix(in srgb, currentColor 15%, transparent); }
  .fill { height: 100%; border-radius: 5px; background: currentColor; }
  .val { text-align: right; font-variant-numeric: tabular-nums; }
  #total { margin-top: 8px; font-weight: 600; }
</style></head>
<body>
<h1 id="title">Waiting for data</h1>
<div id="rows"></div>
<div id="total"></div>
<script>
  const ICONS = { ok: "\\u{1F7E2}", warn: "\\u{1F7E1}", bad: "\\u{1F534}" };
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const draw = (sc) => {
    if (!sc || !Array.isArray(sc.rows)) return;
    document.getElementById("title").textContent = String(sc.title);
    const max = Math.max(...sc.rows.map((r) => r.value), 1);
    document.getElementById("rows").replaceChildren(...sc.rows.map((r) => {
      const row = el("div", "row");
      const bar = el("div", "bar");
      const fill = el("div", "fill");
      fill.style.width = Math.round((r.value / max) * 100) + "%";
      bar.append(fill);
      row.append(el("span", "", ICONS[r.status] || ""), el("span", "", String(r.label)), bar, el("span", "val", r.value + (r.unit || "")));
      return row;
    }));
    document.getElementById("total").textContent = "Total " + sc.total + (sc.rows[0].unit || "");
  };
  let nextId = 1;
  const send = (m) => parent.postMessage({ jsonrpc: "2.0", ...m }, "*");
  window.addEventListener("message", (e) => {
    const m = e.data;
    if (m && m.method === "ui/notifications/tool-result") draw(m.params && m.params.structuredContent);
  });
  send({ id: nextId++, method: "ui/initialize", params: {
    protocolVersion: "2026-01-26", appInfo: { name: "ork-glyph-card", version: "1.0.0" }, appCapabilities: {} } });
  send({ method: "ui/notifications/initialized", params: {} });
</script>
</body></html>`

/** @param {unknown} args @returns {{ok: true, title: string, rows: Row[]} | {ok: false, error: string}} */
function parseArgs(args) {
  const a = /** @type {Record<string, unknown>} */ (args ?? {})
  if (typeof a.title !== 'string' || a.title.length === 0) return { ok: false, error: 'title must be a non-empty string' }
  if (!Array.isArray(a.rows) || a.rows.length === 0 || a.rows.length > 12) return { ok: false, error: 'rows must be an array of 1 to 12 items' }
  /** @type {Row[]} */
  const rows = []
  for (const r of a.rows) {
    const row = /** @type {Record<string, unknown>} */ (r ?? {})
    if (typeof row.label !== 'string' || typeof row.value !== 'number' || !Number.isFinite(row.value) || row.value < 0) {
      return { ok: false, error: 'each row needs a string label and a non-negative number value' }
    }
    const status = isStatus(row.status) ? row.status : undefined
    rows.push({ label: row.label, value: row.value, unit: typeof row.unit === 'string' ? row.unit : '', status })
  }
  return { ok: true, title: a.title, rows }
}

/** @param {number} n */
const round1 = (n) => Math.round(n * 10) / 10

/**
 * The text fallback: what a host with no UI (Claude Code, a plain model) shows.
 * @param {string} title @param {Row[]} rows @param {number} total
 */
function glyphText(title, rows, total) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  const lines = [title.slice(0, 70), '─'.repeat(Math.min(title.length, 70))]
  for (const r of rows) {
    const filled = Math.round((r.value / max) * BAR_CELLS)
    const bar = '▓'.repeat(filled) + '░'.repeat(BAR_CELLS - filled)
    const icon = r.status ? ICONS[r.status] : '  '
    lines.push(`${icon} ${r.label.slice(0, 24).padEnd(24)} ${bar} ${r.value}${r.unit}`)
  }
  lines.push(`── total ${total}${rows[0].unit}`)
  return lines.join('\n')
}

/** @param {unknown} args */
function callTool(args) {
  const parsed = parseArgs(args)
  if (!parsed.ok) return { content: [{ type: 'text', text: `Invalid input: ${parsed.error}` }], isError: true }
  const total = round1(parsed.rows.reduce((s, r) => s + r.value, 0))
  return {
    content: [{ type: 'text', text: glyphText(parsed.title, parsed.rows, total) }],
    structuredContent: { title: parsed.title, rows: parsed.rows, total },
  }
}

/** @param {number | string} id @param {unknown} result */
const ok = (id, result) => ({ jsonrpc: '2.0', id, result })
/** @param {number | string | null} id @param {number} code @param {string} message */
const fail = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } })

/** @typedef {{jsonrpc: string, id?: number | string, method: string, params?: Record<string, any>}} RpcMessage */

/**
 * One JSON-RPC message in, one response out (null for notifications).
 * @param {RpcMessage} msg
 */
export async function handleRpc(msg) {
  if (msg.id === undefined) return null
  const { id, method, params = {} } = msg
  switch (method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: params.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: 'ork-glyph-card', version: '0.1.0' },
      })
    case 'ping':
      return ok(id, {})
    case 'tools/list':
      return ok(id, { tools: [TOOL] })
    case 'tools/call':
      if (params.name !== TOOL_NAME) return fail(id, -32602, `Unknown tool: ${params.name}`)
      return ok(id, callTool(params.arguments))
    case 'resources/list':
      return ok(id, { resources: [{ uri: GLYPH_UI_URI, name: 'Glyph card', mimeType: MCP_APP_MIME }] })
    case 'resources/read':
      if (params.uri !== GLYPH_UI_URI) return fail(id, -32002, `Resource not found: ${params.uri}`)
      return ok(id, { contents: [{ uri: GLYPH_UI_URI, mimeType: MCP_APP_MIME, text: CARD_HTML, _meta: { ui: { prefersBorder: true } } }] })
    default:
      return fail(id, -32601, `Method not found: ${method}`)
  }
}

/** @typedef {{label: string, value: number, unit: string, status: Status | undefined}} Row */

const MAX_BODY = 64 * 1024

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]']

/** @param {string} hostHeader "name", "name:port" or "[::1]:port" */
const hostName = (hostHeader) => {
  const h = hostHeader.toLowerCase()
  return h.startsWith('[') ? h.slice(0, h.indexOf(']') + 1) : h.split(':')[0]
}

/**
 * Streamable HTTP, stateless: POST /mcp, one JSON-RPC message per request, JSON reply.
 * This is the shape ChatGPT and claude.ai connect to (they need a public HTTPS URL
 * in front of it). No auth: a spike, never expose it as is.
 *
 * Origin guard: a request is refused with 403 unless its Host is local or named in
 * `allowedHosts`, and any Origin header it carries is local or named too. So a tunnel
 * in front of this server serves only the one host you named, and a web page cannot
 * reach it from the browser via DNS rebinding or a cross-site POST.
 * @param {{allowedHosts?: string[]}} [opts]
 */
export function createHttpServer({ allowedHosts = [] } = {}) {
  const allowed = new Set([...LOCAL_HOSTS, ...allowedHosts.map((h) => h.toLowerCase())])
  return createServer((req, res) => {
    /** @param {number} status @param {unknown} [body] @param {Record<string, string>} [headers] */
    const send = (status, body, headers = {}) => {
      res.writeHead(status, { 'content-type': 'application/json', ...headers })
      res.end(body === undefined ? undefined : JSON.stringify(body))
    }
    const origin = req.headers.origin
    let originHost = ''
    if (origin !== undefined) {
      try {
        originHost = new URL(origin).hostname.toLowerCase()
      } catch {
        originHost = ''
      }
    }
    if (!allowed.has(hostName(req.headers.host ?? '')) || (origin !== undefined && !allowed.has(originHost))) {
      return send(403, { error: 'forbidden host or origin' })
    }
    if (req.url !== '/mcp') return send(404, { error: 'not found' })
    if (req.method !== 'POST') return send(405, { error: 'method not allowed' }, { allow: 'POST' })
    /** @type {Buffer[]} */
    const chunks = []
    let size = 0
    req.on('data', (/** @type {Buffer} */ c) => {
      size += c.length
      if (size > MAX_BODY) return void req.destroy()
      chunks.push(c)
    })
    req.on('end', async () => {
      /** @type {unknown} */
      let msg
      try {
        msg = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        return send(400, fail(null, -32700, 'Parse error'))
      }
      if (msg === null || typeof msg !== 'object' || Array.isArray(msg) || typeof (/** @type {{method?: unknown}} */ (msg)).method !== 'string') {
        return send(400, fail(null, -32600, 'Invalid Request'))
      }
      const reply = await handleRpc(/** @type {RpcMessage} */ (msg))
      if (reply === null) return send(202)
      send(200, reply)
    })
  })
}

// Run directly: `node glyph-card-server.mjs` is stdio (newline-delimited JSON-RPC),
// `node glyph-card-server.mjs --http 3000` listens on 127.0.0.1 and refuses any
// non-local Host or Origin; add `--allow-host demo.example.com` to open that one host.
if (import.meta.url === `file://${process.argv[1]}`) {
  const httpAt = process.argv.indexOf('--http')
  const hostAt = process.argv.indexOf('--allow-host')
  if (httpAt !== -1) {
    const port = Number(process.argv[httpAt + 1] ?? 3000)
    const allowedHosts = hostAt === -1 ? [] : [process.argv[hostAt + 1] ?? '']
    createHttpServer({ allowedHosts }).listen(port, '127.0.0.1', () => console.error(`glyph card MCP on http://127.0.0.1:${port}/mcp`))
  } else {
    for await (const line of createInterface({ input: process.stdin })) {
      if (!line.trim()) continue
      const res = await handleRpc(JSON.parse(line))
      if (res) process.stdout.write(`${JSON.stringify(res)}\n`)
    }
  }
}
