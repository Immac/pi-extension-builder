# Architecture Spec: pi Extension Creator

## Purpose

This project will provide a **pi extension** that helps LLMs understand how to create, structure, clean up, and install pi extensions.

The extension is intended to be called primarily as a **tool** by the LLM, not as a collection of slash commands.

## Goals

- Help an LLM choose the right kind of pi extension for a task
- Bootstrap a new extension from user intent
- Keep generated extensions clean and minimal
- Support development outside pi’s runtime folders
- Provide a controlled install path into pi
- Avoid polluting interactive sessions with many `/commands`
- Optionally delegate work to specialized agents

## Non-Goals

- Implementation should stay small and focused, starting with validation and a real tool entrypoint
- No runtime behavior changes to pi itself
- No large command surface
- No opinionated framework beyond what is needed for clean pi extensions

## High-Level Concept

The extension acts as a **guided extension builder**.

An LLM calls the main tool with a user goal such as:

- "create an extension that blocks dangerous file writes"
- "make an extension that adds a custom tool"
- "build an extension that injects system prompt guidance"

The tool then helps the LLM:

1. classify the requested extension type
2. choose a clean structure
3. generate or outline the extension
4. review it for simplicity and correctness
5. install it from an external workspace into pi

## Core Principles

### 1. Tool-first interface

The primary interface should be a **tool** that the LLM can call during normal agent work.

### 2. External-first development

Extensions should be authored in a normal project directory, outside of pi’s global or project-local extension folders.

### 3. Minimal command footprint

If commands are needed, prefer a single umbrella command with arguments instead of many feature-specific slash commands.

Example preference:

- `/extension create <type>`
- `/extension install <path>`
- `/extension review <path>`

Avoid:

- `/extension-do-a`
- `/extension-do-b`
- `/extension-do-c`

### 4. Clean architecture by default

Generated extensions should favor:

- one responsibility per extension
- minimal event hooks
- small and obvious file layout
- no unnecessary UI
- no hidden side effects
- explicit state handling
- easy reviewability for LLMs

## System Components

### A. Main Tool

The main tool is the user-facing entry point for the LLM.

Responsibilities:

- accept the user’s extension request
- identify the extension type
- route the request to the appropriate internal agent
- return a clean plan or scaffold guidance
- coordinate install and cleanup guidance

### B. Specialized Agents

The tool may delegate to one or more specialized agents.

#### Planner Agent

Responsibilities:

- interpret the user’s intent
- decide which pi extension pattern fits best
- define the minimum required files
- identify dependencies and clean boundaries
- produce a concise build plan

#### Scaffold Agent

Responsibilities:

- define the initial project shape
- produce a minimal extension scaffold
- keep generated structure consistent and simple
- avoid unnecessary files or abstraction

#### Review / Cleanup Agent

Responsibilities:

- assess complexity and code hygiene
- flag extra commands or redundant hooks
- check separation of concerns
- recommend simplifications

#### Installer Agent

Responsibilities:

- validate the external extension layout
- define the installation target for pi
- guide copy/link/register behavior
- ensure the installed extension remains clean and discoverable

## Extension Types to Support

The system should be able to reason about common pi extension styles, including:

- tool extensions
- command extensions
- event/listener extensions
- prompt/system-prompt extensions
- UI extensions
- provider extensions
- session/state extensions
- resource-discovery extensions

## External Workspace Model

The source extension should live outside pi’s folders, for example in a normal project repository.

Conceptually:

- **source workspace**: where the extension is authored and reviewed
- **install target**: where pi loads the extension from

The architecture should support a clean transition from source workspace to install target without mixing authoring files into pi’s runtime directories.

For installation, the tool should use pi’s built-in package workflow (`pi install`, `pi remove`, `pi update`) instead of inventing a separate copier or linker.

## Package and Source Conventions

Because pi extensions are Node-based, the architecture should use the TypeScript compiler as the primary validation mechanism before install.

Conventions for extension packages:

- use a **named package** as the canonical unit, not an anonymous `index.js` layout
- package names should use **kebab-case**
- prefer **TypeScript** source over JavaScript source
- keep entrypoints explicit and easy to identify
- prefer a short, named entrypoint file that matches the extension name
- avoid relying on generic `index.ts` or `index.js`-style entry files for extension identity
- validate package structure before install

## TypeScript Compiler Validation

The validation layer should use the TypeScript compiler and other code-based checks to verify the package before installation.

Validation should be automated in code wherever possible rather than left to the LLM to judge manually.

### Recommended checks

- package name exists and matches kebab-case rules
- manifest has a single explicit entrypoint
- entrypoint file exists and is readable
- entrypoint resolves to a short named TypeScript source file by default
- package layout is not ambiguous or implicit
- no fallback to `index.ts` or `index.js` identity discovery
- no mismatched manifest/path identity
- runtime dependencies are declared clearly when needed
- source structure compiles cleanly under the configured TypeScript settings

### Code-based validation model

Validation should be implemented as a deterministic checker, likely as a Node/TypeScript script or library function.

The checker should be able to:

- parse the package manifest
- resolve the declared entrypoint
- read and validate the TypeScript configuration
- run compiler checks
- report structural issues separately from compiler errors
- return machine-readable results for the installer and the LLM

### Validation outputs

- **pass**: package type-checks and is installable
- **warn**: package type-checks with non-fatal cleanup issues or non-ideal structure
- **fail**: package does not type-check or should not be installed until corrected

### Validation result format

The validator should return machine-readable results so the installer and the LLM can act on them without reinterpreting raw compiler output.

Recommended fields:

- `status`: `pass` | `warn` | `fail`
- `packageName`: resolved package identity
- `entrypoint`: resolved entrypoint path
- `tsconfig`: tsconfig path or resolved compiler settings reference
- `errors`: compiler or structural errors that block install
- `warnings`: non-blocking cleanup or quality issues
- `details`: optional structured diagnostic data for tooling or UI

### Validation intent

The TypeScript compiler should be the authoritative checker for source correctness.
Additional structural checks and package checks should also be implemented as code, with the LLM using their results instead of trying to infer correctness itself.

## Package Manifest Shape

The package manifest should be the source of truth for identity and loading.

### Recommended manifest responsibilities

- declare the package name
- declare the extension entrypoint explicitly
- optionally declare package kind or extension type
- optionally declare dependencies required at runtime
- optionally declare install metadata for pi

### Recommended conceptual shape

- **name**: required, kebab-case, canonical extension identity
- **type**: optional, describes the extension category or packaging mode
- **entrypoint**: required, explicit TypeScript source file or package entry path
- **dependencies**: optional, runtime dependencies needed by the extension
- **pi metadata**: optional, install or discovery hints for pi

### Manifest rules

- the manifest must not depend on implicit `index.ts` or `index.js` discovery
- the manifest should name a single clear entrypoint
- the manifest should be small and readable
- the manifest should support validation by the parser/linter layer
- the manifest should align with TypeScript-first authoring

## Named Entrypoint Resolution

The installer should resolve the extension entrypoint directly from the manifest instead of guessing from filenames.
It should prefer a short, named TypeScript file that matches the extension name over an `index.ts` fallback.

### Resolution rules

- entrypoint resolution must be explicit
- the declared entrypoint must exist and be readable
- the entrypoint should point to TypeScript source by default
- the resolver should prefer a named entrypoint over `index.ts`
- the resolver should not infer identity from `index.js`
- the resolver should fail clearly if the manifest and filesystem disagree
- the resolver should be deterministic for validation, install, and runtime loading

## Install Target Conventions

The install target should be predictable, isolated, and easy for pi to discover.

For this project, the install target is the pi package/discovery state managed by the built-in installer, not a custom filesystem destination chosen by the extension.

### Target rules

- the install target must be explicitly defined
- the source workspace and install target must remain separate
- the install target should be structured for discovery by pi without extra ambiguity
- the installer should not scatter files across multiple unrelated paths unless required by pi’s package model
- the install target should preserve the package name as the installed identity
- the install target should support clean updates and removals

## Install Concept

The install workflow should be explicit, repeatable, and automation-friendly.

Desired behavior:

1. validate the extension source
2. confirm the extension type, package name, and explicit entrypoint
3. determine whether installation should be global or project-local
4. run the code-based TypeScript/package validator before installation
5. invoke pi’s built-in install/update/remove command for the selected source
6. keep the installed package identity stable and the source workspace untouched

The mechanism should be based on pi’s own package manager behavior, not a separate custom installer.

## Cleanliness Rules

Generated extensions should follow these rules unless the user requests otherwise:

- prefer a single extension per concern
- avoid registering many commands
- use arguments for command variation
- keep tool names generic and reusable
- separate planning, runtime logic, and install metadata
- avoid large shared state unless required
- keep dependencies minimal
- use explicit package naming and short, named entrypoints
- keep file names descriptive and short
- keep source code in TypeScript unless there is a strong reason otherwise

## Command Policy

The extension should minimize slash-command clutter.

Guidelines:

- prefer tools over commands
- default to **no slash commands** unless they provide clear user value
- if a command is needed, use a single umbrella command with arguments
- avoid per-feature slash commands
- avoid adding multiple commands for the same extension
- keep command names generic and stable
- prefer tool modes and arguments over separate `/foo` and `/bar` commands
- keep interactive UI focused on the current task, not command sprawl
- do not add commands unless they materially improve usability
- if a command exists, it should generally be a thin wrapper over the main tool rather than a separate workflow

## Tool Contract

The main tool should act as the entrypoint for extension planning and installation.

### Tool responsibilities

- accept the user's extension goal
- identify the extension category
- decide whether planning, scaffolding, review, or install actions are needed
- invoke validation code before install-related actions
- return structured guidance that the LLM can follow directly
- avoid exposing unnecessary complexity to the interactive session

### Tool input shape

The exact tool schema is intentionally unspecified for now, but it should support at least:

- desired extension kind
- user goal or description
- source workspace path
- optional install target or destination preference
- optional strictness / cleanup preference
- optional validation-only mode

### Tool output shape

The tool should return machine-usable guidance, such as:

- extension classification
- required files or structure
- validation results
- install readiness
- cleanup recommendations
- next action for the LLM

### Operational modes

The tool should support a few clear modes so the LLM can use the same interface for different tasks:

- **plan**: analyze the request and produce an extension plan
- **scaffold**: generate or outline a starter package structure
- **review**: inspect an existing external extension for cleanliness and correctness
- **validate**: run code-based checks without installing
- **install**: validate and hand off to pi’s built-in install flow

### Validation-only mode

The `validate` mode should be a first-class path for checking an external extension without modifying the installed state.

### Validation-only behavior

- run the TypeScript/package validation pipeline
- return structured errors and warnings
- do not copy, link, register, or remove anything
- do not require the extension to already be installed
- allow the LLM to request cleanup guidance before installation

### Install/update/remove behavior

- `install`: validate first, then call `pi install <source>` or `pi install <source> -l` as appropriate
- `update`: refresh installed packages with `pi update` or `pi update <source>` after validation
- `remove`: detach the package with `pi remove <source>` or `pi uninstall <source>`
- keep the source workspace untouched when operating on an installed package

## Agent Responsibilities

The main tool may delegate to a small set of focused agents.

### Planner Agent

- interpret the user request
- choose the extension type
- define the minimum useful architecture
- identify the required files and dependencies
- produce a concise build plan

### Scaffold Agent

- generate the initial package layout
- create the minimal TypeScript source structure
- keep the scaffold predictable and clean
- avoid unnecessary boilerplate

### Review Agent

- inspect the extension for cleanliness
- flag command sprawl or redundant hooks
- identify structural issues and simplifications
- review compatibility with the validation rules

### Install Agent

- prepare the validated package for install
- resolve the declared entrypoint
- decide whether the source should be installed globally or project-locally
- invoke pi’s built-in package manager command
- confirm the installed identity remains stable

### Validation Agent

- run the TypeScript/package checks
- return machine-readable validation results
- block install when validation fails
- provide structured warnings for cleanup guidance

## Install and Lifecycle Operations

The extension should support a clean lifecycle for external development and installation.

### Install

- validate the source package
- resolve the package name and entrypoint
- invoke `pi install` against the source package or local path
- preserve the installed identity and metadata
- fail safely if validation does not pass

### Update

- re-run validation on the external source
- use `pi update` or `pi update <source>` to refresh the installed package
- keep the installed identity stable
- avoid leaving stale artifacts behind
- preserve a previous working installation if the new update fails

### Remove

- detach the installed package from pi with `pi remove` or `pi uninstall`
- remove or deactivate the discovery record
- avoid affecting the source workspace
- clean up only the installed artifacts
- remain safe if the package is already missing or partially removed

## Expected Interaction Flow

1. User asks for a pi extension
2. LLM calls the main tool
3. Tool classifies the request
4. Tool delegates to planner/scaffold/review/install agents as needed
5. Tool returns a clean extension plan or scaffold guidance
6. The extension is developed in an external workspace
7. The install step places it into pi’s discovery path

## Open Questions

These should be resolved before implementation:

- Should installs default to global or project-local scope?
- Should the tool support local-path installs, npm packages, git packages, or all three?
- Should the system generate full scaffolds or only structured plans?
- How strict should the cleanliness rules be?
- Which extension types should be supported first?
- What validation is required before install?

## Next Step

Define the tool contract, then implement the installer agent as a thin wrapper around pi’s built-in package commands.
