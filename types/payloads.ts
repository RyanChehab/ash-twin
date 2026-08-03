import type { SeatRef } from './seat';

export type CategoryType = 'GA' | 'seated';

export interface EventPayload {
  eventId: number;
  title: string;
  capacity?: number;
}

export interface BuyTicketPayload {
  eventId:    number;
  categoryId: number;
  userId:     number;
  quantity?:  number;
  seats?:     SeatRef[];
}

export interface FindEventCriteria {
  isSeated?: boolean;
  hasCapacity?: boolean;
  status?: 'published' | 'draft';
}

export interface CategoryPayload {
  eventId:  number;
  name:     string;
  type:     CategoryType;
  price:    number;
  capacity?: number;
}

export interface FindCategoryCriteria {
  eventId?:    number;
  type?:       CategoryType;
  hasCapacity?: boolean;
}
