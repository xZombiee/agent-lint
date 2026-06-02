export interface ColorOptions {
  useColor?: boolean;
}

function detectColorSupport(): boolean {
  return process.env.NO_COLOR === undefined && process.stdout.isTTY === true;
}

function wrap(code: number, value: string, useColor: boolean): string {
  return useColor ? `\u001b[${code}m${value}\u001b[0m` : value;
}

export function resolveColorUsage(options?: ColorOptions): boolean {
  return options?.useColor ?? detectColorSupport();
}

export function red(value: string, options?: ColorOptions): string {
  return wrap(31, value, resolveColorUsage(options));
}

export function yellow(value: string, options?: ColorOptions): string {
  return wrap(33, value, resolveColorUsage(options));
}

export function blue(value: string, options?: ColorOptions): string {
  return wrap(34, value, resolveColorUsage(options));
}

export function green(value: string, options?: ColorOptions): string {
  return wrap(32, value, resolveColorUsage(options));
}
