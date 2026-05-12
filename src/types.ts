export type ValidationStatus = 'pass' | 'warn' | 'fail';

export type ValidationSeverity = 'error' | 'warning';

export interface DiagnosticRecord {
  code: string;
  message: string;
  severity: ValidationSeverity;
  file?: string;
  line?: number;
  column?: number;
  related?: Array<{
    file?: string;
    line?: number;
    column?: number;
    message: string;
  }>;
}

// ── Extension Manager types ──────────────────────────────────────────

export type Scope = 'user' | 'project';

export interface RegistryEntry {
  name: string;
  source: string;
  vaultPath: string;
  scope: Scope;
  enabled: boolean;
  installedAt: number;
  lastModified: number;
}

export interface Registry {
  version: number;
  extensions: RegistryEntry[];
  lastModified: number;
}

export interface ManagerResult {
  success: boolean;
  message: string;
  entry?: RegistryEntry;
}

export interface HarnessAdapter {
  /** Called after an extension is enabled (installed or enabled). */
  onEnable?(entry: RegistryEntry): void;
  /** Called after an extension is disabled. */
  onDisable?(entry: RegistryEntry): void;
  /** Called after an extension is fully uninstalled (vault removed). */
  onUninstall?(entry: RegistryEntry): void;
}

export interface ValidationResult {
  status: ValidationStatus;
  packageName?: string;
  entrypoint?: string;
  tsconfig?: string;
  errors: DiagnosticRecord[];
  warnings: DiagnosticRecord[];
  details: {
    packagePath: string;
    manifestPath?: string;
    manifestFound: boolean;
    tsconfigFound: boolean;
    compilerChecked: boolean;
    notes: string[];
    entrypoint?: string;
    tsconfig?: string;
  };
}
