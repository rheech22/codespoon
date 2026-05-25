import { describe, it, expect, vi } from 'vitest';
import { parseAgentOutput, extractUpdatedFilename, processNode } from '../src/daemon/process-node.js';
import type { ProcessNodeOptions } from '../src/daemon/process-node.js';
import { DEFAULTS } from '../src/core/config.js';
import type { AgentAdapter, InvokeResult } from '../src/adapters/agent/index.js';

describe('parseAgentOutput', () => {
  it('parses valid markdown with frontmatter', () => {
    const raw = '---\nid: test\nkind: domain\n---\n# Body';
    const result = parseAgentOutput(raw);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.id).toBe('test');
    expect(result!.body).toContain('# Body');
  });

  it('returns null for plain text', () => {
    expect(parseAgentOutput('just text')).toBeNull();
  });

  it('returns null for empty frontmatter', () => {
    expect(parseAgentOutput('---\n---\nbody')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseAgentOutput('')).toBeNull();
  });
});

describe('extractUpdatedFilename', () => {
  it('extracts id from frontmatter', () => {
    const raw = '---\nid: my-node\nkind: domain\n---\nbody';
    expect(extractUpdatedFilename(raw, 'default')).toBe('my-node.md');
  });

  it('falls back to default if no frontmatter', () => {
    expect(extractUpdatedFilename('no frontmatter', 'default')).toBe('default.md');
  });

  it('falls back to default if no id in frontmatter', () => {
    const raw = '---\nkind: domain\n---\nbody';
    expect(extractUpdatedFilename(raw, 'default')).toBe('default.md');
  });
});

describe('processNode', () => {
  function makeMockAgent(result: Partial<InvokeResult>): AgentAdapter {
    return {
      invoke: vi.fn().mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        durationMs: 100,
        ...result,
      }),
    };
  }

  function makeOptions(overrides?: Partial<ProcessNodeOptions>): ProcessNodeOptions {
    return {
      nodePath: 'docs/knowledge/nodes/test.md',
      node: {
        frontmatter: {
          id: 'test',
          kind: 'domain',
          status: 'auto-updated',
          confidence: 'high',
          scope: { include: ['src/**'], exclude: [] },
          sources: [{ path: 'src/foo.ts', symbols: ['Foo'] }],
          relations: [],
          last_updated_commit: 'abc123',
          last_updated_at: '2025-01-01',
        },
        body: '# Test\n\n## Summary\n\nContent.',
        title: 'Test',
        path: 'docs/knowledge/nodes/test.md',
      },
      changedFiles: [{ path: 'src/foo.ts', status: 'modified' }],
      config: { ...DEFAULTS, retry_count: 2 },
      agent: makeMockAgent({}),
      repoRoot: '/tmp/test',
      runDir: '/tmp/test/.codespoon/runs/abc123',
      ...overrides,
    };
  }

  it('handles empty agent output', async () => {
    const opts = makeOptions({
      agent: makeMockAgent({ stdout: '' }),
    });
    const result = await processNode(opts);
    expect(result.success).toBe(false);
    expect(result.error).toContain('empty output');
  });

  it('handles non-markdown agent output', async () => {
    const opts = makeOptions({
      agent: makeMockAgent({ stdout: 'just some text' }),
    });
    const result = await processNode(opts);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed after 2 attempts');
  });

  it('succeeds on valid agent output', async () => {
    const validOutput = `---
id: test
kind: domain
status: auto-updated
confidence: high
scope:
  include:
    - src/**
  exclude: []
sources:
  - path: foo.ts
    symbols:
      - Foo
relations: []
last_updated_commit: abc123
last_updated_at: "2025-01-01"
---
# Test

## Summary

Updated content.

## When To Use This Node

When needed.

## Entry Points

foo.ts

## Key Code Paths

None.

## Data And Event Flow

None.

## Invariants

None.

## Source Trace

- foo.ts :: Foo

## Open Questions

None.`;

    const opts = makeOptions({
      agent: makeMockAgent({ stdout: validOutput }),
    });
    const result = await processNode(opts);
    if (!result.success) {
      console.log('processNode error:', result.error);
    }
    expect(result.success).toBe(true);
    expect(result.finalContent).toContain('Updated content');
  });
});
