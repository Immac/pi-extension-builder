#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { validateExtensionProject } from './validator';
import { runDeterministicInstall, installExtension, uninstallExtension, enableExtension, disableExtension, listExtensions } from './installer';
import type { Scope } from './types';

const PACKAGE_VERSION = '0.3.0';

const USAGE = `pi-extension-creator v${PACKAGE_VERSION}

Extension lifecycle manager — validate, install, enable/disable, and list extensions.

Usage:
  pi-extension-creator <command> [args..] [options]

Commands:
  validate [path]               Validate an extension package (default command)
  review [path]                 Same as validate
  install <path>                Install an extension to user scope (default)
  uninstall <name>              Remove an extension from the registry + vault
  enable <name>                 Enable a registered extension
  disable <name>                Disable a registered extension
  list                          List registered extensions
  bootstrap                     Build, validate, and install self (from cwd)
  install-self                  Same as bootstrap

Global options:
  --scope user|project          Scope for install/enable/disable/uninstall/list
                                 (default: user)
  --json                        Output results as JSON
  --verbose                     Print detailed progress messages
  --help                        Show this help message
  --version                     Show version

Scope details:
  user scope:   ~/.extension-manager/extensions/<name>
  project scope: .extension-manager/extensions/<name>  (relative to cwd)

Examples:
  pi-extension-creator install ./my-ext
  pi-extension-creator install ./my-ext --scope project
  pi-extension-creator enable my-ext --scope user
  pi-extension-creator disable my-ext --scope user
  pi-extension-creator uninstall my-ext --scope project
  pi-extension-creator list --scope user --json
  pi-extension-creator validate ./my-ext --json
  pi-extension-creator bootstrap
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle --help and --version
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(USAGE);
    return;
  }
  if (args.includes('--version') || args.includes('-v')) {
    process.stdout.write(`${PACKAGE_VERSION}\n`);
    return;
  }

  const positional = args.filter((arg: string) => !arg.startsWith('--'));
  const flags = new Set(args.filter((arg: string) => arg.startsWith('--')));
  const command = positional[0] ?? 'validate';

  const jsonOutput = flags.has('--json');
  const verbose = flags.has('--verbose');
  const scope: Scope = args.includes('--scope')
    ? (args[args.indexOf('--scope') + 1] as Scope) || 'user'
    : 'user';

  const validCommands = ['validate', 'review', 'bootstrap', 'install-self',
    'install', 'uninstall', 'enable', 'disable', 'list'];
  if (!validCommands.includes(command)) {
    process.stderr.write(`Unknown command: "${command}"\n`);
    process.stderr.write(`Valid commands: ${validCommands.join(', ')}\n`);
    process.stderr.write(`Run "pi-extension-creator --help" for usage.\n`);
    process.exitCode = 2;
    return;
  }

  // ── validate / review ──────────────────────────────────────────
  if (command === 'validate' || command === 'review') {
    const target = positional[1] ? path.resolve(positional[1]) : process.cwd();
    if (verbose) process.stderr.write(`Validating extension at: ${target}\n`);

    const result = await validateExtensionProject(target);

    if (verbose) process.stderr.write(`Validation status: ${result.status}\n`);

    if (jsonOutput) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(formatResult(result));
    }

    process.exitCode = result.status === 'fail' ? 1 : 0;
    return;
  }

  // ── install ────────────────────────────────────────────────────
  if (command === 'install') {
    const target = positional[1] ? path.resolve(positional[1]) : undefined;
    if (!target) {
      process.stderr.write('Error: install requires a source path.\n');
      process.exitCode = 1;
      return;
    }

    if (verbose) process.stderr.write(`Installing ${target} (scope: ${scope})...\n`);

    // Run validation first
    const validation = await validateExtensionProject(target);
    if (validation.status === 'fail') {
      process.stderr.write('Validation failed. Fix errors before installing.\n');
      if (jsonOutput) process.stdout.write(`${JSON.stringify(validation, null, 2)}\n`);
      else process.stdout.write(formatResult(validation));
      process.exitCode = 1;
      return;
    }

    if (scope === 'project') {
      const result = installExtension({ sourcePath: target, scope, projectDir: process.cwd() });
      logResult(result, command, jsonOutput);
      process.exitCode = result.success ? 0 : 1;
    } else {
      const result = runDeterministicInstall({ sourcePath: target, validation, scope });
      logInstallResult(result, jsonOutput);
      process.exitCode = result.success ? 0 : 1;
    }
    return;
  }

  // ── uninstall ──────────────────────────────────────────────────
  if (command === 'uninstall') {
    const name = positional[1];
    if (!name) {
      process.stderr.write('Error: uninstall requires an extension name.\n');
      process.exitCode = 1;
      return;
    }
    if (verbose) process.stderr.write(`Uninstalling ${name} (scope: ${scope})...\n`);
    const result = uninstallExtension({ name, scope, projectDir: process.cwd() });
    logResult(result, command, jsonOutput);
    process.exitCode = result.success ? 0 : 1;
    return;
  }

  // ── enable / disable ───────────────────────────────────────────
  if (command === 'enable' || command === 'disable') {
    const name = positional[1];
    if (!name) {
      process.stderr.write(`Error: ${command} requires an extension name.\n`);
      process.exitCode = 1;
      return;
    }
    if (verbose) process.stderr.write(`${command}ing ${name} (scope: ${scope})...\n`);
    const fn = command === 'enable' ? enableExtension : disableExtension;
    const result = fn({ name, scope, projectDir: process.cwd() });
    logResult(result, command, jsonOutput);
    process.exitCode = result.success ? 0 : 1;
    return;
  }

  // ── list ───────────────────────────────────────────────────────
  if (command === 'list') {
    const result = listExtensions({ scope, projectDir: process.cwd() });
    if (jsonOutput) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(`Extensions (scope: ${scope}):\n`);
      if (result.entries.length === 0) {
        process.stdout.write('  (none)\n');
      }
      for (const entry of result.entries) {
        const status = entry.enabled ? '✅' : '⛔';
        process.stdout.write(`  ${status} ${entry.name}  (${entry.vaultPath})\n`);
      }
    }
    return;
  }

  // ── bootstrap / install-self ───────────────────────────────────
  if (command === 'bootstrap' || command === 'install-self') {
    if (verbose) process.stderr.write(`Validating current package for self-install...\n`);

    const result = await validateExtensionProject(process.cwd());

    if (verbose) process.stderr.write(`Validation status: ${result.status}\n`);

    if (jsonOutput) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(formatResult(result));
    }

    if (result.status === 'fail') {
      if (verbose) process.stderr.write('Validation failed; aborting install.\n');
      process.exitCode = 1;
      return;
    }

    if (verbose) process.stderr.write('Validation passed. Installing...\n');

    const installResult = runDeterministicInstall({
      sourcePath: process.cwd(),
      validation: result,
      scope,
    });

    process.stdout.write(`${installResult.message}\n`);
    process.exitCode = installResult.success ? 0 : 1;
    return;
  }
}

function logResult(result: { success: boolean; message: string }, command: string, jsonOutput: boolean): void {
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${result.success ? '✅' : '❌'} ${result.message}\n`);
  }
}

function logInstallResult(result: import('./installer').InstallResult, jsonOutput: boolean): void {
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${result.success ? '✅' : '❌'} ${result.message}\n`);
  }
}

function formatResult(result: Awaited<ReturnType<typeof validateExtensionProject>>): string {
  const lines: string[] = [];
  lines.push(`status: ${result.status}`);
  if (result.packageName) lines.push(`packageName: ${result.packageName}`);
  if (result.entrypoint) lines.push(`entrypoint: ${result.entrypoint}`);
  if (result.tsconfig) lines.push(`tsconfig: ${result.tsconfig}`);

  if (result.errors.length > 0) {
    lines.push('errors:');
    for (const error of result.errors) {
      lines.push(`  - [${error.code}] ${error.message}${formatLocation(error.file, error.line, error.column)}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push('warnings:');
    for (const warning of result.warnings) {
      lines.push(`  - [${warning.code}] ${warning.message}${formatLocation(warning.file, warning.line, warning.column)}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function formatLocation(file?: string, line?: number, column?: number): string {
  if (!file) return '';
  const suffix = line ? `:${line}${column ? `:${column}` : ''}` : '';
  return ` (${file}${suffix})`;
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
