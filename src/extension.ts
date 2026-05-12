import fs from 'node:fs';
import path from 'node:path';
import { Type } from '@mariozechner/pi-ai';
import os from 'node:os';
import { defineTool, type ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { validateExtensionProject } from './validator';
import { runDeterministicInstall, installExtension, uninstallExtension, enableExtension, disableExtension } from './installer';
import type { ValidationResult, Scope } from './types';
import { ExtensionManager } from './manager';

import { normalizeMode, normalizeStage, inferKindFromGoal, type Mode, type Stage } from './router';
import { buildPlan } from './planner';
import { chooseNextAction, renderPayload, type ToolPayload, type DocumentationGuidance } from './renderer';
import { generateDocumentation } from './documenter';

interface ToolParams {
  mode?: string;
  stage?: string;
  goal?: string;
  extensionKind?: string;
  path?: string;
  sourcePath?: string;
  installTarget?: string;
  scope?: string;
  name?: string;
  strict?: boolean;
  note?: string;
}

// ── Reload notification state ─────────────────────────────────────────

const KNOWN_TIMESTAMPS: Record<string, number> = {
  user: 0,
  project: 0,
};

function parseScope(raw?: string): Scope {
  if (raw === 'project' || raw === 'user') return raw;
  return 'user';
}

function buildReloadStatusId(name: string): string {
  return `ext-creator-${name}`;
}

function checkReloadNeeded(ctx: any): void {
  try {
    const manager = new ExtensionManager({ projectDir: ctx.cwd });
    for (const scope of ['user', 'project'] as Scope[]) {
      if (manager.checkModified(scope, KNOWN_TIMESTAMPS[scope])) {
        const statusId = buildReloadStatusId(scope);
        ctx.ui?.setStatus?.(statusId, `⚠️ Extensions changed (${scope}) — /reload to apply`);
      }
    }
  } catch {
    // fail silently — non-critical
  }
}

function markTimestamps(ctx: any): void {
  try {
    const manager = new ExtensionManager({ projectDir: ctx.cwd });
    for (const scope of ['user', 'project'] as Scope[]) {
      KNOWN_TIMESTAMPS[scope] = manager.lastModified(scope);
      const statusId = buildReloadStatusId(scope);
      ctx.ui?.setStatus?.(statusId, undefined); // clear the status
    }
  } catch {
    // fail silently
  }
}

// ── Tool definition ───────────────────────────────────────────────────

const validLifecycleModes = ['plan', 'scaffold', 'review', 'document', 'validate',
  'install', 'update', 'remove', 'enable', 'disable', 'list'] as const;

const extensionCreatorTool = defineTool({
  name: 'extension_creator',
  label: 'extension-creator',
  description: 'Plan, scaffold, review, validate, and route pi extension lifecycle actions.',
  parameters: Type.Object({
    mode: Type.Optional(
      Type.String({
        description: validLifecycleModes.join(' | '),
      }),
    ),
    stage: Type.Optional(
      Type.String({
        description: 'idea | draft | workspace | validated | installed | maintenance | unknown',
      }),
    ),
    goal: Type.Optional(Type.String({ description: 'What the user wants the extension to do.' })),
    extensionKind: Type.Optional(Type.String({ description: 'The extension style, such as tool, command, prompt, or provider.' })),
    path: Type.Optional(Type.String({ description: 'Path to an external workspace or extension package.' })),
    sourcePath: Type.Optional(Type.String({ description: 'Source path (alias for path).' })),
    installTarget: Type.Optional(Type.String({ description: 'Optional install target or discovery preference.' })),
    scope: Type.Optional(Type.String({ description: 'Scope: "user" (default) or "project".' })),
    name: Type.Optional(Type.String({ description: 'Extension name for enable/disable/remove/list operations.' })),
    strict: Type.Optional(Type.Boolean({ description: 'Prefer stricter cleanup and validation guidance.' })),
    note: Type.Optional(Type.String({ description: 'Additional instruction or context.' })),
  }),
  async execute(_toolCallId: string, params: ToolParams, signal: any, _onUpdate: any, ctx: any) {
    const goal = params.goal?.trim();
    const stage = normalizeStage(params.stage, goal, params.path);
    const mode = normalizeMode(params.mode, stage, goal, params.path) as Mode;
    const strict = Boolean(params.strict);
    const extensionKind = params.extensionKind?.trim() || inferKindFromGoal(goal) || 'tool extension';
    const sourcePath = params.sourcePath?.trim() || params.path?.trim();
    const installTarget = params.installTarget?.trim();
    const scope = parseScope(params.scope || installTarget);
    const note = params.note?.trim();
    const projectDir = ctx.cwd as string;

    // ── Validation ────────────────────────────────────────────────
    let validation: ValidationResult | undefined;
    if ((mode === 'validate' || mode === 'review' || mode === 'install' || mode === 'update') && sourcePath) {
      validation = await validateExtensionProject(sourcePath);
    }

    // ── Plan / scaffold ───────────────────────────────────────────
    const plan = mode === 'plan' || mode === 'scaffold'
      ? buildPlan({ goal, extensionKind, strict, note })
      : undefined;

    // ── Install ───────────────────────────────────────────────────
    const installResult = mode === 'install' && sourcePath
      ? runDeterministicInstall({ sourcePath, validation, scope })
      : undefined;

    if (installResult?.success) {
      ctx.ui?.notify?.(`Extension installed (${scope} scope). Extensions changed — /reload to apply`, 'info');
    }

    // ── Enable / Disable / Remove (uninstall) via manager ─────────
    let mgrResult: any = undefined;
    const extName = params.name?.trim() || (sourcePath ? path.basename(sourcePath) : goal?.trim());

    if (mode === 'enable' && extName) {
      mgrResult = enableExtension({ name: extName, scope, projectDir });
      if (mgrResult.success) ctx.ui?.notify?.(`Enabled ${extName} (${scope}) — /reload to apply`, 'info');
    }
    if (mode === 'disable' && extName) {
      mgrResult = disableExtension({ name: extName, scope, projectDir });
      if (mgrResult.success) ctx.ui?.notify?.(`Disabled ${extName} (${scope}) — /reload to apply`, 'info');
    }
    if ((mode === 'remove') && extName) {
      mgrResult = uninstallExtension({ name: extName, scope, projectDir });
      if (mgrResult.success) ctx.ui?.notify?.(`Uninstalled ${extName} (${scope}) — /reload to apply`, 'info');
    }

    // ── List ──────────────────────────────────────────────────────
    let listEntries: any[] | undefined;
    if (mode === 'list') {
      const mgr = new ExtensionManager({ projectDir });
      listEntries = mgr.list(scope);
      const enabled = listEntries.filter(e => e.enabled).length;
      ctx.ui?.notify?.(`${listEntries.length} extensions (${enabled} enabled, ${scope} scope)`, 'info');
    }

    // ── Documentation ─────────────────────────────────────────────
    let documentation: DocumentationGuidance | undefined;
    if (mode === 'document' && sourcePath) {
      try {
        const generated = await generateDocumentation(sourcePath);
        documentation = {
          title: `Documentation for ${extensionKind}`,
          instruction: 'Generated by analyzing the extension source code.',
          promptTemplate: 'prompts/documentation.md',
          outputFiles: generated.filesWritten,
          steps: [
            `Wrote ${generated.filesWritten.join(', ')} to ${sourcePath}`,
            ...generated.filesWritten.map(f => `- ${f}: generated`),
          ],
        };

        const readmePath = path.join(sourcePath, 'README.md');
        fs.writeFileSync(readmePath, generated.readme);

        if (generated.architecture) {
          const archPath = path.join(sourcePath, 'ARCHITECTURE.md');
          fs.writeFileSync(archPath, generated.architecture);
        }
      } catch (error) {
        documentation = {
          title: `Documentation for ${extensionKind}`,
          instruction: `Failed to generate documentation: ${error instanceof Error ? error.message : String(error)}`,
          promptTemplate: 'prompts/documentation.md',
          outputFiles: [],
          steps: ['Fix the error and re-run document mode.'],
        };
      }
    }

    // ── Build payload ─────────────────────────────────────────────
    const payload: ToolPayload = {
      mode,
      stage,
      startMode: mode,
      goal,
      extensionKind,
      sourcePath,
      installTarget: installTarget || scope,
      strict,
      note,
      validation,
      installResult,
      plan,
      documentation,
      nextAction: chooseNextAction({ mode, stage, sourcePath, validation, installResult, startMode: mode }),
    };

    if (!sourcePath && ['validate', 'review', 'install', 'update', 'remove'].includes(mode)) {
      payload.nextAction = 'Provide a source workspace path so pi can target the package source.';
    }

    // ── Inject mgr result / list into response ───────────────────
    const extraDetails: Record<string, any> = {};
    if (mgrResult) extraDetails.managerResult = mgrResult;
    if (listEntries) extraDetails.extensions = listEntries;

    ctx.ui?.notify?.('extension-creator tool completed', 'info');

    return {
      content: [{ type: 'text', text: renderPayload(payload) }],
      details: { ...payload, ...extraDetails },
    };
  },
});

// ── Optional file watcher (disabled by default) ─────────────────────
// Enable with: EXT_MANAGER_WATCH=1 or register the flag

let watchCleanup: (() => void) | null = null;

function startWatcherIfEnabled(pi: ExtensionAPI, ctx: any): void {
  if (watchCleanup) return; // already watching

  const enabled = process.env.EXT_MANAGER_WATCH === '1';
  if (!enabled) return;

  try {
    const manager = new ExtensionManager({ projectDir: ctx.cwd });
    const watchPaths: string[] = [];

    for (const scope of ['user', 'project'] as Scope[]) {
      try {
        const rp = path.join(
          scope === 'user'
            ? path.join(os.homedir(), '.extension-manager')
            : path.join(ctx.cwd, '.extension-manager'),
          'registry.json',
        );
        if (fs.existsSync(rp) || fs.existsSync(path.dirname(rp))) {
          watchPaths.push(path.dirname(rp));
        }
      } catch {
        // skip unobtainable paths
      }
    }

    if (watchPaths.length === 0) return;

    const watchers: fs.FSWatcher[] = [];
    for (const dir of watchPaths) {
      try {
        const watcher = fs.watch(dir, (eventType, filename) => {
          if (filename === 'registry.json' && eventType === 'change') {
            checkReloadNeeded(ctx);
          }
        });
        watchers.push(watcher);
      } catch {
        // skip unwatchable dirs
      }
    }

    watchCleanup = () => {
      for (const w of watchers) w.close();
      watchCleanup = null;
    };

    // Clean up on shutdown
    pi.on('session_shutdown', () => {
      watchCleanup?.();
    });
  } catch {
    // fail silently
  }
}

// ── Extension factory ────────────────────────────────────────────────

export default function extensionCreator(pi: ExtensionAPI) {
  pi.registerTool(extensionCreatorTool);

  // On session start: check if registry was modified since we last saw it
  pi.on('session_start', async (_event, ctx) => {
    // Clear timestamps on /reload so stale warnings disappear
    checkReloadNeeded(ctx);
    markTimestamps(ctx);
    // Optionally start file watcher (disabled by default)
    startWatcherIfEnabled(pi, ctx);
  });

  // On every turn: catch cross-session changes made while this session is idle
  pi.on('turn_start', async (_event, ctx) => {
    checkReloadNeeded(ctx);
  });
}
