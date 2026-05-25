import { resolve } from 'node:path';
import { simpleGit } from 'simple-git';
import type { SimpleGit } from 'simple-git';
import type { ChangedFile, VcsAdapter } from './index.js';

export class GitAdapter implements VcsAdapter {
  private git: SimpleGit;

  constructor(workingDir: string) {
    this.git = simpleGit(workingDir);
  }

  async getChangedFiles(sha: string): Promise<ChangedFile[]> {
    return this.diffTree(sha);
  }

  async diffTree(sha: string): Promise<ChangedFile[]> {
    const result = await this.git.raw(['diff-tree', '--no-commit-id', '--name-status', '-r', sha]);
    return this.parseStatusOutput(result);
  }

  async stage(paths: string[]): Promise<void> {
    await this.git.add(paths);
  }

  async commit(message: string): Promise<string> {
    const result = await this.git.commit(message);
    return result.commit || '';
  }

  async getLastCommitMessage(): Promise<string> {
    const log = await this.git.log(['-1', '--format=%B']);
    return log.latest?.message || '';
  }

  async getShortSha(sha: string): Promise<string> {
    const result = await this.git.raw(['rev-parse', '--short', sha]);
    return result.trim();
  }

  async getRepoRoot(): Promise<string> {
    const result = await this.git.revparse(['--show-toplevel']);
    return resolve(result.trim());
  }

  async hasUncommittedChanges(): Promise<boolean> {
    const status = await this.git.status();
    return status.files.length > 0;
  }

  private parseStatusOutput(output: string): ChangedFile[] {
    const lines = output.trim().split('\n').filter(Boolean);
    return lines.map((line) => {
      const parts = line.split('\t');
      const statusChar = parts[0][0];
      const path = parts[parts.length - 1];
      let status: ChangedFile['status'] = 'modified';
      if (statusChar === 'A') status = 'added';
      else if (statusChar === 'D') status = 'deleted';
      else if (statusChar === 'R') status = 'renamed';
      return { path, status };
    });
  }
}
