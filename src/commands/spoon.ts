import { readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import matter from 'gray-matter';
import fg from 'fast-glob';
import pc from 'picocolors';
import { loadConfigStrict } from '../core/config.js';
import { FrontmatterSchema } from '../core/types.js';
import { nodesDir } from '../core/paths.js';

export interface SpoonOptions {
  dir: string;
  query: string;
}

export interface SpoonHit {
  nodeId: string;
  title: string;
  path: string;
  score: number;
  bodySnippet: string;
  matches: string[];
}

export function runSpoon(options: SpoonOptions): SpoonHit[] {
  const root = resolve(options.dir);
  const config = loadConfigStrict(root);
  const queryLower = options.query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(Boolean);

  if (queryWords.length === 0) return [];

  const nd = nodesDir(root, config);
  const files = fg.sync('*.md', { cwd: nd, absolute: true });

  const hits: SpoonHit[] = [];

  for (const filePath of files) {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = matter(raw);
    const fmResult = FrontmatterSchema.safeParse(parsed.data);
    if (!fmResult.success) continue;

    const fm = fmResult.data;
    const match = parsed.content.match(/^#\s+(.+)$/m);
    const title = match ? match[1].trim() : fm.id;

    let score = 0;
    const matchDetails: string[] = [];

    const sourcePaths = fm.sources.map(s => s.path.toLowerCase());
    const sourceSymbols = fm.sources.flatMap(s => s.symbols.map(sym => sym.toLowerCase()));
    const titleLower = title.toLowerCase();
    const idLower = fm.id.toLowerCase();

    for (const word of queryWords) {
      if (titleLower.includes(word)) {
        score += 3;
        matchDetails.push(`title:${word}`);
      }
      if (idLower.includes(word)) {
        score += 2;
        matchDetails.push(`id:${word}`);
      }
      for (const sp of sourcePaths) {
        if (sp.includes(word)) {
          score += 2;
          matchDetails.push(`source:${word}`);
          break;
        }
      }
      for (const sym of sourceSymbols) {
        if (sym.includes(word)) {
          score += 1;
          matchDetails.push(`symbol:${word}`);
          break;
        }
      }
    }

    if (score === 0) continue;

    const body = parsed.content.trim();
    const snippet = body.length > 200 ? body.slice(0, 200) + '...' : body;

    hits.push({
      nodeId: fm.id,
      title,
      path: relative(root, filePath),
      score,
      bodySnippet: snippet,
      matches: matchDetails,
    });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, 3);
}

export function renderSpoonResult(hits: SpoonHit[], query: string): void {
  if (hits.length === 0) {
    console.log(`"${query}"에 일치하는 노드가 없습니다.`);
    return;
  }

  console.log(`${pc.cyan('spoon')} "${query}" — 상위 ${hits.length}개 결과`);
  console.log('');

  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i];
    console.log(`${pc.green(`${i + 1}.`)} ${pc.bold(hit.title)} (${pc.yellow(hit.nodeId)})`);
    console.log(`   경로: ${hit.path}`);
    console.log(`   점수: ${hit.score}`);
    console.log(`   일치: ${hit.matches.join(', ')}`);
    console.log('');
    console.log(`   ${hit.bodySnippet}`);
    console.log('');
  }
}
