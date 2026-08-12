import type { CategoryCriteria } from './category';


export interface Addon {
  id:      number;   // event_id
  name:    string;   // event_name
  status:  'pub' | 'unpub' | 'nosal';
  webshop: boolean;  // event_webshop of the addon row itself
}

/** Row in the `addonlink` table — the many-to-many between events and addons. */
export interface AddonLink {
  eventId:     number;   // addonlink_event_id — the parent event
  addonId:     number;   // addonlink_addon_id — the addon
  categoryId?: number;   // addonlink_category_id — null = applies to every category on the parent
}


export interface AddonCriteria {
  eventId?:     number;                            // addonlink_event_id — parent event scope
  status?:      'pub' | 'unpub' | 'nosal';         // event_status of the addon
  webshop?:     boolean;                           // event_webshop of the addon
  hasCategory?: CategoryCriteria;                  // addon has a category matching this shape
}
