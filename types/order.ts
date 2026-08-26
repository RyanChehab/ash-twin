/**
 * SquareMaze Order — the outcome of a checkout, as read from the confirmation page.
 * `status` reflects the order's payment state (from `order_payment_status`),
 * not any per-ticket state — SquareMaze has no per-ticket status column.
 */
export interface Order {
  orderRef: string;
  status: 'paid' | 'pending' | 'failed' | 'unknown';
  data?: Record<string, unknown>;
}
