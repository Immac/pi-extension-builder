import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
import { DiagnosticRecord, ValidationResult } from './types';

interface PackageManifest {
  name?: unknown;
  main?: unknown;
  dependencies?: Record<string, unknown>;
  peerDependencies?: Record<string, unknown>;
  pi?: {
    entrypoint?: unknown;
    tsconfig?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

const KEBAB_CASE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COMPILER_LINE_RE = /^(?:(.+?)\((\d+),(\d+)\):\s+)?(error|warning)\s+TS(\d+):\s+(.*)$/;

export async function validateExtensionProject(packagePathInput: string): Promise<ValidationResult> {
  const packagePath = path.resolve(packagePathInput);
  const details: ValidationResult['details'] = {
    packagePath,
    manifestFound: false,
    tsconfigFound: false,
    compilerChecked: false,
    notes: [],
    entrypoint: undefined,
    tsconfig: undefined,
  };

  const errors: DiagnosticRecord[] = [];
  const warnings: DiagnosticRecord[] = [];

  const manifestPath = path.join(packagePath, 'package.json');
  details.manifestPath = manifestPath;

  // Collect all diagnostics before returning — batch everything for one-pass UX
  let manifestFound = false;
  let manifest: PackageManifest | undefined;

  if (!fs.existsSync(manifestPath)) {
    errors.push(record('manifest.missing', 'package.json was not found in the project root.', 'error', manifestPath));
  } else {
    manifestFound = true;
    details.manifestFound = true;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as PackageManifest;
    } catch (error) {
      errors.push(record('manifest.invalid-json', `package.json could not be parsed: ${(error as Error).message}`, 'error', manifestPath));
    }
  }

  let packageName: string | undefined;
  if (manifest) {
    packageName = typeof manifest.name === 'string' ? manifest.name : undefined;
    if (!packageName) {
      errors.push(record('manifest.name.missing', 'package.json must declare a package name.', 'error', manifestPath));
    } else if (!KEBAB_CASE_RE.test(packageName)) {
      errors.push(record('manifest.name.not-kebab-case', `Package name "${packageName}" must use kebab-case.`, 'error', manifestPath));
    }
  }

  const entrypointInfo = resolveEntrypoint(manifest, manifestPath);
  warnings.push(...entrypointInfo.warnings);
  errors.push(...entrypointInfo.errors);

  let entrypointPath: string | undefined;
  if (entrypointInfo.entrypoint) {
    const declaredEntrypointPath = path.resolve(packagePath, entrypointInfo.entrypoint);
    const declaredLooksLikeFile = path.extname(entrypointInfo.entrypoint) !== '';
    entrypointPath = resolveEntrypointFile(declaredEntrypointPath, warnings, errors, packageName);
    details.entrypoint = entrypointPath ?? declaredEntrypointPath;

    if (entrypointPath) {
      const preferredEntrypointStem = derivePreferredEntrypointStem(packageName);
      const canonicalIndexLayout = isCanonicalPackageNamedIndexLayout(entrypointPath, packageName);
      if (declaredLooksLikeFile && path.basename(entrypointPath).startsWith('index.') && !canonicalIndexLayout) {
        warnings.push(record('entrypoint.index-file', `Index-style entrypoints are legacy-only. Prefer ${preferredEntrypointStem ? `${preferredEntrypointStem}.ts` : 'a named entrypoint'} so the extension has a stable display name.`, 'warning', entrypointPath));
      }

      const resolvedStem = path.parse(entrypointPath).name;
      if (preferredEntrypointStem && resolvedStem !== preferredEntrypointStem && !canonicalIndexLayout) {
        warnings.push(record('entrypoint.named-file', `Prefer a named entrypoint that matches the extension name: ${preferredEntrypointStem}.ts`, 'warning', entrypointPath));
      }

      if (!/\.(ts|tsx)$/i.test(entrypointPath)) {
        warnings.push(record('entrypoint.not-typescript', 'The entrypoint does not resolve to a TypeScript source file by default.', 'warning', entrypointPath));
      }

      if (manifest) {
        warnings.push(...analyzeDependencies(manifest, entrypointPath));
      }
    }
  }

  const tsconfigPath = manifest ? resolveTsconfigPath(manifest, packagePath) : path.join(packagePath, 'tsconfig.json');
  details.tsconfig = tsconfigPath;
  details.tsconfigFound = fs.existsSync(tsconfigPath);

  if (!details.tsconfigFound) {
    errors.push(record('tsconfig.missing', `TypeScript configuration file was not found: ${tsconfigPath}`, 'error', tsconfigPath));
  } else {
    const compilerResult = runCompiler(tsconfigPath, packagePath);
    details.compilerChecked = true;
    errors.push(...compilerResult.errors);
    warnings.push(...compilerResult.warnings);
  }

  return finalize({
    details,
    errors,
    warnings,
    packageName,
    entrypoint: entrypointPath,
    tsconfig: tsconfigPath,
  });
}

function resolveEntrypoint(manifest: PackageManifest | undefined, manifestPath: string): { entrypoint?: string; errors: DiagnosticRecord[]; warnings: DiagnosticRecord[] } {
  if (!manifest) {
    return { errors: [], warnings: [] };
  }
  const errors: DiagnosticRecord[] = [];
  const warnings: DiagnosticRecord[] = [];
  const piExtensions = Array.isArray(manifest.pi?.extensions)
    ? manifest.pi.extensions.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).map((value) => value.trim())
    : [];
  const piEntrypoint = typeof manifest.pi?.entrypoint === 'string' ? manifest.pi.entrypoint.trim() : undefined;
  const mainEntrypoint = typeof manifest.main === 'string' ? manifest.main.trim() : undefined;

  if (piExtensions.length > 0) {
    if (piExtensions.length > 1) {
      errors.push(record('manifest.entrypoint.multiple', 'pi.extensions must contain exactly one explicit extension entrypoint for this package.', 'error', manifestPath));
    }
    return { entrypoint: piExtensions[0], errors, warnings };
  }

  if (piEntrypoint) {
    if (mainEntrypoint && mainEntrypoint !== piEntrypoint && !areCompanionEntrypoints(mainEntrypoint, piEntrypoint)) {
      warnings.push(record('manifest.entrypoint.duplicate', 'Both pi.entrypoint and main are declared, but they do not appear to be companion build/runtime entrypoints; pi.entrypoint will be treated as canonical.', 'warning', manifestPath));
    }
    return { entrypoint: piEntrypoint, errors, warnings };
  }

  if (mainEntrypoint) {
    warnings.push(record('manifest.entrypoint.legacy-main', 'Using package.json main as the entrypoint is supported for compatibility, but pi.extensions or pi.entrypoint is preferred.', 'warning', manifestPath));
    return { entrypoint: mainEntrypoint, errors, warnings };
  }

  errors.push(record('manifest.entrypoint.missing', 'package.json must declare an explicit entrypoint in pi.extensions, pi.entrypoint, or main.', 'error', manifestPath));
  return { errors, warnings };
}

function areCompanionEntrypoints(left: string, right: string): boolean {
  return path.parse(left).name === path.parse(right).name;
}

function resolveEntrypointFile(
  declaredPath: string,
  warnings: DiagnosticRecord[],
  errors: DiagnosticRecord[],
  packageName?: string,
): string | undefined {
  if (!fs.existsSync(declaredPath)) {
    errors.push(record('entrypoint.missing', `Declared entrypoint was not found: ${declaredPath}`, 'error', declaredPath));
    return undefined;
  }

  const stat = fs.statSync(declaredPath);
  if (stat.isDirectory()) {
    const preferredStem = derivePreferredEntrypointStem(packageName);
    const candidates = dedupeStrings([
      preferredStem ? `${preferredStem}.ts` : undefined,
      preferredStem ? `${preferredStem}.tsx` : undefined,
      'index.ts',
      'index.tsx',
      'index.js',
    ]);
    for (const candidate of candidates) {
      const candidatePath = path.join(declaredPath, candidate);
      if (fs.existsSync(candidatePath)) {
        if (candidate === 'index.js') {
          warnings.push(record('entrypoint.javascript-fallback', 'Directory entrypoints should prefer a named TypeScript entrypoint over index.js.', 'warning', candidatePath));
        }
        return candidatePath;
      }
    }

    errors.push(record('entrypoint.directory-missing-index', `Declared entrypoint directory does not contain a named TypeScript entrypoint or index.ts/index.tsx file: ${declaredPath}`, 'error', declaredPath));
    return undefined;
  }

  return declaredPath;
}

function resolveTsconfigPath(manifest: PackageManifest | undefined, packagePath: string): string {
  const declared = manifest && typeof manifest.pi?.tsconfig === 'string' ? manifest.pi.tsconfig.trim() : undefined;
  return path.resolve(packagePath, declared ?? 'tsconfig.json');
}

function runCompiler(tsconfigPath: string, packagePath: string): { errors: DiagnosticRecord[]; warnings: DiagnosticRecord[] } {
  const result = childProcess.spawnSync('tsc', ['-p', tsconfigPath, '--noEmit', '--pretty', 'false'], {
    cwd: packagePath,
    encoding: 'utf8',
  });

  if (result.error && (result.error as { code?: string }).code === 'ENOENT') {
    return {
      errors: [record('compiler.not-found', 'The TypeScript compiler (tsc) was not found on PATH.', 'error', tsconfigPath)],
      warnings: [],
    };
  }

  const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
  const diagnostics = parseCompilerOutput(combinedOutput);

  if (diagnostics.length === 0 && result.status !== 0) {
    return {
      errors: [record('compiler.unknown-failure', 'The TypeScript compiler exited with a failure, but no parseable diagnostics were returned.', 'error', tsconfigPath)],
      warnings: combinedOutput ? [record('compiler.output', combinedOutput, 'warning', tsconfigPath)] : [],
    };
  }

  return {
    errors: diagnostics.filter((diagnostic) => diagnostic.severity === 'error'),
    warnings: diagnostics.filter((diagnostic) => diagnostic.severity === 'warning'),
  };
}

function parseCompilerOutput(output: string): DiagnosticRecord[] {
  if (!output) {
    return [];
  }

  const diagnostics: DiagnosticRecord[] = [];
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  for (const line of lines) {
    const match = line.match(COMPILER_LINE_RE);
    if (match) {
      const [, file, lineNumber, columnNumber, category, code, message] = match;
      diagnostics.push({
        code: `TS${code}`,
        message,
        severity: category === 'error' ? 'error' : 'warning',
        file,
        line: lineNumber ? Number(lineNumber) : undefined,
        column: columnNumber ? Number(columnNumber) : undefined,
      });
      continue;
    }

    if (line.startsWith('error TS')) {
      const parts = line.split(': ');
      const codePart = parts[0] ?? '';
      const message = parts.slice(1).join(': ');
      diagnostics.push({
        code: codePart.replace(/^error\s+/, '').trim(),
        message,
        severity: 'error',
      });
      continue;
    }

    diagnostics.push(record('compiler.output', line, 'warning'));
  }

  return diagnostics;
}

function analyzeDependencies(manifest: PackageManifest | undefined, entrypointPath: string): DiagnosticRecord[] {
  if (!manifest || !fs.existsSync(entrypointPath)) {
    return [];
  }

  const declaredDependencies = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);

  const source = fs.readFileSync(entrypointPath, 'utf8');
  const importRegex = /(?:import\s+(?:type\s+)?(?:[^'\"]+from\s+)?|export\s+[^'\"]+from\s+|require\()\s*['\"]([^'\"]+)['\"]/g;
  const detected = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(source))) {
    const specifier = match[1];
    if (!specifier || specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('node:')) {
      continue;
    }
    const dependency = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
    detected.add(dependency);
  }

  return [...detected]
    .filter((dependency) => !declaredDependencies.has(dependency))
    .map((dependency) => record(
      'dependencies.undeclared',
      `The entrypoint imports "${dependency}" but it is not declared in dependencies or peerDependencies.`,
      'warning',
      entrypointPath,
    ));
}

function derivePreferredEntrypointStem(packageName?: string): string | undefined {
  if (!packageName) {
    return undefined;
  }

  const trimmed = packageName.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.startsWith('pi-') ? trimmed.slice('pi-'.length) : trimmed;
}

function isCanonicalPackageNamedIndexLayout(entrypointPath: string, packageName?: string): boolean {
  const preferredStem = derivePreferredEntrypointStem(packageName);
  if (!preferredStem) {
    return false;
  }

  const directoryStem = path.basename(path.dirname(entrypointPath));
  return directoryStem === preferredStem && path.basename(entrypointPath).startsWith('index.');
}

function dedupeStrings(values: Array<string | undefined>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }

  return result;
}

function record(code: string, message: string, severity: DiagnosticRecord['severity'], file?: string): DiagnosticRecord {
  return { code, message, severity, file };
}

function finalize(params: {
  details: ValidationResult['details'];
  errors: DiagnosticRecord[];
  warnings: DiagnosticRecord[];
  packageName?: string;
  entrypoint?: string;
  tsconfig?: string;
}): ValidationResult {
  const status = params.errors.length > 0 ? 'fail' : params.warnings.length > 0 ? 'warn' : 'pass';
  return {
    status,
    packageName: params.packageName,
    entrypoint: params.entrypoint,
    tsconfig: params.tsconfig,
    errors: params.errors,
    warnings: params.warnings,
    details: params.details,
  };
}
