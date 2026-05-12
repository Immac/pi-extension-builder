export { validateExtensionProject } from './validator';
export {
  runDeterministicInstall,
  installExtension,
  uninstallExtension,
  enableExtension,
  disableExtension,
  listExtensions,
} from './installer';
export { ExtensionManager } from './manager';
export { PiHarnessAdapter } from './pi-adapter';
export type {
  DiagnosticRecord,
  ValidationResult,
  ValidationStatus,
  Scope,
  RegistryEntry,
  Registry,
  ManagerResult,
  HarnessAdapter,
} from './types';
