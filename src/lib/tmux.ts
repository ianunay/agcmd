import type { Pane } from '../types.js';
import { escapeForShell, escapeForAgents } from './escape.js';
import { exec } from './exec.js';

/**
 * Check if running inside a tmux session.
 */
export function isInTmux(): boolean {
  return !!process.env.TMUX;
}

/**
 * List all panes in the current tmux window.
 * Returns pane IDs.
 */
export function listPanes(): Pane[] {
  try {
    const output = exec('tmux list-panes -F "#{pane_id}"');
    if (!output.trim()) {
      return [];
    }
    return output.trim().split('\n').map(id => ({ id }));
  } catch {
    return [];
  }
}

/**
 * Send keys to a tmux pane.
 * Message and Enter are sent separately as per requirements.
 */
export function sendKeys(paneId: string, message: string, raw: boolean = false): void {
  const escaped = raw ? escapeForShell(message) : escapeForAgents(escapeForShell(message));
  // Add a short delay before submit to avoid TUIs treating Enter as literal text.
  exec(`tmux send-keys -t ${paneId} '${escaped}' && sleep 0.1 && tmux send-keys -t ${paneId} C-m`);
}

/**
 * Split the current pane.
 * @param direction 'h' for horizontal, 'v' for vertical
 * @param percent Percentage of space for the new pane
 */
export function splitPane(direction: 'h' | 'v', percent?: number): string {
  const args = ['-' + direction];
  if (percent !== undefined) {
    args.push('-p', String(percent));
  }
  args.push('-P', '-F', '"#{pane_id}"');

  const output = exec(`tmux split-window ${args.join(' ')}`);
  return output.trim();
}

/**
 * Select a pane (make it active).
 */
export function selectPane(paneId: string): void {
  exec(`tmux select-pane -t ${paneId}`);
}

/**
 * Run a command in a pane.
 */
export function runInPane(paneId: string, command: string): void {
  // Add a short delay before submit to avoid TUIs treating Enter as literal text.
  exec(`tmux send-keys -t ${paneId} '${escapeForShell(command)}' && sleep 0.1 && tmux send-keys -t ${paneId} C-m`);
}

/**
 * Get the current pane ID.
 */
export function getCurrentPaneId(): string {
  return exec('tmux display-message -p "#{pane_id}"').trim();
}
