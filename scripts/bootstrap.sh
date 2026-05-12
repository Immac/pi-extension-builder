#!/usr/bin/env bash
# ── Deterministic Bootstrap — extension-creator ────────────────────
# Idempotent self-install into the extension manager vault so pi
# auto-discovers this extension.
#
# Usage:
#   bash scripts/deterministic-bootstrap.sh
#
# Exit codes:
#   0  — Bootstrap verified: pi-extension-creator is active in vault
#   1  — Build/validation failed
#   2  — Install failed
#   3  — Verification failed
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HOME_DIR="$HOME"
VAULT_DIR="$HOME_DIR/.extension-manager/extensions/pi-extension-creator"
REGISTRY="$HOME_DIR/.extension-manager/registry.json"
SETTINGS="$HOME_DIR/.pi/agent/settings.json"
STALE_DIR="$HOME_DIR/.pi-extensions/pi-extension-creator"

cd "$PROJECT_DIR"

echo "═══ Deterministic Bootstrap ═══"
echo "Project : $PROJECT_DIR"
echo "Vault   : $VAULT_DIR"
echo ""

# ── Step 1: Clean ────────────────────────────────────────────────────
echo "▸ Step 1/5: Clean dist/"
npm run clean 2>/dev/null || true
echo "  ✓ dist/ removed"

# ── Step 2: Build ────────────────────────────────────────────────────
echo "▸ Step 2/5: Build TypeScript → dist/"
npm run build
echo "  ✓ dist/ built"

# ── Step 3: Validate + Self-install ──────────────────────────────────
echo "▸ Step 3/5: Validate + self-install (ExtensionManager)"
node dist/cli.js bootstrap
echo "  ✓ Bootstrap complete"

# ── Step 4: Remove stale old-style install ───────────────────────────
echo "▸ Step 4/5: Remove stale ~/.pi-extensions/ install"
if [ -d "$STALE_DIR" ]; then
  rm -rf "$STALE_DIR"
  echo "  ✓ Removed $STALE_DIR"
else
  echo "  ✓ No stale directory found"
fi

# ── Step 5: Verify ───────────────────────────────────────────────────
echo "▸ Step 5/5: Verify deterministic state"
ERRORS=0

# 5a: Vault exists
if [ -d "$VAULT_DIR" ]; then
  echo "  ✓ Vault exists: $VAULT_DIR"
else
  echo "  ✗ Vault missing: $VAULT_DIR"
  ERRORS=$((ERRORS + 1))
fi

# 5b: Registry has exactly one enabled entry for pi-extension-creator
python3 -c "
import json, sys
r = json.load(open('$REGISTRY'))
entries = [e for e in r['extensions'] if e['name'] == 'pi-extension-creator']
if len(entries) != 1:
    print(f'  ✗ Expected 1 registry entry, got {len(entries)}')
    sys.exit(1)
e = entries[0]
if not e['enabled']:
    print(f'  ✗ Extension not enabled')
    sys.exit(1)
if 'extension-manager' not in e['vaultPath']:
    print(f'  ✗ vaultPath not in extension-manager: {e[\"vaultPath\"]}')
    sys.exit(1)
print(f'  ✓ Registry: {e[\"name\"]} → {e[\"vaultPath\"]} (enabled={e[\"enabled\"]})')
" || ERRORS=$((ERRORS + 1))

# 5c: Settings.json points to vault path
python3 -c "
import json, sys
s = json.load(open('$SETTINGS'))
entries = [p for p in s['packages'] if 'pi-extension-creator' in p]
if len(entries) == 0:
    print(f'  ✗ No pi-extension-creator entry in packages')
    sys.exit(1)
if len(entries) > 1:
    print(f'  ⚠ {len(entries)} entries found (dedup expected): {entries}')
for e in entries:
    if 'extension-manager' not in e:
        print(f'  ✗ Entry not in vault: {e}')
        sys.exit(1)
print(f'  ✓ packages[] entry: {entries[-1]}')
" || ERRORS=$((ERRORS + 1))

# 5d: No stale directory
if [ -d "$STALE_DIR" ]; then
  echo "  ✗ Stale directory still exists: $STALE_DIR"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ No stale ~/.pi-extensions/pi-extension-creator"
fi

echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo "═══ Bootstrap verified: deterministic ✓ ═══"
  echo "Run /reload in pi to activate."
  exit 0
else
  echo "═══ Bootstrap FAILED: $ERRORS verification error(s) ═══"
  exit 3
fi
