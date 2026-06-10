import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, tokenManager } from '../api/client';
import { FilePlus, ArrowLeft, Building, User, FileText, Calculator, MapPin, CheckCircle } from 'lucide-react';

export default function IntakeNew() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const tenantId = tokenManager.getSync('tenantId') || 'tenant-id';

  // Form states
  const [officeId, setOfficeId] = useState('');
  const [clientProfileId, setClientProfileId] = useState('');
  const [serviceCategoryId, setServiceCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [landCityCode, setLandCityCode] = useState('');
  const [landProvinceCode, setLandProvinceCode] = useState('');
  const [landCertificateNumber, setLandCertificateNumber] = useState('');
  const [transactionValue, setTransactionValue] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Fee calculation state
  const [calculatedFee, setCalculatedFee] = useState<number | null>(null);

  const { data: offices = [] } = useQuery({
    queryKey: ['offices', tenantId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/tenants/${tenantId}/offices`);
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    }
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['service-categories'],
    queryFn: async () => {
      const res = await api.get('/api/v1/matters/service-categories');
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    }
  });

  // Extract client profiles from existing matters as a fallback
  const { data: matters = [] } = useQuery({
    queryKey: ['matters-raw-list'],
    queryFn: async () => {
      const res = await api.get('/api/v1/matters');
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    }
  });

  const uniqueClients = React.useMemo(() => {
    const clientsMap = new Map();
    matters.forEach((m: any) => {
      if (m?.clientProfileId && m?.clientName) {
        clientsMap.set(m.clientProfileId, m.clientName);
      }
    });
    // Fallbacks if no matters exist
    if (clientsMap.size === 0) {
      clientsMap.set('cli-1', 'Budi Santoso');
      clientsMap.set('cli-2', 'Ratna Dewi');
      clientsMap.set('cli-3', 'Hendra Wijaya');
    }
    return Array.from(clientsMap.entries()).map(([id, name]) => ({ id, name }));
  }, [matters]);

  // Set default selection
  useEffect(() => {
    if (offices.length > 0) setOfficeId(offices[0].id || offices[0].officeId);
    if (categories.length > 0) setServiceCategoryId(categories[0].id);
    if (uniqueClients.length > 0) setClientProfileId(uniqueClients[0].id);
  }, [offices, categories, uniqueClients]);

  // Mutation for matter creation
  const createMatterMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await api.post('/api/v1/matters', payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      alert('Perkara baru berhasil didaftarkan!');
      navigate('/matters');
    },
    onError: (err: any) => {
      console.error(err);
      alert('Gagal membuat perkara baru. Harap periksa kembali input Anda.');
    }
  });

  const handleCalculateFee = () => {
    // Basic standard pricing calculation rule
    // e.g. Honorarium: 1% of transactionValue, min 2.5jt
    const baseFee = Math.max(2500000, transactionValue * 0.01);
    setCalculatedFee(baseFee);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!officeId || !clientProfileId || !serviceCategoryId || !title) {
      alert('Mohon isi kolom wajib: Kantor, Klien, Kategori Layanan, dan Judul Perkara.');
      return;
    }

    createMatterMutation.mutate({
      officeId,
      clientProfileId,
      serviceCategoryId,
      title,
      landCityCode: landCityCode || undefined,
      landProvinceCode: landProvinceCode || undefined,
      landCertificateNumber: landCertificateNumber || undefined,
      transactionValue: Number(transactionValue) || undefined,
      notes: notes || undefined
    });
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '850px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Buat Perkara Baru</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Daftarkan minuta akta pertanahan baru atas nama Klien.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
        
        {/* Left Column: Form Fields */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Kantor Penempatan (Office) *</label>
            <div style={{ position: 'relative' }}>
              <Building size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <select 
                value={officeId} 
                onChange={(e) => setOfficeId(e.target.value)}
                className="input-field select-field"
                style={{ paddingLeft: '2.75rem' }}
                required
              >
                {offices.map((o: any) => (
                  <option key={o.id || o.officeId} value={o.id || o.officeId} style={{ background: 'var(--bg-secondary)' }}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Klien Utama *</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <select 
                value={clientProfileId} 
                onChange={(e) => setClientProfileId(e.target.value)}
                className="input-field select-field"
                style={{ paddingLeft: '2.75rem' }}
                required
              >
                {uniqueClients.map((c: any) => (
                  <option key={c.id} value={c.id} style={{ background: 'var(--bg-secondary)' }}>
                    {c.name} (ID: {c.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Kategori Layanan *</label>
            <div style={{ position: 'relative' }}>
              <FileText size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <select 
                value={serviceCategoryId} 
                onChange={(e) => setServiceCategoryId(e.target.value)}
                className="input-field select-field"
                style={{ paddingLeft: '2.75rem' }}
                required
              >
                {categories.map((cat: any) => (
                  <option key={cat.id} value={cat.id} style={{ background: 'var(--bg-secondary)' }}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Judul Perkara (Title) *</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Contoh: AJB Ruko Margonda Raya 12"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Catatan Deskripsi Perkara</label>
            <textarea 
              className="input-field" 
              rows={3}
              placeholder="Catatan tambahan untuk proses verifikasi dokumen"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ resize: 'none' }}
            />
          </div>

        </div>

        {/* Right Column: Object & Calculation Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Land object details */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
              <MapPin size={16} style={{ color: 'var(--color-emerald)' }} />
              Objek Sertifikat & Wilayah
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label" style={{ fontSize: '0.75rem' }}>Kode Provinsi</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="32" 
                  value={landProvinceCode}
                  onChange={(e) => setLandProvinceCode(e.target.value)}
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label" style={{ fontSize: '0.75rem' }}>Kode Kota/Kab</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="3201" 
                  value={landCityCode}
                  onChange={(e) => setLandCityCode(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ fontSize: '0.75rem' }}>Nomor Sertifikat Hak Tanah</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="No. Sertifikat Hak Milik (SHM) / HGB" 
                value={landCertificateNumber}
                onChange={(e) => setLandCertificateNumber(e.target.value)}
              />
            </div>
          </div>

          {/* Calculator Card */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
              <Calculator size={16} style={{ color: 'var(--color-gold)' }} />
              Kalkulator Tarif Layanan
            </h3>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ fontSize: '0.75rem' }}>Nilai Objek Transaksi (Rp)</label>
              <input 
                type="number" 
                className="input-field" 
                placeholder="500000000" 
                value={transactionValue || ''}
                onChange={(e) => setTransactionValue(Number(e.target.value))}
              />
            </div>

            <button 
              type="button" 
              onClick={handleCalculateFee} 
              className="btn btn-secondary" 
              style={{ width: '100%', padding: '0.5rem' }}
            >
              Hitung Estimasi Biaya
            </button>

            {calculatedFee !== null && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(217, 119, 6, 0.08)',
                border: '1px solid rgba(217, 119, 6, 0.2)',
                borderRadius: '8px',
                fontSize: '0.85rem'
              }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Estimasi Biaya Jasa</span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--color-gold)' }}>
                  Rp {calculatedFee.toLocaleString('id-ID')}
                </strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                  *Belum termasuk BPHTB, PPh, & PNBP resmi BPN
                </span>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={createMatterMutation.isPending}
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: 'auto', padding: '0.85rem' }}
          >
            <CheckCircle size={18} />
            {createMatterMutation.isPending ? 'Mendaftarkan...' : 'Daftarkan Perkara'}
          </button>

        </div>

      </form>

    </div>
  );
}
