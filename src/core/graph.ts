import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import matter from 'gray-matter';
import fg from 'fast-glob';
import { FrontmatterSchema } from './types.js';
import type { Graph, GraphNode, GraphSource, GraphEdge } from './types.js';
import type { CodespoonConfig } from './config.js';
import { nodesDir } from './paths.js';

export function generateGraph(repoRoot: string, config: CodespoonConfig): Graph {
  const nd = nodesDir(repoRoot, config);
  const files = fg.sync('*.md', { cwd: nd, absolute: true });

  const graphNodes: GraphNode[] = [];
  const graphSources: GraphSource[] = [];
  const graphEdges: GraphEdge[] = [];
  let latestDate = '';

  for (const filePath of files) {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = matter(raw);
    const result = FrontmatterSchema.safeParse(parsed.data);
    if (!result.success) continue;

    const fm = result.data;
    const fileRelativePath = relative(repoRoot, filePath);
    const title = extractTitle(parsed.content);

    graphNodes.push({
      id: fm.id,
      kind: fm.kind,
      title: title || fm.id,
      path: fileRelativePath,
      status: fm.status,
      confidence: fm.confidence,
      lastUpdatedCommit: fm.last_updated_commit,
    });

    for (const source of fm.sources) {
      graphSources.push({
        nodeId: fm.id,
        path: source.path,
        symbols: source.symbols,
      });
    }

    if (fm.relations) {
      for (const rel of fm.relations) {
        graphEdges.push({
          from: fm.id,
          to: rel.target,
          kind: rel.kind,
          confidence: rel.confidence,
        });
      }
    }

    if (fm.last_updated_at > latestDate) {
      latestDate = fm.last_updated_at;
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return {
    version: 1,
    generatedAt: today,
    lastProcessedCommit: '',
    nodes: graphNodes,
    sources: graphSources,
    edges: graphEdges,
  };
}

function extractTitle(body: string): string {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '';
}
