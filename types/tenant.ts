/**
 * Contract for a single (tenant × env) configuration.
 * Loaded from tenants/{name}.{env}.json by fixtures/tenant.ts.
 */
export interface TenantConfig {
  name: string;
  env: 'local' | 'staging' | 'prod';

  /**
   * Base URL for PHP-served touchpoints (admin, pos, dashboard, scanner).
   * For all tenants this points at the SquareMaze PHP infrastructure.
   */
  baseUrl: string;

  /**
   * Customer-facing web URL. For Smarty tenants this equals baseUrl.
   * For headless tenants (antoine, virgin) this points at their external React app.
   */
  webUrl: string;

  currency: string;
  locale: string;

  users: TenantUsers;
  db: TenantDb;
}

export interface TenantUsers {
  superadmin:   UserCreds;
  cashier?:     UserCreds;
  scanner?:     UserCreds;
  organizer?:   UserCreds;
  testCustomer?: UserCreds;
}

export interface UserCreds {
  username: string;
  password: string;
}

export interface TenantDb {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * Derived touchpoint URLs — computed from baseUrl + known paths.
 * Framework code should use these instead of hand-concatenating paths.
 */
export function touchpointUrls(tenant: TenantConfig) {
  return {
    admin:     `${tenant.baseUrl}/admin/`,
    pos:       `${tenant.baseUrl}/pos`,
    dashboard: `${tenant.baseUrl}/dashboard`,
    scanner:   `${tenant.baseUrl}/scan`,
    web:       tenant.webUrl,
  };
}
