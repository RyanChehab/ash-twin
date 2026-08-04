import type { Event, FindEventCriteria } from './event';

/**
 * The vocabulary of intent shortcuts a test can use to pick an event
 * without knowing its id or name.
 */
export type EventDescriptor =
  | 'first-upcoming'
  | 'any-published-with-capacity'
  | { criteria: FindEventCriteria };

/**
 * How a test specifies which event it wants to act on.
 * The Resolver accepts any of these three shapes and normalizes to an identifier.
 */
export type EventSelector =
  | string          // by exact name — 'Coldplay Live at CCA'
  | EventDescriptor // by intent    — 'first-upcoming'
  | Event;          // by full ref  — object from a prior call
