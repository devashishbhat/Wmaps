/**
 * The cinematic POI card: slide-up presentation, voice announcement,
 * and the on-demand Claude story.
 */

import { state } from './state.js';
import { showError, speakText } from './ui.js';
import { getHookLine, formatReviews } from './utils.js';
import { fetchStory } from './claude.js';

const $ = (id) => document.getElementById(id);

/** Speak and display a POI as the driver approaches it. */
export function announceAndShow(poi, distance, side) {
  const hook = getHookLine(poi);
  const sideText = side === 'ahead' ? 'just ahead' : `on your ${side}`;
  speakText(`In ${distance} metres ${sideText} — ${poi.name}. ${hook}.`);
  showPOICard(poi, distance, side);
}

/** Render the POI card. `distance`/`side` may be null when browsing. */
export function showPOICard(poi, distance, side) {
  state.activePOI = poi;
  clearTimeout(state.cardDismissTimer);

  const card = $('poi-card');
  const sideText = side === 'ahead' ? 'Just ahead' : side ? `On your ${side}` : '';
  $('poi-distance').textContent = distance != null ? `In ${distance}m ${sideText.toLowerCase()}` : sideText;

  $('poi-name').textContent = poi.name;
  $('poi-rating').textContent = poi.rating.toFixed(1);
  $('poi-reviews').textContent = formatReviews(poi.reviews);
  $('poi-hook').textContent = getHookLine(poi);

  const photoEl = $('poi-photo');
  if (poi.photo_url) {
    photoEl.src = poi.photo_url;
    photoEl.alt = poi.name;
    photoEl.parentElement.classList.remove('hidden');
  } else {
    photoEl.parentElement.classList.add('hidden');
  }

  $('poi-story-section').classList.add('hidden');
  $('poi-story-loading').classList.add('hidden');
  $('tell-more-btn').textContent = poi.storyCache ? 'Hear it again' : 'Tell me more';

  card.classList.remove('hidden');
  card.firstElementChild.classList.remove('anim-slide-down');
  card.firstElementChild.classList.add('anim-slide-up');

  state.cardDismissTimer = setTimeout(dismissCard, 15000);
}

export function dismissCard() {
  clearTimeout(state.cardDismissTimer);
  const card = $('poi-card');
  if (card.classList.contains('hidden')) return;

  card.firstElementChild.classList.remove('anim-slide-up');
  card.firstElementChild.classList.add('anim-slide-down');
  setTimeout(() => {
    card.classList.add('hidden');
    state.activePOI = null;
  }, 400);
}

/** Fetch (or replay) a 3-sentence Claude story for the active POI. */
export async function tellMeMore() {
  const poi = state.activePOI;
  if (!poi) return;

  clearTimeout(state.cardDismissTimer);

  if (poi.storyCache) {
    $('poi-story').textContent = poi.storyCache;
    $('poi-story-section').classList.remove('hidden');
    speakText(poi.storyCache);
    return;
  }

  $('poi-story-loading').classList.remove('hidden');

  try {
    const story = (await fetchStory(poi, state.exploreMode)) || 'Story unavailable right now.';
    poi.storyCache = story;
    $('poi-story-loading').classList.add('hidden');
    $('poi-story').textContent = story;
    $('poi-story-section').classList.remove('hidden');
    $('tell-more-btn').textContent = 'Hear it again';
    speakText(story);
  } catch {
    $('poi-story-loading').classList.add('hidden');
    showError('Story unavailable right now.');
  }
}
