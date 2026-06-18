/**
 * Route layer: place autocomplete, directions fetching, route rendering,
 * and turn-by-turn navigation helpers.
 */

import { MAP_STYLES } from './constants.js';
import { state, refs } from './state.js';
import { showScreen, showError, showLoading, hideLoading } from './ui.js';
import { formatDuration, formatDistance, haversineDistance } from './utils.js';

const $ = (id) => document.getElementById(id);

/** Wire up Google Places autocomplete on the origin/destination inputs. */
export function initAutocomplete() {
  const fields = ['geometry', 'formatted_address', 'name'];

  refs.originAutocomplete = new google.maps.places.Autocomplete($('origin-input'), { fields });
  refs.destAutocomplete = new google.maps.places.Autocomplete($('dest-input'), { fields });

  refs.originAutocomplete.addListener('place_changed', () => {
    const place = refs.originAutocomplete.getPlace();
    if (place.geometry) {
      state.origin = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        label: place.name || place.formatted_address,
      };
    }
  });

  refs.destAutocomplete.addListener('place_changed', () => {
    const place = refs.destAutocomplete.getPlace();
    if (place.geometry) {
      state.destination = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        label: place.name || place.formatted_address,
      };
    }
  });
}

function ensureMap() {
  if (refs.map) return;

  refs.map = new google.maps.Map($('map'), {
    center: { lat: state.origin.lat, lng: state.origin.lng },
    zoom: 10,
    styles: MAP_STYLES,
    disableDefaultUI: true,
    zoomControl: true,
    zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
    gestureHandling: 'greedy',
  });

  refs.directionsService = new google.maps.DirectionsService();
  refs.directionsRenderer = new google.maps.DirectionsRenderer({
    map: refs.map,
    suppressPolylines: true,
    suppressMarkers: true,
  });
  refs.placesService = new google.maps.places.PlacesService(refs.map);
}

function requestDirections() {
  return new Promise((resolve, reject) => {
    refs.directionsService.route(
      {
        origin: { lat: state.origin.lat, lng: state.origin.lng },
        destination: { lat: state.destination.lat, lng: state.destination.lng },
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (res, status) => (status === 'OK' ? resolve(res) : reject(status)),
    );
  });
}

/** Draw the route as an outlined polyline plus origin/destination markers. */
function renderRoute(result) {
  const fullPath = [];
  result.routes[0].legs.forEach((leg) => {
    leg.steps.forEach((step) => step.path.forEach((pt) => fullPath.push(pt)));
  });

  if (refs.routePolyline) refs.routePolyline.setMap(null);
  if (refs.routeOutline) refs.routeOutline.setMap(null);

  refs.routeOutline = new google.maps.Polyline({
    path: fullPath,
    strokeColor: '#1a237e',
    strokeOpacity: 0.5,
    strokeWeight: 10,
    zIndex: 2,
    map: refs.map,
  });

  refs.routePolyline = new google.maps.Polyline({
    path: fullPath,
    strokeColor: '#4285F4',
    strokeOpacity: 1.0,
    strokeWeight: 6,
    zIndex: 3,
    map: refs.map,
  });

  refs.originMarker = new google.maps.Marker({
    position: { lat: state.origin.lat, lng: state.origin.lng },
    map: refs.map,
    icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#7a9e7e', fillOpacity: 1, strokeColor: '#1a1a2e', strokeWeight: 3, scale: 8 },
    zIndex: 10,
  });

  refs.destMarker = new google.maps.Marker({
    position: { lat: state.destination.lat, lng: state.destination.lng },
    map: refs.map,
    icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#f5a623', fillOpacity: 1, strokeColor: '#1a1a2e', strokeWeight: 3, scale: 8 },
    zIndex: 10,
  });
}

/** Validate inputs, fetch the route, and show the map screen. */
export async function getRoute() {
  if (!state.origin || !state.destination) {
    showError('Please enter both an origin and destination.');
    return;
  }

  showLoading('Calculating route…');
  showScreen('map');
  ensureMap();

  try {
    const result = await requestDirections();
    state.route = result;
    refs.directionsRenderer.setDirections(result);
    renderRoute(result);

    const leg = result.routes[0].legs[0];
    $('route-label').textContent = `${state.origin.label} → ${state.destination.label}`;
    $('route-meta').textContent = `${formatDuration(leg.duration.value)} · ${formatDistance(leg.distance.value)}`;

    $('route-info-section').classList.remove('hidden');
    $('driving-ready-section').classList.add('hidden');
    $('driving-active-section').classList.add('hidden');

    hideLoading();
  } catch (err) {
    hideLoading();
    showScreen('landing');
    showError("Couldn't find a driving route. Check your locations and try again.");
  }
}

/* ---- Turn-by-turn navigation ---- */

/** Flatten the route into a simple list of steps for live guidance. */
export function buildRouteSteps() {
  if (!state.route) return [];
  const steps = [];
  state.route.routes[0].legs.forEach((leg) => {
    leg.steps.forEach((step) => {
      steps.push({
        instruction: step.instructions || '',
        distance: step.distance.text,
        startLat: step.start_location.lat(),
        startLng: step.start_location.lng(),
        endLat: step.end_location.lat(),
        endLng: step.end_location.lng(),
        maneuver: step.maneuver || '',
      });
    });
  });
  return steps;
}

function maneuverIcon(maneuver) {
  if (maneuver.includes('left')) return '<path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>';
  if (maneuver.includes('right')) return '<path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/>';
  if (maneuver.includes('uturn')) return '<path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/>';
  if (maneuver.includes('merge') || maneuver.includes('ramp')) return '<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/>';
  return '<path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18"/>';
}

function findCurrentStep(lat, lng) {
  if (!state.routeSteps.length) return null;
  let closestIdx = 0;
  let closestDist = Infinity;
  state.routeSteps.forEach((step, i) => {
    const d = haversineDistance(lat, lng, step.startLat, step.startLng);
    if (d < closestDist) {
      closestDist = d;
      closestIdx = i;
    }
  });
  const endDist = haversineDistance(lat, lng, state.routeSteps[closestIdx].endLat, state.routeSteps[closestIdx].endLng);
  if (endDist < 50 && closestIdx < state.routeSteps.length - 1) closestIdx++;
  return closestIdx;
}

/** Refresh the next-turn banner and ETA based on the current position. */
export function updateNavInstruction(lat, lng) {
  const idx = findCurrentStep(lat, lng);
  if (idx === null) return;
  const step = state.routeSteps[idx];

  $('nav-icon').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">${maneuverIcon(step.maneuver)}</svg>`;
  $('nav-step-text').textContent = step.instruction.replace(/<[^>]*>/g, '') || 'Continue on route';

  const distToStep = haversineDistance(lat, lng, step.endLat, step.endLng);
  $('nav-step-dist').textContent = distToStep > 1000 ? `${(distToStep / 1609).toFixed(1)} mi` : `${Math.round(distToStep)} m`;

  const leg = state.route.routes[0].legs[0];
  $('driving-eta').textContent = `ETA: ${leg.duration.text}`;
  $('driving-remaining').textContent = `${leg.distance.text} remaining`;
}

/** Seed the nav banner with the first step before GPS fixes arrive. */
export function primeNavInstruction() {
  const leg = state.route.routes[0].legs[0];
  if (state.routeSteps.length) {
    const first = state.routeSteps[0];
    $('nav-step-text').textContent = first.instruction.replace(/<[^>]*>/g, '') || 'Head to route';
    $('nav-step-dist').textContent = first.distance;
  }
  $('driving-eta').textContent = `ETA: ${leg.duration.text}`;
  $('driving-remaining').textContent = `${leg.distance.text} remaining`;
}
