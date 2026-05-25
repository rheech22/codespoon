export const AUTO_TRAILER = 'Codespoon-Auto: true';
export const COMMIT_PREFIX = 'docs(codespoon): auto-update for';

export interface AutoCommitOptions {
  shortOriginalSha: string;
  affectedNodeIds: string[];
  pathsToStage: string[];
}

export interface CommitResult {
  sha: string;
  success: boolean;
  retries: number;
  error?: string;
}

export function buildAutoCommitMessage(opts: {
  shortOriginalSha: string;
  affectedNodeIds: string[];
}): string {
  const lines: string[] = [
    `${COMMIT_PREFIX} ${opts.shortOriginalSha}`,
    '',
    `영향 노드: ${opts.affectedNodeIds.join(', ')}`,
    `원본 commit: ${opts.shortOriginalSha}`,
    '',
    AUTO_TRAILER,
  ];
  return lines.join('\n');
}

export function hasAutoTrailer(message: string): boolean {
  return message.includes(AUTO_TRAILER);
}

export function isKnowledgeDirOnly(changedFiles: string[], knowledgeDir: string): boolean {
  if (changedFiles.length === 0) return false;
  return changedFiles.every(f => f.startsWith(knowledgeDir));
}
