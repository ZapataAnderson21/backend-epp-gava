export interface SsomaRequestUser {
  userId: number;
  email: string;
}

export interface SsomaRequestContext {
  user: SsomaRequestUser;
  /** Resolved from assigned UserType.permissions by the global PermissionsGuard. */
  permissions: readonly string[];
}
