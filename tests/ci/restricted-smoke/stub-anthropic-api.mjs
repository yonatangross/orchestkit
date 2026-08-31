#!/usr/bin/env node
// Minimal Anthropic Messages API stub for driving `claude -p` with zero model
// spend. Every POST /v1/messages gets a canned assistant turn ("ok") as an SSE
// stream (or JSON when stream:false). Every request is appended to
// STUB_LOG as one JSON line so the caller can assert what CC sent.
//
// STUB_GREP (optional, #3541): a regex tested against the request's message
// text (user text, assistant text and tool_result text). The log line then
// carries grep_hit / grep_count / grep_ctx, so a probe can ask "did the
// expanded slash command reach the model" without spending a token.
import http from 'node:http';
import fs from 'node:fs';

const PORT = Number(process.env.STUB_PORT || 0);
const LOG = process.env.STUB_LOG || '/tmp/stub-anthropic-api.jsonl';
const REPLY = process.env.STUB_REPLY || 'ok';
const GREP = process.env.STUB_GREP ? new RegExp(process.env.STUB_GREP) : null;
// STUB_TOOL_USE (#3835): JSON {name, input}. When set, any request whose
// messages carry NO tool_result yet gets a scripted tool_use block instead of
// text, so a probe can make CC evaluate its OWN permission layer against a
// known tool call with zero model spend. Requests that already carry a
// tool_result (the follow-up turn) get the normal text reply, closing the loop.
const TOOL_USE = process.env.STUB_TOOL_USE ? JSON.parse(process.env.STUB_TOOL_USE) : null;

function hasToolResult(messages) {
  for (const m of messages || []) {
    if (Array.isArray(m.content)) for (const b of m.content) if (b.type === 'tool_result') return true;
  }
  return false;
}

function sse(res, model, toolUse) {
  const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  ev('message_start', { message: { id: 'msg_stub', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } });
  if (toolUse) {
    ev('content_block_start', { index: 0, content_block: { type: 'tool_use', id: 'toolu_stub01', name: toolUse.name, input: {} } });
    ev('content_block_delta', { index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(toolUse.input || {}) } });
    ev('content_block_stop', { index: 0 });
    ev('message_delta', { delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 1 } });
  } else {
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
    ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: REPLY } });
    ev('content_block_stop', { index: 0 });
    ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } });
  }
  ev('message_stop', {});
  res.end();
}

function messageText(messages) {
  const texts = [];
  for (const m of messages || []) {
    const c = m.content;
    if (typeof c === 'string') texts.push(c);
    else if (Array.isArray(c)) {
      for (const b of c) {
        if (b.type === 'text') texts.push(b.text);
        if (b.type === 'tool_result') {
          const cc = b.content;
          if (typeof cc === 'string') texts.push(cc);
          else if (Array.isArray(cc)) for (const x of cc) if (x.type === 'text') texts.push(x.text);
        }
      }
    }
  }
  return texts.join('\n');
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
    if (GREP && parsed && Array.isArray(parsed.messages)) {
      const all = messageText(parsed.messages);
      const at = all.search(GREP);
      line.grep_hit = at >= 0;
      line.grep_count = (all.match(new RegExp(GREP.source, 'g')) || []).length;
      line.grep_ctx = at >= 0 ? all.slice(Math.max(0, at - 120), at + 200) : undefined;
    }
    fs.appendFileSync(LOG, JSON.stringify(line) + '\n');
    if (req.method === 'POST' && /\/v1\/messages(\?|$)/.test(req.url)) {
      const toolUse = TOOL_USE && parsed && !hasToolResult(parsed.messages) ? TOOL_USE : null;
      if (parsed && parsed.stream === false) {
        const content = toolUse
          ? [{ type: 'tool_use', id: 'toolu_stub01', name: toolUse.name, input: toolUse.input || {} }]
          : [{ type: 'text', text: REPLY }];
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id: 'msg_stub', type: 'message', role: 'assistant', model: parsed.model, content, stop_reason: toolUse ? 'tool_use' : 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }));
        return;
      }
      return sse(res, (parsed && parsed.model) || 'stub', toolUse);
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
