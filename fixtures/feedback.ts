import { test as base } from '@playwright/test';

/**
 * Attach a custom human-readable note to the current test's result. Notes
 * surface in the HTML report as annotations and are queryable in the JSON
 * output — good for capturing the specific state a test proved, e.g. the
 * email of a user that was successfully created.
 *
 *   test(14, async ({ customer, feedback }) => {
 *     const email = `ash.twin.${Date.now()}@example.com`;
 *     // ... register + activate ...
 *     feedback(`user ${email} signed up`);
 *   });
 */
export const feedbackFixtures = base.extend<{
  feedback: (message: string) => void;
}>({
  feedback: async ({}, use, testInfo) => {
    await use((message: string) => {
      testInfo.annotations.push({ type: 'feedback', description: message });
    });
  },
});
