export type CategoryType = 'GA' | 'seated';

/**
 * SquareMaze Category — a ticket tier belonging to an Event.
 * Always references its parent via eventId (FK).
 */
export interface Category {
  id: number;
  eventId: number;
  name: string;
  type: CategoryType;
  price?: number;
  capacity?: number | null;
  data?: Record<string, unknown>;
}

/** Filter passed to admin.findCategory / resolver.category. */
export interface FindCategoryCriteria {
  eventId?: number;
  type?: CategoryType;
  hasCapacity?: boolean;
}
