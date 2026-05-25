import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInit } from '../src/commands/init.js';

describe('initCommand', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'codespoon-init-test-'));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates config file and directory structure', () => {
    const result = runInit({ dir: tmpDir, writeGitignore: true });

    expect(existsSync(join(tmpDir, 'codespoon.config.yaml'))).toBe(true);
    expect(existsSync(join(tmpDir, 'docs', 'knowledge', 'nodes'))).toBe(true);
    expect(existsSync(join(tmpDir, 'docs', 'knowledge', 'evaluations'))).toBe(true);
    expect(existsSync(join(tmpDir, 'docs', 'knowledge', 'README.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.codespoon', 'cache'))).toBe(true);
    expect(existsSync(join(tmpDir, '.codespoon', 'runs'))).toBe(true);
    expect(existsSync(join(tmpDir, '.gitignore'))).toBe(true);

    const gitignore = readFileSync(join(tmpDir, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('.codespoon/cache/');
    expect(gitignore).toContain('.codespoon/runs/');
  });

  it('is idempotent on second call', () => {
    const result = runInit({ dir: tmpDir, writeGitignore: true });
    expect(result.created.length).toBe(0);
    expect(result.skipped.length).toBeGreaterThan(0);
  });
});
