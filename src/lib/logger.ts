import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectDir, loadConfig } from './config.js';
import type { LogEntry } from '../types.js';

/**
 * Get the path to the commands log file.
 */
export function getLogPath(): string {
  return join(getProjectDir(), 'logs', 'commands.jsonl');
}

/**
 * Log a command entry to the JSONL log file.
 * Does nothing if logging is disabled in config.
 */
export function log(entry: Omit<LogEntry, 'ts'>): void {
  const config = loadConfig();
  if (!config.log) {
    return;
  }

  const logPath = getLogPath();

  const logsDir = join(getProjectDir(), 'logs');
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

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
