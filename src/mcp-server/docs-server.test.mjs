import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('docs get succeeds for a complete body and returns a tool error for a stalled body', async () => {
  const upstream = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/markdown' });
    if (req.url === '/docs/stall.md') res.write('# Partial');
    else res.end('# Ready');
  });
  const client = new Client({ name: 'docs-test', version: '1' });
  try {
    await new Promise((resolve, reject) => {
      upstream.once('error', reject);
      upstream.listen(0, '127.0.0.1', resolve);
    });
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: [fileURLToPath(new URL('./dist/docs-server.mjs', import.meta.url))],
      env: { ORCHESTKIT_DOCS_ORIGIN: `http://127.0.0.1:${upstream.address().port}` },
    }));
    const get = (path) => client.callTool(
      { name: 'orchestkit_docs_get', arguments: { path } },
      undefined,
      { timeout: 20_000 },
    );

    assert.deepEqual((await get('/docs/ready')).content, [{ type: 'text', text: '# Ready' }]);
    const result = await get('/docs/stall');
    assert.notEqual(result.isError, true);
    assert.equal(result.content.length, 1);
    assert.equal(result.content[0].type, 'text');
    assert.match(result.content[0].text, /^Could not fetch '\/docs\/stall': .*(?:abort|timeout)/i);
  } finally {
    await client.close();
    upstream.closeAllConnections();
    upstream.close();
  }
});
