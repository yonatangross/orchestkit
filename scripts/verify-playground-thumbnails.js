#!/usr/bin/env node
/**
 * Verify Playground Thumbnails
 * Ensures all thumbnails referenced in the manifest exist as PNG files.
 *
 * Usage: node scripts/verify-playground-thumbnails.js
 * Exit code: 0 if all thumbnails exist, 1 if any are missing
 */

const fs = require('fs');
const path = require('path');

const THUMBNAILS_DIR = path.join(__dirname, '../docs/playgrounds/thumbnails');
const MANIFEST_PATH = path.join(THUMBNAILS_DIR, '_manifest.json');

function main() {
  console.log('Verifying playground thumbnails...\n');

  // Check if manifest exists
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('ERROR: Manifest not found:', MANIFEST_PATH);
    process.exit(1);
  }

  // Read manifest
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (err) {
    console.error('ERROR: Invalid JSON in manifest:', err.message);
    process.exit(1);
  }

  const { thumbnails } = manifest;
  if (!Array.isArray(thumbnails)) {
    console.error('ERROR: manifest.thumbnails is not an array');
    process.exit(1);
  }

  // Check each thumbnail
  const missing = [];
  const found = [];

  for (const name of thumbnails) {
    const pngPath = path.join(THUMBNAILS_DIR, `${name}.png`);
    if (fs.existsSync(pngPath)) {
      found.push(name);
    } else {
      missing.push(name);
    }
  }

  // Also check for orphan thumbnails (files not in manifest)
  const allPngs = fs.readdirSync(THUMBNAILS_DIR)
    .filter(f => f.endsWith('.png') && !f.startsWith('_'))
    .map(f => f.replace('.png', ''));

  const orphans = allPngs.filter(f => !thumbnails.includes(f));

  // Report results
  console.log(`Found: ${found.length}/${thumbnails.length} thumbnails`);

  if (missing.length > 0) {
    console.error('\nMISSING THUMBNAILS:');
    missing.forEach(m => console.error(`  - ${m}.png`));
  }

  if (orphans.length > 0) {
    console.warn('\nORPHAN THUMBNAILS (not in manifest):');
    orphans.forEach(o => console.warn(`  - ${o}.png`));
  }

  // Exit with appropriate code
  if (missing.length > 0) {
    console.error(`\nFAILED: ${missing.length} thumbnails missing`);
    process.exit(1);
  }

  console.log('\nSUCCESS: All thumbnails verified');
  process.exit(0);
}

main();
