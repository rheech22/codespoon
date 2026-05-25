import matter from 'gray-matter';
import { readFileSync } from 'node:fs';
import type { NodeDocument } from '../core/types.js';
import type { CodespoonConfig } from '../core/config.js';
import type { ValidationMessage } from '../core/validation.js';
import { validateNodeFile } from '../core/validation.js';
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
  error?: string;
}

export async function processNode(opts: ProcessNodeOptions): Promise<ProcessNodeResult> {
  const { nodePath, node, changedFiles, config, agent, repoRoot, runDir } = opts;
  const expectedId = node.frontmatter.id;

  return runAgentLoop({
    buildPrompt: (previousErrors?: ValidationMessage[]) => buildUpdatePrompt({
      node,
      changedFiles,
      config,
      nodePath,
      validationErrors: previousErrors,
      isRetry: !!previousErrors,
    }),
    agent,
    validate: () => {
      const result = validateNodeFile(nodePath, repoRoot, config);
      if (!result.passed) return result;
      // Enforce id immutability: agent must not change the node id.
      try {
        const raw = readFileSync(nodePath, 'utf-8');
        const parsed = matter(raw);
        const writtenId = (parsed.data as { id?: unknown }).id;
        if (writtenId !== expectedId) {
          return {
            passed: false,
            messages: [{
              type: 'error',
              message: `id must remain "${expectedId}". Agent changed it to "${String(writtenId)}"`,
            }],
          };
        }
      } catch {
        // If we can't read/parse, validateNodeFile would have caught it.
      }
      return result;
    },
    config,
    repoRoot,
    runDir,
    identifier: expectedId,
    expectedPath: nodePath,
  });
}
