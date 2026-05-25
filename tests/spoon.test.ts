import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { runSpoon } from '../src/commands/spoon.js';

function setupRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'spoon-test-'));
  mkdirSync(resolve(dir, 'docs/knowledge/nodes'), { recursive: true });
  return dir;
}

function writeNode(dir: string, id: string, title: string, body: string, sources: { path: string; symbols: string[] }[]): void {
  const fm = `---
id: ${id}
kind: domain
status: auto-updated
confidence: high
scope:
  include: []
  exclude: []
sources:
${sources.map(s => `  - path: ${s.path}\n    symbols:\n${s.symbols.map(sym => `      - ${sym}`).join('\n')}`).join('\n')}
relations: []
last_updated_commit: abc
last_updated_at: "2025-01-01"
---
# ${title}

${body}
`;
  writeFileSync(resolve(dir, `docs/knowledge/nodes/${id}.md`), fm, 'utf-8');
}

describe('runSpoon', () => {
  it('returns empty for empty query', () => {
    const repo = setupRepo();
    writeNode(repo, 'node-a', 'Chat Session', 'body', [{ path: 'src/chat.ts', symbols: ['ChatService'] }]);
    expect(runSpoon({ dir: repo, query: '' })).toEqual([]);
  });

  it('matches by title', () => {
    const repo = setupRepo();
    writeNode(repo, 'chat-session', 'Chat Session Lifecycle', 'body about chat', [{ path: 'src/chat.ts', symbols: ['ChatService'] }]);
    writeNode(repo, 'user-auth', 'User Authentication', 'body about auth', [{ path: 'src/auth.ts', symbols: ['AuthService'] }]);

    const hits = runSpoon({ dir: repo, query: 'chat' });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].nodeId).toContain('chat');
  });

  it('matches by source path', () => {
    const repo = setupRepo();
    writeNode(repo, 'session', 'Session Management', 'body', [{ path: 'src/websocket.ts', symbols: ['WS'] }]);
    writeNode(repo, 'auth', 'Authentication', 'body', [{ path: 'src/auth.ts', symbols: ['Auth'] }]);

    const hits = runSpoon({ dir: repo, query: 'websocket' });
    expect(hits).toHaveLength(1);
    expect(hits[0].nodeId).toBe('session');
  });

  it('matches by symbol name', () => {
    const repo = setupRepo();
    writeNode(repo, 'payment', 'Payment Flow', 'body', [{ path: 'src/pay.ts', symbols: ['PaymentProcessor'] }]);

    const hits = runSpoon({ dir: repo, query: 'PaymentProcessor' });
    expect(hits).toHaveLength(1);
    expect(hits[0].nodeId).toBe('payment');
  });

  it('scores title hits higher than symbol hits', () => {
    const repo = setupRepo();
    writeNode(repo, 'chat-advanced', 'Chat Flow', 'body', [{ path: 'src/chat.ts', symbols: ['Handler'] }]);
    writeNode(repo, 'other', 'Other Feature', 'body', [{ path: 'src/handler.ts', symbols: ['ChatHandler'] }]);

    const hits = runSpoon({ dir: repo, query: 'chat' });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].nodeId).toBe('chat-advanced');
  });

  it('returns at most 3 hits', () => {
    const repo = setupRepo();
    writeNode(repo, 'a', 'Chat A', 'body', [{ path: 'a.ts', symbols: ['A'] }]);
    writeNode(repo, 'b', 'Chat B', 'body', [{ path: 'b.ts', symbols: ['B'] }]);
    writeNode(repo, 'c', 'Chat C', 'body', [{ path: 'c.ts', symbols: ['C'] }]);
    writeNode(repo, 'd', 'Chat D', 'body', [{ path: 'd.ts', symbols: ['D'] }]);

    const hits = runSpoon({ dir: repo, query: 'chat' });
    expect(hits.length).toBeLessThanOrEqual(3);
  });
});
