export interface SsomaRequestUser {
  userId: number;
  email: string;
  /** Resolved from assigned UserType.permissions by the global PermissionsGuard. */
  permissions: readonly string[];
}
