import { describe, it, expect } from 'vitest';
import {
  buildAutoCommitMessage,
  hasAutoTrailer,
  isKnowledgeDirOnly,
  AUTO_TRAILER,
} from '../src/core/commit.js';

describe('buildAutoCommitMessage', () => {
  it('builds a message with trailer and metadata', () => {
    const msg = buildAutoCommitMessage({
      shortOriginalSha: 'abc1234',
      affectedNodeIds: ['chat-session-lifecycle', 'session-share'],
    });

    expect(msg).toContain(AUTO_TRAILER);
    expect(msg).toContain('abc1234');
    expect(msg).toContain('chat-session-lifecycle');
    expect(msg).toContain('session-share');
  });
});

describe('hasAutoTrailer', () => {
  it('detects trailer in message', () => {
    const msg = `some message\n\n${AUTO_TRAILER}`;
    expect(hasAutoTrailer(msg)).toBe(true);
  });

  it('returns false when no trailer', () => {
    expect(hasAutoTrailer('normal commit message')).toBe(false);
  });
});

describe('isKnowledgeDirOnly', () => {
  it('returns true when all files are under knowledge dir', () => {
    const files = ['docs/knowledge/nodes/test.md', 'docs/knowledge/graph.json'];
    expect(isKnowledgeDirOnly(files, 'docs/knowledge')).toBe(true);
  });

  it('returns false when any file is outside knowledge dir', () => {
    const files = ['docs/knowledge/nodes/test.md', 'src/app/page.tsx'];
    expect(isKnowledgeDirOnly(files, 'docs/knowledge')).toBe(false);
  });

  it('returns false for empty list', () => {
    expect(isKnowledgeDirOnly([], 'docs/knowledge')).toBe(false);
  });
});
