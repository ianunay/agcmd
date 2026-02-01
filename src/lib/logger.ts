import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getConfigDir, ensureConfigDir } from './config.js';
import type { LogEntry } from '../types.js';

/**
 * Get the path to the commands log file.
 */
export function getLogPath(): string {
  return join(getConfigDir(), 'logs', 'commands.jsonl');
}

/**
 * Log a command entry to the JSONL log file.
 */
export function log(entry: Omit<LogEntry, 'ts'>): void {
  ensureConfigDir();

  const logPath = getLogPath();
  const fullEntry: LogEntry = {
    ts: new Date().toISOString(),
    ...entry
  };

  const line = JSON.stringify(fullEntry) + '\n';

  if (!existsSync(logPath)) {
    writeFileSync(logPath, line);
  } else {
    appendFileSync(logPath, line);
  }
}
