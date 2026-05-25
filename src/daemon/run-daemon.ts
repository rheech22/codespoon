import { writePid } from './lifecycle.js';
import { startServer } from './server.js';
import { JobQueue } from './queue.js';
import type { DaemonJob } from './queue.js';

async function main(): Promise<void> {
  writePid();

  const handler = async (job: DaemonJob): Promise<void> => {
    console.log(`[daemon] processing ${job.repo}@${job.sha}`);
  };

  const queue = new JobQueue(handler);
  const server = await startServer(queue);

  console.log(`[daemon] server started on socket`);

  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[daemon] fatal:', err);
  process.exit(1);
});
