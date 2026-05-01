# pi-extension-creator

A pi.dev extension that helps LLMs create, validate, and install pi extensions through guided workflows.

## Overview

This extension acts as a **guided extension builder** for pi coding agents. Instead of requiring manual scaffolding, it enables LLMs to:

- Classify extension types based on user intent
- Bootstrap new extensions from natural language goals
- Validate extension structure and cleanliness
- Install extensions into pi from external workspaces

The primary interface is a **tool** that LLMs can call during normal agent work, minimizing the need for interactive slash commands.

## Key Principles

- **Tool-first interface** - Extensions are created via tool calls, not commands
- **External-first development** - Extensions are authored in normal project directories, outside pi's runtime folders
- **Minimal command footprint** - Prefer a single umbrella command with arguments
- **Clean architecture by default** - Generated extensions favor simplicity and reviewability

## Installation

This extension is designed to be installed as a pi extension:

```bash
# Build the extension
npm install
npm run build

# Install into pi (from the extension-creator directory)
pi extension install .
```

Or add to your pi configuration:

```json
{
  "pi": {
    "extensions": ["./path/to/extension-creator/src/extensions/extension-creator"]
  }
}
```

## Usage

### As a Tool (Primary Interface)

The LLM can call the extension creator tool with a user goal:

```
Create an extension that blocks dangerous file writes
Make an extension that adds a custom tool
Build an extension that injects system prompt guidance
```

The tool will:
1. Classify the requested extension type
2. Choose a clean structure
3. Generate or outline the extension
4. Review it for simplicity and correctness
5. Coordinate installation into pi

### As Commands (Secondary)

- `/extension create <type>` - Create a new extension
- `/extension install <path>` - Install an extension from a path
- `/extension review <path>` - Review an existing extension

## Development

### Prerequisites

- Node.js (with npm)
- TypeScript 5.6+

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

### Validate

```bash
# Validate the extension structure
npm run validate

# Type-check without emitting files
npm run validate:src
```

### Clean

```bash
npm run clean
```

## Project Structure

```
extension-creator/
├── src/
│   ├── extensions/
│   │   └── extension-creator/  # The extension implementation
│   │       └── index.ts
│   ├── cli.ts                   # CLI entry point
│   ├── extension.ts             # Core extension logic
│   ├── validator.ts             # Extension validation
│   ├── types.ts                # Shared types
│   └── shims.d.ts              # Type definitions
├── prompts/                     # Prompt templates for LLM guidance
│   ├── extension.md
│   └── extension-full.md
├── dist/                        # Build output (gitignored)
├── ARCHITECTURE.md              # Detailed architecture spec
├── package.json
└── tsconfig.json
```

## Extension Types

The creator supports various extension types:

- **Tool extensions** - Add custom tools to pi
- **Command extensions** - Add slash commands
- **Prompt extensions** - Inject system prompt guidance
- **Provider extensions** - Add custom AI providers

## Contributing

This project follows pi's extension guidelines:

- Keep implementations small and focused
- Favor one responsibility per extension
- Use minimal event hooks
- Ensure easy reviewability for LLMs

## License

See the LICENSE file (if applicable).

## Related

- [pi coding agent](https://github.com/mariozechner/pi-coding-agent)
- [pi documentation](https://github.com/mariozechner/pi-coding-agent/blob/main/README.md)
