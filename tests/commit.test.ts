import { describe, it, expect } from 'vitest';
import {
  buildAutoCommitMessage,
  hasAutoTrailer,
  isKnowledgeDirOnly,
  updateNodeMetadata,
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

describe('updateNodeMetadata', () => {
  it('updates last_updated_commit and last_updated_at', () => {
    const raw = '---\nid: test\nlast_updated_commit: old-sha\nlast_updated_at: "2020-01-01"\n---\nbody';
    const result = updateNodeMetadata(raw, 'new-sha-1234');
    expect(result).not.toBeNull();
    expect(result).toContain('last_updated_commit: new-sha-1234');
    expect(result).toContain('body');
  });

  it('returns null for content without frontmatter', () => {
    expect(updateNodeMetadata('just text', 'sha')).toBeNull();
  });

  it('preserves body content', () => {
    const raw = '---\nid: test\nlast_updated_commit: old\nlast_updated_at: "2020-01-01"\n---\n# Title\n\nBody text.';
    const result = updateNodeMetadata(raw, 'sha');
    expect(result).toContain('# Title');
    expect(result).toContain('Body text.');
  });
});
