import { mergeTests } from '@playwright/test';
import { tenantFixture } from './tenant';
import { authFixtures } from './auth';
import { actorsFixtures } from './actors';
import { feedbackFixtures } from './feedback';

export const test = mergeTests(tenantFixture, authFixtures, actorsFixtures, feedbackFixtures);
export { expect } from '@playwright/test';
