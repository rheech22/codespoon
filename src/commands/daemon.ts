import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { isRunning, spawnDaemon, stopDaemon, socketPath, readPid } from '../daemon/lifecycle.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

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
    return { success: false, message: '데몬이 이미 실행 중입니다' };
  }

  const distDaemon = resolve(__dirname, '../daemon/run-daemon.js');
  if (!existsSync(distDaemon)) {
    return { success: false, message: '데몬 스크립트를 찾을 수 없습니다. build를 먼저 실행하세요.' };
  }

  spawnDaemon(distDaemon);
  return { success: true, message: '데몬을 시작했습니다' };
}

export function stopDaemonCli(): { success: boolean; message: string } {
  const stopped = stopDaemon();
  if (stopped) {
    return { success: true, message: '데몬을 종료했습니다' };
  }
  return { success: false, message: '실행 중인 데몬이 없습니다' };
}

export function renderDaemonStatus(result: DaemonStatusResult): void {
  if (result.running) {
    console.log(`${pc.green('✓')} 데몬 실행 중 (PID: ${result.pid})`);
  } else {
    console.log(`${pc.red('×')} 데몬이 실행 중이지 않습니다`);
  }
  if (result.socketExists) {
    console.log(`${pc.green('✓')} socket: ${socketPath()}`);
  }
}
