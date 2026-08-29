import type { TenantConfig, UserCreds } from '../types/tenant';


// Return the tenant's testCustomer credentials

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
