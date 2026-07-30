import { usePermission } from './PermissionContext';
import type { Permission, UserRole } from './permissions';

interface CanProps {
  permission?: Permission;
  role?: UserRole;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Renders `children` only if the user has the specified permission or role.
 * Optionally renders `fallback` when the check fails.
 *
 * Usage:
 *   <Can permission="view-clients">
 *     <ClientList />
 *   </Can>
 *
 *   <Can role="super-admin" fallback={<span>Accès refusé</span>}>
 *     <AdminPanel />
 *   </Can>
 */
export function Can({ permission, role, fallback = null, children }: CanProps) {
  const { hasPermission, hasRole } = usePermission();

  if (permission && hasPermission(permission)) return <>{children}</>;
  if (role && hasRole(role)) return <>{children}</>;

  return <>{fallback}</>;
}
