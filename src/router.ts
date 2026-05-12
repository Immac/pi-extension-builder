export type Mode = 'plan' | 'scaffold' | 'review' | 'document' | 'validate' | 'install' | 'update' | 'remove' | 'enable' | 'disable' | 'list';
export type Stage = 'idea' | 'draft' | 'workspace' | 'validated' | 'installed' | 'maintenance' | 'unknown';

export function normalizeMode(value: string | undefined, stage: Stage, goal: string | undefined, path?: string): Mode {
  const candidate = value?.trim().toLowerCase();
  const coreModes = ['plan', 'scaffold', 'review', 'document', 'validate', 'install', 'update', 'remove', 'enable', 'disable', 'list'] as const;
  if (coreModes.includes(candidate as any)) {
    return candidate as Mode;
  }

  const stageMode = modeFromStage(stage);
  if (stageMode) {
    return stageMode;
  }

  const lowerGoal = goal?.toLowerCase() ?? '';
  if (lowerGoal.includes('document') || lowerGoal.includes('readme') || lowerGoal.includes('doc')) {
    return 'document';
  }
  if (lowerGoal.includes('uninstall') || lowerGoal.includes('delete')) {
    return 'remove';
  }
  if (lowerGoal.includes('disable') || lowerGoal.includes('deactivate')) {
    return 'disable';
  }
  if (lowerGoal.includes('enable') || lowerGoal.includes('activate')) {
    return 'enable';
  }
  if (lowerGoal.includes('list') || lowerGoal.includes('ls')) {
    return 'list';
  }
  if (lowerGoal.includes('remove')) {
    return 'remove';
  }
  if (lowerGoal.includes('update') || lowerGoal.includes('refresh') || lowerGoal.includes('upgrade')) {
    return 'update';
  }
  if (lowerGoal.includes('validate') || lowerGoal.includes('check') || lowerGoal.includes('lint') || lowerGoal.includes('type')) {
    return 'validate';
  }
  if (path) {
    return 'review';
  }
  return 'plan';
}

export function normalizeStage(stage: string | undefined, goal: string | undefined, path?: string): Stage {
  const candidate = stage?.trim().toLowerCase();
  if (candidate === 'idea' || candidate === 'draft' || candidate === 'workspace' || candidate === 'validated' || candidate === 'installed' || candidate === 'maintenance' || candidate === 'unknown') {
    return candidate;
  }

  const lowerGoal = goal?.toLowerCase() ?? '';
  if (lowerGoal.includes('uninstall')) return 'installed';
  if (lowerGoal.includes('install')) return 'validated';
  if (lowerGoal.includes('update') || lowerGoal.includes('refresh')) return 'installed';
  if (lowerGoal.includes('remove')) return 'installed';
  if (path) return 'workspace';
  return 'idea';
}

export function modeFromStage(stage: Stage): Mode | undefined {
  switch (stage) {
    case 'idea':
      return 'plan';
    case 'draft':
      return 'scaffold';
    case 'workspace':
      return 'review';
    case 'validated':
      return 'install';
    case 'installed':
      return 'review';
    case 'maintenance':
      return 'update';
    case 'unknown':
      return undefined;
  }
}

export function inferKindFromGoal(goal: string | undefined): string | undefined {
  if (!goal) {
    return undefined;
  }

  const lower = goal.toLowerCase();
  if (lower.includes('prompt')) return 'prompt/system-prompt extension';
  if (lower.includes('provider')) return 'provider extension';
  if (lower.includes('tool')) return 'tool extension';
  if (lower.includes('command')) return 'command extension';
  if (lower.includes('ui')) return 'ui extension';
  if (lower.includes('session') || lower.includes('state')) return 'session/state extension';
  if (lower.includes('resource')) return 'resource-discovery extension';
  if (lower.includes('sound') || lower.includes('notify') || lower.includes('alert')) return 'notification/sound extension';
  return undefined;
}
