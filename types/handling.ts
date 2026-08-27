/**
 * SquareMaze Handling — a checkout radio: one payment plugin (`eph_*`) bundled
 * with one shipment plugin (`esm_*`) plus per-row config (fees, sale mode, geo,
 * templates). Backing table: `handling` (prefix `handling_`), model class
 * `Handling`.
 *
 * `payment` and `shipment` are the middle segment of their plugin filenames
 * (`eph_{payment}.php`, `esm_{shipment}.php`) and the value of the DOM's
 * `data-payment-type` attribute — the identity chain across DB, PHP, DOM, and
 * ash-twin's `payments/{name}.ts` strategy files.
 */

export type PaymentKey  = string;   // handling_payment
export type ShipmentKey = string;   // handling_shipment

export type HandlingPubStatus = 0 | 1 | 2;

export interface Handling {
  id:              number;
  payment:         PaymentKey;
  shipment:        ShipmentKey;
  textPayment:     string;
  textShipment:    string;
  webStatus?:      HandlingPubStatus;
  posStatus?:      HandlingPubStatus;
  b2bStatus?:      HandlingPubStatus;
  isFree:          boolean;
  isComplimentary: boolean;
  isReservation:   boolean;
  altOnly:         boolean;
  countries:       string[] | null;
  feeFix:          number;
  feePercent:      number;
  feePerSeat:      boolean;
}

export interface HandlingCriteria {
  payment?:         PaymentKey;
  shipment?:        ShipmentKey;
  webStatus?:       HandlingPubStatus;
  posStatus?:       HandlingPubStatus;
  b2bStatus?:       HandlingPubStatus;
  isFree?:          boolean;
  isComplimentary?: boolean;
  isReservation?:   boolean;
  altOnly?:         boolean;
  country?:         string;
  paymentEnabled?:  boolean;
  shipmentEnabled?: boolean;
}
