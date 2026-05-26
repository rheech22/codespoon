import { connect } from 'node:net';
import { resolve } from 'node:path';
import { socketPath } from '../daemon/lifecycle.js';

export interface ProcessOptions {
  dir: string;
  sha: string;
}

export interface ProcessResult {
  success: boolean;
  message: string;
}

export function sendProcessRequest(options: ProcessOptions): Promise<ProcessResult> {
  return new Promise((resolvePromise) => {
    const sock = socketPath();
    const repo = resolve(options.dir);

    const client = connect(sock, () => {
      const msg = JSON.stringify({ type: 'process', repo, sha: options.sha });
      client.end(msg);
    });

    client.on('connect', () => {
    });

    client.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT' || err.code === 'ECONNREFUSED') {
        resolvePromise({ success: false, message: 'Daemon is not running. Run `codespoon daemon start` first.' });
      } else {
        resolvePromise({ success: false, message: `Socket error: ${err.message}` });
      }
    });

    client.on('end', () => {
      resolvePromise({ success: true, message: `Process request sent (${options.sha})` });
    });
  });
}
