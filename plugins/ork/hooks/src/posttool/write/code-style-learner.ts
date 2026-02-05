/**
 * Code Style Learner - Learn user's code style preferences from written code
 * Hook: PostToolUse/Write (#133)
 * CC 2.1.7 Compliant
 *
 * Tracks:
 * - Indentation (tabs vs spaces, indent size)
 * - Quote style (single vs double quotes)
 * - Naming patterns (detected from code)
 * - Import order (stdlib first, third-party, local)
 *
 * Storage: .claude/feedback/code-style-profile.json
 * Memory Fabric v2.1: Cross-project learning via patterns queue
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../../types.js';
import { outputSilentSuccess, getField, getProjectDir, logHook } from '../../lib/common.js';

interface StyleProfile {
  version: string;
  last_updated: string | null;
  samples_count: number;
  languages: Record<string, LanguageProfile>;
  global_preferences: {
    indentation: { style: string; size: number; confidence: number };
    quotes: { style: string; confidence: number };
  };
}

interface LanguageProfile {
  samples: number;
  indentation: { tabs: number; spaces_2: number; spaces_4: number };
  quotes: { single: number; double: number };
  semicolons: { always: number; omit: number };
  trailing_comma: { always: number; minimal: number };
  type_hints: { used: number; not_used: number };
  docstring_style: Record<string, number>;
}

const CODE_EXTENSIONS = ['py', 'ts', 'tsx', 'js', 'jsx', 'go', 'rs', 'java'];

/**
 * Get language from file extension
 */
function getLanguage(filePath: string): string | null {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py': return 'python';
    case 'ts':
    case 'tsx': return 'typescript';
    case 'js':
    case 'jsx': return 'javascript';
    case 'go': return 'go';
    case 'rs': return 'rust';
    case 'java': return 'java';
    default: return null;
  }
}

/**
 * Detect indentation style from code content
 */
function detectIndentation(content: string): { style: string; size: number } {
  let tabCount = 0;
  let space2Count = 0;
  let space4Count = 0;

  for (const line of content.split('\n')) {
    if (line.startsWith('\t')) {
      tabCount++;
    } else if (line.startsWith('    ')) {
      space4Count++;
    } else if (line.match(/^  [^ ]/)) {
      space2Count++;
    }
  }

  if (tabCount > space2Count + space4Count) {
    return { style: 'tabs', size: 1 };
  }
  if (space2Count > space4Count) {
    return { style: 'spaces', size: 2 };
  }
  if (space4Count > 0) {
    return { style: 'spaces', size: 4 };
  }

  return { style: 'unknown', size: 4 };
}

/**
 * Detect quote style from code content
 */
function detectQuoteStyle(content: string): string {
  const singleCount = (content.match(/'/g) || []).length;
  const doubleCount = (content.match(/"/g) || []).length;

  return singleCount > doubleCount ? 'single' : 'double';
}

/**
 * Detect semicolon usage (JS/TS)
 */
function detectSemicolonStyle(content: string): string {
  let withSemi = 0;
  let withoutSemi = 0;

  for (const line of content.split('\n')) {
    // Skip empty lines and comments
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    if (/;\s*$/.test(line)) {
      withSemi++;
    } else if (/[a-zA-Z0-9\)\]\'\"]\\s*$/.test(line)) {
      withoutSemi++;
    }
  }

  return withSemi > withoutSemi ? 'always' : 'omit';
}

/**
 * Detect trailing comma preference
 */
function detectTrailingComma(content: string): string {
  const trailingCount = (content.match(/,\s*$/gm) || []).length;
  return trailingCount > 5 ? 'always' : 'minimal';
}

/**
 * Detect Python-specific patterns
 */
function detectPythonPatterns(content: string): { typeHints: boolean; docstringStyle: string } {
  const hasTypeHints = /\) -> |: [A-Z][a-zA-Z]+(\[|$| =)/.test(content);

  let docstringStyle = 'unknown';
  if (/"""[^"]+"""/.test(content)) {
    if (/:param |:returns:|:raises:/.test(content)) {
      docstringStyle = 'sphinx';
    } else if (/Args:|Returns:|Raises:/.test(content)) {
      docstringStyle = 'google';
    } else if (/Parameters|Returns\n-+/.test(content)) {
      docstringStyle = 'numpy';
    } else {
      docstringStyle = 'simple';
    }
  }

  return { typeHints: hasTypeHints, docstringStyle };
}

/**
 * Load or initialize style profile
 */
function loadProfile(profilePath: string): StyleProfile {
  if (existsSync(profilePath)) {
    try {
      return JSON.parse(readFileSync(profilePath, 'utf8'));
    } catch {
      // Invalid JSON, reinitialize
    }
  }

  return {
    version: '1.0.0',
    last_updated: null,
    samples_count: 0,
    languages: {},
    global_preferences: {
      indentation: { style: 'unknown', size: 4, confidence: 0 },
      quotes: { style: 'unknown', confidence: 0 },
    },
  };
}

/**
 * Update style profile with new observations
 */
function updateProfile(
  profile: StyleProfile,
  language: string,
  indentation: { style: string; size: number },
  quoteStyle: string,
  semiStyle: string,
  trailingComma: string,
  typeHints: boolean | null,
  docstringStyle: string
): void {
  profile.last_updated = new Date().toISOString();
  profile.samples_count++;

  // Initialize language profile if needed
  if (!profile.languages[language]) {
    profile.languages[language] = {
      samples: 0,
      indentation: { tabs: 0, spaces_2: 0, spaces_4: 0 },
      quotes: { single: 0, double: 0 },
      semicolons: { always: 0, omit: 0 },
      trailing_comma: { always: 0, minimal: 0 },
      type_hints: { used: 0, not_used: 0 },
      docstring_style: {},
    };
  }

  const lang = profile.languages[language];
  lang.samples++;

  // Update indentation
  if (indentation.style === 'tabs') {
    lang.indentation.tabs++;
  } else if (indentation.size === 2) {
    lang.indentation.spaces_2++;
  } else {
    lang.indentation.spaces_4++;
  }

  // Update quotes
  if (quoteStyle === 'single') {
    lang.quotes.single++;
  } else {
    lang.quotes.double++;
  }

  // Update semicolons (JS/TS only)
  if (semiStyle !== 'unknown') {
    if (semiStyle === 'always') {
      lang.semicolons.always++;
    } else {
      lang.semicolons.omit++;
    }
  }

  // Update trailing comma
  if (trailingComma !== 'unknown') {
    if (trailingComma === 'always') {
      lang.trailing_comma.always++;
    } else {
      lang.trailing_comma.minimal++;
    }
  }

  // Update type hints (Python)
  if (typeHints !== null) {
    if (typeHints) {
      lang.type_hints.used++;
    } else {
      lang.type_hints.not_used++;
    }
  }

  // Update docstring style (Python)
  if (docstringStyle !== 'unknown') {
    lang.docstring_style[docstringStyle] = (lang.docstring_style[docstringStyle] || 0) + 1;
  }
}

/**
 * Learn code style from written files
 */
export function codeStyleLearner(input: HookInput): HookResult {
  const toolName = input.tool_name || '';

  // Guard: Only run for Write/Edit
  if (toolName !== 'Write' && toolName !== 'Edit') {
    return outputSilentSuccess();
  }

  const filePath = getField<string>(input, 'tool_input.file_path') || '';

  // Guard: Skip internal files
  if (!filePath || filePath.includes('/.claude/') ||
      filePath.includes('/node_modules/') ||
      filePath.includes('/.git/') ||
      filePath.includes('/dist/') ||
      filePath.endsWith('.lock')) {
    return outputSilentSuccess();
  }

  // Get file extension to determine language
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  if (!CODE_EXTENSIONS.includes(ext)) {
    return outputSilentSuccess();
  }

  const language = getLanguage(filePath);
  if (!language) {
    return outputSilentSuccess();
  }

  // Try to get file content from tool_input or read the file
  let content = getField<string>(input, 'tool_input.content') || '';

  if (!content) {
    const projectDir = getProjectDir();
    const fullPath = filePath.startsWith('/') ? filePath : `${projectDir}/${filePath}`;

    if (existsSync(fullPath)) {
      try {
        // Read first 100 lines
        content = readFileSync(fullPath, 'utf8').split('\n').slice(0, 100).join('\n');
      } catch {
        return outputSilentSuccess();
      }
    }
  }

  if (!content) {
    return outputSilentSuccess();
  }

  // Analyze the code
  const indentation = detectIndentation(content);
  const quoteStyle = detectQuoteStyle(content);

  let semiStyle = 'unknown';
  let trailingComma = 'unknown';
  let typeHints: boolean | null = null;
  let docstringStyle = 'unknown';

  // Language-specific detection
  switch (language) {
    case 'javascript':
    case 'typescript':
      semiStyle = detectSemicolonStyle(content);
      trailingComma = detectTrailingComma(content);
      break;
    case 'python': {
      const pyPatterns = detectPythonPatterns(content);
      typeHints = pyPatterns.typeHints;
      docstringStyle = pyPatterns.docstringStyle;
      trailingComma = detectTrailingComma(content);
      break;
    }
  }

  // Load and update profile
  const projectDir = getProjectDir();
  const profilePath = `${projectDir}/.claude/feedback/code-style-profile.json`;

  try {
    mkdirSync(`${projectDir}/.claude/feedback`, { recursive: true });
    const profile = loadProfile(profilePath);
    updateProfile(profile, language, indentation, quoteStyle, semiStyle, trailingComma, typeHints, docstringStyle);
    writeFileSync(profilePath, JSON.stringify(profile, null, 2));
  } catch (error) {
    logHook('code-style-learner', `Error updating profile: ${error}`);
  }

  logHook('code-style-learner',
    `Analyzed ${language} file: indent=${indentation.style}(${indentation.size}) quotes=${quoteStyle}`);

  return outputSilentSuccess();
}
