import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AgentAdapter, InvokeResult } from '../adapters/agent/index.js';
import type { CodespoonConfig } from '../core/config.js';
import type { ValidationMessage } from '../core/validation.js';
import { getLogger } from '../core/logger.js';
import { normalizeBodyPathsInFile } from '../core/path-normalize.js';

/**
 * Agent invocation loop based on file output.
 *
 * The agent is expected to write/edit the file at `expectedPath` using its
 * native edit/write tool. We do not parse stdout for the node content — we
 * only check whether the file was written and whether it passes validation.
 *
 * This grain-with-the-agent approach removes the need for preamble stripping,
 * markdown fence handling, and other stdout normalization. The agent's stdout
 * may contain reasoning, tool traces, or summaries — we ignore it.
 */
export interface AgentLoopOptions {
  buildPrompt: (previousErrors?: ValidationMessage[]) => string;
  agent: AgentAdapter;
  validate: () => { passed: boolean; messages: ValidationMessage[] };
  config: CodespoonConfig;
  repoRoot: string;
  runDir: string;
  identifier: string;
  expectedPath: string;
}

export interface AgentLoopResult {
  success: boolean;
  needsReview: boolean;
  attempts: number;
  error?: string;
}

interface AttemptRecord {
  attempt: number;
  fileWritten: boolean;
  exitCode: number;
  durationMs: number;
  stdoutSnippet: string;
  stderrSnippet: string;
  validationMessages: ValidationMessage[];
}

export async function runAgentLoop(opts: AgentLoopOptions): Promise<AgentLoopResult> {
  const { buildPrompt, agent, validate, config, repoRoot, runDir, identifier, expectedPath } = opts;
  const log = getLogger();
  const maxRetries = config.retry_count;

  // Snapshot original content if file exists (for restore on terminal failure).
  const originalContent = existsSync(expectedPath) ? readFileSync(expectedPath, 'utf-8') : null;
  const initialMtime = existsSync(expectedPath) ? statSync(expectedPath).mtimeMs : 0;
  let lastSeenMtime = initialMtime;

  let lastValidationErrors: ValidationMessage[] = [];
  const history: AttemptRecord[] = [];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    log.info(`[agent-loop] ${identifier}: attempt ${attempt}/${maxRetries}`);

    const prompt = buildPrompt(attempt > 1 ? lastValidationErrors : undefined);

    let result: InvokeResult;
    try {
      result = await agent.invoke(prompt, {
        dir: repoRoot,
        model: config.agent.model,
        timeoutMs: config.agent.invoke_timeout_seconds * 1000,
      });
    } catch (err) {
      log.error(`[agent-loop] ${identifier}: agent invoke failed:`, err);
      if (attempt < maxRetries) continue;
      writeFailedFile(runDir, identifier, history, `Agent invoke error: ${(err as Error).message}`, originalContent);
      restoreOriginal(expectedPath, originalContent);
      return { success: false, needsReview: true, attempts: attempt, error: `Agent invoke error: ${(err as Error).message}` };
    }

    const currentMtime = existsSync(expectedPath) ? statSync(expectedPath).mtimeMs : 0;
    const fileWritten = currentMtime > lastSeenMtime;
    lastSeenMtime = currentMtime;

    if (!fileWritten) {
      log.warn(`[agent-loop] ${identifier}: agent did not write the file (path=${expectedPath}, exit=${result.exitCode}, dur=${result.durationMs}ms)`);
      history.push({
        attempt,
        fileWritten: false,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        stdoutSnippet: result.stdout.slice(0, 600),
        stderrSnippet: result.stderr.slice(0, 600),
        validationMessages: [],
      });
      lastValidationErrors = [{
        type: 'error',
        message: `You did not write the file at "${expectedPath}". Use your edit/write tool to create or update it.`,
      }];
      if (attempt < maxRetries) continue;
      writeFailedFile(runDir, identifier, history, `Agent did not write the file after ${maxRetries} attempts`, originalContent);
      restoreOriginal(expectedPath, originalContent);
      return { success: false, needsReview: true, attempts: attempt, error: 'Agent did not write the file' };
    }

    // Best-effort: rewrite body file references that look like absolute paths
    // but actually mean a known source (model often drops "apps/" prefix and
    // adds a leading slash). Only unambiguous matches are rewritten.
    const normalized = normalizeBodyPathsInFile(expectedPath);
    if (normalized) {
      log.info(`[agent-loop] ${identifier}: body paths normalized`);
    }

    const validationResult = validate();
    history.push({
      attempt,
      fileWritten: true,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      stdoutSnippet: result.stdout.slice(0, 600),
      stderrSnippet: result.stderr.slice(0, 600),
      validationMessages: validationResult.messages,
    });

    if (validationResult.passed) {
      return { success: true, needsReview: false, attempts: attempt };
    }

    lastValidationErrors = validationResult.messages;
  }

  // Terminal failure: snapshot broken content and restore original.
  const brokenContent = existsSync(expectedPath) ? readFileSync(expectedPath, 'utf-8') : null;
  writeFailedFile(runDir, identifier, history, `Validation failed after ${maxRetries} attempts`, brokenContent);
  restoreOriginal(expectedPath, originalContent);
  return { success: false, needsReview: true, attempts: maxRetries, error: `Validation failed after ${maxRetries} attempts` };
}

function restoreOriginal(expectedPath: string, originalContent: string | null): void {
  if (originalContent !== null) {
    writeFileSync(expectedPath, originalContent, 'utf-8');
  } else if (existsSync(expectedPath)) {
    try { unlinkSync(expectedPath); } catch {}
  }
}

function writeFailedFile(
  runDir: string,
  identifier: string,
  history: AttemptRecord[],
  finalError: string,
  brokenContent: string | null,
): void {
  const failedPath = resolve(runDir, `${identifier}.failed.md`);
  mkdirSync(runDir, { recursive: true });

  const parts: string[] = [
    `# Failed: ${identifier}`,
    '',
    `Final error: ${finalError}`,
    `Attempts: ${history.length}`,
    '',
  ];

  for (const record of history) {
    parts.push(`## Attempt ${record.attempt}`);
    parts.push(`- file written: ${record.fileWritten}`);
    parts.push(`- exit code: ${record.exitCode}`);
    parts.push(`- duration: ${record.durationMs}ms`);
    if (record.stderrSnippet) {
      parts.push('- stderr:');
      parts.push('  ```');
      for (const line of record.stderrSnippet.split('\n')) {
        parts.push(`  ${line}`);
      }
      parts.push('  ```');
    }
    if (record.stdoutSnippet) {
      parts.push('- stdout (first 600 chars):');
      parts.push('  ```');
      for (const line of record.stdoutSnippet.split('\n')) {
        parts.push(`  ${line}`);
      }
      parts.push('  ```');
    }
    if (record.validationMessages.length > 0) {
      parts.push('- validation messages:');
      for (const m of record.validationMessages) {
        parts.push(`  - ${m.type}: ${m.message}`);
      }
    }
    parts.push('');
  }

  if (brokenContent !== null) {
    parts.push('## Last Written File Content');
    parts.push('```markdown');
    parts.push(brokenContent);
    parts.push('```');
  }

  writeFileSync(failedPath, parts.join('\n'), 'utf-8');
  // Also save the raw broken file separately for easier inspection.
  if (brokenContent !== null) {
    const brokenPath = resolve(runDir, `${identifier}.broken.md`);
    writeFileSync(brokenPath, brokenContent, 'utf-8');
  }
}
