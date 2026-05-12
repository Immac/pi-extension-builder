import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { RegistryEntry, HarnessAdapter, Scope } from './types';

/**
 * Pi-specific harness adapter.
 * Syncs extension enable/disable state to pi's settings.json `packages` array.
 *
 * User scope  → ~/.pi/agent/settings.json
 * Project scope → <projectDir>/.pi/settings.json
 */
export class PiHarnessAdapter implements HarnessAdapter {
  private projectDir: string | null;

  constructor(opts?: { projectDir?: string }) {
    this.projectDir = opts?.projectDir ?? null;
  }

  onEnable(entry: RegistryEntry): void {
    const settingsPath = this.settingsPath(entry.scope);
    const settings = readSettings(settingsPath);
    const packages = ensurePackagesArray(settings);
    const normalized = path.resolve(entry.vaultPath);

    // Remove any existing entry for the same name (dedup)
    const cleaned = packages.filter((p: string) => {
      const resolved = path.isAbsolute(p) ? path.resolve(p) : p;
      return !resolved.endsWith(`/${entry.name}`) && !resolved.endsWith(`\\${entry.name}`);
    });

    // Add at the front if not already present
    if (!cleaned.some((p: string) => path.resolve(p) === normalized)) {
      cleaned.unshift(normalized);
    }

    settings.packages = cleaned;
    writeSettings(settingsPath, settings);
  }

  onDisable(entry: RegistryEntry): void {
    const settingsPath = this.settingsPath(entry.scope);
    const settings = readSettings(settingsPath);
    const packages = ensurePackagesArray(settings);
    const normalized = path.resolve(entry.vaultPath);

    const cleaned = packages.filter((p: string) => path.resolve(p) !== normalized);
    settings.packages = cleaned;
    writeSettings(settingsPath, settings);
  }

  onUninstall(entry: RegistryEntry): void {
    // Same as disable — ensure it's removed
    this.onDisable(entry);
  }

  // ── Internal ──────────────────────────────────────────────────────

  private settingsPath(scope: 'user' | 'project'): string {
    if (scope === 'user') {
      return path.join(os.homedir(), '.pi', 'agent', 'settings.json');
    }
    if (this.projectDir) {
      return path.join(this.projectDir, '.pi', 'settings.json');
    }
    // Fallback: cwd-relative
    return path.join(process.cwd(), '.pi', 'settings.json');
  }
}

// ── Settings helpers ─────────────────────────────────────────────────

function readSettings(filePath: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeSettings(filePath: string, settings: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n');
}

function ensurePackagesArray(settings: Record<string, unknown>): string[] {
  if (Array.isArray(settings.packages)) {
    return settings.packages.filter((p): p is string => typeof p === 'string');
  }
  return [];
}

/**
 * Repair settings.json if the packages array is missing but the registry
 * has enabled extensions. This recovers from external corruption where
 * another tool (e.g. skill-manager) wrote to settings.json without
 * preserving the packages field.
 *
 * Preserves all existing fields in settings.json.
 * Only writes if there's a mismatch (enabled extensions exist but packages
 * are missing or empty).
 *
 * @param homeDir - Optional home directory override (for testing).
 *   Defaults to os.homedir().
 */
export function repairSettings(
  enabledEntries: RegistryEntry[],
  projectDir?: string,
  homeDir?: string,
): void {
  const resolvedHome = homeDir ?? os.homedir();

  // Group by scope
  const byScope = new Map<Scope, RegistryEntry[]>();
  for (const entry of enabledEntries) {
    if (!entry.enabled) continue;
    const list = byScope.get(entry.scope);
    if (list) {
      list.push(entry);
    } else {
      byScope.set(entry.scope, [entry]);
    }
  }

  for (const [scope, entries] of byScope) {
    const filePath = scope === 'user'
      ? path.join(resolvedHome, '.pi', 'agent', 'settings.json')
      : projectDir
        ? path.join(projectDir, '.pi', 'settings.json')
        : path.join(process.cwd(), '.pi', 'settings.json');

    const settings = readSettings(filePath);
    const existingPackages = ensurePackagesArray(settings);

    // Only repair if packages is missing or empty but we have entries
    if (existingPackages.length > 0) continue;
    if (entries.length === 0) continue;

    settings.packages = entries.map(e => path.resolve(e.vaultPath));
    writeSettings(filePath, settings);
  }
}
