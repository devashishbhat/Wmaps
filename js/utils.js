/**
 * Pure helper functions: geospatial math, hook fallbacks, and formatting.
 * None of these touch the DOM or Google Maps singletons.
 */

const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance between two coordinates, in metres. */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Initial bearing from one coordinate to another, in degrees (0–360). */
function bearingTo(lat1, lng1, lat2, lng2) {
  const dLon = toRad(lng2 - lng1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** Which side of the vehicle a POI is on, given the driver's heading. */
export function getSide(userHeading, userLat, userLng, poiLat, poiLng) {
  if (userHeading == null) return 'ahead';
  const bearing = (bearingTo(userLat, userLng, poiLat, poiLng) + 360) % 360;
  const diff = (bearing - userHeading + 360) % 360;
  return diff < 180 ? 'right' : 'left';
}

/** Absolute angular difference between heading and a POI (0–180). */
export function getBearingDiff(userHeading, userLat, userLng, poiLat, poiLng) {
  if (userHeading == null) return 0;
  const bearing = (bearingTo(userLat, userLng, poiLat, poiLng) + 360) % 360;
  const diff = (bearing - userHeading + 360) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Generic descriptor used when the AI hook is unavailable. */
export function getHookLine(poi) {
  if (poi.hookLine) return poi.hookLine;

  const t = poi.types || [];
  if (t.includes('museum')) return 'Local history museum';
  if (t.includes('church')) return 'Historic church';
  if (t.includes('cemetery')) return 'Historic cemetery';
  if (t.includes('city_hall')) return 'Civic landmark';
  if (t.includes('natural_feature')) return 'Natural landmark';
  if (t.includes('park')) return 'Natural preserve';
  if (t.includes('campground')) return 'Campground & trails';
  if (t.includes('movie_theater')) return 'Cinema & entertainment';
  if (t.includes('tourist_attraction')) return 'Roadside attraction';
  if (t.includes('point_of_interest')) return 'Local point of interest';
  return poi.vicinity || 'Nearby place';
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatDistance(metres) {
  const miles = metres * 0.000621371;
  return miles >= 10 ? `${Math.round(miles)} miles` : `${miles.toFixed(1)} miles`;
}

export function formatReviews(count) {
  return count >= 1000 ? `${(count / 1000).toFixed(1)}k reviews` : `${count} reviews`;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
