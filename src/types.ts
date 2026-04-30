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
