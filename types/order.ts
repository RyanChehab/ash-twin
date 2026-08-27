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

export type OrderStatus        = 'ord' | 'cancel' | 'reemit' | 'reissue' | 'trash' | 'res' | 'pros' | 'credit';
export type OrderPaymentStatus = 'none' | 'pending' | 'paid' | 'payed' | 'canceled' | 'cancelled';

export interface OrderRow {
  orderId:       number;
  status:        OrderStatus;
  paymentStatus: OrderPaymentStatus;
}
