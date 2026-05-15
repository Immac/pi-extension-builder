import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Scope, Registry, RegistryEntry, ManagerResult, HarnessAdapter } from './types';

const REGISTRY_VERSION = 1;

export class ExtensionManager {
  private userVaultRoot: string;
  private projectVaultRoot: string | null;
  private harnessAdapter?: HarnessAdapter;

  constructor(opts?: {
    userVaultRoot?: string;
    projectDir?: string;
    harnessAdapter?: HarnessAdapter;
  }) {
    this.userVaultRoot = opts?.userVaultRoot ?? path.join(os.homedir(), '.extension-manager');
    this.projectVaultRoot = opts?.projectDir ? path.join(opts.projectDir, '.extension-manager') : null;
    this.harnessAdapter = opts?.harnessAdapter;
  }

  // ── Public API ──────────────────────────────────────────────────────

  install(source: string, scope: Scope, opts?: { name?: string; skipSync?: boolean }): ManagerResult {
    // Derive name: explicit > package.json name > basename
    let name = opts?.name;
    if (!name) {
      try {
        const pkgPath = path.join(source, 'package.json');
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { name?: string };
          name = pkg.name;
        }
      } catch {
        // fallback to basename
      }
    }
    if (!name) name = path.basename(source);
    try {
      sanitizeExtensionName(name);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : `Invalid extension name: ${name}`,
      };
    }
    const vaultRoot = this.vaultRoot(scope);
    const destDir = path.join(vaultRoot, 'extensions', name);

    // Validate source
    if (!fs.existsSync(source)) {
      return { success: false, message: `Source path does not exist: ${source}` };
    }

    // Ensure vault dirs
    fs.mkdirSync(path.join(vaultRoot, 'extensions'), { recursive: true });

    // Resolve paths to detect self-install (source === destDir)
    const resolvedSource = path.resolve(source);
    const resolvedDest = path.resolve(destDir);
    const isSelfInstall = resolvedSource === resolvedDest;

    // Remove existing if present (replace) — skip if self-install
    if (fs.existsSync(destDir) && !isSelfInstall) {
      fs.rmSync(destDir, { recursive: true, force: true });
    }

    // Copy source → vault (skip if self-install — already in place)
    if (!isSelfInstall) {
      try {
        copyDirExcludingPi(source, destDir);
      } catch (error) {
        return {
          success: false,
          message: `Installation failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // Build registry entry
    const now = Date.now();
    const entry: RegistryEntry = {
      name,
      source: path.resolve(source),
      vaultPath: destDir,
      scope,
      enabled: true,
      installedAt: now,
      lastModified: now,
    };

    // Update registry
    const registry = this.readRegistry(scope);
    const existingIdx = registry.extensions.findIndex((e) => e.name === name);
    if (existingIdx >= 0) {
      registry.extensions[existingIdx] = entry;
    } else {
      registry.extensions.push(entry);
    }
    registry.lastModified = now;
    this.writeRegistry(scope, registry);

    // Sync to harness (unless skipSync)
    if (!opts?.skipSync) {
      this.syncEnable(entry);
    }

    return { success: true, message: `Installed ${name} to ${destDir}`, entry };
  }

  uninstall(name: string, scope: Scope, opts?: { skipSync?: boolean }): ManagerResult {
    try {
      sanitizeExtensionName(name);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : `Invalid extension name: ${name}`,
      };
    }

    const vaultRoot = this.vaultRoot(scope);
    const destDir = path.join(vaultRoot, 'extensions', name);

    const registry = this.readRegistry(scope);
    const existingIdx = registry.extensions.findIndex((e) => e.name === name);
    if (existingIdx < 0) {
      return { success: false, message: `Extension "${name}" not found in registry (scope: ${scope})` };
    }

    const entry = registry.extensions[existingIdx];

    // Remove from harness first (before vault is gone)
    if (!opts?.skipSync) {
      this.syncDisable(entry);
      this.syncUninstall(entry);
    }

    // Remove from vault
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true, force: true });
    }

    // Remove from registry
    registry.extensions.splice(existingIdx, 1);
    registry.lastModified = Date.now();
    this.writeRegistry(scope, registry);

    return { success: true, message: `Uninstalled ${name}`, entry };
  }

  enable(name: string, scope: Scope, opts?: { skipSync?: boolean }): ManagerResult {
    try {
      sanitizeExtensionName(name);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : `Invalid extension name: ${name}`,
      };
    }

    const registry = this.readRegistry(scope);
    const entry = registry.extensions.find((e) => e.name === name && e.scope === scope);
    if (!entry) {
      return { success: false, message: `Extension "${name}" not found in registry (scope: ${scope})` };
    }
    if (entry.enabled) {
      return { success: true, message: `${name} already enabled`, entry };
    }

    entry.enabled = true;
    entry.lastModified = Date.now();
    registry.lastModified = entry.lastModified;
    this.writeRegistry(scope, registry);

    if (!opts?.skipSync) {
      this.syncEnable(entry);
    }

    return { success: true, message: `Enabled ${name}`, entry };
  }

  disable(name: string, scope: Scope, opts?: { skipSync?: boolean }): ManagerResult {
    try {
      sanitizeExtensionName(name);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : `Invalid extension name: ${name}`,
      };
    }

    const registry = this.readRegistry(scope);
    const entry = registry.extensions.find((e) => e.name === name && e.scope === scope);
    if (!entry) {
      return { success: false, message: `Extension "${name}" not found in registry (scope: ${scope})` };
    }
    if (!entry.enabled) {
      return { success: true, message: `${name} already disabled`, entry };
    }

    entry.enabled = false;
    entry.lastModified = Date.now();
    registry.lastModified = entry.lastModified;
    this.writeRegistry(scope, registry);

    if (!opts?.skipSync) {
      this.syncDisable(entry);
    }

    return { success: true, message: `Disabled ${name}`, entry };
  }

  list(scope?: Scope): RegistryEntry[] {
    if (scope) {
      const registry = this.readRegistry(scope);
      return registry.extensions;
    }
    const user = this.readRegistry('user');
    const project = this.readRegistry('project');
    return [...user.extensions, ...project.extensions];
  }

  /** Check if the registry was modified since the caller's last known timestamp */
  checkModified(scope: Scope, since: number): boolean {
    const registry = this.readRegistry(scope);
    return registry.lastModified > since;
  }

  /** Read lastModified for a scope */
  lastModified(scope: Scope): number {
    return this.readRegistry(scope).lastModified;
  }

  // ── Internal: Registry I/O ──────────────────────────────────────────

  private vaultRoot(scope: Scope): string {
    if (scope === 'user') return this.userVaultRoot;
    if (this.projectVaultRoot) return this.projectVaultRoot;
    throw new Error('Project scope requires a projectDir to be configured');
  }

  private registryPath(scope: Scope): string {
    return path.join(this.vaultRoot(scope), 'registry.json');
  }

  readRegistry(scope: Scope): Registry {
    const rp = this.registryPath(scope);
    try {
      const raw = JSON.parse(fs.readFileSync(rp, 'utf8')) as Registry;
      if (!Array.isArray(raw.extensions)) raw.extensions = [];
      return raw;
    } catch {
      return { version: REGISTRY_VERSION, extensions: [], lastModified: 0 };
    }
  }

  private writeRegistry(scope: Scope, registry: Registry): void {
    const rp = this.registryPath(scope);
    fs.mkdirSync(path.dirname(rp), { recursive: true });
    fs.writeFileSync(rp, JSON.stringify(registry, null, 2) + '\n');
  }

  // ── Internal: Harness sync ──────────────────────────────────────────

  private syncEnable(entry: RegistryEntry): void {
    try {
      this.harnessAdapter?.onEnable?.(entry);
    } catch (error) {
      console.warn(`[extension-manager] Warning: harness onEnable failed: ${error}`);
    }
  }

  private syncDisable(entry: RegistryEntry): void {
    try {
      this.harnessAdapter?.onDisable?.(entry);
    } catch (error) {
      console.warn(`[extension-manager] Warning: harness onDisable failed: ${error}`);
    }
  }

  private syncUninstall(entry: RegistryEntry): void {
    try {
      this.harnessAdapter?.onUninstall?.(entry);
    } catch (error) {
      console.warn(`[extension-manager] Warning: harness onUninstall failed: ${error}`);
    }
  }
}

// ── Name sanitization ────────────────────────────────────────────────

const EXTENSION_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

/**
 * Validate that an extension name does not contain path-traversal sequences
 * or operating-system path separators. Throws on invalid names.
 */
function sanitizeExtensionName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new Error('Extension name must not be empty');
  }
  if (name.includes('/') || name.includes('\\')) {
    throw new Error(`Extension name "${name}" must not contain path separators`);
  }
  if (name === '.' || name === '..' || name.startsWith('..')) {
    throw new Error(`Extension name "${name}" must not contain relative path components`);
  }
  if (path.isAbsolute(name)) {
    throw new Error(`Extension name "${name}" must not be an absolute path`);
  }
}

// ── Utility: directory copy (excluding .pi and node_modules) ─────────

/** Error codes for permission/access failures that should be non-fatal. */
const ACCESS_ERROR_CODES = new Set(['EACCES', 'EPERM', 'EBUSY']);

/** Directories to always skip when copying extension source into the vault. */
const SKIP_DIRS = new Set(['.pi', 'node_modules', '.bin']);

function copyDirExcludingPi(src: string, dest: string): void {
  // Read source before creating dest — avoid leaving empty directories
  // when the source is unreadable
  let entries;
  try {
    entries = fs.readdirSync(src, { withFileTypes: true });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code && ACCESS_ERROR_CODES.has(err.code)) {
      console.warn(`[extension-manager] Warning: cannot read directory "${src}": ${error}`);
      return;
    }
    throw error;
  }

  fs.mkdirSync(dest, { recursive: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (SKIP_DIRS.has(entry.name)) continue;

    try {
      if (entry.isSymbolicLink()) {
        // Resolve symlink target and verify it's within the source tree
        const realTarget = fs.realpathSync(srcPath);
        const resolvedSrc = path.resolve(src);
        if (realTarget === resolvedSrc) {
          throw new Error(
            `Symlink "${entry.name}" is self-referential; cannot copy`,
          );
        }
        if (!realTarget.startsWith(resolvedSrc + path.sep)) {
          console.warn(
            `[extension-manager] Warning: skipping symlink "${entry.name}" (points outside source tree: ${realTarget})`,
          );
          continue;
        }
        // Symlink within source tree — resolve to real path and follow
        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
          copyDirExcludingPi(realTarget, destPath);
        } else {
          fs.copyFileSync(realTarget, destPath);
        }
      } else if (entry.isDirectory()) {
        copyDirExcludingPi(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code && ACCESS_ERROR_CODES.has(err.code)) {
        console.warn(`[extension-manager] Warning: skipping unreadable entry "${entry.name}": ${error}`);
      } else {
        throw error;
      }
    }
  }
}
