import React from 'react';

/**
 * Profile window content — shows the Bill Andrew demo persona.
 * This is a fictional display-only identity used to demonstrate the UI.
 * No real student account, authentication, or profile editing is involved.
 */
export default function ProfileWindow() {
  return (
    <div className="nb-win-section">
      {/* Avatar + name header */}
      <div className="nb-win-header">
        <div className="nb-profile-avatar" aria-hidden="true">BA</div>
        <div>
          <h2 className="nb-win-heading">Bill Andrew</h2>
          <span className="nb-badge">Demo persona — not a real student account</span>
        </div>
      </div>

      <div className="nb-divider" />

      {/* Profile details */}
      <dl className="nb-profile-grid">
        <div className="nb-profile-row">
          <dt className="nb-profile-label">Student ID</dt>
          <dd className="nb-profile-value">BA-20250001 <span className="nb-badge nb-badge--sm">Synthetic</span></dd>
        </div>
        <div className="nb-profile-row">
          <dt className="nb-profile-label">Program</dt>
          <dd className="nb-profile-value">B.Sc. Computer Science (Demo)</dd>
        </div>
        <div className="nb-profile-row">
          <dt className="nb-profile-label">Year</dt>
          <dd className="nb-profile-value">Year 2</dd>
        </div>
        <div className="nb-profile-row">
          <dt className="nb-profile-label">Semester</dt>
          <dd className="nb-profile-value">202520261</dd>
        </div>
        <div className="nb-profile-row">
          <dt className="nb-profile-label">Academic advisor</dt>
          <dd className="nb-profile-value">Dr. J. Smith (Sample)</dd>
        </div>
      </dl>

      <div className="nb-divider" />

      <div className="nb-win-footer-note">
        <strong>Demo persona only.</strong> Bill Andrew is a fictional student used to
        demonstrate the registration interface. No real enrollment record exists and no
        changes are submitted to any university system.
      </div>
    </div>
  );
}
