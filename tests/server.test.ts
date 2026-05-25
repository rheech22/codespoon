import { describe, it, expect } from 'vitest';
import { parseMessages, startServer } from '../src/daemon/server.js';
import { connect } from 'node:net';
import { existsSync, unlinkSync } from 'node:fs';
import { JobQueue } from '../src/daemon/queue.js';
import { socketPath } from '../src/daemon/lifecycle.js';

describe('parseMessages', () => {
  it('extracts valid process messages from buffer', () => {
    const data = Buffer.from(JSON.stringify({ type: 'process', repo: '/repo', sha: 'abc' }) + '\n');
    const { messages, remainder } = parseMessages(data, '');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ type: 'process', repo: '/repo', sha: 'abc' });
    expect(remainder).toBe('');
  });

  it('handles partial messages with remainder', () => {
    const data = Buffer.from('{"type":"process"');
    const { messages, remainder } = parseMessages(data, '');
    expect(messages).toHaveLength(0);
    expect(remainder).not.toBe('');
  });

  it('resumes parsing with buffered remainder', () => {
    const first = Buffer.from('{"type":"process","repo":"/r","sha":"a"');
    const { remainder } = parseMessages(first, '');
    expect(remainder).not.toBe('');

    const second = Buffer.from('}\n');
    const { messages } = parseMessages(second, remainder);
    expect(messages).toHaveLength(1);
    expect(messages[0].sha).toBe('a');
  });

  it('ignores invalid JSON', () => {
    const data = Buffer.from('not json\n');
    const { messages } = parseMessages(data, '');
    expect(messages).toHaveLength(0);
  });

  it('ignores messages missing required fields', () => {
    const data = Buffer.from(JSON.stringify({ type: 'unknown' }) + '\n');
    const { messages } = parseMessages(data, '');
    expect(messages).toHaveLength(0);
  });

  it('handles multiple messages in one chunk', () => {
    const json1 = JSON.stringify({ type: 'process', repo: '/a', sha: '1' });
    const json2 = JSON.stringify({ type: 'process', repo: '/b', sha: '2' });
    const data = Buffer.from(json1 + '\n' + json2 + '\n');
    const { messages } = parseMessages(data, '');
    expect(messages).toHaveLength(2);
  });
});

describe('startServer (integration)', () => {
  it('creates socket file', async () => {
    const queue = new JobQueue(async () => {});
    const server = await startServer(queue);

    const sock = socketPath();
    expect(existsSync(sock)).toBe(true);

    await server.close();
    if (existsSync(sock)) unlinkSync(sock);
  });
});
