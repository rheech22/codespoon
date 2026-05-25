import { AUTO_TRAILER, isKnowledgeDirOnly } from './commit.js';

export function shouldSkipDueToTrailer(lastCommitMessage: string): boolean {
  return lastCommitMessage.includes(AUTO_TRAILER);
}

export function shouldSkipDueToKnowledgeDir(
  changedFiles: string[],
  knowledgeDir: string,
): boolean {
  return isKnowledgeDirOnly(changedFiles, knowledgeDir);
}

export function buildSocketMessage(repoPath: string, sha: string): string {
  return JSON.stringify({ type: 'process', repo: repoPath, sha });
}
