import type { TenantConfig, UserCreds } from '../types/tenant';

/**
 * Return the tenant's testCustomer credentials or throw with an env-var hint.
 * Every spec that logs in as a customer should route through this helper so a
 * missing config surfaces once, with a message that points at the fix.
 */
export function requireTestCustomer(tenant: TenantConfig): UserCreds {
  const creds = tenant.users.testCustomer;
  if (!creds) {
    const prefix = `${tenant.name.toUpperCase()}_${tenant.env.toUpperCase()}_TESTCUSTOMER`;
    throw new Error(
      `Tenant ${tenant.name}/${tenant.env} has no testCustomer credentials. ` +
      `Set ${prefix}_USER and ${prefix}_PASSWORD in .env.`,
    );
  }
  return creds;
}
