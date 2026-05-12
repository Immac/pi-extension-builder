import { describe, it, expect } from 'vitest';
import { normalizeMode, normalizeStage, inferKindFromGoal, modeFromStage } from '../router';
import type { Stage } from '../router';

describe('normalizeMode', () => {
  it('returns the mode when a valid mode string is given', () => {
    const modes = ['plan', 'scaffold', 'review', 'document', 'validate', 'install', 'update', 'remove', 'enable', 'disable', 'list'] as const;
    for (const mode of modes) {
      expect(normalizeMode(mode, 'idea', undefined)).toBe(mode);
    }
  });

  it('handles mixed casing', () => {
    expect(normalizeMode('PLAN', 'idea', undefined)).toBe('plan');
    expect(normalizeMode('Validate', 'idea', undefined)).toBe('validate');
    expect(normalizeMode('ENABLE', 'idea', undefined)).toBe('enable');
    expect(normalizeMode('Disable', 'idea', undefined)).toBe('disable');
    expect(normalizeMode('List', 'idea', undefined)).toBe('list');
  });

  it('infers mode from stage when no mode given', () => {
    expect(normalizeMode(undefined, 'idea', undefined)).toBe('plan');
    expect(normalizeMode(undefined, 'draft', undefined)).toBe('scaffold');
    expect(normalizeMode(undefined, 'workspace', undefined)).toBe('review');
    expect(normalizeMode(undefined, 'validated', undefined)).toBe('install');
    expect(normalizeMode(undefined, 'installed', undefined)).toBe('review');
    expect(normalizeMode(undefined, 'maintenance', undefined)).toBe('update');
    expect(normalizeMode(undefined, 'unknown', undefined)).toBe('plan'); // falls through to default
  });

  it('infers document mode from goal keywords', () => {
    expect(normalizeMode(undefined, 'unknown', 'generate readme')).toBe('document');
    expect(normalizeMode(undefined, 'unknown', 'write documentation')).toBe('document');
    expect(normalizeMode(undefined, 'unknown', 'create docs')).toBe('document');
  });

  it('infers remove mode from goal keywords', () => {
    expect(normalizeMode(undefined, 'unknown', 'remove extension')).toBe('remove');
    expect(normalizeMode(undefined, 'unknown', 'uninstall package')).toBe('remove');
    expect(normalizeMode(undefined, 'unknown', 'delete extension')).toBe('remove');
  });

  it('infers enable mode from goal keywords', () => {
    expect(normalizeMode(undefined, 'unknown', 'enable my-ext')).toBe('enable');
    expect(normalizeMode(undefined, 'unknown', 'activate extension')).toBe('enable');
  });

  it('infers disable mode from goal keywords', () => {
    expect(normalizeMode(undefined, 'unknown', 'disable my-ext')).toBe('disable');
    expect(normalizeMode(undefined, 'unknown', 'deactivate extension')).toBe('disable');
  });

  it('infers list mode from goal keywords', () => {
    expect(normalizeMode(undefined, 'unknown', 'list extensions')).toBe('list');
    expect(normalizeMode(undefined, 'unknown', 'ls extensions')).toBe('list');
  });

  it('infers update mode from goal keywords', () => {
    expect(normalizeMode(undefined, 'unknown', 'update extension')).toBe('update');
    expect(normalizeMode(undefined, 'unknown', 'refresh package')).toBe('update');
    expect(normalizeMode(undefined, 'unknown', 'upgrade extension')).toBe('update');
  });

  it('infers validate mode from goal keywords', () => {
    expect(normalizeMode(undefined, 'unknown', 'validate extension')).toBe('validate');
    expect(normalizeMode(undefined, 'unknown', 'check package')).toBe('validate');
    expect(normalizeMode(undefined, 'unknown', 'lint source')).toBe('validate');
    expect(normalizeMode(undefined, 'unknown', 'type check')).toBe('validate');
  });

  it('infers review mode when path provided and no other hints', () => {
    expect(normalizeMode(undefined, 'unknown', undefined, '/some/path')).toBe('review');
  });

  it('defaults to plan when nothing matches', () => {
    expect(normalizeMode(undefined, 'unknown', undefined)).toBe('plan');
    expect(normalizeMode('', 'unknown', '')).toBe('plan');
  });
});

describe('normalizeStage', () => {
  it('returns the stage when a valid stage string is given', () => {
    const stages: Stage[] = ['idea', 'draft', 'workspace', 'validated', 'installed', 'maintenance', 'unknown'];
    for (const stage of stages) {
      expect(normalizeStage(stage, undefined)).toBe(stage);
    }
  });

  it('infers validated stage when goal mentions install', () => {
    expect(normalizeStage(undefined, 'install my extension')).toBe('validated');
  });

  it('infers installed stage when goal mentions update or refresh', () => {
    expect(normalizeStage(undefined, 'update extension')).toBe('installed');
    expect(normalizeStage(undefined, 'refresh extension')).toBe('installed');
  });

  it('infers installed stage when goal mentions remove', () => {
    expect(normalizeStage(undefined, 'remove extension')).toBe('installed');
    expect(normalizeStage(undefined, 'uninstall extension')).toBe('installed');
  });

  it('infers workspace stage when path is provided', () => {
    expect(normalizeStage(undefined, undefined, '/some/path')).toBe('workspace');
  });

  it('defaults to idea', () => {
    expect(normalizeStage(undefined, undefined)).toBe('idea');
  });
});

describe('modeFromStage', () => {
  it('maps each stage to the expected mode', () => {
    expect(modeFromStage('idea')).toBe('plan');
    expect(modeFromStage('draft')).toBe('scaffold');
    expect(modeFromStage('workspace')).toBe('review');
    expect(modeFromStage('validated')).toBe('install');
    expect(modeFromStage('installed')).toBe('review');
    expect(modeFromStage('maintenance')).toBe('update');
    expect(modeFromStage('unknown')).toBeUndefined();
  });
});

describe('inferKindFromGoal', () => {
  it('returns undefined for empty goal', () => {
    expect(inferKindFromGoal(undefined)).toBeUndefined();
    expect(inferKindFromGoal('')).toBeUndefined();
  });

  it('identifies prompt extensions', () => {
    expect(inferKindFromGoal('create a prompt extension')).toBe('prompt/system-prompt extension');
  });

  it('identifies provider extensions', () => {
    expect(inferKindFromGoal('build a provider extension')).toBe('provider extension');
  });

  it('identifies tool extensions', () => {
    expect(inferKindFromGoal('make a tool extension')).toBe('tool extension');
  });

  it('identifies command extensions', () => {
    expect(inferKindFromGoal('a command extension')).toBe('command extension');
  });

  it('identifies UI extensions', () => {
    expect(inferKindFromGoal('ui extension')).toBe('ui extension');
  });

  it('identifies session/state extensions', () => {
    expect(inferKindFromGoal('session extension')).toBe('session/state extension');
    expect(inferKindFromGoal('state management')).toBe('session/state extension');
  });

  it('identifies resource extensions', () => {
    expect(inferKindFromGoal('resource extension')).toBe('resource-discovery extension');
  });

  it('identifies notification extensions', () => {
    expect(inferKindFromGoal('sound extension')).toBe('notification/sound extension');
    expect(inferKindFromGoal('notify users')).toBe('notification/sound extension');
    expect(inferKindFromGoal('alert extension')).toBe('notification/sound extension');
  });

  it('returns undefined for unrecognized goals', () => {
    expect(inferKindFromGoal('something completely different')).toBeUndefined();
  });
});
