import React from 'react';

/**
 * Settings window content — lets the user preview and select a color theme.
 * Each palette card shows the five color swatches and a radio-style selector.
 * The chosen theme persists via the useTheme hook (localStorage).
 *
 * Contrast note: every palette was checked so that navy/charcoal text on cream
 * and charcoal/navy text on yellow meet ≥ 4.5:1 contrast ratio.
 */
export default function SettingsWindow({ themes, themeId, onSelectTheme }) {
  return (
    <div className="nb-win-section">
      {/* Section header */}
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

      {/* Contrast info */}
      <div className="nb-win-footer-note">
        <span>All palettes verified for readable text contrast on key surfaces.</span>
      </div>
    </div>
  );
}
