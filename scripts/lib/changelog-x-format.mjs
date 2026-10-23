// changelog-x-format.mjs: pure formatting for the X changelog feed.
//
// This module has no I/O. scripts/changelog-x.mjs reads the changelogs and
// calls these functions. tests/unit/test-changelog-x-format.mjs tests them.
//
// Rules that every post obeys:
//   1. The weighted length is 280 or less (see weightedLength).
//   2. The text is facts from a changelog. The code adds no opinion words.
//   3. The only hashtag is #ClaudeCode, and only on the first post.

export const MAX_POST = 280;
// X shortens every URL to a t.co link that counts as 23 characters.
export const URL_WEIGHT = 23;
export const HASHTAG = '#ClaudeCode';
export const ELLIPSIS = '...';
export const DOCS_CHANGELOG = 'https://orchestkit.dev/changelog';

const URL_RE = /https?:\/\/[^\s]+/g;

// X counts code points in these ranges as 1 and all others as 2 (twitter-text
// v3 config). Emoji and CJK text thus count as 2.
const LIGHT_RANGES = [
  [0x0000, 0x10ff],
  [0x2000, 0x200d],
  [0x2010, 0x201f],
  [0x2032, 0x2037],
];

function charWeight(cp) {
  for (const [lo, hi] of LIGHT_RANGES) {
    if (cp >= lo && cp <= hi) return 1;
  }
  return 2;
}

/** Weighted length as X counts it. Each URL counts as URL_WEIGHT. */
export function weightedLength(text) {
  let total = 0;
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    total += plainWeight(text.slice(last, m.index)) + URL_WEIGHT;
    last = m.index + m[0].length;
  }
  return total + plainWeight(text.slice(last));
}

// X also links text with no scheme when it ends in a TLD ("x.com",
// "CLAUDE.md" is not, "notes.new" is), and counts it as URL_WEIGHT. Matching
// the real TLD list here is not worth it, so every word.word token with a
// letters-only ending counts as at least URL_WEIGHT. That can count high
// ("Node.js"), which only makes a post shorter; it never counts low.
const BARE_DOMAIN_RE = /(?<![\w@.\/-])[A-Za-z0-9][\w-]*(?:\.[\w-]+)*\.[A-Za-z]{2,}(?![\w.-]*\w)/g;

function plainWeight(s) {
  let total = 0;
  let last = 0;
  for (const m of s.matchAll(BARE_DOMAIN_RE)) {
    total += charsWeight(s.slice(last, m.index)) + Math.max(URL_WEIGHT, charsWeight(m[0]));
    last = m.index + m[0].length;
  }
  return total + charsWeight(s.slice(last));
}

function charsWeight(s) {
  let w = 0;
  for (const ch of s) w += charWeight(ch.codePointAt(0));
  return w;
}

/**
 * Cut text so that its weighted length is `budget` or less. Cut at a word
 * boundary when one is near, and add "..." when text was removed.
 */
export function truncate(text, budget) {
  if (weightedLength(text) <= budget) return text;
  if (budget <= ELLIPSIS.length) return ELLIPSIS.slice(0, Math.max(0, budget));
  const chars = Array.from(text);
  let out = '';
  for (const ch of chars) {
    if (weightedLength(out + ch) + ELLIPSIS.length > budget) break;
    out += ch;
  }
  const space = out.lastIndexOf(' ');
  if (space > out.length * 0.6) out = out.slice(0, space);
  return out.replace(/[\s,;:.-]+$/, '') + ELLIPSIS;
}

/**
 * Split text into parts with a weighted length of `limit` or less. Split at
 * spaces. A single word longer than the limit is cut hard.
 */
export function splitText(text, limit = MAX_POST) {
  const words = text.split(/\s+/).filter(Boolean);
  const parts = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (weightedLength(next) <= limit) {
      cur = next;
      continue;
    }
    if (cur) parts.push(cur);
    if (weightedLength(word) <= limit) {
      cur = word;
    } else {
      // Hard cut a word that alone is too long.
      let piece = '';
      for (const ch of word) {
        if (weightedLength(piece + ch) > limit) {
          parts.push(piece);
          piece = '';
        }
        piece += ch;
      }
      cur = piece;
    }
  }
  if (cur) parts.push(cur);
  return parts;
}

/** Remove markdown so that a changelog bullet reads as plain text. */
export function cleanItem(text) {
  return String(text)
    // release-please link tails: ([#123](url)) ([abc1234](url))
    .replace(/\s*\(\[[^\]]+\]\([^)]*\)\)/g, '')
    // [text](url) becomes text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s*[-*]\s+/, '')
    // Only #ClaudeCode is a hashtag. "#foo" from a changelog becomes "foo".
    // "#123" stays: X does not make a hashtag from digits only.
    .replace(/#(?!ClaudeCode\b)(\w*[A-Za-z_]\w*)/g, '$1')
    // Do not tag accounts. A zero-width space after "@" stops the mention.
    .replace(/@(?=\w)/g, '@​')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Add UTM parameters and an optional anchor to a URL. */
export function withUtm(url, campaign, anchor = '') {
  const u = new URL(url);
  u.searchParams.set('utm_source', 'x');
  u.searchParams.set('utm_medium', 'social');
  u.searchParams.set('utm_campaign', campaign);
  if (anchor) u.hash = anchor;
  return u.toString();
}

/** The docs changelog link for one OrchestKit version. */
export function docsLink(version) {
  return withUtm(DOCS_CHANGELOG, `v${version}`, version);
}

/**
 * Build the first post: headline, up to `headCount` bullets, then the footer
 * (link and hashtag). The bullets get shorter until the post fits.
 */
function buildHead({ headline, items, link, hashtag, headCount, more }) {
  const footerParts = [];
  if (more > 0) footerParts.push(`+${more} more`);
  if (link) footerParts.push(link);
  const footerTail = hashtag ? `${footerParts.join('\n')} ${hashtag}`.trim() : footerParts.join('\n');
  const footer = footerTail ? `\n\n${footerTail}` : '';

  const head = truncate(headline, MAX_POST - weightedLength(footer));
  let bullets = items.slice(0, headCount).map((i) => `- ${i}`);
  const compose = () => (bullets.length ? `${head}\n\n${bullets.join('\n')}${footer}` : `${head}${footer}`);

  // Share the free space between the bullets. A short bullet keeps its full
  // text and gives the space it does not use to the others.
  while (bullets.length && weightedLength(compose()) > MAX_POST) {
    const fixed = weightedLength(`${head}\n\n${footer}`) + (bullets.length - 1);
    let free = MAX_POST - fixed;
    const order = bullets.map((b, i) => i).sort((a, b) => weightedLength(bullets[a]) - weightedLength(bullets[b]));
    const out = [...bullets];
    order.forEach((idx, k) => {
      const share = Math.floor(free / (order.length - k));
      out[idx] = truncate(bullets[idx], share);
      free -= weightedLength(out[idx]);
    });
    // A bullet with less than 20 characters left says nothing. Drop the last one.
    if (out.some((b) => weightedLength(b) < 20) || weightedLength(out.join('\n')) > MAX_POST - fixed + bullets.length - 1) {
      bullets = bullets.slice(0, -1);
      continue;
    }
    bullets = out;
  }
  return compose();
}

/**
 * Pack the remaining bullets into reply posts. Each reply is MAX_POST or less.
 * A bullet that alone is too long is split across replies.
 */
function buildReplies(items, maxReplies, overflowLink) {
  // Each line keeps the index of its item, so that the "+N more" count is
  // a count of items, not of split pieces.
  const lines = [];
  items.forEach((item, idx) => {
    const line = `- ${item}`;
    const pieces = weightedLength(line) <= MAX_POST ? [line] : splitText(line, MAX_POST);
    pieces.forEach((text, k) => lines.push({ text, idx, last: k === pieces.length - 1 }));
  });

  const posts = [];
  let cur = [];
  for (const line of lines) {
    const next = [...cur, line].map((l) => l.text).join('\n');
    if (cur.length && weightedLength(next) > MAX_POST) {
      posts.push(cur);
      cur = [line];
    } else {
      cur.push(line);
    }
  }
  if (cur.length) posts.push(cur);

  const render = (post) => post.map((l) => l.text).join('\n');
  if (posts.length <= maxReplies) return posts.map(render);

  // Too many replies: keep maxReplies and end with a pointer to the full list.
  const kept = posts.slice(0, maxReplies);
  const last = kept[kept.length - 1];
  const tailFor = (post) => {
    const shown = new Set(kept.slice(0, -1).flat().concat(post).filter((l) => l.last).map((l) => l.idx));
    const dropped = items.length - shown.size;
    return overflowLink ? `\n+${dropped} more: ${overflowLink}` : `\n+${dropped} more`;
  };
  // Remove whole lines from the last reply until the pointer fits.
  while (last.length > 1 && weightedLength(render(last) + tailFor(last)) > MAX_POST) last.pop();
  const tail = tailFor(last);
  let body = render(last);
  if (weightedLength(body + tail) > MAX_POST) body = truncate(body, MAX_POST - weightedLength(tail));
  kept[kept.length - 1] = null;
  const out = kept.slice(0, -1).map(render);
  out.push(body + tail);
  return out;
}

/**
 * Build a post or a thread.
 *
 * One post when there are `headCount` items or fewer. A thread when there are
 * more: the first post has the top `headCount` items, the replies have the rest.
 *
 * @returns {string[]} posts in order. Every post is MAX_POST or less.
 */
export function buildThread({ headline, items, link = '', hashtag = HASHTAG, headCount = 3, maxReplies = 5 }) {
  const clean = items.map(cleanItem).filter(Boolean);
  const rest = clean.slice(headCount);
  const head = buildHead({ headline, items: clean, link, hashtag, headCount, more: rest.length });
  if (rest.length === 0) return [head];
  return [head, ...buildReplies(rest, maxReplies, link)];
}

// The order of categories in a post. Features first, then fixes, then others.
const CATEGORY_RANK = { added: 0, fixed: 1, changed: 2 };

/** Sort parsed highlights so that features come first. Stable for equal ranks. */
export function rankHighlights(highlights) {
  return highlights
    .map((h, i) => ({ h, i }))
    .sort((a, b) => (CATEGORY_RANK[a.h.category] ?? 9) - (CATEGORY_RANK[b.h.category] ?? 9) || a.i - b.i)
    .map(({ h }) => h);
}

function highlightText(h) {
  // changelog-to-props splits an entry into a title and a description. When the
  // description repeats the title, use the description only.
  const title = cleanItem(h.title || '');
  const desc = cleanItem(h.description || '');
  if (!desc) return title;
  if (!title || desc.toLowerCase().startsWith(title.toLowerCase())) return desc;
  return `${title}: ${desc}`;
}

function countBy(highlights, category) {
  return highlights.filter((h) => h.category === category).length;
}

/** Posts for a stable OrchestKit release. `parsed` is parseChangelog output. */
export function buildReleasePosts(parsed) {
  const { version, date, highlights } = parsed;
  const features = countBy(highlights, 'added');
  const fixes = countBy(highlights, 'fixed');
  const facts = [];
  if (features) facts.push(`${features} ${features === 1 ? 'feature' : 'features'}`);
  if (fixes) facts.push(`${fixes} ${fixes === 1 ? 'fix' : 'fixes'}`);
  const headline =
    `OrchestKit v${version} is out (${date}).` + (facts.length ? ` ${facts.join(', ')}.` : '');
  return buildThread({
    headline,
    items: rankHighlights(highlights).map(highlightText),
    link: docsLink(version),
  });
}

/**
 * One digest post for the prereleases of one day. `betas` is a list of
 * { version, highlights } in release order, oldest first.
 */
export function buildBetaDigestPosts(betas, day) {
  if (!betas.length) return [];
  const latest = betas[betas.length - 1].version;
  const versions =
    betas.length === 1 ? `v${latest}` : `v${betas[0].version} to v${latest}`;
  const total = betas.reduce((n, b) => n + b.highlights.length, 0);
  const headline =
    `Today in OrchestKit beta (${day}): ${betas.length} ${betas.length === 1 ? 'release' : 'releases'}, ` +
    `${versions}, ${total} ${total === 1 ? 'change' : 'changes'}.`;
  // The digest is one post. It names the top 3 changes and links the rest.
  const all = betas.flatMap((b) => b.highlights);
  return buildThread({
    headline,
    items: rankHighlights(all).map(highlightText).slice(0, 3),
    link: docsLink(latest),
    headCount: 3,
  });
}

/**
 * Posts for one new upstream changelog section.
 * `bullets` is the raw section body; `label` names the product.
 */
export function buildUpstreamPosts({ label, version, body, link, hashtag = HASHTAG, maxReplies = 5 }) {
  const items = String(body)
    .split('\n')
    .filter((l) => /^\s*[-*]\s+/.test(l) && !/^\s{2,}/.test(l))
    .map(cleanItem)
    .filter(Boolean);
  const headline = `${label} ${version} changelog: ${items.length} ${items.length === 1 ? 'entry' : 'entries'}.`;
  return buildThread({ headline, items, link, hashtag, maxReplies });
}

/** True when every post is within the limit. */
export function allWithinLimit(posts) {
  return posts.every((p) => weightedLength(p) <= MAX_POST);
}
