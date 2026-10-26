#!/usr/bin/env node
// L6 elicitation probe: a dependency-free stdio MCP server.
// Tools: ask_plain (elicit during a normal call), ask_secret (elicit a field the
// ork guard blocks), ask_in_task (task-augmented call; elicits with the
// related-task _meta). Every message in and out is logged to SERVER_LOG.
import { appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const LOG = process.env.SERVER_LOG || '/tmp/l6-elicit-server.log';
const log = (dir, msg) => appendFileSync(LOG, `${new Date().toISOString()} ${dir} ${JSON.stringify(msg)}\n`);
const send = (msg) => { log('OUT', msg); process.stdout.write(JSON.stringify(msg) + '\n'); };

let nextId = 1000;
const pending = new Map();
const tasks = new Map();
const request = (method, params) => new Promise((resolve) => {
  const id = nextId++;
  pending.set(id, resolve);
  send({ jsonrpc: '2.0', id, method, params });
});

const formSchema = (field) => ({ type: 'object', properties: { [field]: { type: 'string', description: `Your ${field}` } }, required: [field] });

const TOOLS = [
  { name: 'ask_plain', description: 'Asks the user for a favourite color through an elicitation form.', inputSchema: { type: 'object', properties: {} } },
  { name: 'ask_secret', description: 'Asks the user for an api_key through an elicitation form.', inputSchema: { type: 'object', properties: {} } },
  { name: 'ask_in_task', description: 'Runs as an MCP task and asks the user for a color from inside the task.', inputSchema: { type: 'object', properties: {} }, execution: { taskSupport: 'optional' } },
];

async function elicit(field, meta) {
  const params = { mode: 'form', message: `Please give your ${field}`, requestedSchema: formSchema(field) };
  if (meta) params._meta = meta;
  const res = await request('elicitation/create', params);
  return res;
}

function text(t) { return { content: [{ type: 'text', text: t }] }; }

async function onToolCall(msg) {
  const { name, task } = msg.params || {};
  if (name === 'ask_in_task' && task) {
    const taskId = `task-${Date.now()}`;
    const now = new Date().toISOString();
    const t = { taskId, status: 'working', createdAt: now, lastUpdatedAt: now, ttl: task.ttl ?? 60000, pollInterval: 500 };
    tasks.set(taskId, { t, result: null });
    send({ jsonrpc: '2.0', id: msg.id, result: { task: t } });
    t.status = 'input_required';
    const res = await elicit('color', { 'io.modelcontextprotocol/related-task': { taskId } });
    t.status = 'completed'; t.lastUpdatedAt = new Date().toISOString();
    tasks.get(taskId).result = text(`in-task elicitation answered: ${JSON.stringify(res)}`);
    return;
  }
  const field = name === 'ask_secret' ? 'api_key' : 'color';
  const res = await elicit(field, null);
  send({ jsonrpc: '2.0', id: msg.id, result: text(`${name} (task param ${task ? 'present' : 'absent'}) elicitation answered: ${JSON.stringify(res)}`) });
}

const rl = createInterface({ input: process.stdin });
rl.on('line', async (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { log('BAD', line); return; }
  log('IN', msg);
  if (msg.id !== undefined && !msg.method) {
    const r = pending.get(msg.id); pending.delete(msg.id);
    if (r) r(msg.result ?? { error: msg.error });
    return;
  }
  switch (msg.method) {
    case 'initialize':
      send({ jsonrpc: '2.0', id: msg.id, result: {
        protocolVersion: msg.params?.protocolVersion || '2025-11-25',
        capabilities: { tools: {}, tasks: { list: {}, cancel: {}, requests: { tools: { call: {} } } }, extensions: { 'io.modelcontextprotocol/tasks': {} } },
        serverInfo: { name: 'l6elicit', version: '0.1.0' },
      } });
      break;
    case 'tools/list':
      send({ jsonrpc: '2.0', id: msg.id, result: { tools: TOOLS } });
      break;
    case 'tools/call':
      onToolCall(msg);
      break;
    case 'tasks/get': {
      const e = tasks.get(msg.params?.taskId);
      send(e ? { jsonrpc: '2.0', id: msg.id, result: e.t } : { jsonrpc: '2.0', id: msg.id, error: { code: -32602, message: 'unknown task' } });
      break;
    }
    case 'tasks/result': {
      const e = tasks.get(msg.params?.taskId);
      const wait = async () => { while (e && !e.result) await new Promise((r) => setTimeout(r, 200)); };
      await wait();
      send(e ? { jsonrpc: '2.0', id: msg.id, result: e.result } : { jsonrpc: '2.0', id: msg.id, error: { code: -32602, message: 'unknown task' } });
      break;
    }
    case 'tasks/list':
      send({ jsonrpc: '2.0', id: msg.id, result: { tasks: [...tasks.values()].map((e) => e.t) } });
      break;
    default:
      if (msg.id !== undefined) send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `no method ${msg.method}` } });
  }
});
