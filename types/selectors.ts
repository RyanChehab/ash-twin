import type { Event, EventCriteria } from './event';
import type { Category, CategoryCriteria } from './category';

export type EventSelector =
  | number
  | string
  | Event
  | EventCriteria;

export type CategorySelector =
  | number
  | Category
  | CategoryCriteria;
