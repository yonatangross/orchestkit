#!/usr/bin/env node
// gh-api.mjs -- dependency-free GitHub API client for Claude Code shells where
// the gh CLI cannot make TLS connections.
//
// Why gh fails here and node does not (measured 2026-08-20/21, full
// parent/subagent x sandboxed/flag-off matrix, all four cells failing):
// CC's srt egress proxy is a plain CONNECT tunnel. There is no MITM, the
// upstream certificates are genuine, and there is nothing to install. gh
// fails because OSStatus -26276 is a Security-framework INTERNAL error: the
// verifier cannot CONSULT the trust store, because the sandbox denies Mach
// IPC to securityd, and Go on darwin has no other certificate-verification
// path. node works because it ships its own CA bundle and never needs to
// talk to securityd.
//
// Proxy mechanism (verified empirically, same dates): node only honors
// HTTPS_PROXY/HTTP_PROXY when NODE_USE_ENV_PROXY=1 is present AT LAUNCH.
// Setting process.env.NODE_USE_ENV_PROXY='1' inside the script before the
// first fetch does NOT work (undici wires its global dispatcher during
// bootstrap; the in-script assignment yields getaddrinfo ENOTFOUND because
// fetch goes direct instead of through the tunnel). This script therefore
// re-execs itself once with NODE_USE_ENV_PROXY=1 in the child environment
// when the variable is absent, which is the proven launch-time variant.
//
// Auth: token comes from `gh auth token` (keychain-free read; it still works
// even though gh's TLS path is broken). The token is never printed.
//
// Usage:
//   node scripts/gh-api.mjs <method> <path> [json-body-file]
//   node scripts/gh-api.mjs graphql < query.graphql
//
// Examples:
//   node scripts/gh-api.mjs GET /rate_limit
//   node scripts/gh-api.mjs POST /repos/OWNER/REPO/pulls body.json
//   echo 'query { viewer { login } }' | node scripts/gh-api.mjs graphql
//
// Non-2xx responses raise GhApiError with the status and the first 200
// characters of the response body, printed without a stack trace (exit 1).

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

if (process.env.NODE_USE_ENV_PROXY !== '1') {
  const child = spawnSync(
    process.execPath,
    [fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } },
  );
  process.exit(child.status ?? 1);
}

const API = 'https://api.github.com';

class GhApiError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GhApiError';
  }
}

function usage() {
  process.stderr.write(
    'usage: gh-api.mjs <method> <path> [json-body-file]\n' +
    '       gh-api.mjs graphql   (query on stdin)\n',
  );
  process.exit(2);
}

function token() {
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  } catch {
    throw new GhApiError('could not read a token from `gh auth token`');
  }
}

async function request(method, path, body) {
  const url = path.startsWith('http') ? path : API + path;
  const res = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token()}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'orchestkit-gh-api-helper',
      'x-github-api-version': '2022-11-28',
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new GhApiError(`HTTP ${res.status} for ${method} ${url}: ${text.slice(0, 200)}`);
  }
  return text;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd) usage();

  if (cmd.toLowerCase() === 'graphql') {
    const query = readFileSync(0, 'utf8');
    if (!query.trim()) throw new GhApiError('graphql: empty query on stdin');
    const text = await request('POST', '/graphql', JSON.stringify({ query }));
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    if (parsed && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      throw new GhApiError(`graphql errors: ${JSON.stringify(parsed.errors).slice(0, 200)}`);
    }
    process.stdout.write(text + '\n');
    return;
  }

  const [path, bodyFile] = rest;
  if (!path || !path.startsWith('/')) usage();
  const body = bodyFile !== undefined ? readFileSync(bodyFile, 'utf8') : undefined;
  const text = await request(cmd.toUpperCase(), path, body);
  process.stdout.write(text + '\n');
}

main().catch((err) => {
  if (err instanceof GhApiError) {
    process.stderr.write(`${err.name}: ${err.message}\n`);
  } else {
    process.stderr.write(`${err.name ?? 'Error'}: ${err.message ?? String(err)}\n`);
  }
  process.exit(1);
});
