# extension-creator

A small, repeatable way to create **pi.dev extensions** that are easy for LLMs to understand, generate, and maintain.

## Objective

This repository exists to provide a **concise, consistent extension-creation workflow** for pi.dev.

The goal is to make it easy to:

- create new extensions quickly
- keep extension structure predictable
- reduce ambiguity for LLMs
- reuse the same patterns across projects

## Principles

- **Repeatable**: every extension follows the same layout and conventions
- **Concise**: minimal boilerplate, no unnecessary complexity
- **Easy for LLMs**: clear instructions, simple structure, obvious naming
- **Practical**: focused on generating usable extension templates
- **Code-checked**: validation should be automated instead of relying on manual judgment

## Expected outcome

This project should provide a straightforward way to generate and validate extension scaffolds such as:

- metadata
- prompts / templates
- docs
- configuration
- example usage
- validation output

## Current implementation

This repository now ships:

- a **pi extension** entrypoint at `src/extensions/extension-creator/index.ts`
- reusable `/extension` and `/extension-full` prompt templates at `prompts/extension.md` and `prompts/extension-full.md`
- a TypeScript-based validator CLI
- built-in `install` / `update` / `remove` routing through pi’s package commands

Usage:

- `npm run validate`
- `node dist/cli.js validate <path> --json`
- `/extension <goal>` for quick routing
- `/extension-full <goal>` for stage-aware end-to-end workflow

The validator checks:

- package naming
- explicit entrypoint declaration
- named extension directory for stable pi display names
- short, named entrypoint filenames instead of `index.ts`
- TypeScript config presence
- compiler errors
- undeclared runtime dependencies
- build/runtime companion entrypoints

## Next step

The next step is to keep the tool flow aligned with pi’s built-in package installer and package lifecycle commands.
