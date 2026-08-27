import type { Event, EventCriteria } from './event';
import type { Category, CategoryCriteria } from './category';
import type { Handling, HandlingCriteria } from './handling';

export type EventSelector =
  | number
  | string
  | Event
  | EventCriteria;

export type CategorySelector =
  | number
  | Category
  | CategoryCriteria;

export type HandlingSelector =
  | number
  | Handling
  | HandlingCriteria;
