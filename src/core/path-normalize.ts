import { readFileSync, writeFileSync } from 'node:fs';
import matter from 'gray-matter';

/**
 * Best-effort normalization of body file references.
 *
 * Agents commonly emit body references as "/web/app/chat/page.tsx" or
 * "/apps/web/app/chat/page.tsx" when the actual source is
 * "apps/web/app/chat/page.tsx". This re-attaches the missing prefix by
 * matching wrong-form variants against known sources from frontmatter.
 *
 * Only operates on the body (after frontmatter). Frontmatter text is
 * preserved byte-for-byte. Only unambiguous mappings are applied —
 * if two sources could both match a wrong form (e.g., "/page.tsx"),
 * we skip rather than guess.
 *
 * Returns true if any changes were applied to the file.
 */
export function normalizeBodyPathsInFile(filePath: string): boolean {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch {
    return false;
  }

  let parsed: ReturnType<typeof matter>;
  try {
    parsed = matter(raw);
  } catch {
    return false;
  }

  const fmData = parsed.data as { sources?: Array<{ path?: string }> } | undefined;
  if (!fmData || !Array.isArray(fmData.sources)) return false;

  const knownSources = fmData.sources
    .map(s => (s && typeof s.path === 'string' ? s.path : null))
    .filter((p): p is string => !!p);

  if (knownSources.length === 0) return false;

  // Locate body region in raw text without re-serializing frontmatter.
  if (!raw.startsWith('---')) return false;
  const fmDelimIdx = raw.indexOf('\n---', 3);
  if (fmDelimIdx === -1) return false;
  const bodyStartIdx = raw.indexOf('\n', fmDelimIdx + 4);
  if (bodyStartIdx === -1) return false;

  const frontmatterRaw = raw.slice(0, bodyStartIdx + 1);
  let body = raw.slice(bodyStartIdx + 1);

  // Build {wrong → set of sources} map of variants.
  const wrongToSources: Map<string, Set<string>> = new Map();
  for (const src of knownSources) {
    const variants: string[] = [];

    // Full path with leading slash, e.g. /apps/web/app/chat/page.tsx
    variants.push('/' + src);

    // Strip leading segments one at a time, only keeping variants that retain
    // enough specificity (>= 3 path segments) to avoid spurious matches.
    const parts = src.split('/');
    for (let strip = 1; strip < parts.length; strip++) {
      const stripped = parts.slice(strip).join('/');
      if (stripped.split('/').length < 3) break;
      variants.push('/' + stripped);
    }

    for (const v of variants) {
      if (!wrongToSources.has(v)) wrongToSources.set(v, new Set());
      wrongToSources.get(v)!.add(src);
    }
  }

  // Filter to unambiguous mappings only.
  const candidates: Array<{ wrong: string; right: string }> = [];
  for (const [wrong, srcs] of wrongToSources) {
    if (srcs.size === 1) {
      candidates.push({ wrong, right: srcs.values().next().value as string });
    }
  }

  // Apply longest match first so we don't accidentally replace a prefix
  // of a longer wrong form.
  candidates.sort((a, b) => b.wrong.length - a.wrong.length);

  let changed = false;
  for (const { wrong, right } of candidates) {
    // Only replace when the wrong form sits at a boundary — not as a substring
    // inside an already-correct path. Use lookbehind/lookahead:
    //   - char before "/" must not be a word character or another "/"
    //     (avoids matching "/app/..." inside "apps/...")
    //   - char after the path must not be a word character or "/"
    //     (avoids matching ".ts" inside ".tsx" or ".../page" inside ".../pages/...")
    const escaped = wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![\\w/])${escaped}(?![\\w/])`, 'g');
    if (re.test(body)) {
      body = body.replace(new RegExp(`(?<![\\w/])${escaped}(?![\\w/])`, 'g'), right);
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(filePath, frontmatterRaw + body, 'utf-8');
  }

  return changed;
}
