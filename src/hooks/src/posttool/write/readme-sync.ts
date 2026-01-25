/**
 * README Sync Hook for Claude Code
 * After significant code changes, suggests README updates
 * Tracks: new exports, API changes, config changes
 * Hook: PostToolUse (Write)
 * Issue: #140
 */

import { existsSync, statSync, appendFileSync, mkdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../../types.js';
import { outputSilentSuccess, getField, getProjectDir, logHook } from '../../lib/common.js';

interface ChangeAnalysis {
  changeType: string;
  readmeSection: string;
  suggestion: string;
}

/**
 * Analyze file for README-relevant changes
 */
function analyzeFileChange(filePath: string, projectDir: string): ChangeAnalysis | null {
  const filename = filePath.split('/').pop() || '';
  const dirname = filePath.split('/').slice(0, -1).join('/');
  const extLower = (filePath.split('.').pop() || '').toLowerCase();

  // 1. Package configuration files
  switch (filename) {
    case 'package.json':
      if (existsSync(`${projectDir}/${filePath}`)) {
        try {
          const pkg = require(`${projectDir}/${filePath}`);
          const scriptCount = Object.keys(pkg.scripts || {}).length;
          if (scriptCount > 5) {
            return {
              changeType: 'scripts',
              readmeSection: 'Available Scripts',
              suggestion: 'Update README with new npm scripts',
            };
          }
        } catch {
          // Ignore parse errors
        }
      }
      break;

    case 'pyproject.toml':
    case 'setup.py':
    case 'setup.cfg':
      return {
        changeType: 'python-config',
        readmeSection: 'Installation',
        suggestion: 'Verify README installation instructions match project config',
      };

    case 'Dockerfile':
    case 'docker-compose.yml':
    case 'docker-compose.yaml':
      return {
        changeType: 'docker',
        readmeSection: 'Docker / Deployment',
        suggestion: 'Update README Docker instructions',
      };

    case '.env.example':
    case '.env.template':
      return {
        changeType: 'env',
        readmeSection: 'Environment Variables',
        suggestion: 'Update README environment variable documentation',
      };
  }

  // 2. API routes and endpoints
  if (filePath.includes('/api/') || filePath.includes('/routes/') || filePath.includes('/endpoints/')) {
    return {
      changeType: 'api',
      readmeSection: 'API Endpoints',
      suggestion: 'Update README API documentation or OpenAPI spec',
    };
  }

  // 3. Configuration directories
  if (dirname.includes('/config') || dirname.includes('/settings')) {
    return {
      changeType: 'config',
      readmeSection: 'Configuration',
      suggestion: 'Document new configuration options in README',
    };
  }

  // 4. Main entry points / index files
  if (['index.ts', 'index.js', 'main.py', 'app.py', '__init__.py'].includes(filename)) {
    const depth = filePath.split('/').length;
    if (depth <= 4) {
      return {
        changeType: 'entry-point',
        readmeSection: 'Getting Started',
        suggestion: 'Review README getting started section for accuracy',
      };
    }
  }

  // 5. CLI tools and bin scripts
  if (filePath.includes('/bin/') || filePath.includes('/cli/') || filePath.includes('/scripts/')) {
    if (['sh', 'py', 'ts'].includes(extLower)) {
      return {
        changeType: 'cli',
        readmeSection: 'CLI / Commands',
        suggestion: 'Update README CLI usage documentation',
      };
    }
  }

  // 6. Public exports (index files with exports)
  if (filename === 'index.ts' || filename === 'index.js') {
    const fullPath = `${projectDir}/${filePath}`;
    if (existsSync(fullPath)) {
      try {
        const { readFileSync } = require('fs');
        const content = readFileSync(fullPath, 'utf8');
        const exportCount = (content.match(/^export/gm) || []).length;
        if (exportCount > 5) {
          return {
            changeType: 'exports',
            readmeSection: 'API Reference',
            suggestion: 'Consider updating API reference with new exports',
          };
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  return null;
}

/**
 * Find README file in project
 */
function findReadme(projectDir: string): string | null {
  for (const name of ['README.md', 'Readme.md', 'readme.md', 'README.rst', 'README']) {
    if (existsSync(`${projectDir}/${name}`)) {
      return `${projectDir}/${name}`;
    }
  }
  return null;
}

/**
 * Sync README suggestions
 */
export function readmeSync(input: HookInput): HookResult {
  const toolName = input.tool_name || '';

  // Only run for Write tool
  if (toolName !== 'Write') {
    return outputSilentSuccess();
  }

  const filePath = getField<string>(input, 'tool_input.file_path') || '';

  if (!filePath) {
    return outputSilentSuccess();
  }

  // Skip internal files
  if (filePath.includes('/.claude/') ||
      filePath.includes('/node_modules/') ||
      filePath.includes('/.git/') ||
      filePath.includes('/dist/') ||
      filePath.endsWith('.lock') ||
      filePath.endsWith('.log')) {
    return outputSilentSuccess();
  }

  // Skip test files - they don't typically require README updates
  if (filePath.includes('test') || filePath.includes('spec') || filePath.includes('__tests__')) {
    return outputSilentSuccess();
  }

  const projectDir = getProjectDir();

  // Analyze file for README-relevant changes
  const analysis = analyzeFileChange(filePath, projectDir);

  if (!analysis) {
    return outputSilentSuccess();
  }

  // Check if README exists
  const readmePath = findReadme(projectDir);

  let contextMsg: string;

  if (readmePath) {
    // Check when README was last modified
    let daysOld = 0;
    try {
      const stats = statSync(readmePath);
      const mtime = stats.mtime.getTime();
      const now = Date.now();
      daysOld = Math.floor((now - mtime) / (86400 * 1000));
    } catch {
      // Ignore stat errors
    }

    let suggestion = analysis.suggestion;
    if (daysOld > 30) {
      suggestion = `${suggestion} (README last updated ${daysOld}+ days ago)`;
    }

    contextMsg = `README sync: ${analysis.changeType} change in ${filePath.split('/').pop()}. Section: '${analysis.readmeSection}'. ${suggestion}`;
  } else {
    contextMsg = `README sync: ${analysis.changeType} change detected but no README.md found. Consider creating one.`;
  }

  // Truncate if too long
  if (contextMsg.length > 200) {
    contextMsg = `README sync: ${analysis.changeType} change detected. Consider updating '${analysis.readmeSection}' section.`;
  }

  // Log the suggestion
  const logDir = `${projectDir}/.claude/hooks/logs`;
  try {
    mkdirSync(logDir, { recursive: true });
    const timestamp = new Date().toISOString();
    appendFileSync(
      `${logDir}/readme-sync.log`,
      `[${timestamp}] README_SYNC: ${analysis.changeType} change in ${filePath} -> ${analysis.readmeSection}\n`
    );
  } catch {
    // Ignore log errors
  }

  logHook('readme-sync', `README_SYNC: ${analysis.changeType} change suggests README update`);

  // Output using CC 2.1.9 additionalContext format
  return {
    continue: true,
    hookSpecificOutput: {
      additionalContext: contextMsg,
    },
  };
}
