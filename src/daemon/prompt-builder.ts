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
  validationErrors?: ValidationMessage[];
  isRetry: boolean;
}

export function buildUpdatePrompt(opts: PromptBuilderOptions): string {
  const { node, changedFiles, config, validationErrors, isRetry } = opts;

  const parts: string[] = [];

  parts.push(`You are updating a domain knowledge node for a codebase.`);
  parts.push(``);
  parts.push(`## Task`);
  parts.push(`Update the following knowledge node to reflect recent code changes.`);
  parts.push(`Only update sections that are affected by the changed files.`);
  parts.push(`Preserve the frontmatter schema exactly.`);
  parts.push(`Do not change the \`id\` field.`);
  parts.push(``);

  parts.push(`## Current Node Content`);
  parts.push(`\`\`\`markdown`);
  parts.push(`---`);
  parts.push(yamlStringify(node.frontmatter).trimEnd());
  parts.push(`---`);
  parts.push(node.body);
  parts.push(`\`\`\``);
  parts.push(``);

  parts.push(`## Changed Files`);
  for (const cf of changedFiles) {
    parts.push(`  ${cf.status}: ${cf.path}`);
  }
  parts.push(``);

  parts.push(`## Format Requirements`);
  parts.push(`- Frontmatter must be valid YAML between --- markers`);
  parts.push(`- Required sections: ${REQUIRED_SECTIONS.join(', ')}`);
  parts.push(`- Sources paths must be relative to repo root`);
  parts.push(`- No absolute paths in body`);
  parts.push(`- Max node length: ${config.max_node_chars} chars`);
  parts.push(``);

  parts.push(`## Output`);
  parts.push(`Return only the updated node file content (frontmatter + body) with no additional explanation.`);
  parts.push(`The output must be a valid markdown file with YAML frontmatter.`);

  if (isRetry && validationErrors && validationErrors.length > 0) {
    parts.push(``);
    parts.push(`## Previous Validation Errors (fix these)`);
    for (const err of validationErrors) {
      parts.push(`  ${err.type}: ${err.message}`);
    }
  }

  return parts.join('\n');
}
