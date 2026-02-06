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

// ---------- Parse ----------

function parseChangelog(content, targetVersion) {
  const lines = content.split("\n");

  let currentVersion = null;
  let currentDate = null;
  let currentCategory = null;
  let inTargetVersion = false;
  const highlights = [];
  const rawLines = [];

  for (const line of lines) {
    // Match version header: ## [6.0.2] - 2026-02-06
    const versionMatch = line.match(
      /^## \[([^\]]+)\]\s*-\s*(\d{4}-\d{2}-\d{2})/,
    );
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

    // Match section: ### Added / ### Changed / ### Fixed
    const sectionMatch = line.match(/^### (Added|Changed|Fixed)/i);
    if (sectionMatch) {
      const section = sectionMatch[1].toLowerCase();
      if (section === "added" || section === "changed" || section === "fixed") {
        currentCategory = section;
      }
      continue;
    }

    // Match section separator
    if (line.trim() === "---") break;

    // Match bullet entries: - **#NNN (label)**: Description
    //                    or: - Description
    if (currentCategory && line.match(/^- /)) {
      const text = line.replace(/^- /, "").trim();
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

  const landscape = {
    version: parsed.version,
    date: formatDate(parsed.date),
    highlights: landscapeHighlights,
    statsBefore: { skills: 0, agents: 0, hooks: 0 },
    statsAfter: { skills: 0, agents: 0, hooks: 0 },
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
  } else {
    // Scan full changelog for "N agents" and take the most common large value
    const fullText = parsed.fullContent;
    const allAgentMentions = [...fullText.matchAll(/(\d+)\s+agents/g)];
    if (allAgentMentions.length > 0) {
      // Count frequency of each value, pick the most frequent (likely the total)
      const freq = {};
      for (const m of allAgentMentions) {
        const n = parseInt(m[1]);
        if (n >= 20) freq[n] = (freq[n] || 0) + 1; // Filter out small subsets
      }
      const entries = Object.entries(freq);
      if (entries.length > 0) {
        entries.sort((a, b) => b[1] - a[1]); // Most frequent first
        const count = parseInt(entries[0][0]);
        landscape.statsBefore.agents = count;
        landscape.statsAfter.agents = count;
      }
    }
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
