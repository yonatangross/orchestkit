'use strict';
// Kebab slug -> display label, acronyms kept upper case ("ci-cd" -> "CI/CD").
// Same acronym list as docs/site/lib/slug-label.ts and _build-docs-generate.py.
const { words: WORDS, phrases: PHRASES } = require('../../docs/site/lib/slug-acronyms.json');

const MAX_PHRASE_LEN = Math.max(1, ...Object.keys(PHRASES).map((k) => k.split('-').length));

function slugLabel(slug) {
  const tokens = slug.split('-');
  const out = [];
  for (let i = 0; i < tokens.length;) {
    let matched = false;
    for (let n = Math.min(MAX_PHRASE_LEN, tokens.length - i); n > 1; n--) {
      const phrase = PHRASES[tokens.slice(i, i + n).join('-')];
      if (phrase) {
        out.push(phrase);
        i += n;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const w = tokens[i];
    out.push(WORDS[w] || w.charAt(0).toUpperCase() + w.slice(1));
    i += 1;
  }
  return out.join(' ');
}

module.exports = { slugLabel };
