# Architecture — Pi Extension Creator

## Purpose

The pi-extension-creator manages the full lifecycle of pi.dev extensions: planning, scaffolding, validation, installation, enable/disable, documentation generation, and removal. It replaces ad-hoc extension management with a scope-aware vault system, a JSON registry, and a harness adapter pattern that keeps the core agnostic of the target AI coding tool.

## System Components

```
┌────────────────────────────────────────────────────────┐
│                    CLI (cli.ts)                         │
│  Accepts commands: validate | install | enable |       │
│    disable | uninstall | list | bootstrap              │
└──────────┬─────────────────────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────────────────────┐
│                Pi Tool (extension.ts)                   │
│  Registers `extension_creator` tool + reload           │
│  notification (session_start, turn_start)              │
└──────────┬─────────────────────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────────────────────┐
│                  Installer (installer.ts)               │
│  Thin wrappers: installExtension, enableExtension,     │
│  disableExtension, uninstallExtension, listExtensions  │
│  Delegates to ExtensionManager + PiHarnessAdapter      │
└──────────┬─────────────────────────────────────────────┘
           │
     ┌─────┴──────────────────┐
     ▼                        ▼
┌──────────────┐   ┌──────────────────────┐
│ ExtensionMgr │   │   PiHarnessAdapter   │
│ (manager.ts) │   │    (pi-adapter.ts)   │
│              │   │                      │
│ • Vault I/O  │   │ • Reads/writes pi's  │
│ • Registry   │   │   settings.json      │
│ • Timestamps │   │   packages[] array   │
│ • Harness-   │   │ • Scope-aware path   │
│   agnostic   │   │   resolution         │
└──────┬───────┘   └──────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────┐
│               Supporting Modules                        │
│                                                         │
│ validator.ts  — Checks package.json, tsconfig,          │
│                 entrypoint, runs tsc --noEmit           │
│                                                         │
│ router.ts     — Normalizes mode/stage from user input   │
│                                                         │
│ renderer.ts   — Formats tool response payloads          │
│                                                         │
│ planner.ts    — Builds extension creation plans         │
│                                                         │
│ documenter.ts — Generates README.md/ARCHITECTURE.md     │
│                                                         │
│ types.ts      — Shared type definitions                 │
└────────────────────────────────────────────────────────┘
```

## Key Principles

1. **Harness-agnostic core** — `ExtensionManager` has no dependency on pi. It manages vaults and registries. Harness-specific behavior (e.g., updating pi's `settings.json`) lives in a pluggable `HarnessAdapter`.

2. **Scope isolation** — User and project scopes have separate vault roots and registries. Project vaults are portable (relative to the project directory).

3. **Registry as source of truth** — `registry.json` tracks every extension with its name, source, vault path, scope, enabled state, and timestamps. The harness adapter reflects the registry state into the target tool's config.

4. **Timestamp-based change detection** — Every mutation bumps `lastModified` in the registry. The extension checks this on `session_start` and `turn_start` to detect cross-session changes without a background watcher.

## Key Data Structures

### Vault layout

```
~/.extension-manager/                    # User vault root
  registry.json                          # User scope registry
  extensions/
    my-ext/                              # Installed extension files
      package.json
      dist/...
      src/...

<project>/.extension-manager/            # Project vault root
  registry.json                          # Project scope registry
  extensions/
    my-ext/...
```

### Registry format

```json
{
  "version": 1,
  "lastModified": 1700000000000,
  "extensions": [
    {
      "name": "my-ext",
      "source": "/home/user/dev/my-ext",
      "vaultPath": "/home/user/.extension-manager/extensions/my-ext",
      "scope": "user",
      "enabled": true,
      "installedAt": 1700000000000,
      "lastModified": 1700000000000
    }
  ]
}
```

## Interaction Flows

### Install flow

```
1. User calls: install ./path --scope user
2. CLI/tool calls installExtension({ sourcePath, scope, projectDir })
3. installExtension creates ExtensionManager with PiHarnessAdapter
4. ExtensionManager.install():
   a. Derives name from package.json (or basename)
   b. Copies source → <vault>/extensions/<name> (excluding .pi dirs)
   c. Creates/updates registry entry with enabled=true
   d. Bumps lastModified
   e. Calls PiHarnessAdapter.onEnable(entry)
5. PiHarnessAdapter.onEnable():
   a. Reads ~/.pi/agent/settings.json
   b. Adds vaultPath to packages[] array (deduped)
   c. Writes settings.json
```

### Enable/disable flow

```
1. User calls: enable my-ext --scope user
2. ExtensionManager.enable():
   a. Finds entry in registry
   b. Sets enabled=true, bumps lastModified
   c. Calls PiHarnessAdapter.onEnable(entry)
3. PiHarnessAdapter adds vaultPath to packages[]
```

### Cross-session reload notification

```
Session A:  extension installed via tool
            → registry.lastModified bumped to T2

Session B:  user types next message
            → turn_start fires
            → checkReloadNeeded() compares registry.lastModified
              against known timestamp (T1)
            → T2 > T1 → sets footer:
              "⚠️ Extensions changed (user) — /reload to apply"

Session B:  user runs /reload
            → session_start fires
            → markTimestamps() updates known timestamp to T2
            → footer clears
```

## File Inventory

| File | Role |
|---|---|
| `src/cli.ts` | CLI entry point (`pi-extension-creator` command) |
| `src/extension.ts` | Pi extension entry point (registers tool + events) |
| `src/manager.ts` | Core `ExtensionManager` class |
| `src/pi-adapter.ts` | `PiHarnessAdapter` — bridges to pi settings |
| `src/installer.ts` | Convenience wrappers for common operations |
| `src/validator.ts` | Package validation (manifest, tsconfig, compiler) |
| `src/router.ts` | Mode/stage normalization |
| `src/renderer.ts` | Tool response formatting |
| `src/planner.ts` | Extension creation plans |
| `src/documenter.ts` | Documentation generation |
| `src/types.ts` | Shared type definitions |
| `prompts/` | Prompt templates (create-extension, documentation, init) |
| `skills/` | pi skills for use-extension-creator-install, zero-to-documented |
