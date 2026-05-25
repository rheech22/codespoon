import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import matter from 'gray-matter';
import fg from 'fast-glob';
import { FrontmatterSchema } from './types.js';
import type { Graph, GraphNode, GraphSource, GraphEdge, NodeDocument } from './types.js';
import type { CodespoonConfig } from './config.js';
import { nodesDir } from './paths.js';

function extractTitle(body: string): string {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '';
}

export function generateGraphFromNodes(nodes: NodeDocument[]): Graph {
  const graphNodes: GraphNode[] = [];
  const graphSources: GraphSource[] = [];
  const graphEdges: GraphEdge[] = [];

  for (const node of nodes) {
    const fm = node.frontmatter;

    graphNodes.push({
      id: fm.id,
      kind: fm.kind,
      title: node.title || fm.id,
      path: node.path,
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

export function generateGraph(repoRoot: string, config: CodespoonConfig): Graph {
  const nd = nodesDir(repoRoot, config);
  const files = fg.sync('*.md', { cwd: nd, absolute: true });

  const nodes: NodeDocument[] = [];

  for (const filePath of files) {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = matter(raw);
    const result = FrontmatterSchema.safeParse(parsed.data);
    if (!result.success) continue;

    nodes.push({
      frontmatter: result.data,
      body: parsed.content,
      title: extractTitle(parsed.content),
      path: relative(repoRoot, filePath),
    });
  }

  return generateGraphFromNodes(nodes);
}
