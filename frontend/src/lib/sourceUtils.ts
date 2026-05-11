/**
 * Centralized source-display utilities for multi-source event data.
 * Maps backend `source` keys to user-facing labels, brand colors, and URLs.
 */

export type SourceKey = 'eventfinda' | 'ourauckland-surface' | 'aucklandforkids' | string;

interface SourceInfo {
  label: string;
  shortLabel: string;
  url: string;
  color: string;       // Tailwind text-color class
  hoverColor: string;  // Tailwind hover text-color class
}

const SOURCE_MAP: Record<string, SourceInfo> = {
  eventfinda: {
    label: 'View on Eventfinda',
    shortLabel: 'Eventfinda',
    url: 'https://www.eventfinda.co.nz/',
    color: 'text-blue-500',
    hoverColor: 'hover:text-blue-700',
  },
  'ourauckland-surface': {
    label: 'View on OurAuckland',
    shortLabel: 'OurAuckland',
    url: 'https://ourauckland.aucklandcouncil.govt.nz/',
    color: 'text-teal-600',
    hoverColor: 'hover:text-teal-800',
  },
  aucklandforkids: {
    label: 'View on Auckland for Kids',
    shortLabel: 'Auckland for Kids',
    url: 'https://www.aucklandforkids.co.nz/',
    color: 'text-orange-500',
    hoverColor: 'hover:text-orange-700',
  },
};

const DEFAULT_SOURCE: SourceInfo = {
  label: 'View Event',
  shortLabel: 'Event',
  url: '#',
  color: 'text-blue-500',
  hoverColor: 'hover:text-blue-700',
};

function resolve(source?: string): SourceInfo {
  if (!source) return SOURCE_MAP.eventfinda;
  return SOURCE_MAP[source] || DEFAULT_SOURCE;
}

/** Full link text e.g. "View on Eventfinda" */
export function getSourceLabel(source?: string): string {
  return resolve(source).label;
}

/** Short brand name e.g. "Eventfinda" */
export function getSourceShortLabel(source?: string): string {
  return resolve(source).shortLabel;
}

/** Brand homepage URL */
export function getSourceHomepage(source?: string): string {
  return resolve(source).url;
}

/** Tailwind text-color class for the source brand */
export function getSourceColor(source?: string): string {
  return resolve(source).color;
}

/** Tailwind hover text-color class */
export function getSourceHoverColor(source?: string): string {
  return resolve(source).hoverColor;
}

/** All three source sites for the attribution footer */
export const SOURCE_SITES = [
  {
    name: 'Eventfinda',
    url: 'https://www.eventfinda.co.nz/',
    description: 'NZ\'s largest event listing platform',
  },
  {
    name: 'OurAuckland',
    url: 'https://ourauckland.aucklandcouncil.govt.nz/',
    description: 'Auckland Council community events',
  },
  {
    name: 'Auckland for Kids',
    url: 'https://www.aucklandforkids.co.nz/',
    description: 'Family-friendly activities in Auckland',
  },
];
