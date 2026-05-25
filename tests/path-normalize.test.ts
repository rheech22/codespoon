import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { normalizeBodyPathsInFile } from '../src/core/path-normalize.js';

function makeNode(body: string, sources: string[]): string {
  const sourceYaml = sources.map(s => `  - path: ${s}\n    symbols: []`).join('\n');
  return `---
id: test
sources:
${sourceYaml}
---
${body}`;
}

function setup(): string {
  const dir = mkdtempSync(join(tmpdir(), 'normalize-test-'));
  return resolve(dir, 'node.md');
}

describe('normalizeBodyPathsInFile', () => {
  let filePath: string;

  beforeEach(() => {
    filePath = setup();
  });

  it('rewrites body /web/app/chat/page.tsx to apps/web/app/chat/page.tsx', () => {
    writeFileSync(filePath, makeNode(
      'See /web/app/chat/page.tsx for the entry.',
      ['apps/web/app/chat/page.tsx'],
    ), 'utf-8');

    const changed = normalizeBodyPathsInFile(filePath);
    expect(changed).toBe(true);

    const result = readFileSync(filePath, 'utf-8');
    expect(result).toContain('See apps/web/app/chat/page.tsx for the entry.');
    expect(result).not.toContain('See /web/');
  });

  it('preserves frontmatter byte-for-byte', () => {
    const fm = `---
id: test
sources:
  - path: apps/web/foo.ts
    symbols: []
---
`;
    writeFileSync(filePath, fm + 'See /web/foo.ts here.\n', 'utf-8');

    normalizeBodyPathsInFile(filePath);
    const result = readFileSync(filePath, 'utf-8');
    expect(result.startsWith(fm)).toBe(true);
  });

  it('rewrites full leading-slash variant /apps/...', () => {
    writeFileSync(filePath, makeNode(
      'Edit /apps/web/foo.ts directly.',
      ['apps/web/foo.ts'],
    ), 'utf-8');

    normalizeBodyPathsInFile(filePath);
    expect(readFileSync(filePath, 'utf-8')).toContain('apps/web/foo.ts');
  });

  it('does not rewrite ambiguous matches', () => {
    // Both sources would match "/page.tsx" — skip rather than guess.
    writeFileSync(filePath, makeNode(
      'See /page.tsx',
      ['apps/web/chat/page.tsx', 'apps/web/account/page.tsx'],
    ), 'utf-8');

    const changed = normalizeBodyPathsInFile(filePath);
    // "/page.tsx" is too short anyway (only 1 segment after slash) and
    // also ambiguous. Either way, no change.
    expect(changed).toBe(false);
  });

  it('does not rewrite real OS paths', () => {
    writeFileSync(filePath, makeNode(
      'Saved at /Users/demian/foo.ts and /var/log/bar.ts',
      ['apps/web/chat/page.tsx'],
    ), 'utf-8');

    const changed = normalizeBodyPathsInFile(filePath);
    expect(changed).toBe(false);
    const result = readFileSync(filePath, 'utf-8');
    expect(result).toContain('/Users/demian/foo.ts');
    expect(result).toContain('/var/log/bar.ts');
  });

  it('returns false when no sources are defined', () => {
    writeFileSync(filePath, '---\nid: test\nsources: []\n---\nbody', 'utf-8');
    expect(normalizeBodyPathsInFile(filePath)).toBe(false);
  });

  it('handles multiple distinct rewrites in one pass', () => {
    writeFileSync(filePath, makeNode(
      'Files: /web/app/chat/page.tsx and /web/app/account/page.tsx',
      ['apps/web/app/chat/page.tsx', 'apps/web/app/account/page.tsx'],
    ), 'utf-8');

    normalizeBodyPathsInFile(filePath);
    const result = readFileSync(filePath, 'utf-8');
    expect(result).toContain('Files: apps/web/app/chat/page.tsx and apps/web/app/account/page.tsx');
    expect(result).not.toContain(': /web/');
    expect(result).not.toContain('and /web/');
  });
});
