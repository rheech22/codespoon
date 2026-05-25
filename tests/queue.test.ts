import { describe, it, expect, vi } from 'vitest';
import { JobQueue } from '../src/daemon/queue.js';
import type { DaemonJob } from '../src/daemon/queue.js';

describe('JobQueue', () => {
  it('enqueues and processes jobs sequentially per repo', async () => {
    const processed: DaemonJob[] = [];
    const handler = vi.fn().mockImplementation(async (job: DaemonJob) => {
      processed.push(job);
    });

    const queue = new JobQueue(handler);
    queue.enqueue({ type: 'process', repo: '/repo/a', sha: '1' });
    queue.enqueue({ type: 'process', repo: '/repo/a', sha: '2' });

    await new Promise((r) => setTimeout(r, 50));

    expect(handler).toHaveBeenCalledTimes(2);
    expect(processed[0].sha).toBe('1');
    expect(processed[1].sha).toBe('2');
  });

  it('processes different repos in parallel', async () => {
    const processed: string[] = [];
    const handler = vi.fn().mockImplementation(async (job: DaemonJob) => {
      processed.push(job.sha);
    });

    const queue = new JobQueue(handler);
    queue.enqueue({ type: 'process', repo: '/repo/a', sha: 'a1' });
    queue.enqueue({ type: 'process', repo: '/repo/b', sha: 'b1' });

    await new Promise((r) => setTimeout(r, 50));

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('reports queue length', () => {
    const handler = vi.fn();
    const queue = new JobQueue(handler);

    expect(queue.getQueueLength()).toBe(0);
    queue.enqueue({ type: 'process', repo: '/repo/a', sha: '1' });
    queue.enqueue({ type: 'process', repo: '/repo/a', sha: '2' });
    queue.enqueue({ type: 'process', repo: '/repo/b', sha: '3' });

    // First job for each repo starts processing immediately, handler resolves instantly
    // Only /repo/a sha=2 remains pending
    expect(queue.getQueueLength('/repo/a')).toBe(1);
    expect(queue.getQueueLength()).toBe(1);
  });
});
