import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Config } from '../types.js';

/**
 * Get the agcmd config directory path.
 */
export function getConfigDir(): string {
  return join(homedir(), '.agcmd');
}

/**
 * Ensure the config directory and subdirectories exist.
 */
export function ensureConfigDir(): void {
  const configDir = getConfigDir();
  const subdirs = ['plans', 'questions', 'logs'];

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  for (const subdir of subdirs) {
    const subdirPath = join(configDir, subdir);
    if (!existsSync(subdirPath)) {
      mkdirSync(subdirPath, { recursive: true });
    }
  }
}

/**
 * Get the default configuration.
 */
export function getDefaultConfig(): Config {
  return {
    agents: {
      claude: {
        command: "claude",
      },
      codex: {
        command: "codex",
      },
      gemini: {
        command: "gemini",
      },
    },
    defaultReviewFormat:
      "JSON with agrees, confidence, blocking, review-comments",
    log: false,
  };
}

/**
 * Load the configuration from ~/.agcmd/config.json.
 * Creates default config if it doesn't exist.
 */
export function loadConfig(): Config {
  ensureConfigDir();

  const configPath = join(getConfigDir(), 'config.json');

  if (!existsSync(configPath)) {
    const defaultConfig = getDefaultConfig();
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2) + '\n');
    return defaultConfig;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as Config;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse config.json: ${errorMessage}`);
  }
}
