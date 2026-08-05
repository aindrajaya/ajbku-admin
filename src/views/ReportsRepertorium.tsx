import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { FileText, Calendar, FileDown, RotateCcw } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { notifyError, notifySuccess } from '../store/ui';
import { useAuth } from '../auth/AuthProvider';

async function toDataUrl(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function ReportsRepertorium() {
  const [periodFrom, setPeriodFrom] = useState('2026-06-01');
  const [periodTo, setPeriodTo] = useState('2026-06-30');
  const { user } = useAuth();
  const tenantId = user?.tenantId || 'tenant-id';

  const { data: tenant } = useQuery({
    queryKey: ['tenant-details', tenantId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/tenants/${tenantId}`);
      return res.data?.data || res.data || {};
    },
  });

  const { data: repertoriumData, isLoading } = useQuery({
    queryKey: ['reports-repertorium', periodFrom, periodTo],
    queryFn: async () => {
      const res = await api.get('/api/v1/reports/repertorium', {
        periodFrom,
        periodTo,
      });
      return res.data;
    },
  });

  const entries = React.useMemo(() => {
    const rawData = repertoriumData?.data || repertoriumData || [];
    return Array.isArray(rawData) ? rawData : [];
  }, [repertoriumData]);

  const handleExportPdf = async () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const tenantName = tenant?.name || 'Kantor Notaris Sejahtera Madiun';
      const periodLabel = `${periodFrom} s/d ${periodTo}`;
      const hasLogo = Boolean(tenant?.logoUrl);

      if (tenant?.logoUrl) {
        try {
          const logoDataUrl = await toDataUrl(tenant.logoUrl);
          doc.addImage(logoDataUrl, 'PNG', 14, 10, 16, 16);
        } catch {
          // Ignore logo fetch failures and keep PDF export working.
        }
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(tenantName, hasLogo ? 34 : 14, 18);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Repertorium Digital - Periode: ${periodLabel}`, hasLogo ? 34 : 14, 24);

      autoTable(doc, {
        startY: 32,
        head: [['No. Rep', 'Tanggal', 'No. Perkara', 'Jenis', 'Pihak Utama', 'Lokasi', 'Notaris', 'Status']],
        body: entries.map((entry: any) => [
          entry.entry_number || entry.entryNumber || '',
          entry.entry_date || entry.entryDate || '',
          entry.matter_id || entry.matterCaseNumber || '',
          entry.service_type || entry.serviceName || '',
          entry.main_party_name || entry.clientName || '',
          entry.land_summary || entry.landSummary || '',
          entry.notary_name || entry.notaryName || '',
          entry.status || '',
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [240, 253, 250] },
      });

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Halaman ${i} dari ${totalPages}`, doc.internal.pageSize.width / 2, 200, { align: 'center' });
        doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 14, 200);
      }

      const pdfBytes = doc.output('arraybuffer');
      const filename = `repertorium-${periodFrom}-ke-${periodTo}.pdf`;
      const result = await window.electronAPI.dialog.saveFile({
        buffer: pdfBytes,
        defaultFilename: filename,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      });

      if (result.success) {
        notifySuccess(`PDF repertorium tersimpan di ${result.filePath}.`, 'Export PDF');
      }
    } catch (error) {
      console.error(error);
      notifyError('Gagal mengekspor laporan repertorium ke PDF.', 'Export PDF');
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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

      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
        <div className="input-group" style={{ marginBottom: 0, flex: 1 }}>
          <label className="input-label" style={{ fontSize: '0.75rem' }}>Dari Tanggal</label>
          <div style={{ position: 'relative' }}>
            <Calendar size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} className="input-field" style={{ paddingLeft: '2.25rem', fontSize: '0.85rem' }} />
          </div>
        </div>

        <div className="input-group" style={{ marginBottom: 0, flex: 1 }}>
          <label className="input-label" style={{ fontSize: '0.75rem' }}>Hingga Tanggal</label>
          <div style={{ position: 'relative' }}>
            <Calendar size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} className="input-field" style={{ paddingLeft: '2.25rem', fontSize: '0.85rem' }} />
          </div>
        </div>

        <button onClick={() => { setPeriodFrom('2026-06-01'); setPeriodTo('2026-06-30'); }} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
          <RotateCcw size={14} />
        </button>
      </div>

      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', fontFamily: 'var(--font-sans)' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
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
              entries.map((entry: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-glass)', transition: 'var(--transition-smooth)' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.01)'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                  <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600, color: 'var(--color-gold)' }}>{entry.entry_number || entry.entryNumber}</td>
                  <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-primary)' }}>{entry.entry_date || entry.entryDate}</td>
                  <td style={{ padding: '1.25rem 1.5rem', fontFamily: 'monospace', color: 'var(--color-emerald)', fontWeight: 600 }}>{entry.matter_id || entry.matterCaseNumber}</td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>{entry.service_type || entry.serviceName}</td>
                  <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600 }}>{entry.main_party_name || entry.clientName}</td>
                  <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{entry.land_summary || entry.landSummary}</td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>{entry.notary_name || entry.notaryName}</td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>{entry.status}</span>
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
