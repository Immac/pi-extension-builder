# Pi Extension Creator

A lifecycle manager for pi.dev extensions — validate, install, enable/disable, and document extensions with scope-aware vault management and harness-agnostic architecture.

![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=flat-square&logo=typescript)
![MIT License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Pi Extension](https://img.shields.io/badge/pi--extension-orange?style=flat-square)
[![Tests](https://img.shields.io/badge/tests-51%20passing-brightgreen?style=flat-square)]()

## Features

- 📦 **Scope-aware installs** — User scope (`~/.extension-manager/`) or project scope (`.extension-manager/`)
- ✅ **Validation** — Checks package.json, tsconfig, entrypoint, and runs the TypeScript compiler
- 🔁 **Enable/disable** — Toggle extensions on/off without removing files
- 📋 **Registry tracking** — JSON registry per scope tracks all installed extensions
- 🔌 **Harness-agnostic** — Core manager doesn't depend on pi; a `PiHarnessAdapter` bridges to pi's `settings.json`
- 🔔 **Cross-session reload notification** — All running pi sessions see a footer warning when extensions change
- 📐 **Documentation generation** — LLM-driven README.md and ARCHITECTURE.md generation
- 🧪 **51 tests** — Comprehensive test coverage

## Provided Tool

| Tool name | Description | Modes |
|---|---|---|
| `extension_creator` | Validate, install, enable/disable, list, document extensions | `plan`, `scaffold`, `review`, `validate`, `install`, `enable`, `disable`, `remove`, `list`, `document`, `update` |

## Quick Start

### Install the extension-creator itself

```bash
# From the extension-creator directory
npm run build
pi-extension-creator bootstrap

# Then /reload in pi
```

### Validate an extension

```bash
pi-extension-creator validate ./path/to/my-ext
pi-extension-creator validate --json ./path/to/my-ext
pi-extension-creator validate --verbose ./path/to/my-ext
```

### Install an extension

```bash
# User scope (default) — installs to ~/.extension-manager/extensions/<name>
pi-extension-creator install ./path/to/my-ext

# Project scope — installs to ./.extension-manager/extensions/<name>
pi-extension-creator install ./path/to/my-ext --scope project
```

### Enable/disable an extension

```bash
pi-extension-creator enable my-ext
pi-extension-creator disable my-ext --scope project
pi-extension-creator enable my-ext --scope user
```

### List extensions

```bash
pi-extension-creator list
pi-extension-creator list --scope user --json
```

### Uninstall an extension

```bash
pi-extension-creator uninstall my-ext
pi-extension-creator uninstall my-ext --scope project
```

### Generate documentation

```bash
pi-extension-creator validate ./path/to/my-ext
# Then use the extension_creator tool with mode=document
```

## Usage Examples

### Via the pi tool (inside pi)

```
extension_creator mode=install sourcePath=./my-ext scope=user
extension_creator mode=enable sourcePath=my-ext scope=project
extension_creator mode=disable sourcePath=my-ext scope=user
extension_creator mode=list scope=user
extension_creator mode=remove sourcePath=my-ext scope=project
extension_creator mode=validate sourcePath=./my-ext
extension_creator mode=document sourcePath=./my-ext
```

### Via the CLI

```bash
# Full lifecycle: build, validate, install
cd my-extension
npm run build
pi-extension-creator validate .
pi-extension-creator install ./

# Later, disable it
pi-extension-creator disable my-extension

# Later, completely remove it
pi-extension-creator uninstall my-extension
```

## Cross-session Reload Notification

When an extension is installed, enabled, disabled, or uninstalled, the manager bumps a `lastModified` timestamp in the registry. The extension-creator's pi extension checks this on `session_start` and `turn_start`:

- If a change was made in another session, all running pi sessions show a footer: `⚠️ Extensions changed — /reload to apply`
- After `/reload`, the warning clears
- For real-time notifications across sessions, set `EXT_MANAGER_WATCH=1` to enable `fs.watch` (zero CPU at idle, fires instantly on change)

## Development

### Prerequisites

- Node.js >= 18
- npm
- pi.dev (for testing the pi extension)

### Setup

```bash
git clone <repo>
cd pi-extension-creator
npm install
```

### Commands

```bash
npm run build          # Compile TypeScript → dist/
npm test               # Run vitest suite (51 tests)
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage report
npm run validate:src   # TypeScript type-check only
npm run bootstrap      # Build + install self (user scope)
npm run self-install   # Same as bootstrap
```

## Resources

- [Pi Extensions Documentation](https://pi.dev/docs/extensions)
- [Pi Packages Documentation](https://pi.dev/docs/packages)
- [TypeScript](https://www.typescriptlang.org/)
- [Vitest](https://vitest.dev/)
