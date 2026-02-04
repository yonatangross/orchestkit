#!/usr/bin/env node
/**
 * verify-imports.js
 * Verifies all TypeScript imports resolve to actual files on disk.
 * Catches stale imports that tsc might miss due to cached .d.ts files.
 *
 * Part of P0-A: Pre-push TypeScript validation
 * Issue: #303
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const HOOKS_SRC = path.join(PROJECT_ROOT, 'src', 'hooks', 'src');

// Extensions to try when resolving imports
// Note: TypeScript ESM uses .js extensions that resolve to .ts files
const EXTENSIONS = [
  '',           // exact match
  '.ts',        // TypeScript
  '.tsx',       // TypeScript React
  '.js',        // JavaScript
  '.jsx',       // JavaScript React
  '/index.ts',  // directory index
  '/index.js',  // directory index
];

// When import ends with .js, also try .ts (ESM TypeScript convention)
const JS_TO_TS_MAPPING = {
  '.js': '.ts',
  '.jsx': '.tsx',
};

// Colors for output
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m';

/**
 * Find all TypeScript files in a directory
 */
function findTsFiles(dir, skipTests = true) {
  const files = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules, dist, and optionally __tests__
      const skipDirs = ['node_modules', 'dist'];
      if (skipTests) {
        skipDirs.push('__tests__');
      }
      if (!skipDirs.includes(entry.name)) {
        files.push(...findTsFiles(fullPath, skipTests));
      }
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      // Skip test files
      if (skipTests && /\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
        continue;
      }
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Extract import paths from a TypeScript file
 */
function extractImports(content) {
  const imports = [];

  // Match: import ... from '...' or import ... from "..."
  const importRegex = /(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // Match: require('...') or require("...")
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

/**
 * Check if an import path resolves to an existing file
 */
function resolveImport(importPath, fromFile) {
  // Skip non-relative imports (node_modules, etc.)
  if (!importPath.startsWith('.')) {
    return { valid: true, resolved: null };
  }

  const fromDir = path.dirname(fromFile);
  const basePath = path.resolve(fromDir, importPath);

  // Check if file exists with exact path
  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
    return { valid: true, resolved: basePath };
  }

  // Handle ESM TypeScript convention: .js imports that resolve to .ts files
  // e.g., import '../types.js' should resolve to '../types.ts'
  for (const [jsExt, tsExt] of Object.entries(JS_TO_TS_MAPPING)) {
    if (importPath.endsWith(jsExt)) {
      const tsPath = basePath.slice(0, -jsExt.length) + tsExt;
      if (fs.existsSync(tsPath) && fs.statSync(tsPath).isFile()) {
        return { valid: true, resolved: tsPath };
      }
    }
  }

  // Try each extension for extensionless imports
  for (const ext of EXTENSIONS) {
    const fullPath = basePath + ext;
    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        return { valid: true, resolved: fullPath };
      }
    }
  }

  return { valid: false, resolved: null };
}

/**
 * Main verification function
 */
function verifyImports() {
  console.log('Verifying TypeScript imports...\n');

  const tsFiles = findTsFiles(HOOKS_SRC);

  if (tsFiles.length === 0) {
    console.log(`${YELLOW}No TypeScript files found in ${HOOKS_SRC}${NC}`);
    return 0;
  }

  console.log(`Found ${tsFiles.length} TypeScript files to check\n`);

  const errors = [];
  let totalImports = 0;

  for (const file of tsFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const imports = extractImports(content);

      for (const importPath of imports) {
        totalImports++;
        const result = resolveImport(importPath, file);

        if (!result.valid) {
          const relativePath = path.relative(PROJECT_ROOT, file);
          errors.push({
            file: relativePath,
            import: importPath
          });
        }
      }
    } catch (err) {
      console.error(`${RED}Error reading ${file}: ${err.message}${NC}`);
    }
  }

  console.log(`Checked ${totalImports} imports\n`);

  if (errors.length > 0) {
    console.log(`${RED}Found ${errors.length} broken import(s):${NC}\n`);

    for (const error of errors) {
      console.log(`  ${RED}❌${NC} ${error.file}`);
      console.log(`     Cannot resolve: ${YELLOW}${error.import}${NC}\n`);
    }

    return 1;
  }

  console.log(`${GREEN}✅ All imports verified successfully${NC}`);
  return 0;
}

// Run verification
const exitCode = verifyImports();
process.exit(exitCode);
