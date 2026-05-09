import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Create a temporary extension package for testing.
 * Returns the temp directory path and a cleanup function.
 */
export function createTestPackage(overrides?: {
  name?: string;
  hasPackageJson?: boolean;
  hasTsconfig?: boolean;
  hasEntrypoint?: boolean;
  packageJsonContent?: Record<string, unknown>;
  tsconfigContent?: string;
  entrypointContent?: string;
  entrypointPath?: string;
}): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-creator-test-'));
  const opts = {
    name: 'test-extension',
    hasPackageJson: true,
    hasTsconfig: true,
    hasEntrypoint: true,
    ...overrides,
  };

  if (opts.hasPackageJson) {
    const pkgJson: Record<string, unknown> = opts.packageJsonContent ?? {
      name: opts.name,
      version: '1.0.0',
      pi: {
        extensions: [opts.entrypointPath ?? './src/extensions/test-extension'],
      },
    };
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkgJson, null, 2));
  }

  if (opts.hasTsconfig) {
    const tsconfig = opts.tsconfigContent ?? JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'Node16',
        strict: true,
        skipLibCheck: true,
      },
      include: ['src/**/*.ts'],
    }, null, 2);
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), tsconfig);
  }

  if (opts.hasEntrypoint) {
    const entryRelPath = opts.entrypointPath ?? './src/extensions/test-extension';
    const entryFullPath = path.join(dir, entryRelPath);
    if (/\.(ts|tsx)$/i.test(entryRelPath)) {
      // Entrypoint is a file path
      fs.mkdirSync(path.dirname(entryFullPath), { recursive: true });
      fs.writeFileSync(entryFullPath, opts.entrypointContent ?? 'export default function() {}');
    } else {
      // Entrypoint is a directory path — create dir and write index.ts inside
      fs.mkdirSync(entryFullPath, { recursive: true });
      fs.writeFileSync(path.join(entryFullPath, 'index.ts'), opts.entrypointContent ?? 'export default function() {}');
    }
  }

  return {
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}
