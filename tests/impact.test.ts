import { describe, it, expect } from 'vitest';
import { findAffectedNodes } from '../src/core/impact.js';
import type { Graph } from '../src/core/types.js';

function makeGraph(sources: { nodeId: string; path: string }[]): Graph {
  return {
    version: 1,
    generatedAt: '2025-01-01',
    lastProcessedCommit: '',
    nodes: [],
    sources: sources.map(s => ({ ...s, symbols: [] })),
    edges: [],
  };
}

describe('findAffectedNodes', () => {
  it('returns empty array when no sources match', () => {
    const graph = makeGraph([
      { nodeId: 'a', path: 'src/foo.ts' },
    ]);
    expect(findAffectedNodes(['src/bar.ts'], graph)).toEqual([]);
  });

  it('matches exact source path', () => {
    const graph = makeGraph([
      { nodeId: 'a', path: 'src/foo.ts' },
    ]);
    expect(findAffectedNodes(['src/foo.ts'], graph)).toEqual(['a']);
  });

  it('matches directory prefix pattern', () => {
    const graph = makeGraph([
      { nodeId: 'a', path: 'src/api' },
    ]);
    expect(findAffectedNodes(['src/api/users.ts'], graph)).toEqual(['a']);
  });

  it('does not match partial prefix (src/ap vs src/api)', () => {
    const graph = makeGraph([
      { nodeId: 'a', path: 'src/api' },
    ]);
    expect(findAffectedNodes(['src/ap/other.ts'], graph)).toEqual([]);
  });

  it('returns unique node IDs for multiple matching files', () => {
    const graph = makeGraph([
      { nodeId: 'a', path: 'src/api' },
      { nodeId: 'a', path: 'src/bar.ts' },
    ]);
    const result = findAffectedNodes(['src/api/users.ts', 'src/bar.ts'], graph);
    expect(result).toEqual(['a']);
  });

  it('returns multiple node IDs when different nodes are affected', () => {
    const graph = makeGraph([
      { nodeId: 'a', path: 'src/api' },
      { nodeId: 'b', path: 'src/bar.ts' },
    ]);
    const result = findAffectedNodes(['src/api/users.ts', 'src/bar.ts'], graph);
    expect(result.sort()).toEqual(['a', 'b']);
  });

  it('ignores files that dont match any source', () => {
    const graph = makeGraph([
      { nodeId: 'a', path: 'src/api' },
    ]);
    const result = findAffectedNodes(['src/other/foo.ts', 'src/api/handler.ts'], graph);
    expect(result).toEqual(['a']);
  });

  it('returns empty array for empty changedFiles', () => {
    const graph = makeGraph([
      { nodeId: 'a', path: 'src/foo.ts' },
    ]);
    expect(findAffectedNodes([], graph)).toEqual([]);
  });

  it('returns empty array for empty graph sources', () => {
    const graph = makeGraph([]);
    expect(findAffectedNodes(['src/foo.ts'], graph)).toEqual([]);
  });
});
