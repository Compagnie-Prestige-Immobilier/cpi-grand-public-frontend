import { createContext, useContext } from 'react';
import type { Permission, UserRole } from './permissions';

interface PermissionContextValue {
  role: UserRole | null;
  permissions: Permission[];
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: UserRole) => boolean;
}

const PermissionContext = createContext<PermissionContextValue>({
  role: null,
  permissions: [],
  hasPermission: () => false,
  hasRole: () => false,
});

export function PermissionProvider({ children, role, permissions }: {
  children: React.ReactNode;
  role: UserRole | null;
  permissions: Permission[];
}) {
  const hasPermission = (permission: Permission) => permissions.includes(permission);
  const hasRole = (r: UserRole) => role === r;

  return (
    <PermissionContext.Provider value={{ role, permissions, hasPermission, hasRole }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermission(): PermissionContextValue {
  return useContext(PermissionContext);
}
