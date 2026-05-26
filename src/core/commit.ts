import { stringify as yamlStringify } from 'yaml';
import matter from 'gray-matter';

export const AUTO_TRAILER = 'Codespoon-Auto: true';
export const COMMIT_PREFIX = 'docs(codespoon): auto-update for';

export function buildAutoCommitMessage(opts: {
  shortOriginalSha: string;
  affectedNodeIds: string[];
}): string {
  const lines: string[] = [
    `${COMMIT_PREFIX} ${opts.shortOriginalSha}`,
    '',
    `Affected nodes: ${opts.affectedNodeIds.join(', ')}`,
    `Source commit: ${opts.shortOriginalSha}`,
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

export function updateNodeMetadata(raw: string, sha: string): string | null {
  const parsed = matter(raw);
  if (!parsed.data || Object.keys(parsed.data).length === 0) return null;

  const updated = {
    ...parsed.data,
    last_updated_commit: sha,
    last_updated_at: new Date().toISOString().slice(0, 10),
  };

  return `---\n${yamlStringify(updated).trimEnd()}\n---\n${parsed.content}`;
}
