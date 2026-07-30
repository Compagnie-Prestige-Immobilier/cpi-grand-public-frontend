export const PERMISSIONS = {
  // Clients
  VIEW_CLIENTS: 'view-clients',
  CREATE_CLIENT: 'create-client',
  EDIT_CLIENT: 'edit-client',
  DELETE_CLIENT: 'delete-client',
  // Documents
  VIEW_DOCUMENTS: 'view-documents',
  VALIDATE_DOCUMENTS: 'validate-documents',
  MANAGE_DOCUMENTS: 'manage-documents',
  SIGN_DOCUMENTS: 'sign-documents',
  UPLOAD_DOCUMENTS: 'upload-documents',
  // CPI Docs
  VIEW_CPI_DOCS: 'view-cpi-docs',
  CREATE_CPI_DOCS: 'create-cpi-docs',
  PUBLISH_CPI_DOCS: 'publish-cpi-docs',
  ARCHIVE_CPI_DOCS: 'archive-cpi-docs',
  SIGN_CPI_DOCS: 'sign-cpi-docs',
  // Banks
  VIEW_BANKS: 'view-banks',
  CREATE_BANK: 'create-bank',
  EDIT_BANK: 'edit-bank',
  DELETE_BANK: 'delete-bank',
  ASSIGN_BANK: 'assign-bank',
  // Disbursements
  VIEW_DECAISSEMENTS: 'view-decaissements',
  MANAGE_DECAISSEMENTS: 'manage-decaissements',
  // Chantier
  VIEW_CHANTIER: 'view-chantier',
  MANAGE_CHANTIER: 'manage-chantier',
  // Notifications
  SEND_NOTIFICATIONS: 'send-notifications',
  VIEW_NOTIFICATIONS: 'view-notifications',
  // System
  MANAGE_STAFF: 'manage-staff',
  VIEW_STATS: 'view-stats',
  MANAGE_DEMO_DATA: 'manage-demo-data',
  // Own profile
  VIEW_OWN_PROFILE: 'view-own-profile',
  EDIT_OWN_PROFILE: 'edit-own-profile',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// NOTE: there is deliberately NO role→permission map in the frontend.
// The backend seeder (RoleAndPermissionSeeder) is the single source of truth;
// the frontend receives the RESOLVED permissions array from /auth/me at login.
// A hardcoded map here would silently drift from the backend.

/** The user's role and permissions come from the `/auth/me` API response. */
export type UserRole = 'super-admin' | 'agent-cpi' | 'client';
