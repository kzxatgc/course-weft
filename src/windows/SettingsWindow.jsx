import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Play } from 'lucide-react';
import {
  isSoundEnabled,
  toggleSound,
  subscribeSound,
  playSound,
} from '../audio/optional-sounds.js';

/**
 * Settings window content — lets the user preview and select a color theme,
 * and toggle optional interaction sound cues.
 * The chosen preferences persist locally in localStorage.
 */
export default function SettingsWindow({ themes, themeId, onSelectTheme }) {
  const [soundActive, setSoundActive] = useState(() => isSoundEnabled());

  useEffect(() => {
    return subscribeSound((val) => setSoundActive(val));
  }, []);

  function handleToggleSound() {
    const nowEnabled = toggleSound();
    if (nowEnabled) {
      // Play popup chime as confirmation that sound is now on
      setTimeout(() => playSound('popup'), 50);
    }
  }

  function handleTestCue(cue) {
    if (!soundActive) {
      toggleSound();
    }
    setTimeout(() => {
      playSound(cue);
    }, 50);
  }

  return (
    <div className="nb-win-section">
      {/* ── Section 1: Color Themes ─────────────────────────────── */}
      <div className="nb-win-header">
        <h2 className="nb-win-heading">Color Themes</h2>
        <span className="nb-badge">Display only — demo preference</span>
      </div>

      <p className="nb-win-desc">
        Pick a five-color palette. Your choice is saved locally and applies across
        all windows. These are display preferences only — no account is changed.
      </p>

      {/* Theme grid */}
      <div className="nb-theme-grid" role="radiogroup" aria-label="Color theme selector">
        {themes.map((theme) => {
          const isActive = theme.id === themeId;
          return (
            <label
              key={theme.id}
              className={`nb-theme-card${isActive ? ' nb-theme-card--active' : ''}`}
              style={isActive ? { borderColor: theme.navy, boxShadow: `4px 4px 0 ${theme.navy}` } : {}}
              title={`Select ${theme.name} theme`}
            >
              <input
                type="radio"
                name="theme"
                value={theme.id}
                checked={isActive}
                onChange={() => onSelectTheme(theme.id)}
                className="sr-only"
                aria-label={`${theme.name}: ${theme.description}`}
              />

              {/* Five-swatch palette preview */}
              <div className="nb-swatch-row" aria-hidden="true">
                {[theme.yellow, theme.navy, theme.blue, theme.cream, theme.charcoal].map(
                  (color, i) => (
                    <span
                      key={i}
                      className="nb-swatch"
                      style={{ backgroundColor: color }}
                    />
                  )
                )}
              </div>

              {/* Labels */}
              <div className="nb-theme-meta">
                <span className="nb-theme-name">{theme.name}</span>
                {isActive && (
                  <span className="nb-theme-active-badge" aria-label="Currently active">
                    ✓ Active
                  </span>
                )}
              </div>
              <span className="nb-theme-desc">{theme.description}</span>
            </label>
          );
        })}
      </div>

      {/* ── Section Divider ─────────────────────────────────────── */}
      <div className="h-[2px] bg-[var(--color-navy)]/15 my-2" />

      {/* ── Section 2: Audio & Sound Cues (Task 29) ─────────────── */}
      <div className="nb-win-header">
        <h2 className="nb-win-heading">Sound Cues</h2>
      </div>

      <p className="nb-win-desc">
        Enable subtle sound cues for timetable actions like popup dialogs, redo, and undo.
      </p>

      {/* Main Sound Toggle Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white border-2 border-[var(--color-navy)] shadow-[3px_3px_0px_0px_var(--color-navy)]">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex items-center justify-center w-8 h-8 border-2 border-[var(--color-navy)] shrink-0 ${
              soundActive
                ? 'bg-[var(--color-yellow)] text-[var(--color-navy)]'
                : 'bg-slate-100 text-slate-500'
            }`}
            aria-hidden="true"
          >
            {soundActive ? (
              <Volume2 size={16} strokeWidth={2.5} />
            ) : (
              <VolumeX size={16} strokeWidth={2.5} />
            )}
          </div>
          <div>
            <span className="font-['Archivo_Black',sans-serif] text-xs uppercase text-[var(--color-navy)] block">
              Action Sound Cues
            </span>
            <span className="text-[10px] text-slate-600 block mt-0.5">
              Play chime on preview discovery, apply, and undo
            </span>
          </div>
        </div>

        {/* Toggle Button */}
        <button
          id="settings-sound-toggle"
          type="button"
          onClick={handleToggleSound}
          aria-pressed={soundActive}
          aria-label={soundActive ? 'Sound cues are currently On. Click to mute.' : 'Sound cues are currently Muted. Click to enable.'}
          className={`px-3 py-1.5 font-mono text-[11px] font-black uppercase tracking-wider border-2 border-[var(--color-navy)] transition-colors cursor-pointer shrink-0 ${
            soundActive
              ? 'bg-[var(--color-navy)] text-[var(--color-yellow)] hover:bg-[var(--color-yellow)] hover:text-[var(--color-navy)]'
              : 'bg-white text-[var(--color-navy)] hover:bg-slate-100'
          }`}
        >
          {soundActive ? '✓ Sound: On' : '✕ Sound: Muted'}
        </button>
      </div>



      {/* Contrast info */}
      <div className="nb-win-footer-note mt-2">
        <span>Preferences are saved automatically in your browser's local storage.</span>
      </div>
    </div>
  );
}
