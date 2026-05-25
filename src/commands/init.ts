import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import pc from 'picocolors';
import { DEFAULT_CONFIG_YAML, README_KNOWLEDGE, GITIGNORE_RECOMMENDATION } from '../templates/config.js';

export interface InitOptions {
  dir: string;
  writeGitignore: boolean;
}

export interface InitResult {
  root: string;
  created: string[];
  skipped: string[];
}

export function runInit(options: InitOptions): InitResult {
  const root = resolve(options.dir);
  const created: string[] = [];
  const skipped: string[] = [];

  mkdirSync(root, { recursive: true });

  const configPath = join(root, 'codespoon.config.yaml');
  if (!existsSync(configPath)) {
    writeFileSync(configPath, DEFAULT_CONFIG_YAML, 'utf-8');
    created.push('codespoon.config.yaml');
  } else {
    skipped.push('codespoon.config.yaml');
  }

  const dirs = [
    join(root, 'docs', 'knowledge', 'nodes'),
    join(root, 'docs', 'knowledge', 'evaluations'),
    join(root, '.codespoon', 'cache'),
    join(root, '.codespoon', 'runs'),
  ];
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      created.push(relative(root, dir) + '/');
    } else {
      skipped.push(relative(root, dir) + '/');
    }
  }

  const readmePath = join(root, 'docs', 'knowledge', 'README.md');
  if (!existsSync(readmePath)) {
    writeFileSync(readmePath, README_KNOWLEDGE, 'utf-8');
    created.push(relative(root, readmePath));
  }

  if (options.writeGitignore) {
    const gitignorePath = join(root, '.gitignore');
    const entries = GITIGNORE_RECOMMENDATION.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (!existsSync(gitignorePath)) {
      writeFileSync(gitignorePath, GITIGNORE_RECOMMENDATION, 'utf-8');
      created.push('.gitignore');
    } else {
      const existing = readFileSync(gitignorePath, 'utf-8');
      const missing = entries.filter(e => !existing.includes(e));
      if (missing.length > 0) {
        appendFileSync(gitignorePath, '\n' + missing.join('\n') + '\n');
        created.push('.gitignore (' + missing.join(', ') + ' 추가)');
      } else {
        skipped.push('.gitignore');
      }
    }
  }

  return { root, created, skipped };
}

export function renderInitResult(result: InitResult): void {
  for (const item of result.created) {
    console.log(pc.green('✓'), item);
  }
  for (const item of result.skipped) {
    console.log(pc.yellow('→'), item + ' (이미 존재)');
  }
  console.log();
  console.log(pc.green('✓'), '초기화 완료');
  console.log(pc.dim(`  저장소: ${result.root}`));
}

export function renderGitignoreHint(): void {
  console.log();
  console.log(pc.cyan('  .gitignore에 다음 항목을 추가하는 것을 권장합니다:'));
  console.log(pc.dim('  ---'));
  for (const line of GITIGNORE_RECOMMENDATION.trim().split('\n')) {
    console.log(pc.dim(`  ${line}`));
  }
  console.log(pc.dim('  ---'));
  console.log(pc.dim('  codespoon init --write-gitignore 로 자동 추가할 수 있습니다.'));
}
