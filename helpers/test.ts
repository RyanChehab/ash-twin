import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base } from '../fixtures';

const thisDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * A registered test in `specs/registry.json`. The registry is the source of
 * truth for what tests exist, their titles, and their metadata. Playwright
 * receives that metadata as tags at runtime.
 */
interface RegistryEntry {
  id:          number;
  title:       string;
  feature:     string;
  surface:     string;
  validatedOn: string[];
}

const registryPath = path.resolve(thisDir, '..', 'specs', 'registry.json');
const registry: RegistryEntry[] = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));

// Load-time integrity check — fail the whole test process on a duplicate id
// rather than silently letting two tests share the same identity.
const byId = new Map<number, RegistryEntry>();
for (const entry of registry) {
  if (byId.has(entry.id)) {
    throw new Error(`ash-twin registry: duplicate test id ${entry.id}`);
  }
  byId.set(entry.id, entry);
}

// The base signature has two overloads; picking the 3-arg one so we get
// the fixture-typed test body, not the TestDetails options bag.
type TestFn = Parameters<typeof base>[2];

/**
 * Ash Twin's registered-test entrypoint. Replaces Playwright's raw `test()`
 * with an id-driven variant that looks up the title and tags
 */
function callable(id: number, fn: TestFn): void {
  const entry = byId.get(id);
  if (!entry) {
    throw new Error(
      `ash-twin: test id ${id} is not in specs/registry.json. Add it before writing the spec.`,
    );
  }
  const tags = [
    `@id:${entry.id}`,
    `@feature:${entry.feature}`,
    `@surface:${entry.surface}`,
    ...entry.validatedOn.map(t => `@validated-on:${t}`),
  ];
  base(entry.title, { tag: tags }, fn);
}

// Attach Playwright's `describe`, `beforeAll`, `step`, etc. so callers can
// use `test.describe(...)` naturally. `Object.assign` copies enumerable
// properties from `base` onto our callable function.
export const test = Object.assign(callable, base);
export { expect } from '../fixtures';
