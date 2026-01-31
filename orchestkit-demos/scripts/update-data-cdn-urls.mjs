#!/usr/bin/env node
/**
 * Patch docs/playgrounds/data.js with CDN URLs from Sanity upload.
 *
 * Reads:  out/cdn-urls.json (from upload-to-sanity.mjs)
 * Writes: docs/playgrounds/data.js (adds thumbnailCdn + videoCdn fields)
 *
 * Usage:
 *   node scripts/update-data-cdn-urls.mjs
 */

import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CDN_URLS_FILE = path.join(ROOT, "out", "cdn-urls.json");
const DATA_JS_FILE = path.join(ROOT, "..", "docs", "playgrounds", "data.js");

function main() {
  if (!fs.existsSync(CDN_URLS_FILE)) {
    console.error(`CDN URLs file not found: ${CDN_URLS_FILE}`);
    console.error("Run upload-to-sanity.mjs first.");
    process.exit(1);
  }

  const cdnUrls = JSON.parse(fs.readFileSync(CDN_URLS_FILE, "utf-8"));
  let dataJs = fs.readFileSync(DATA_JS_FILE, "utf-8");

  console.log("=== Patching data.js with CDN URLs ===");
  console.log(`CDN entries: ${Object.keys(cdnUrls).length}`);
  console.log("");

  let patched = 0;
  let notFound = 0;

  for (const [id, urls] of Object.entries(cdnUrls)) {
    // Match the composition entry by its id field, then inject CDN fields
    // after the thumbnail field.
    //
    // Pattern: thumbnail: "thumbnails/Foo.png"
    // Insert:  thumbnailCdn: "https://...", videoCdn: "https://...",
    const thumbPattern = new RegExp(
      `(id:\\s*"${escapeRegex(id)}"[^}]*?thumbnail:\\s*"[^"]*")`,
      "s"
    );

    if (!thumbPattern.test(dataJs)) {
      console.log(`  SKIP ${id} (not found in data.js)`);
      notFound++;
      continue;
    }

    // Build the CDN fields to inject
    const cdnFields = [];
    if (urls.thumbnailCdn) {
      cdnFields.push(`thumbnailCdn: "${urls.thumbnailCdn}"`);
    }
    if (urls.videoCdn) {
      cdnFields.push(`videoCdn: "${urls.videoCdn}"`);
    }

    if (cdnFields.length === 0) continue;

    // Check if CDN fields already exist for this composition
    const existingCheck = new RegExp(
      `id:\\s*"${escapeRegex(id)}"[^}]*?thumbnailCdn:`,
      "s"
    );
    if (existingCheck.test(dataJs)) {
      console.log(`  SKIP ${id} (CDN fields already present)`);
      continue;
    }

    dataJs = dataJs.replace(thumbPattern, `$1, ${cdnFields.join(", ")}`);
    console.log(`  PATCH ${id} (+${cdnFields.length} CDN fields)`);
    patched++;
  }

  fs.writeFileSync(DATA_JS_FILE, dataJs);

  console.log("");
  console.log("=== Summary ===");
  console.log(`Patched:   ${patched}`);
  console.log(`Not found: ${notFound}`);
  console.log(`Output:    ${DATA_JS_FILE}`);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main();
