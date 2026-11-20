/**
 * Shared YAML frontmatter parser for OrchestKit build scripts.
 *
 * Extracted from generate-docs-data.js for reuse across:
 *   - generate-docs-data.js (docs site data)
 *   - generate-indexes.js (passive agent/skill indexes)
 *
 * Handles: simple key/value, inline arrays [a, b], multi-line arrays (- item),
 * quoted strings, booleans, multiline scalars (| / > / >- / |-), and one level
 * of nested mapping (`experimental:` followed by indented `cacheTtl: 1h`
 * lines, the CC 2.1.248 agent-frontmatter shape). Before that case was added
 * a nested mapping parsed as an empty array and every sub-key was dropped.
 */

'use strict';

/**
 * Parse YAML frontmatter from markdown content.
 * @param {string} content - Raw markdown file content
 * @returns {{ frontmatter: Record<string, any>, body: string }}
 */
function parseYamlFrontmatter(content) {
  const lines = content.split('\n');
  if (lines[0] !== '---') {
    return { frontmatter: {}, body: content };
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterLines = lines.slice(1, endIndex);
  const body = lines.slice(endIndex + 1).join('\n');
  const frontmatter = {};

  let currentKey = null;
  let inArray = false;
  let inScalar = false; // Track multiline scalar (> / | / >- / |-)

  for (const line of frontmatterLines) {
    // YAML comment lines carry no data at any indentation.
    if (/^\s*#/.test(line)) continue;

    // If we're collecting a multiline scalar, check if this is a continuation
    if (inScalar && currentKey) {
      // Continuation lines are indented (start with whitespace)
      if (line.match(/^\s+/) && !line.match(/^[a-zA-Z0-9_-]+:/)) {
        const text = line.trim();
        if (text) {
          frontmatter[currentKey] = frontmatter[currentKey]
            ? frontmatter[currentKey] + ' ' + text
            : text;
        }
        continue;
      } else {
        // Non-indented line — scalar ended, fall through to normal parsing
        inScalar = false;
      }
    }

    // Check for a nested mapping line (`  subKey: value` under a bare `key:`).
    // Only one level deep; deeper structures are not used in this repo.
    const nested = line.match(/^\s+([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (nested && inArray && currentKey && !inScalar) {
      const container = frontmatter[currentKey];
      if (Array.isArray(container) && container.length > 0) {
        // A `- item` array already started; an indented key here is not ours.
        continue;
      }
      if (Array.isArray(container)) frontmatter[currentKey] = {};
      let value = nested[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      frontmatter[currentKey][nested[1]] = value;
      continue;
    }

    // Check for array item
    if (line.match(/^\s+-\s+/)) {
      if (inArray && currentKey) {
        let value = line.replace(/^\s+-\s+/, '').trim();
        // Remove surrounding quotes from array items
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!Array.isArray(frontmatter[currentKey])) {
          frontmatter[currentKey] = [];
        }
        frontmatter[currentKey].push(value);
      }
      continue;
    }

    // Check for key: value pair
    const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (match) {
      currentKey = match[1];
      let value = match[2].trim();

      // Handle inline arrays [item1, item2]
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(s => s.trim());
        frontmatter[currentKey] = value;
        inArray = false;
        inScalar = false;
      } else if (value === '' || value === '|' || value === '>' || value === '>-' || value === '|-' || value === '>+' || value === '|+') {
        // Multiline indicator: could be array (- items) or folded scalar (indented lines)
        // We'll detect which on the next line
        if (value === '>' || value === '>-' || value === '|-' || value === '|' || value === '>+' || value === '|+') {
          // Folded/literal scalar — collect indented continuation lines as string
          inScalar = true;
          inArray = false;
          frontmatter[currentKey] = '';
        } else {
          // Empty value — could be array start
          inArray = true;
          inScalar = false;
          frontmatter[currentKey] = [];
        }
      } else {
        // Simple value
        // Remove surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        // Convert booleans
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        frontmatter[currentKey] = value;
        inArray = false;
        inScalar = false;
      }
    }
  }

  liftHouseKeys(frontmatter);
  return { frontmatter, body };
}

/**
 * House keys that G1 does not allow at top level live under `metadata:` as
 * strings: the skill keys from m1 (scripts/migrate-skill-frontmatter-m1.py)
 * and the agent keys from m3 (scripts/migrate-agent-frontmatter-m3.py). Lift
 * them back to the top level so every caller keeps reading `frontmatter.tags`,
 * `frontmatter.category` and friends unchanged. A top-level value, when
 * present, wins. The value is the separator a list was joined with under
 * metadata (the key is an array to callers), or null for a plain string.
 * examplePrompts joins on "|" because a prompt may itself hold commas.
 */
const LIFT_SEPARATORS = {
  version: null,
  author: null,
  complexity: null,
  tags: ',',
  category: null,
  critical_system_reminder: null,
  taskTypes: ',',
  keywords: ',',
  required_mcp_servers: ',',
  examplePrompts: '|',
};
const LIFTED_HOUSE_KEYS = Object.keys(LIFT_SEPARATORS);

function liftHouseKeys(frontmatter) {
  const meta = frontmatter.metadata;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return;
  for (const key of LIFTED_HOUSE_KEYS) {
    if (frontmatter[key] !== undefined || typeof meta[key] !== 'string') continue;
    const sep = LIFT_SEPARATORS[key];
    frontmatter[key] = sep
      ? meta[key].split(sep).map(s => s.trim()).filter(Boolean)
      : meta[key];
  }
}

module.exports = { parseYamlFrontmatter, LIFTED_HOUSE_KEYS };

// CLI for shell tests: `node parse-frontmatter.js <file> <key>` prints the
// parsed value (strings as is, anything else as JSON) or nothing when absent.
if (require.main === module) {
  const [file, key] = process.argv.slice(2);
  if (!file || !key) {
    console.error('usage: parse-frontmatter.js <file> <key>');
    process.exit(2);
  }
  const { frontmatter } = parseYamlFrontmatter(require('fs').readFileSync(file, 'utf-8'));
  const val = frontmatter[key];
  if (val !== undefined && val !== null && val !== '') {
    process.stdout.write((typeof val === 'string' ? val : JSON.stringify(val)) + '\n');
  }
}
