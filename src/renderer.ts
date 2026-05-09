import type { ValidationResult } from './types';
import type { InstallResult } from './installer';
import type { Mode, Stage } from './router';
import type { ExtensionPlan } from './planner';

export interface DocumentationGuidance {
  title: string;
  instruction: string;
  promptTemplate: string;
  outputFiles: string[];
  steps: string[];
}

export interface ToolPayload {
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
  plan?: ExtensionPlan;
  documentation?: DocumentationGuidance;
  nextAction: string;
}

export function buildDocumentationGuidance(params: { sourcePath: string; extensionKind: string }): DocumentationGuidance {
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

export function chooseNextAction(params: { mode: Mode; stage: Stage; sourcePath?: string; validation?: ValidationResult; installResult?: InstallResult; startMode: Mode }): string {
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

export function renderPayload(payload: ToolPayload): string {
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
