/**
 * Role-based access control utilities
 */

// Roles that can create/update/delete clients (must match backend RBAC)
export const CLIENT_WRITE_ROLES = ['ADMIN', 'MANAGER', 'MLO'];

/**
 * Check if user role has client write permissions
 */
export function canWriteClients(role: string | undefined): boolean {
  if (!role) return false;
  return CLIENT_WRITE_ROLES.includes(role.toUpperCase());
}

/**
 * Check if user role has client read-only permissions
 */
export function canReadClients(role: string | undefined): boolean {
  if (!role) return false;
  return canWriteClients(role) || ['PROCESSOR', 'UNDERWRITER', 'VIEWER'].includes(role.toUpperCase());
}
