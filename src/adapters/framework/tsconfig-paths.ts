import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface AliasEntry {
  prefix: string;
  targets: string[];
}

export interface AliasMap {
  baseUrl: string;
  entries: AliasEntry[];
}

function stripJsoncComments(raw: string): string {
  return raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

export function loadTsconfigPaths(rootDir: string): AliasMap | null {
  for (const name of ['tsconfig.json', 'jsconfig.json']) {
    const configPath = resolve(rootDir, name);
    if (!existsSync(configPath)) continue;

    try {
      const raw = readFileSync(configPath, 'utf-8');
      const stripped = stripJsoncComments(raw);
      const config = JSON.parse(stripped);

      const compilerOptions = config.compilerOptions;
      if (!compilerOptions || !compilerOptions.paths) continue;

      const baseUrl = compilerOptions.baseUrl || '.';
      const entries: AliasEntry[] = [];

      for (const [key, values] of Object.entries(compilerOptions.paths)) {
        if (!Array.isArray(values)) continue;
        const prefix = key.replace(/\*$/, '');
        entries.push({
          prefix,
          targets: (values as string[]).map((v: string) => v.replace(/\*$/, '')),
        });
      }

      if (entries.length === 0) continue;

      return { baseUrl, entries };
    } catch {
      continue;
    }
  }

  return null;
}

export function resolveAlias(
  importSpec: string,
  aliasMap: AliasMap,
  rootDir: string,
): string | null {
  const matchingEntry = aliasMap.entries.find(e => importSpec.startsWith(e.prefix));
  if (!matchingEntry) return null;

  const wildcard = importSpec.slice(matchingEntry.prefix.length);
  const baseDir = resolve(rootDir, aliasMap.baseUrl);

  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  for (const target of matchingEntry.targets) {
    const candidate = resolve(baseDir, target + wildcard);

    for (const ext of extensions) {
      const withExt = candidate + ext;
      if (existsSync(withExt)) return withExt;
    }

    if (existsSync(candidate)) {
      const indexVariants = extensions.map(e => resolve(candidate, `index${e}`));
      for (const idx of indexVariants) {
        if (existsSync(idx)) return idx;
      }
    }
  }

  return null;
}
