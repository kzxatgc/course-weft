import { useEffect, useState } from 'react';

const STORAGE_KEY = 'course-weft-keyboard-hints';
const CHANGE_EVENT = 'courseweft:keyboard-hints-change';

function readKeyboardHintsEnabled() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === null || saved === 'true';
  } catch {
    return true;
  }
}

function writeKeyboardHintsEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Keep the preference available for the current session when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: enabled }));
}

export function useKeyboardHints() {
  const [enabled, setEnabled] = useState(readKeyboardHintsEnabled);

  useEffect(() => {
    const handleChange = (event) => setEnabled(event.detail);
    window.addEventListener(CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(CHANGE_EVENT, handleChange);
  }, []);

  return [enabled, writeKeyboardHintsEnabled];
}
