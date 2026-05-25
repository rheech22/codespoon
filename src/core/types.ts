import { z } from 'zod';

export const SourceSchema = z.object({
  path: z.string(),
  symbols: z.array(z.string()).default([]),
});
export type Source = z.infer<typeof SourceSchema>;

export const ScopeSchema = z.object({
  include: z.array(z.string()).default([]),
  exclude: z.array(z.string()).default([]),
});
export type Scope = z.infer<typeof ScopeSchema>;

export const RelationConfidence = z.enum(['extracted', 'inferred', 'ambiguous']);
export type RelationConfidence = z.infer<typeof RelationConfidence>;

export const RelationSchema = z.object({
  target: z.string(),
  kind: z.string(),
  confidence: RelationConfidence,
});
export type Relation = z.infer<typeof RelationSchema>;

const dateStringRegex = /^\d{4}-\d{2}-\d{2}$/;

export const FrontmatterSchema = z.object({
  id: z.string(),
  kind: z.literal('domain'),
  status: z.enum(['auto-updated', 'needs-review', 'stale']),
  confidence: z.enum(['high', 'medium', 'low']),
  scope: ScopeSchema,
  sources: z.array(SourceSchema).default([]),
  relations: z.array(RelationSchema).default([]),
  last_updated_commit: z.string(),
  last_updated_at: z.preprocess(
    (val) => (val instanceof Date ? val.toISOString().slice(0, 10) : val),
    z.string().regex(dateStringRegex, 'Expected YYYY-MM-DD format'),
  ),
}).strict();
export type Frontmatter = z.infer<typeof FrontmatterSchema>;

export const REQUIRED_SECTIONS = [
  'Summary',
  'When To Use This Node',
  'Entry Points',
  'Key Code Paths',
  'Data And Event Flow',
  'Invariants',
  'Source Trace',
  'Open Questions',
] as const;

export interface NodeDocument {
  filePath: string;
  frontmatter: Frontmatter;
  body: string;
  raw: string;
}

export interface GraphNode {
  id: string;
  kind: string;
  title: string;
  path: string;
  status: string;
  confidence: string;
  lastUpdatedCommit: string;
}

export interface GraphSource {
  nodeId: string;
  path: string;
  symbols: string[];
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: string;
  confidence: string;
}

export interface Graph {
  version: number;
  generatedAt: string;
  lastProcessedCommit: string;
  nodes: GraphNode[];
  sources: GraphSource[];
  edges: GraphEdge[];
}
