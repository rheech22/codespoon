import { resolve, relative } from 'node:path';
import fg from 'fast-glob';
import { validateNodeFile, summarizeResults } from '../core/validation.js';
import { loadConfig } from '../core/config.js';
import { nodesDir } from '../core/paths.js';
import type { ValidationResult, ValidateSummary } from '../core/validation.js';

export interface ValidateOptions {
  dir: string;
  strict: boolean;
  files?: string[];
}

export interface ValidateRunResult {
  exitCode: number;
  summary: ValidateSummary;
  results: ValidationResult[];
}

export function runValidate(options: ValidateOptions): ValidateRunResult {
  const root = resolve(options.dir);
  const { config } = loadConfig(root);

  let targets: string[];

  if (options.files && options.files.length > 0) {
    targets = options.files.map(f => resolve(root, f));
  } else {
    const nd = nodesDir(root, config);
    targets = fg.sync('*.md', { cwd: nd, absolute: true });
  }

  const results = targets.map(filePath => validateNodeFile(filePath, root, config));
  const summary = summarizeResults(results);

  const exitCode = (summary.errors.length > 0 || (options.strict && summary.warnings.length > 0)) ? 1 : 0;
  return { exitCode, summary, results };
}

export function renderValidateResult(root: string, result: ValidateRunResult): void {
  for (const msg of result.summary.errors) {
    console.log(`\x1b[31m×\x1b[0m ${shortPath(msg.file || '', root)}: ${msg.message}`);
  }
  for (const msg of result.summary.warnings) {
    console.log(`\x1b[33m!\x1b[0m ${shortPath(msg.file || '', root)}: ${msg.message}`);
  }

  const all = result.summary.total;
  const ok = result.summary.passed;
  const err = result.summary.failed;
  if (all === 0) {
    console.log('\x1b[33m→\x1b[0m 검증할 노드가 없습니다');
  } else if (err === 0) {
    console.log(`\x1b[32m✓ ${ok}/${all} 노드 통과\x1b[0m`);
  } else {
    console.log(`\x1b[31m× ${err}/${all} 노드 실패, ${ok}/${all} 노드 통과\x1b[0m`);
  }
}

export function renderValidateResultJson(result: ValidateRunResult): void {
  console.log(JSON.stringify({ summary: result.summary, results: result.results }, null, 2));
}

function shortPath(filePath: string, root: string): string {
  const rel = relative(root, filePath);
  return rel || filePath;
}
