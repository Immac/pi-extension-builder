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

  // Copy source to install path
  try {
    copyDirectory(sourcePath, installPath);
    
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

function cleanupSettingsJson(sourcePath: string, installPath: string, extensionName: string): void {
  const settingsPath = path.join(os.homedir(), '.pi', 'agent', 'settings.json');
  if (!fs.existsSync(settingsPath)) return;

  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (!Array.isArray(settings.packages)) return;

    // Normalize sourcePath to absolute without trailing slash
    const sourceNormalized = path.resolve(sourcePath);

    
    let changed = false;
    let cleaned = settings.packages.filter((p: string) => {
      // Remove the source path if it's listed (duplicate entry)
      if (path.resolve(p) === sourceNormalized) {
        changed = true;
        return false; // remove it
      }
      return true;
    });

    // Normalize installPath to absolute
    const installNormalized = path.resolve(installPath);
    
    // Replace with install path (only if it wasn't already there)
    const hasInstallPath = cleaned.some((p: string) => 
      path.resolve(p) === installNormalized
    );
    
    if (!hasInstallPath) {
      cleaned = [installPath, ...cleaned];
      changed = true;
    }

    // Only write if we actually changed something
    if (changed) {
      settings.packages = cleaned;
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    }
  } catch {
    // Ignore errors - settings.json is optional
  }
}

function copyDirectory(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}