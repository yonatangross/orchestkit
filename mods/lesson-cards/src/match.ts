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

/** Expand every closed {a,b} group into one pattern per alternative. */
function expandBraces(pattern: string): string[] {
  const open = pattern.indexOf('{');
  if (open === -1) return [pattern];
  const close = pattern.indexOf('}', open + 1);
  if (close === -1) return [pattern];
  const head = pattern.slice(0, open);
  const tail = pattern.slice(close + 1);
  return pattern
    .slice(open + 1, close)
    .split(',')
    .flatMap(part => expandBraces(head + part + tail));
}

/**
 * Simple glob pattern matching.
 * Supports:
 * - * matches any sequence of characters (except /)
 * - ** matches any sequence including /
 * - ? matches single character
 * - {a,b} alternatives (one flat group per brace pair)
 * - literal characters match themselves
 */
function simpleGlobMatch(str: string, pattern: string): boolean {
  // {a,b} alternatives, as the hq-ext guard reads them (matchesFileGlob): one
  // flat group, no nesting; a { with no closing } stays a literal character.
  const alternatives = expandBraces(pattern);
  if (alternatives.length > 1 || alternatives[0] !== pattern) {
    return alternatives.some(alt => simpleGlobMatch(str, alt));
  }

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
  const normalized = filePath.replace(/\\/g, '/');
  // The corpus writes plain substrings ("/tests/", ".md", "/configs/"); an
  // entry with glob characters keeps the glob reading.
  return pattern.exclude_paths.some(ex =>
    /[*?[]/.test(ex) ? simpleGlobMatch(filePath, ex) : normalized.includes(ex.replace(/\\/g, '/')),
  );
}

/**
 * Match a Bash command against patterns.
 *
 * Steps:
 * 1. Blank quoted content and heredoc bodies for shell-faithful matching
 * 2. Require an explicit Bash tool name
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
    if (!pat.tool_names?.includes('Bash')) {
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
 * The content test of a corpus file entry, read the way the hq-ext guard
 * (pretool-lesson-guard evalSimple / evalWindowCheck) reads it:
 * - simple (pattern): the regex with flag m against the whole content.
 * - window-check (trigger_pattern): each line is tested alone, and a trigger
 *   line fires only when require_pattern is absent from the window_lines
 *   lines on both sides of it. No require_pattern means the trigger decides.
 * An invalid regex never fires.
 */
function contentFires(pat: LessonPattern, content: string): boolean {
  try {
    if (pat.trigger_pattern) {
      const trigger = new RegExp(pat.trigger_pattern);
      const required = pat.require_pattern ? new RegExp(pat.require_pattern) : null;
      const span = pat.window_lines ?? 0;
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (!trigger.test(lines[i])) continue;
        if (!required) return true;
        const window = lines.slice(Math.max(0, i - span), Math.min(lines.length, i + span + 1)).join('\n');
        if (!required.test(window)) return true;
      }
      return false;
    }
    return new RegExp(pat.pattern as string, 'm').test(content);
  } catch {
    return false;
  }
}

/**
 * The two typed corpus kinds that carry their own rule, read the way the
 * hq-ext guard reads them (evalBlockCheck, evalDockerfileCheck). The path
 * must END with file_match; the content then decides.
 * - block-check: block_pattern captures a region (group 1, else the whole
 *   match) and check_patterns are tested against that region only.
 * - dockerfile-check: each `uv pip install ... -e /app/packages/<pkg>` needs
 *   a `COPY --from=builder /app/packages/<pkg>/src` in the same file.
 * An invalid regex never fires.
 */
function typedCheckFires(pat: LessonPattern, filePath: string, content: string): boolean {
  if (!pat.file_match || !filePath.endsWith(pat.file_match)) return false;
  try {
    if (pat.type === 'block-check') {
      if (!pat.block_pattern) return false;
      const block = content.match(new RegExp(pat.block_pattern));
      if (!block) return false;
      const body = block[1] || block[0];
      return (pat.check_patterns ?? []).some(check => new RegExp(check).test(body));
    }
    const editable = /uv pip install[^\n]*-e\s+\/app\/packages\/([\w-]+)\/?/g;
    for (const found of content.matchAll(editable)) {
      if (!new RegExp(`COPY\\s+--from=builder\\s+/app/packages/${found[1]}/src`).test(content)) return true;
    }
    return false;
  } catch {
    return false;
  }
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
  toolName: 'Edit' | 'Write',
  currentRepo?: string
): MatchedLesson[] {
  const matches: MatchedLesson[] = [];

  for (const pat of patterns) {
    // Check tool_names filter
    if (pat.tool_names && !pat.tool_names.includes(toolName)) {
      continue;
    }

    // Check repo filter
    if (!repoAllowed(pat, currentRepo)) {
      continue;
    }

    // block-check and dockerfile-check carry their own rule; the generic
    // glob, exclude and check_patterns steps below do not apply to them.
    if (pat.type === 'block-check' || pat.type === 'dockerfile-check') {
      if (typedCheckFires(pat, filePath, content)) {
        matches.push({ id: pat.id, severity: pat.severity, message: pat.message, fix: pat.example_fix, source: 'pattern' });
      }
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
    } else if (pat.pattern || pat.trigger_pattern) {
      // A present content test decides, with or without a file filter, as in
      // the guard. The glob alone would fire on every matching file. A Bash-only
      // entry never gets here: its tool_names stops it at the top of the loop.
      if (!contentFires(pat, content)) {
        continue;
      }
    } else if (!pat.file_glob && !pat.file_match) {
      // No file filter and no content test, skip
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

  // Block before warn (stable within a severity): callers act on matches[0],
  // so corpus order must never let a warn hide a block (estate-6 HOLD on #4429).
  return bySeverity(matches);
}

/** Severity rank: block first. */
const SEVERITY_RANK: Record<MatchedLesson['severity'], number> = { block: 0, warn: 1 };

/** Stable sort of matches, block before warn. */
export function bySeverity(matches: MatchedLesson[]): MatchedLesson[] {
  return matches
    .map((m, i) => ({ m, i }))
    .sort((a, b) => SEVERITY_RANK[a.m.severity] - SEVERITY_RANK[b.m.severity] || a.i - b.i)
    .map(({ m }) => m);
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
