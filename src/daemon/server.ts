import { createServer, Socket } from 'node:net';
import { existsSync, unlinkSync } from 'node:fs';
import { socketPath } from './lifecycle.js';
import type { JobQueue, DaemonJob } from './queue.js';

export interface ServerHandle {
  close: () => Promise<void>;
}

function parseMessages(data: Buffer, buffer: string): { messages: DaemonJob[]; remainder: string } {
  const full = buffer + data.toString();
  const lines = full.split('\n');
  const remainder = lines.pop() || '';
  const messages: DaemonJob[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.type === 'process' && typeof parsed.repo === 'string' && typeof parsed.sha === 'string') {
        messages.push({ type: 'process', repo: parsed.repo, sha: parsed.sha });
      }
    } catch {
    }
  }

  return { messages, remainder };
}

export { parseMessages };

export function startServer(queue: JobQueue): Promise<ServerHandle> {
  const path = socketPath();

  if (existsSync(path)) {
    unlinkSync(path);
  }

  const server = createServer((socket: Socket) => {
    let buffer = '';

    socket.on('data', (chunk: Buffer) => {
      const { messages, remainder } = parseMessages(chunk, buffer);
      buffer = remainder;
      for (const msg of messages) {
        queue.enqueue(msg);
      }
    });

    socket.on('error', () => {
    });
  });

  return new Promise((resolve, reject) => {
    server.on('error', (err) => {
      reject(err);
    });

    server.listen(path, () => {
      resolve({
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}
