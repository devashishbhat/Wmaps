/**
 * Cross-cutting UI helpers: screen switching, transient toasts/overlays,
 * and the Web Speech announcements.
 */

import { refs } from './state.js';

const $ = (id) => document.getElementById(id);

/** Toggle between the landing and map screens. */
export function showScreen(id) {
  $('screen-landing').classList.toggle('hidden', id !== 'landing');
  $('screen-map').classList.toggle('hidden', id !== 'map');
  if (id === 'map' && refs.map) {
    setTimeout(() => google.maps.event.trigger(refs.map, 'resize'), 50);
  }
}

/** Show a self-dismissing error toast. */
export function showError(message) {
  const toast = $('error-toast');
  $('error-text').textContent = message;
  toast.classList.remove('hidden', 'anim-fade-out');
  toast.classList.add('anim-fade-in');

  clearTimeout(refs.errorTimeout);
  refs.errorTimeout = setTimeout(() => {
    toast.classList.remove('anim-fade-in');
    toast.classList.add('anim-fade-out');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 4000);
}

export function showLoading(text) {
  $('loading-text').textContent = text;
  $('loading-overlay').classList.remove('hidden');
}

export function hideLoading() {
  $('loading-overlay').classList.add('hidden');
}

/** Speak a phrase hands-free, cancelling anything already playing. */
export function speakText(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}
