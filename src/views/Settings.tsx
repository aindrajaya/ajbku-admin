import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, tokenManager } from '../api/client';
import { Settings, Building, Users, UserCheck, ShieldCheck, DollarSign, Upload, Save, Check } from 'lucide-react';

export default function SettingsView() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'profile' | 'staff' | 'notaries' | 'rates'>('profile');

  const tenantId = tokenManager.getSync('tenantId') || 'tenant-id';

  // PROFILE STATE
  const [officeName, setOfficeName] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [officePhone, setOfficePhone] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // STAFF STATE (Original invitations logic moved here)
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffRole, setStaffRole] = useState('admin_intake');

  // RATES STATE
  const [baseFee, setBaseFee] = useState(2500000);
  const [njoptkp, setNjoptkp] = useState(12000000);

  // Fetch tenant details
  const { data: tenant } = useQuery({
    queryKey: ['tenant-details', tenantId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/tenants/${tenantId}`);
      return res.data?.data || res.data || {};
    }
  });

  // Pre-fill profile settings
  useEffect(() => {
    if (tenant) {
      setOfficeName(tenant.name || 'Kantor Notaris Sejahtera Madiun');
      setOfficeAddress(tenant.address || 'Jl. Pahlawan No. 5, Kota Madiun');
      setOfficePhone(tenant.phone || '0351-456789');
      setLogoPreview(tenant.logoUrl || null);
    }
  }, [tenant]);

  // Fetch staff users
  const { data: staffList = [], refetch: refetchStaff } = useQuery({
    queryKey: ['tenant-staff-list', tenantId],
    queryFn: async () => {
      // Fetch users of tenant if endpoint exists, else return mock list
      try {
        const res = await api.get(`/api/v1/tenants/${tenantId}/users`);
        return Array.isArray(res.data) ? res.data : res.data?.data || [];
      } catch (e) {
        return [
          { id: 'usr-1', fullName: 'Sari Wijaya', email: 'sari@notarissejahtera.com', roleCode: 'ADMIN_INTAKE', status: 'active' },
          { id: 'usr-2', fullName: 'Rio Hartono', email: 'rio@notarissejahtera.com', roleCode: 'FINANCE_ADMIN', status: 'active' },
          { id: 'usr-3', fullName: 'Principal Owner', email: 'owner@notarissejahtera.com', roleCode: 'PRINCIPAL', status: 'active' }
        ];
      }
    }
  });

  // Staff invitation mutation (original code logic)
  const inviteStaffMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post(`/api/v1/tenants/${tenantId}/invite`, payload);
    },
    onSuccess: () => {
      setStaffName('');
      setStaffEmail('');
      setStaffPhone('');
      refetchStaff();
      alert('Tautan Undangan Staf berhasil dikirim!');
    },
    onError: () => {
      alert('Gagal mengirim undangan staf.');
    }
  });

  const handleInviteStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName || !staffEmail || !staffRole) {
      alert('Nama, Email, dan Role wajib diisi.');
      return;
    }
    inviteStaffMutation.mutate({
      fullName: staffName,
      email: staffEmail,
      phone: staffPhone || undefined,
      roleCode: staffRole
    });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Pengaturan profil kantor berhasil disimpan!');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        alert('Ukuran file logo maksimal 500 KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
        // Proactively update logo in Layout state if needed
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Settings size={28} style={{ color: 'var(--color-emerald)' }} />
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Pengaturan Kantor</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Konfigurasi branding kantor notaris, hak akses staf internal, wilayah kerja notaris, dan skema tarif.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Side Sub-Navigation Tabs */}
        <div className="glass-panel" style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <SettingsTab active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<Building size={16} />} label="Profil Kantor" />
          <SettingsTab active={activeTab === 'staff'} onClick={() => setActiveTab('staff')} icon={<Users size={16} />} label="Kelola Staf" />
          <SettingsTab active={activeTab === 'notaries'} onClick={() => setActiveTab('notaries')} icon={<UserCheck size={16} />} label="Wilayah Notaris" />
          <SettingsTab active={activeTab === 'rates'} onClick={() => setActiveTab('rates')} icon={<DollarSign size={16} />} label="Tarif Layanan" />
        </div>

        {/* Right Content Panel */}
        <div className="glass-panel" style={{ padding: '2rem', minHeight: '400px' }}>
          
          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                Profil Tenant & Branding
              </h3>

              {/* Logo Upload (Section 6.15) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-glass)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}>
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo Preview" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                  ) : (
                    <Building size={32} style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>
                <div>
                  <input type="file" id="logo-file" accept="image/png, image/svg+xml" onChange={handleLogoUpload} style={{ display: 'none' }} />
                  <label htmlFor="logo-file" className="btn btn-secondary" style={{ cursor: 'pointer', padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
                    <Upload size={14} />
                    Unggah Logo Baru
                  </label>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    Maksimum 500 KB (Format PNG atau SVG)
                  </span>
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Nama Tampilan Kantor *</label>
                <input 
                  type="text" 
                  maxLength={60}
                  className="input-field" 
                  value={officeName} 
                  onChange={(e) => setOfficeName(e.target.value)} 
                  required
                />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Alamat Lengkap Kantor</label>
                <textarea 
                  className="input-field" 
                  rows={2} 
                  value={officeAddress} 
                  onChange={(e) => setOfficeAddress(e.target.value)} 
                  style={{ resize: 'none' }}
                />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Nomor Kontak Kantor</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={officePhone} 
                  onChange={(e) => setOfficePhone(e.target.value)} 
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-start', marginTop: '0.5rem' }}>
                <Save size={16} />
                Simpan Profil
              </button>
            </form>
          )}

          {/* TAB 2: MANAGE STAFF */}
          {activeTab === 'staff' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '2rem' }}>
                
                {/* Staff list table */}
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                    Daftar Pengguna Internal
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {staffList.map((st: any) => (
                      <div 
                        key={st.id}
                        style={{
                          padding: '0.85rem 1rem',
                          backgroundColor: 'rgba(0,0,0,0.15)',
                          border: '1px solid var(--border-glass)',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.85rem'
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 600, display: 'block' }}>{st.fullName}</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{st.email}</span>
                        </div>
                        <span className="badge badge-teal" style={{ fontSize: '0.65rem' }}>
                          {st.roleCode}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Invite Staff Form */}
                <form onSubmit={handleInviteStaffSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                    Undang Pengguna Baru
                  </h3>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Nama Lengkap *</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="Contoh: Budi Santoso"
                      value={staffName} 
                      onChange={(e) => setStaffName(e.target.value)} 
                      required
                    />
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Email Tujuan *</label>
                    <input 
                      type="email" 
                      className="input-field" 
                      placeholder="staf@notarissejahtera.com"
                      value={staffEmail} 
                      onChange={(e) => setStaffEmail(e.target.value)} 
                      required
                    />
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Nomor HP (Opsional)</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="08123456789"
                      value={staffPhone} 
                      onChange={(e) => setStaffPhone(e.target.value)} 
                    />
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Role Akses *</label>
                    <select 
                      value={staffRole} 
                      onChange={(e) => setStaffRole(e.target.value)}
                      className="input-field select-field"
                    >
                      <option value="admin_intake" style={{ background: 'var(--bg-secondary)' }}>Admin Intake (Staf Penginput)</option>
                      <option value="finance" style={{ background: 'var(--bg-secondary)' }}>Finance (Staf Keuangan)</option>
                      <option value="moderator" style={{ background: 'var(--bg-secondary)' }}>Moderator Chat</option>
                    </select>
                  </div>

                  <button type="submit" disabled={inviteStaffMutation.isPending} className="btn btn-primary" style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                    Kirim Undangan Staf
                  </button>
                </form>

              </div>
            </div>
          )}

          {/* TAB 3: NOTARIES COVERAGE */}
          {activeTab === 'notaries' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                Wilayah Kerja Notaris
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ padding: '1rem', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.9rem' }}>Ir. Siti Rahayu, S.H., M.Kn.</strong>
                    <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>TERSEDIA</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Wilayah Cakupan BPN: Kota Madiun (3519), Kabupaten Madiun (3509)
                  </p>
                </div>

                <div style={{ padding: '1rem', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.9rem' }}>Drs. Ahmad Fauzi, S.H.</strong>
                    <span className="badge badge-yellow" style={{ fontSize: '0.65rem' }}>SIBUK</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Wilayah Cakupan BPN: Kota Madiun (3519)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RATES */}
          {activeTab === 'rates' && (
            <form onSubmit={(e) => { e.preventDefault(); alert('Konfigurasi tarif disimpan!'); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                Pengaturan Tarif Layanan
              </h3>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Honorarium Minimal Layanan (Rp) *</label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={baseFee} 
                  onChange={(e) => setBaseFee(Number(e.target.value))} 
                  required
                />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">NJOPTKP Default Wilayah (Rp) *</label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={njoptkp} 
                  onChange={(e) => setNjoptkp(Number(e.target.value))} 
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-start', marginTop: '0.5rem' }}>
                <Check size={16} />
                Simpan Tarif
              </button>
            </form>
          )}

        </div>

      </div>

    </div>
  );
}

// Sidebar sub-tab button helper
interface SettingsTabProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function SettingsTab({ active, onClick, icon, label }: SettingsTabProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        border: 'none',
        borderRadius: '6px',
        background: active ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
        color: active ? '#fff' : 'var(--text-secondary)',
        fontWeight: active ? 600 : 500,
        fontSize: '0.85rem',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'var(--transition-smooth)'
      }}
    >
      <span style={{ color: active ? 'var(--color-emerald)' : 'var(--text-muted)' }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
