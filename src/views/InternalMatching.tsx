import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, GitBranch, MapPin, RotateCcw, Search, UserCheck } from 'lucide-react';
import { api } from '../api/client';
import { NotaryCandidateCard } from '../components/NotaryCandidateCard';
import { buildMatterListParams, extractMatterList } from '../lib/matters';
import { getApiErrorMessage } from '../lib/apiError';
import {
  assignMatterToNotary,
  listNotaryPartnerRecommendations,
  type NotaryPartnerRecommendation,
} from '../lib/notaryPartners';
import { notifyError, notifySuccess } from '../store/ui';
import { MATTER_ASSIGNMENT_STATUS, MATTER_WORKFLOW_STATUS } from './Matters';

const MATCHING_WORKFLOW_STATUSES = ['documents_verified', 'assignment_pending'] as const;

function getMatterId(matter: any) {
  return String(matter?.id || '');
}

function getMatterTitle(matter: any) {
  return matter?.title || matter?.matterTitle || matter?.matter_title || 'Perkara AJB';
}

function getMatterNumber(matter: any) {
  return matter?.caseNumber || matter?.case_number || matter?.matterNumber || matter?.matter_number || matter?.id || '-';
}

function getLandCity(matter: any) {
  return matter?.landCityCode || matter?.land_city_code || matter?.landCity || matter?.land_city || '-';
}

function getWorkflowStatus(matter: any) {
  return matter?.workflowStatus || matter?.workflow_status || '';
}

function getAssignmentStatus(matter: any) {
  return matter?.assignmentStatus || matter?.assignment_status || 'unassigned';
}

function dedupeAssignableMatters(...matterGroups: any[][]) {
  const map = new Map<string, any>();
  matterGroups.flat().forEach((matter) => {
    const id = getMatterId(matter);
    const assignmentStatus = getAssignmentStatus(matter);
    if (!id || assignmentStatus === 'assigned' || assignmentStatus === 'accepted') return;
    if (!map.has(id)) map.set(id, matter);
  });
  return Array.from(map.values());
}

export default function InternalMatching() {
  const queryClient = useQueryClient();
  const [selectedMatterId, setSelectedMatterId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [recommendations, setRecommendations] = useState<NotaryPartnerRecommendation[]>([]);
  const [selectedNotaryId, setSelectedNotaryId] = useState<string | null>(null);

  const documentsVerifiedQuery = useQuery({
    queryKey: ['matters', { workflowStatus: 'documents_verified', internalMatching: true }],
    queryFn: async () => {
      const res = await api.get('/api/v1/matters', buildMatterListParams({ workflowStatus: 'documents_verified' }));
      return extractMatterList(res.data);
    },
  });

  const assignmentPendingQuery = useQuery({
    queryKey: ['matters', { workflowStatus: 'assignment_pending', internalMatching: true }],
    queryFn: async () => {
      const res = await api.get('/api/v1/matters', buildMatterListParams({ workflowStatus: 'assignment_pending' }));
      return extractMatterList(res.data);
    },
  });

  const matters = useMemo(
    () => dedupeAssignableMatters(
      Array.isArray(documentsVerifiedQuery.data) ? documentsVerifiedQuery.data : [],
      Array.isArray(assignmentPendingQuery.data) ? assignmentPendingQuery.data : []
    ),
    [assignmentPendingQuery.data, documentsVerifiedQuery.data]
  );

  const normalizedSearch = search.trim().toLowerCase();
  const filteredMatters = useMemo(() => {
    if (!normalizedSearch) return matters;
    return matters.filter((matter) => [
      getMatterNumber(matter),
      getMatterTitle(matter),
      getLandCity(matter),
      getWorkflowStatus(matter),
      getAssignmentStatus(matter),
    ].join(' ').toLowerCase().includes(normalizedSearch));
  }, [matters, normalizedSearch]);

  const selectedMatter = useMemo(
    () => matters.find((matter) => getMatterId(matter) === selectedMatterId) || null,
    [matters, selectedMatterId]
  );

  const isLoadingMatters = documentsVerifiedQuery.isLoading || assignmentPendingQuery.isLoading;
  const isFetchingMatters = documentsVerifiedQuery.isFetching || assignmentPendingQuery.isFetching;

  const fetchRecommendationsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMatterId) throw new Error('No matter selected.');
      return listNotaryPartnerRecommendations(selectedMatterId);
    },
    onSuccess: (items) => {
      setRecommendations(items);
      setSelectedNotaryId(null);
      if (!items.length) notifyError('Tidak ada notaris yang cocok untuk perkara ini.');
    },
    onError: (error) => notifyError(getApiErrorMessage(error, 'Gagal menghasilkan rekomendasi notaris.')),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMatterId || !selectedNotaryId) throw new Error('Matter atau notaris belum dipilih.');
      return assignMatterToNotary(selectedMatterId, selectedNotaryId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['matters'] });
      setRecommendations([]);
      setSelectedNotaryId(null);
      setSelectedMatterId(null);
      notifySuccess('Notaris berhasil ditugaskan untuk perkara ini.');
    },
    onError: (error) => notifyError(getApiErrorMessage(error, 'Gagal menetapkan penugasan notaris.')),
  });

  const refreshQueue = () => {
    void documentsVerifiedQuery.refetch();
    void assignmentPendingQuery.refetch();
  };

  const selectMatter = (matterId: string) => {
    setSelectedMatterId(matterId);
    setRecommendations([]);
    setSelectedNotaryId(null);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <GitBranch size={28} style={{ color: 'var(--color-emerald)' }} />
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Internal Matching</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Pilih perkara yang siap assignment, generate rekomendasi, lalu tetapkan notaris mitra.
            </p>
          </div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={refreshQueue} disabled={isFetchingMatters}>
          <RotateCcw size={16} />
          {isFetchingMatters ? 'Memuat...' : 'Refresh'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 0.9fr) minmax(420px, 1.1fr)', gap: '1rem', alignItems: 'start' }}>
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={16} style={{ color: 'var(--color-gold)' }} />
              <strong>Queue Assignment</strong>
              <span className="badge badge-gray">{matters.length} perkara</span>
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-field"
                style={{ padding: '0.5rem 1rem 0.5rem 2rem', fontSize: '0.85rem' }}
                placeholder="Cari nomor, judul, kota, atau status"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {isLoadingMatters ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Memuat queue matching...
              </div>
            ) : filteredMatters.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {matters.length === 0 ? 'Tidak ada perkara yang membutuhkan assignment.' : 'Tidak ada perkara yang cocok dengan pencarian.'}
              </div>
            ) : (
              filteredMatters.map((matter) => {
                const matterId = getMatterId(matter);
                const workflow = getWorkflowStatus(matter);
                const assignment = getAssignmentStatus(matter);
                const workflowMeta = MATTER_WORKFLOW_STATUS[workflow] || { label: workflow || '-', className: 'badge-gray' };
                const assignmentMeta = MATTER_ASSIGNMENT_STATUS[assignment] || { label: assignment || '-', className: 'badge-gray' };
                const selected = selectedMatterId === matterId;

                return (
                  <button
                    key={matterId}
                    type="button"
                    onClick={() => selectMatter(matterId)}
                    style={{
                      padding: '1rem 1.25rem',
                      textAlign: 'left',
                      border: 0,
                      borderBottom: '1px solid var(--border-glass)',
                      background: selected ? 'rgba(16,185,129,0.08)' : 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <strong>{getMatterTitle(matter)}</strong>
                      <span style={{ fontFamily: 'monospace', color: 'var(--color-emerald)', fontSize: '0.78rem' }}>{getMatterNumber(matter)}</span>
                    </div>
                    <div style={{ marginTop: '0.4rem', color: 'var(--text-muted)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={13} />
                      {getLandCity(matter)}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.65rem' }}>
                      <span className={`badge ${workflowMeta.className}`}>{workflowMeta.label}</span>
                      <span className={`badge ${assignmentMeta.className}`}>{assignmentMeta.label}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!selectedMatter ? (
            <div style={{ minHeight: '320px', display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div>
                <UserCheck size={40} style={{ margin: '0 auto 0.75rem' }} />
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>Pilih perkara</div>
                <div style={{ fontSize: '0.85rem' }}>Pilih satu perkara dari queue untuk melihat rekomendasi notaris.</div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>{getMatterNumber(selectedMatter)}</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{getMatterTitle(selectedMatter)}</h3>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.35rem' }}>
                  Wilayah perkara: {getLandCity(selectedMatter)}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Rekomendasi kandidat notaris</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Generate kandidat untuk perkara terpilih.</div>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => fetchRecommendationsMutation.mutate()} disabled={fetchRecommendationsMutation.isPending}>
                  {fetchRecommendationsMutation.isPending ? 'Memuat...' : 'Dapatkan Rekomendasi'}
                </button>
              </div>

              {recommendations.length === 0 && !fetchRecommendationsMutation.isPending ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', border: '1px dashed var(--border-glass)', borderRadius: '8px' }}>
                  Belum ada rekomendasi untuk perkara ini.
                </div>
              ) : null}

              {recommendations.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {recommendations.map((candidate) => (
                    <NotaryCandidateCard
                      key={candidate.notaryProfileId}
                      candidate={candidate}
                      selected={selectedNotaryId === candidate.notaryProfileId}
                      onSelect={setSelectedNotaryId}
                    />
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-primary" disabled={!selectedNotaryId || assignMutation.isPending} onClick={() => assignMutation.mutate()}>
                      {assignMutation.isPending ? 'Menyimpan...' : 'Konfirmasi Assignment'}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
