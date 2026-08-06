import type { CategoryCriteria } from './category';

/**
 * `rep` classifies event instance shape:
 *   - 'unique' — standalone one-off (DB value: 'main,sub')
 *   - 'main'   — parent of a multi-day series (has no categories itself)
 *   - 'sub'    — one date instance under a main (categories live here)
 * Only 'unique' and 'main' events appear on the landing page.
 * Only 'unique' and 'sub' events have categories (buyable events).
 */
export type EventRep = 'unique' | 'main' | 'sub';

/**
 * SquareMaze Event — the domain model.
 * All fields optional beyond id + title; the rest come from the DB or default server-side.
 * The `data` bag holds obscure fields we haven't enumerated yet — accessed via `event.data?.field_name`.
 */
export interface Event {
  id: number;
  title: string;
  status?: 'published' | 'paused' | 'draft';
  date?: string | null;                 // event_date (YYYY-MM-DD)
  time?: string | null;                 // event_time (HH:MM:SS)
  rep?: EventRep;
  mainId?: number | null;               // populated for sub events only
  data?: Record<string, unknown>;
}

export interface EventCriteria {
  status?: 'published' | 'paused' | 'draft';


  rep?: EventRep | 'main-or-unique' | 'sub-or-unique';

  hasCategory?: CategoryCriteria;
}
