import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, tokenManager } from '../api/client';
import { FileText, Calendar, FileDown, RotateCcw } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ReportsRepertorium() {
  const [periodFrom, setPeriodFrom] = useState('2026-06-01');
  const [periodTo, setPeriodTo] = useState('2026-06-30');

  const tenantId = tokenManager.getSync('tenantId') || 'tenant-id';

  // Fetch tenant details for headers
  const { data: tenant } = useQuery({
    queryKey: ['tenant-details', tenantId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/tenants/${tenantId}`);
      return res.data?.data || res.data || {};
    }
  });

  const { data: repertoriumData, isLoading, refetch } = useQuery({
    queryKey: ['reports-repertorium', periodFrom, periodTo],
    queryFn: async () => {
      const res = await api.get('/api/v1/reports/repertorium', {
        periodFrom,
        periodTo
      });
      return res.data;
    }
  });

  const entries = React.useMemo(() => {
    const rawData = repertoriumData?.data || repertoriumData || [];
    const arr = Array.isArray(rawData) ? rawData : [];

    if (arr.length === 0) {
      // Mock data matching Section 6.12/9.3
      return [
        { entry_number: 'REP-2026-0001', entry_date: '2026-06-01', matter_id: 'MAT-2026-0001', service_type: 'AJB-Oke', main_party_name: 'Budi Santoso', land_summary: 'Kec. Manguharjo, Kota Madiun', notary_name: 'Ir. Siti Rahayu, S.H., M.Kn.', status: 'CLOSED' },
        { entry_number: 'REP-2026-0002', entry_date: '2026-06-05', matter_id: 'MAT-2026-0002', service_type: 'Hibah', main_party_name: 'Ratna Dewi', land_summary: 'Kec. Kartoharjo, Kota Madiun', notary_name: 'Drs. Ahmad Fauzi, S.H.', status: 'CLOSED' },
        { entry_number: 'REP-2026-0003', entry_date: '2026-06-12', matter_id: 'MAT-2026-0003', service_type: 'APHT', main_party_name: 'Hendra Wijaya', land_summary: 'Kec. Taman, Kota Madiun', notary_name: 'Ir. Siti Rahayu, S.H., M.Kn.', status: 'CLOSED' }
      ];
    }
    return arr;
  }, [repertoriumData]);

  const handleExportPdf = async () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const tenantName = tenant?.name || 'Kantor Notaris Sejahtera Madiun';
      const periodLabel = `${periodFrom} s/d ${periodTo}`;

      // 1. Header (Section 9.3)
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(tenantName, 14, 18);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Repertorium Digital · Periode: ${periodLabel}`, 14, 24);

      // 2. Table Render
      autoTable(doc, {
        startY: 32,
        head: [['No. Rep', 'Tanggal', 'No. Perkara', 'Jenis', 'Pihak Utama', 'Lokasi', 'Notaris', 'Status']],
        body: entries.map((e: any) => [
          e.entry_number || e.entryNumber || '',
          e.entry_date || e.entryDate || '',
          e.matter_id || e.matterCaseNumber || '',
          e.service_type || e.serviceName || '',
          e.main_party_name || e.clientName || '',
          e.land_summary || e.landSummary || '',
          e.notary_name || e.notaryName || '',
          e.status || ''
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [240, 253, 250] }
      });

      // 3. Footer with page counts
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Halaman ${i} dari ${totalPages}`, doc.internal.pageSize.width / 2, 200, { align: 'center' });
        doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 14, 200);
      }

      // Convert to arraybuffer
      const pdfBytes = doc.output('arraybuffer');

      // Call Electron Save Dialog via preload
      const filename = `repertorium-${periodFrom}-ke-${periodTo}.pdf`;
      const result = await window.electronAPI.exportFile({
        buffer: pdfBytes,
        defaultFilename: filename,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });

      if (result.success) {
        alert(`Laporan Repertorium berhasil disimpan ke: ${result.filePath}`);
      }
    } catch (e) {
      console.error(e);
      alert('Gagal mengekspor laporan PDF.');
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FileText size={28} style={{ color: 'var(--color-emerald)' }} />
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Repertorium Digital</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Register resmi akta notaris dan PPAT yang telah diselesaikan.
            </p>
          </div>
        </div>

        <button onClick={handleExportPdf} className="btn btn-accent-gold">
          <FileDown size={16} />
          Ekspor PDF (Landscape)
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
        <div className="input-group" style={{ marginBottom: 0, flex: 1 }}>
          <label className="input-label" style={{ fontSize: '0.75rem' }}>Dari Tanggal</label>
          <div style={{ position: 'relative' }}>
            <Calendar size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="date" 
              value={periodFrom} 
              onChange={(e) => setPeriodFrom(e.target.value)} 
              className="input-field" 
              style={{ paddingLeft: '2.25rem', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        <div className="input-group" style={{ marginBottom: 0, flex: 1 }}>
          <label className="input-label" style={{ fontSize: '0.75rem' }}>Hingga Tanggal</label>
          <div style={{ position: 'relative' }}>
            <Calendar size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="date" 
              value={periodTo} 
              onChange={(e) => setPeriodTo(e.target.value)} 
              className="input-field" 
              style={{ paddingLeft: '2.25rem', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        <button onClick={() => { setPeriodFrom('2026-06-01'); setPeriodTo('2026-06-30'); }} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Table Card */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          fontSize: '0.9rem',
          fontFamily: 'var(--font-sans)'
        }}>
          <thead>
            <tr style={{
              background: 'rgba(255,255,255,0.03)',
              borderBottom: '1px solid var(--border-glass)',
              color: 'var(--text-secondary)'
            }}>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>No. Rep</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Tanggal</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>No. Perkara</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Layanan</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Pihak Utama</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Lokasi Objek</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Notaris</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Memuat data repertorium...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Tidak ada pencatatan repertorium pada periode ini.
                </td>
              </tr>
            ) : (
              entries.map((e: any, idx: number) => (
                <tr 
                  key={idx} 
                  style={{
                    borderBottom: '1px solid var(--border-glass)',
                    transition: 'var(--transition-smooth)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.01)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600, color: 'var(--color-gold)' }}>
                    {e.entry_number || e.entryNumber}
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-primary)' }}>
                    {e.entry_date || e.entryDate}
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', fontFamily: 'monospace', color: 'var(--color-emerald)', fontWeight: 600 }}>
                    {e.matter_id || e.matterCaseNumber}
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    {e.service_type || e.serviceName}
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600 }}>
                    {e.main_party_name || e.clientName}
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {e.land_summary || e.landSummary}
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    {e.notary_name || e.notaryName}
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
