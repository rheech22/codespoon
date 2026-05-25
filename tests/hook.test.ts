import { describe, it, expect } from 'vitest';
import {
  shouldSkipDueToTrailer,
  shouldSkipDueToKnowledgeDir,
  buildSocketMessage,
} from '../src/core/hook.js';

describe('shouldSkipDueToTrailer', () => {
  it('returns true when auto trailer is present', () => {
    const msg = 'docs(codespoon): auto-update for abc1234\n\nCodespoon-Auto: true';
    expect(shouldSkipDueToTrailer(msg)).toBe(true);
  });

  it('returns false for normal commit', () => {
    expect(shouldSkipDueToTrailer('feat: add new feature')).toBe(false);
  });
});

describe('shouldSkipDueToKnowledgeDir', () => {
  it('returns true when all files are under knowledge dir', () => {
    const files = ['docs/knowledge/nodes/test.md', 'docs/knowledge/graph.json'];
    expect(shouldSkipDueToKnowledgeDir(files, 'docs/knowledge')).toBe(true);
  });

  it('returns false for mixed files', () => {
    const files = ['docs/knowledge/nodes/test.md', 'src/main.ts'];
    expect(shouldSkipDueToKnowledgeDir(files, 'docs/knowledge')).toBe(false);
  });

  it('returns false for empty list', () => {
    expect(shouldSkipDueToKnowledgeDir([], 'docs/knowledge')).toBe(false);
  });
});

describe('buildSocketMessage', () => {
  it('builds correct JSON message', () => {
    const msg = buildSocketMessage('/repo/path', 'abc1234');
    const parsed = JSON.parse(msg);
    expect(parsed).toEqual({ type: 'process', repo: '/repo/path', sha: 'abc1234' });
  });
});
