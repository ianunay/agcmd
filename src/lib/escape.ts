/**
 * Escape single quotes for shell commands.
 * Replaces ' with '\'' (end quote, escaped quote, start quote)
 */
export function escapeForShell(str: string): string {
  return str.replace(/'/g, "'\\''");
}

/**
 * Escape exclamation marks for Gemini compatibility.
 * Replaces ! with \!
 */
export function escapeForAgents(str: string): string {
  return str.replace(/!/g, '\\!');
}

/**
 * Escape a message for sending to agents.
 * Combines shell and agent escaping unless raw mode is enabled.
 */
export function escapeMessage(str: string, raw: boolean = false): string {
  if (raw) {
    return str;
  }
  return escapeForAgents(escapeForShell(str));
}
