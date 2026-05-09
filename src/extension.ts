import { Type } from '@mariozechner/pi-ai';
import { defineTool, type ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { validateExtensionProject } from './validator';
import { runDeterministicInstall, type InstallResult } from './installer';
import type { ValidationResult } from './types';

import { normalizeMode, normalizeStage, inferKindFromGoal, type Mode, type Stage } from './router';

interface ToolParams {
  mode?: string;
  stage?: string;
  goal?: string;
  extensionKind?: string;
  path?: string;
  sourcePath?: string;
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
  sourcePath?: string;
  installTarget?: string;
  strict: boolean;
  note?: string;
  validation?: ValidationResult;
  installResult?: InstallResult;
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
    sourcePath: Type.Optional(Type.String({ description: 'Source path (alias for path).' })),
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
    const sourcePath = params.sourcePath?.trim() || params.path?.trim();
    const installTarget = params.installTarget?.trim();
    const note = params.note?.trim();

    let validation: ValidationResult | undefined;
    if ((mode === 'validate' || mode === 'review' || mode === 'install' || mode === 'update') && sourcePath) {
      validation = await validateExtensionProject(sourcePath);
    }

    const plan = mode === 'plan' || mode === 'scaffold'
      ? buildPlan({ goal, extensionKind, strict, note })
      : undefined;

    const installResult = mode === 'install' && sourcePath
      ? runDeterministicInstall({ sourcePath, validation })
      : undefined;

    // Notify user to reload pi after successful install
    if (installResult?.success) {
      ctx.ui?.notify?.('Extension installed. Restart pi to reload the new code!', 'info');
    }

    const documentation = mode === 'document' && sourcePath
      ? buildDocumentationGuidance({ sourcePath, extensionKind })
      : undefined;

    const payload: ToolPayload = {
      mode,
      stage,
      startMode: mode,
      goal,
      extensionKind,
      sourcePath,
      installTarget,
      strict,
      note,
      validation,
      installResult,
      plan,
      documentation,
      nextAction: chooseNextAction({ mode, stage, sourcePath, validation, installResult, startMode: mode }),
    };

    if (!sourcePath && ['validate', 'review', 'install', 'update', 'remove'].includes(mode)) {
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
  pi.registerTool(extensionCreatorTool);
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

function buildDocumentationGuidance(params: { sourcePath: string; extensionKind: string }): ToolPayload['documentation'] {
  const { sourcePath } = params;
  const title = `Documentation for ${params.extensionKind}`;
  const instruction = `Generate README.md and optionally ARCHITECTURE.md for the extension at ${sourcePath}. Analyze the source code structure, dependencies, and purpose.`;
  
  const promptTemplate = 'prompts/documentation.md';
  
  const outputFiles = ['README.md', 'ARCHITECTURE.md (optional, for complex extensions)'];
  
  const steps = [
    `Read the extension source files at ${sourcePath}`,
    'Analyze the code structure, dependencies, and purpose',
    'Identify the extension type (tool, command, prompt, provider)',
    `Use the ${promptTemplate} template as guidance`,
    'Generate README.md with appropriate badges, sections, and examples',
    'Generate ARCHITECTURE.md only if the extension has complex architecture',
    `Write the files to ${sourcePath}`,
  ];

  return { title, instruction, promptTemplate, outputFiles, steps };
}

function chooseNextAction(params: { mode: Mode; stage: Stage; sourcePath?: string; validation?: ValidationResult; installResult?: InstallResult; startMode: Mode }): string {
  const stageLabel = params.stage === 'unknown' ? 'unknown' : params.stage;

  if (params.installResult) {
    return params.installResult.success
      ? `Installed ${params.installResult.extensionName} to ${params.installResult.installPath}`
      : `Installation failed: ${params.installResult.message}`;
  }

  switch (params.mode) {
    case 'plan':
    case 'scaffold':
      return `Start at ${params.startMode} for stage ${stageLabel}, then create the external workspace and validate it before installing.`;
    case 'review':
      if (!params.sourcePath) return 'Provide a path to review an existing extension package.';
      return params.validation
        ? params.validation.status === 'fail'
          ? 'Fix the reported validation errors before installation.'
          : 'Address any warnings, then install when ready.'
        : 'Review the returned diagnostics and refine the package structure.';
    case 'document':
      if (!params.sourcePath) return 'Provide a path to generate documentation for an extension.';
      return 'Use the LLM to analyze the extension at the path and generate README.md and optionally ARCHITECTURE.md.';
    case 'validate':
      if (!params.sourcePath) return 'Provide a path to validate an extension package.';
      return params.validation
        ? params.validation.status === 'pass'
          ? 'The package is ready for installation.'
          : 'Fix errors before installing; warnings are optional.'
        : 'Run validation and inspect the results.';
    case 'install':
      if (!params.sourcePath) return 'Provide a path to the source package.';
      return params.validation
        ? params.validation.status === 'pass'
          ? 'Proceed with installation, then restart pi to reload.'
          : 'Do not install until validation errors are fixed.'
        : 'Validate the package first, then restart pi to reload after install.';
    case 'update':
      return 'Re-validate the external workspace, then refresh the installed package only if validation passes.';
    case 'remove':
      return 'Remove the installed package, then keep the source workspace untouched.';
  }
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
  if (payload.sourcePath) lines.push(`Source path: ${payload.sourcePath}`);
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

  if (payload.installResult) {
    lines.push(`Installation: ${payload.installResult.success ? 'SUCCESS' : 'FAILED'}`);
    lines.push(`Extension: ${payload.installResult.extensionName}`);
    lines.push(`Installed to: ${payload.installResult.installPath}`);
    lines.push(`Message: ${payload.installResult.message}`);
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