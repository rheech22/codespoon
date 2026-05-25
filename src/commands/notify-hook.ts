import { connect } from 'node:net';
import { resolve } from 'node:path';
import { socketPath } from '../daemon/lifecycle.js';

export interface NotifyHookOptions {
  dir: string;
  sha: string;
}

export interface NotifyHookResult {
  success: boolean;
  message: string;
}

export function sendNotifyHook(options: NotifyHookOptions): Promise<NotifyHookResult> {
  return new Promise((resolvePromise) => {
    const sock = socketPath();
    const repo = resolve(options.dir);

    const client = connect(sock, () => {
      const msg = JSON.stringify({ type: 'process', repo, sha: options.sha });
      client.end(msg);
    });

    client.on('error', () => {
      resolvePromise({ success: false, message: '' });
    });

    client.on('end', () => {
      resolvePromise({ success: true, message: '' });
    });

    setTimeout(() => {
      client.destroy();
      resolvePromise({ success: false, message: '' });
    }, 2000);
  });
}
