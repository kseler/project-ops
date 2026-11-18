export const ROLES = {
  ADMIN: 'admin',
  USER: 'member',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  member: 'User',
};

export const isAdmin = (role: string | null | undefined) => role === ROLES.ADMIN;

export const roleLabel = (role: string | null | undefined) =>
  ROLE_LABELS[role as Role] ?? role ?? '';
