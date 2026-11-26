#!/usr/bin/env node
// Put a release's own media at the top of its notes.
//
//   node scripts/ci/release-media-body.mjs <tag> <release.json> <out.md>
//
// <release.json> is `gh release view <tag> --json body,assets`. The three
// assets named below must be there, uploaded and non-empty: a missing one
// fails the run and writes nothing, so a release never shows a broken image.
// GitHub plays only user-attachment videos inline, so the mp4s are links.

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const START = '<!-- release-media:start -->';
const END = '<!-- release-media:end -->';

function assetUrl(assets, name) {
  const found = assets.find(asset => asset?.name === name);
  if (!found || found.state !== 'uploaded' || !(found.size > 0) || !/^https:\/\//.test(found.url ?? '')) {
    throw new Error(`release asset ${name} is missing, empty or not uploaded`);
  }
  return found.url;
}

// Stands where text was cut out. Cutting to nothing would join both sides, and
// a "!" plus a link could then read as an image.
const CUT = '�';

/**
 * The notes with everything Markdown shows as text cut out: fenced blocks
 * (closed or not), indented code, HTML comments and code spans.
 */
function renderedText(body) {
  return body
    .replace(/^ {0,3}(`{3,}|~{3,})[^\n]*(?:\n[\s\S]*?)?(?:^ {0,3}\1[`~]*[ \t\r]*$|(?![\s\S]))/gm, CUT)
    .replace(/^(?: {4}|\t).*$/gm, CUT)
    .replace(/<!--[\s\S]*?(?:-->|(?![\s\S]))/g, CUT)
    .replace(/(`+)[\s\S]*?\1/g, CUT);
}

/**
 * Is the gif shown as an image? A link to it is not. When in doubt the answer
 * is no: a second copy is cosmetic, missing media is the bug.
 */
function showsImage(body, url) {
  const literal = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<!\\\\)!\\[[^\\]\\n]*\\]\\(${literal}(?:[ \\t]+"[^"\\n]*")?\\)`).test(renderedText(body));
}

export function embedMedia(body, tag, assets) {
  if (!tag) throw new Error('no release tag');
  if (typeof body !== 'string') throw new Error('release body was not read');
  if (!Array.isArray(assets)) throw new Error('release assets were not read');

  const base = `release-${tag.replace(/^v/, '')}`;
  const gif = assetUrl(assets, `${base}-preview.gif`);
  const landscape = assetUrl(assets, `${base}-landscape.mp4`);
  const square = assetUrl(assets, `${base}-square.mp4`);
  const block = [
    START,
    `![Release ${tag} preview](${gif})`,
    '',
    `Video: [landscape mp4](${landscape}) · [square mp4](${square})`,
    END,
  ].join('\n');

  // Our block is always written at the top. The markers anywhere else are text
  // (a commit title may quote them).
  if (body.startsWith(START)) {
    const to = body.indexOf(END);
    if (to < 0) throw new Error('release body has a start marker and no end marker');
    return block + body.slice(to + END.length);
  }
  // Someone embedded this gif by hand: leave their layout alone.
  if (showsImage(body, gif)) return body;
  return `${block}\n\n${body}`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [tag, input, output] = process.argv.slice(2);
  try {
    const release = JSON.parse(readFileSync(input, 'utf8'));
    writeFileSync(output, embedMedia(release.body, tag, release.assets));
  } catch (err) {
    console.error(`::error::release media not embedded: ${err.message}`);
    process.exit(1);
  }
}
