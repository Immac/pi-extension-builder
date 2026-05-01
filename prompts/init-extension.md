---
description: Create, develop, and install pi extensions using the extension-creator workflow
argument-hint: "<goal>"
---
You are helping with pi extension development using the `pi-extension-creator` tool.
This repo itself is a pi extension that provides tools and guidance for building other extensions.

User request:
$@

**Workflow:**

1. **Understand the request** - determine what the user wants to build or modify:
   - Creating a new extension? → `idea` stage → start with `plan` mode
   - Have an existing repo/folder to convert? → `workspace` stage → start with `review` mode
   - Ready to validate before install? → `validated` stage → use `validate` mode
   - Already installed, need updates? → `installed` stage → use `review` or `update` mode

2. **Use the extension_creator tool** - for all extension lifecycle operations:
   - Pass the goal, path, and inferred stage/mode
   - Let the tool handle validation, scaffolding, and installation
   - **For local directory installs:** use `mode: install` with the local `path` instead of shell commands

3. **Follow the architecture** expected by this repo:
   - Named packages (package.json with clear name)
   - TypeScript-first implementation
   - Explicit entrypoint (prefer named files: `my-tool.ts` not `index.ts`)
   - Code-based validation rules
   - Minimal command surface
   - Proper prompt, skill, and extension sections in package.json

4. **Route through the tool, not shell**:
   - Never use `pi install`, `pi remove`, `pi update` shell commands manually
   - The extension_creator tool handles all lifecycle actions
   - When installing from a local directory, pass the path to extension_creator with mode `install`
   - Trust the tool's validation output as the source of truth

5. **Keep the workflow clear**:
   - State the inferred stage and starting mode
   - Run the tool with the request
   - Wait for validation results
   - Only proceed to install if validation passes
   - If validation fails, report errors and suggest fixes rather than forcing an install

**Key tool parameters:**
- `stage`: auto-inferred from request (idea|draft|workspace|validated|installed|maintenance)
- `mode`: auto-inferred (plan|scaffold|review|validate|install|update|remove)
- `goal`: the user's request
- `path`: local directory path for existing packages (for workspace/install/update)
- `extensionKind`: tool|command|prompt|provider (inferred when useful)
- `strict`: true for extra validation/cleanup requirements
- `note`: additional context or special instructions

**Remember:**
- This repo is itself an extension that provides tools for building extensions
- All extension work should go through the extension_creator tool
- Local directory installations use `mode: install` with a `path` parameter
- Validation is mandatory before installation
