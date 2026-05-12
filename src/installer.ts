import * as path from 'path';
import type { ValidationResult, Scope, ManagerResult } from './types';
import { ExtensionManager } from './manager';
import { PiHarnessAdapter } from './pi-adapter';

export interface InstallResult {
  extensionName: string;
  sourcePath: string;
  installPath: string;
  success: boolean;
  message: string;
}

/** @deprecated Use ExtensionManager directly (scope-aware).
 *  This function delegates to ExtensionManager with user scope for backward compat. */
export function runDeterministicInstall(params: {
  sourcePath: string;
  validation?: ValidationResult;
  scope?: Scope;
}): InstallResult {
  const { sourcePath, scope = 'user' } = params;

  // Check validation passed
  if (params.validation?.status === 'fail') {
    return {
      extensionName: params.validation.packageName || path.basename(sourcePath),
      sourcePath,
      installPath: '',
      success: false,
      message: `Validation failed: ${params.validation.errors.map(e => e.message).join(', ')}`,
    };
  }

  const extensionName = params.validation?.packageName || path.basename(sourcePath);

  const manager = new ExtensionManager({
    harnessAdapter: new PiHarnessAdapter(),
  });

  const result = manager.install(sourcePath, scope, { name: extensionName });

  return {
    extensionName,
    sourcePath,
    installPath: result.entry?.vaultPath ?? '',
    success: result.success,
    message: result.message,
  };
}

/** Run a scope-aware install using the ExtensionManager. */
export function installExtension(opts: {
  sourcePath: string;
  name?: string;
  scope: Scope;
  projectDir?: string;
}): ManagerResult {
  const manager = new ExtensionManager({
    projectDir: opts.projectDir,
    harnessAdapter: new PiHarnessAdapter({ projectDir: opts.projectDir }),
  });
  return manager.install(opts.sourcePath, opts.scope, { name: opts.name });
}

export function uninstallExtension(opts: {
  name: string;
  scope: Scope;
  projectDir?: string;
}): ManagerResult {
  const manager = new ExtensionManager({
    projectDir: opts.projectDir,
    harnessAdapter: new PiHarnessAdapter({ projectDir: opts.projectDir }),
  });
  return manager.uninstall(opts.name, opts.scope);
}

export function enableExtension(opts: {
  name: string;
  scope: Scope;
  projectDir?: string;
}): ManagerResult {
  const manager = new ExtensionManager({
    projectDir: opts.projectDir,
    harnessAdapter: new PiHarnessAdapter({ projectDir: opts.projectDir }),
  });
  return manager.enable(opts.name, opts.scope);
}

export function disableExtension(opts: {
  name: string;
  scope: Scope;
  projectDir?: string;
}): ManagerResult {
  const manager = new ExtensionManager({
    projectDir: opts.projectDir,
    harnessAdapter: new PiHarnessAdapter({ projectDir: opts.projectDir }),
  });
  return manager.disable(opts.name, opts.scope);
}

export function listExtensions(opts?: {
  scope?: Scope;
  projectDir?: string;
}): ManagerResult & { entries: import('./types').RegistryEntry[] } {
  const manager = new ExtensionManager({
    projectDir: opts?.projectDir,
  });
  const entries = manager.list(opts?.scope);
  return {
    success: true,
    message: `Found ${entries.length} extensions`,
    entries,
  };
}
