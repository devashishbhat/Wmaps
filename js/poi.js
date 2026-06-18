/**
 * POI discovery: polyline sampling, Google Places search, scoring,
 * map markers, the mode-selector sheet, and the pre-drive list.
 */

import { MODES, SAMPLE_INTERVAL_M } from './constants.js';
import { state, refs } from './state.js';
import { showError, showLoading, hideLoading } from './ui.js';
import { haversineDistance, formatReviews, sleep } from './utils.js';
import { enrichPOIHooks } from './claude.js';
import { showPOICard } from './poiCard.js';

const $ = (id) => document.getElementById(id);

/* ---- Sampling + search ---- */

/** Pick points roughly every `interval` metres along the route path. */
function samplePolyline(path, interval) {
  if (path.length < 2) return [path[0]];

  const total = google.maps.geometry.spherical.computeLength(path);
  if (total < interval) return [path[Math.floor(path.length / 2)]];

  const points = [];
  let accumulated = 0;
  for (let i = 1; i < path.length; i++) {
    accumulated += google.maps.geometry.spherical.computeDistanceBetween(path[i - 1], path[i]);
    if (accumulated >= interval) {
      points.push(path[i]);
      accumulated = 0;
    }
  }
  if (!points.length) points.push(path[Math.floor(path.length / 2)]);
  return points;
}

function nearbySearch(request) {
  return new Promise((resolve) => {
    refs.placesService.nearbySearch(request, (results, status) => {
      resolve(status === google.maps.places.PlacesServiceStatus.OK ? results : []);
    });
  });
}

/** Discover, filter, de-duplicate, score, and enrich POIs for the route. */
export async function loadPOIs() {
  const mode = MODES[state.exploreMode];
  const path = state.route.routes[0].overview_path;
  const samples = samplePolyline(path, SAMPLE_INTERVAL_M);

  let results = [];
  for (const point of samples) {
    for (const type of mode.types) {
      results.push(...(await nearbySearch({ location: point, radius: 5000, type })));
      await sleep(200);
    }
    for (const keyword of mode.keywords || []) {
      results.push(...(await nearbySearch({ location: point, radius: 5000, keyword })));
      await sleep(200);
    }
  }

  // Quality gate tuned to surface lesser-known but well-loved places.
  results = results.filter((p) => (p.rating || 0) >= 3.8 && (p.user_ratings_total || 0) >= 15);

  const seen = new Set();
  results = results.filter((p) => (seen.has(p.place_id) ? false : seen.add(p.place_id)));

  results.forEach((p) => {
    const reviews = p.user_ratings_total || 1;
    p._score = p.rating * Math.log(reviews);
    if (reviews < 200 && p.rating >= 4.0) p._score *= 1.3; // hidden-gem boost
  });
  results.sort((a, b) => b._score - a._score);

  const kept = [];
  for (const p of results) {
    const lat = p.geometry.location.lat();
    const lng = p.geometry.location.lng();
    const tooClose = kept.some((k) => haversineDistance(k.lat, k.lng, lat, lng) < 500);
    if (!tooClose) {
      kept.push({
        place_id: p.place_id,
        name: p.name,
        lat,
        lng,
        vicinity: p.vicinity || '',
        rating: p.rating,
        reviews: p.user_ratings_total || 0,
        photo_url: p.photos?.[0]?.getUrl({ maxWidth: 400 }) || null,
        types: p.types || [],
        announced: false,
        storyCache: null,
        hookLine: null,
      });
    }
    if (kept.length >= 10) break;
  }

  if (kept.length) await enrichPOIHooks(kept, state.exploreMode);
  return kept;
}

/* ---- Map markers ---- */

export function clearPOIMarkers() {
  refs.poiMarkers.forEach((m) => m.setMap(null));
  refs.poiMarkers = [];
}

function dropPOIPins() {
  clearPOIMarkers();
  const mode = MODES[state.exploreMode];

  state.pois.forEach((poi) => {
    const marker = new google.maps.Marker({
      position: { lat: poi.lat, lng: poi.lng },
      map: refs.map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: mode.accent,
        fillOpacity: 0.9,
        strokeColor: '#1a1a2e',
        strokeWeight: 2,
        scale: 10,
      },
      title: poi.name,
      zIndex: 5,
    });
    marker.addListener('click', () => showPOICard(poi, null, null));
    refs.poiMarkers.push(marker);
  });
}

function fitToRoute() {
  const bounds = new google.maps.LatLngBounds();
  bounds.extend({ lat: state.origin.lat, lng: state.origin.lng });
  bounds.extend({ lat: state.destination.lat, lng: state.destination.lng });
  state.pois.forEach((poi) => bounds.extend({ lat: poi.lat, lng: poi.lng }));
  refs.map.fitBounds(bounds, { top: 80, bottom: 280, left: 40, right: 40 });
}

/* ---- Mode selector sheet ---- */

export function showModeSelector() {
  const options = $('mode-options');
  options.innerHTML = '';
  state.exploreMode = null;
  $('begin-btn').disabled = true;

  Object.entries(MODES).forEach(([key, mode]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.mode = key;
    btn.className =
      'w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 border-transparent bg-asphalt/60 btn-press text-left hover:border-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber/50 active:scale-[0.98] transition-transform duration-150';
    btn.innerHTML = `
      <div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style="background: ${mode.bg}; box-shadow: 0 2px 8px ${mode.bg};">${mode.icon}</div>
      <div>
        <p class="font-display text-base text-dawn">${mode.label}</p>
        <p class="text-dawn/40 text-xs mt-0.5">${mode.types.join(', ')}</p>
      </div>`;
    btn.addEventListener('click', () => selectMode(key));
    options.appendChild(btn);
  });

  $('mode-selector').classList.remove('hidden');
  $('mode-sheet').classList.add('anim-slide-up');
  $('mode-backdrop').classList.add('anim-fade-in');
}

function selectMode(modeKey) {
  state.exploreMode = modeKey;
  const mode = MODES[modeKey];
  document.querySelectorAll('#mode-options button').forEach((btn) => {
    const selected = btn.dataset.mode === modeKey;
    btn.style.borderColor = selected ? mode.accent : 'transparent';
    btn.style.background = selected ? mode.bg : 'rgba(26,26,46,0.6)';
  });
  $('begin-btn').disabled = false;
}

export function hideModeSelector() {
  const sheet = $('mode-sheet');
  sheet.classList.remove('anim-slide-up');
  sheet.classList.add('anim-slide-down');
  $('mode-backdrop').classList.remove('anim-fade-in');
  $('mode-backdrop').classList.add('anim-fade-out');
  setTimeout(() => {
    $('mode-selector').classList.add('hidden');
    sheet.classList.remove('anim-slide-down');
    $('mode-backdrop').classList.remove('anim-fade-out');
  }, 400);
}

/* ---- Pre-drive summary list ---- */

function renderPOIList() {
  const mode = MODES[state.exploreMode];
  const listEl = $('poi-list');
  listEl.innerHTML = '';

  state.pois.forEach((poi) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className =
      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left btn-press bg-asphalt/40 hover:bg-asphalt/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber/50 active:bg-asphalt/80';
    const media = poi.photo_url
      ? `<img src="${poi.photo_url}" alt="" class="w-10 h-10 rounded-lg object-cover shrink-0">`
      : `<div class="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0" style="background:${mode.bg}">${mode.icon}</div>`;
    item.innerHTML = `
      ${media}
      <div class="flex-1 min-w-0">
        <p class="text-dawn text-sm font-medium truncate">${poi.name}</p>
        <p class="text-dawn/40 text-xs">${poi.rating.toFixed(1)} ★ · ${formatReviews(poi.reviews)}</p>
      </div>`;
    item.addEventListener('click', () => {
      refs.map.panTo({ lat: poi.lat, lng: poi.lng });
      refs.map.setZoom(14);
      showPOICard(poi, null, null);
    });
    listEl.appendChild(item);
  });
}

/** Run discovery and transition into the "ready to drive" state. */
export async function beginExploreMode() {
  hideModeSelector();
  await sleep(400);
  showLoading('Searching for hidden gems along your route…');

  try {
    state.pois = await loadPOIs();
  } catch (err) {
    hideLoading();
    showError("Couldn't load places. Check your API key and try again.");
    return;
  }

  hideLoading();

  if (!state.pois.length) {
    showError(`No ${MODES[state.exploreMode].label} spots found on this route. Try a different mode or a longer route.`);
    return;
  }

  dropPOIPins();
  fitToRoute();

  const mode = MODES[state.exploreMode];
  $('route-info-section').classList.add('hidden');
  $('driving-ready-section').classList.remove('hidden');
  $('driving-active-section').classList.add('hidden');

  $('mode-badge').textContent = mode.icon;
  $('mode-badge').style.background = mode.bg;
  $('mode-label').textContent = `${mode.label} Mode`;
  $('poi-count').textContent = `${state.pois.length} places along your route`;

  renderPOIList();
}
