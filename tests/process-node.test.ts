import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { processNode } from '../src/daemon/process-node.js';
import type { ProcessNodeOptions } from '../src/daemon/process-node.js';
import { DEFAULTS } from '../src/core/config.js';
import type { AgentAdapter, InvokeOptions, InvokeResult } from '../src/adapters/agent/index.js';

const VALID_NODE = `---
id: test
kind: domain
status: auto-updated
confidence: high
scope:
  include:
    - src/foo.ts
  exclude: []
sources:
  - path: src/foo.ts
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

None.
`;

function setupRepo(): { repo: string; nodePath: string; runDir: string } {
  const repo = mkdtempSync(join(tmpdir(), 'process-node-test-'));
  mkdirSync(resolve(repo, 'docs/knowledge/nodes'), { recursive: true });
  mkdirSync(resolve(repo, 'src'), { recursive: true });
  writeFileSync(resolve(repo, 'src/foo.ts'), 'export class Foo {}', 'utf-8');
  const nodePath = resolve(repo, 'docs/knowledge/nodes/test.md');
  writeFileSync(nodePath, VALID_NODE, 'utf-8');
  const runDir = resolve(repo, '.codespoon/runs/test');
  return { repo, nodePath, runDir };
}

/**
 * Mock agent that simulates file writes per attempt.
 *   writes[i] is the file content the agent "writes" on attempt i+1.
 *   If writes[i] is null, agent does nothing (no file write).
 */
function makeFileWritingAgent(nodePath: string, writes: (string | null)[]): AgentAdapter {
  let attemptIdx = 0;
  return {
    invoke: vi.fn().mockImplementation(async (_prompt: string, _opts: InvokeOptions): Promise<InvokeResult> => {
      const content = writes[attemptIdx];
      attemptIdx++;
      // Bump mtime slightly even when writing the same content, so mtime check detects the write.
      await new Promise(r => setTimeout(r, 10));
      if (content !== null && content !== undefined) {
        writeFileSync(nodePath, content, 'utf-8');
      }
      return { stdout: '', stderr: '', exitCode: 0, durationMs: 100 };
    }),
  };
}

function makeOptions(repo: string, nodePath: string, runDir: string, agent: AgentAdapter): ProcessNodeOptions {
  return {
    nodePath,
    node: {
      frontmatter: {
        id: 'test',
        kind: 'domain',
        status: 'auto-updated',
        confidence: 'high',
        scope: { include: ['src/foo.ts'], exclude: [] },
        sources: [{ path: 'src/foo.ts', symbols: ['Foo'] }],
        relations: [],
        last_updated_commit: 'abc123',
        last_updated_at: '2025-01-01',
      },
      body: '# Test\n\n## Summary\n\nOriginal.',
      title: 'Test',
      path: 'docs/knowledge/nodes/test.md',
    },
    changedFiles: [{ path: 'src/foo.ts', status: 'modified' }],
    config: { ...DEFAULTS, retry_count: 2 },
    agent,
    repoRoot: repo,
    runDir,
  };
}

describe('processNode (file-write flow)', () => {
  it('succeeds when agent writes a valid file', async () => {
    const { repo, nodePath, runDir } = setupRepo();
    const agent = makeFileWritingAgent(nodePath, [VALID_NODE]);

    const result = await processNode(makeOptions(repo, nodePath, runDir, agent));

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
    expect(existsSync(nodePath)).toBe(true);
    expect(readFileSync(nodePath, 'utf-8')).toContain('Updated content');
  });

  it('fails when agent does not write the file', async () => {
    const { repo, nodePath, runDir } = setupRepo();
    const originalContent = readFileSync(nodePath, 'utf-8');
    const agent = makeFileWritingAgent(nodePath, [null, null]);

    const result = await processNode(makeOptions(repo, nodePath, runDir, agent));

    expect(result.success).toBe(false);
    expect(result.error).toContain('did not write');
    expect(readFileSync(nodePath, 'utf-8')).toBe(originalContent);
    expect(existsSync(resolve(runDir, 'test.failed.md'))).toBe(true);
  });

  it('rejects when agent changes the id and restores original', async () => {
    const { repo, nodePath, runDir } = setupRepo();
    const originalContent = readFileSync(nodePath, 'utf-8');
    const changedIdContent = VALID_NODE.replace('id: test', 'id: hijacked');
    const agent = makeFileWritingAgent(nodePath, [changedIdContent, changedIdContent]);

    const result = await processNode(makeOptions(repo, nodePath, runDir, agent));

    expect(result.success).toBe(false);
    expect(readFileSync(nodePath, 'utf-8')).toBe(originalContent);
  });

  it('recovers via retry feedback', async () => {
    const { repo, nodePath, runDir } = setupRepo();
    const invalidContent = '# Just a title with no frontmatter';
    const agent = makeFileWritingAgent(nodePath, [invalidContent, VALID_NODE]);

    const result = await processNode(makeOptions(repo, nodePath, runDir, agent));

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(readFileSync(nodePath, 'utf-8')).toContain('Updated content');
  });
});
