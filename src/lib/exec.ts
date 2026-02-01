import { execSync as nodeExecSync } from 'node:child_process';

export type ExecFn = (cmd: string) => string;

let execFn: ExecFn = (cmd) => nodeExecSync(cmd, { encoding: 'utf-8' }) as string;

/**
 * Set a custom exec function (for testing).
 */
export function setExecFn(fn: ExecFn): void {
  execFn = fn;
}

/**
 * Reset to the default exec function.
 */
export function resetExecFn(): void {
  execFn = (cmd) => nodeExecSync(cmd, { encoding: 'utf-8' }) as string;
}

/**
 * Execute a shell command.
 */
export function exec(cmd: string): string {
  return execFn(cmd);
}
