import { resolve } from 'node:path';
import type { CodespoonConfig } from './config.js';

export function knowledgeDir(repoRoot: string, config: CodespoonConfig): string {
  return resolve(repoRoot, config.knowledge_dir);
}

export function nodesDir(repoRoot: string, config: CodespoonConfig): string {
  return resolve(knowledgeDir(repoRoot, config), 'nodes');
}

export function evaluationsDir(repoRoot: string, config: CodespoonConfig): string {
  return resolve(knowledgeDir(repoRoot, config), 'evaluations');
}

export function graphPath(repoRoot: string, config: CodespoonConfig): string {
  return resolve(knowledgeDir(repoRoot, config), 'graph.json');
}

export function stateDir(repoRoot: string, config: CodespoonConfig): string {
  return resolve(repoRoot, config.state_dir);
}

export function cacheDir(repoRoot: string, config: CodespoonConfig): string {
  return resolve(stateDir(repoRoot, config), 'cache');
}

export function runsDir(repoRoot: string, config: CodespoonConfig): string {
  return resolve(stateDir(repoRoot, config), 'runs');
}
