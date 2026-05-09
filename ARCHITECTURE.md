# Architecture: pi-extension-creator v0.2.0

## Purpose

**pi-extension-creator** provides a complete lifecycle management system for pi extensions. It is itself a pi extension (tool) that helps LLMs create, validate, document, and install other pi extensions. The primary interface is the `extension_creator` tool, not CLI commands.

---

## Core Principles

### 1. Tool-first interface
The primary interface is a single `extension_creator` tool that the LLM calls during normal agent work. No command sprawl.

### 2. External-first development
Extensions are authored in normal project directories, outside pi's runtime folders. The installer copies from source workspace to install target.

### 3. One-pass validation
All diagnostics are collected before returning. The user sees all errors at once, not one-at-a-time.

### 4. Deterministic install
Installation uses `fs.cpSync()` to `~/.pi-extensions/<name>` and updates `~/.pi/agent/settings.json`. Always replaces existing copies.

### 5. Automatic documentation
The `document` mode analyzes source code structure and generates README.md and ARCHITECTURE.md automatically.

---

## System Components (8 Modules)

```
┌─────────────────────────────────────────────────────────────┐
│                     extension.ts                            │
│              (Tool entrypoint — 100 lines)                   │
│   Routes requests to sub-modules based on mode/stage         │
└──────┬──────┬──────┬──────┬──────┬──────┬───────────────────┘
       │      │      │      │      │      │
       ▼      ▼      ▼      ▼      ▼      ▼
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐
│router│ │plan- │ │valid-│ │insta-│ │docu- │ │renderer  │
│.ts   │ │ner.ts│ │ator  │ │ller  │ │menter│ │.ts       │
│      │ │      │ │.ts   │ │.ts   │ │.ts   │ │          │
│Mode, │ │Build │ │Code- │ │Copy  │ │Auto- │ │Payload   │
│stage,│ │plan  │ │based  │ │to    │ │gen   │ │rendering │
│kind  │ │gener-│ │checks │ │~/.pi-│ │README│ │+ next    │
│infer-│ │ation │ │(tsc,  │ │exten-│ │& AR- │ │action    │
│ence  │ │      │ │manif- │ │sions │ │CHITE-│ │          │
│      │ │      │ │est)   │ │/     │ │CTURE │ │          │
└──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────────┘
                                    │
                                    ▼
                             ┌──────────────┐
                             │   cli.ts     │
                             │ (Standalone) │
                             └──────────────┘
```

### 1. `extension.ts` — Tool Entrypoint

**Responsibility**: Register the `extension_creator` tool with pi's `defineTool()` and handle the full lifecycle.

**Key behavior:**
- Normalizes mode and stage from user input via `router.ts`
- Runs validation when mode is `validate`, `review`, `install`, or `update`
- Generates plans when mode is `plan` or `scaffold` via `planner.ts`
- Triggers install when mode is `install` via `installer.ts`
- Generates documentation when mode is `document` via `documenter.ts`
- Renders response via `renderer.ts`

**Lines**: ~100 (was ~400 before refactoring — 75% reduction by delegating to modules)

### 2. `router.ts` — Mode/Stage Inference

**Responsibility**: Infer the lifecycle stage and starting mode from natural language requests.

**Exports:**
- `normalizeMode(value, stage, goal, path?)` → `Mode`
- `normalizeStage(value, goal, path?)` → `Stage`
- `modeFromStage(stage)` → `Mode | undefined`
- `inferKindFromGoal(goal)` → `string | undefined`

**Inference priority:**
1. Explicit mode/stage parameter
2. Stage-based default (`idea` → `plan`, `draft` → `scaffold`, etc.)
3. Goal keyword matching (`"document"` → `document`, `"validate"` → `validate`)
4. Path presence → `review`
5. Fallback → `plan`

**Key fix**: `"uninstall"` is checked before `"install"` to avoid false routing.

### 3. `planner.ts` — Build Plan Generation

**Responsibility**: Generate structured build plans for new extensions.

**Exports:**
- `buildPlan({ goal, extensionKind, strict, note })` → `ExtensionPlan`

**Output**: Title, summary, recommended files, suggested steps, cautions.

### 4. `validator.ts` — Code-Based Validation Engine

**Responsibility**: Validate extension packages against pi's architecture rules.

**Key behaviors:**
- Reads and parses `package.json`
- Resolves the declared entrypoint (supports `pi.extensions`, `pi.entrypoint`, legacy `main`)
- Enforces kebab-case package naming
- Validates `tsconfig.json` exists and is valid
- Runs `tsc --noEmit` with the project's tsconfig
- Parses compiler output (both structured and free-form)
- Scans entrypoint imports for undeclared dependencies
- **Batches all diagnostics** — no early returns

**Resolution priority for entrypoints:**
1. `pi.extensions` array (first entry)
2. `pi.entrypoint`
3. `main` (legacy fallback, emits warning)

**Export**: `validateExtensionProject(packagePath)` → `Promise<ValidationResult>`

### 5. `installer.ts` — Deterministic Install

**Responsibility**: Copy a validated extension package to `~/.pi-extensions/<name>`.

**Key behaviors:**
- Refuses to install if validation status is `fail`
- Uses package name from validation result for install directory
- Uses `fs.cpSync()` for fast recursive copy (Node 16.7+)
- Replaces existing installation automatically
- Updates `~/.pi/agent/settings.json` — removes old source path, inserts install path
- Logs settings.json errors via `console.warn` instead of swallowing

**Export**: `runDeterministicInstall({ sourcePath, validation })` → `InstallResult`

### 6. `documenter.ts` — Automatic Documentation Generator

**Responsibility**: Analyze extension source code and generate README.md and ARCHITECTURE.md.

**Key behaviors:**
- Reads `package.json` for name, description
- Resolves entrypoint from manifest
- Detects extension kind (tool, command, prompt, provider, complex)
- Detects presence of prompts, skills, commands, tools
- Generates README with badges, features table, install guide, dev commands
- Generates ARCHITECTURE.md only for complex extensions (has many source files, commands, or both tools + prompts)
- Lists all source files in architecture doc
- `generateReadme()` and `generateArchitecture()` are pure functions returning strings

### 7. `renderer.ts` — Output Rendering

**Responsibility**: Convert the internal `ToolPayload` into user-facing text and determine the next action.

**Exports:**
- `renderPayload(payload)` → rendered string
- `chooseNextAction({ mode, stage, sourcePath, validation, installResult })` → next action string
- `buildDocumentationGuidance({ sourcePath, extensionKind })` → documentation guidance (legacy/fallback)
- `ToolPayload` interface
- `DocumentationGuidance` interface

### 8. `cli.ts` — Standalone CLI

**Responsibility**: Provide a command-line interface for validation and bootstrapping.

**Commands:**
- `validate [path]` — Validate an extension package
- `review [path]` — Same as validate
- `bootstrap` — Build, validate, and install self from cwd
- `install-self` — Same as bootstrap

**Flags:**
- `--help` / `-h` — Show usage
- `--version` / `-v` — Show version
- `--json` — Machine-readable JSON output
- `--verbose` — Detailed progress messages

---

## Data Flow

### Validation Flow
```
path → validator.ts
  ├─ read package.json
  ├─ resolve entrypoint
  ├─ resolve tsconfig
  ├─ run tsc --noEmit
  ├─ parse compiler output
  ├─ analyze dependencies
  └─ return ValidationResult { status, errors, warnings, details }
```

### Install Flow
```
path → installer.ts
  ├─ check validation.status !== 'fail'
  ├─ resolve package name from validation or dir basename
  ├─ mkdir -p ~/.pi-extensions/
  ├─ cpSync (replaces existing)
  ├─ cleanupSettingsJson (update ~/.pi/agent/settings.json)
  └─ return InstallResult { success, extensionName, installPath, message }
```

### Document Flow
```
path → documenter.ts
  ├─ read package.json
  ├─ resolve entrypoint source
  ├─ detect kind, commands, tools, prompts, skills
  ├─ generateReadme() → string
  ├─ if complex: generateArchitecture() → string
  ├─ writeFileSync README.md
  ├─ writeFileSync ARCHITECTURE.md (optional)
  └─ return GeneratedDocs { readme, architecture, filesWritten }
```

---

## Extension Lifecycle Stages

```
idea ──plan──→ draft ──scaffold──→ workspace ──review──→ validated
                                                              │
                                                              ▼
                                                         install
                                                              │
                                                              ▼
                                                         installed
                                                              │
                                                   ┌──────────┴──────────┐
                                                   │                     │
                                               update                remove
                                                   │                     │
                                                   ▼                     ▼
                                              installed              (gone)
```

| Stage | Meaning | Starting Mode |
|-------|---------|---------------|
| `idea` | Just an idea, no code yet | `plan` |
| `draft` | Starter scaffold created | `scaffold` |
| `workspace` | External repo/folder exists | `review` |
| `validated` | Package passed validation | `install` |
| `installed` | Already in pi | `review` or `update` |
| `maintenance` | Needs updates or removal | `update` or `remove` |

---

## Validation Rules

| Check | Code | Severity |
|-------|------|----------|
| package.json exists | `manifest.missing` | error |
| package.json is valid JSON | `manifest.invalid-json` | error |
| Package name exists | `manifest.name.missing` | error |
| Package name is kebab-case | `manifest.name.not-kebab-case` | error |
| Entrypoint declared | `manifest.entrypoint.missing` | error |
| Exactly one entrypoint | `manifest.entrypoint.multiple` | error |
| Entrypoint file exists | `entrypoint.missing` | error |
| Named entrypoint preferred | `entrypoint.named-file` | warning |
| Index entrypoint legacy | `entrypoint.index-file` | warning |
| tsconfig.json exists | `tsconfig.missing` | error |
| TypeScript compiles | `compiler.*` | error/warning |
| Undeclared dependencies | `dependencies.undeclared` | warning |

---

## Test Architecture

41 tests across 3 test suites:

| Suite | Tests | Coverage |
|-------|-------|----------|
| `validator.test.ts` | 10 | Manifest checks, entrypoint resolution, tsconfig handling, batch diagnostics |
| `installer.test.ts` | 5 | Validation gate, source-not-found, directory naming, replacement, validation override |
| `router.test.ts` | 26 | Mode inference (9), stage inference (5), modeFromStage (1), kind inference (11) |

Test infrastructure via `vitest` with `src/__tests__/helpers.ts` providing temp package creation.

---

## Key Design Decisions

### Why `fs.cpSync()` instead of custom recursive copy?
Node 16.7+ provides native recursive `cpSync`. It's faster, handles edge cases (symlinks, permissions), and removes 19 lines of manual recursion.

### Why batch diagnostics instead of early returns?
One-pass validation reveals all issues at once, reducing the fix-revalidate loop from N iterations to 1.

### Why `console.warn` instead of silent catch in settings.json?
Silent error masking hides real problems (corrupt settings.json, permission issues). Logging gives debuggability without blocking install.

### Why 8 modules instead of 1?
The original `extension.ts` was ~400 lines handling mode inference, plan building, rendering, next-action logic, and documentation guidance — violating single responsibility. Splitting into 8 modules reduces the entrypoint to ~100 lines and makes each module independently testable.

---

## Open Questions

- Should installs default to global or project-local scope?
- Should the tool support npm packages and git repos as sources, not just local paths?
- How strict should cleanliness rules be for generated extensions?
- Should the documenter support custom templates?
