/**
 * Shared YAML frontmatter parser for OrchestKit build scripts.
 *
 * Extracted from generate-docs-data.js for reuse across:
 *   - generate-docs-data.js (docs site data)
 *   - generate-indexes.js (passive agent/skill indexes)
 *
 * Handles: simple key/value, inline arrays [a, b], multi-line arrays (- item),
 * quoted strings, booleans, and multiline scalars (| / > / >- / |-).
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

  return { frontmatter, body };
}

module.exports = { parseYamlFrontmatter };
