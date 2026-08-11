/**
 * Addons in SquareMaze live in the same `event` table as regular events,
 * discriminated by `event_model = 'product'` AND `event_addon = 1`. Their
 * link to a parent event goes through the `addonlink` table.
 *
 * When a customer's cart contains an event that has an eligible addon
 * linked, checkout diverts through an extra "addons" page. We generally
 * want vitality tests to skip these events unless the test explicitly
 * targets the addons flow — see `EventCriteria.hasAddons`.
 */
export interface Addon {
  id:           number;   // event_id
  name:         string;   // event_name
  status:       'pub' | 'unpub' | 'nosal';
  webPublished: boolean;  // any linked category has category_web = 1
  posPublished: boolean;  // any linked category has category_pos = 1
  b2bPublished: boolean;  // any linked category has category_b2b = 1
}

/** Row in the `addonlink` table — the many-to-many between events and addons. */
export interface AddonLink {
  eventId:    number;   // addonlink_event_id — the parent event
  addonId:    number;   // addonlink_addon_id — the addon
  categoryId?: number;  // addonlink_category_id — null = applies to every category on the parent
}

export interface AddonCriteria {
  eventId?:      number;
  status?:       'pub' | 'unpub' | 'nosal';
  webPublished?: boolean;
  posPublished?: boolean;
  b2bPublished?: boolean;
}
