import { describe, it, expect } from 'vitest';
import { buildUpdatePrompt } from '../src/daemon/prompt-builder.js';
import { DEFAULTS } from '../src/core/config.js';
import type { NodeDocument } from '../src/core/types.js';
import type { ChangedFile } from '../src/adapters/vcs/index.js';

const config = DEFAULTS;

function makeNode(overrides?: Partial<NodeDocument>): NodeDocument {
  return {
    frontmatter: {
      id: 'test-node',
      kind: 'domain',
      status: 'auto-updated',
      confidence: 'high',
      scope: { include: ['src/**'], exclude: [] },
      sources: [{ path: 'src/foo.ts', symbols: ['Foo'] }],
      relations: [],
      last_updated_commit: 'abc123',
      last_updated_at: '2025-01-01',
    },
    body: '# Test Node\n\n## Summary\n\nTest summary.',
    title: 'Test Node',
    path: 'docs/knowledge/nodes/test-node.md',
    ...overrides,
  };
}

describe('buildUpdatePrompt', () => {
  it('includes node ID and current content', () => {
    const node = makeNode();
    const prompt = buildUpdatePrompt({ node, changedFiles: [], config, isRetry: false });
    expect(prompt).toContain('test-node');
    expect(prompt).toContain('Test Node');
    expect(prompt).toContain('## Summary');
  });

  it('includes changed files', () => {
    const changedFiles: ChangedFile[] = [
      { path: 'src/foo.ts', status: 'modified' },
      { path: 'src/bar.ts', status: 'added' },
    ];
    const prompt = buildUpdatePrompt({ node: makeNode(), changedFiles, config, isRetry: false });
    expect(prompt).toContain('modified: src/foo.ts');
    expect(prompt).toContain('added: src/bar.ts');
  });

  it('includes validation errors on retry', () => {
    const errors = [
      { type: 'error' as const, message: 'Missing required section: "Entry Points"' },
    ];
    const prompt = buildUpdatePrompt({ node: makeNode(), changedFiles: [], config, validationErrors: errors, isRetry: true });
    expect(prompt).toContain('Missing required section: "Entry Points"');
    expect(prompt).toContain('Previous Validation Errors');
  });

  it('does not include validation errors section when not retry', () => {
    const prompt = buildUpdatePrompt({ node: makeNode(), changedFiles: [], config, isRetry: false });
    expect(prompt).not.toContain('Previous Validation Errors');
  });

  it('includes format requirements', () => {
    const prompt = buildUpdatePrompt({ node: makeNode(), changedFiles: [], config, isRetry: false });
    expect(prompt).toContain('Required sections:');
    expect(prompt).toContain('No absolute paths in body');
    expect(prompt).toContain('Sources paths must be relative');
  });

  it('includes do-not-change-id instruction', () => {
    const node = makeNode();
    const prompt = buildUpdatePrompt({ node, changedFiles: [], config, isRetry: false });
    expect(prompt).toContain('Do not change the `id` field');
  });

  it('includes config max_node_chars', () => {
    const node = makeNode();
    const prompt = buildUpdatePrompt({ node, changedFiles: [], config: { ...config, max_node_chars: 5000 }, isRetry: false });
    expect(prompt).toContain('Max node length: 5000 chars');
  });
});
