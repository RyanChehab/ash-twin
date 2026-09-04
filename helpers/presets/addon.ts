import type { AddonCriteria } from '../../types/addon';

/**
 * Curated addon queries for `resolver.addon(...)`. Same shape philosophy as
 * `presets/event.ts` — presets are the safety net; the resolver applies no
 * implicit filters. When `AddonCriteria` gains, renames, or changes the
 * semantics of a field, update every preset here in the same commit.
 */

export const addons = {

  // Addons render on the checkout interstitial via helper.addon.php's query,
  // which filters on event_status, event_webshop, category_web, addonlink.
  // event_show_on_checkout is a product-only flag — do NOT include it here.
  eligible: {
    status:  'pub',
    webshop: true,
    hasCategory: {
      webPublished: true,
      soldout:      false,
    },
  } satisfies AddonCriteria,

  singleCategoryEligible: {
    status:                'pub',
    webshop:               true,
    hasCategory: {
      webPublished: true,
      soldout:      false,
    },
    hasMultipleCategories: false,
  } satisfies AddonCriteria,

  multiCategoryEligible: {
    status:                'pub',
    webshop:               true,
    hasCategory: {
      webPublished: true,
      soldout:      false,
    },
    hasMultipleCategories: true,
  } satisfies AddonCriteria,

} as const;
