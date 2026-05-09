import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect } from 'vitest';
import { runDeterministicInstall, type InstallResult } from '../installer';
import { createTestPackage } from './helpers';

describe('runDeterministicInstall', () => {
  function makePassValidation(sourcePath: string, packageName: string) {
    return {
      status: 'pass' as const,
      packageName,
      errors: [] as any[],
      warnings: [] as any[],
      details: {
        packagePath: sourcePath,
        manifestFound: true,
        tsconfigFound: true,
        compilerChecked: true,
        notes: [] as string[],
        entrypoint: `src/extensions/${packageName}/index.ts` as string | undefined,
        tsconfig: `${sourcePath}/tsconfig.json` as string | undefined,
      },
    };
  }

  it('fails when validation status is fail', () => {
    const result = runDeterministicInstall({
      sourcePath: '/tmp/fake',
      validation: {
        status: 'fail',
        packageName: 'fake-ext',
        errors: [{ code: 'test.error', message: 'Test error', severity: 'error' }],
        warnings: [],
        details: {
          packagePath: '/tmp/fake',
          manifestFound: false,
          tsconfigFound: false,
          compilerChecked: false,
          notes: [],
        },
      },
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Test error');
    expect(result.installPath).toBe('');
  });

  it('fails when source path does not exist', () => {
    const result = runDeterministicInstall({
      sourcePath: '/tmp/nonexistent-dir-xyz-999',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Source path does not exist');
  });

  it('installs to ~/.pi-extensions/<name> on success', () => {
    const { dir, cleanup } = createTestPackage({ name: 'my-installed-ext' });
    try {
      const result = runDeterministicInstall({ sourcePath: dir, validation: makePassValidation(dir, 'my-installed-ext') });

      expect(result.success).toBe(true);
      expect(result.extensionName).toBe('my-installed-ext');
      expect(result.installPath).toContain('.pi-extensions');
      expect(result.installPath).toContain('my-installed-ext');
      expect(fs.existsSync(result.installPath)).toBe(true);
      expect(fs.existsSync(path.join(result.installPath, 'package.json'))).toBe(true);
    } finally {
      cleanup();
      // Clean up install dir too
      const installDir = path.join(os.homedir(), '.pi-extensions', 'my-installed-ext');
      if (fs.existsSync(installDir)) {
        fs.rmSync(installDir, { recursive: true, force: true });
      }
    }
  });

  it('replaces existing installation', () => {
    const { dir, cleanup } = createTestPackage({ name: 'replace-test' });
    const installDir = path.join(os.homedir(), '.pi-extensions', 'replace-test');
    try {
      const validation = makePassValidation(dir, 'replace-test');

      // First install
      const firstResult = runDeterministicInstall({ sourcePath: dir, validation });
      expect(firstResult.success).toBe(true);

      // Mark the installed copy with a marker
      const markerPath = path.join(installDir, 'MARKER');
      fs.writeFileSync(markerPath, 'original');

      // Second install should replace
      const secondResult = runDeterministicInstall({ sourcePath: dir, validation });
      expect(secondResult.success).toBe(true);
      // The marker should be gone (fresh copy)
      expect(fs.existsSync(markerPath)).toBe(false);
    } finally {
      cleanup();
      if (fs.existsSync(installDir)) {
        fs.rmSync(installDir, { recursive: true, force: true });
      }
    }
  });

  it('uses validation packageName for install directory', () => {
    const { dir, cleanup } = createTestPackage({ name: 'source-dir-name' });
    const installDir = path.join(os.homedir(), '.pi-extensions', 'validated-name');
    try {
      const result = runDeterministicInstall({
        sourcePath: dir,
        validation: {
          status: 'pass',
          packageName: 'validated-name',
          errors: [],
          warnings: [],
          details: {
            packagePath: dir,
            manifestFound: true,
            tsconfigFound: true,
            compilerChecked: true,
            notes: [],
            entrypoint: 'src/extensions/validated-name/index.ts',
            tsconfig: path.join(dir, 'tsconfig.json'),
          },
        },
      });

      expect(result.success).toBe(true);
      expect(result.extensionName).toBe('validated-name');
      expect(result.installPath).toContain('validated-name');
      expect(fs.existsSync(installDir)).toBe(true);
    } finally {
      cleanup();
      if (fs.existsSync(installDir)) {
        fs.rmSync(installDir, { recursive: true, force: true });
      }
    }
  });
});
