import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { hasErrors, validateProject, validateTask, validateTaskList } from '@/lib/validation';

describe('validateProject', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns error when name is missing', () => {
    const errors = validateProject({ name: '', dueDate: '2026-07-01' });
    expect(errors.name).toBe('Name is required.');
  });

  it('returns error when name is whitespace only', () => {
    const errors = validateProject({ name: '   ', dueDate: '2026-07-01' });
    expect(errors.name).toBe('Name is required.');
  });

  it('returns error when dueDate is missing', () => {
    const errors = validateProject({ name: 'My Project', dueDate: '' });
    expect(errors.dueDate).toBe('Due date is required.');
  });

  it('returns error when dueDate is in the past', () => {
    const errors = validateProject({ name: 'My Project', dueDate: '2026-06-14' });
    expect(errors.dueDate).toBe('Due date must be today or later.');
  });

  it('accepts today as a valid dueDate', () => {
    const errors = validateProject({ name: 'My Project', dueDate: '2026-06-15' });
    expect(errors.dueDate).toBeUndefined();
  });

  it('returns no errors for valid input', () => {
    const errors = validateProject({ name: 'My Project', dueDate: '2026-07-01' });
    expect(errors).toEqual({});
  });
});

describe('validateTask', () => {
  it('returns error when name is missing', () => {
    const errors = validateTask({ name: '' });
    expect(errors.name).toBe('Name is required.');
  });

  it('returns error when name is whitespace only', () => {
    const errors = validateTask({ name: '  ' });
    expect(errors.name).toBe('Name is required.');
  });

  it('returns error when dueDate is before startDate', () => {
    const errors = validateTask({ name: 'Task', startDate: '2026-07-10', dueDate: '2026-07-05' });
    expect(errors.dueDate).toBe('Due date must be on or after start date.');
  });

  it('accepts same start and due date', () => {
    const errors = validateTask({ name: 'Task', startDate: '2026-07-10', dueDate: '2026-07-10' });
    expect(errors.dueDate).toBeUndefined();
  });

  it('returns no errors with valid name and no dates', () => {
    const errors = validateTask({ name: 'Task' });
    expect(errors).toEqual({});
  });

  it('returns no errors with valid name and valid date range', () => {
    const errors = validateTask({ name: 'Task', startDate: '2026-07-01', dueDate: '2026-07-15' });
    expect(errors).toEqual({});
  });
});

describe('validateTaskList', () => {
  it('returns error when name is missing', () => {
    const errors = validateTaskList({ name: '' });
    expect(errors.name).toBe('Name is required.');
  });

  it('returns error when name is whitespace only', () => {
    const errors = validateTaskList({ name: '   ' });
    expect(errors.name).toBe('Name is required.');
  });

  it('returns no errors for valid name', () => {
    const errors = validateTaskList({ name: 'Backlog' });
    expect(errors).toEqual({});
  });
});

describe('hasErrors', () => {
  it('returns false for an empty object', () => {
    expect(hasErrors({})).toBe(false);
  });

  it('returns false when all values are undefined', () => {
    expect(hasErrors({ name: undefined, dueDate: undefined })).toBe(false);
  });

  it('returns true when any value is a non-empty string', () => {
    expect(hasErrors({ name: 'Name is required.' })).toBe(true);
  });

  it('returns true when at least one of several values is set', () => {
    expect(hasErrors({ name: undefined, dueDate: 'Due date is required.' })).toBe(true);
  });
});
