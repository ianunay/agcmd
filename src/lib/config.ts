import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import type { Config } from '../types.js';
import { slugify } from './slugify.js';
import { exec } from './exec.js';

/**
 * Get the agcmd config directory path.
 */
export function getConfigDir(): string {
  return join(homedir(), '.agcmd');
}

/**
 * Get the project-scoped directory for the current git repo.
 * Falls back to the current working directory if not in a git repo.
 */
export function getProjectDir(): string {
  let projectRoot: string;
  try {
    projectRoot = exec('git rev-parse --show-toplevel').trim();
  } catch {
    projectRoot = process.cwd();
  }

  const home = homedir();
  const relativePath = relative(home, projectRoot);
  const { slug } = slugify(relativePath);
  const projectDir = join(home, '.agcmd', 'projects', slug);

  if (!existsSync(projectDir)) {
    mkdirSync(projectDir, { recursive: true });
  }

  return projectDir;
}

/**
 * Get the session-scoped directory for the current tmux window.
 * Falls back to "default" if not running inside tmux.
 */
export function getSessionDir(): string {
  let windowId: string;
  try {
    windowId = exec("tmux display-message -p '#{window_id}'").trim();
  } catch {
    windowId = 'default';
  }

  if (!windowId) {
    windowId = 'default';
  }

  const sessionDir = join(getProjectDir(), 'sessions', windowId);

  if (!existsSync(sessionDir)) {
    mkdirSync(sessionDir, { recursive: true });
  }

  return sessionDir;
}

/**
 * Ensure the config directory exists (for global config.json only).
 */
export function ensureConfigDir(): void {
  const configDir = getConfigDir();

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
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
