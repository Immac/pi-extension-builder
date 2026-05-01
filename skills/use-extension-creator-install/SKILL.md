---
name: use-extension-creator-install
description: Always use the extension_creator tool for installing pi extensions to ~/.pi-extensions/<name>
---

# Use extension_creator for Installation

When a user asks to install a pi extension (from local path, git repo, or any source), ALWAYS use the `extension_creator` tool. This tool performs a deterministic file copy to `~/.pi-extensions/<extension-name>`.

## Why This Skill Exists

- The `extension_creator` tool provides proper validation before installation
- It performs deterministic copying to `~/.pi-extensions/<name>` (not a suggestion)
- It ensures extensions meet pi's quality and security standards
- It provides better error messages and troubleshooting guidance

## Installation Workflow

### When User Asks to Install

Whenever a user says something like:
- "install this extension"
- "add this extension"
- "install from ./path"
- "install my extension"
- "pip install ..." (if referring to pi extensions)

### Step 1: Use extension_creator Tool

Call the `extension_creator` tool with:
```
mode: "install"
path: "<path to extension source>"
```

**Note:** If the user didn't provide a path, ask them for the extension path or workspace location.

### Step 2: Handle the Response

The tool response will indicate:
- `installResult.success: true`: Extension installed to `~/.pi-extensions/<name>`
- `installResult.success: false`: Installation failed with error message

### Step 3: Report Result

Always report the installation result to the user clearly.

## Important Rules

1. **NEVER run `pi install .`** - Always use the `extension_creator` tool
2. **NEVER use `pi add`** - Same, use the tool instead
3. **NEVER run `pi remove`** - Use `mode: "remove"` in the tool instead
4. **Extension replaces existing** - Installing the same name will replace the old version automatically

## Example

```
User: "Please install my extension at ./my-cool-extension"

Tool Call: extension_creator with mode: "install", path: "./my-cool-extension"

Result: "Installed my-cool-extension to ~/.pi-extensions/my-cool-extension"
```

## Deterministic Installation

The `extension_creator` tool performs a **deterministic file copy** to:
```
~/.pi-extensions/<extension-name>
```

This is not a suggestion - it is the actual installation location. The tool:
1. Validates the extension first (checks package.json, tsconfig, entrypoint)
2. Creates `~/.pi-extensions/` if needed
3. **Removes existing installation** if present (replaces with new version)
4. Copies the source files to the install path
5. Reports "(replaced existing)" in the success message

## Troubleshooting

If `extension_creator` install fails:
- Check the extension path exists
- Ensure the extension has a valid `package.json`
- Run `mode: "validate"` first to check for issues
- Run `mode: "review"` to ensure clean structure