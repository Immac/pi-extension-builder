import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { RegistryEntry, HarnessAdapter } from './types';

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
