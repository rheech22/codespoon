import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadTsconfigPaths, resolveAlias } from '../src/adapters/framework/tsconfig-paths.js';

function setupDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'tsconfig-paths-'));
  mkdirSync(resolve(dir, 'src/services'), { recursive: true });
  mkdirSync(resolve(dir, 'lib'), { recursive: true });
  writeFileSync(resolve(dir, 'src/services/chat.ts'), 'export class ChatService {}', 'utf-8');
  writeFileSync(resolve(dir, 'lib/utils.ts'), 'export function util() {}', 'utf-8');
  return dir;
}

describe('loadTsconfigPaths', () => {
  it('loads paths from tsconfig.json', () => {
    const dir = setupDir();
    writeFileSync(resolve(dir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@/*': ['./src/*'],
          '~/*': ['./*'],
        },
      },
    }), 'utf-8');

    const map = loadTsconfigPaths(dir);
    expect(map).not.toBeNull();
    expect(map!.entries).toHaveLength(2);
    expect(map!.entries[0].prefix).toBe('@/');
    expect(map!.entries[1].prefix).toBe('~/');
  });

  it('returns null when no tsconfig exists', () => {
    const dir = setupDir();
    expect(loadTsconfigPaths(dir)).toBeNull();
  });

  it('handles JSONC with comments', () => {
    const dir = setupDir();
    writeFileSync(resolve(dir, 'tsconfig.json'), [
      '{',
      '  // this is a comment',
      '  "compilerOptions": {',
      '    /* block comment */',
      '    "baseUrl": ".",',
      '    "paths": {',
      '      "@/*": ["./src/*"]',
      '    }',
      '  }',
      '}',
    ].join('\n'), 'utf-8');

    const map = loadTsconfigPaths(dir);
    expect(map).not.toBeNull();
    expect(map!.entries).toHaveLength(1);
    expect(map!.entries[0].prefix).toBe('@/');
  });
});

describe('resolveAlias', () => {
  it('resolves @/ prefix alias', () => {
    const dir = setupDir();
    writeFileSync(resolve(dir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        baseUrl: '.',
        paths: { '@/*': ['./src/*'] },
      },
    }), 'utf-8');

    const map = loadTsconfigPaths(dir)!;
    const resolved = resolveAlias('@/services/chat', map, dir);
    expect(resolved).not.toBeNull();
    expect(resolved).toContain('src/services/chat.ts');
  });

  it('resolves ~/ prefix alias', () => {
    const dir = setupDir();
    writeFileSync(resolve(dir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        baseUrl: '.',
        paths: { '~/*': ['./*'] },
      },
    }), 'utf-8');

    const map = loadTsconfigPaths(dir)!;
    const resolved = resolveAlias('~/lib/utils', map, dir);
    expect(resolved).not.toBeNull();
    expect(resolved).toContain('lib/utils.ts');
  });

  it('returns null for unmatched alias', () => {
    const dir = setupDir();
    writeFileSync(resolve(dir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        baseUrl: '.',
        paths: { '@/*': ['./src/*'] },
      },
    }), 'utf-8');

    const map = loadTsconfigPaths(dir)!;
    expect(resolveAlias('unmatched/path', map, dir)).toBeNull();
  });

  it('returns null when no alias map exists', () => {
    expect(resolveAlias('@/test', { baseUrl: '.', entries: [] }, '/tmp')).toBeNull();
  });

  it('resolves to index file when path is a directory', () => {
    const dir = setupDir();
    mkdirSync(resolve(dir, 'src/services/utils'), { recursive: true });
    writeFileSync(resolve(dir, 'src/services/utils/index.ts'), 'export const x = 1;', 'utf-8');
    writeFileSync(resolve(dir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        baseUrl: '.',
        paths: { '@/*': ['./src/*'] },
      },
    }), 'utf-8');

    const map = loadTsconfigPaths(dir)!;
    const resolved = resolveAlias('@/services/utils', map, dir);
    expect(resolved).not.toBeNull();
    expect(resolved).toContain('src/services/utils/index.ts');
  });
});
