import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve } from 'node:path';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { processCommit } from '../src/daemon/process-commit.js';
import type { VcsAdapter, ChangedFile } from '../src/adapters/vcs/index.js';
import type { AgentAdapter, InvokeResult } from '../src/adapters/agent/index.js';

function setupTestRepo(): string {
  const dir = resolve(tmpdir(), `codespoon-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(resolve(dir, 'docs/knowledge/nodes'), { recursive: true });
  mkdirSync(resolve(dir, '.codespoon'), { recursive: true });
  return dir;
}

function writeGraph(dir: string, overrides?: Record<string, unknown>): void {
  const graph = {
    version: 1,
    generatedAt: '2025-01-01',
    lastProcessedCommit: '',
    nodes: [
      { id: 'test-node', kind: 'domain', title: 'Test', path: 'docs/knowledge/nodes/test-node.md', status: 'auto-updated', confidence: 'high', lastUpdatedCommit: 'abc123' },
    ],
    sources: [
      { nodeId: 'test-node', path: 'foo.ts', symbols: ['Foo'] },
    ],
    edges: [],
    ...overrides,
  };
  writeFileSync(resolve(dir, 'docs/knowledge/graph.json'), JSON.stringify(graph, null, 2), 'utf-8');
}

function writeNode(dir: string): void {
  const content = `---
id: test-node
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

Original content.

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
  writeFileSync(resolve(dir, 'docs/knowledge/nodes/test-node.md'), content, 'utf-8');
}

function makeMockVcs(changedFiles: ChangedFile[]): VcsAdapter {
  return {
    getChangedFiles: vi.fn().mockResolvedValue(changedFiles),
    getShortSha: vi.fn().mockResolvedValue('abc1234'),
    stage: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue('commit-sha'),
    getLastCommitMessage: vi.fn().mockResolvedValue('some message'),
    getRepoRoot: vi.fn().mockResolvedValue('/tmp'),
    diffTree: vi.fn().mockResolvedValue([]),
    hasUncommittedChanges: vi.fn().mockResolvedValue(false),
  };
}

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

describe('processCommit', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = setupTestRepo();
  });

  it('skips processing when graph.json is missing', async () => {
    const result = await processCommit({
      repoRoot: repoDir,
      sha: 'abc1234',
      vcs: makeMockVcs([]),
      agent: makeMockAgent({}),
    });
    expect(result.affectedCount).toBe(0);
    expect(result.error).toContain('graph.json not found');
  });

  it('skips processing when no changed files', async () => {
    writeGraph(repoDir);
    const result = await processCommit({
      repoRoot: repoDir,
      sha: 'abc1234',
      vcs: makeMockVcs([]),
      agent: makeMockAgent({}),
    });
    expect(result.affectedCount).toBe(0);
    expect(result.error).toContain('No changed files');
  });

  it('skips processing when no nodes are affected', async () => {
    writeGraph(repoDir);
    const vcs = makeMockVcs([{ path: 'unrelated.ts', status: 'modified' }]);
    const result = await processCommit({
      repoRoot: repoDir,
      sha: 'abc1234',
      vcs,
      agent: makeMockAgent({}),
    });
    expect(result.affectedCount).toBe(0);
    expect(result.autoCommitted).toBe(false);
  });

  it('processes an affected node and auto-commits', async () => {
    writeGraph(repoDir);
    writeNode(repoDir);

    const updatedNodeContent = `---
id: test-node
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

Updated by agent.

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

    const result = await processCommit({
      repoRoot: repoDir,
      sha: 'abc1234',
      vcs: makeMockVcs([{ path: 'foo.ts', status: 'modified' }]),
      agent: makeMockAgent({ stdout: updatedNodeContent }),
    });

    expect(result.affectedCount).toBe(1);
    expect(result.processed).toHaveLength(1);
    expect(result.processed[0].success).toBe(true);
    expect(result.processed[0].needsReview).toBe(false);
    expect(result.autoCommitted).toBe(true);

    const nodeContent = readFileSync(resolve(repoDir, 'docs/knowledge/nodes/test-node.md'), 'utf-8');
    expect(nodeContent).toContain('Updated by agent');
  });
});
