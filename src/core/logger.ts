export interface Logger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

export const defaultLogger: Logger = {
  info: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
  debug: (...args) => {
    if (process.env.CODESPOON_DEBUG) console.error('[debug]', ...args);
  },
};

let currentLogger: Logger = defaultLogger;

export function setLogger(logger: Logger): void {
  currentLogger = logger;
}

export function getLogger(): Logger {
  return currentLogger;
}
