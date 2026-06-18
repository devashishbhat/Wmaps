/**
 * Centralised mutable application state.
 *
 * `state`  — user-facing trip data (origin, route, POIs, driving status).
 * `refs`   — long-lived Google Maps objects and internal handles that are
 *            created once and mutated in place.
 */

export const state = {
  origin: null,            // { lat, lng, label }
  destination: null,       // { lat, lng, label }
  route: null,             // google.maps.DirectionsResult
  exploreMode: null,       // 'history' | 'dark' | 'popculture' | 'nature' | 'americana'
  pois: [],
  driving: false,
  lastAnnouncementTime: 0,
  activePOI: null,
  watchId: null,
  cardDismissTimer: null,
  routeSteps: [],
};

export const refs = {
  map: null,
  directionsService: null,
  directionsRenderer: null,
  placesService: null,
  originAutocomplete: null,
  destAutocomplete: null,
  routePolyline: null,
  routeOutline: null,
  originMarker: null,
  destMarker: null,
  userMarker: null,
  userGlow: null,
  poiMarkers: [],
  errorTimeout: null,
  compassHeading: null,
  lastPositions: [],
};

/** Reads the API config injected by config.js (kept out of version control). */
export function getConfig() {
  return window.CONFIG || { GOOGLE_MAPS_KEY: 'YOUR_GOOGLE_MAPS_API_KEY', ANTHROPIC_API_KEY: 'YOUR_ANTHROPIC_API_KEY' };
}
