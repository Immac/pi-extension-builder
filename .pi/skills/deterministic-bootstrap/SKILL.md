---
name: deterministic-bootstrap
description: Bootstrap the extension-creator as a pi-discoverable extension via a single deterministic script
---

# Deterministic Bootstrap — extension-creator

Run the bootstrap script. It does everything — builds, self-installs into the vault, cleans stale directories, and verifies.

## Trigger

Run this when:
- The user says "bootstrap this repo"
- Fresh clone that needs first-time setup
- The installed version is stale (vault dist doesn't match src)
- After a `git pull` that updates source files

## Command

```bash
npm run bootstrap
```

Or directly:

```bash
bash scripts/bootstrap.sh
```

## What it does

1. **Clean** — `rm -rf dist/`
2. **Build** — `npm run build` (tsc)
3. **Self-install** — `node dist/cli.js bootstrap` → copies to `~/.extension-manager/extensions/pi-extension-creator/`, writes registry, syncs to pi's `settings.json`
4. **Stale cleanup** — removes `~/.pi-extensions/pi-extension-creator/` (pre-vault location)
5. **Verify** — checks vault exists, registry has exactly one enabled entry, settings.json points to vault, no stale directory

## Exit codes

- `0` — Bootstrap verified
- `1` — Build or validation failed
- `2` — Install failed (reserved)
- `3` — Verification failed

## Post-bootstrap

Tell the user to `/reload` in pi to activate.
