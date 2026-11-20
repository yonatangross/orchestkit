/**
 * telemetry-sync.mjs must refuse a non-https destination before it sends
 * anything (the local telemetry log and the Bearer token). Runs the real
 * script as a child process against a real local http server and real files.
 *
 * The privacy page states every opt-in destination must be an https URL; the
 * HTTP sinks already enforce it (sink-url-policy.ts), this script did not.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { AddressInfo } from 'node:net';

const SCRIPT = resolve(__dirname, '../../../bin/telemetry-sync.mjs');

function runSync(env: Record<string, string>): Promise<{ code: number | null; out: string }> {
  return new Promise((done) => {
    execFile(
      process.execPath,
      [SCRIPT],
      { env: { PATH: process.env.PATH ?? '', ...env }, timeout: 15000 },
      (err, stdout, stderr) => {
        const code = err && typeof (err as NodeJS.ErrnoException).code === 'number'
          ? ((err as unknown as { code: number }).code)
          : err ? 1 : 0;
        done({ code, out: `${stdout}${stderr}` });
      },
    );
  });
}

describe('telemetry-sync.mjs: https-only destination', () => {
  let dataDir: string;
  let server: Server;
  let hits: number;
  let port: number;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'ork-tsync-'));
    const telemetryDir = join(dataDir, 'telemetry');
    mkdirSync(telemetryDir, { recursive: true });
    writeFileSync(join(telemetryDir, 'events.20260101T000000.jsonl'), '{"event":"x"}\n');
    hits = 0;
    server = createServer((req, res) => {
      hits++;
      req.resume();
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end('{"accepted":1,"rejected":0}');
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('sends nothing and keeps the local files when the URL is http:', async () => {
    const { code, out } = await runSync({
      CLAUDE_PLUGIN_DATA: dataDir,
      ORCHESTKIT_HOOK_URL: `http://127.0.0.1:${port}`,
      ORCHESTKIT_HOOK_TOKEN: 'test-token-not-a-secret',
    });

    expect(hits).toBe(0);
    expect(code).toBe(0);
    expect(out).toMatch(/https/i);
    expect(existsSync(join(dataDir, 'telemetry', 'events.20260101T000000.jsonl'))).toBe(true);
  });

  it('refuses http://example.com and logs why, with no localhost exception either', async () => {
    const { code, out } = await runSync({
      CLAUDE_PLUGIN_DATA: dataDir,
      ORCHESTKIT_HOOK_URL: 'http://example.com/hooks',
      ORCHESTKIT_HOOK_TOKEN: 'test-token-not-a-secret',
    });

    expect(code).toBe(0);
    expect(out).toContain('Refusing a non-https webhook URL. Nothing sent');
    // The URL is never echoed (it may carry credentials in userinfo).
    expect(out).not.toContain('example.com');
  });

  it('sends nothing when the URL does not parse', async () => {
    const { code } = await runSync({
      CLAUDE_PLUGIN_DATA: dataDir,
      ORCHESTKIT_HOOK_URL: 'not a url',
      ORCHESTKIT_HOOK_TOKEN: 'test-token-not-a-secret',
    });

    expect(hits).toBe(0);
    expect(code).toBe(0);
  });
});
