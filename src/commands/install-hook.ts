import { writeFileSync, existsSync, readFileSync, appendFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import pc from 'picocolors';
import { buildPostCommitHook } from '../templates/hooks/post-commit.js';
import { AGENTS_MD_INJECTION } from '../templates/agents-md-injection.js';
import { loadConfigStrict, ConfigError } from '../core/config.js';
import { socketPath } from '../daemon/lifecycle.js';

export interface InstallHookOptions {
  dir: string;
}

export interface InstallHookResult {
  hookInstalled: boolean;
  agentsMdUpdated: boolean;
  claudeMdUpdated: boolean;
  errors: string[];
}

export function runInstallHook(options: InstallHookOptions): InstallHookResult {
  const root = resolve(options.dir);
  const result: InstallHookResult = {
    hookInstalled: false,
    agentsMdUpdated: false,
    claudeMdUpdated: false,
    errors: [],
  };

  let config;
  try { config = loadConfigStrict(root); }
  catch (e) {
    result.errors.push(e instanceof ConfigError ? e.message : String(e));
    return result;
  }
  const knowledgeDir = config.knowledge_dir;

  const gitHooksDir = resolve(root, '.git', 'hooks');
  const hookPath = resolve(gitHooksDir, 'post-commit');

  if (!existsSync(gitHooksDir)) {
    result.errors.push('.git/hooks directory not found');
    return result;
  }

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, 'utf-8');
    if (existing.includes('Codespoon-Auto')) {
      result.errors.push('post-commit hook is already installed');
      return result;
    }
    result.errors.push('.git/hooks/post-commit already exists but is not a CodeSpoon hook. Back up the existing hook and re-run, or merge manually.');
    return result;
  }

  const hookContent = buildPostCommitHook(knowledgeDir, socketPath());
  writeFileSync(hookPath, hookContent, 'utf-8');
  chmodSync(hookPath, 0o755);
  result.hookInstalled = true;

  const agentsMdPath = resolve(root, 'AGENTS.md');
  if (existsSync(agentsMdPath)) {
    const content = readFileSync(agentsMdPath, 'utf-8');
    if (!content.includes('codespoon spoon')) {
      appendFileSync(agentsMdPath, '\n\n' + AGENTS_MD_INJECTION + '\n');
      result.agentsMdUpdated = true;
    }
  } else {
    writeFileSync(agentsMdPath, AGENTS_MD_INJECTION + '\n', 'utf-8');
    result.agentsMdUpdated = true;
  }

  const claudeMdPath = resolve(root, 'CLAUDE.md');
  if (existsSync(claudeMdPath)) {
    const content = readFileSync(claudeMdPath, 'utf-8');
    if (!content.includes('codespoon spoon')) {
      appendFileSync(claudeMdPath, '\n\n' + AGENTS_MD_INJECTION + '\n');
      result.claudeMdUpdated = true;
    }
  }

  return result;
}

export function renderInstallHookResult(result: InstallHookResult): void {
  if (result.hookInstalled) {
    console.log(`${pc.green('✓')} .git/hooks/post-commit installed`);
    console.log(`${pc.cyan('→')} Make sure codespoon is on your PATH: ${pc.dim('`which codespoon`')}`);
  }
  if (result.agentsMdUpdated) {
    console.log(`${pc.green('✓')} Added spoon guidance to AGENTS.md`);
  }
  if (result.claudeMdUpdated) {
    console.log(`${pc.green('✓')} Added spoon guidance to CLAUDE.md`);
  }
  for (const err of result.errors) {
    console.log(`${pc.yellow('!')} ${err}`);
  }
}
