/**
 * Static configuration: explore modes, narration tones, and the dark map theme.
 */

export const MODES = {
  history: {
    label: 'History',
    icon: '🏛',
    types: ['museum', 'church', 'cemetery', 'city_hall'],
    keywords: ['historic site', 'battlefield', 'memorial', 'historic landmark', 'heritage'],
    accent: '#f5a623',
    bg: 'rgba(245,166,35,0.12)',
  },
  dark: {
    label: 'Dark & Weird',
    icon: '👻',
    types: ['cemetery', 'natural_feature'],
    keywords: ['haunted', 'ghost', 'abandoned', 'mysterious', 'strange'],
    accent: '#c2185b',
    bg: 'rgba(194,24,91,0.12)',
  },
  popculture: {
    label: 'Pop Culture',
    icon: '🎬',
    types: ['movie_theater', 'point_of_interest'],
    keywords: ['filming location', 'famous landmark', 'mural', 'arts district'],
    accent: '#26c6da',
    bg: 'rgba(38,198,218,0.12)',
  },
  nature: {
    label: 'Nature',
    icon: '🌿',
    types: ['park', 'natural_feature', 'campground'],
    keywords: ['waterfall', 'scenic overlook', 'trail', 'gorge', 'cave'],
    accent: '#7a9e7e',
    bg: 'rgba(122,158,126,0.12)',
  },
  americana: {
    label: 'Roadside Americana',
    icon: '🍔',
    types: ['tourist_attraction'],
    keywords: ['roadside attraction', 'world largest', 'quirky', 'vintage', 'diner'],
    accent: '#e65100',
    bg: 'rgba(230,81,0,0.12)',
  },
};

export const MODE_TONES = {
  history: 'authoritative but warm, like Ken Burns narrating a documentary',
  dark: "eerie and suspenseful, like you're telling a campfire story",
  popculture: 'casual and excited, like a movie fan explaining why a location matters',
  nature: 'reverent and calm, like a nature documentary narrator',
  americana: 'quirky and affectionate, like a road trip blogger who loves weird Americana',
};

export const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a9e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2a2a4e' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#bdb8c8' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#252542' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#2f2f56' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#7a7a9a' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#2f2f56' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#3a3a6e' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e1e' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3a3a5e' }] },
];

/** Distance between route sample points, in metres (~15 miles). */
export const SAMPLE_INTERVAL_M = 24140;

/** Proximity rules for announcements. */
export const ANNOUNCE_RADIUS_M = 300;
export const ANNOUNCE_COOLDOWN_MS = 120000;

/** Anthropic model used for story generation. */
export const CLAUDE_MODEL = 'claude-sonnet-4-6';
