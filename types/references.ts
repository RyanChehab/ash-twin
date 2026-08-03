import type { CategoryType } from './payloads';

export interface EventRef {
  id: number | string;
  title: string;
}

export interface CategoryRef {
  id: number;
  eventId: number;
  name: string;
  type: CategoryType;
}

export interface TicketRef {
  orderRef: string;
  status: 'paid' | 'pending' | 'failed' | 'unknown';
  eventId?: number | string;
}
