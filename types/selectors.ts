import type { Event } from './event';

/**
 * How a test specifies which event it wants to act on.
 * The Resolver accepts any of these shapes and normalizes to a full Event.
 */
export type EventSelector =
  | string          // by exact name — 'Coldplay Live at CCA'
  | number          // by id         — 42
  | Event;          // by full ref   — object from a prior call
