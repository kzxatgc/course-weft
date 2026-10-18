/**
 * optional-sounds.js
 *
 * Provides optional sound cues using Howler.js for key user interactions:
 *   - 'popup': a gentle chord when a modal / dialog appears
 *   - 'redo': an affirmative ascending chime when repair is applied
 *   - 'undo': a soft descending chime when repair is undone
 *
 * Constraints & Design Rules:
 *   - Default ON (sound enabled by default)
 *   - Persistent via localStorage ('course_weft_sound_enabled')
 *   - User-controlled toggle/mute
 *   - Plays ONLY after user gesture
 *   - Playback failure NEVER blocks state or throws
 *   - Text feedback remains fully sufficient
 *   - Safe in SSR/Node.js testing environments (no window/audio crash)
 */

import { Howl } from 'howler';

const STORAGE_KEY = 'course_weft_sound_enabled';

// Listeners for sound enabled state changes
const listeners = new Set();

/** Check if localStorage is available safely. Defaults to true (sound ON). */
function getStoredSoundPreference() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return true;
  }
  try {
    const val = window.localStorage.getItem(STORAGE_KEY);
    // If no preference stored yet, default is ON (true)
    if (val === null) return true;
    return val === 'true';
  } catch {
    return true;
  }
}

let soundEnabled = getStoredSoundPreference();

/**
 * Returns whether sound cues are currently enabled.
 * Default is TRUE (sound on by default).
 *
 * @returns {boolean}
 */
export function isSoundEnabled() {
  return soundEnabled;
}

/**
 * Enable or disable sound cues.
 * Persists choice to localStorage and notifies subscribers.
 *
 * @param {boolean} enabled
 */
export function setSoundEnabled(enabled) {
  soundEnabled = Boolean(enabled);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(soundEnabled));
    } catch {
      // Ignore storage errors
    }
  }
  listeners.forEach((fn) => {
    try {
      fn(soundEnabled);
    } catch {
      // Ignore listener error
    }
  });
}

/**
 * Toggle sound on / off.
 *
 * @returns {boolean} New sound enabled state
 */
export function toggleSound() {
  const next = !soundEnabled;
  setSoundEnabled(next);
  return next;
}

/**
 * Subscribe to sound enabled state changes.
 *
 * @param {(enabled: boolean) => void} fn
 * @returns {() => void} Unsubscribe function
 */
export function subscribeSound(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Lazy Howl instances map - created only in browser on first use
let howls = null;

function getHowls() {
  if (howls) return howls;
  if (typeof window === 'undefined') return null;

  try {
    const popupHowl = new Howl({
      src: ['/sounds/popup.wav', '/sounds/preview-found.wav'],
      volume: 0.45,
      preload: true,
    });
    const redoHowl = new Howl({
      src: ['/sounds/redo.wav', '/sounds/apply.wav'],
      volume: 0.5,
      preload: true,
    });
    const undoHowl = new Howl({
      src: ['/sounds/undo.wav'],
      volume: 0.45,
      preload: true,
    });

    howls = {
      popup: popupHowl,
      popupAudio: popupHowl,
      previewFound: popupHowl,
      redo: redoHowl,
      apply: redoHowl,
      undo: undoHowl,
    };
  } catch {
    howls = null;
  }

  return howls;
}

/**
 * Play a specific sound cue if sound is enabled.
 * Safe no-op if sound is disabled, in test environment, or if playback fails.
 *
 * Supported cues:
 *   - 'popup' (dialog / alert appearance)
 *   - 'redo' (redo repair action)
 *   - 'undo' (undo repair action)
 *
 * @param {'popup'|'redo'|'undo'|'previewFound'|'apply'} cue
 */
export function playSound(cue) {
  if (!soundEnabled) return;
  if (typeof window === 'undefined') return;

  try {
    const audioMap = getHowls();
    if (!audioMap) return;

    const sound = audioMap[cue];
    if (sound) {
      sound.play();
    }
  } catch (err) {
    // Playback failure cannot block state
    // Silently continue
  }
}

/**
 * Begin loading the local sound cues before the first interaction.
 * This does not play audio and respects the user's sound preference.
 */
export function preloadSounds() {
  if (typeof window === 'undefined') return;
  getHowls();
}
