import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runDeterministicInstall } from '../installer';
import { ExtensionManager } from '../manager';
import { createTestPackage } from './helpers';

// ── Helpers ──────────────────────────────────────────────────────────

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

/** Temp directory used as vault root for the current test. Cleaned up in afterEach. */
let testVaultDir: string;

beforeEach(() => {
  testVaultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-mgr-test-'));
});

afterEach(() => {
  if (testVaultDir && fs.existsSync(testVaultDir)) {
    fs.rmSync(testVaultDir, { recursive: true, force: true });
  }
});

function userManager(): ExtensionManager {
  return new ExtensionManager({ userVaultRoot: path.join(testVaultDir, 'user') });
}

function projectManager(): ExtensionManager {
  return new ExtensionManager({ projectDir: path.join(testVaultDir, 'proj') });
}

function bothManagers(): { user: ExtensionManager; project: ExtensionManager } {
  return {
    user: new ExtensionManager({ userVaultRoot: path.join(testVaultDir, 'user') }),
    project: new ExtensionManager({ projectDir: path.join(testVaultDir, 'proj') }),
  };
}

// ── runDeterministicInstall (backward compat) ────────────────────────

describe('runDeterministicInstall (backward compat)', () => {
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
});

// ── ExtensionManager.install ─────────────────────────────────────────

describe('ExtensionManager.install', () => {
  it('installs an extension to the user vault', () => {
    const mgr = userManager();
    const { dir, cleanup } = createTestPackage({ name: 'test-ext' });
    try {
      const result = mgr.install(dir, 'user');

      expect(result.success).toBe(true);
      expect(result.entry).toBeDefined();
      expect(result.entry!.name).toBe('test-ext');
      expect(result.entry!.scope).toBe('user');
      expect(result.entry!.enabled).toBe(true);
      expect(fs.existsSync(result.entry!.vaultPath)).toBe(true);
      expect(fs.existsSync(path.join(result.entry!.vaultPath, 'package.json'))).toBe(true);

      const registry = mgr.readRegistry('user');
      expect(registry.extensions).toHaveLength(1);
      expect(registry.extensions[0].name).toBe('test-ext');
    } finally {
      cleanup();
    }
  });

  it('installs an extension to the project vault', () => {
    const mgr = projectManager();
    const { dir, cleanup } = createTestPackage({ name: 'proj-ext' });
    try {
      const result = mgr.install(dir, 'project');

      expect(result.success).toBe(true);
      expect(result.entry!.vaultPath).toContain('extension-manager');
      expect(result.entry!.scope).toBe('project');
      expect(fs.existsSync(result.entry!.vaultPath)).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('replaces an existing installation in the vault', () => {
    const mgr = userManager();
    const { dir, cleanup } = createTestPackage({ name: 'replaced-ext' });
    try {
      const first = mgr.install(dir, 'user');
      expect(first.success).toBe(true);

      const marker = path.join(first.entry!.vaultPath, 'MARKER');
      fs.writeFileSync(marker, 'original');

      const second = mgr.install(dir, 'user');
      expect(second.success).toBe(true);
      expect(fs.existsSync(marker)).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('fails when source path does not exist', () => {
    const mgr = userManager();
    const result = mgr.install('/tmp/nonexistent-path-xyz-999', 'user');
    expect(result.success).toBe(false);
    expect(result.message).toContain('does not exist');
  });

  it('fails when source contains a symlink to a file outside the source tree', () => {
    const mgr = userManager();
    const { dir, cleanup } = createTestPackage({ name: 'ext-outside' });
    try {
      // Create external target file
      const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-'));
      fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'sensitive data');

      // Create symlink inside extension pointing outside
      fs.symlinkSync(
        path.join(outsideDir, 'secret.txt'),
        path.join(dir, 'leak.txt'),
      );

      const result = mgr.install(dir, 'user');
      expect(result.success).toBe(false);
      expect(result.message).toContain('outside the source tree');

      // Cleanup external dir
      fs.rmSync(outsideDir, { recursive: true, force: true });
    } finally {
      cleanup();
    }
  });

  it('fails when source contains a self-referential symlink', () => {
    const mgr = userManager();
    const { dir, cleanup } = createTestPackage({ name: 'ext-selfref' });
    try {
      // Create self-referential symlink
      fs.symlinkSync(dir, path.join(dir, 'self'));

      const result = mgr.install(dir, 'user');
      expect(result.success).toBe(false);
      expect(result.message).toContain('self-referential');
    } finally {
      cleanup();
    }
  });

  it('succeeds when source contains a symlink to a file inside the source tree', () => {
    const mgr = userManager();
    const { dir, cleanup } = createTestPackage({ name: 'ext-internal-file' });
    try {
      // Create an internal target file
      fs.writeFileSync(path.join(dir, 'internal.txt'), 'hello');

      // Create symlink inside extension pointing to an internal file
      fs.symlinkSync(
        path.join(dir, 'internal.txt'),
        path.join(dir, 'link-to-internal.txt'),
      );

      const result = mgr.install(dir, 'user');
      expect(result.success).toBe(true);

      // The symlink target should have been copied by following it
      const vaultFile = path.join(result.entry!.vaultPath, 'link-to-internal.txt');
      expect(fs.existsSync(vaultFile)).toBe(true);
      expect(fs.readFileSync(vaultFile, 'utf8')).toBe('hello');
    } finally {
      cleanup();
    }
  });

  it('succeeds when source contains a symlink to a directory inside the source tree', () => {
    const mgr = userManager();
    const { dir, cleanup } = createTestPackage({ name: 'ext-internal-dir' });
    try {
      // Create internal subdirectory with a file
      const subDir = path.join(dir, 'sub');
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, 'nested.txt'), 'nested data');

      // Create symlink to internal directory
      fs.symlinkSync(subDir, path.join(dir, 'link-to-sub'));

      const result = mgr.install(dir, 'user');
      expect(result.success).toBe(true);

      // The directory contents should have been copied by following the symlink
      const vaultSub = path.join(result.entry!.vaultPath, 'link-to-sub');
      expect(fs.existsSync(path.join(vaultSub, 'nested.txt'))).toBe(true);
      expect(fs.readFileSync(path.join(vaultSub, 'nested.txt'), 'utf8')).toBe('nested data');
    } finally {
      cleanup();
    }
  });
});

// ── Extension name sanitization ───────────────────────────────────────

describe('ExtensionManager name sanitization', () => {
  describe('install', () => {
    it('rejects name with path separators', () => {
      const mgr = userManager();
      const { dir, cleanup } = createTestPackage({ name: 'safe-name' });
      try {
        const result = mgr.install(dir, 'user', { name: '../../evil' });
        expect(result.success).toBe(false);
        expect(result.message).toMatch(/path separator|invalid/i);
      } finally {
        cleanup();
      }
    });

    it('rejects name that is a relative path component', () => {
      const mgr = userManager();
      const { dir, cleanup } = createTestPackage({ name: 'safe-name' });
      try {
        const result = mgr.install(dir, 'user', { name: '..' });
        expect(result.success).toBe(false);
        expect(result.message).toMatch(/relative path|invalid/i);
      } finally {
        cleanup();
      }
    });

    it('rejects name that is just a dot', () => {
      const mgr = userManager();
      const { dir, cleanup } = createTestPackage({ name: 'safe-name' });
      try {
        const result = mgr.install(dir, 'user', { name: '.' });
        expect(result.success).toBe(false);
        expect(result.message).toMatch(/relative path|invalid/i);
      } finally {
        cleanup();
      }
    });

    it('rejects absolute path as name', () => {
      const mgr = userManager();
      const { dir, cleanup } = createTestPackage({ name: 'safe-name' });
      try {
        const result = mgr.install(dir, 'user', { name: '/etc/passwd' });
        expect(result.success).toBe(false);
        expect(result.message).toMatch(/path separator|invalid/i);
      } finally {
        cleanup();
      }
    });

    it('accepts valid kebab-case name', () => {
      const mgr = userManager();
      const { dir, cleanup } = createTestPackage({ name: 'safe-name' });
      try {
        const result = mgr.install(dir, 'user');
        expect(result.success).toBe(true);
      } finally {
        cleanup();
      }
    });
  });

  describe('uninstall', () => {
    it('rejects name with path separators', () => {
      const mgr = userManager();
      const result = mgr.uninstall('../../etc', 'user');
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/path separator|invalid/i);
    });

    it('rejects empty name', () => {
      const mgr = userManager();
      const result = mgr.uninstall('', 'user');
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/empty|invalid/i);
    });
  });

  describe('enable / disable', () => {
    it('rejects name with backslash in enable', () => {
      const mgr = userManager();
      const result = mgr.enable('..\\etc', 'user');
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/path separator|invalid/i);
    });

    it('rejects name with forward slash in disable', () => {
      const mgr = userManager();
      const result = mgr.disable('../../../etc', 'user');
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/path separator|invalid/i);
    });
  });
});

// ── copyDirExcludingPi: Symlink traversal guard ────────────────────────────

describe('copyDirExcludingPi symlink guard', () => {
  it('rejects symlink to directory outside the source tree', () => {
    const mgr = userManager();
    const { dir, cleanup } = createTestPackage({ name: 'ext-outside-dir' });
    try {
      // Create external directory with a file
      const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-dir-'));
      fs.writeFileSync(path.join(outsideDir, 'payload.txt'), 'evil');

      // Symlink inside extension pointing to external directory
      fs.symlinkSync(outsideDir, path.join(dir, 'external-dir'));

      const result = mgr.install(dir, 'user');
      expect(result.success).toBe(false);
      expect(result.message).toContain('outside the source tree');

      fs.rmSync(outsideDir, { recursive: true, force: true });
    } finally {
      cleanup();
    }
  });
});

// ── ExtensionManager.enable / disable ────────────────────────────────

describe('ExtensionManager.enable / disable', () => {
  it('toggles an extension', () => {
    const mgr = userManager();
    const { dir, cleanup } = createTestPackage({ name: 'togglable' });
    try {
      mgr.install(dir, 'user');

      const disabled = mgr.disable('togglable', 'user');
      expect(disabled.success).toBe(true);
      expect(disabled.entry!.enabled).toBe(false);

      const enabled = mgr.enable('togglable', 'user');
      expect(enabled.success).toBe(true);
      expect(enabled.entry!.enabled).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('returns success when toggling already-target state', () => {
    const mgr = userManager();
    const { dir, cleanup } = createTestPackage({ name: 'already' });
    try {
      mgr.install(dir, 'user');

      expect(mgr.enable('already', 'user').message).toContain('already enabled');
      expect(mgr.disable('already', 'user').success).toBe(true);
      expect(mgr.disable('already', 'user').message).toContain('already disabled');
    } finally {
      cleanup();
    }
  });

  it('fails for unknown extension', () => {
    const mgr = userManager();
    const r = mgr.enable('nonexistent', 'user');
    expect(r.success).toBe(false);
    expect(r.message).toContain('not found');
  });
});

// ── ExtensionManager.uninstall ───────────────────────────────────────

describe('ExtensionManager.uninstall', () => {
  it('removes extension from vault and registry', () => {
    const mgr = userManager();
    const { dir, cleanup } = createTestPackage({ name: 'gone-soon' });
    try {
      mgr.install(dir, 'user');

      const result = mgr.uninstall('gone-soon', 'user');
      expect(result.success).toBe(true);
      expect(fs.existsSync(result.entry!.vaultPath)).toBe(false);

      const registry = mgr.readRegistry('user');
      expect(registry.extensions.find(e => e.name === 'gone-soon')).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  it('fails for unknown extension', () => {
    const mgr = userManager();
    const result = mgr.uninstall('nope', 'user');
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });
});

// ── ExtensionManager.list ────────────────────────────────────────────

describe('ExtensionManager.list', () => {
  it('lists extensions for user scope', () => {
    const mgr = userManager();
    const { dir: d1, cleanup: c1 } = createTestPackage({ name: 'ext-a' });
    const { dir: d2, cleanup: c2 } = createTestPackage({ name: 'ext-b' });
    try {
      mgr.install(d1, 'user');
      mgr.install(d2, 'user');

      const list = mgr.list('user');
      expect(list).toHaveLength(2);
      expect(list.map(e => e.name).sort()).toEqual(['ext-a', 'ext-b']);
    } finally {
      c1(); c2();
    }
  });

  it('lists project scope independently of user scope', () => {
    const mgr = bothManagers();
    const { dir: d1, cleanup: c1 } = createTestPackage({ name: 'ext-u' });
    const { dir: d2, cleanup: c2 } = createTestPackage({ name: 'ext-p' });
    try {
      mgr.user.install(d1, 'user');
      mgr.project.install(d2, 'project');

      expect(mgr.user.list('user')).toHaveLength(1);
      expect(mgr.user.list('user')[0].name).toBe('ext-u');

      expect(mgr.project.list('project')).toHaveLength(1);
      expect(mgr.project.list('project')[0].name).toBe('ext-p');
    } finally {
      c1(); c2();
    }
  });

  it('returns empty array when no extensions', () => {
    const mgr = userManager();
    expect(mgr.list('user')).toEqual([]);
  });
});

// ── ExtensionManager.checkModified ───────────────────────────────────

describe('ExtensionManager.checkModified', () => {
  it('detects changes after install', () => {
    const mgr = userManager();
    const { dir, cleanup } = createTestPackage({ name: 'fresh' });
    try {
      const before = Date.now() - 10000;
      expect(mgr.checkModified('user', before)).toBe(false);

      mgr.install(dir, 'user');
      expect(mgr.checkModified('user', before)).toBe(true);
      expect(mgr.checkModified('user', mgr.lastModified('user'))).toBe(false);
    } finally {
      cleanup();
    }
  });
});
