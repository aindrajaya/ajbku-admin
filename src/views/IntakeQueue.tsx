import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, tokenManager } from '../api/client';
import { Inbox, FileText, Send, Building, User, MapPin } from 'lucide-react';

export default function IntakeQueue() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form States
  const [officeId, setOfficeId] = useState('off-1');
  const [clientProfileId, setClientProfileId] = useState('cli-1');
  const [serviceCategoryId, setServiceCategoryId] = useState('cat-1');
  const [title, setTitle] = useState('');
  const [landProvinceCode, setLandProvinceCode] = useState('35'); // Default: Jawa Timur
  const [landCityCode, setLandCityCode] = useState('3519'); // Default: Kab Madiun
  const [landCertificateNumber, setLandCertificateNumber] = useState('');
  const [transactionValue, setTransactionValue] = useState('');
  
  const [error, setError] = useState<string | null>(null);

  // Fetch offices
  const tenantId = tokenManager.getSync('tenantId') || 'tenant-id';
  const { data: offices = [] } = useQuery({
    queryKey: ['offices', tenantId],
    enabled: tenantId !== 'tenant-id',
    queryFn: async () => {
      const res = await api.get(`/api/v1/tenants/${tenantId}/offices`);
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    }
  });

  const safeOffices = Array.isArray(offices) ? offices : [];

  // Sample static data for dropdown selections (in addition to DB mock fields)
  const clients = [
    { id: 'cli-1', name: 'Budi Santoso (budi@gmail.com)' },
    { id: 'cli-2', name: 'Ratna Dewi (ratna@gmail.com)' },
    { id: 'cli-3', name: 'Hendra Wijaya (hendra@gmail.com)' }
  ];

  const services = [
    { id: 'cat-1', name: 'Akta Jual Beli (AJB)' },
    { id: 'cat-2', name: 'Akta Hibah' },
    { id: 'cat-3', name: 'Akta Pemberian Hak Tanggungan (APHT)' },
    { id: 'cat-4', name: 'Akta Pembagian Hak Bersama (APHB)' }
  ];

  const provinces = [
    { code: '31', name: 'DKI Jakarta' },
    { code: '32', name: 'Jawa Barat' },
    { code: '35', name: 'Jawa Timur' }
  ];

  const cities: Record<string, { code: string; name: string }[]> = {
    '31': [
      { code: '3171', name: 'Kota Jakarta Pusat' },
      { code: '3173', name: 'Kota Jakarta Barat' },
      { code: '3174', name: 'Kota Jakarta Selatan' }
    ],
    '32': [
      { code: '3273', name: 'Kota Bandung' },
      { code: '3204', name: 'Kabupaten Bandung' }
    ],
    '35': [
      { code: '3519', name: 'Kabupaten Madiun' },
      { code: '3578', name: 'Kota Surabaya' },
      { code: '3577', name: 'Kota Madiun' }
    ]
  };

  const createMatterMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/api/v1/matters', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      alert(`Pengajuan perkara ${data.caseNumber} berhasil dibuat!`);
      navigate(`/matters/${data.id}`);
    },
    onError: (err) => {
      setError('Gagal membuat pengajuan perkara baru. Silakan periksa kembali input Anda.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !officeId || !clientProfileId || !serviceCategoryId || !landProvinceCode || !landCityCode) {
      setError('Harap isi semua kolom wajib (*)');
      return;
    }

    createMatterMutation.mutate({
      officeId,
      clientProfileId,
      serviceCategoryId,
      title,
      landProvinceCode,
      landCityCode,
      landCertificateNumber: landCertificateNumber || undefined,
      transactionValue: Number(transactionValue) || 0
    });
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Inbox size={28} style={{ color: 'var(--color-emerald)' }} />
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Buat Pengajuan Baru</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Daftarkan berkas perkara jual beli (AJB), hibah, atau hak tanggungan baru ke sistem.
          </p>
        </div>
      </div>

      {error && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          color: '#f87171',
          padding: '1rem',
          borderRadius: '8px',
          fontSize: '0.9rem'
        }}>
          {error}
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Title */}
        <div className="input-group">
          <label className="input-label">Nama/Judul Perkara *</label>
          <div style={{ position: 'relative' }}>
            <FileText size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="input-field" 
              style={{ paddingLeft: '2.75rem' }} 
              placeholder="Contoh: Akta Jual Beli Ruko Jl. Ahmad Yani - Budi"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          
          {/* Office Selection */}
          <div className="input-group">
            <label className="input-label">Kantor Pengelola *</label>
            <div style={{ position: 'relative' }}>
              <Building size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <select 
                className="input-field select-field" 
                style={{ paddingLeft: '2.75rem' }}
                value={officeId}
                onChange={(e) => setOfficeId(e.target.value)}
              >
                {safeOffices.map((o: any) => (
                  <option key={o.id} value={o.id} style={{ background: 'var(--bg-secondary)' }}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Client Selection */}
          <div className="input-group">
            <label className="input-label">Klien Pemohon *</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <select 
                className="input-field select-field" 
                style={{ paddingLeft: '2.75rem' }}
                value={clientProfileId}
                onChange={(e) => setClientProfileId(e.target.value)}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id} style={{ background: 'var(--bg-secondary)' }}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          
          {/* Service Category */}
          <div className="input-group">
            <label className="input-label">Jenis Layanan / Akta *</label>
            <select 
              className="input-field select-field"
              value={serviceCategoryId}
              onChange={(e) => setServiceCategoryId(e.target.value)}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id} style={{ background: 'var(--bg-secondary)' }}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Transaction Value */}
          <div className="input-group">
            <label className="input-label">Nilai Transaksi (Rp)</label>
            <input 
              type="number" 
              className="input-field" 
              placeholder="Contoh: 500000000"
              value={transactionValue}
              onChange={(e) => setTransactionValue(e.target.value)}
            />
          </div>

        </div>

        {/* Region Lookups */}
        <div style={{
          padding: '1.5rem',
          background: 'rgba(0,0,0,0.15)',
          borderRadius: '10px',
          border: '1px solid var(--border-glass)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={18} style={{ color: 'var(--color-gold)' }} />
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Detail Lokasi & Sertifikat Tanah</h4>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            
            {/* Province Selection */}
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Provinsi *</label>
              <select 
                className="input-field select-field"
                value={landProvinceCode}
                onChange={(e) => {
                  const provCode = e.target.value;
                  setLandProvinceCode(provCode);
                  setLandCityCode(cities[provCode][0].code); // Auto-set first city
                }}
              >
                {provinces.map((p) => (
                  <option key={p.code} value={p.code} style={{ background: 'var(--bg-secondary)' }}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* City Selection */}
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Kabupaten / Kota *</label>
              <select 
                className="input-field select-field"
                value={landCityCode}
                onChange={(e) => setLandCityCode(e.target.value)}
              >
                {cities[landProvinceCode]?.map((c) => (
                  <option key={c.code} value={c.code} style={{ background: 'var(--bg-secondary)' }}>{c.name}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Certificate Number */}
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Nomor Sertifikat Tanah (Opsional)</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Contoh: SHM No. 9982/Kel. Oro-Oro Ombo"
              value={landCertificateNumber}
              onChange={(e) => setLandCertificateNumber(e.target.value)}
            />
          </div>

        </div>

        {/* Submit */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => navigate('/')}
          >
            Batal
          </button>
          
          <button 
            type="submit" 
            disabled={createMatterMutation.isPending}
            className="btn btn-primary"
          >
            <Send size={16} />
            {createMatterMutation.isPending ? 'Menyimpan...' : 'Daftarkan Pengajuan'}
          </button>
        </div>

      </form>

    </div>
  );
}
