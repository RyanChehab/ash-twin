/**
 * SquareMaze Event — the domain model.
 * All fields optional beyond id + title; the rest come from the DB or default server-side.
 * The `data` bag holds obscure fields we haven't enumerated yet — accessed via `event.data?.field_name`.
 */
export interface Event {
  id: number;
  title: string;
  status?: 'published' | 'paused' | 'draft';
  capacity?: number | null;
  isSeated?: boolean;
  date?: string | null;
  data?: Record<string, unknown>;
}

/** Filter passed to admin.findEvent / resolver.event. */
export interface FindEventCriteria {
  status?: 'published' | 'draft';
  isSeated?: boolean;
  hasCapacity?: boolean;
}
