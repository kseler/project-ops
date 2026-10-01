export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export function validateProject(data: { name?: string; dueDate?: string }) {
  const errors: FieldErrors<typeof data> = {};
  if (!data.name?.trim()) errors.name = 'Name is required.';
  if (!data.dueDate) {
    errors.dueDate = 'Due date is required.';
  } else if (data.dueDate < new Date().toISOString().slice(0, 10)) {
    errors.dueDate = 'Due date must be today or later.';
  }
  return errors;
}

export function validateTask(data: { name?: string; startDate?: string; dueDate?: string }) {
  const errors: FieldErrors<typeof data> = {};
  if (!data.name?.trim()) errors.name = 'Name is required.';
  if (data.startDate && data.dueDate && data.dueDate < data.startDate) {
    errors.dueDate = 'Due date must be on or after start date.';
  }
  return errors;
}

export function validateTaskList(data: { name?: string }) {
  const errors: FieldErrors<typeof data> = {};
  if (!data.name?.trim()) errors.name = 'Name is required.';
  return errors;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}
