import type { CategoryCriteria } from './category';


export interface Addon {
  id:             number;   // event_id
  name:           string;   // event_name
  status:         'pub' | 'unpub' | 'nosal';
  webshop:        boolean;  // event_webshop
  showOnCheckout: boolean;  // event_show_on_checkout
  stockShared:    boolean;  // event_stock_shared
  price:          number;   // event_current_price
  orderLimit?:    number;   // event_order_limit
  originId?:      number;   // event_origin_id — source addon id when cloned
}

/** Row in the `addonlink` table — the many-to-many between events and addons. */
export interface AddonLink {
  eventId:     number;   // addonlink_event_id — the parent event
  addonId:     number;   // addonlink_addon_id — the addon
  categoryId?: number;   // addonlink_category_id — null = applies to every category on the parent
}


export interface AddonCriteria {
  addonId?:        number;   // addonlink_addon_id
  eventId?:        number;   // addonlink_event_id — parent event scope
  categoryId?:     number;   // addonlink_category_id — category-scoped link

  status?:         'pub' | 'unpub' | 'nosal';   // event_status
  webshop?:        boolean;                     // event_webshop
  showOnCheckout?: boolean;                     // event_show_on_checkout
  stockShared?:    boolean;                     // event_stock_shared
  minPrice?:       number;                      // event_current_price >= ?
  maxPrice?:       number;                      // event_current_price <= ?
  orderLimit?:     number;                      // event_order_limit exact match

  // Nested — filter by the addon's linked category shape
  hasCategory?:    CategoryCriteria;
}
