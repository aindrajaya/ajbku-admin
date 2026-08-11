import React from 'react';
import {
  canAssignNotaryPartner,
  formatCoverageAreas,
  getNotaryPartnerStatusMeta,
  getRatingLabel,
  getSlaLabel,
  getWorkloadLabel,
  type NotaryPartnerRecommendation,
} from '../lib/notaryPartners';

export function NotaryCandidateCard({
  candidate,
  selected,
  onSelect,
}: {
  candidate: NotaryPartnerRecommendation;
  selected: boolean;
  onSelect: (notaryProfileId: string) => void;
}) {
  const statusMeta = getNotaryPartnerStatusMeta(candidate.status);
  const canAssignCandidate = canAssignNotaryPartner(candidate);

  return (
    <button
      key={candidate.notaryProfileId}
      type="button"
      disabled={!canAssignCandidate}
      onClick={() => onSelect(candidate.notaryProfileId)}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '1rem',
        borderRadius: '10px',
        border: selected ? '1px solid var(--color-emerald)' : '1px solid var(--border-glass)',
        background: selected ? 'rgba(16,185,129,0.08)' : 'rgba(0,0,0,0.15)',
        color: canAssignCandidate ? 'var(--text-primary)' : 'var(--text-muted)',
        cursor: canAssignCandidate ? 'pointer' : 'not-allowed',
        opacity: canAssignCandidate ? 1 : 0.72,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <strong>{candidate.fullName}</strong>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className={`badge ${statusMeta.className}`}>{statusMeta.label}</span>
          <span className={`badge ${canAssignCandidate ? 'badge-green' : 'badge-gray'}`}>
            {canAssignCandidate ? 'Assignable' : 'Tidak bisa dipilih'}
          </span>
        </div>
      </div>
      <div style={{ marginTop: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
        {candidate.scoreReason}
      </div>
      <div style={{ marginTop: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        Coverage: {formatCoverageAreas(candidate.coverageAreas)}
      </div>
      <div style={{ marginTop: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        {getWorkloadLabel(candidate.activeMattersCount)} - {getSlaLabel(candidate.slaPerformanceScore)} - Rating: {getRatingLabel(candidate.rating)}
        {candidate.distanceKm > 0 ? ` - Jarak: ${candidate.distanceKm} km` : ''}
      </div>
      {!canAssignCandidate ? (
        <div style={{ marginTop: '0.45rem', color: '#fca5a5', fontSize: '0.75rem' }}>
          Hanya notaris approved dan siap assignment yang dapat dipilih.
        </div>
      ) : null}
    </button>
  );
}
