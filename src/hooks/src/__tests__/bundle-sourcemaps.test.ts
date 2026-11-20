import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dist = new URL('../../../../plugins/ork/hooks/dist/', import.meta.url);

describe('shipped bundle sourcemaps', () => {
  it('does not reference maps excluded from the plugin', () => {
    const bundles = readdirSync(dist).filter(name => name.endsWith('.mjs'));
    expect(bundles.length).toBeGreaterThan(0);
    for (const name of bundles) {
      expect(readFileSync(new URL(name, dist), 'utf8')).not.toContain('//# sourceMappingURL=');
    }
  });

  it('loads a shipped bundle through the test runner', async () => {
    await expect(import(/* @vite-ignore */ fileURLToPath(new URL('notification.mjs', dist))))
      .resolves.toBeDefined();
  });
});
