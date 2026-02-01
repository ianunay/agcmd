import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getConfigDir, ensureConfigDir } from './config.js';

export interface PaneMapping {
  [agentName: string]: string; // agent name -> pane ID
}

/**
 * Get the path to the panes.json file.
 */
export function getPanesPath(): string {
  return join(getConfigDir(), 'panes.json');
}

/**
 * Save the pane ID mapping to disk.
 */
export function savePaneMapping(mapping: PaneMapping): void {
  ensureConfigDir();
  const path = getPanesPath();
  writeFileSync(path, JSON.stringify(mapping, null, 2) + '\n');
}

/**
 * Load the pane ID mapping from disk.
 * Returns empty object if file doesn't exist.
 */
export function loadPaneMapping(): PaneMapping {
  const path = getPanesPath();
  if (!existsSync(path)) {
    return {};
  }
  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as PaneMapping;
  } catch {
    return {};
  }
}

/**
 * Get the pane ID for an agent.
 * Returns null if not found.
 */
export function getPaneId(agentName: string): string | null {
  const mapping = loadPaneMapping();
  return mapping[agentName] || null;
}

/**
 * Get the agent name for a pane ID.
 * Returns null if not found (pane is not a known agent).
 */
export function getAgentByPaneId(paneId: string): string | null {
  const mapping = loadPaneMapping();
  for (const [agentName, id] of Object.entries(mapping)) {
    if (id === paneId) {
      return agentName;
    }
  }
  return null;
}
