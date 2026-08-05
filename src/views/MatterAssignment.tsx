import React, { useMemo, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, MapPin, UserCheck } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { notifyError, notifySuccess } from '../store/ui';

const CORE_DOC_TYPES = ['ktp', 'npwp', 'sertifikat', 'pbb', 'kk'];

function normalizeDocumentType(value: unknown) {
  const raw = String(value || '').toLowerCase();
  if (raw === 'sppt_pbb') return 'pbb';
  if (raw === 'other') return 'lainnya';
  if (raw.includes('ktp')) return 'ktp';
  if (raw.includes('kk')) return 'kk';
  if (raw.includes('npwp')) return 'npwp';
  if (raw.includes('pbb')) return 'pbb';
  if (raw.includes('sertifikat')) return 'sertifikat';
  return raw;
}

export default function MatterAssignment() {
  const { id: matterId } = useParams({ strict: false }) as { id: string };
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [selectedNotaryId, setSelectedNotaryId] = useState<string | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const matterQuery = useQuery({
    queryKey: ['matters', matterId],
    queryFn: async () => (await api.get(`/api/v1/matters/${matterId}`)).data,
  });

  const matter = matterQuery.data;
  const rawDocuments = Array.isArray((matter as any)?.documents) ? (matter as any).documents : [];
  const documents = rawDocuments.map((doc: any) => ({
    type: normalizeDocumentType(doc.docType || doc.documentType || doc.document_type),
    status: String(doc.status || doc.verificationStatus || doc.verification_status || '').toLowerCase(),
  }));

  const hasUnvalidatedCoreDocs = useMemo(() => {
    const uploadedCoreDocs = documents.filter((doc: { type: string; status: string }) => CORE_DOC_TYPES.includes(doc.type));
    if (!uploadedCoreDocs.length) return true;
    return uploadedCoreDocs.some((doc: { type: string; status: string }) => !['validated', 'verified'].includes(doc.status));
  }, [documents]);

  const fetchRecommendationsMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/api/v1/matters/${matterId}/assignment/recommendations`);
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
    onSuccess: (items) => {
      setRecommendations(items);
      if (!items.length) {
        notifyError('Tidak ada notaris yang cocok untuk wilayah perkara ini.');
      }
    },
    onError: () => notifyError('Gagal menghasilkan rekomendasi notaris.'),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedNotaryId) throw new Error('No notary selected.');
      return api.post(`/api/v1/matters/${matterId}/assignment/decide`, { notaryId: selectedNotaryId });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['matters', matterId] });
      await queryClient.invalidateQueries({ queryKey: ['matters'] });
      notifySuccess('Notaris berhasil ditugaskan untuk perkara ini.');
    },
    onError: () => notifyError('Gagal menetapkan penugasan notaris.'),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectReason.trim()) throw new Error('Alasan penolakan wajib diisi.');
      return api.post(`/api/v1/matters/${matterId}/assignment/reject`, { reason: rejectReason.trim() });
    },
    onSuccess: async () => {
      setRecommendations([]);
      setShowRejectDialog(false);
      setRejectReason('');
      await queryClient.invalidateQueries({ queryKey: ['matters', matterId] });
      notifySuccess('Rekomendasi berhasil ditolak.');
    },
    onError: (error: any) => notifyError(error?.message || 'Gagal menolak rekomendasi notaris.'),
  });

  if (matterQuery.isLoading) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Memuat data assignment...</div>;
  }

  if ((matter as any)?.assignmentStatus === 'assigned' || (matter as any)?.assignmentStatus === 'accepted') {
    return (
      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
        <CheckCircle2 size={40} style={{ color: 'var(--color-emerald)' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Notaris sudah ditugaskan</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Perkara ini sudah berada pada tahap notary assignment.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <UserCheck size={28} style={{ color: 'var(--color-emerald)' }} />
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Assignment Notaris</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Wilayah perkara: {(matter as any)?.landCityCode || '-'} • {(matter as any)?.title || 'Perkara'}
          </p>
        </div>
      </div>

      {hasUnvalidatedCoreDocs ? (
        <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid rgba(217,119,6,0.3)', background: 'rgba(217,119,6,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--color-gold)' }}>
            <AlertTriangle size={18} />
            <strong>Assignment diblokir sampai dokumen inti tervalidasi.</strong>
          </div>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Halaman ini tidak akan menampilkan tombol assign selama dokumen inti masih belum berstatus `validated`.
          </p>
        </div>
      ) : null}

      {!hasUnvalidatedCoreDocs ? (
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 600 }}>Rekomendasi kandidat notaris</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Gunakan rekomendasi berdasarkan wilayah kerja dan availability.</div>
          </div>
          <button onClick={() => fetchRecommendationsMutation.mutate()} className="btn btn-primary" disabled={fetchRecommendationsMutation.isPending}>
            {fetchRecommendationsMutation.isPending ? 'Memuat...' : 'Dapatkan Rekomendasi'}
          </button>
        </div>
      ) : null}

      {!hasUnvalidatedCoreDocs && recommendations.length === 0 && !fetchRecommendationsMutation.isPending ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <MapPin size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 0.75rem' }} />
          <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Belum ada rekomendasi notaris</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Jalankan generator rekomendasi. Jika hasil kosong, principal dapat menambah notaris baru.
          </div>
          {user?.roles?.includes('PRINCIPAL') || user?.roles?.includes('SUPER_ADMIN') ? (
            <Link to="/settings" className="btn btn-secondary" style={{ marginTop: '1rem', display: 'inline-flex' }}>
              Tambah Notaris
            </Link>
          ) : null}
        </div>
      ) : null}

      {recommendations.length > 0 ? (
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {recommendations.map((item: any) => {
            const candidateId = item.notaryProfileId || item.notary_profile_id || item.id;
            const name = item.fullName || item.notaryProfile?.user?.fullName || 'Notary Candidate';
            const distance = item.distanceKm || 0;
            const activeMatters = item.activeMattersCount || 0;
            return (
              <button
                key={candidateId}
                type="button"
                onClick={() => setSelectedNotaryId(candidateId)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '1rem',
                  borderRadius: '10px',
                  border: selectedNotaryId === candidateId ? '1px solid var(--color-emerald)' : '1px solid var(--border-glass)',
                  background: selectedNotaryId === candidateId ? 'rgba(16,185,129,0.08)' : 'rgba(0,0,0,0.15)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <strong>{name}</strong>
                  <span style={{ color: 'var(--color-emerald)', fontSize: '0.8rem' }}>SLA {item.slaPerformanceScore || item.performance_score || 80}%</span>
                </div>
                <div style={{ marginTop: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  {item.scoreReason || 'Sesuai cakupan wilayah dan beban kerja.'}
                </div>
                <div style={{ marginTop: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  Jarak: {distance} km • Kasus aktif: {activeMatters}
                </div>
              </button>
            );
          })}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowRejectDialog(true)}>
              Tolak Rekomendasi
            </button>
            <button type="button" className="btn btn-primary" disabled={!selectedNotaryId || assignMutation.isPending} onClick={() => assignMutation.mutate()}>
              Konfirmasi Assignment
            </button>
          </div>
        </div>
      ) : null}

      {showRejectDialog ? (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'grid', placeItems: 'center', zIndex: 120 }}>
          <div className="glass-panel animate-fade-in" style={{ width: '420px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h5 style={{ fontSize: '1rem', fontWeight: 700 }}>Tolak Rekomendasi Notaris</h5>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Alasan Penolakan *</label>
              <textarea className="input-field" rows={4} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowRejectDialog(false); setRejectReason(''); }}>
                Batal
              </button>
              <button type="button" className="btn btn-primary" onClick={() => rejectMutation.mutate()}>
                Kirim Penolakan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
