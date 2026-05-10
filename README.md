# pi-extension-creator

A pi.dev extension that helps LLMs create, validate, and install pi extensions through guided workflows.

![TypeScript](https://img.shields.io/badge/TypeScript-ES2022-blue?style=flat-square&logo=typescript)
![MIT License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Pi Extension](https://img.shields.io/badge/pi--extension-orange?style=flat-square)
![Tests](https://img.shields.io/badge/tests-41%20passing-brightgreen?style=flat-square)

> ⚠️ **Personal Project Disclaimer**: This is a personal project created for my own use.
> I cannot guarantee regular maintenance, timely updates, or support. Use at your own discretion.

---

## What is this?

The **pi-extension-creator** is a "factory for pi extensions" — it provides a complete lifecycle management system for building, validating, and installing pi extensions entirely through LLM-driven tool calls.

Instead of manually managing extension files and running shell commands, LLMs use the single `extension_creator` **tool** to:

- 🎯 **Plan** — Analyze a goal and produce a build plan
- 🛠️ **Scaffold** — Generate starter package structure
- ✅ **Validate** — Run code-based TypeScript/package checks
- 📝 **Document** — Auto-generate README & ARCHITECTURE docs
- 📦 **Install** — Deterministic copy to `~/.pi-extensions/<name>`
- 🔄 **Update/Remove** — Refresh or uninstall extensions cleanly

---

## Architecture Overview

```
src/
├── extension.ts       # Tool entrypoint — delegates to all sub-modules
├── router.ts          # Mode/stage/kind inference from natural language
├── planner.ts         # Build plan generation
├── validator.ts       # Code-based validation engine (manifest + tsc)
├── installer.ts       # Deterministic file-copy install to ~/.pi-extensions/
├── documenter.ts      # Automatic README/ARCHITECTURE generation
├── renderer.ts        # Payload rendering + next-action selection
├── cli.ts             # Standalone CLI (validate, bootstrap, --help)
├── types.ts           # Shared TypeScript interfaces
└── __tests__/         # 41 tests across 3 test suites
    ├── validator.test.ts
    ├── installer.test.ts
    ├── router.test.ts
    └── helpers.ts
```

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🎯 **Intelligent Routing**
Infers extension stage (`idea` → `draft` → `workspace` → `validated` → `installed` → `maintenance`) and starting mode from natural language requests.

</td>
<td width="50%">

### ✅ **One-Pass Validation**
Batches all diagnostics before returning. Reports manifest errors, entrypoint issues, and tsconfig problems in a single pass — no more fix-one-thing-at-a-time.

</td>
</tr>
<tr>
<td width="50%">

### 📦 **Deterministic Install**
Copies extensions to `~/.pi-extensions/<name>` (excluding `.pi` directories) and updates `~/.pi/agent/settings.json`. Replaces existing installations automatically.

</td>
<td width="50%">

### 📝 **Automatic Documentation**
Analyzes source code structure, detects extension type, and generates README.md and ARCHITECTURE.md with badges, features, and usage guides.

</td>
</tr>
<tr>
<td width="50%">

### 🔧 **Improved CLI**
`--help`, `--version`, `--verbose`, `--json` flags. Clear error messages for invalid commands.

</td>
<td width="50%">

### 🧪 **41 Tests, All Passing**
Vitest test suite covering validator, installer, and router logic. Pre-commit hook runs `tsc --noEmit` + `vitest run` on every commit.

</td>
</tr>
</table>

---

## 🚀 Installation

```bash
# First-time setup
npm install
npm run build
npm run bootstrap    # Self-install into ~/.pi-extensions/pi-extension-creator
```

The `bootstrap` command validates the package, copies it to `~/.pi-extensions/pi-extension-creator`, and updates `~/.pi/agent/settings.json`.

---

## 💡 Usage

### Tool Interface (Primary)

The `extension_creator` tool is the main interface:

| Parameter | Description |
|-----------|-------------|
| `goal` | What you want to build or do |
| `mode` | `plan` \| `scaffold` \| `review` \| `validate` \| `install` \| `update` \| `remove` \| `document` |
| `stage` | `idea` \| `draft` \| `workspace` \| `validated` \| `installed` \| `maintenance` |
| `path` | Path to extension workspace |
| `extensionKind` | `tool` \| `command` \| `prompt` \| `provider` (auto-inferred) |
| `strict` | Enforce stricter validation rules |
| `note` | Additional context |

#### Examples

**Create a new extension:**
```
User: "Create a tool extension that adds git operations"
LLM → extension_creator(goal="...", mode="plan", stage="idea")
     → Returns architecture plan, suggested files, cautions
LLM → Scaffolds files, implements extension
LLM → extension_creator(goal="...", mode="validate", path="./my-ext")
     → If pass: extension_creator(goal="...", mode="install", path="./my-ext")
```

**Generate documentation:**
```
User: "Generate docs for my extension"
LLM → extension_creator(mode="document", path="./my-ext")
     → Analyzes source, writes README.md and optionally ARCHITECTURE.md
```

### CLI Interface

```bash
pi-extension-creator validate [path]           # Validate an extension package
pi-extension-creator validate --json           # Machine-readable output
pi-extension-creator validate --verbose        # Detailed progress
pi-extension-creator bootstrap                # Self-install from cwd
pi-extension-creator --help                   # Show usage
pi-extension-creator --version                # Show version
```

---

## 🔧 Development

### Prerequisites

- Node.js 18+
- TypeScript 5.6+

### Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run build` | Compile TypeScript |
| `npm test` | Run 41 tests (Vitest) |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | With coverage report |
| `npm run validate:src` | Type-check without emitting |
| `npm run precommit` | Type-check + test (runs on every commit) |
| `npm run clean` | Remove build artifacts |

### Pre-commit Hook

A pre-commit hook runs `tsc --noEmit && vitest run` automatically via `simple-git-hooks`. Installed on `npm install`.

---

## ✅ Validation Rules

The validator checks (in one pass):

- ✅ Valid `package.json` with kebab-case name
- ✅ Single explicit entrypoint (`pi.extensions`, `pi.entrypoint`, or `main`)
- ✅ Entrypoint file exists and is readable
- ✅ Named TypeScript entrypoint preferred over `index.ts`
- ✅ Valid `tsconfig.json`
- ✅ TypeScript compilation via `tsc --noEmit`
- ✅ All runtime dependencies declared in `package.json`

| Status | Meaning |
|--------|---------|
| `pass` | Package type-checks and is installable |
| `warn` | Non-fatal cleanup issues (e.g., index.ts entrypoint, legacy main) |
| `fail` | Package must not be installed until errors are fixed |

---

## 🏗️ Project Structure

```
📦 pi-extension-creator/
├── 📁 src/
│   ├── extension.ts        # Main tool implementation (tool entrypoint)
│   ├── router.ts           # Mode/stage/kind inference from natural language
│   ├── planner.ts          # Build plan generation
│   ├── validator.ts        # Extension package validator
│   ├── installer.ts        # Deterministic install to ~/.pi-extensions/<name>
│   ├── documenter.ts       # Automatic README/ARCHITECTURE generator
│   ├── renderer.ts         # Payload rendering + next-action selection
│   ├── cli.ts              # CLI entry point (--help, --json, --verbose)
│   ├── types.ts            # Shared types
│   ├── shims.d.ts          # Pi SDK type shims
│   └── __tests__/          # 41 tests
├── 📁 prompts/             # LLM prompt templates
│   ├── init-extension.md
│   ├── create-extension.md
│   └── documentation.md
├── 📁 skills/              # Specialized workflows
│   ├── zero-to-documented/
│   └── use-extension-creator-install/
├── 📁 dist/                # Build output
├── ARCHITECTURE.md         # Detailed design specification
├── CHANGELOG.md            # Version history
├── CONTRIBUTING.md         # Contribution guide
├── README.md               # This file
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── LICENSE
```

---

## 📚 Resources

- [Architecture Spec](./ARCHITECTURE.md)
- [Changelog](./CHANGELOG.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [pi Coding Agent Documentation](https://github.com/mariozechner/pi-coding-agent)

---

## 📄 License

MIT — see [LICENSE](LICENSE).
