import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { validateNodeContent, summarizeResults } from '../src/core/validation.js';
import { DEFAULTS } from '../src/core/config.js';
import type { CodespoonConfig } from '../src/core/config.js';

const fixturesDir = resolve(__dirname, 'fixtures');
const config = DEFAULTS;

function fixture(path: string): string {
  return readFileSync(resolve(fixturesDir, path), 'utf-8');
}

describe('checkFrontmatterExists (via validateNodeContent)', () => {

  it('passes a valid node', () => {
    const raw = fixture('valid-node/chat-session-lifecycle.md');
    const result = validateNodeContent(raw, { rootDir: resolve(fixturesDir, 'valid-node'), config });
    expect(result.passed).toBe(true);
    expect(result.messages.filter(m => m.type === 'error')).toHaveLength(0);
  });

  it('fails on missing frontmatter', () => {
    const raw = fixture('missing-frontmatter/no-fm.md');
    const result = validateNodeContent(raw, { rootDir: resolve(fixturesDir, 'missing-frontmatter'), config });
    expect(result.passed).toBe(false);
    expect(result.messages.some(m => m.type === 'error' && m.message.toLowerCase().includes('frontmatter'))).toBe(true);
  });
});

describe('checkRequiredSections', () => {

  it('fails when required sections are missing', () => {
    const raw = fixture('missing-section/no-section.md');
    const result = validateNodeContent(raw, { rootDir: resolve(fixturesDir, 'missing-section'), config });
    expect(result.passed).toBe(false);
    const sectionErrors = result.messages.filter(m => m.message.includes('Missing required section'));
    expect(sectionErrors.length).toBeGreaterThan(0);
    const sectionNames = sectionErrors.map(m => m.message);
    expect(sectionNames.some(s => s.includes('When To Use This Node'))).toBe(true);
    expect(sectionNames.some(s => s.includes('Entry Points'))).toBe(true);
    expect(sectionNames.some(s => s.includes('Key Code Paths'))).toBe(true);
  });
});

describe('checkSourcesNoAbsolute', () => {

  it('fails on absolute source path', () => {
    const raw = fixture('absolute-path/abs-path.md');
    const result = validateNodeContent(raw, { rootDir: resolve(fixturesDir, 'absolute-path'), config });
    expect(result.passed).toBe(false);
    expect(result.messages.some(m => m.type === 'error' && m.message.includes('absolute'))).toBe(true);
  });
});

describe('checkSourcesExist', () => {

  it('warns on missing source file', () => {
    const raw = fixture('missing-source/bad-source.md');
    const result = validateNodeContent(raw, { rootDir: resolve(fixturesDir, 'missing-source'), config });
    expect(result.messages.some(m => m.type === 'warning' && m.message.includes('does not exist'))).toBe(true);
  });
});

describe('checkBodyAbsolutePaths', () => {

  it('fails on absolute paths in body and markdown links', () => {
    const raw = fixture('body-absolute-path/body-abs.md');
    const result = validateNodeContent(raw, { rootDir: resolve(fixturesDir, 'body-absolute-path'), config });
    expect(result.passed).toBe(false);
    const absErrors = result.messages.filter(m => m.type === 'error' && m.message.includes('Absolute path'));
    expect(absErrors.length).toBeGreaterThanOrEqual(2);
    expect(absErrors.some(e => e.message.includes('/Users/demian/Projects/some/file.ts'))).toBe(true);
    expect(absErrors.some(e => e.message.includes('/absolute/path/to/file.ts'))).toBe(true);
  });
});

describe('checkGeneratedPaths', () => {

  it('warns when source matches generated_paths', () => {
    const raw = fixture('generated-path/node.md');
    const result = validateNodeContent(raw, { rootDir: resolve(fixturesDir, 'generated-path'), config });
    expect(result.messages.some(m => m.type === 'warning' && m.message.includes('generated_paths'))).toBe(true);
  });
});

describe('checkFrontmatterSchema (R4: schema failure continues to CHECKS)', () => {

  it('produces schema error and still runs other checks', () => {
    const raw = fixture('schema-error/node.md');
    const result = validateNodeContent(raw, { rootDir: resolve(fixturesDir, 'schema-error'), config });
    expect(result.passed).toBe(false);
    const schemaErrors = result.messages.filter(m => m.message.startsWith('Frontmatter:'));
    expect(schemaErrors.length).toBeGreaterThan(0);
    expect(schemaErrors.some(e => e.message.includes('scope'))).toBe(true);
    const otherChecks = result.messages.filter(m => !m.message.startsWith('Frontmatter:'));
    expect(otherChecks.length).toBeGreaterThan(0);
  });
});

describe('checkSourcesSymbols', () => {

  it('warns when source has empty symbols', () => {
    const raw = fixture('empty-symbols/node.md');
    const result = validateNodeContent(raw, { rootDir: resolve(fixturesDir, 'empty-symbols'), config });
    expect(result.messages.some(m => m.type === 'warning' && m.message.includes('no symbols'))).toBe(true);
  });
});

describe('checkOpenQuestions', () => {

  it('warns when Open Questions is empty', () => {
    const raw = fixture('empty-oq/node.md');
    const result = validateNodeContent(raw, { rootDir: resolve(fixturesDir, 'empty-oq'), config });
    expect(result.messages.some(m => m.type === 'warning' && m.message.includes('Open Questions'))).toBe(true);
  });
});

describe('checkMaxChars', () => {

  it('warns when node exceeds max_node_chars', () => {
    const raw = fixture('long-node/node.md');
    const result = validateNodeContent(raw, { rootDir: resolve(fixturesDir, 'long-node'), config });
    expect(result.messages.some(m => m.type === 'warning' && m.message.includes('exceeds max_node_chars'))).toBe(true);
  });
});

describe('summarizeResults', () => {

  it('counts passed and failed correctly', () => {
    const results = [
      { passed: true, messages: [{ type: 'error' as const, message: 'err' }] },
      { passed: true, messages: [] },
      { passed: false, messages: [{ type: 'warning' as const, message: 'warn' }] },
    ];
    const summary = summarizeResults(results);
    expect(summary.total).toBe(3);
    expect(summary.passed).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.errors).toHaveLength(1);
    expect(summary.warnings).toHaveLength(1);
  });
});
