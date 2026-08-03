import type { SeatRef } from '../types/seat';

/**
 * Serialize a single seat to the SquareMaze API label form: `ROW_NUMBER` (underscore-delimited).
 * Examples: { row: 'A',  number: 15 } → 'A_15'
 *           { row: 'BA', number: 11 } → 'BA_11'
 */
export function toApiLabel(seat: SeatRef): string {
  return `${seat.row}_${seat.number}`;
}

/**
 * Serialize an array of seats to the tilde-joined payload accepted by /api/*/cart `places` param.
 * Example: [{row:'A',number:1},{row:'A',number:2}] → 'A_1~A_2'
 */
export function toApiPayload(seats: SeatRef[]): string {
  return seats.map(toApiLabel).join('~');
}

/**
 * Human-readable form for logs, screenshots, error messages.
 * NOT for API input — the API uses underscore, this uses dash.
 * Example: { row: 'A', number: 15 } → 'A-15'
 */
export function toDisplay(seat: SeatRef): string {
  return `${seat.row}-${seat.number}`;
}

/**
 * Parse an API label back into a SeatRef.
 * Throws on malformed input.
 */
export function fromApiLabel(label: string): SeatRef {
  const idx = label.lastIndexOf('_');
  if (idx <= 0 || idx === label.length - 1) {
    throw new Error(`Invalid seat label: ${label} (expected ROW_NUMBER)`);
  }
  const row = label.slice(0, idx);
  const number = Number(label.slice(idx + 1));
  if (!Number.isInteger(number)) {
    throw new Error(`Invalid seat number in label: ${label}`);
  }
  return { row, number };
}
