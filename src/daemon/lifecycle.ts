import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';

export function daemonDir(): string {
  return resolve(homedir(), '.codespoon');
}

export function ensureDaemonDir(): string {
  const dir = daemonDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function pidPath(): string {
  return resolve(daemonDir(), 'daemon.pid');
}

export function socketPath(): string {
  return resolve(daemonDir(), 'sock');
}

export function writePid(): void {
  ensureDaemonDir();
  writeFileSync(pidPath(), String(process.pid), 'utf-8');
}

export function readPid(): number | null {
  try {
    return parseInt(readFileSync(pidPath(), 'utf-8').trim(), 10);
  } catch {
    return null;
  }
}

export function isRunning(): boolean {
  const pid = readPid();
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function spawnDaemon(daemonScript: string): void {
  const child = spawn(process.execPath, [daemonScript], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

export function stopDaemon(): boolean {
  const pid = readPid();
  if (!pid) return false;
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
  }
  cleanup();
  return true;
}

export function cleanup(): void {
  try { unlinkSync(pidPath()); } catch {}
  try { unlinkSync(socketPath()); } catch {}
}
