import React from 'react';

/** Profile window content for Bill Andrew. */
export default function ProfileWindow() {
  return (
    <div className="nb-win-section">
      {/* Avatar + name header */}
      <div className="nb-win-header">
        <div className="nb-profile-avatar" aria-hidden="true">BA</div>
        <div>
          <h2 className="nb-win-heading">Bill Andrew</h2>
        </div>
      </div>

      <div className="nb-divider" />

      {/* Profile details */}
      <dl className="nb-profile-grid">
        <div className="nb-profile-row">
          <dt className="nb-profile-label">Student ID</dt>
          <dd className="nb-profile-value">BA-20250001</dd>
        </div>
        <div className="nb-profile-row">
          <dt className="nb-profile-label">Program</dt>
          <dd className="nb-profile-value">B.Sc. Computer Science</dd>
        </div>
        <div className="nb-profile-row">
          <dt className="nb-profile-label">Year</dt>
          <dd className="nb-profile-value">Year 2</dd>
        </div>
        <div className="nb-profile-row">
          <dt className="nb-profile-label">Semester</dt>
          <dd className="nb-profile-value">202620271</dd>
        </div>
        <div className="nb-profile-row">
          <dt className="nb-profile-label">Academic advisor</dt>
          <dd className="nb-profile-value">Dr. J. Smith</dd>
        </div>
      </dl>
    </div>
  );
}
