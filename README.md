# 🚀 pi-extension-creator

A pi.dev extension that helps LLMs create, validate, and install pi extensions through guided workflows.

![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue?style=flat-square&logo=typescript)
![MIT License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Pi Extension](https://img.shields.io/badge/pi--extension-orange?style=flat-square)

> ⚠️ **Personal Project Disclaimer**: This is a personal project created for my own use. I cannot guarantee regular maintenance, timely updates, or support. Use at your own discretion.

## ✨ What is this?

Think of it as a **"factory for pi extensions"** — but smarter. Instead of manually scaffolding extensions, LLMs can use this tool to:

<table>
<tr>
<td width="50%">

### 🎯 **Smart Classification**
Automatically identifies what type of extension you need based on natural language goals

</td>
<td width="50%">

### 🛠️ **Guided Creation**
Step-by-step extension building with validation and best practices built-in

</td>
</tr>
<tr>
<td width="50%">

### ✅ **Built-in Validation**
Ensures extensions follow pi's architecture guidelines

</td>
<td width="50%">

### 📦 **Easy Installation**
Seamlessly install extensions from any workspace into pi

</td>
</tr>
</table>

---

## 🎨 Key Principles

<div align="center">

| Principle | Description |
|-----------|-------------|
| 🔧 **Tool-first** | Extensions created via tool calls, not commands |
| 📁 **External-first** | Author in normal project directories |
| 🎯 **Minimal footprint** | Single command with arguments, not many |
| 🧹 **Clean by default** | Simplicity and reviewability always |

</div>

---

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone git@github.com:Immac/pi-extension-builder.git
cd pi-extension-builder

# Install dependencies
npm install

# Build the extension
npm run build

# Install into pi
pi extension install .
```

### Or configure in your pi settings:

```json
{
  "pi": {
    "extensions": ["./path/to/extension-creator/src/extensions/extension-creator"]
  }
}
```

---

## 💡 Usage

### 🤖 As a Tool (Primary)

Just tell the LLM what you want:

```yaml
User: "Create an extension that blocks dangerous file writes"
LLM: Calls extension-creator tool → validates → scaffolds → installs

User: "Make an extension that adds a custom tool for git operations"
LLM: Classifies as "tool extension" → generates code → reviews → done
```

### ⌨️ As Commands (Secondary)

```bash
/extension create <type>     # Create a new extension
/extension install <path>    # Install from path
/extension review <path>     # Review existing extension
```

---

## 🏗️ Project Structure

```
📦 pi-extension-creator/
├── 🎯 src/
│   ├── 📁 extensions/
│   │   └── extension-creator/    # The extension implementation
│   │       └── index.ts
│   ├── cli.ts                     # CLI entry point
│   ├── extension.ts               # Core logic
│   ├── validator.ts               # Validation engine
│   ├── types.ts                  # Shared types
│   └── shims.d.ts                # Type definitions
├── 📝 prompts/                     # LLM prompt templates
│   ├── extension.md
│   └── extension-full.md
├── 📚 dist/                        # Build output (gitignored)
├── 📖 ARCHITECTURE.md             # Detailed architecture spec
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

# Watch mode (if available)
npm run build -- --watch

# Validate as you work
npm run validate
```

---

## 🎭 Extension Types Supported

<div align="center">

| Type | Icon | Description |
|------|------|-------------|
| **Tool** | 🔧 | Add custom tools to pi |
| **Command** | ⌨️ | Add slash commands |
| **Prompt** | 💬 | Inject system prompt guidance |
| **Provider** | 🤖 | Add custom AI providers |

</div>

---

## 🤝 Contributing

We follow pi's extension guidelines:

- ✅ Keep it small and focused
- ✅ One responsibility per extension
- ✅ Minimal event hooks
- ✅ Easy reviewability for LLMs
- ✅ Clean, obvious file layout

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
