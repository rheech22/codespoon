import { spawn } from 'node:child_process';
import type { AgentAdapter, InvokeOptions, InvokeResult } from './index.js';

export class OpencodeAdapter implements AgentAdapter {
  async invoke(prompt: string, opts: InvokeOptions): Promise<InvokeResult> {
    const start = Date.now();

    return new Promise((resolve, reject) => {
      const proc = spawn('opencode', [
        'run',
        '--dir', opts.dir,
        '--model', opts.model,
        prompt,
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        setTimeout(() => {
          try { proc.kill('SIGKILL'); } catch {}
        }, 5000);
      }, opts.timeoutMs);

      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('close', (exitCode) => {
        clearTimeout(timer);
        const durationMs = Date.now() - start;
        resolve({
          stdout,
          stderr,
          exitCode: exitCode ?? 1,
          durationMs,
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`Failed to spawn opencode: ${err.message}`));
      });
    });
  }
}
