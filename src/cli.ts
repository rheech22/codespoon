#!/usr/bin/env node

import { cac } from 'cac';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInit, renderInitResult, renderGitignoreHint } from './commands/init.js';
import { runValidate, renderValidateResult, renderValidateResultJson } from './commands/validate.js';
import { runBuild, renderBuildResult } from './commands/build.js';

const cli = cac('codespoon');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let pkg: { version: string };
try {
  pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));
} catch {
  pkg = { version: '0.1.0' };
}

cli.version(pkg.version);
cli.help();

cli.command('init', 'Create config file and directory structure')
  .option('--dir <path>', 'Target directory (default: cwd)', { default: '.' })
  .option('--write-gitignore', 'Auto-add .gitignore entries')
  .action((options: { dir?: string; writeGitignore?: boolean }) => {
    const dir = options.dir!;
    const result = runInit({ dir, writeGitignore: !!options.writeGitignore });
    renderInitResult(result);
    if (!options.writeGitignore) {
      renderGitignoreHint();
    }
  });

cli.command('validate [...files]', 'Validate knowledge nodes')
  .option('--dir <path>', 'Repository root directory (default: cwd)', { default: '.' })
  .option('--strict', 'Treat warnings as errors')
  .option('--json', 'Output as JSON')
  .action((files: string[], options: { dir?: string; strict?: boolean; json?: boolean }) => {
    const dir = options.dir!;
    const result = runValidate({ dir, strict: !!options.strict, files: files || [] });
    if (options.json) {
      renderValidateResultJson(result);
    } else {
      renderValidateResult(resolve(dir), result);
    }
    process.exit(result.exitCode);
  });

cli.command('build', 'Regenerate graph.json from node files')
  .option('--dir <path>', 'Repository root directory (default: cwd)', { default: '.' })
  .action((options: { dir?: string }) => {
    const dir = options.dir!;
    const result = runBuild({ dir });
    renderBuildResult(result);
  });

cli.parse();
