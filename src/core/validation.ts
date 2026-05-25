import { readFileSync, existsSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import matter from 'gray-matter';
import pm from 'picomatch';
import { FrontmatterSchema, REQUIRED_SECTIONS } from './types.js';
import type { Frontmatter } from './types.js';
import type { CodespoonConfig } from './config.js';

export interface ValidationMessage {
  type: 'error' | 'warning';
  file?: string;
  message: string;
}

export interface ValidationResult {
  passed: boolean;
  messages: ValidationMessage[];
}

export interface ValidateSummary {
  total: number;
  passed: number;
  failed: number;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
}

export interface CheckContext {
  frontmatter: Frontmatter | null;
  body: string;
  raw: string;
  rootDir: string;
  config: CodespoonConfig;
  filePath?: string;
}

type Check = (ctx: CheckContext) => ValidationMessage[];

function hasFileExtension(word: string): boolean {
  return /\.[a-zA-Z]\w+$/.test(word);
}

const checkFrontmatterExists: Check = (ctx) => {
  if (!ctx.frontmatter) {
    return [{ type: 'error', file: ctx.filePath, message: 'Frontmatter is empty or missing' }];
  }
  return [];
};

const checkSourcesNoAbsolute: Check = (ctx) => {
  if (!ctx.frontmatter) return [];
  const msgs: ValidationMessage[] = [];
  for (const source of ctx.frontmatter.sources) {
    if (isAbsolute(source.path)) {
      msgs.push({ type: 'error', file: ctx.filePath, message: `Source path is absolute: "${source.path}"` });
    }
  }
  return msgs;
};

const checkSourcesExist: Check = (ctx) => {
  if (!ctx.frontmatter) return [];
  const msgs: ValidationMessage[] = [];
  for (const source of ctx.frontmatter.sources) {
    if (isAbsolute(source.path)) continue;
    const fullPath = join(ctx.rootDir, source.path);
    if (!existsSync(fullPath)) {
      msgs.push({ type: 'warning', file: ctx.filePath, message: `Source path does not exist: "${source.path}"` });
    }
  }
  return msgs;
};

const checkSourcesSymbols: Check = (ctx) => {
  if (!ctx.frontmatter) return [];
  const msgs: ValidationMessage[] = [];
  for (const source of ctx.frontmatter.sources) {
    if (source.symbols.length === 0) {
      msgs.push({ type: 'warning', file: ctx.filePath, message: `Source "${source.path}" has no symbols` });
    }
  }
  if (ctx.frontmatter.sources.length === 0) {
    msgs.push({ type: 'warning', file: ctx.filePath, message: 'No sources defined' });
  }
  return msgs;
};

const checkGeneratedPaths: Check = (ctx) => {
  if (!ctx.frontmatter) return [];
  const msgs: ValidationMessage[] = [];
  for (const genPath of ctx.config.generated_paths) {
    const isMatch = pm(genPath);
    const matched = ctx.frontmatter.sources.some(s => isMatch(s.path));
    if (matched) {
      msgs.push({ type: 'warning', file: ctx.filePath, message: `Source path matches generated_paths pattern: "${genPath}"` });
    }
  }
  return msgs;
};

const checkRequiredSections: Check = (ctx) => {
  const headingRegex = /^##\s+(.+)$/gm;
  const headings: string[] = [];
  let match;
  while ((match = headingRegex.exec(ctx.body)) !== null) {
    headings.push(match[1].trim());
  }
  const msgs: ValidationMessage[] = [];
  for (const section of REQUIRED_SECTIONS) {
    if (!headings.includes(section)) {
      msgs.push({ type: 'error', file: ctx.filePath, message: `Missing required section: "${section}"` });
    }
  }
  return msgs;
};

const checkOpenQuestions: Check = (ctx) => {
  const match = ctx.body.match(/^## Open Questions\s*\n+([\s\S]*?)(?=\n## |\n*$)/m);
  if (match) {
    const content = match[1].trim();
    if (!content) {
      return [{ type: 'warning', file: ctx.filePath, message: 'Open Questions section is empty' }];
    }
  }
  return [];
};

const checkMaxChars: Check = (ctx) => {
  if (ctx.raw.length > ctx.config.max_node_chars) {
    return [{
      type: 'warning',
      file: ctx.filePath,
      message: `Node length (${ctx.raw.length} chars) exceeds max_node_chars (${ctx.config.max_node_chars})`,
    }];
  }
  return [];
};

function extractAbsolutePathsFromLine(line: string): string[] {
  const found: string[] = [];

  const linkTargetRegex = /\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = linkTargetRegex.exec(line)) !== null) {
    const target = m[1];
    const firstSpace = target.search(/\s/);
    const url = firstSpace === -1 ? target : target.slice(0, firstSpace);
    if (url.startsWith('/') && !url.startsWith('//') && hasFileExtension(url)) {
      found.push(url);
    }
  }

  const noLinkText = line.replace(/\[([^\]]*)\]\([^)]*\)/g, '');
  const candidates = noLinkText.match(/\/[^\s()\][{}]+\.\w+/g) || [];
  for (const c of candidates) {
    const clean = c.replace(/[`'",;.!?\)>]+$/, '');
    if (!clean.startsWith('//') && isAbsolute(clean) && hasFileExtension(clean)) {
      found.push(clean);
    }
  }

  return found;
}

const checkBodyAbsolutePaths: Check = (ctx) => {
  const lines = ctx.body.split('\n');
  let inCodeFence = false;
  const msgs: ValidationMessage[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith('```')) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;
    const absPaths = extractAbsolutePathsFromLine(line);
    for (const p of absPaths) {
      msgs.push({ type: 'error', file: ctx.filePath, message: `Absolute path found in body at line ${i + 1}: "${p}"` });
    }
  }
  return msgs;
};

const CHECKS: Check[] = [
  checkFrontmatterExists,
  checkSourcesNoAbsolute,
  checkSourcesExist,
  checkSourcesSymbols,
  checkGeneratedPaths,
  checkRequiredSections,
  checkOpenQuestions,
  checkMaxChars,
  checkBodyAbsolutePaths,
];

export function validateNodeContent(
  raw: string,
  opts: { rootDir: string; config: CodespoonConfig; filePath?: string },
): ValidationResult {
  const ctx: CheckContext = {
    frontmatter: null,
    body: '',
    raw,
    rootDir: opts.rootDir,
    config: opts.config,
    filePath: opts.filePath,
  };

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch {
    const msgs = [{ type: 'error' as const, file: opts.filePath, message: 'Invalid or unparseable frontmatter' }];
    return { passed: false, messages: msgs };
  }

  ctx.body = parsed.content;

  const schemaErrors: ValidationMessage[] = [];

  if (parsed.data && Object.keys(parsed.data).length > 0) {
    const result = FrontmatterSchema.safeParse(parsed.data);
    if (result.success) {
      ctx.frontmatter = result.data;
    } else {
      for (const issue of result.error.issues) {
        schemaErrors.push({ type: 'error', file: opts.filePath, message: `Frontmatter: ${issue.path.join('.')} — ${issue.message}` });
      }
    }
  }

  const messages = [...schemaErrors, ...CHECKS.flatMap(check => check(ctx))];
  const hasError = messages.some(m => m.type === 'error');
  return { passed: !hasError, messages };
}

export function validateNodeFile(
  filePath: string,
  rootDir: string,
  config: CodespoonConfig,
): ValidationResult {
  return validateNodeContent(readFileSync(filePath, 'utf-8'), { rootDir, config, filePath });
}

export function summarizeResults(results: ValidationResult[]): ValidateSummary {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];
  let passed = 0;
  let failed = 0;

  for (const r of results) {
    if (r.passed) passed++;
    else failed++;
    for (const m of r.messages) {
      if (m.type === 'error') errors.push(m);
      else warnings.push(m);
    }
  }

  return { total: results.length, passed, failed, errors, warnings };
}
