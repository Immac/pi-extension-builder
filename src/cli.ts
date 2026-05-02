#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { validateExtensionProject } from './validator';
import { runDeterministicInstall } from './installer';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const positional = args.filter((arg: string) => !arg.startsWith('-'));
  const flags = new Set(args.filter((arg: string) => arg.startsWith('-')));
  const command = positional[0] ?? 'validate';
  const target = positional[1] ? path.resolve(positional[1]) : process.cwd();
  const jsonOutput = flags.has('--json');

  if (command === 'validate' || command === 'review') {
    const result = await validateExtensionProject(target);

    if (jsonOutput) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(formatResult(result));
    }

    process.exitCode = result.status === 'fail' ? 1 : 0;
    return;
  }

  if (command === 'bootstrap' || command === 'install-self') {
    const result = await validateExtensionProject(process.cwd());

    if (jsonOutput) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(formatResult(result));
    }

    if (result.status === 'fail') {
      process.exitCode = 1;
      return;
    }

    const installResult = runDeterministicInstall({
      sourcePath: process.cwd(),
      validation: result,
    });

    process.stdout.write(`${installResult.message}\n`);
    process.exitCode = installResult.success ? 0 : 1;
    return;
  }

  printUsageAndExit();
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

function printUsageAndExit(): void {
  process.stderr.write('Usage: pi-extension-creator validate <path> [--json] | bootstrap [--json]\n');
  process.exitCode = 2;
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
