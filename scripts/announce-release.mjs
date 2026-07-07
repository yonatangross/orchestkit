#!/usr/bin/env node
/**
 * announce-release.mjs
 *
 * Posts a published release to the Yonatan-HQ platform marketing intake
 * (POST /api/marketing/release-announce), which drafts per-channel social posts
 * via the existing content pipeline. Drafts are human-gated on the platform —
 * this never publishes anything directly.
 *
 * Inputs (env, set by .github/workflows/release-announce.yml):
 *   RELEASE_VERSION   e.g. "8.62.1" (no leading v)            [required]
 *   RELEASE_URL       canonical link for the announcement     [required]
 *   RELEASE_NOTES     release body markdown                   [optional]
 *   REPO              owner/name (default yonatangross/orchestkit)
 *   ANNOUNCE_CHANNELS comma list (default twitter,devto,hashnode,substack,threads)
 *                     — LinkedIn is intentionally excluded: it is a curated,
 *                     hand-written channel, never auto-drafted. Instagram joins
 *                     once Meta Business Verification clears.
 *   HQ_API_URL        platform API base                       [enables live POST]
 *   HQ_API_TOKEN      platform API_STATIC_TOKEN               [enables live POST]
 *   DRY_RUN           "true" to compose without posting
 *
 * Safe by default: with DRY_RUN set or HQ_API_URL/HQ_API_TOKEN unset, it prints
 * the payload and exits 0 (so releases never fail just because the marketing
 * secrets aren't configured yet).
 */

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const {
  RELEASE_VERSION,
  RELEASE_URL,
  RELEASE_NOTES = "",
  REPO = "yonatangross/orchestkit",
  ANNOUNCE_CHANNELS = "twitter,devto,hashnode,substack,threads",
  HQ_API_URL,
  HQ_API_TOKEN,
  DRY_RUN = "false",
  GITHUB_OUTPUT,
  GITHUB_STEP_SUMMARY,
} = process.env;

function die(msg) {
  console.error(`[announce-release] ${msg}`);
  process.exit(1);
}

function summary(md) {
  if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, `${md}\n`);
}

function output(kv) {
  if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `${kv}\n`);
}

if (!RELEASE_VERSION) die("RELEASE_VERSION is required");
if (!RELEASE_URL) die("RELEASE_URL is required");

const dryRun = DRY_RUN === "true" || DRY_RUN === "1";

// Structured highlights from the changelog (best-effort — never fatal).
let highlights = [];
try {
  const out = execFileSync(
    "node",
    [resolve(__dirname, "changelog-to-props.mjs"), RELEASE_VERSION, "--landscape"],
    { encoding: "utf8" },
  );
  highlights = (JSON.parse(out).highlights || []).map((h) => ({
    category: h.category,
    title: h.title,
    description: h.description,
  }));
} catch (e) {
  console.error(`[announce-release] changelog parse skipped: ${e.message}`);
}

const payload = {
  repo: REPO,
  version: RELEASE_VERSION,
  release_url: RELEASE_URL,
  notes_markdown: RELEASE_NOTES.slice(0, 20000),
  highlights,
  channels: ANNOUNCE_CHANNELS.split(",").map((s) => s.trim()).filter(Boolean),
  dry_run: dryRun,
};

const haveCreds = Boolean(HQ_API_URL && HQ_API_TOKEN);

if (dryRun || !haveCreds) {
  if (!haveCreds) {
    console.error(
      "[announce-release] HQ_API_URL/HQ_API_TOKEN unset — dry-run only. " +
        "Configure both repo secrets to enable live drafting.",
    );
  }
  console.log(JSON.stringify({ mode: "dry-run", payload }, null, 2));
  summary(`### 📣 Release announce (dry-run)\nChannels: \`${payload.channels.join(", ")}\` · highlights: ${highlights.length}`);
  summary(haveCreds ? "" : "> Set `HQ_API_URL` + `HQ_API_TOKEN` repo secrets to post for real.");
  process.exit(0);
}

const endpoint = `${HQ_API_URL.replace(/\/$/, "")}/api/marketing/release-announce`;
const res = await fetch(endpoint, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${HQ_API_TOKEN}`,
  },
  body: JSON.stringify(payload),
});

const text = await res.text();
if (!res.ok) {
  // The release is already published; a failed announce is a visible red check,
  // not a broken release. Surface the error clearly.
  summary(`### ⚠️ Release announce failed (${res.status})\n\`\`\`\n${text.slice(0, 800)}\n\`\`\``);
  die(`platform returned ${res.status}: ${text.slice(0, 500)}`);
}

let data = {};
try {
  data = JSON.parse(text);
} catch {
  /* non-JSON 2xx — treat as opaque success */
}

const draftCount = (data.draft_ids || []).length;
console.log(JSON.stringify({ status: res.status, ...data }, null, 2));
output(`review_url=${data.review_url || ""}`);
output(`draft_count=${draftCount}`);
output(`skipped=${data.skipped === true}`);
output(`queued=${data.queued === true}`);

if (data.skipped) {
  summary(`### 📣 Release announce\nAlready drafted for ${REPO} ${RELEASE_VERSION} — skipped (idempotent).`);
} else if (data.queued) {
  // The platform now generates drafts in a background task and returns 202
  // (async since it 524'd inline behind Cloudflare). Drafts land in the review
  // queue shortly; draft_ids aren't known synchronously.
  summary(
    `### 📣 Release announce\nQueued drafting for ${REPO} ${RELEASE_VERSION} — posts will appear in the review queue shortly.\n` +
      (data.review_url ? `\n👉 Review + approve: ${data.review_url}` : ""),
  );
} else {
  summary(
    `### 📣 Release announce\nDrafted **${draftCount}** post(s) for ${REPO} ${RELEASE_VERSION}.\n` +
      (data.review_url ? `\n👉 Review + approve: ${data.review_url}` : ""),
  );
}
