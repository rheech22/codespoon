import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { generateGraph } from '../src/core/graph.js';
import { DEFAULTS } from '../src/core/config.js';

const fixturesDir = resolve(__dirname, 'fixtures');
const simpleGraphDir = resolve(fixturesDir, 'simple-graph');

describe('generateGraph', () => {

  it('builds graph from node files', () => {
    const config = { ...DEFAULTS, knowledge_dir: '.' };
    const graph = generateGraph(simpleGraphDir, config);

    expect(graph.version).toBe(1);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.sources).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.lastProcessedCommit).toBe('');

    const nodeA = graph.nodes.find(n => n.id === 'node-a');
    expect(nodeA).toBeDefined();
    expect(nodeA!.title).toBe('Node A');
    expect(nodeA!.kind).toBe('domain');
    expect(nodeA!.status).toBe('auto-updated');
    expect(nodeA!.confidence).toBe('high');

    const nodeB = graph.nodes.find(n => n.id === 'node-b');
    expect(nodeB).toBeDefined();
    expect(nodeB!.title).toBe('Node B');

    const sourceA = graph.sources.find(s => s.nodeId === 'node-a');
    expect(sourceA).toBeDefined();
    expect(sourceA!.path).toBe('src/a.ts');
    expect(sourceA!.symbols).toEqual(['aFunc']);

    const edge = graph.edges.find(e => e.from === 'node-a' && e.to === 'node-b');
    expect(edge).toBeDefined();
    expect(edge!.kind).toBe('related');
    expect(edge!.confidence).toBe('extracted');
  });
});
