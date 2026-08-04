/**
 * SquareMaze Ticket — a purchased seat/quantity from an event.
 */
export interface Ticket {
  orderRef: string;
  status: 'paid' | 'pending' | 'failed' | 'unknown';
  eventId?: number;
  data?: Record<string, unknown>;
}
