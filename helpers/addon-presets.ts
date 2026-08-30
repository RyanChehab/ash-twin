import type { AddonCriteria } from '../types/addon';

/**
 * Curated addon queries for `resolver.addon(...)`. Same shape philosophy as
 * `event-presets.ts` — presets are the safety net; the resolver applies no
 * implicit filters. When `AddonCriteria` gains, renames, or changes the
 * semantics of a field, update every preset here in the same commit.
 */

export const addons = {

  eligible: {
    status:         'pub',
    webshop:        true,
    showOnCheckout: true,
    hasCategory: {
      webPublished: true,
      soldout:      false,
    },
  } satisfies AddonCriteria,

} as const;
