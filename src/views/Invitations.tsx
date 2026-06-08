import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, tokenManager } from '../api/client';
import { UserPlus, Mail, Phone, Shield, Building, Send } from 'lucide-react';

export default function Invitations() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleCode, setRoleCode] = useState('client');
  const [officeId, setOfficeId] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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

  const inviteMutation = useMutation({
    mutationFn: async (payload: any) => {
      // POST /api/v1/tenants/{tenantId}/invite conforming to PRD Addendum v1.1
      await api.post(`/api/v1/tenants/${tenantId}/invite`, payload);
    },
    onSuccess: () => {
      setFullName('');
      setEmail('');
      setPhone('');
      setRoleCode('client');
      setOfficeId('');
      setSuccess(true);
      setError(null);
      setTimeout(() => setSuccess(false), 3000);
      alert('Tautan Undangan berhasil dikirim via Email!');
    },
    onError: () => {
      setError('Gagal mengirim undangan. Harap cek kembali kredensial email Anda.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !roleCode) {
      setError('Harap isi kolom nama lengkap, email, dan role.');
      return;
    }

    inviteMutation.mutate({
      fullName,
      email,
      phone: phone || undefined,
      roleCode,
      officeId: officeId || undefined
    });
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <UserPlus size={28} style={{ color: 'var(--color-emerald)' }} />
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Undang Staf & Klien</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Kirimkan email undangan berisi tautan registrasi instan untuk Notaris, Staf Intake, Moderator, atau Klien.
          </p>
        </div>
      </div>

      {success && (
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          color: '#34d399',
          padding: '1rem',
          borderRadius: '8px',
          fontSize: '0.9rem'
        }}>
          Undangan berhasil dikirim dan dicatat di Log Audit!
        </div>
      )}

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
      <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Full Name */}
        <div className="input-group">
          <label className="input-label">Nama Lengkap *</label>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Contoh: Ahmad Subagja, S.H."
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>

        {/* Email */}
        <div className="input-group">
          <label className="input-label">Email Tujuan *</label>
          <div style={{ position: 'relative' }}>
            <Mail size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="email" 
              className="input-field" 
              style={{ paddingLeft: '2.75rem' }} 
              placeholder="ahmad.subagja@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Phone */}
        <div className="input-group">
          <label className="input-label">Nomor Handphone (Opsional)</label>
          <div style={{ position: 'relative' }}>
            <Phone size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="tel" 
              className="input-field" 
              style={{ paddingLeft: '2.75rem' }} 
              placeholder="081XXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        {/* Role Selection */}
        <div className="input-group">
          <label className="input-label">Hak Akses (Role) *</label>
          <div style={{ position: 'relative' }}>
            <Shield size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <select 
              className="input-field select-field" 
              style={{ paddingLeft: '2.75rem' }}
              value={roleCode}
              onChange={(e) => setRoleCode(e.target.value)}
            >
              <option value="client" style={{ background: 'var(--bg-secondary)' }}>Klien (Client)</option>
              <option value="notary" style={{ background: 'var(--bg-secondary)' }}>Notaris / PPAT</option>
              <option value="admin_intake" style={{ background: 'var(--bg-secondary)' }}>Staf Penginput (Admin Intake)</option>
              <option value="finance" style={{ background: 'var(--bg-secondary)' }}>Staf Keuangan (Finance)</option>
              <option value="moderator" style={{ background: 'var(--bg-secondary)' }}>Moderator Chat (Moderation Officer)</option>
            </select>
          </div>
        </div>

        {/* Office Selection */}
        <div className="input-group">
          <label className="input-label">Penempatan Kantor (Opsional)</label>
          <div style={{ position: 'relative' }}>
            <Building size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <select 
              className="input-field select-field" 
              style={{ paddingLeft: '2.75rem' }}
              value={officeId}
              onChange={(e) => setOfficeId(e.target.value)}
            >
              <option value="">Pilih Kantor Penempatan</option>
              {safeOffices.map((o: any) => (
                <option key={o.id} value={o.id} style={{ background: 'var(--bg-secondary)' }}>{o.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* CTA */}
        <button 
          type="submit" 
          disabled={inviteMutation.isPending}
          className="btn btn-primary" 
          style={{ width: '100%', marginTop: '1rem' }}
        >
          <Send size={16} />
          {inviteMutation.isPending ? 'Mengirim Undangan...' : 'Kirim Tautan Undangan'}
        </button>

      </form>

    </div>
  );
}
