import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import pc from 'picocolors';
import { loadConfigStrict } from '../core/config.js';
import type { CodespoonConfig } from '../core/config.js';
import { runsDir } from '../core/paths.js';
import { nodesDir, knowledgeDir } from '../core/paths.js';
import { nextAppRouterAdapter } from '../adapters/framework/next-app-router.js';
import type { FrameworkCandidate } from '../adapters/framework/index.js';
import { buildCreatePrompt } from '../daemon/create-node.js';
import { runAgentLoop } from '../daemon/agent-loop.js';
import { OpencodeAdapter } from '../adapters/agent/opencode.js';
import { validateNodeContent } from '../core/validation.js';
import { generateGraph } from '../core/graph.js';
import { buildAutoCommitMessage, AUTO_TRAILER } from '../core/commit.js';

export interface BootstrapOptions {
  dir: string;
  apply: boolean;
}

export interface BootstrapResult {
  candidates: FrameworkCandidate[];
  candidatesPath: string;
  applied?: number;
}

const ADAPTERS = [nextAppRouterAdapter];

function detectAdapters(rootDir: string) {
  return ADAPTERS.filter(a => a.detect(rootDir));
}

export async function runBootstrap(options: BootstrapOptions): Promise<BootstrapResult> {
  const root = resolve(options.dir);
  const config = loadConfigStrict(root);

  const activeAdapters = detectAdapters(root);
  if (activeAdapters.length === 0) {
    return { candidates: [], candidatesPath: '' };
  }

  const allCandidates: FrameworkCandidate[] = [];

  for (const adapter of activeAdapters) {
    const candidates = adapter.extractCandidates(root);
    allCandidates.push(...candidates);
  }

  allCandidates.sort((a, b) => b.score - a.score);

  const rd = runsDir(root, config);
  mkdirSync(rd, { recursive: true });
  const candidatesPath = resolve(rd, 'bootstrap-candidates.md');

  const lines: string[] = [
    '# Bootstrap Candidates',
    '',
    `Generated at: ${new Date().toISOString()}`,
    '',
    'Select candidates by marking `[x]` next to the entry.',
    '',
  ];

  for (let i = 0; i < allCandidates.length; i++) {
    const c = allCandidates[i];
    const topSources = c.sources.slice(0, 10);
    lines.push(`- [ ] ${c.id}`);
    lines.push(`  - Entry: \`${c.entry}\``);
    lines.push(`  - Score: ${c.score}`);
    lines.push(`  - Signals: ${c.signals.join(', ') || 'none'}`);
    lines.push(`  - Sources:`);
    for (const s of topSources) {
      lines.push(`    - \`${s}\``);
    }
    if (c.sources.length > 10) {
      lines.push(`    - ... ${c.sources.length - 10} more`);
    }
    lines.push('');
  }

  writeFileSync(candidatesPath, lines.join('\n'), 'utf-8');

  if (options.apply) {
    const applied = await applyCandidates(root, config, allCandidates, candidatesPath);
    return { candidates: allCandidates, candidatesPath, applied };
  }

  return { candidates: allCandidates, candidatesPath };
}

async function applyCandidates(
  root: string,
  config: CodespoonConfig,
  allCandidates: FrameworkCandidate[],
  candidatesPath: string,
): Promise<number> {
  if (!existsSync(candidatesPath)) return 0;

  const content = readFileSync(candidatesPath, 'utf-8');
  const lines = content.split('\n');
  const selectedIds: string[] = [];

  for (const line of lines) {
    const match = line.match(/^- \[x\]\s+(.+)$/);
    if (match) {
      selectedIds.push(match[1].trim());
    }
  }

  if (selectedIds.length === 0) {
    console.log(pc.yellow('선택된 후보가 없습니다. candidates 파일에서 [x]로 표시하세요.'));
    return 0;
  }

  const selectedCandidates = allCandidates.filter(c => selectedIds.includes(c.id));
  if (selectedCandidates.length === 0) {
    console.log(pc.yellow('선택한 후보를 찾을 수 없습니다.'));
    return 0;
  }

  const nd = nodesDir(root, config);
  mkdirSync(nd, { recursive: true });

  const agent = new OpencodeAdapter();
  const runDir = resolve(root, config.state_dir, 'runs', 'bootstrap');
  let appliedCount = 0;

  for (const candidate of selectedCandidates) {
    const nodePath = resolve(nd, `${candidate.id}.md`);
    if (existsSync(nodePath)) {
      console.log(pc.yellow(`  건너뜀: ${candidate.id} (이미 존재)`));
      continue;
    }

    console.log(pc.cyan(`  생성 중: ${candidate.id}...`));

    const result = await runAgentLoop({
      buildPrompt: () => buildCreatePrompt({
        id: candidate.id,
        entry: candidate.entry,
        sources: candidate.sources,
        config,
      }),
      agent,
      validate: (output) => validateNodeContent(output, { rootDir: root, config, filePath: nodePath }),
      config,
      repoRoot: root,
      runDir,
      identifier: candidate.id,
    });

    if (result.success && result.finalContent) {
      writeFileSync(nodePath, result.finalContent, 'utf-8');
      appliedCount++;
      console.log(pc.green(`  ✓ ${candidate.id}`));
    } else {
      console.log(pc.red(`  × ${candidate.id}: ${result.error}`));
    }
  }

  if (appliedCount === 0) {
    console.log(pc.yellow('생성된 노드가 없습니다.'));
    return 0;
  }

  const newGraph = generateGraph(root, config);
  const gp = resolve(knowledgeDir(root, config), 'graph.json');
  writeFileSync(gp, JSON.stringify(newGraph, null, 2) + '\n', 'utf-8');

  const { GitAdapter } = await import('../adapters/vcs/git.js');
  const vcs = new GitAdapter(root);

  const modifiedPaths = selectedCandidates
    .filter(c => existsSync(resolve(nd, `${c.id}.md`)))
    .map(c => relative(root, resolve(nd, `${c.id}.md`)));
  modifiedPaths.push(relative(root, gp));

  await vcs.stage(modifiedPaths);
  const message = `${buildAutoCommitMessage({ shortOriginalSha: 'bootstrap', affectedNodeIds: selectedIds })}\n\n${AUTO_TRAILER}`;
  await vcs.commit(message);

  console.log(pc.green(`✓ ${appliedCount}개 노드 생성 및 커밋 완료`));
  return appliedCount;
}

export function renderBootstrapResult(result: BootstrapResult): void {
  if (result.candidates.length === 0) {
    console.log(pc.yellow('인식된 프레임워크가 없습니다. 후보를 생성할 수 없습니다.'));
    return;
  }

  console.log(`${pc.green('✓')} ${result.candidates.length}개 후보 생성`);
  console.log(`   저장 위치: ${result.candidatesPath}`);
  console.log('');

  for (let i = 0; i < Math.min(result.candidates.length, 5); i++) {
    const c = result.candidates[i];
    console.log(`  ${pc.cyan(`${i + 1}.`)} ${pc.bold(c.id)} (score: ${c.score})`);
    console.log(`     entry: ${c.entry}`);
    console.log(`     signals: ${c.signals.join(', ') || 'none'}`);
    console.log(`     sources: ${c.sources.length} files`);
    console.log('');
  }

  if (result.candidates.length > 5) {
    console.log(`   ... ${result.candidates.length - 5}개 더 있음`);
  }

  if (result.applied !== undefined) {
    console.log(`${pc.green('✓')} ${result.applied}개 노드 적용됨`);
  }
}
