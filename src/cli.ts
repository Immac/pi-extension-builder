#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { validateExtensionProject } from './validator';
import { runDeterministicInstall } from './installer';

const PACKAGE_VERSION = '0.2.0';

const USAGE = `pi-extension-creator v${PACKAGE_VERSION}

A pi extension creator and validator for guiding LLM-driven extension workflows.

Usage:
  pi-extension-creator validate [path]      Validate an extension package (default command)
  pi-extension-creator review [path]         Same as validate
  pi-extension-creator bootstrap             Build, validate, and install self (from cwd)
  pi-extension-creator install-self          Same as bootstrap
  pi-extension-creator --help               Show this help message
  pi-extension-creator --version            Show version

Options:
  --json     Output validation results as JSON
  --verbose  Print detailed progress messages

Examples:
  pi-extension-creator validate ./my-extension
  pi-extension-creator validate --json
  pi-extension-creator validate --verbose ./my-extension
  pi-extension-creator bootstrap --json
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

  const positional = args.filter((arg: string) => !arg.startsWith('-'));
  const flags = new Set(args.filter((arg: string) => arg.startsWith('-')));
  const command = positional[0] ?? 'validate';
  const target = positional[1] ? path.resolve(positional[1]) : process.cwd();
  const jsonOutput = flags.has('--json');
  const verbose = flags.has('--verbose');

  const validCommands = ['validate', 'review', 'bootstrap', 'install-self'];
  if (!validCommands.includes(command)) {
    process.stderr.write(`Unknown command: "${command}"\n`);
    process.stderr.write(`Valid commands: ${validCommands.join(', ')}\n`);
    process.stderr.write(`Run "pi-extension-creator --help" for usage.\n`);
    process.exitCode = 2;
    return;
  }

  if (command === 'validate' || command === 'review') {
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

  // bootstrap / install-self
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
    });

    process.stdout.write(`${installResult.message}\n`);
    process.exitCode = installResult.success ? 0 : 1;
    return;
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
  if (!file) {
    return '';
  }
  const suffix = line ? `:${line}${column ? `:${column}` : ''}` : '';
  return ` (${file}${suffix})`;
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
