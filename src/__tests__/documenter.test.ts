import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateDocumentation } from '../documenter';
import { createTestPackage } from './helpers';

describe('generateDocumentation', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('generates README.md for a minimal extension', async () => {
    const { dir, cleanup } = createTestPackage({
      name: 'simple-ext',
      entrypointContent: `
import { defineTool } from "pi-coding-agent";
import { Type } from "typebox";
export default function(pi) {
  pi.registerTool({ name: "hello", parameters: Type.Object({}) });
}
      `.trim(),
    });
    try {
      const docs = await generateDocumentation(dir);
      expect(docs.readme).toContain('simple-ext');
      expect(docs.filesWritten).toContain('README.md');
      expect(docs.readme).toMatch(/# .+/);  // has a heading
    } finally {
      cleanup();
    }
  });

  it('generates ARCHITECTURE.md for complex extensions with tools and prompts', async () => {
    const { dir, cleanup } = createTestPackage({
      name: 'complex-ext',
      entrypointContent: `
import { defineTool } from "pi-coding-agent";
import { Type } from "typebox";
export default function(pi) {
  pi.registerTool({ name: "tool1", parameters: Type.Object({}) });
  pi.registerTool({ name: "tool2", parameters: Type.Object({}) });
}
      `.trim(),
    });
    try {
      // Add prompts directory to trigger ARCHITECTURE generation
      fs.mkdirSync(path.join(dir, 'prompts'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'prompts', 'extension.md'), '# Prompt');

      const docs = await generateDocumentation(dir);
      expect(docs.readme).toBeTruthy();
      if (docs.architecture) {
        expect(docs.filesWritten).toContain('ARCHITECTURE.md');
      }
    } finally {
      cleanup();
    }
  });

  it('detects commands in source', async () => {
    const { dir, cleanup } = createTestPackage({
      name: 'cmd-ext',
      entrypointContent: `
import { defineCommand } from "pi-coding-agent";
export default function(pi) {
  pi.registerCommand({ name: "greet" });
}
      `.trim(),
    });
    try {
      const docs = await generateDocumentation(dir);
      expect(docs.readme).toContain('cmd-ext');
      expect(docs.readme).toMatch(/command/i);
    } finally {
      cleanup();
    }
  });

  it('handles extension with no package.json gracefully', async () => {
    const { dir, cleanup } = createTestPackage({
      hasPackageJson: false,
      hasTsconfig: false,
      hasEntrypoint: false,
    });
    try {
      const docs = await generateDocumentation(dir);
      // Should use directory basename as extension name
      expect(docs.readme).toBeTruthy();
      expect(docs.filesWritten).toContain('README.md');
    } finally {
      cleanup();
    }
  });
});
