import { stringify as yamlStringify } from 'yaml';
import type { CodespoonConfig } from '../core/config.js';
import { REQUIRED_SECTIONS } from '../core/types.js';

export interface CreatePromptOptions {
  id: string;
  entry: string;
  sources: string[];
  config: CodespoonConfig;
}

export function buildCreatePrompt(opts: CreatePromptOptions): string {
  const { id, entry, sources, config } = opts;

  const parts: string[] = [];

  parts.push(`You are creating a new domain knowledge node for a codebase.`);
  parts.push(``);
  parts.push(`## Task`);
  parts.push(`Create a knowledge node that documents the domain or feature accessed through the entry point below.`);
  parts.push(`The node should explain what this domain does, how it works, and where the relevant code is.`);
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

  parts.push(`## Frontmatter Template`);
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

  parts.push(`## Format Requirements`);
  parts.push(`- Frontmatter must be valid YAML between --- markers`);
  parts.push(`- Required sections: ${REQUIRED_SECTIONS.join(', ')}`);
  parts.push(`- Sources paths must be relative to repo root`);
  parts.push(`- No absolute paths in body`);
  parts.push(`- Max node length: ${config.max_node_chars} chars`);
  parts.push(``);

  parts.push(`## Body Structure`);
  parts.push(`For each required section, add a "## Section Name" heading followed by relevant content.`);
  parts.push(`Include concrete file paths and symbol names in the body.`);
  parts.push(`The "Source Trace" section should list each source file with the key symbols it exports.`);
  parts.push(``);

  parts.push(`## Output`);
  parts.push(`Return only the node file content (frontmatter + body) with no additional explanation.`);
  parts.push(`The output must be a valid markdown file with YAML frontmatter.`);

  return parts.join('\n');
}
