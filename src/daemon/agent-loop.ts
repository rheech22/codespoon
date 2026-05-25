import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AgentAdapter } from '../adapters/agent/index.js';
import type { CodespoonConfig } from '../core/config.js';
import type { ValidationMessage } from '../core/validation.js';
import { getLogger } from '../core/logger.js';

export interface AgentLoopOptions {
  buildPrompt: (previousErrors?: ValidationMessage[]) => string;
  agent: AgentAdapter;
  validate: (output: string) => { passed: boolean; messages: ValidationMessage[] };
  config: CodespoonConfig;
  repoRoot: string;
  runDir: string;
  identifier: string;
}

export interface AgentLoopResult {
  success: boolean;
  needsReview: boolean;
  attempts: number;
  finalContent?: string;
  error?: string;
}

export async function runAgentLoop(opts: AgentLoopOptions): Promise<AgentLoopResult> {
  const { buildPrompt, agent, validate, config, repoRoot, runDir, identifier } = opts;
  const log = getLogger();
  const maxRetries = config.retry_count;
  let lastValidationErrors: ValidationMessage[] = [];
  let lastAgentOutput = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    log.info(`[agent-loop] ${identifier}: attempt ${attempt}/${maxRetries}`);

    const prompt = buildPrompt(attempt > 1 ? lastValidationErrors : undefined);

    let result;
    try {
      result = await agent.invoke(prompt, {
        dir: repoRoot,
        model: config.agent.model,
        timeoutMs: config.agent.invoke_timeout_seconds * 1000,
      });
    } catch (err) {
      log.error(`[agent-loop] agent invoke failed:`, err);
      if (attempt < maxRetries) continue;
      return { success: false, needsReview: true, attempts: attempt, error: `Agent invoke error: ${(err as Error).message}` };
    }

    const output = result.stdout.trim();
    lastAgentOutput = output;

    if (!output) {
      lastValidationErrors = [{ type: 'error', message: 'Previous attempt returned empty output' }];
      if (attempt < maxRetries) continue;
      return { success: false, needsReview: true, attempts: attempt, error: 'Agent returned empty output' };
    }

    const validationResult = validate(output);
    if (validationResult.passed) {
      return { success: true, needsReview: false, attempts: attempt, finalContent: output };
    }

    lastValidationErrors = validationResult.messages;
  }

  const failedPath = resolve(runDir, `${identifier}.failed.md`);
  mkdirSync(runDir, { recursive: true });
  const failedContent = [
    `# Failed: ${identifier}`,
    '',
    `Attempts: ${maxRetries}`,
    '',
    '## Validation Errors',
    ...lastValidationErrors.map(e => `- ${e.type}: ${e.message}`),
    '',
    '## Last Agent Output',
    '```',
    lastAgentOutput,
    '```',
  ].join('\n');
  writeFileSync(failedPath, failedContent, 'utf-8');

  return { success: false, needsReview: true, attempts: maxRetries, error: `Validation failed after ${maxRetries} attempts` };
}
