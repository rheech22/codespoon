export interface DaemonJob {
  type: 'process';
  repo: string;
  sha: string;
}

export type JobHandler = (job: DaemonJob) => Promise<void>;

export class JobQueue {
  private queues = new Map<string, DaemonJob[]>();
  private inFlight = new Map<string, boolean>();
  private handler: JobHandler;

  constructor(handler: JobHandler) {
    this.handler = handler;
  }

  enqueue(job: DaemonJob): void {
    const repo = job.repo;
    if (!this.queues.has(repo)) {
      this.queues.set(repo, []);
    }
    this.queues.get(repo)!.push(job);
    this.tryProcess(repo);
  }

  private async tryProcess(repo: string): Promise<void> {
    if (this.inFlight.get(repo)) return;
    const queue = this.queues.get(repo);
    if (!queue || queue.length === 0) return;

    this.inFlight.set(repo, true);
    const job = queue.shift()!;

    try {
      await this.handler(job);
    } catch (err) {
      console.error(`[daemon:queue] Error processing ${job.repo}@${job.sha}:`, err);
    } finally {
      this.inFlight.set(repo, false);
      this.tryProcess(repo);
    }
  }

  getQueueLength(repo?: string): number {
    if (repo) {
      return this.queues.get(repo)?.length ?? 0;
    }
    let total = 0;
    for (const q of this.queues.values()) {
      total += q.length;
    }
    return total;
  }

  getInFlight(repo?: string): boolean {
    if (repo) return this.inFlight.get(repo) ?? false;
    for (const v of this.inFlight.values()) {
      if (v) return true;
    }
    return false;
  }
}
