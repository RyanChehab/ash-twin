function rnd(len = 6): string {
  return Math.random().toString(36).slice(2, 2 + len);
}

export const unique = {
  name(prefix: string): string {
    return `${prefix}-${Date.now()}-${rnd(4)}`;
  },
  email(domain = 'tixity.test'): string {
    return `e2e-${Date.now()}-${rnd(4)}@${domain}`;
  },
  orderRef(): string {
    return `T${Date.now()}${rnd(3).toUpperCase()}`;
  },
};
