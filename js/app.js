/**
 * Application entry point.
 *
 * Responsibilities:
 *   - expose the Google Maps JS API callbacks on `window`
 *   - inject the Maps script using the key from config.js
 *   - bind all DOM event listeners once the document is ready
 */

import { state, refs, getConfig } from './state.js';
import { showScreen, showError } from './ui.js';
import { getRoute, initAutocomplete } from './route.js';
import { showModeSelector, hideModeSelector, beginExploreMode, clearPOIMarkers } from './poi.js';
import { startDriving, stopDriving } from './driving.js';
import { tellMeMore, dismissCard } from './poiCard.js';

const $ = (id) => document.getElementById(id);

/* ---- Google Maps callbacks (must live on window) ---- */

window.initApp = initAutocomplete;

window.gm_authFailure = () => {
  console.error('Google Maps auth failure. Check: 1) Billing enabled 2) Maps JavaScript API enabled 3) Key restrictions');
  document.title = 'MAPS AUTH FAILED — check console';
};

function loadGoogleMaps() {
  const key = getConfig().GOOGLE_MAPS_KEY;
  if (!key || key === 'YOUR_GOOGLE_MAPS_API_KEY') {
    console.warn('Wmaps: set GOOGLE_MAPS_KEY in config.js to enable maps.');
    return;
  }
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,geometry&callback=initApp&v=weekly`;
  script.async = true;
  script.defer = true;
  script.onerror = () => showError('Failed to load Google Maps. Check your API key.');
  document.head.appendChild(script);
}

/* ---- Event wiring ---- */

function handleUseLocation() {
  if (!navigator.geolocation) {
    showError('Geolocation is not supported by your browser.');
    return;
  }
  const btn = $('use-location-btn');
  const input = $('origin-input');
  btn.disabled = true;
  input.value = 'Locating…';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.origin = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Current Location' };
      input.value = 'Current Location';
      btn.disabled = false;
    },
    () => {
      showError('Could not get your location. Please type it instead.');
      input.value = '';
      btn.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 10000 },
  );
}

function handleBack() {
  stopDriving();
  clearPOIMarkers();
  if (refs.originMarker) { refs.originMarker.setMap(null); refs.originMarker = null; }
  if (refs.destMarker) { refs.destMarker.setMap(null); refs.destMarker = null; }
  if (refs.routePolyline) { refs.routePolyline.setMap(null); refs.routePolyline = null; }
  if (refs.routeOutline) { refs.routeOutline.setMap(null); refs.routeOutline = null; }
  state.route = null;
  state.pois = [];
  state.exploreMode = null;
  showScreen('landing');
}

function bindEvents() {
  $('use-location-btn').addEventListener('click', handleUseLocation);
  $('get-route-btn').addEventListener('click', getRoute);
  $('dest-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      getRoute();
    }
  });

  $('back-btn').addEventListener('click', handleBack);
  $('start-explore-btn').addEventListener('click', showModeSelector);
  $('begin-btn').addEventListener('click', beginExploreMode);
  $('mode-backdrop').addEventListener('click', hideModeSelector);

  $('start-driving-btn').addEventListener('click', startDriving);
  $('stop-driving-btn').addEventListener('click', stopDriving);

  $('tell-more-btn').addEventListener('click', tellMeMore);
  $('dismiss-card-btn').addEventListener('click', dismissCard);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindEvents);
} else {
  bindEvents();
}

loadGoogleMaps();
