import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import pc from 'picocolors';
import { isRunning, spawnDaemon, stopDaemon, socketPath, readPid } from '../daemon/lifecycle.js';
import { dirnameFromUrl } from '../core/paths.js';

const __dirname = dirnameFromUrl(import.meta.url);

export interface DaemonStatusResult {
  running: boolean;
  pid: number | null;
  socketExists: boolean;
}

export function checkDaemonStatus(): DaemonStatusResult {
  const pid = readPid();
  const running = isRunning();
  const sockExists = existsSync(socketPath());
  return { running, pid, socketExists: sockExists };
}

export function startDaemon(): { success: boolean; message: string } {
  const status = checkDaemonStatus();
  if (status.running) {
    return { success: false, message: 'Daemon is already running' };
  }

  const distDaemon = resolve(__dirname, '../daemon/run-daemon.js');
  if (!existsSync(distDaemon)) {
    return { success: false, message: 'Daemon script not found. Run `pnpm build` (or equivalent) first.' };
  }

  spawnDaemon(distDaemon);
  return { success: true, message: 'Daemon started' };
}

export function stopDaemonCli(): { success: boolean; message: string } {
  const stopped = stopDaemon();
  if (stopped) {
    return { success: true, message: 'Daemon stopped' };
  }
  return { success: false, message: 'No daemon is running' };
}

export function renderDaemonStatus(result: DaemonStatusResult): void {
  if (result.running) {
    console.log(`${pc.green('✓')} Daemon running (PID: ${result.pid})`);
  } else {
    console.log(`${pc.red('×')} Daemon is not running`);
  }
  if (result.socketExists) {
    console.log(`${pc.green('✓')} socket: ${socketPath()}`);
  }
}
