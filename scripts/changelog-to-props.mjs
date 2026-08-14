#!/usr/bin/env node
/**
 * changelog-to-props.mjs
 *
 * Parses CHANGELOG.md (Keep a Changelog format) and emits JSON props
 * compatible with the ReleaseNotes Remotion composition schema.
 *
 * Usage:
 *   node scripts/changelog-to-props.mjs [version]
 *
 * If version is omitted, parses the first (latest) release.
 * Output is printed to stdout as JSON.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHANGELOG_PATH = resolve(__dirname, "..", "CHANGELOG.md");
const MANIFEST_PATH = resolve(__dirname, "..", "manifests", "ork.json");

// ---------- Component counts ----------

/**
 * Current component counts, read from the ork manifest description — the same
 * string `bin/validate-counts.sh` asserts against the filesystem, so if CI is
 * green these numbers are correct by construction.
 *
 * Why not the changelog: statsBefore/statsAfter used to default to {0,0,0} and
 * were only ever populated by a `Skill count: 197 → 199` regex that
 * release-please changelogs never emit. Every release since has rendered
 * "0 skills, 0 hooks" into the announce payload AND the release videos
 * (release-video.yml feeds on this script). `agents` looked right only by
 * accident, via a "most frequent N agents" scan of the whole changelog.
 *
 * Returns nulls (never zeros) if the manifest can't be read, so a caller can
 * tell "unknown" from "genuinely zero".
 */
function readDeclaredCounts() {
  try {
    const { description = "" } = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
    const grab = (re) => {
      const m = description.match(re);
      return m ? parseInt(m[1], 10) : null;
    };
    return {
      skills: grab(/(\d+)\s+skills/i),
      agents: grab(/(\d+)\s+agents/i),
      hooks: grab(/(\d+)\s+(?:TypeScript\s+)?hooks/i),
    };
  } catch (e) {
    console.error(`[changelog-to-props] manifest counts unavailable: ${e.message}`);
    return { skills: null, agents: null, hooks: null };
  }
}

// ---------- Parse ----------

// release-please uses conventional-commit section headings; Keep a Changelog
// uses Added / Changed / Fixed. Normalize both to the KAC categories the
// Remotion composition expects.
const SECTION_CATEGORY = {
  added: "added",
  features: "added",
  changed: "changed",
  "performance improvements": "changed",
  reverts: "changed",
  "miscellaneous chores": "changed",
  documentation: "changed",
  "code refactoring": "changed",
  fixed: "fixed",
  "bug fixes": "fixed",
};
const SECTION_RE = new RegExp(
  `^### (${Object.keys(SECTION_CATEGORY).join("|")})\\b`,
  "i",
);

// Version headers in this repo appear in two formats:
//   ## [7.57.1] - 2026-04-20                                (bump-version.sh)
//   ## [7.58.0](https://github.com/.../compare/...) (2026-04-20)   (release-please)
// Match both by making the optional (link) non-capturing and accepting ` - `
// or ` (` as the date delimiter.
const VERSION_HEADER_RE =
  /^## \[([^\]]+)\](?:\([^)]*\))?\s*(?:-|\()\s*(\d{4}-\d{2}-\d{2})/;

function parseChangelog(content, targetVersion) {
  const lines = content.split("\n");

  let currentVersion = null;
  let currentDate = null;
  let currentCategory = null;
  let inTargetVersion = false;
  const highlights = [];
  const rawLines = [];

  for (const line of lines) {
    const versionMatch = line.match(VERSION_HEADER_RE);
    if (versionMatch) {
      if (inTargetVersion) break; // We've passed our target version

      const [, ver, date] = versionMatch;
      if (!targetVersion || ver === targetVersion) {
        currentVersion = ver;
        currentDate = date;
        inTargetVersion = true;
      }
      continue;
    }

    if (!inTargetVersion) continue;
    rawLines.push(line);

    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      currentCategory = SECTION_CATEGORY[sectionMatch[1].toLowerCase()];
      continue;
    }

    // Match section separator
    if (line.trim() === "---") break;

    // Match bullet entries — KAC uses "- ", release-please uses "* ".
    if (currentCategory && line.match(/^[-*] /)) {
      let text = line.replace(/^[-*] /, "").trim();

      // Strip release-please's trailing issue/commit link artifacts:
      //   ... ([#1183](url)) ([7b88cb7](url))
      // They add noise without carrying information video viewers care about.
      text = text.replace(/\s*\(\[[^\]]+\]\([^)]*\)\)/g, "").trim();
      if (!text) continue;

      // Strip optional issue reference prefix: **#NNN (label):**
      const stripped = text.replace(/^\*\*#\d+\s*\([^)]*\)\*\*:\s*/, "");

      // Extract title and description
      let title = "";
      let description = "";

      // Clean markdown from the entry before splitting
      const clean = stripped.replace(/\*\*/g, "").replace(/`/g, "");

      // Strategy 1: If original text starts with backtick-quoted segment
      const backtickMatch = stripped.match(/^`([^`]+)`\s*(.*)/);
      // Strategy 2: If text starts with **bold**: text
      const boldMatch = stripped.match(/^\*\*([^*]+)\*\*:\s*(.*)/);

      if (backtickMatch) {
        title = backtickMatch[1];
        description = (backtickMatch[2] || title)
          .replace(/^[:\u2014\s]+/, "")
          .replace(/\*\*/g, "")
          .replace(/`/g, "")
          .trim();
      } else if (boldMatch) {
        title = boldMatch[1];
        description = boldMatch[2].replace(/\*\*/g, "").replace(/`/g, "").trim();
      } else {
        // Strategy 3: Split on " — " (em-dash with spaces) first
        const emDashIdx = clean.indexOf(" \u2014 ");
        if (emDashIdx > 0) {
          title = clean.slice(0, emDashIdx).trim();
          description = clean.slice(emDashIdx + 3).trim();
        } else {
          // Strategy 4: First clause before " - "
          const dashIdx = clean.indexOf(" - ");
          if (dashIdx > 0 && dashIdx < 80) {
            title = clean.slice(0, dashIdx).trim();
            description = clean.slice(dashIdx + 3).trim();
          } else {
            // Take first 5 words as title
            title = clean.split(/\s+/).slice(0, 5).join(" ");
            description = clean;
          }
        }
      }

      // Clean up markdown artifacts from description
      description = description.replace(/`/g, "").replace(/\*\*/g, "");

      // Cap description length for video readability
      if (description.length > 120) {
        description = description.slice(0, 117) + "...";
      }

      highlights.push({ category: currentCategory, title, description });
    }
  }

  if (!currentVersion) {
    console.error(
      `Error: Version ${targetVersion || "(latest)"} not found in CHANGELOG.md`,
    );
    process.exit(1);
  }

  return { version: currentVersion, date: currentDate, highlights, rawLines, fullContent: content };
}

// ---------- Format date ----------

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${months[month - 1]} ${day}, ${year}`;
}

// ---------- Build props ----------

function buildProps(parsed) {
  // Take top 5 highlights for 16:9, top 3 for square
  const landscapeHighlights = parsed.highlights.slice(0, 5);
  const squareHighlights = parsed.highlights.slice(0, 3);

  // Baseline is the CURRENT declared count, not zero. A release rarely states a
  // delta, so before == after by default and the composition renders a true
  // total instead of "0 skills". An explicit `skills: 105 → 107` in the
  // changelog still wins below.
  const counts = readDeclaredCounts();

  const landscape = {
    version: parsed.version,
    date: formatDate(parsed.date),
    highlights: landscapeHighlights,
    statsBefore: { ...counts },
    statsAfter: { ...counts },
    ctaCommand: "/plugin install ork@latest",
    accentColor: "#2A9D8F",
  };

  const square = {
    ...landscape,
    highlights: squareHighlights,
  };

  // Scan all raw changelog lines for stat delta patterns
  const allText = parsed.rawLines.join("\n");

  // Match "Skill count: 197 → 199" or "skills: 197 → 199"
  const skillMatch = allText.match(
    /[Ss]kill[s]?\s*(?:count)?:?\s*(\d+)\s*→\s*(\d+)/,
  );
  const hookMatch = allText.match(
    /[Hh]ook[s]?\s*(?:count)?:?\s*(\d+)\s*→\s*(\d+)/,
  );
  const agentMatch = allText.match(
    /[Aa]gent[s]?\s*(?:count)?:?\s*(\d+)\s*→\s*(\d+)/,
  );

  if (skillMatch) {
    landscape.statsBefore.skills = parseInt(skillMatch[1]);
    landscape.statsAfter.skills = parseInt(skillMatch[2]);
  }
  if (hookMatch) {
    landscape.statsBefore.hooks = parseInt(hookMatch[1]);
    landscape.statsAfter.hooks = parseInt(hookMatch[2]);
  }
  if (agentMatch) {
    landscape.statsBefore.agents = parseInt(agentMatch[1]);
    landscape.statsAfter.agents = parseInt(agentMatch[2]);
    // The old `else` branch here scanned the WHOLE changelog for "N agents" and
    // took the most frequent value >= 20. It is deleted, not ported: it guessed
    // a current total from historical prose, and only looked right because the
    // agent count has been stable. readDeclaredCounts() is the real source.
  }

  // Copy parsed stats to square
  square.statsBefore = { ...landscape.statsBefore };
  square.statsAfter = { ...landscape.statsAfter };

  return { landscape, square };
}

// ---------- Main ----------

// Parse args: positional version + optional --landscape/--square flag
const args = process.argv.slice(2);
let targetVersion = null;
let format = null;

for (const arg of args) {
  if (arg === "--landscape" || arg === "--square") {
    format = arg;
  } else if (!arg.startsWith("-")) {
    targetVersion = arg;
  }
}

const changelog = readFileSync(CHANGELOG_PATH, "utf-8");
const parsed = parseChangelog(changelog, targetVersion);
const props = buildProps(parsed);

if (format === "--landscape") {
  console.log(JSON.stringify(props.landscape, null, 2));
} else if (format === "--square") {
  console.log(JSON.stringify(props.square, null, 2));
} else {
  // Output both
  console.log(JSON.stringify(props, null, 2));
}
