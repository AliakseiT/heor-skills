/**
 * Minimal ambient declarations for the Node.js surface used by this package.
 *
 * The package has zero runtime dependencies and deliberately does not depend
 * on @types/node (devDependencies are limited to typescript, vitest, tsx), so
 * the tiny slice of the Node API that the engine and its CLIs rely on is
 * declared here. `types: []` in tsconfig.json prevents any other global type
 * package from being loaded, so these declarations cannot conflict.
 */

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8' | 'utf-8'): string;
}

declare const process: {
  argv: string[];
  exit(code?: number): never;
  stdout: { write(chunk: string): boolean };
  stderr: { write(chunk: string): boolean };
};

declare const console: {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};
