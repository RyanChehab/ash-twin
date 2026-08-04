/**
 * SquareMaze Event — the domain model.
 * All fields optional beyond id + title; the rest come from the DB or default server-side.
 * The `data` bag holds obscure fields we haven't enumerated yet — accessed via `event.data?.field_name`.
 */
export interface Event {
  id: number;
  title: string;
  status?: 'published' | 'paused' | 'draft';
  date?: string | null;
  data?: Record<string, unknown>;
}

/**
 * Filter passed to admin.findEvent / resolver.event.
 * Each key is one dimension; combine freely. Adding a new dimension =
 * add a key here + one SQL fragment in Resolver.event.
 */
export interface FindEventCriteria {
  // Direct-lookup shortcuts
  id?: number;
  name?: string;

  // Event's own fields
  status?: 'published' | 'paused' | 'draft';
  isSeated?: boolean;
  hasCapacity?: boolean;

  // Cross-table dimensions grow here later:
  //   hasCategory?: { type?: CategoryType; hasCapacity?: boolean };
  //   hasDiscount?: boolean | { type?: string; active?: boolean };
  //   hasVoucher?:  boolean | { type?: string };
  //   hasPluginEnabled?: string;
}
