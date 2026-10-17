import React from 'react';

/**
 * WebsiteInfo window content — Academic Planning Demonstration.
 *
 * Clearly discloses that this application uses synthetic sample data only
 * and does NOT connect to or submit to a real university registration system.
 */
export default function WebsiteInfo() {
  return (
    <div className="nb-win-section" id="website-info-content">
      {/* ── Section header ───────────────────────────────────────── */}
      <div className="nb-win-header">
        <h2 className="nb-win-heading">Academic Planning Demonstration</h2>
        <span className="nb-badge">(Synthetic Data)</span>
      </div>

      {/* ── Synthetic-data disclosure ─────────────────────────────── */}
      <div
        className="nb-info-disclosure"
        role="note"
        aria-label="Synthetic data disclosure"
        id="website-info-disclosure"
      >
        <p className="nb-info-disclosure-heading">
          SYNTHETIC SAMPLE DATA — NO REAL REGISTRATION IS SUBMITTED
        </p>
        <p className="nb-info-disclosure-body">
          Student and lecturer names, course details, meeting times, and seat
          availability shown here are fictional sample data for local
          demonstration only. This portal does not connect to live university
          registration records.
        </p>
      </div>

      {/* ── Description ──────────────────────────────────────────── */}
      <div className="nb-info-section" id="website-info-description">
        <p className="nb-info-section-heading">
          ACADEMIC PLANNING / REGISTRATION WORKSPACE
        </p>
        <p className="nb-win-desc">
          Build your weekly schedule with immediate conflict feedback and
          automated repair suggestions. All changes remain in your local draft
          until submitted.
        </p>
      </div>

      {/* ── Footer note ──────────────────────────────────────────── */}
      <div className="nb-win-footer-note">
        <span>
          No network requests are made. No data is sent to any external system.
        </span>
      </div>
    </div>
  );
}
