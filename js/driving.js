/**
 * Live driving experience: heading detection, GPS tracking, the camera
 * follow behaviour, and the proximity trigger that fires announcements.
 */

import { MODES, ANNOUNCE_RADIUS_M, ANNOUNCE_COOLDOWN_MS } from './constants.js';
import { state, refs } from './state.js';
import { showError, speakText } from './ui.js';
import { haversineDistance, getSide, getBearingDiff, sleep } from './utils.js';
import { buildRouteSteps, primeNavInstruction, updateNavInstruction } from './route.js';
import { announceAndShow, dismissCard } from './poiCard.js';

const $ = (id) => document.getElementById(id);
const ARROW_PATH = 'M 0,-12 L 7,8 L 0,3 L -7,8 Z';

/* ---- Heading: GPS > device compass > derived from movement ---- */

function startCompass() {
  if (typeof DeviceOrientationEvent === 'undefined') return;
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then((permission) => {
        if (permission === 'granted') window.addEventListener('deviceorientation', onDeviceOrientation);
      })
      .catch(() => {});
  } else {
    window.addEventListener('deviceorientation', onDeviceOrientation);
  }
}

function stopCompass() {
  window.removeEventListener('deviceorientation', onDeviceOrientation);
  refs.compassHeading = null;
  refs.lastPositions = [];
}

function onDeviceOrientation(e) {
  if (e.webkitCompassHeading != null) {
    refs.compassHeading = e.webkitCompassHeading;
  } else if (e.alpha != null && e.absolute) {
    refs.compassHeading = (360 - e.alpha) % 360;
  }
  updateArrowRotation();
}

function headingFromMovement(lat, lng) {
  const now = Date.now();
  refs.lastPositions.push({ lat, lng, time: now });
  refs.lastPositions = refs.lastPositions.filter((p) => now - p.time < 10000).slice(-5);

  if (refs.lastPositions.length < 2) return null;
  const oldest = refs.lastPositions[0];
  if (haversineDistance(oldest.lat, oldest.lng, lat, lng) < 3) return null;

  const toRad = (d) => (d * Math.PI) / 180;
  const dLon = toRad(lng - oldest.lng);
  const y = Math.sin(dLon) * Math.cos(toRad(lat));
  const x =
    Math.cos(toRad(oldest.lat)) * Math.sin(toRad(lat)) -
    Math.sin(toRad(oldest.lat)) * Math.cos(toRad(lat)) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function bestHeading(gpsHeading, lat, lng) {
  if (gpsHeading != null && gpsHeading !== 0) return gpsHeading;
  if (refs.compassHeading != null) return refs.compassHeading;
  return headingFromMovement(lat, lng);
}

function updateArrowRotation() {
  if (!refs.userMarker || refs.compassHeading == null) return;
  const icon = refs.userMarker.getIcon();
  if (icon) {
    icon.rotation = refs.compassHeading;
    refs.userMarker.setIcon(icon);
  }
}

/* ---- Driving lifecycle ---- */

async function playTransition(mode) {
  const transition = $('drive-transition');
  const content = $('drive-transition-content');
  $('drive-mode-icon').textContent = mode.icon;
  $('drive-mode-title').textContent = `${mode.label} Mode`;

  transition.classList.remove('hidden');
  await sleep(50);
  content.style.transition = 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
  content.style.opacity = '1';
  content.style.transform = 'scale(1)';

  speakText(`${mode.label} mode activated. ${state.pois.length} places along your route. Let's go.`);

  await sleep(2200);
  content.style.opacity = '0';
  content.style.transform = 'scale(1.1)';
  await sleep(500);
  transition.classList.add('hidden');
  content.style.opacity = '0';
  content.style.transform = 'scale(0.9)';
}

export async function startDriving() {
  if (!navigator.geolocation) {
    showError('Geolocation is not supported by your browser.');
    return;
  }

  await playTransition(MODES[state.exploreMode]);

  state.routeSteps = buildRouteSteps();
  startCompass();
  state.driving = true;
  state.lastAnnouncementTime = 0;

  $('driving-ready-section').classList.add('hidden');
  $('driving-active-section').classList.remove('hidden');
  primeNavInstruction();

  state.watchId = navigator.geolocation.watchPosition(onPositionUpdate, onGeoError, {
    enableHighAccuracy: true,
    maximumAge: 2000,
    timeout: 15000,
  });
}

export function stopDriving() {
  state.driving = false;
  stopCompass();

  if (state.watchId !== null) {
    navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
  }
  if (refs.userMarker) {
    refs.userMarker.setMap(null);
    refs.userMarker = null;
  }
  if (refs.userGlow) {
    refs.userGlow.setMap(null);
    refs.userGlow = null;
  }
  window.speechSynthesis.cancel();
  dismissCard();

  const bounds = new google.maps.LatLngBounds();
  bounds.extend({ lat: state.origin.lat, lng: state.origin.lng });
  bounds.extend({ lat: state.destination.lat, lng: state.destination.lng });
  state.pois.forEach((poi) => bounds.extend({ lat: poi.lat, lng: poi.lng }));
  refs.map.fitBounds(bounds, { top: 80, bottom: 280, left: 40, right: 40 });

  $('driving-active-section').classList.add('hidden');
  $('driving-ready-section').classList.remove('hidden');
}

function onGeoError(err) {
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  let msg;
  if (err.code === 1) {
    msg = isSafari
      ? 'Location blocked. Check both: 1) Safari → Settings → Websites → Location → Allow for localhost. 2) System Settings → Privacy & Security → Location Services → Safari must be enabled. Then refresh.'
      : 'Location access denied. Please allow location in your browser settings and refresh.';
  } else if (err.code === 2) {
    msg = 'Could not determine your location. Make sure Location Services is enabled in System Settings → Privacy & Security → Location Services.';
  } else if (err.code === 3) {
    msg = 'Location request timed out. Trying again…';
  } else {
    msg = `Location error (code ${err.code}): ${err.message}`;
  }
  console.error('Geolocation error:', err.code, err.message);
  showError(msg);
  if (err.code !== 3) stopDriving();
}

function onPositionUpdate(position) {
  const { latitude: lat, longitude: lng, heading: gpsHead, speed } = position.coords;
  const heading = bestHeading(gpsHead, lat, lng);

  if (!refs.userMarker) {
    refs.userGlow = new google.maps.Marker({
      position: { lat, lng },
      map: refs.map,
      icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#4285F4', fillOpacity: 0.2, strokeColor: '#4285F4', strokeWeight: 1, strokeOpacity: 0.3, scale: 20 },
      zIndex: 99,
    });
    refs.userMarker = new google.maps.Marker({
      position: { lat, lng },
      map: refs.map,
      icon: { path: ARROW_PATH, fillColor: '#4285F4', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2, scale: 1.8, rotation: heading || 0, anchor: new google.maps.Point(0, 0) },
      zIndex: 100,
    });
    refs.map.setZoom(16);
  } else {
    refs.userMarker.setPosition({ lat, lng });
    refs.userGlow.setPosition({ lat, lng });
    const icon = refs.userMarker.getIcon();
    icon.rotation = heading != null ? heading : icon.rotation || 0;
    refs.userMarker.setIcon(icon);
  }

  refs.map.panTo({ lat, lng });

  if (speed != null && speed > 0) {
    const targetZoom = speed > 30 ? 14 : speed > 15 ? 15 : 16;
    if (Math.abs(refs.map.getZoom() - targetZoom) > 0.5) refs.map.setZoom(targetZoom);
  }

  updateNavInstruction(lat, lng);
  checkPOIProximity(lat, lng, heading);
}

function checkPOIProximity(lat, lng, heading) {
  const now = Date.now();

  for (const poi of state.pois) {
    if (poi.announced) continue;

    const dist = haversineDistance(lat, lng, poi.lat, poi.lng);

    // Quietly mark POIs we've already driven past.
    if (dist > 500 && heading != null && getBearingDiff(heading, lat, lng, poi.lat, poi.lng) > 90) {
      poi.announced = true;
      continue;
    }

    if (dist < ANNOUNCE_RADIUS_M && now - state.lastAnnouncementTime > ANNOUNCE_COOLDOWN_MS) {
      poi.announced = true;
      state.lastAnnouncementTime = now;
      announceAndShow(poi, Math.round(dist), getSide(heading, lat, lng, poi.lat, poi.lng));
      return;
    }
  }
}
