# Changelog

## [0.2.1] — 2026-05-10

### Changed
- **`.pi` directories now excluded during install**: `copyDirExcludingPi()` replaces `fs.cpSync()` to prevent copying the agent's own `.pi` configuration directory into the installed extension at `~/.pi-extensions/<name>`.

---

## [0.2.0] — 2026-05-09

### Added
- **8-module architecture**: Split monolithic `extension.ts` (~400 lines) into `router.ts`, `planner.ts`, `renderer.ts`, `documenter.ts` — entrypoint now ~100 lines.
- **Real documentation generator** (`documenter.ts`): Analyzes source code and generates README.md and ARCHITECTURE.md automatically.
- **41-test suite**: Vitest with 10 validator tests, 5 installer tests, 26 router tests.
- **Pre-commit hook**: `simple-git-hooks` runs `tsc --noEmit && vitest run` on every commit.
- **CLI improvements**: `--help`, `--version`, `--verbose` flags. Unknown command detection with suggestions.
- **Batch diagnostics**: Validator now collects all errors before returning (no early exits).
- **Error logging**: `cleanupSettingsJson` now logs errors via `console.warn` instead of silently swallowing.
- **`@types/node@20`**: Removed fragile Node.js shims, replaced with proper type declarations.

### Changed
- `pi.extensions` in `package.json` now points directly to `./src/extension` (removed intermediate `extensions/` directory and `src/extensions/` indirection).
- `installer.ts` uses `fs.cpSync()` instead of custom recursive `copyDirectory()`.
- `router.ts` fixed "uninstall" word-matching bug (checked before "install" to avoid false match).
- `.gitignore` no longer ignores `src/__tests__/` directory.

### Removed
- Duplicate `extensions/extension-creator/index.ts` (root level) and `src/extensions/extension-creator/index.ts` — both were re-exports of `src/extension.ts`.
- Node.js built-in type shims from `shims.d.ts` (replaced by `@types/node`).
- Custom `copyDirectory()` function (replaced by `fs.cpSync()`).

### Fixed
- Validator no longer returns early on first error — reports all diagnostics in one pass.
- "uninstall" goal now correctly routes to `installed` stage instead of `validated`.
- `cleanupSettingsJson` errors are now logged instead of silently caught.

---

## [0.1.0] — Initial Release

- Basic extension lifecycle tool (plan, scaffold, review, validate, install, update, remove)
- Deterministic file-copy install to `~/.pi-extensions/<name>`
- CLI with validate and bootstrap commands
- Prompt templates for LLM guidance
- Skills for specialized workflows
- TypeScript compiler validation integration
- Package manifest validation (kebab-case, entrypoint, tsconfig)
- Import dependency scanning
