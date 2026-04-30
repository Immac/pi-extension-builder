declare module 'node:fs' {
  const fs: {
    existsSync(path: string): boolean;
    readFileSync(path: string, encoding: string): string;
    statSync(path: string): { isDirectory(): boolean };
  };

  export default fs;
}

declare module 'node:path' {
  const path: {
    resolve(...parts: string[]): string;
    join(...parts: string[]): string;
    dirname(value: string): string;
    basename(value: string): string;
    extname(value: string): string;
    parse(value: string): { name: string };
    relative(from: string, to: string): string;
  };

  export default path;
}

declare module 'node:child_process' {
  export interface SpawnSyncReturns {
    status: number | null;
    stdout: string;
    stderr: string;
    error?: Error;
  }

  const childProcess: {
    spawnSync(command: string, args?: readonly string[], options?: { cwd?: string; encoding?: string; shell?: boolean }): SpawnSyncReturns;
  };

  export default childProcess;
}

declare module 'node:process' {
  const process: {
    argv: string[];
    cwd(): string;
    exitCode: number | undefined;
    stdout: { write(chunk: string): void };
    stderr: { write(chunk: string): void };
  };

  export default process;
}

declare module '@mariozechner/pi-ai' {
  export const Type: any;
}

declare module '@mariozechner/pi-coding-agent' {
  export interface ExtensionAPI {
    registerTool(tool: any): void;
    on(event: string, handler: (...args: any[]) => any): void;
    appendEntry?<T>(type: string, data: T): void;
    setSystemPrompt?(prompt: string): void;
    exec?(command: string, args?: readonly string[], options?: { signal?: any; timeout?: number; cwd?: string }): Promise<{ code?: number | null; stdout?: string; stderr?: string; killed?: boolean }>;
  }

  export function defineTool(definition: any): any;
}
