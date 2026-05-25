export interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
}

export interface CommitLogEntry {
  sha: string;
  message: string;
}

export interface VcsAdapter {
  getChangedFiles(sha: string): Promise<ChangedFile[]>;
  stage(paths: string[]): Promise<void>;
  commit(message: string): Promise<string>;
  getLastCommitMessage(): Promise<string>;
  getShortSha(sha: string): Promise<string>;
  getRepoRoot(): Promise<string>;
  diffTree(sha: string): Promise<ChangedFile[]>;
  hasUncommittedChanges(): Promise<boolean>;
}
