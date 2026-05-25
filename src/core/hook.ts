export function shouldSkipDueToTrailer(lastCommitMessage: string): boolean {
  return lastCommitMessage.includes('Codespoon-Auto: true');
}

export function shouldSkipDueToKnowledgeDir(
  changedFiles: string[],
  knowledgeDir: string,
): boolean {
  if (changedFiles.length === 0) return false;
  return changedFiles.every(f => f.startsWith(knowledgeDir));
}

export function buildSocketMessage(repoPath: string, sha: string): string {
  return JSON.stringify({ type: 'process', repo: repoPath, sha });
}
