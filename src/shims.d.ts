// Type shims for pi SDK packages (not available from npm as published types)
// Node.js built-in types are provided by @types/node (dev dependency)

declare module '@mariozechner/pi-ai' {
  export const Type: any;
}

declare module '@earendil-works/pi-coding-agent' {
  export interface ExtensionAPI {
    registerTool(tool: any): void;
    registerCommand(name: string, options: {
      description?: string;
      getArgumentCompletions?: (prefix: string) => Array<{ value: string; label: string }> | null;
      handler: (args: string, ctx: any) => void | Promise<void>;
    }): void;
    on(event: string, handler: (...args: any[]) => any): void;
    appendEntry?<T>(type: string, data: T): void;
    setSystemPrompt?(prompt: string): void;
    exec?(command: string, args?: readonly string[], options?: { signal?: any; timeout?: number; cwd?: string }): Promise<{ code?: number | null; stdout?: string; stderr?: string; killed?: boolean }>;
  }

  export function defineTool(definition: any): any;
}
