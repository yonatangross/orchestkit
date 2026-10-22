#!/usr/bin/env node
// ============================================================================
// mcp-glyph-card: one MCP tool that returns a glyph-style result as an MCP App
// ============================================================================
// WHAT THIS GUARDS (spike genui-mcp-spike)
//   src/skills/mcp-visual-output/scripts/glyph-card-server.mjs must answer the
//   four JSON-RPC calls an MCP Apps host makes, with the fields the vendor docs
//   name, and must stay readable on a host that renders no UI:
//     1. tools/list     tool carries _meta.ui.resourceUri (ui:// scheme)
//     2. resources/read same URI, mimeType text/html;profile=mcp-app, HTML text
//     3. tools/call     content[0] is a glyph text fallback, structuredContent
//                       carries the same rows for the UI
//     4. The iframe app never assigns innerHTML, so labels render as text
//   Offline: no network, no SDK, no clock, no randomness.
import test from 'node:test'
import assert from 'node:assert/strict'
import { request } from 'node:http'
import vm from 'node:vm'
import { handleRpc, handleText, createHttpServer, GLYPH_UI_URI, MCP_APP_MIME } from '../../src/skills/mcp-visual-output/scripts/glyph-card-server.mjs'

const rpc = (method, params = {}, id = 1) => handleRpc({ jsonrpc: '2.0', id, method, params })

const ARGS = {
  title: 'Disk',
  rows: [
    { label: 'Docker', value: 14.5, unit: 'G', status: 'ok' },
    { label: 'npm', value: 6.2, unit: 'G', status: 'warn' },
  ],
}

test('initialize declares tools and resources', async () => {
  const res = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } })
  assert.ok(res.result.capabilities.tools)
  assert.ok(res.result.capabilities.resources)
})

test('tools/list: tool points at the ui:// resource', async () => {
  const { result } = await rpc('tools/list')
  const tool = result.tools.find((t) => t.name === 'render_glyph_card')
  assert.ok(tool, 'render_glyph_card is listed')
  assert.equal(tool._meta.ui.resourceUri, GLYPH_UI_URI)
  assert.match(GLYPH_UI_URI, /^ui:\/\//)
  assert.equal(tool._meta['ui/resourceUri'], GLYPH_UI_URI, 'legacy flat key for older hosts')
  assert.equal(tool._meta['openai/outputTemplate'], GLYPH_UI_URI, 'ChatGPT alias')
})

test('resources/read: serves HTML with the MCP App mime type', async () => {
  const { result } = await rpc('resources/read', { uri: GLYPH_UI_URI })
  const c = result.contents[0]
  assert.equal(c.uri, GLYPH_UI_URI)
  assert.equal(c.mimeType, 'text/html;profile=mcp-app')
  assert.equal(MCP_APP_MIME, 'text/html;profile=mcp-app')
  assert.match(c.text, /^<!DOCTYPE html>/)
  assert.match(c.text, /ui\/notifications\/tool-result/, 'listens for the standard bridge message')
  assert.match(c.text, /ui\/initialize/, 'does the standard handshake')
})

test('resources/read: unknown uri is a JSON-RPC error', async () => {
  const res = await rpc('resources/read', { uri: 'ui://nope' })
  assert.equal(res.error.code, -32002)
})

test('tools/call: text fallback is a glyph render, structuredContent has the rows', async () => {
  const { result } = await rpc('tools/call', { name: 'render_glyph_card', arguments: ARGS })
  const text = result.content[0].text
  assert.equal(result.content[0].type, 'text')
  assert.match(text, /Disk/)
  assert.match(text, /[▓░]/, 'bar meter glyphs')
  assert.ok(text.split('\n').every((l) => [...l].length <= 76), 'every line fits 76 cells')
  assert.equal(result.structuredContent.rows.length, 2)
  assert.equal(result.structuredContent.rows[0].label, 'Docker')
  assert.equal(result.structuredContent.total, 20.7)
  assert.notEqual(result.isError, true)
})

test('tools/call: bad input is a tool error, not a crash', async () => {
  const { result } = await rpc('tools/call', { name: 'render_glyph_card', arguments: { title: 'x', rows: 'nope' } })
  assert.equal(result.isError, true)
  assert.match(result.content[0].text, /rows/)
})

test('tools/call: unknown tool is a JSON-RPC error', async () => {
  const res = await rpc('tools/call', { name: 'nope', arguments: {} })
  assert.equal(res.error.code, -32602)
})

test('the iframe never assigns innerHTML (labels render as text)', async () => {
  const { result } = await rpc('resources/read', { uri: GLYPH_UI_URI })
  assert.doesNotMatch(result.contents[0].text, /innerHTML\s*=/, 'UI renders with textContent only')
})

test('params that are not an object are invalid params, not a crash', async () => {
  for (const params of [null, [], 'x', 7]) {
    for (const method of ['initialize', 'tools/call', 'resources/read']) {
      const res = await handleRpc({ jsonrpc: '2.0', id: 3, method, params })
      if (params === null) {
        assert.ok(res.result || res.error, `${method} with null params answers`)
      } else {
        assert.equal(res.error.code, -32602, `${method} with params ${JSON.stringify(params)}`)
      }
    }
  }
})

test('handleText: parse error, invalid request and bad params all answer without throwing', async () => {
  assert.equal((await handleText('{not json')).reply.error.code, -32700)
  assert.equal((await handleText('"a string"')).reply.error.code, -32600)
  assert.equal((await handleText('{"jsonrpc":"2.0","id":1,"method":"initialize","params":"x"}')).reply.error.code, -32602)
  assert.deepEqual(await handleText('{"jsonrpc":"2.0","method":"notifications/initialized"}'), { status: 202, reply: null })
})

test('tools/call: values that sum past Number.MAX_VALUE are a tool error, never a null total', async () => {
  const huge = { title: 'x', rows: [{ label: 'a', value: 1.7e308 }, { label: 'b', value: 1.7e308 }] }
  const { result } = await rpc('tools/call', { name: 'render_glyph_card', arguments: huge })
  assert.equal(result.isError, true)
  const big = await rpc('tools/call', { name: 'render_glyph_card', arguments: { title: 'x', rows: [{ label: 'a', value: 1e308 }] } })
  assert.notEqual(big.result.isError, true)
  assert.equal(JSON.parse(JSON.stringify(big.result.structuredContent)).total, 1e308, 'a near-max total survives JSON')
})

// Runs the iframe's own <script> against a stub host frame.
const runIframe = async () => {
  const { result } = await rpc('resources/read', { uri: GLYPH_UI_URI })
  const script = result.contents[0].text.match(/<script>([\s\S]*)<\/script>/)[1]
  const node = () => ({ textContent: '', className: '', style: {}, append() {}, replaceChildren() {} })
  const nodes = { title: node(), rows: node(), total: node() }
  const posted = []
  const listeners = []
  const parent = { postMessage: (m) => posted.push(m) }
  const window = { parent, addEventListener: (type, fn) => type === 'message' && listeners.push(fn) }
  const document = { getElementById: (id) => nodes[id], createElement: () => node() }
  vm.runInNewContext(script, { window, parent, document })
  const deliver = (source, data) => listeners.forEach((fn) => fn({ source, data }))
  return { posted, deliver, parent, nodes }
}

test('iframe: initialized is sent only after the host answers ui/initialize', async () => {
  const { posted, deliver, parent } = await runIframe()
  assert.deepEqual(posted.map((m) => m.method), ['ui/initialize'], 'nothing but the request before the answer')
  deliver(parent, { jsonrpc: '2.0', id: posted[0].id, result: {} })
  assert.deepEqual(posted.map((m) => m.method), ['ui/initialize', 'ui/notifications/initialized'])
  deliver(parent, { jsonrpc: '2.0', id: posted[0].id, result: {} })
  assert.equal(posted.length, 2, 'a repeated answer does not re-send initialized')
})

test('iframe: messages from any window but the host are ignored', async () => {
  const { deliver, parent, nodes } = await runIframe()
  const toolResult = { jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: { title: 'Spoofed', rows: [{ label: 'a', value: 1 }], total: 1 } } }
  deliver({ postMessage() {} }, toolResult)
  assert.equal(nodes.title.textContent, '', 'a foreign window cannot draw')
  deliver(parent, { ...toolResult, params: { structuredContent: { ...toolResult.params.structuredContent, title: 'Real' } } })
  assert.equal(nodes.title.textContent, 'Real')
})

test('unknown method is method-not-found; notifications get no reply', async () => {
  assert.equal((await rpc('nope')).error.code, -32601)
  assert.equal(await handleRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }), null)
})

test('Streamable HTTP: POST /mcp answers JSON-RPC, notifications get 202, GET is 405', async () => {
  const server = createHttpServer()
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${server.address().port}/mcp`
  const post = (body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) })
  try {
    const list = await post({ jsonrpc: '2.0', id: 7, method: 'tools/list' })
    assert.equal(list.status, 200)
    assert.match(list.headers.get('content-type'), /application\/json/)
    assert.equal((await list.json()).result.tools[0]._meta.ui.resourceUri, GLYPH_UI_URI)
    assert.equal((await post({ jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202)
    assert.equal((await fetch(url, { method: 'GET' })).status, 405)
    assert.equal((await fetch(url.replace('/mcp', '/other'), { method: 'POST', body: '{}' })).status, 404)
    assert.equal((await post('not an object')).status, 400)
    const bad = await post({ jsonrpc: '2.0', id: 8, method: 'initialize', params: 'x' })
    assert.equal(bad.status, 200)
    assert.equal((await bad.json()).error.code, -32602)
    assert.equal((await post({ jsonrpc: '2.0', id: 9, method: 'ping' })).status, 200, 'still serving after a malformed request')
  } finally {
    await new Promise((r) => server.close(r))
  }
})

// Raw http.request: fetch() refuses to set the Host header, and this test must.
const rawPost = (port, headers, body = '{"jsonrpc":"2.0","id":1,"method":"tools/list"}') =>
  new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path: '/mcp', method: 'POST', headers: { 'content-type': 'application/json', ...headers } }, (res) => {
      res.resume()
      res.on('end', () => resolve(res.statusCode))
    })
    req.on('error', reject)
    req.end(body)
  })

const withServer = async (opts, fn) => {
  const server = createHttpServer(opts)
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  try {
    return await fn(server.address().port)
  } finally {
    await new Promise((r) => server.close(r))
  }
}

test('origin guard: a non-local Host is refused by default', async () => {
  await withServer(undefined, async (port) => {
    assert.equal(await rawPost(port, { host: 'demo.trycloudflare.com' }), 403)
    assert.equal(await rawPost(port, { host: `localhost:${port}` }), 200)
    assert.equal(await rawPost(port, { host: `127.0.0.1:${port}` }), 200)
    assert.equal(await rawPost(port, { host: `[::1]:${port}` }), 200)
  })
})

test('origin guard: a non-local Origin is refused even with a local Host', async () => {
  await withServer(undefined, async (port) => {
    assert.equal(await rawPost(port, { host: `localhost:${port}`, origin: 'https://evil.example' }), 403)
    assert.equal(await rawPost(port, { host: `localhost:${port}`, origin: `http://localhost:${port}` }), 200)
  })
})

test('origin guard: allowedHosts opens exactly the named host, nothing else', async () => {
  await withServer({ allowedHosts: ['demo.trycloudflare.com'] }, async (port) => {
    assert.equal(await rawPost(port, { host: 'demo.trycloudflare.com' }), 200)
    assert.equal(await rawPost(port, { host: 'demo.trycloudflare.com:443' }), 200)
    assert.equal(await rawPost(port, { host: 'other.trycloudflare.com' }), 403)
    assert.equal(await rawPost(port, { host: 'demo.trycloudflare.com', origin: 'https://evil.example' }), 403)
  })
})
