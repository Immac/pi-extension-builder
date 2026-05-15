import { describe, it, expect } from 'vitest';
import { buildPlan } from '../planner';

describe('buildPlan', () => {
  it('returns a plan with title, summary, files, steps, and cautions', () => {
    const plan = buildPlan({ goal: 'Create a test tool', extensionKind: 'tool', strict: false });
    expect(plan.title).toBe('Plan for tool');
    expect(plan.summary).toContain('Create a test tool');
    expect(plan.files.length).toBeGreaterThan(0);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.cautions.length).toBeGreaterThan(0);
  });

  it('includes strict-mode caution when strict is true', () => {
    const strict = buildPlan({ goal: 'Test', extensionKind: 'command', strict: true });
    const notStrict = buildPlan({ goal: 'Test', extensionKind: 'command', strict: false });
    expect(strict.cautions.some(c => c.includes('single concern'))).toBe(true);
    expect(notStrict.cautions.some(c => c.includes('single concern'))).toBe(false);
  });

  it('appends note to cautions when provided', () => {
    const plan = buildPlan({ goal: 'Test', extensionKind: 'prompt', strict: false, note: 'This is a custom note' });
    expect(plan.cautions.some(c => c.includes('This is a custom note'))).toBe(true);
  });

  it('works without a goal', () => {
    const plan = buildPlan({ extensionKind: 'tool', strict: false });
    expect(plan.title).toBe('Plan for tool');
    expect(plan.summary).toContain('single clear responsibility');
  });

  it('includes named entrypoint recommendation in steps', () => {
    const plan = buildPlan({ extensionKind: 'tool', strict: false });
    expect(plan.steps.some(s => s.includes('matches the extension name'))).toBe(true);
  });
});
