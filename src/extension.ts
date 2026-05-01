import { Type } from '@mariozechner/pi-ai';
import { defineTool, type ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { validateExtensionProject } from './validator';
import type { ValidationResult } from './types';

type Mode = 'plan' | 'scaffold' | 'review' | 'document' | 'validate' | 'install' | 'update' | 'remove';
type Stage = 'idea' | 'draft' | 'workspace' | 'validated' | 'installed' | 'maintenance' | 'unknown';

interface ToolParams {
  mode?: string;
  stage?: string;
  goal?: string;
  extensionKind?: string;
  path?: string;
  installTarget?: string;
  strict?: boolean;
  note?: string;
}

interface ToolPayload {
  mode: Mode;
  stage: Stage;
  startMode: Mode;
  goal?: string;
  extensionKind: string;
  path?: string;
  installTarget?: string;
  strict: boolean;
  note?: string;
  validation?: ValidationResult;
  commandResult?: CommandRunResult;
  plan?: {
    title: string;
    summary: string;
    files: string[];
    steps: string[];
    cautions: string[];
  };
  documentation?: {
    title: string;
    instruction: string;
    promptTemplate: string;
    outputFiles: string[];
    steps: string[];
  };
  nextAction: string;
}

interface CommandRunResult {
  command: string;
  args: string[];
  code: number | null;
  stdout: string;
  stderr: string;
}

let runtimePi: ExtensionAPI | undefined;

const extensionCreatorTool = defineTool({
  name: 'extension_creator',
  label: 'extension-creator',
  description: 'Plan, scaffold, review, validate, and route pi extension lifecycle actions.',
  parameters: Type.Object({
    mode: Type.Optional(
      Type.String({
        description: 'plan | scaffold | review | document | validate | install | update | remove',
      }),
    ),
    stage: Type.Optional(
      Type.String({
        description: 'idea | draft | workspace | validated | installed | maintenance | unknown',
      }),
    ),
    goal: Type.Optional(Type.String({ description: 'What the user wants the extension to do.' })),
    extensionKind: Type.Optional(Type.String({ description: 'The extension style, such as tool, command, prompt, or provider.' })),
    path: Type.Optional(Type.String({ description: 'Path to an external workspace or extension package.' })),
    installTarget: Type.Optional(Type.String({ description: 'Optional install target or discovery preference.' })),
    strict: Type.Optional(Type.Boolean({ description: 'Prefer stricter cleanup and validation guidance.' })),
    note: Type.Optional(Type.String({ description: 'Additional instruction or context.' })),
  }),
  async execute(_toolCallId: string, params: ToolParams, signal: any, _onUpdate: any, ctx: any) {
    const goal = params.goal?.trim();
    const stage = normalizeStage(params.stage, goal, params.path);
    const mode = normalizeMode(params.mode, stage, goal, params.path);
    const strict = Boolean(params.strict);
    const extensionKind = params.extensionKind?.trim() || inferKindFromGoal(goal) || 'tool extension';
    const path = params.path?.trim();
    const installTarget = params.installTarget?.trim();
    const note = params.note?.trim();

    let validation: ValidationResult | undefined;
    if ((mode === 'validate' || mode === 'review' || mode === 'install' || mode === 'update') && path) {
      validation = await validateExtensionProject(path);
    }

    const plan = mode === 'plan' || mode === 'scaffold'
      ? buildPlan({ goal, extensionKind, strict, note })
      : undefined;

    const commandResult = shouldRunPiCommand(mode)
      ? await runPiLifecycleCommand({ mode, path, installTarget, signal, validation })
      : undefined;

    // Document mode: LLM-driven documentation generation
    const documentation = mode === 'document' && path
      ? buildDocumentationGuidance({ path, extensionKind })
      : undefined;

    const payload: ToolPayload = {
      mode,
      stage,
      startMode: mode,
      goal,
      extensionKind,
      path,
      installTarget,
      strict,
      note,
      validation,
      commandResult,
      plan,
      documentation,
      nextAction: chooseNextAction({ mode, stage, path, validation, commandResult, startMode: mode }),
    };

    if (!path && ['validate', 'review', 'install', 'update', 'remove'].includes(mode)) {
      payload.nextAction = 'Provide a source workspace path so pi can target the package source.';
    }

    ctx.ui?.notify?.('extension-creator tool completed', 'info');

    return {
      content: [{ type: 'text', text: renderPayload(payload) }],
      details: payload,
    };
  },
});

export default function extensionCreator(pi: ExtensionAPI) {
  runtimePi = pi;
  pi.registerTool(extensionCreatorTool);
}

function normalizeMode(value: string | undefined, stage: Stage, goal: string | undefined, path?: string): Mode {
  const candidate = value?.trim().toLowerCase();
  if (candidate === 'plan' || candidate === 'scaffold' || candidate === 'review' || candidate === 'document' || candidate === 'validate' || candidate === 'install' || candidate === 'update' || candidate === 'remove') {
    return candidate;
  }

  const stageMode = modeFromStage(stage);
  if (stageMode) {
    return stageMode;
  }

  const lowerGoal = goal?.toLowerCase() ?? '';
  if (lowerGoal.includes('document') || lowerGoal.includes('readme') || lowerGoal.includes('doc')) {
    return 'document';
  }
  if (lowerGoal.includes('remove') || lowerGoal.includes('uninstall') || lowerGoal.includes('delete')) {
    return 'remove';
  }
  if (lowerGoal.includes('update') || lowerGoal.includes('refresh') || lowerGoal.includes('upgrade')) {
    return 'update';
  }
  if (lowerGoal.includes('validate') || lowerGoal.includes('check') || lowerGoal.includes('lint') || lowerGoal.includes('type')) {
    return 'validate';
  }
  if (path) {
    return 'review';
  }
  return 'plan';
}

function normalizeStage(stage: string | undefined, goal: string | undefined, path?: string): Stage {
  const candidate = stage?.trim().toLowerCase();
  if (candidate === 'idea' || candidate === 'draft' || candidate === 'workspace' || candidate === 'validated' || candidate === 'installed' || candidate === 'maintenance' || candidate === 'unknown') {
    return candidate;
  }

  const lowerGoal = goal?.toLowerCase() ?? '';
  if (lowerGoal.includes('install')) return 'validated';
  if (lowerGoal.includes('update') || lowerGoal.includes('refresh')) return 'installed';
  if (lowerGoal.includes('remove') || lowerGoal.includes('uninstall')) return 'installed';
  if (path) return 'workspace';
  return 'idea';
}

function modeFromStage(stage: Stage): Mode | undefined {
  switch (stage) {
    case 'idea':
      return 'plan';
    case 'draft':
      return 'scaffold';
    case 'workspace':
      return 'review';
    case 'validated':
      return 'install';
    case 'installed':
      return 'review';
    case 'maintenance':
      return 'update';
    case 'unknown':
      return undefined;
  }
}

function inferKindFromGoal(goal: string | undefined): string | undefined {
  if (!goal) {
    return undefined;
  }

  const lower = goal.toLowerCase();
  if (lower.includes('prompt')) return 'prompt/system-prompt extension';
  if (lower.includes('provider')) return 'provider extension';
  if (lower.includes('tool')) return 'tool extension';
  if (lower.includes('command')) return 'command extension';
  if (lower.includes('ui')) return 'ui extension';
  if (lower.includes('session') || lower.includes('state')) return 'session/state extension';
  if (lower.includes('resource')) return 'resource-discovery extension';
  if (lower.includes('sound') || lower.includes('notify') || lower.includes('alert')) return 'notification/sound extension';
  return undefined;
}

function buildPlan(params: { goal?: string; extensionKind: string; strict: boolean; note?: string }): ToolPayload['plan'] {
  const title = `Plan for ${params.extensionKind}`;
  const summary = params.goal
    ? `Design a clean ${params.extensionKind} that accomplishes: ${params.goal}`
    : `Design a clean ${params.extensionKind} with a single clear responsibility.`;

  const files = [
    'package.json',
    'tsconfig.json',
    'src/extensions/<named-extension>/<named-entrypoint>.ts',
    'prompts/extension.md',
  ];

  const steps = [
    'Define the extension goal in one sentence.',
    'Keep the package name kebab-case and stable.',
    'Use one explicit extension entrypoint whose filename matches the extension name, not index.ts.',
    'Author the source in TypeScript.',
    'Run the TypeScript/package validator before installation.',
    'Install the package into pi only after it validates cleanly.',
  ];

  const cautions = [
    'Avoid multiple commands unless they are clearly necessary.',
    'Prefer a tool-first interface over slash-command sprawl.',
    'Keep authoring files outside pi runtime folders and prefer a short, named entrypoint over index.ts.',
  ];

  if (params.strict) {
    cautions.push('Prefer a single concern per extension and minimize optional behavior.');
  }

  if (params.note) {
    cautions.push(`Note: ${params.note}`);
  }

  return { title, summary, files, steps, cautions };
}

function buildDocumentationGuidance(params: { path: string; extensionKind: string }): ToolPayload['documentation'] {
  const title = `Documentation for ${params.extensionKind}`;
  const instruction = `Generate README.md and optionally ARCHITECTURE.md for the extension at ${params.path}. This is LLM-driven - analyze the source code and use the prompts/documentation.md template.`;
  
  const promptTemplate = 'prompts/documentation.md';
  
  const outputFiles = ['README.md', 'ARCHITECTURE.md (optional, for complex extensions)'];
  
  const steps = [
    `Read the extension source files at ${params.path}`,
    'Analyze the code structure, dependencies, and purpose',
    'Identify the extension type (tool, command, prompt, provider)',
    `Use the ${promptTemplate} template as guidance`,
    'Generate README.md with appropriate badges, sections, and examples',
    'Generate ARCHITECTURE.md only if the extension has complex architecture',
    `Write the files to ${params.path}`,
  ];

  return { title, instruction, promptTemplate, outputFiles, steps };
}

function chooseNextAction(params: { mode: Mode; stage: Stage; path?: string; validation?: ValidationResult; commandResult?: CommandRunResult; startMode: Mode }): string {
  const stageLabel = params.stage === 'unknown' ? 'unknown' : params.stage;

  if (params.commandResult) {
    return params.commandResult.code === 0
      ? `pi ${params.mode} completed successfully. Review the output and reload if needed.`
      : `pi ${params.mode} failed with exit code ${params.commandResult.code ?? 'unknown'}; fix the reported issue and retry.`;
  }

  switch (params.mode) {
    case 'plan':
    case 'scaffold':
      return `Start at ${params.startMode} for stage ${stageLabel}, then create the external workspace and validate it before installing into pi.`;
    case 'review':
      if (!params.path) return 'Provide a path to review an existing extension package.';
      return params.validation
        ? params.validation.status === 'fail'
          ? 'Fix the reported validation errors before installation.'
          : 'Address any warnings, then install or update when ready.'
        : 'Review the returned diagnostics and refine the package structure.';
    case 'document':
      if (!params.path) return 'Provide a path to generate documentation for an extension.';
      return 'Use the LLM to analyze the extension at the path and generate README.md and optionally ARCHITECTURE.md using the documentation prompt template.';
    case 'validate':
      if (!params.path) return 'Provide a path to validate an extension package.';
      return params.validation
        ? params.validation.status === 'pass'
          ? 'The package is ready for the next lifecycle step.'
          : 'Fix errors before installing; warnings are optional cleanup items.'
        : 'Run validation and inspect the results.';
    case 'install':
      if (!params.path) return 'Provide a path to the source package, then validate and install it with the tool workflow.';
      return params.validation
        ? params.validation.status === 'pass'
          ? 'Proceed with the install workflow only after the package is validated.'
          : 'Do not install until the validation errors are fixed.'
        : 'Validate the package first, then install it.';
    case 'update':
      return 'Re-run validation on the external workspace, then refresh the installed package only if validation passes.';
    case 'remove':
      return 'Remove the installed package through the tool workflow, then keep the source workspace untouched.';
  }
}

function shouldRunPiCommand(mode: Mode): boolean {
  return mode === 'install' || mode === 'update' || mode === 'remove';
}

function buildPiCommand(params: { mode: Mode; path?: string; installTarget?: string }): { command: string; args: string[] } {
  const args: string[] = [params.mode];

  if (!params.path && params.mode !== 'remove') {
    return { command: 'pi', args };
  }

  if (params.path) {
    args.push(params.path);
  }

  if ((params.mode === 'install' || params.mode === 'remove') && isProjectLocalInstall(params.installTarget)) {
    args.push('-l');
  }

  return { command: 'pi', args };
}

async function runPiLifecycleCommand(params: { mode: Mode; path?: string; installTarget?: string; signal: any; validation?: ValidationResult }): Promise<CommandRunResult | undefined> {
  if (!runtimePi) {
    throw new Error('extension runtime is not initialized');
  }

  if ((params.mode === 'install' || params.mode === 'update') && params.path && params.validation?.status === 'fail') {
    return undefined;
  }

  if ((params.mode === 'install' || params.mode === 'update' || params.mode === 'remove') && !params.path) {
    return undefined;
  }

  if (typeof runtimePi.exec !== 'function') {
    throw new Error('pi runtime does not expose exec()');
  }

  const { command, args } = buildPiCommand(params);
  const result = await runtimePi.exec(command, args, { signal: params.signal });

  return {
    command,
    args,
    code: typeof result?.code === 'number' ? result.code : null,
    stdout: result?.stdout ?? '',
    stderr: result?.stderr ?? '',
  };
}

function isProjectLocalInstall(installTarget?: string): boolean {
  const value = installTarget?.trim().toLowerCase();
  return value === 'local' || value === 'project' || value === 'project-local' || value === '-l';
}

function renderPayload(payload: ToolPayload): string {
  const lines: string[] = [];
  lines.push(`# ${payload.plan?.title ?? 'Extension guidance'}`);
  lines.push('');
  lines.push(`Mode: ${payload.mode}`);
  lines.push(`Stage: ${payload.stage}`);
  lines.push(`Start mode: ${payload.startMode}`);
  lines.push(`Extension kind: ${payload.extensionKind}`);
  if (payload.goal) lines.push(`Goal: ${payload.goal}`);
  if (payload.path) lines.push(`Path: ${payload.path}`);
  if (payload.installTarget) lines.push(`Install target preference: ${payload.installTarget}`);
  lines.push(`Strict: ${payload.strict ? 'yes' : 'no'}`);
  if (payload.note) lines.push(`Note: ${payload.note}`);
  lines.push('');

  if (payload.validation) {
    lines.push(`Validation status: ${payload.validation.status}`);
    if (payload.validation.packageName) lines.push(`Package name: ${payload.validation.packageName}`);
    if (payload.validation.entrypoint) lines.push(`Entrypoint: ${payload.validation.entrypoint}`);
    if (payload.validation.tsconfig) lines.push(`tsconfig: ${payload.validation.tsconfig}`);
    if (payload.validation.errors.length > 0) {
      lines.push('Errors:');
      for (const error of payload.validation.errors) {
        lines.push(`- [${error.code}] ${error.message}`);
      }
    }
    if (payload.validation.warnings.length > 0) {
      lines.push('Warnings:');
      for (const warning of payload.validation.warnings) {
        lines.push(`- [${warning.code}] ${warning.message}`);
      }
    }
    lines.push('');
  }

  if (payload.commandResult) {
    lines.push(`Command: ${payload.commandResult.command} ${payload.commandResult.args.join(' ')}`.trim());
    lines.push(`Exit code: ${payload.commandResult.code ?? 'unknown'}`);
    if (payload.commandResult.stdout) {
      lines.push('stdout:');
      lines.push(payload.commandResult.stdout.trimEnd());
    }
    if (payload.commandResult.stderr) {
      lines.push('stderr:');
      lines.push(payload.commandResult.stderr.trimEnd());
    }
    lines.push('');
  }

  if (payload.plan) {
    lines.push(payload.plan.summary);
    lines.push('');
    lines.push('Recommended files:');
    for (const file of payload.plan.files) {
      lines.push(`- ${file}`);
    }
    lines.push('');
    lines.push('Suggested steps:');
    for (const step of payload.plan.steps) {
      lines.push(`- ${step}`);
    }
    lines.push('');
    lines.push('Cautions:');
    for (const caution of payload.plan.cautions) {
      lines.push(`- ${caution}`);
    }
    lines.push('');
  }

  if (payload.documentation) {
    lines.push(`## ${payload.documentation.title}`);
    lines.push('');
    lines.push(payload.documentation.instruction);
    lines.push('');
    lines.push('Steps:');
    for (const step of payload.documentation.steps) {
      lines.push(`- ${step}`);
    }
    lines.push('');
    lines.push(`Prompt template: ${payload.documentation.promptTemplate}`);
    lines.push('');
    lines.push('Output files:');
    for (const file of payload.documentation.outputFiles) {
      lines.push(`- ${file}`);
    }
    lines.push('');
  }

  lines.push(`Next action: ${payload.nextAction}`);
  return `${lines.join('\n')}\n`;
}
