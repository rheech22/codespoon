import matter from 'gray-matter';
import type { NodeDocument } from '../core/types.js';
import type { CodespoonConfig } from '../core/config.js';
import type { ValidationMessage } from '../core/validation.js';
import { validateNodeContent } from '../core/validation.js';
import { buildUpdatePrompt } from './prompt-builder.js';
import type { AgentAdapter } from '../adapters/agent/index.js';
import type { ChangedFile } from '../adapters/vcs/index.js';
import { runAgentLoop } from './agent-loop.js';

export interface ProcessNodeOptions {
  nodePath: string;
  node: NodeDocument;
  changedFiles: ChangedFile[];
  config: CodespoonConfig;
  agent: AgentAdapter;
  repoRoot: string;
  runDir: string;
}

export interface ProcessNodeResult {
  success: boolean;
  needsReview: boolean;
  attempts: number;
  finalContent?: string;
  error?: string;
}

export function parseAgentOutput(raw: string): { frontmatter: Record<string, unknown>; body: string } | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('---')) return null;

  try {
    const parsed = matter(trimmed);
    if (!parsed.data || Object.keys(parsed.data).length === 0) return null;
    return {
      frontmatter: parsed.data as Record<string, unknown>,
      body: parsed.content,
    };
  } catch {
    return null;
  }
}

export function extractUpdatedFilename(raw: string, defaultId: string): string {
  const parsed = parseAgentOutput(raw);
  if (parsed && parsed.frontmatter.id && typeof parsed.frontmatter.id === 'string') {
    return `${parsed.frontmatter.id}.md`;
  }
  return `${defaultId}.md`;
}

export async function processNode(opts: ProcessNodeOptions): Promise<ProcessNodeResult> {
  const { nodePath, node, changedFiles, config, agent, repoRoot, runDir } = opts;

  return runAgentLoop({
    buildPrompt: (previousErrors?: ValidationMessage[]) => buildUpdatePrompt({
      node,
      changedFiles,
      config,
      validationErrors: previousErrors,
      isRetry: !!previousErrors,
    }),
    agent,
    validate: (output) => {
      const result = validateNodeContent(output, { rootDir: repoRoot, config, filePath: nodePath });
      if (!result.passed) return result;
      const parsed = parseAgentOutput(output);
      if (parsed && parsed.frontmatter.id !== node.frontmatter.id) {
        return {
          passed: false,
          messages: [{ type: 'error', message: `id must remain "${node.frontmatter.id}". Agent changed it to "${String(parsed.frontmatter.id)}"` }],
        };
      }
      return result;
    },
    config,
    repoRoot,
    runDir,
    identifier: node.frontmatter.id,
  });
}
