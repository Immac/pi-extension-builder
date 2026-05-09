# Contributing to pi-extension-creator

## Development Setup

```bash
git clone <repo-url>
cd pi-extension-creator
npm install     # Installs deps + sets up pre-commit hook
npm run build   # Compile TypeScript
npm test        # Run 41 tests
```

## Project Structure

```
src/
├── extension.ts       # Tool entrypoint
├── router.ts          # Mode/stage/kind inference
├── planner.ts         # Build plan generation
├── validator.ts       # Code-based validation engine
├── installer.ts       # Deterministic install to ~/.pi-extensions/
├── documenter.ts      # Automatic documentation generation
├── renderer.ts        # Payload rendering + next-action selection
├── cli.ts             # Standalone CLI
├── types.ts           # Shared interfaces
├── shims.d.ts         # Pi SDK type declarations
└── __tests__/         # Test suites
    ├── helpers.ts
    ├── validator.test.ts
    ├── installer.test.ts
    └── router.test.ts
```

## Before You Submit

1. **TypeScript compiles**: `npm run validate:src` (runs `tsc --noEmit`)
2. **All tests pass**: `npm test` (runs `vitest run`)
3. **Pre-commit hook is active**: `npm run precommit` runs both checks automatically

The pre-commit hook is installed by `simple-git-hooks` during `npm install`. It runs `tsc --noEmit && vitest run` before every commit.

## Adding Tests

Tests use **Vitest** and live in `src/__tests__/`.

Helper utilities are in `src/__tests__/helpers.ts`:
- `createTestPackage(overrides?)` — creates a temp directory with a test extension package

### Adding a new test file

```typescript
// src/__tests__/my-feature.test.ts
import { describe, it, expect } from 'vitest';
import { myFunction } from '../my-feature';

describe('myFunction', () => {
  it('does the thing', () => {
    expect(myFunction()).toBe('expected');
  });
});
```

### Running specific tests

```bash
npx vitest run src/__tests__/validator.test.ts   # Single file
npx vitest run --reporter=verbose                  # Full names
npx vitest --watch                                 # Watch mode
```

## Coding Standards

- **TypeScript strict mode** enabled in `tsconfig.json`
- **ES2022 target**, **Node16 module resolution**
- Prefer **arrow functions** for callbacks, **named functions** for exports
- **No `any`** unless absolutely necessary (pi SDK types use `any` in shims)
- Exports should be **named** (not default) except for the extension entrypoint
- Tests should be **deterministic** and use temp directories (not hardcoded paths)

## How the Modules Fit Together

```
extension.ts (tool entrypoint)
  │
  ├──→ router.ts:      Normalize mode/stage/kind from user input
  ├──→ planner.ts:     Build structured extension plans
  ├──→ validator.ts:   Run code-based checks (manifest + tsc)
  ├──→ installer.ts:   Copy validated package to ~/.pi-extensions/
  ├──→ documenter.ts:  Auto-generate README & ARCHITECTURE
  └──→ renderer.ts:    Format output and choose next action

cli.ts (standalone CLI) → shares validator.ts + installer.ts
```

## Common Tasks

### Adding a new validation check

1. Add the check logic in `validator.ts` (push to `errors[]` or `warnings[]`)
2. Add a test in `src/__tests__/validator.test.ts`
3. If it needs a new error code, prefix it appropriately (e.g., `manifest.*`, `entrypoint.*`, `tsconfig.*`, `compiler.*`)

### Adding a new mode

1. Add the mode string to `Mode` type in `router.ts`
2. Add inference logic in `normalizeMode()` in `router.ts`
3. Add handling in `extension.ts` `execute()` body
4. Add next-action logic in `renderer.ts` `chooseNextAction()`
5. Add tests in `src/__tests__/router.test.ts`

### Modifying the documentation generator

1. Edit `documenter.ts` (`generateReadme()` or `generateArchitecture()`)
2. The readme/architecture are generated as **strings** (templates inside the functions)
3. If you add a new detection (e.g., detecting a new extension type), update `detectExtensionKind()` and the detection helpers
