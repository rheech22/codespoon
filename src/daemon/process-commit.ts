import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import matter from 'gray-matter';
import type { VcsAdapter } from '../adapters/vcs/index.js';
import type { AgentAdapter } from '../adapters/agent/index.js';
import type { CodespoonConfig } from '../core/config.js';
import { loadConfigStrict } from '../core/config.js';
import { FrontmatterSchema } from '../core/types.js';
import type { Graph, NodeDocument } from '../core/types.js';
import { generateGraph } from '../core/graph.js';
import { findAffectedNodes } from '../core/impact.js';
import { buildAutoCommitMessage, updateNodeMetadata } from '../core/commit.js';
import { processNode } from './process-node.js';
import { knowledgeDir, nodesDir } from '../core/paths.js';
import { getLogger } from '../core/logger.js';

export interface ProcessCommitOptions {
  repoRoot: string;
  sha: string;
  vcs: VcsAdapter;
  agent: AgentAdapter;
}

export interface ProcessNodeOutcome {
  nodeId: string;
  success: boolean;
  needsReview: boolean;
  attempts: number;
  error?: string;
}

export interface ProcessCommitResult {
  affectedCount: number;
  processed: ProcessNodeOutcome[];
  needsReviewCount: number;
  autoCommitted: boolean;
  error?: string;
}

function loadGraph(repoRoot: string, config: CodespoonConfig): Graph | null {
  const gp = resolve(knowledgeDir(repoRoot, config), 'graph.json');
  if (!existsSync(gp)) return null;
  try {
    return JSON.parse(readFileSync(gp, 'utf-8')) as Graph;
  } catch {
    return null;
  }
}

async function tryCommit(
  vcs: VcsAdapter,
  message: string,
  paths: string[],
): Promise<void> {
  await vcs.stage(paths);

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await vcs.commit(message);
      return;
    } catch (err) {
      if (attempt === 5) throw err;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

export async function processCommit(opts: ProcessCommitOptions): Promise<ProcessCommitResult> {
  const { repoRoot, sha, vcs, agent } = opts;
  const log = getLogger();

  const config = loadConfigStrict(repoRoot);

  let graph = loadGraph(repoRoot, config);
  if (!graph) {
    return { affectedCount: 0, processed: [], needsReviewCount: 0, autoCommitted: false, error: 'graph.json not found. Run `codespoon build` or `codespoon bootstrap` first.' };
  }

  const changedFiles = await vcs.getChangedFiles(sha);

  if (changedFiles.length === 0) {
    return { affectedCount: 0, processed: [], needsReviewCount: 0, autoCommitted: false, error: 'No changed files' };
  }

  const affectedNodeIds = findAffectedNodes(
    changedFiles.map(f => f.path),
    graph,
  );

  if (affectedNodeIds.length === 0) {
    log.info(`[process-commit] no nodes affected by ${sha}`);
    return { affectedCount: 0, processed: [], needsReviewCount: 0, autoCommitted: false };
  }

  const nd = nodesDir(repoRoot, config);
  const kDir = knowledgeDir(repoRoot, config);
  const runDir = resolve(repoRoot, config.state_dir, 'runs', sha.slice(0, 7));

  const processed: ProcessNodeOutcome[] = [];
  const modifiedPaths: string[] = [];
  let needsReviewCount = 0;

  for (const nodeId of affectedNodeIds) {
    const nodePath = resolve(nd, `${nodeId}.md`);
    if (!existsSync(nodePath)) {
      log.warn(`[process-commit] node file not found: ${nodeId}`);
      continue;
    }

    const raw = readFileSync(nodePath, 'utf-8');
    const parsed = matter(raw);
    const fmResult = FrontmatterSchema.safeParse(parsed.data);
    if (!fmResult.success) {
      log.warn(`[process-commit] invalid frontmatter in ${nodeId}, skipping`);
      continue;
    }

    const match = parsed.content.match(/^#\s+(.+)$/m);
    const title = match ? match[1].trim() : '';

    const node: NodeDocument = {
      frontmatter: fmResult.data,
      body: parsed.content,
      title,
      path: relative(repoRoot, nodePath),
    };

    const nodeResult = await processNode({
      nodePath,
      node,
      changedFiles,
      config,
      agent,
      repoRoot,
      runDir,
    });

    if (nodeResult.success) {
      // Agent wrote the file directly. Apply metadata post-processing in place.
      const written = readFileSync(nodePath, 'utf-8');
      const stamped = updateNodeMetadata(written, sha);
      const finalContent = stamped ?? written;

      if (raw !== finalContent) {
        writeFileSync(nodePath, finalContent, 'utf-8');
        modifiedPaths.push(relative(repoRoot, nodePath));
      }
    }

    const outcome: ProcessNodeOutcome = {
      nodeId,
      success: nodeResult.success,
      needsReview: nodeResult.needsReview,
      attempts: nodeResult.attempts,
      error: nodeResult.error,
    };

    processed.push(outcome);
    if (outcome.needsReview) needsReviewCount++;

    log.info(`[process-commit] node ${nodeId}: ${nodeResult.success ? 'updated' : 'failed'} (${nodeResult.attempts} attempts)`);
  }

  if (processed.length === 0) {
    return { affectedCount: affectedNodeIds.length, processed, needsReviewCount, autoCommitted: false };
  }

  const anySuccess = processed.some(p => p.success);
  if (!anySuccess) {
    return { affectedCount: affectedNodeIds.length, processed, needsReviewCount, autoCommitted: false, error: 'All nodes failed' };
  }

  const newGraph = generateGraph(repoRoot, config);
  newGraph.lastProcessedCommit = sha;

  const graphOutputPath = resolve(kDir, 'graph.json');
  const graphRelativePath = relative(repoRoot, graphOutputPath);
  writeFileSync(graphOutputPath, JSON.stringify(newGraph, null, 2) + '\n', 'utf-8');
  modifiedPaths.push(graphRelativePath);

  const shortSha = await vcs.getShortSha(sha);
  const commitMessage = buildAutoCommitMessage({ shortOriginalSha: shortSha, affectedNodeIds });

  try {
    await tryCommit(vcs, commitMessage, modifiedPaths);
  } catch (err) {
    log.error(`[process-commit] auto-commit failed:`, err);
    return { affectedCount: affectedNodeIds.length, processed, needsReviewCount, autoCommitted: false, error: `Auto-commit failed: ${(err as Error).message}` };
  }

  return { affectedCount: affectedNodeIds.length, processed, needsReviewCount, autoCommitted: true };
}
