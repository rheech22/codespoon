import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pc from 'picocolors';
import { loadConfig } from '../core/config.js';
import { generateGraph } from '../core/graph.js';
import type { Graph } from '../core/types.js';

export interface BuildOptions {
  dir: string;
}

export interface BuildRunResult {
  graph: Graph;
  outputPath: string;
}

export function runBuild(options: BuildOptions): BuildRunResult {
  const root = resolve(options.dir);
  const { config, error } = loadConfig(root);
  if (error && error.type !== 'not-found') {
    throw new Error(error.message);
  }

  const graph = generateGraph(root, config);
  const outputPath = resolve(root, config.knowledge_dir, 'graph.json');

  writeFileSync(outputPath, JSON.stringify(graph, null, 2) + '\n', 'utf-8');

  return { graph, outputPath };
}

export function renderBuildResult(result: BuildRunResult): void {
  const g = result.graph;
  console.log(`${pc.green('✓')} graph.json 생성 (${g.nodes.length} nodes, ${g.sources.length} sources, ${g.edges.length} edges)`);
}
