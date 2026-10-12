// x-client.mjs: a small X API v2 client with OAuth 1.0a user context.
//
// Used only by scripts/changelog-x.mjs, and only when the run is live (see
// that file for the dry-run gate). It needs these 4 values from the
// environment: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET.
//
// Endpoints:
//   POST /2/tweets                              create a post or a reply
//   POST /2/media/upload/initialize             start a chunked media upload
//   POST /2/media/upload/{id}/append            send one chunk
//   POST /2/media/upload/{id}/finalize          end the upload
//   GET  /2/media/upload?command=STATUS&...     poll GIF processing
//
// OAuth 1.0a signs the method, the URL and the query parameters. JSON and
// multipart bodies are not part of the signature.

import { createHmac, randomBytes } from 'node:crypto';

const API = 'https://api.x.com';
const CHUNK = 4 * 1024 * 1024;

/** RFC 3986 percent-encoding, as OAuth 1.0a requires. */
export function pct(s) {
  return encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * Build the OAuth 1.0a Authorization header.
 * `nonce` and `timestamp` are parameters so that a test can fix them.
 * `bodyParams` is for form-encoded bodies only. This client sends JSON and
 * multipart bodies, which OAuth 1.0a does not sign, so it passes none.
 */
export function oauthHeader({ method, url, creds, nonce, timestamp, bodyParams = {} }) {
  const u = new URL(url);
  const oauth = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: nonce ?? randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(timestamp ?? Math.floor(Date.now() / 1000)),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };
  const params = [...Object.entries(oauth), ...u.searchParams.entries(), ...Object.entries(bodyParams)]
    .map(([k, v]) => [pct(k), pct(v)])
    .sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : 1) : a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const baseUrl = `${u.protocol}//${u.host}${u.pathname}`;
  const base = [method.toUpperCase(), pct(baseUrl), pct(params)].join('&');
  const key = `${pct(creds.apiSecret)}&${pct(creds.accessSecret)}`;
  const signature = createHmac('sha1', key).update(base).digest('base64');
  const header = { ...oauth, oauth_signature: signature };
  return 'OAuth ' + Object.entries(header).map(([k, v]) => `${pct(k)}="${pct(v)}"`).join(', ');
}

/** Read the 4 credentials. Throw when one is missing. */
export function credsFromEnv(env = process.env) {
  const creds = {
    apiKey: env.X_API_KEY,
    apiSecret: env.X_API_SECRET,
    accessToken: env.X_ACCESS_TOKEN,
    accessSecret: env.X_ACCESS_SECRET,
  };
  const missing = Object.entries({
    X_API_KEY: creds.apiKey,
    X_API_SECRET: creds.apiSecret,
    X_ACCESS_TOKEN: creds.accessToken,
    X_ACCESS_SECRET: creds.accessSecret,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) throw new Error(`missing X secrets: ${missing.join(', ')}`);
  return creds;
}

async function call(creds, method, url, { json, form } = {}) {
  const headers = { Authorization: oauthHeader({ method, url, creds }) };
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  if (!res.ok) {
    // Print the status and the start of the body. Never print the headers.
    throw new Error(`X API ${method} ${new URL(url).pathname} failed: HTTP ${res.status} ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
}

/** Post one text. Returns the new post id. */
export async function createPost(creds, text, { replyTo, mediaId } = {}) {
  const json = { text };
  if (replyTo) json.reply = { in_reply_to_tweet_id: replyTo };
  if (mediaId) json.media = { media_ids: [mediaId] };
  const out = await call(creds, 'POST', `${API}/2/tweets`, { json });
  return out?.data?.id;
}

/** Post a thread. Media goes on the first post only. Returns the post ids. */
export async function postThread(creds, posts, { mediaId } = {}) {
  const ids = [];
  let replyTo;
  for (const [i, text] of posts.entries()) {
    const id = await createPost(creds, text, { replyTo, mediaId: i === 0 ? mediaId : undefined });
    if (!id) throw new Error(`X API returned no id for post ${i + 1}`);
    ids.push(id);
    replyTo = id;
  }
  return ids;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Upload a GIF with the chunked v2 media endpoints. Returns the media id. */
export async function uploadGif(creds, bytes) {
  const init = await call(creds, 'POST', `${API}/2/media/upload/initialize`, {
    json: { media_type: 'image/gif', total_bytes: bytes.length, media_category: 'tweet_gif' },
  });
  const id = init?.data?.id;
  if (!id) throw new Error('media initialize returned no id');

  for (let i = 0, seg = 0; i < bytes.length; i += CHUNK, seg++) {
    const form = new FormData();
    form.append('segment_index', String(seg));
    form.append('media', new Blob([bytes.subarray(i, i + CHUNK)]), 'chunk.gif');
    await call(creds, 'POST', `${API}/2/media/upload/${id}/append`, { form });
  }

  let state = (await call(creds, 'POST', `${API}/2/media/upload/${id}/finalize`))?.data?.processing_info;
  // GIF processing is async. Check the status until it ends, at most 2 minutes.
  for (let waited = 0; state && state.state !== 'succeeded'; ) {
    if (state.state === 'failed') throw new Error(`media processing failed: ${JSON.stringify(state.error || {})}`);
    if (waited > 120) throw new Error('media processing did not end in 120 s');
    const wait = Math.max(1, Number(state.check_after_secs) || 2);
    await sleep(wait * 1000);
    waited += wait;
    const url = `${API}/2/media/upload?command=STATUS&media_id=${encodeURIComponent(id)}`;
    state = (await call(creds, 'GET', url))?.data?.processing_info;
  }
  return id;
}
