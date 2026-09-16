/**
 * Pattern matcher for lesson-cards.
 *
 * Pure matching logic:
 * - For Bash: blank heredoc bodies and quoted strings first, then run pattern table
 * - For Edit/Write: match file_path against file_glob, content against check_patterns
 *
 * No external dependencies - uses simple glob matching.
 */

import type { LessonPattern, LessonBullet } from './corpus.js';
import type { MatchedLesson } from './types.js';

/**
 * Simple glob pattern matching.
 * Supports:
 * - * matches any sequence of characters (except /)
 * - ** matches any sequence including /
 * - ? matches single character
 * - literal characters match themselves
 */
function simpleGlobMatch(str: string, pattern: string): boolean {
  // Normalize pattern and string
  const normalizedStr = str.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');

  // Split pattern into segments
  const patternParts = normalizedPattern.split('/');
  const strParts = normalizedStr.split('/');

  let patternIdx = 0;
  let strIdx = 0;

  while (patternIdx < patternParts.length && strIdx < strParts.length) {
    const patPart = patternParts[patternIdx];
    const strPart = strParts[strIdx];

    if (patPart === '**') {
      // ** matches zero or more path segments
      patternIdx++;

      // If this is the last pattern part, it matches everything remaining
      if (patternIdx >= patternParts.length) {
        return true;
      }

      // Try to match the remaining pattern at each position
      while (strIdx <= strParts.length) {
        const remainingStr = strParts.slice(strIdx).join('/');
        const remainingPat = patternParts.slice(patternIdx).join('/');
        if (simpleGlobMatch(remainingStr, remainingPat)) {
          return true;
        }
        strIdx++;
      }
      return false;
    } else {
      // Match single segment
      if (!segmentMatch(strPart, patPart)) {
        return false;
      }
      patternIdx++;
      strIdx++;
    }
  }

  // Handle trailing ** that can match zero segments
  while (patternIdx < patternParts.length && patternParts[patternIdx] === '**') {
    patternIdx++;
  }

  return patternIdx === patternParts.length && strIdx === strParts.length;
}

/**
 * Match a single path segment against a pattern.
 */
function segmentMatch(segment: string, pattern: string): boolean {
  if (pattern === '*') {
    return true;
  }

  // Simple pattern matching for single segment
  let si = 0;
  let pi = 0;

  while (si < segment.length && pi < pattern.length) {
    const pc = pattern[pi];

    if (pc === '*') {
      // * matches zero or more characters
      pi++;
      // Skip * and try to match rest
      while (si <= segment.length) {
        if (segmentMatch(segment.slice(si), pattern.slice(pi))) {
          return true;
        }
        si++;
      }
      return false;
    } else if (pc === '?') {
      // ? matches exactly one character
      si++;
      pi++;
    } else if (segment[si] === pc) {
      si++;
      pi++;
    } else {
      return false;
    }
  }

  // Skip remaining * in pattern
  while (pi < pattern.length && pattern[pi] === '*') {
    pi++;
  }

  return si === segment.length && pi === pattern.length;
}

/**
 * Blank out quoted strings for shell-faithful matching.
 * Prevents patterns from matching content inside quotes.
 */
export function blankQuotedContent(cmd: string): string {
  // Single-quoted strings: no escaping inside
  let result = cmd.replace(/'[^']*'/g, "''");
  // Double-quoted strings: handle escaped quotes
  result = result.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  return result;
}

/**
 * Blank out quoted heredoc bodies.
 * Quoted heredoc delimiters (<<'EOF') disable expansion in the body.
 */
export function blankQuotedHeredocBodies(cmd: string): string {
  // <<'DELIM' or <<"DELIM" followed by body until DELIM on its own line
  return cmd.replace(
    /(<<-?\s*(['"])([A-Za-z_][A-Za-z0-9_]{0,63})\2)([\s\S]{0,20000}?)(^[ \t]*\3[ \t]*$)/gm,
    (_m, open: string, _q: string, _delim: string, _body: string, close: string) =>
      `${open}\n${close}`,
  );
}

/**
 * Check if a repo is allowed by the pattern's repos filter.
 */
function repoAllowed(pattern: LessonPattern, currentRepo?: string): boolean {
  if (!pattern.repos || pattern.repos.length === 0) {
    return true; // No repo filter, matches all
  }
  if (!currentRepo) {
    return false; // Pattern has repos filter but we don't know current repo
  }
  return pattern.repos.some(r => {
    // Support owner/repo format
    if (r.includes('/')) {
      return currentRepo === r || simpleGlobMatch(currentRepo, r);
    }
    // Just repo name
    return currentRepo.endsWith('/' + r) || currentRepo === r;
  });
}

/**
 * Check if a path is excluded by the pattern's exclude_paths.
 */
function pathExcluded(pattern: LessonPattern, filePath: string): boolean {
  if (!pattern.exclude_paths || pattern.exclude_paths.length === 0) {
    return false;
  }
  return pattern.exclude_paths.some(ex => simpleGlobMatch(filePath, ex));
}

/**
 * Match a Bash command against patterns.
 *
 * Steps:
 * 1. Blank quoted content and heredoc bodies for shell-faithful matching
 * 2. Check tool_names filter if present
 * 3. Check trigger_pattern or pattern
 * 4. If block_pattern is set, must also match that (for guard patterns)
 */
export function matchBashCommand(
  command: string,
  patterns: LessonPattern[],
  currentRepo?: string
): MatchedLesson[] {
  const matches: MatchedLesson[] = [];

  // Blank quoted heredoc bodies first (before quoted strings break delimiter detection)
  // then blank quoted strings for shell-faithful matching
  const blankedCommand = blankQuotedContent(blankQuotedHeredocBodies(command));
  const targetText = blankedCommand.toLowerCase();

  for (const pat of patterns) {
    // Check tool_names filter
    if (pat.tool_names && !pat.tool_names.includes('Bash')) {
      continue;
    }

    // Check repo filter
    if (!repoAllowed(pat, currentRepo)) {
      continue;
    }

    // Check trigger_pattern or pattern
    const triggerRegex = pat.trigger_pattern || pat.pattern;
    if (!triggerRegex) {
      continue;
    }

    // Create regex from pattern string
    let regex: RegExp;
    try {
      regex = new RegExp(triggerRegex, 'i');
    } catch {
      // Invalid regex, skip
      continue;
    }

    if (!regex.test(targetText)) {
      continue;
    }

    // If block_pattern is set, this is a guard pattern that needs both conditions
    if (pat.block_pattern) {
      let blockRegex: RegExp;
      try {
        blockRegex = new RegExp(pat.block_pattern, 'i');
      } catch {
        continue;
      }
      if (!blockRegex.test(targetText)) {
        continue;
      }
    }

    matches.push({
      id: pat.id,
      severity: pat.severity,
      message: pat.message,
      fix: pat.example_fix,
      source: 'pattern',
    });
  }

  return matches;
}

/**
 * Match Edit/Write args against patterns.
 *
 * Checks file_path against file_glob and new content against check_patterns.
 */
export function matchFileEdit(
  filePath: string,
  content: string,
  patterns: LessonPattern[],
  currentRepo?: string
): MatchedLesson[] {
  const matches: MatchedLesson[] = [];

  for (const pat of patterns) {
    // Check tool_names filter
    if (pat.tool_names && !pat.tool_names.includes('Edit') && !pat.tool_names.includes('Write')) {
      continue;
    }

    // Check repo filter
    if (!repoAllowed(pat, currentRepo)) {
      continue;
    }

    // Check file_glob filter
    if (pat.file_glob) {
      if (!simpleGlobMatch(filePath, pat.file_glob)) {
        continue;
      }
    }

    // Check exclude_paths
    if (pathExcluded(pat, filePath)) {
      continue;
    }

    // Check file_match pattern if present
    if (pat.file_match) {
      let fileMatchRegex: RegExp;
      try {
        fileMatchRegex = new RegExp(pat.file_match, 'i');
      } catch {
        continue;
      }
      if (!fileMatchRegex.test(filePath)) {
        continue;
      }
    }

    // Check check_patterns against content
    if (pat.check_patterns && pat.check_patterns.length > 0) {
      let matchedAny = false;
      for (const checkPat of pat.check_patterns) {
        let checkRegex: RegExp;
        try {
          checkRegex = new RegExp(checkPat, 'i');
        } catch {
          continue;
        }
        if (checkRegex.test(content)) {
          matchedAny = true;
          break;
        }
      }
      if (!matchedAny) {
        continue;
      }
    } else if (!pat.file_glob && !pat.file_match) {
      // No file filter and no check_patterns, skip
      continue;
    }

    matches.push({
      id: pat.id,
      severity: pat.severity,
      message: pat.message,
      fix: pat.example_fix,
      source: 'pattern',
    });
  }

  return matches;
}

/**
 * Match a Bash command against lessons.md bullets.
 *
 * Bullets are indexed by their first few command tokens.
 * Returns at most one bullet match (advisory, grey).
 */
export function matchLessonsBullet(
  command: string,
  bullets: LessonBullet[]
): MatchedLesson | null {
  const tokens = command.trim().split(/\s+/).slice(0, 3);
  if (tokens.length === 0) {
    return null;
  }

  // Find bullet whose tokens match our command tokens
  for (const bullet of bullets) {
    const bulletTokens = bullet.tokens;
    if (bulletTokens.length === 0) {
      continue;
    }

    // Check if command starts with bullet's indexed tokens
    let matches = true;
    for (let i = 0; i < bulletTokens.length && i < tokens.length; i++) {
      if (tokens[i].toLowerCase() !== bulletTokens[i].toLowerCase()) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return {
        id: bullet.heading.replace(/\s+/g, '-').toLowerCase(),
        severity: 'warn', // Advisory, grey
        message: bullet.text,
        source: 'bullet',
      };
    }
  }

  return null;
}

/**
 * Combine pattern matches with bullet matches.
 * Guard pattern match takes priority, capped at one card per call.
 */
export function matchAll(
  command: string,
  patterns: LessonPattern[],
  bullets: LessonBullet[],
  currentRepo?: string
): MatchedLesson[] {
  const patternMatches = matchBashCommand(command, patterns, currentRepo);

  // Guard patterns (severity 'block') take priority
  const blockMatches = patternMatches.filter(m => m.severity === 'block');
  if (blockMatches.length > 0) {
    return [blockMatches[0]]; // Cap at one
  }

  // Warn matches are additive
  const warnMatches = patternMatches.filter(m => m.severity === 'warn');

  // Bullet matches are advisory (grey)
  const bulletMatch = matchLessonsBullet(command, bullets);

  // Combine: warn first, then bullet if no warn
  if (warnMatches.length > 0) {
    return [warnMatches[0]];
  }

  if (bulletMatch) {
    return [bulletMatch];
  }

  return [];
}
