/**
 * Naming Convention Learner - Learn project naming conventions from written code
 * Hook: PostToolUse/Write (#134)
 * CC 2.1.7 Compliant
 *
 * Tracks:
 * - Variable naming (camelCase, snake_case, PascalCase, SCREAMING_CASE)
 * - Function naming patterns
 * - Class naming patterns
 * - File naming conventions
 * - Constant naming
 *
 * Storage: .claude/feedback/naming-conventions.json
 * Memory Fabric v2.1: Cross-project learning via patterns queue
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../../types.js';
import { outputSilentSuccess, getField, getProjectDir, logHook } from '../../lib/common.js';

type NamingCase = 'camelCase' | 'snake_case' | 'PascalCase' | 'SCREAMING_SNAKE_CASE' | 'private_snake_case' | 'dunder' | 'mixed' | 'unknown';

interface NamingProfile {
  version: string;
  last_updated: string | null;
  samples_count: number;
  languages: Record<string, LanguageNamingProfile>;
  file_naming: Record<string, number>;
  detected_patterns: {
    functions: Record<string, number>;
    classes: Record<string, number>;
    variables: Record<string, number>;
    constants: Record<string, number>;
    types: Record<string, number>;
  };
}

interface LanguageNamingProfile {
  samples: number;
  functions: Record<NamingCase, number>;
  classes: Record<NamingCase, number>;
  variables: Record<NamingCase, number>;
  constants: Record<NamingCase, number>;
  types: Record<NamingCase, number>;
}

const CODE_EXTENSIONS = ['py', 'ts', 'tsx', 'js', 'jsx', 'go', 'rs', 'java'];

/**
 * Detect naming case from an identifier
 */
function detectCase(name: string): NamingCase {
  if (name.length < 2 || /^[_0-9]+$/.test(name)) {
    return 'unknown';
  }

  if (/^[A-Z][A-Z0-9_]*$/.test(name)) {
    return 'SCREAMING_SNAKE_CASE';
  }
  if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
    return 'PascalCase';
  }
  if (/^[a-z][a-zA-Z0-9]*$/.test(name) && !name.includes('_')) {
    return 'camelCase';
  }
  if (/^[a-z][a-z0-9_]*$/.test(name)) {
    return 'snake_case';
  }
  if (/^_[a-z][a-z0-9_]*$/.test(name)) {
    return 'private_snake_case';
  }
  if (/^__[a-z][a-z0-9_]*__$/.test(name)) {
    return 'dunder';
  }

  return 'mixed';
}

/**
 * Extract Python identifiers from code
 */
function extractPythonIdentifiers(content: string): {
  functions: string[];
  classes: string[];
  variables: string[];
  constants: string[];
} {
  const functions = (content.match(/def ([a-zA-Z_][a-zA-Z0-9_]*)/g) || [])
    .map(m => m.replace('def ', ''));

  const classes = (content.match(/class ([A-Za-z_][a-zA-Z0-9_]*)/g) || [])
    .map(m => m.replace('class ', ''));

  const variables = (content.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=/gm) || [])
    .map(m => m.replace(/\s*=.*/, '').trim());

  const constants = (content.match(/^([A-Z][A-Z0-9_]*)\s*=/gm) || [])
    .map(m => m.replace(/\s*=.*/, '').trim());

  return { functions, classes, variables, constants };
}

/**
 * Extract TypeScript/JavaScript identifiers from code
 */
function extractJsIdentifiers(content: string): {
  functions: string[];
  classes: string[];
  variables: string[];
  interfaces: string[];
  types: string[];
} {
  const functions = [
    ...(content.match(/(function|async function) ([a-zA-Z_][a-zA-Z0-9_]*)/g) || [])
      .map(m => m.replace(/(async )?function /, '')),
    ...(content.match(/const ([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\(/g) || [])
      .map(m => m.replace(/const /, '').replace(/\s*=.*/, '')),
  ];

  const classes = (content.match(/class ([A-Za-z_][a-zA-Z0-9_]*)/g) || [])
    .map(m => m.replace('class ', ''));

  const interfaces = (content.match(/interface ([A-Za-z_][a-zA-Z0-9_]*)/g) || [])
    .map(m => m.replace('interface ', ''));

  const types = (content.match(/type ([A-Za-z_][a-zA-Z0-9_]*)/g) || [])
    .map(m => m.replace('type ', ''));

  const variables = (content.match(/(const|let|var) ([a-zA-Z_][a-zA-Z0-9_]*)/g) || [])
    .map(m => m.replace(/(const|let|var) /, ''));

  return { functions, classes, variables, interfaces, types };
}

/**
 * Count naming cases for a list of identifiers
 */
function countCases(identifiers: string[]): Record<NamingCase, number> {
  const counts: Record<NamingCase, number> = {
    camelCase: 0,
    snake_case: 0,
    PascalCase: 0,
    SCREAMING_SNAKE_CASE: 0,
    private_snake_case: 0,
    dunder: 0,
    mixed: 0,
    unknown: 0,
  };

  for (const name of identifiers) {
    if (!name) continue;
    const caseType = detectCase(name);
    counts[caseType]++;
  }

  return counts;
}

/**
 * Detect file naming convention from file path
 */
function detectFileNaming(filePath: string): string {
  const filename = filePath.split('/').pop() || '';
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');

  if (/^[a-z][a-z0-9_]*$/.test(nameWithoutExt)) {
    return 'snake_case';
  }
  if (/^[a-z][a-z0-9-]*$/.test(nameWithoutExt)) {
    return 'kebab-case';
  }
  if (/^[A-Z][a-zA-Z0-9]*$/.test(nameWithoutExt)) {
    return 'PascalCase';
  }
  if (/^[a-z][a-zA-Z0-9]*$/.test(nameWithoutExt)) {
    return 'camelCase';
  }

  return 'mixed';
}

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
 * Load or initialize naming profile
 */
function loadProfile(profilePath: string): NamingProfile {
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
    file_naming: {},
    detected_patterns: {
      functions: {},
      classes: {},
      variables: {},
      constants: {},
      types: {},
    },
  };
}

/**
 * Initialize language profile
 */
function initLanguageProfile(): LanguageNamingProfile {
  return {
    samples: 0,
    functions: { camelCase: 0, snake_case: 0, PascalCase: 0, SCREAMING_SNAKE_CASE: 0, private_snake_case: 0, dunder: 0, mixed: 0, unknown: 0 },
    classes: { camelCase: 0, snake_case: 0, PascalCase: 0, SCREAMING_SNAKE_CASE: 0, private_snake_case: 0, dunder: 0, mixed: 0, unknown: 0 },
    variables: { camelCase: 0, snake_case: 0, PascalCase: 0, SCREAMING_SNAKE_CASE: 0, private_snake_case: 0, dunder: 0, mixed: 0, unknown: 0 },
    constants: { camelCase: 0, snake_case: 0, PascalCase: 0, SCREAMING_SNAKE_CASE: 0, private_snake_case: 0, dunder: 0, mixed: 0, unknown: 0 },
    types: { camelCase: 0, snake_case: 0, PascalCase: 0, SCREAMING_SNAKE_CASE: 0, private_snake_case: 0, dunder: 0, mixed: 0, unknown: 0 },
  };
}

/**
 * Learn naming conventions from written files
 */
export function namingConventionLearner(input: HookInput): HookResult {
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
        // Read first 150 lines
        content = readFileSync(fullPath, 'utf8').split('\n').slice(0, 150).join('\n');
      } catch {
        return outputSilentSuccess();
      }
    }
  }

  if (!content) {
    return outputSilentSuccess();
  }

  // Detect file naming convention
  const fileNaming = detectFileNaming(filePath);

  // Extract identifiers based on language
  let funcCases: Record<NamingCase, number> = countCases([]);
  let classCases: Record<NamingCase, number> = countCases([]);
  let varCases: Record<NamingCase, number> = countCases([]);
  let constCases: Record<NamingCase, number> = countCases([]);
  let typeCases: Record<NamingCase, number> = countCases([]);

  switch (language) {
    case 'python': {
      const ids = extractPythonIdentifiers(content);
      funcCases = countCases(ids.functions);
      classCases = countCases(ids.classes);
      varCases = countCases(ids.variables);
      constCases = countCases(ids.constants);
      break;
    }
    case 'typescript':
    case 'javascript': {
      const ids = extractJsIdentifiers(content);
      funcCases = countCases(ids.functions);
      classCases = countCases(ids.classes);
      varCases = countCases(ids.variables);
      typeCases = countCases([...ids.interfaces, ...ids.types]);
      break;
    }
  }

  // Load and update profile
  const projectDir = getProjectDir();
  const profilePath = `${projectDir}/.claude/feedback/naming-conventions.json`;

  try {
    mkdirSync(`${projectDir}/.claude/feedback`, { recursive: true });
    const profile = loadProfile(profilePath);

    // Update profile
    profile.last_updated = new Date().toISOString();
    profile.samples_count++;

    // Update file naming counts
    profile.file_naming[fileNaming] = (profile.file_naming[fileNaming] || 0) + 1;

    // Initialize language entry if needed
    if (!profile.languages[language]) {
      profile.languages[language] = initLanguageProfile();
    }

    const lang = profile.languages[language];
    lang.samples++;

    // Update naming case counts
    for (const caseType of Object.keys(funcCases) as NamingCase[]) {
      lang.functions[caseType] = (lang.functions[caseType] || 0) + funcCases[caseType];
      lang.classes[caseType] = (lang.classes[caseType] || 0) + classCases[caseType];
      lang.variables[caseType] = (lang.variables[caseType] || 0) + varCases[caseType];
      lang.constants[caseType] = (lang.constants[caseType] || 0) + constCases[caseType];
      lang.types[caseType] = (lang.types[caseType] || 0) + typeCases[caseType];
    }

    writeFileSync(profilePath, JSON.stringify(profile, null, 2));
  } catch (error) {
    logHook('naming-convention-learner', `Error updating profile: ${error}`);
  }

  logHook('naming-convention-learner', `Analyzed ${language} file (${filePath}): file=${fileNaming}`);

  return outputSilentSuccess();
}
