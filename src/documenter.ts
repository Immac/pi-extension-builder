import fs from 'node:fs';
import path from 'node:path';

export interface GeneratedDocs {
  readme: string;
  architecture?: string;
  filesWritten: string[];
}

/**
 * Analyze an extension at the given path and generate documentation.
 */
export async function generateDocumentation(sourcePath: string): Promise<GeneratedDocs> {
  const resolvedPath = path.resolve(sourcePath);
  const filesWritten: string[] = [];

  // Read package.json for metadata
  const pkgJson = readPackageJson(resolvedPath);
  const extensionName = typeof pkgJson?.name === 'string' ? pkgJson.name : path.basename(resolvedPath);
  const extensionDescription = typeof pkgJson?.description === 'string' ? pkgJson.description : '';

  // Read the entrypoint source
  const entrypoint = resolveEntrypointSource(resolvedPath, pkgJson);
  const entrySource = entrypoint ? readSourceFile(entrypoint) : undefined;

  // Read tsconfig
  const tsconfig = readJsonFile(path.join(resolvedPath, 'tsconfig.json'));

  // Detect extension characteristics
  const kind = detectExtensionKind(entrySource, pkgJson);
  const hasCommands = detectCommands(entrySource);
  const hasTools = detectTools(entrySource);
  const hasPrompts = fs.existsSync(path.join(resolvedPath, 'prompts'));
  const hasSkills = fs.existsSync(path.join(resolvedPath, 'skills'));
  const typescriptVersion = detectTypescriptVersion(tsconfig);

  // Generate README
  const readme = generateReadme({
    extensionName,
    extensionDescription,
    kind,
    hasCommands,
    hasTools,
    hasPrompts,
    hasSkills,
    typescriptVersion,
    sourcePath: resolvedPath,
  });

  filesWritten.push('README.md');

  // Generate ARCHITECTURE.md only for complex extensions
  let architecture: string | undefined;
  if (kind === 'complex' || hasCommands || (hasTools && hasPrompts)) {
    architecture = generateArchitecture({
      extensionName,
      kind,
      hasCommands,
      hasTools,
      hasPrompts,
      hasSkills,
      sourceFiles: listSourceFiles(resolvedPath),
    });
    filesWritten.push('ARCHITECTURE.md');
  }

  return { readme, architecture, filesWritten };
}

// ─── Helpers ────────────────────────────────────────────────────────

function readPackageJson(dir: string): Record<string, unknown> | undefined {
  try {
    const content = fs.readFileSync(path.join(dir, 'package.json'), 'utf8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function readJsonFile(filePath: string): Record<string, unknown> | undefined {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function resolveEntrypointSource(dir: string, pkgJson: Record<string, unknown> | undefined): string | undefined {
  if (!pkgJson) return undefined;

  const piSection = pkgJson.pi as Record<string, unknown> | undefined;
  const piExtensions = piSection?.extensions;
  const piEntrypoint = piSection?.entrypoint;
  const mainEntry = pkgJson.main;

  const candidates = [
    ...(Array.isArray(piExtensions) ? piExtensions.filter((e): e is string => typeof e === 'string') : []),
    ...(typeof piEntrypoint === 'string' ? [piEntrypoint] : []),
    ...(typeof mainEntry === 'string' ? [mainEntry] : []),
  ];

  for (const candidate of candidates) {
    // Try candidate as-is
    const fullPath = path.resolve(dir, candidate);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return fullPath;
    }

    // Try candidate as directory with index.ts
    const indexPath = path.join(fullPath, 'index.ts');
    if (fs.existsSync(indexPath)) {
      return indexPath;
    }

    // Try with .ts extension added
    const tsPath = `${fullPath}.ts`;
    if (fs.existsSync(tsPath)) {
      return tsPath;
    }
  }

  return undefined;
}

function readSourceFile(filePath: string): string | undefined {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }
}

function detectTypescriptVersion(tsconfig: Record<string, unknown> | undefined): string {
  if (!tsconfig) return '5.x';
  const opts = tsconfig.compilerOptions as Record<string, unknown> | undefined;
  if (opts?.target) return String(opts.target).replace(/^ES/, '');
  return '5.x';
}

function detectExtensionKind(
  source: string | undefined,
  pkgJson: Record<string, unknown> | undefined,
): string {
  if (!source && !pkgJson) return 'unknown';

  const description = (typeof pkgJson?.description === 'string' ? pkgJson.description : '').toLowerCase();
  const name = (typeof pkgJson?.name === 'string' ? pkgJson.name : '').toLowerCase();

  if (description.includes('provider') || name.includes('provider')) return 'provider';
  if (description.includes('prompt') || name.includes('prompt')) return 'prompt/system-prompt';
  if (description.includes('command') || name.includes('command')) return 'command';
  if (description.includes('ui') || name.includes('ui')) return 'ui';
  if (source) {
    if (source.includes('registerCommand')) return 'command';
    if (source.includes('registerTool')) return 'tool';
    if (source.includes('setSystemPrompt')) return 'prompt/system-prompt';
  }
  if (hasManySourceFiles(path.dirname(source ?? ''))) return 'complex';
  return 'tool';
}

function hasManySourceFiles(dir: string): boolean {
  try {
    const entries = fs.readdirSync(dir);
    return entries.filter(e => e.endsWith('.ts') || e.endsWith('.tsx')).length > 3;
  } catch {
    return false;
  }
}

function detectCommands(source: string | undefined): boolean {
  return source?.includes('registerCommand') ?? false;
}

function detectTools(source: string | undefined): boolean {
  return source?.includes('registerTool') ?? false;
}

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    walkDir(dir, files);
  } catch {
    // ignore
  }
  return files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.json') || f.endsWith('.md'))
    .map(f => path.relative(dir, f));
}

function walkDir(dir: string, acc: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, acc);
    } else {
      acc.push(fullPath);
    }
  }
}

function generateReadme(params: {
  extensionName: string;
  extensionDescription: string;
  kind: string;
  hasCommands: boolean;
  hasTools: boolean;
  hasPrompts: boolean;
  hasSkills: boolean;
  typescriptVersion: string;
  sourcePath: string;
}): string {
  const { extensionName, extensionDescription, kind, hasCommands, hasTools, hasPrompts, hasSkills, typescriptVersion } = params;
  const kindLabel = kind.charAt(0).toUpperCase() + kind.slice(1);

  return [
    `# ${extensionName}`,
    '',
    extensionDescription || `A pi.dev ${kind} extension.`,
    '',
    '![TypeScript](https://img.shields.io/badge/TypeScript-' +
      `${encodeURIComponent(typescriptVersion)}-blue?style=flat-square&logo=typescript)`,
    '![MIT License](https://img.shields.io/badge/license-MIT-green?style=flat-square)',
    '![Pi Extension](https://img.shields.io/badge/pi--extension-orange?style=flat-square)',
    '',
    '> ⚠️ **Personal Project Disclaimer**: This is a personal project created for my own use. ' +
    'I cannot guarantee regular maintenance, timely updates, or support. Use at your own discretion.',
    '',
    '## ✨ Features',
    '',
    ...(hasTools ? ['- 🛠️ **Tool interface** — Callable from LLM workflows'] : []),
    ...(hasCommands ? ['- ⌨️ **Slash commands** — Interactive session commands'] : []),
    ...(hasPrompts ? ['- 💬 **Prompt templates** — Reusable LLM guidance'] : []),
    ...(hasSkills ? ['- 📚 **Skills** — Specialized workflow instructions'] : []),
    ...(!hasTools && !hasCommands && !hasPrompts && !hasSkills ? ['- 🔧 Core extension functionality'] : []),
    '',
    ...(hasTools ? [
      '## 🛠️ Tools',
      '',
      '| Tool | Description |',
      '|------|-------------|',
      '| `extension_creator` | Plan, scaffold, review, validate, and install extensions |',
      '',
    ] : []),
    ...(hasCommands ? [
      '## ⌨️ Commands',
      '',
      '| Command | Description |',
      '|---------|-------------|',
      '| (auto-detected) | Commands registered by this extension |',
      '',
    ] : []),
    '## 📦 Installation',
    '',
    '```bash',
    '# From the extension directory',
    'npm install',
    'npm run build',
    '# Then use extension_creator tool to install into pi',
    '```',
    '',
    '## 🛠️ Development',
    '',
    '### Prerequisites',
    '',
    `- Node.js 18+`,
    `- TypeScript ${typescriptVersion}+`,
    '',
    '### Commands',
    '',
    '| Command | Description |',
    '|---------|-------------|',
    '| `npm install` | Install dependencies |',
    '| `npm run build` | Compile TypeScript |',
    '| `npm test` | Run tests |',
    '| `npm run clean` | Remove build artifacts |',
    '',
    '## 📄 License',
    '',
    'MIT',
    '',
  ].join('\n');
}

function generateArchitecture(params: {
  extensionName: string;
  kind: string;
  hasCommands: boolean;
  hasTools: boolean;
  hasPrompts: boolean;
  hasSkills: boolean;
  sourceFiles: string[];
}): string {
  const { extensionName, kind, sourceFiles } = params;

  return [
    `# ${extensionName} Architecture`,
    '',
    `## Purpose`,
    '',
    `A pi.dev **${kind}** extension.`,
    '',
    `## System Components`,
    '',
    '### Main Entrypoint',
    '',
    'The primary extension logic is registered via `pi.registerTool()` and/or `pi.registerCommand()`.',
    '',
    '### Source Files',
    '',
    ...sourceFiles.map(f => `- \`${f}\``),
    '',
    '## Key Principles',
    '',
    '- Tool-first interface over command sprawl',
    '- External workspace development, not in pi runtime folders',
    '- TypeScript-first implementation',
    '- Explicit entrypoint with named files',
    '- Always validate before install',
    '',
  ].join('\n');
}
