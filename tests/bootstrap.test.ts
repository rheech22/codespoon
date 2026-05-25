import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { runBootstrap } from '../src/commands/bootstrap.js';
import type { BootstrapResult } from '../src/commands/bootstrap.js';

function setupNextProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'bootstrap-test-'));
  mkdirSync(resolve(dir, 'app/dashboard'), { recursive: true });
  mkdirSync(resolve(dir, 'app/settings'), { recursive: true });
  mkdirSync(resolve(dir, 'lib'), { recursive: true });
  mkdirSync(resolve(dir, 'stores'), { recursive: true });

  writeFileSync(resolve(dir, 'app/dashboard/page.tsx'), [
    `import { DashboardService } from '../../lib/dashboard-service';`,
    `import { useAppStore } from '../../stores/app-store';`,
    `export default function DashboardPage() {`,
    `  return <div>Dashboard</div>;`,
    `}`,
  ].join('\n'), 'utf-8');

  writeFileSync(resolve(dir, 'app/settings/page.tsx'), [
    `import { SettingsService } from '../../lib/settings-service';`,
    `export default function SettingsPage() {`,
    `  return <div>Settings</div>;`,
    `}`,
  ].join('\n'), 'utf-8');

  writeFileSync(resolve(dir, 'lib/dashboard-service.ts'), [
    `export const DashboardService = {`,
    `  async fetch() { return fetch('/api/dashboard'); }`,
    `};`,
  ].join('\n'), 'utf-8');

  writeFileSync(resolve(dir, 'lib/settings-service.ts'), [
    `export const SettingsService = {`,
    `  async get() { return fetch('/api/settings'); }`,
    `};`,
  ].join('\n'), 'utf-8');

  writeFileSync(resolve(dir, 'stores/app-store.ts'), [
    `import { create } from 'zustand';`,
    `export const useAppStore = create(() => ({}));`,
  ].join('\n'), 'utf-8');

  return dir;
}

function setupNonFrameworkProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'bootstrap-none-'));
  mkdirSync(resolve(dir, 'src'), { recursive: true });
  writeFileSync(resolve(dir, 'src/index.ts'), 'console.log("hello");', 'utf-8');
  return dir;
}

describe('runBootstrap', () => {
  it('generates candidates for Next.js project', async () => {
    const dir = setupNextProject();
    const result: BootstrapResult = await runBootstrap({ dir, apply: false });
    expect(result.candidates.length).toBeGreaterThanOrEqual(2);
    expect(result.candidatesPath).toContain('bootstrap-candidates.md');
    expect(result.candidates.some(c => c.id.includes('dashboard'))).toBe(true);
  });

  it('returns no candidates for non-framework project', async () => {
    const dir = setupNonFrameworkProject();
    const result: BootstrapResult = await runBootstrap({ dir, apply: false });
    expect(result.candidates).toHaveLength(0);
  });

  it('candidates have scores and signals', async () => {
    const dir = setupNextProject();
    const result: BootstrapResult = await runBootstrap({ dir, apply: false });
    for (const c of result.candidates) {
      expect(c.score).toBeGreaterThan(0);
    }
  });
});
