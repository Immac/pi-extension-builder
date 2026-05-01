# Documentation Generation Prompt

You are tasked with generating documentation for a pi extension. This is an LLM-driven task that requires analyzing the extension's source code and structure.

## Input

The extension path will be provided. You should:
1. Read the extension's source files (entrypoint, package.json, tsconfig.json, etc.)
2. Analyze the code structure, dependencies, and purpose
3. Identify the extension type (tool, command, prompt, provider)

## Output Requirements

### README.md

Generate a README.md with:

1. **Header with badges** (flat-square style, matching web-search extension):
   ```
   # Extension Name
   
   Description of what the extension does.
   
   ![TypeScript](https://img.shields.io/badge/TypeScript-<version>-blue?style=flat-square&logo=typescript)
   ![MIT License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
   ![Pi Extension](https://img.shields.io/badge/pi--extension-orange?style=flat-square)
   ```

2. **Features section** - List key capabilities with emojis (🔍, 🛠️, etc.)

3. **Tools/Commands section** - Table or list of what the extension provides

4. **Quick Start** - Installation and first use examples

5. **Usage Examples** - Practical examples

6. **Development** - Prerequisites, setup, build commands (if applicable)

7. **Resources** - Links to related docs

### ARCHITECTURE.md (for complex extensions only)

Generate if the extension has:
- Multiple agents or components
- Complex state management
- Non-trivial architecture

Include:
- Purpose and goals
- System components
- Key principles
- Interaction flows

## Style Guidelines

- Use emojis sparingly but effectively (🔍, 🛠️, 📦, ✨, etc.)
- Keep badges minimal (3-4 max, flat-square style)
- Use tables for structured data
- Code blocks with proper syntax highlighting
- Keep it concise - LLMs should be able to review it easily

## Reference Example

See: https://github.com/Immac/pi-extension-builder for the web-search extension README style.

## Important Notes

- This is LLM-driven: use your understanding of the code, don't just fill templates
- Adapt the structure based on extension type and complexity
- For simple extensions, README may be sufficient (skip ARCHITECTURE.md)
- Ensure badges match the actual tech stack and license
- Write documentation that helps LLMs understand and review the extension
