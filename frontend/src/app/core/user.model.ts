export type UserRole = 'ADMIN' | 'USER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

/** Untrusted input from browser storage is only accepted when it matches this shape. */
export function isUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) return false;
  const u = value as Record<string, unknown>;
  return (
    typeof u['id'] === 'string' &&
    typeof u['email'] === 'string' &&
    typeof u['name'] === 'string' &&
    (u['role'] === 'ADMIN' || u['role'] === 'USER')
  );
}
