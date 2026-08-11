import React from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Briefcase, MapPin, ShieldCheck, UserCheck } from 'lucide-react';
import {
  canAssignNotaryPartner,
  formatCoverageAreas,
  getNotaryPartnerById,
  getNotaryPartnerStatusMeta,
  getRatingLabel,
  getSlaLabel,
  getWorkloadLabel,
  listAssignedMattersForNotary,
} from '../lib/notaryPartners';
import { queryKeys } from '../lib/queryKeys';

function matterLabel(matter: any) {
  return matter?.caseNumber || matter?.case_number || matter?.matterNumber || matter?.matter_number || matter?.id || '-';
}

function matterTitle(matter: any) {
  return matter?.title || matter?.clientName || matter?.client_name || 'Perkara AJB';
}

function matterStatus(matter: any) {
  return matter?.workflowStatus || matter?.workflow_status || matter?.status || '-';
}

function assignmentStatus(matter: any) {
  return matter?.assignmentStatus || matter?.assignment_status || '-';
}

export default function NotaryPartnerDetail() {
  const { id } = useParams({ strict: false }) as { id: string };

  const partnerQuery = useQuery({
    queryKey: queryKeys.notaryPartnerDetail(id),
    queryFn: () => getNotaryPartnerById(id),
  });

  const assignedMattersQuery = useQuery({
    queryKey: queryKeys.notaryPartnerAssignedMatters(id),
    queryFn: () => listAssignedMattersForNotary(id),
    enabled: Boolean(partnerQuery.data),
  });

  const partner = partnerQuery.data;
  const assignedMatters = Array.isArray(assignedMattersQuery.data) ? assignedMattersQuery.data : [];

  if (partnerQuery.isLoading) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Memuat detail notaris mitra...</div>;
  }

  if (!partner) {
    return (
      <div className="glass-panel animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Link to="/notary-partners" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>
          <ArrowLeft size={16} />
          Kembali
        </Link>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Notaris mitra tidak ditemukan</h2>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Data notaris mitra ini tidak tersedia pada daftar partner saat ini.
          </p>
        </div>
      </div>
    );
  }

  const statusMeta = getNotaryPartnerStatusMeta(partner.status);
  const canAssign = canAssignNotaryPartner(partner);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <UserCheck size={30} style={{ color: 'var(--color-emerald)' }} />
          <div>
            <Link to="/notary-partners" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
              <ArrowLeft size={14} />
              Notaris Mitra
            </Link>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{partner.fullName}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Detail profil, cakupan wilayah, dan perkara aktif notaris mitra.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className={`badge ${statusMeta.className}`}>{statusMeta.label}</span>
          <span className={`badge ${canAssign ? 'badge-green' : 'badge-gray'}`}>
            {canAssign ? 'Siap Assignment' : 'Tidak Aktif'}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        <InfoCard icon={<ShieldCheck size={18} />} title="Profil & Legalitas">
          <DetailLine label="Nama" value={partner.fullName} />
          <DetailLine label="Lisensi" value={partner.licenseNumber} mono />
          <DetailLine label="Email" value={partner.email} />
          <DetailLine label="Telepon" value={partner.phone} />
        </InfoCard>

        <InfoCard icon={<MapPin size={18} />} title="Jurisdiksi & Coverage">
          <DetailLine label="Jurisdiksi" value={[partner.jurisdictionCity, partner.jurisdictionProvince].filter(Boolean).join(', ') || '-'} />
          <DetailLine label="Coverage" value={formatCoverageAreas(partner.coverageAreas)} />
        </InfoCard>

        <InfoCard icon={<Briefcase size={18} />} title="Workload & Kinerja">
          <DetailLine label="Workload" value={getWorkloadLabel(partner.activeMattersCount)} />
          <DetailLine label="SLA" value={getSlaLabel(partner.slaPerformanceScore)} />
          <DetailLine label="Rating" value={getRatingLabel(partner.rating)} />
        </InfoCard>
      </div>

      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Audit Status</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Audit status belum tersedia dari contract backend saat ini.
        </p>
      </div>

      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Perkara Aktif</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              Perkara yang saat ini ter-assign ke notaris mitra ini.
            </p>
          </div>
          {assignedMattersQuery.isFetching ? (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Memuat perkara...</span>
          ) : null}
        </div>

        {assignedMatters.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Belum ada perkara aktif untuk notaris ini.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem', fontFamily: 'var(--font-sans)' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.9rem 1.25rem', fontWeight: 600 }}>Nomor</th>
                <th style={{ padding: '0.9rem 1.25rem', fontWeight: 600 }}>Perkara</th>
                <th style={{ padding: '0.9rem 1.25rem', fontWeight: 600 }}>Workflow</th>
                <th style={{ padding: '0.9rem 1.25rem', fontWeight: 600 }}>Assignment</th>
              </tr>
            </thead>
            <tbody>
              {assignedMatters.map((matter: any) => (
                <tr key={matter?.id || matterLabel(matter)} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                  <td style={{ padding: '1rem 1.25rem', fontFamily: 'monospace', color: 'var(--color-emerald)', fontWeight: 700 }}>{matterLabel(matter)}</td>
                  <td style={{ padding: '1rem 1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>{matterTitle(matter)}</td>
                  <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)' }}>{matterStatus(matter)}</td>
                  <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)' }}>{assignmentStatus(matter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function InfoCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-gold)' }}>
        {icon}
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>{title}</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>{children}</div>
    </div>
  );
}

function DetailLine({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontFamily: mono ? 'monospace' : 'var(--font-sans)', wordBreak: 'break-word' }}>
        {value || '-'}
      </div>
    </div>
  );
}
