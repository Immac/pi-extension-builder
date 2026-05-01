# 🚀 pi-extension-creator

A pi.dev extension that helps LLMs create, validate, and install pi extensions through guided workflows.

![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue?style=flat-square&logo=typescript)
![MIT License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Pi Extension](https://img.shields.io/badge/pi--extension-orange?style=flat-square)

> ⚠️ **Personal Project Disclaimer**: This is a personal project created for my own use. I cannot guarantee regular maintenance, timely updates, or support. Use at your own discretion.

## ✨ What is this?

Think of it as a **"factory for pi extensions"** — but smarter. This extension itself is built for managing the extension lifecycle: planning, scaffolding, validating, and installing other pi extensions.

Instead of manually managing extension files and running shell commands, LLMs use the `extension_creator` **tool** to:

<table>
<tr>
<td width="50%">

### 🎯 **Intelligent Routing**
Infers extension stage and starting mode from natural language requests

</td>
<td width="50%">

### 🛠️ **Guided Workflows**
Step-by-step extension development with validation built-in at every stage

</td>
</tr>
<tr>
<td width="50%">

### ✅ **Built-in Validation**
Ensures extensions follow pi's architecture guidelines before installation

</td>
<td width="50%">

### 📦 **Unified Lifecycle**
Single tool manages planning → scaffolding → review → validation → install/update/remove

</td>
</tr>
</table>

---

## 🎨 Core Principles

<div align="center">

| Principle | Description |
|-----------|-------------|
| 🔧 **Tool-first** | All lifecycle operations via the `extension_creator` tool, not shell commands |
| 📁 **External-first** | Author extensions in normal project directories, not inside pi |
| 🧭 **Guided Routes** | Tool infers the right workflow stage and starting mode from requests |
| ✅ **Validate Always** | Validation is mandatory before any lifecycle action |
| 🎯 **Minimal** | One clear responsibility per extension, clean architecture |

</div>

---

## 🚀 Installation

### Install into pi

```bash
# From this directory, use the extension_creator tool
extension_creator(goal="Install the pi-extension-creator", mode="install", path="/path/to/this/repo")
```

Or from the command line:

```bash
# Build the extension first
npm install && npm run build

# Then use pi to install from this local directory
# (This will invoke the extension_creator tool to manage installation)
```

---

## 💡 Usage

### 🤖 Using the Tool (Primary Interface)

The `extension_creator` tool is your interface to the entire lifecycle:

#### Example 1: Create a new extension from scratch

```
User: "Create a tool extension that adds git operations"
↓
LLM: Calls extension_creator with goal, mode="plan", stage="idea"
↓
Tool: Returns architecture plan, suggested files, cautions
↓
LLM: Scaffolds files, implements the extension
↓
User: "Validate and install it"
↓
LLM: Calls extension_creator with mode="validate", then mode="install"
↓
Tool: Validates the package, runs installation, reports success
```

#### Example 2: Review and update an existing extension

```
User: "Review my extension in ~/my-extension and update it"
↓
LLM: Calls extension_creator with path="~/my-extension", mode="review"
↓
Tool: Validates the extension, reports status
↓
LLM: Makes changes, runs validation again
↓
User: "Update the installed version"
↓
LLM: Calls extension_creator with mode="update", path="~/my-extension"
↓
Tool: Re-validates and updates the installation
```

### Tool Parameters

| Parameter | Description |
|-----------|-------------|
| `goal` | What you want to build or do |
| `mode` | `plan` \| `scaffold` \| `review` \| `validate` \| `install` \| `update` \| `remove` \| `document` |
| `stage` | `idea` \| `draft` \| `workspace` \| `validated` \| `installed` \| `maintenance` \| `unknown` |
| `path` | Path to extension workspace (optional, required for most lifecycle operations) |
| `extensionKind` | `tool` \| `command` \| `prompt` \| `provider` (auto-inferred from goal) |
| `strict` | Enforce stricter validation and cleanup rules |
| `note` | Additional context or special instructions |

### Prompts for LLMs

Three built-in prompts guide LLM behavior:

| Prompt | Purpose |
|--------|---------|
| `/init-extension` | Quick start guide for extension creation using the tool |
| `/create-extension` | Full end-to-end workflow for building extensions |
| `/documentation` | Generate README and architecture docs for existing extensions |

---

## 🏗️ Project Structure

```
📦 pi-extension-creator/
├── 🎯 src/
│   ├── 📁 extensions/
│   │   └── extension-creator/    # The extension tool
│   │       └── index.ts
│   ├── extension.ts              # Tool implementation & workflow logic
│   ├── validator.ts              # Extension package validator
│   ├── types.ts                  # Shared types
│   └── cli.ts                    # CLI entry point
├── 📝 prompts/                   # LLM prompt templates
│   ├── init-extension.md         # Quick start for extension creation
│   ├── create-extension.md       # Full end-to-end workflow
│   └── documentation.md          # Documentation generation
├── 📚 skills/                    # Specialized workflows
│   └── zero-to-documented/       # Skill: Full extension creation workflow
├── 📖 dist/                      # Build output
├── 📄 ARCHITECTURE.md            # Detailed design specification
├── 📦 package.json
└── ⚙️ tsconfig.json
```

---

## 🛠️ Development

### Prerequisites

- ![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js&style=flat) 
- ![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue?logo=typescript&style=flat)

### Commands

| Command | Description |
|---------|-------------|
| `npm install` | 📦 Install dependencies |
| `npm run build` | 🔨 Compile TypeScript |
| `npm run validate` | ✅ Validate extension structure |
| `npm run validate:src` | 🔍 Type-check without emitting |
| `npm run clean` | 🧹 Remove build artifacts |

### Development Workflow

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Validate the package
npm run validate

# To test locally:
# Use the extension_creator tool to install from your working directory
extension_creator(goal="Install extension-creator for testing", mode="install", path="/path/to/this/repo")
```

---

## 🎭 Extension Types Supported

The tool can help create these extension types:

<div align="center">

| Type | Icon | Description |
|------|------|-------------|
| **Tool** | 🔧 | Add custom tools (like extension_creator itself) |
| **Command** | ⌨️ | Add slash commands to pi |
| **Prompt** | 💬 | Inject reusable prompt templates |
| **Provider** | 🤖 | Add custom AI model providers |

</div>

---

## 🏛️ Workflow Stages

The tool understands the extension lifecycle:

| Stage | Meaning | Starting Mode |
|-------|---------|----------------|
| `idea` | Just an idea, no code yet | `plan` |
| `draft` | Starter scaffold created | `scaffold` |
| `workspace` | External repo/folder exists | `review` |
| `validated` | Package passed validation | `install` |
| `installed` | Already in pi | `review` or `update` |
| `maintenance` | Needs updates or removal | `update` or `remove` |

---

## ✅ Validation Rules

Before installation, the validator checks:

- ✅ Valid `package.json` with clear name and pi config
- ✅ TypeScript source files (prefer named entrypoint over `index.ts`)
- ✅ Explicit extension path in `src/extensions/<name>/<name>.ts`
- ✅ Valid `tsconfig.json`
- ✅ No conflicts with installed extensions

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed validation rules.

---

## 🤝 Contributing

We follow pi's extension guidelines:

- ✅ Keep it small and focused
- ✅ One responsibility per extension
- ✅ Tool-first interface (no command sprawl)
- ✅ Easy reviewability for LLMs
- ✅ Clean, obvious file layout
- ✅ Always validate before installing

### How to Contribute

1. 🍴 Fork the repository
2. 🌿 Create your feature branch (`git checkout -b feature/amazing-feature`)
3. 💾 Commit your changes (`git commit -m 'Add amazing feature'`)
4. 🚀 Push to the branch (`git push origin feature/amazing-feature`)
5. 🎉 Open a Pull Request

---

## 📚 Resources

<div align="center">

[![pi coding agent](https://img.shields.io/badge/pi-coding--agent-documentation-orange?style=for-the-badge)](https://github.com/mariozechner/pi-coding-agent)
[![Architecture](https://img.shields.io/badge/Architecture-Spec-blue?style=for-the-badge)](./ARCHITECTURE.md)

</div>

- 📖 [pi Coding Agent Documentation](https://github.com/mariozechner/pi-coding-agent)
- 🏗️ [Architecture Specification](./ARCHITECTURE.md)
- 💬 [pi Community & Support](https://github.com/mariozechner/pi-coding-agent/discussions)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

### 🌟 Like this project?

Give it a ⭐ on [GitHub](https://github.com/Immac/pi-extension-builder)!

</div>
