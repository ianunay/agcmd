export const reset = '\x1b[0m';

export function red(text: string): string {
  return `\x1b[31m${text}${reset}`;
}

export function green(text: string): string {
  return `\x1b[32m${text}${reset}`;
}

export function yellow(text: string): string {
  return `\x1b[33m${text}${reset}`;
}

export function cyan(text: string): string {
  return `\x1b[36m${text}${reset}`;
}

export function bold(text: string): string {
  return `\x1b[1m${text}${reset}`;
}

export function dim(text: string): string {
  return `\x1b[2m${text}${reset}`;
}
