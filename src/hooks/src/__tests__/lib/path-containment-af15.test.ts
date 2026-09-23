/**
 * #4220 AF-15 fail-first: resolveRealPath must realpath the parent on ENOENT
 * so a committed symlink directory plus a new-file write cannot escape.
 */

import { describe, test, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { resolveRealPath, isInsideDir } from '../../lib/path-containment.js';

describe('resolveRealPath AF-15 symlink-dir new-file (#4220)', () => {
  let tmp = '';

  afterEach(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    tmp = '';
  });

  test('new file under a symlink directory resolves outside the project', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ork-af15-'));
    const project = path.join(tmp, 'proj');
    const outside = path.join(tmp, 'outside');
    fs.mkdirSync(project, { recursive: true });
    fs.mkdirSync(outside, { recursive: true });
    const link = path.join(project, 'vendor');
    fs.symlinkSync(outside, link);

    // New file does not exist yet (ENOENT on the leaf).
    const lexical = path.join(link, 'brand-new.ts');
    const resolved = resolveRealPath(lexical, project);
    const outsideReal = fs.realpathSync(outside);

    // Must land under the real outside dir, not the lexical project/vendor path.
    expect(resolved).toBe(path.join(outsideReal, 'brand-new.ts'));
    expect(isInsideDir(resolved, project)).toBe(false);
  });
});
