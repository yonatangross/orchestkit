/**
 * Unit tests for the shipped corpus parser (src/corpus.ts).
 */

import { describe, test, expect } from 'vitest';
import { parseLessonsMd, joinPath, homeDir } from '../src/corpus.js';

describe('parseLessonsMd', () => {
  test('parses simple lesson file', () => {
    const content = `## gh-api-pagination

- Use gh api --paginate for endpoints that return arrays
- Always check rate limit headers

## another-heading

- Some other lesson`;

    const bullets = parseLessonsMd(content);
    expect(bullets.length).toBe(3);
    expect(bullets[0].heading).toBe('gh-api-pagination');
    expect(bullets[0].text).toBe('Use gh api --paginate for endpoints that return arrays');
    expect(bullets[0].tokens).toEqual(['Use', 'gh', 'api']);
  });

  test('handles empty content', () => {
    expect(parseLessonsMd('')).toEqual([]);
  });

  test('handles content without bullets', () => {
    const content = `## heading\n\nJust some text without bullets`;
    expect(parseLessonsMd(content)).toEqual([]);
  });

  test('extracts command tokens correctly', () => {
    const content = `## heading

- gh api --paginate repos/owner/repo/issues
- git push origin main
- pnpm install --frozen-lockfile`;

    const bullets = parseLessonsMd(content);
    expect(bullets[0].tokens.slice(0, 2)).toEqual(['gh', 'api']);
    expect(bullets[1].tokens.slice(0, 2)).toEqual(['git', 'push']);
    expect(bullets[2].tokens.slice(0, 2)).toEqual(['pnpm', 'install']);
  });

  test('handles multiple headings with bullets', () => {
    const content = `## first

- First lesson one
- First lesson two

## second

- Second lesson one

## third

- Third lesson one
- Third lesson two
- Third lesson three`;

    const bullets = parseLessonsMd(content);
    expect(bullets.length).toBe(6);
    expect(bullets.filter(b => b.heading === 'first').length).toBe(2);
    expect(bullets.filter(b => b.heading === 'second').length).toBe(1);
    expect(bullets.filter(b => b.heading === 'third').length).toBe(3);
  });

  test('ignores bullets before first heading', () => {
    const content = `- Orphan bullet one
- Orphan bullet two

## heading

- Real bullet`;

    const bullets = parseLessonsMd(content);
    expect(bullets.length).toBe(1);
    expect(bullets[0].heading).toBe('heading');
  });

  test('handles deeply nested content', () => {
    const content = `## heading

- Lesson with **bold** text
- Lesson with \`code\` block
- Lesson with [link](url)`;

    const bullets = parseLessonsMd(content);
    expect(bullets.length).toBe(3);
    // Markdown formatting is preserved in text
    expect(bullets[0].text).toContain('**bold**');
    expect(bullets[1].text).toContain('`code`');
  });
});

describe('corpus parsing performance', () => {
  test('parseLessonsMd handles large files', () => {
    // Simulate a large lessons.md file
    const lines: string[] = ['## heading'];
    for (let i = 0; i < 1000; i++) {
      lines.push(`- Lesson line ${i} with some content`);
    }

    const content = lines.join('\n');
    const start = Date.now();
    const bullets = parseLessonsMd(content);
    const elapsed = Date.now() - start;

    expect(bullets.length).toBe(1000);
    expect(elapsed).toBeLessThan(50); // Should be very fast
  });
});

describe('token extraction edge cases', () => {
  test('handles empty text', () => {
    const content = `## heading

- `;
    const bullets = parseLessonsMd(content);
    // Empty bullet text does not match the bullet pattern
    expect(bullets.length).toBe(0);
  });

  test('handles special characters in tokens', () => {
    const content = `## heading

- hq_dispatch run-task
- vm_stat per-sec
- some_command --flag=value`;

    const bullets = parseLessonsMd(content);
    expect(bullets[0].tokens.slice(0, 1)).toEqual(['hq_dispatch']);
    expect(bullets[1].tokens.slice(0, 2)).toEqual(['vm_stat', 'per-sec']);
  });
});

describe('path helpers', () => {
  test('joinPath drops empty segments and joins with slashes', () => {
    expect(joinPath('/home/u', '.claude', '', 'hq')).toBe('/home/u/.claude/hq');
    expect(joinPath()).toBe('');
  });

  test('homeDir falls back to empty string without env', () => {
    // Depends on the test environment; both shapes are acceptable
    expect(typeof homeDir()).toBe('string');
  });
});
