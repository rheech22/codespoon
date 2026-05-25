import { stringify as yamlStringify } from 'yaml';
import type { ChangedFile } from '../adapters/vcs/index.js';
import type { NodeDocument } from '../core/types.js';
import { REQUIRED_SECTIONS } from '../core/types.js';
import type { ValidationMessage } from '../core/validation.js';
import type { CodespoonConfig } from '../core/config.js';

export interface PromptBuilderOptions {
  node: NodeDocument;
  changedFiles: ChangedFile[];
  config: CodespoonConfig;
  nodePath: string;
  validationErrors?: ValidationMessage[];
  isRetry: boolean;
}

export function buildUpdatePrompt(opts: PromptBuilderOptions): string {
  const { node, changedFiles, config, nodePath, validationErrors, isRetry } = opts;

  const parts: string[] = [];

  parts.push(`You are updating a domain knowledge node for a codebase.`);
  parts.push(``);
  parts.push(`## Task`);
  parts.push(`Edit the file at \`${nodePath}\` to reflect the recent code changes listed below.`);
  parts.push(`Use your edit/write tool to update the file in place. Only modify sections affected by the changed files.`);
  parts.push(`Preserve the frontmatter schema exactly. Do not change the \`id\` field.`);
  parts.push(``);

  parts.push(`## File Path to Edit`);
  parts.push(nodePath);
  parts.push(``);

  parts.push(`## Current Node Content (for reference)`);
  parts.push(`---`);
  parts.push(yamlStringify(node.frontmatter).trimEnd());
  parts.push(`---`);
  parts.push(node.body);
  parts.push(``);

  parts.push(`## Changed Files`);
  for (const cf of changedFiles) {
    parts.push(`  ${cf.status}: ${cf.path}`);
  }
  parts.push(``);

  parts.push(`## Format Requirements (the file at ${nodePath} must satisfy these)`);
  parts.push(`- Frontmatter must be valid YAML between --- markers at the top of the file`);
  parts.push(`- Required sections (H2 headings): ${REQUIRED_SECTIONS.join(', ')}`);
  parts.push(`- Source paths in frontmatter must be relative to repo root (no leading /)`);
  parts.push(`- When referring to source files in body text, preserve the EXACT path as listed in frontmatter sources.`);
  parts.push(`- Do NOT strip prefixes such as "apps/", "src/", "packages/" etc.`);
  parts.push(`- Do NOT add leading slashes to file paths (those would be treated as absolute and rejected).`);
  parts.push(`- No absolute paths anywhere (paths starting with / like /Users/... or /web/...).`);
  parts.push(`- Max file length: ${config.max_node_chars} chars.`);
  parts.push(``);

  parts.push(`## What To Do`);
  parts.push(`1. Read the changed files if needed to understand the impact.`);
  parts.push(`2. Use your edit/write tool to update \`${nodePath}\` directly.`);
  parts.push(`3. Your stdout response is not used; only the file on disk matters.`);
  parts.push(`4. After writing, the file will be automatically validated.`);

  if (isRetry && validationErrors && validationErrors.length > 0) {
    parts.push(``);
    parts.push(`## Previous Validation Errors (the file you just wrote has these problems — fix them)`);
    for (const err of validationErrors) {
      parts.push(`  ${err.type}: ${err.message}`);
    }
    parts.push(``);
    parts.push(`Edit the file again to address each error above.`);
  }

  return parts.join('\n');
}
