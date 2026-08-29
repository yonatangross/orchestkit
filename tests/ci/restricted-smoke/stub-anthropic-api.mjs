#!/usr/bin/env node
// Minimal Anthropic Messages API stub for driving `claude -p` with zero model
// spend. Every POST /v1/messages gets a canned assistant turn ("ok") as an SSE
// stream (or JSON when stream:false). Every request is appended to
// STUB_LOG as one JSON line so the caller can assert what CC sent.
import http from 'node:http';
import fs from 'node:fs';

const PORT = Number(process.env.STUB_PORT || 0);
const LOG = process.env.STUB_LOG || '/tmp/stub-anthropic-api.jsonl';
const REPLY = process.env.STUB_REPLY || 'ok';

function sse(res, model) {
  const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  ev('message_start', { message: { id: 'msg_stub', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } });
  ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
  ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: REPLY } });
  ev('content_block_stop', { index: 0 });
  ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } });
  ev('message_stop', {});
  res.end();
}

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    let parsed = null;
    try { parsed = body ? JSON.parse(body) : null; } catch { parsed = { unparsable: body.slice(0, 200) }; }
    const sys = parsed && parsed.system;
    const sysText = Array.isArray(sys) ? sys.map((b) => b.text || '').join('\n') : (typeof sys === 'string' ? sys : '');
    const line = {
      ts: new Date().toISOString(), method: req.method, path: req.url,
      model: parsed && parsed.model, stream: parsed && parsed.stream,
      tools: parsed && Array.isArray(parsed.tools) ? parsed.tools.map((t) => t.name) : undefined,
      system_chars: sysText.length,
      mentions_ork_skills: /ork:[a-z-]+/.test(sysText),
      messages: parsed && Array.isArray(parsed.messages) ? parsed.messages.length : undefined,
    };
    fs.appendFileSync(LOG, JSON.stringify(line) + '\n');
    if (req.method === 'POST' && /\/v1\/messages(\?|$)/.test(req.url)) {
      if (parsed && parsed.stream === false) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id: 'msg_stub', type: 'message', role: 'assistant', model: parsed.model, content: [{ type: 'text', text: REPLY }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }));
        return;
      }
      return sse(res, (parsed && parsed.model) || 'stub');
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: `stub has no route for ${req.method} ${req.url}` } }));
  });
});
server.listen(PORT, '127.0.0.1', () => {
  const { port } = server.address();
  fs.writeFileSync(process.env.STUB_PORT_FILE || '/tmp/stub-anthropic-api.port', String(port));
  console.log(`stub-anthropic-api listening on http://127.0.0.1:${port} log=${LOG}`);
});
