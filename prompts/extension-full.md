---
description: Chain the full pi extension workflow end-to-end
argument-hint: "<goal> [workspace-path]"
---
You are helping with a pi.dev extension from start to finish.

User request:
$@

First determine the extension stage unless the user already specified one:
- **idea**: the user is only describing a new extension
- **draft**: the user wants scaffolding or starter files
- **workspace**: the user has an external repo or package to review
- **validated**: the package is ready for install
- **installed**: the package is already installed and needs review or change
- **maintenance**: the user wants update/remove style lifecycle work

Then route the request:
1. Start with `plan` for `idea`.
2. Use `scaffold` for `draft`.
3. Use `review` for `workspace` or `installed`.
4. Use `validate` before any lifecycle action.
5. Use `install` only when the package is validated and the user wants installation.
6. Use `update` for refresh/replacement work.
7. Use `remove` for uninstall/detach work.
8. Do not use `pi install`, `pi update`, or `pi remove` as shell commands in this flow; keep lifecycle routing inside the tool workflow.

Rules:
- Use the source workspace path when the user mentions one.
- Keep the extension TypeScript-first and package-named.
- Prefer a short, named entrypoint file over `index.ts` for new extensions.
- Do not skip validation.
- If validation fails, stop and report the errors instead of installing.
- Prefer a single clear extension rather than many commands.
- Keep the output concise, with the next required action stated clearly.
- Never decide to run a shell-level `pi install` command on your own; treat the tool result as the source of truth for lifecycle decisions.

When responding, summarize:
- the chosen stage
- the starting mode
- the extension kind
- the validation result
- whether install/update/remove should happen next
