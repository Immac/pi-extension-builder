---
description: Plan, scaffold, review, validate, install, update, or remove a pi extension
argument-hint: "<goal>"
---
You are using the `extension_creator` tool to help with a pi.dev extension.

User request:
$@

Instructions:
1. Prefer the tool-first workflow.
2. Infer the extension stage from the request unless the user already specified it:
   - `idea` for new ideas or high-level requests
   - `draft` for starter layouts
   - `workspace` for existing external packages
   - `validated` for install-ready packages
   - `installed` for already installed packages
   - `maintenance` for update/remove work
3. Choose the starting mode from the stage:
   - `plan` for `idea`
   - `scaffold` for `draft`
   - `review` for `workspace` or `installed`
   - `validate` before any lifecycle action
   - `install` only when the user wants installation and the package is validated
   - `update` for refresh/replacement work
   - `remove` for uninstall/detach work
4. Pass the request to the `extension_creator` tool.
5. If a path, repo, or folder is mentioned, use it as the source workspace.
6. For lifecycle actions, keep routing inside the tool workflow instead of running shell `pi install`/`pi remove` commands.
7. Keep the result concise and actionable.
8. Respect the architecture rules:
   - named package
   - explicit entrypoint
   - prefer a short, named entrypoint filename that matches the extension name
   - avoid `index.ts` for new extensions unless you are preserving a legacy layout
   - TypeScript-first
   - code-based validation
   - minimal command surface
9. If validation fails, report the errors and avoid suggesting a manual install.

Recommended tool fields:
- `stage`: inferred from the request
- `mode`: inferred from the request or stage
- `goal`: the user's request
- `extensionKind`: inferred from the request when useful
- `path`: the mentioned workspace path, if any
- `installTarget`: only if the request includes a target preference
- `strict`: true when the user wants extra cleanup or minimalism
