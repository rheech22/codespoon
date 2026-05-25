import { stringify as yamlStringify } from 'yaml';
import type { CodespoonConfig } from '../core/config.js';
import { REQUIRED_SECTIONS } from '../core/types.js';
import type { ValidationMessage } from '../core/validation.js';

export interface CreatePromptOptions {
  id: string;
  entry: string;
  sources: string[];
  config: CodespoonConfig;
  nodePath: string;
  validationErrors?: ValidationMessage[];
  isRetry: boolean;
}

export function buildCreatePrompt(opts: CreatePromptOptions): string {
  const { id, entry, sources, config, nodePath, validationErrors, isRetry } = opts;

  const parts: string[] = [];

  parts.push(`You are creating a new domain knowledge node for a codebase.`);
  parts.push(``);
  parts.push(`## Task`);
  parts.push(`Create a knowledge node that documents the domain or feature accessed through the entry point below.`);
  parts.push(`The node should explain what this domain does, how it works, and where the relevant code is.`);
  parts.push(`Use your write tool to create the file at the path specified below.`);
  parts.push(``);

  parts.push(`## File Path to Write`);
  parts.push(nodePath);
  parts.push(``);

  parts.push(`## Node ID`);
  parts.push(id);
  parts.push(``);

  parts.push(`## Entry Point`);
  parts.push(entry);
  parts.push(``);

  parts.push(`## Source Files (related to this domain)`);
  for (const s of sources) {
    parts.push(`- ${s}`);
  }
  parts.push(``);

  parts.push(`## Frontmatter Template (use as starting point)`);
  const fm = {
    id,
    kind: 'domain',
    status: 'auto-updated',
    confidence: 'medium',
    scope: { include: sources, exclude: [] },
    sources: sources.map(s => ({ path: s, symbols: [] })),
    relations: [],
    last_updated_commit: 'init',
    last_updated_at: new Date().toISOString().slice(0, 10),
  };
  parts.push(yamlStringify(fm).trimEnd());
  parts.push(``);

  parts.push(`## Format Requirements (the file at ${nodePath} must satisfy these)`);
  parts.push(`- Frontmatter must be valid YAML between --- markers at the top of the file`);
  parts.push(`- Required sections (H2 headings): ${REQUIRED_SECTIONS.join(', ')}`);
  parts.push(`- Source paths in frontmatter must be relative to repo root (no leading /)`);
  parts.push(`- When referring to source files in body text, use the EXACT paths from the "Source Files" list above.`);
  parts.push(`- Do NOT strip prefixes such as "apps/", "src/", "packages/" etc.`);
  parts.push(`- Do NOT add leading slashes to file paths (those would be treated as absolute and rejected).`);
  parts.push(`- No absolute paths anywhere (paths starting with / like /Users/... or /web/...).`);
  parts.push(`- Max file length: ${config.max_node_chars} chars.`);
  parts.push(``);

  parts.push(`## Body Structure`);
  parts.push(`For each required section, add a "## Section Name" heading followed by relevant content.`);
  parts.push(`Include concrete file paths and symbol names in the body.`);
  parts.push(`The "Source Trace" section should list each source file with the key symbols it exports.`);
  parts.push(``);

  parts.push(`## What To Do`);
  parts.push(`1. Read the source files to understand the domain.`);
  parts.push(`2. Use your write tool to create \`${nodePath}\`.`);
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
