export interface ExtensionPlan {
  title: string;
  summary: string;
  files: string[];
  steps: string[];
  cautions: string[];
}

export function buildPlan(params: { goal?: string; extensionKind: string; strict: boolean; note?: string }): ExtensionPlan {
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
