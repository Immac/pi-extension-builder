import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { ValidationResult } from './types';

export interface InstallResult {
  extensionName: string;
  sourcePath: string;
  installPath: string;
  success: boolean;
  message: string;
}

export function runDeterministicInstall(params: {
  sourcePath: string;
  validation?: ValidationResult;
}): InstallResult {
  const { sourcePath } = params;

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

  // Get extension name from package.json or directory name
  const extensionName = params.validation?.packageName || path.basename(sourcePath);

  // Determine install path: ~/.pi-extensions/<extension-name>
  const homeDir = os.homedir();
  const installPath = path.join(homeDir, '.pi-extensions', extensionName);

  // Check source exists
  if (!fs.existsSync(sourcePath)) {
    return {
      extensionName,
      sourcePath,
      installPath,
      success: false,
      message: `Source path does not exist: ${sourcePath}`,
    };
  }

  // Create ~/.pi-extensions if it doesn't exist
  const extensionsDir = path.join(homeDir, '.pi-extensions');
  if (!fs.existsSync(extensionsDir)) {
    fs.mkdirSync(extensionsDir, { recursive: true });
  }

  // Remove existing installation if present (replace with new version)
  if (fs.existsSync(installPath)) {
    fs.rmSync(installPath, { recursive: true, force: true });
  }

  // Copy source to install path, excluding any .pi directories
  try {
    copyDirExcludingPi(sourcePath, installPath);
    
    // Clean up settings.json - remove duplicate source path entries
    cleanupSettingsJson(sourcePath, installPath, extensionName);
    
    return {
      extensionName,
      sourcePath,
      installPath,
      success: true,
      message: `Successfully installed ${extensionName} to ${installPath} (replaced existing)`,
    };
  } catch (error) {
    return {
      extensionName,
      sourcePath,
      installPath,
      success: false,
      message: `Installation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Recursively copy a directory, excluding any .pi directories.
 * This prevents copying the agent's own configuration into the installed extension.
 */
function copyDirExcludingPi(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.name === '.pi') {
      // Skip .pi directories entirely
      continue;
    }

    if (entry.isDirectory()) {
      copyDirExcludingPi(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function cleanupSettingsJson(sourcePath: string, installPath: string, extensionName: string): void {
  const settingsPath = path.join(os.homedir(), '.pi', 'agent', 'settings.json');
  const settingsDir = path.dirname(settingsPath);

  try {
    fs.mkdirSync(settingsDir, { recursive: true });

    const sourceNormalized = path.resolve(sourcePath);
    const installNormalized = path.resolve(installPath);

    let settings: { packages?: string[] } = {};
    let changed = false;

    if (fs.existsSync(settingsPath)) {
      const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as { packages?: unknown };
      if (Array.isArray(parsed.packages)) {
        settings.packages = parsed.packages.filter((value): value is string => typeof value === 'string');
      }
    }

    const packages = Array.isArray(settings.packages) ? settings.packages : [];
    const cleaned = packages.filter((p: string) => {
      if (path.resolve(p) === sourceNormalized) {
        changed = true;
        return false;
      }
      return true;
    });

    if (!cleaned.some((p: string) => path.resolve(p) === installNormalized)) {
      cleaned.unshift(installPath);
      changed = true;
    }

    if (!fs.existsSync(settingsPath) || changed) {
      fs.writeFileSync(settingsPath, JSON.stringify({ packages: cleaned }, null, 2) + '\n');
    }
  } catch (error) {
    // settings.json is optional — log the error but don't block install
    console.warn(`[extension-creator] Warning: could not update settings.json: ${error instanceof Error ? error.message : String(error)}`);
  }
}

