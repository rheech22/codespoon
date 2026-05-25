import { writePid, cleanup } from './lifecycle.js';
import { startServer } from './server.js';
import { JobQueue } from './queue.js';
import type { DaemonJob } from './queue.js';
import { GitAdapter } from '../adapters/vcs/git.js';
import { OpencodeAdapter } from '../adapters/agent/opencode.js';
import { processCommit } from './process-commit.js';
import { getLogger } from '../core/logger.js';

const agent = new OpencodeAdapter();

async function main(): Promise<void> {
  writePid();

  const log = getLogger();

  const handler = async (job: DaemonJob): Promise<void> => {
    log.info(`[daemon] processing ${job.repo}@${job.sha}`);

    try {
      const vcs = new GitAdapter(job.repo);

      const result = await processCommit({
        repoRoot: job.repo,
        sha: job.sha,
        vcs,
        agent,
      });

      if (result.autoCommitted) {
        log.info(`[daemon] auto-committed for ${job.sha} (${result.processed.length} nodes)`);
      } else if (result.error) {
        log.warn(`[daemon] ${result.error}`);
      } else {
        log.info(`[daemon] no action needed for ${job.sha}`);
      }

      if (result.needsReviewCount > 0) {
        log.warn(`[daemon] ${result.needsReviewCount} node(s) need review after ${job.sha}`);
      }
    } catch (err) {
      log.error(`[daemon] error processing ${job.repo}@${job.sha}:`, err);
    }
  };

  const queue = new JobQueue(handler);
  const server = await startServer(queue);

  log.info(`[daemon] server started on socket`);

  const shutdown = async () => {
    await server.close();
    cleanup();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  getLogger().error('[daemon] fatal:', err);
  process.exit(1);
});
