import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename, extname, relative } from 'node:path';
import fg from 'fast-glob';
import type { FrameworkAdapter, FrameworkCandidate } from './index.js';
import { loadTsconfigPaths, resolveAlias } from './tsconfig-paths.js';
import type { AliasMap } from './tsconfig-paths.js';

function extractImports(content: string): string[] {
  const imports: string[] = [];
  const regex = /from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function makeResolver(rootDir: string) {
  const aliasMap: AliasMap | null = loadTsconfigPaths(rootDir);

  return function resolveImport(importerPath: string, importSpec: string): string | null {
    if (importSpec.startsWith('.')) {
      const dir = dirname(importerPath);
      const base = resolve(dir, importSpec);

      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
      for (const ext of extensions) {
        const candidate = base + ext;
        if (existsSync(candidate)) return candidate;
      }

      if (existsSync(base)) {
        const indexVariants = extensions.map(e => resolve(base, `index${e}`));
        for (const candidate of indexVariants) {
          if (existsSync(candidate)) return candidate;
        }
      }

      return null;
    }

    if (aliasMap) {
      const resolved = resolveAlias(importSpec, aliasMap, rootDir);
      if (resolved) return resolved;
    }

    return null;
  };
}

function followImportTree(
  filePath: string,
  visited: Set<string>,
  depth: number,
  maxDepth: number,
  resolver: (importerPath: string, importSpec: string) => string | null,
): void {
  if (depth > maxDepth) return;
  if (visited.has(filePath)) return;
  visited.add(filePath);

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return;
  }

  const imports = extractImports(content);
  for (const spec of imports) {
    const resolved = resolver(filePath, spec);
    if (resolved && !visited.has(resolved)) {
      followImportTree(resolved, visited, depth + 1, maxDepth, resolver);
    }
  }
}

function scoreSignals(visitedFiles: string[]): { score: number; signals: string[] } {
  let score = 0;
  const signals: string[] = [];

  for (const file of visitedFiles) {
    let content: string;
    try {
      content = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    const lower = content.toLowerCase();

    if (/\bstore\b/i.test(basename(file, extname(file)))) {
      score += 2;
      signals.push('store');
    }
    if (/\bservice\b/i.test(basename(file, extname(file)))) {
      score += 2;
      signals.push('service');
    }
    if (lower.includes('websocket') || lower.includes('socket.io')) {
      score += 2;
      signals.push('websocket');
    }
    if (lower.includes('zustand') || lower.includes('redux') || lower.includes('jotai') || lower.includes('recoil')) {
      score += 1;
      signals.push('state-manager');
    }
    if (lower.includes('fetch(') || lower.includes('axios.') || lower.includes('api.get') || lower.includes('api.post')) {
      score += 1;
      signals.push('api-call');
    }
  }

  const uniqueSignals = [...new Set(signals)];
  return { score: Math.min(score, 10), signals: uniqueSignals };
}

export const nextAppRouterAdapter: FrameworkAdapter = {
  name: 'next-app-router',

  detect(rootDir: string): boolean {
    const hasConfig = fg.sync('**/next.config.{js,mjs,ts}', { cwd: rootDir, deep: 3, absolute: false }).length > 0;
    if (hasConfig) return true;

    const hasPage = fg.sync('**/app/**/page.tsx', { cwd: rootDir, deep: 4, absolute: false }).length > 0;
    if (!hasPage) return false;

    const pkgPath = resolve(rootDir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps.next) return true;
      } catch {
      }
    }

    return true;
  },

  extractCandidates(rootDir: string): FrameworkCandidate[] {
    const pageFiles = fg.sync('**/app/**/page.tsx', {
      cwd: rootDir,
      absolute: true,
    });

    const resolver = makeResolver(rootDir);
    const candidates: FrameworkCandidate[] = [];

    for (const entry of pageFiles) {
      const visited = new Set<string>();
      followImportTree(entry, visited, 0, 3, resolver);

      if (visited.size <= 1) continue;

      const { score, signals } = scoreSignals([...visited]);

      const sourcePaths = [...visited]
        .map(f => relative(rootDir, f))
        .filter(f => !f.startsWith('node_modules'));

      const parentDir = basename(dirname(entry));
      const rawId = parentDir.replace(/^\(.*\)$/, '').replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const id = rawId || 'page';

      candidates.push({
        id: `${id}-flow`,
        entry: relative(rootDir, entry),
        sources: sourcePaths,
        score,
        signals,
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  },
};
