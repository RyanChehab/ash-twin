import { mergeTests } from '@playwright/test';
import { tenantFixture } from './tenant';
import { authFixtures } from './auth';
import { actorsFixtures } from './actors';

export const test = mergeTests(tenantFixture, authFixtures, actorsFixtures);
export { expect } from '@playwright/test';
