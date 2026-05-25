import { writePid, cleanup } from './lifecycle.js';
import { startServer } from './server.js';
import { JobQueue } from './queue.js';
import type { DaemonJob } from './queue.js';
import { getLogger } from '../core/logger.js';

async function main(): Promise<void> {
  writePid();

  const log = getLogger();

  const handler = async (job: DaemonJob): Promise<void> => {
    log.info(`[daemon] processing ${job.repo}@${job.sha}`);
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
