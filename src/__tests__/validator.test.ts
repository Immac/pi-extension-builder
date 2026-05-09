import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { validateExtensionProject } from '../validator';
import { createTestPackage } from './helpers';

describe('validateExtensionProject', () => {
  describe('package.json checks', () => {
    it('fails when package.json is missing', async () => {
      const { dir, cleanup } = createTestPackage({ hasPackageJson: false, hasTsconfig: false, hasEntrypoint: false });
      try {
        const result = await validateExtensionProject(dir);
        expect(result.status).toBe('fail');
        expect(result.errors.some(e => e.code === 'manifest.missing')).toBe(true);
      } finally {
        cleanup();
      }
    });

    it('fails when package.json has invalid JSON', async () => {
      const { dir, cleanup } = createTestPackage({ hasPackageJson: false, hasTsconfig: false, hasEntrypoint: false });
      try {
        fs.writeFileSync(path.join(dir, 'package.json'), '{ invalid json }');
        const result = await validateExtensionProject(dir);
        expect(result.status).toBe('fail');
        expect(result.errors.some(e => e.code === 'manifest.invalid-json')).toBe(true);
      } finally {
        cleanup();
      }
    });

    // Need fs and path here
    it('fails when package name is missing', async () => {
      const { dir, cleanup } = createTestPackage({
        packageJsonContent: { version: '1.0.0' },
      });
      try {
        const result = await validateExtensionProject(dir);
        expect(result.status).toBe('fail');
        expect(result.errors.some(e => e.code === 'manifest.name.missing')).toBe(true);
      } finally {
        cleanup();
      }
    });

    it('fails when package name is not kebab-case', async () => {
      const { dir, cleanup } = createTestPackage({
        packageJsonContent: { name: 'CamelCaseName', version: '1.0.0' },
      });
      try {
        const result = await validateExtensionProject(dir);
        expect(result.status).toBe('fail');
        expect(result.errors.some(e => e.code === 'manifest.name.not-kebab-case')).toBe(true);
      } finally {
        cleanup();
      }
    });
  });

  describe('entrypoint checks', () => {
    it('fails when entrypoint is missing', async () => {
      const { dir, cleanup } = createTestPackage({
        hasEntrypoint: false,
        packageJsonContent: { name: 'test-ext', version: '1.0.0' },
      });
      try {
        const result = await validateExtensionProject(dir);
        expect(result.status).toBe('fail');
        expect(result.errors.some(e => e.code === 'manifest.entrypoint.missing')).toBe(true);
      } finally {
        cleanup();
      }
    });

    it('warns when using main as entrypoint', async () => {
      const { dir, cleanup } = createTestPackage({
        hasEntrypoint: true,
        entrypointPath: './dist/index.js',
        packageJsonContent: {
          name: 'test-ext',
          version: '1.0.0',
          main: './dist/index.js',
        },
      });
      try {
        const result = await validateExtensionProject(dir);
        expect(result.warnings.some(e => e.code === 'manifest.entrypoint.legacy-main')).toBe(true);
      } finally {
        cleanup();
      }
    });
  });

  describe('tsconfig checks', () => {
    it('fails when tsconfig.json is missing', async () => {
      const { dir, cleanup } = createTestPackage({ hasTsconfig: false });
      try {
        const result = await validateExtensionProject(dir);
        expect(result.status).toBe('fail');
        expect(result.errors.some(e => e.code === 'tsconfig.missing')).toBe(true);
      } finally {
        cleanup();
      }
    });

    it('still reports manifest errors even when tsconfig is missing', async () => {
      const { dir, cleanup } = createTestPackage({
        hasTsconfig: false,
        hasEntrypoint: false,
        packageJsonContent: { name: 'bad-name', version: '1.0.0' },
      });
      try {
        const result = await validateExtensionProject(dir);
        expect(result.errors.some(e => e.code === 'tsconfig.missing')).toBe(true);
        expect(result.errors.some(e => e.code === 'manifest.entrypoint.missing')).toBe(true);
      } finally {
        cleanup();
      }
    });
  });

  describe('pass scenarios', () => {
    it('passes or warns for a well-structured extension', async () => {
      const { dir, cleanup } = createTestPackage({ name: 'well-structured' });
      try {
        const result = await validateExtensionProject(dir);
        expect(result.status).not.toBe('fail');
        // May warn about entrypoint name not matching extension name, etc.
        if (result.status === 'warn') {
          console.log('Warnings:', result.warnings.map(w => `[${w.code}] ${w.message}`));
        }
      } finally {
        cleanup();
      }
    });

    it('produces reasonable errors', async () => {
      const { dir, cleanup } = createTestPackage({ hasPackageJson: false, hasTsconfig: false, hasEntrypoint: false });
      try {
        const result = await validateExtensionProject(dir);
        expect(result.errors.length).toBeGreaterThanOrEqual(1);
        expect(result.details.manifestFound).toBe(false);
        expect(result.details.compilerChecked).toBe(false);
      } finally {
        cleanup();
      }
    });
  });
});
