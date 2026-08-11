import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { BarChart3, Calendar, FileSpreadsheet, RotateCcw, TrendingUp } from 'lucide-react';
import { csvEscape } from '../lib/export';
import { notifyError, notifySuccess } from '../store/ui';

const OPTIONAL_CSV_COLUMNS = [
  { header: 'Notaris', keys: ['notaryName', 'notary_name'] },
  { header: 'Notary Profile ID', keys: ['notaryProfileId', 'notary_profile_id'] },
  { header: 'Notary Payout Status', keys: ['notaryPayoutStatus', 'notary_payout_status'] },
  { header: 'Notary Payout Amount', keys: ['notaryPayoutAmount', 'notary_payout_amount'] },
  { header: 'Intake Source', keys: ['intakeSource', 'intake_source'] },
];

function readFirst(row: any, keys: string[]) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  }
  return '';
}

function getActiveOptionalColumns(rows: any[]) {
  return OPTIONAL_CSV_COLUMNS.filter((column) =>
    rows.some((row) => column.keys.some((key) => row?.[key] !== undefined && row?.[key] !== null))
  );
}

export default function ReportsOperational() {
  const [period, setPeriod] = useState('2026-06');
  const [serviceType, setServiceType] = useState('all');
  const [year, month] = period.split('-').map(Number);
  const periodTo = `${period}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['reports-operational', period, serviceType],
    queryFn: async () => {
      const res = await api.get('/api/v1/reports/operational', {
        periodFrom: `${period}-01`,
        periodTo,
        serviceType: serviceType !== 'all' ? serviceType : undefined
      });
      return res.data;
    }
  });

  const stats = React.useMemo(() => {
    const rawData = reportData?.data || reportData || [];
    const arr = Array.isArray(rawData) ? rawData : [];

    if (arr.length === 0) {
      return {
        total: 0,
        completed: 0,
        cancelled: 0,
        avgDays: 0,
        chartData: [0, 0, 0, 0],
        serviceDist: [],
      };
    }

    const completed = arr.filter((m: any) => m.workflowStatus === 'bpn_completed' || m.workflowStatus === 'closed').length;
    const cancelled = arr.filter((m: any) => m.workflowStatus === 'cancelled').length;
    
    // Group into 4 weeks
    const weeks = [0, 0, 0, 0];
    arr.forEach((m: any) => {
      const day = m.createdAt ? new Date(m.createdAt).getDate() : 1;
      const idx = Math.min(3, Math.floor((day - 1) / 7));
      weeks[idx]++;
    });

    // Group service distribution
    const distMap: Record<string, number> = {};
    arr.forEach((m: any) => {
      const cat = m.serviceName || m.serviceCategoryId || 'Lainnya';
      distMap[cat] = (distMap[cat] || 0) + 1;
    });

    const total = arr.length;
    const serviceDist = Object.entries(distMap).map(([name, count]) => ({
      name,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
      color: name.includes('AJB') ? 'var(--color-emerald)' : name.includes('Pajak') ? 'var(--color-blue)' : 'var(--color-gold)'
    }));

    return {
      total,
      completed,
      cancelled,
      avgDays: 12,
      chartData: weeks,
      serviceDist
    };
  }, [reportData]);

  const handleExportCsv = async () => {
    try {
      const rawData = reportData?.data || reportData || [];
      const arr = Array.isArray(rawData) ? rawData : [];
      const optionalColumns = getActiveOptionalColumns(arr);
      const headers = [
        'No. Perkara',
        'Layanan',
        'Klien',
        'Tanggal Pengajuan',
        'Status',
        'Nilai Transaksi',
        ...optionalColumns.map((column) => column.header),
      ].join(',') + '\n';
      const rows = arr.map((row: any) => {
        const c1 = row.caseNumber || row.no_perkara || '';
        const c2 = row.serviceName || row.layanan || '';
        const c3 = row.clientName || row.klien || '';
        const c4 = row.createdAt ? new Date(row.createdAt).toLocaleDateString('id-ID') : row.tanggal || '';
        const c5 = row.workflowStatus || row.status || '';
        const c6 = row.transactionValue || row.nilai || 0;
        const optionalValues = optionalColumns.map((column) => readFirst(row, column.keys));
        return [c1, c2, c3, c4, c5, c6, ...optionalValues].map(csvEscape).join(',');
      }).join('\n');

      const csv = headers + rows;
      const buffer = new TextEncoder().encode('\uFEFF' + csv).buffer;
      const filename = `laporan-operasional-${period}.csv`;
      const result = await window.electronAPI.dialog.saveFile({
        buffer,
        defaultFilename: filename,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      });

      if (result.success) {
        notifySuccess(`CSV operasional tersimpan di ${result.filePath}.`, 'Export CSV');
      }
    } catch (e) {
      console.error(e);
      notifyError('Gagal mengekspor laporan operasional ke CSV.', 'Export CSV');
    }
  };

  const maxChartVal = Math.max(5, ...stats.chartData);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <BarChart3 size={28} style={{ color: 'var(--color-emerald)' }} />
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Laporan Analitik Operasional</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Statistik perkara masuk, SLA penyelesaian, dan sebaran jenis akta pertanahan.
            </p>
          </div>
        </div>

        <button onClick={handleExportCsv} className="btn btn-primary">
          <FileSpreadsheet size={16} />
          Ekspor CSV (Excel)
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
        <div className="input-group" style={{ marginBottom: 0, flex: 1 }}>
          <label className="input-label" style={{ fontSize: '0.75rem' }}>Periode Bulan</label>
          <div style={{ position: 'relative' }}>
            <Calendar size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="month" 
              value={period} 
              onChange={(e) => setPeriod(e.target.value)} 
              className="input-field" 
              style={{ paddingLeft: '2.25rem', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        <div className="input-group" style={{ marginBottom: 0, flex: 1 }}>
          <label className="input-label" style={{ fontSize: '0.75rem' }}>Jenis Layanan</label>
          <select 
            value={serviceType} 
            onChange={(e) => setServiceType(e.target.value)} 
            className="input-field select-field" 
            style={{ fontSize: '0.85rem' }}
          >
            <option value="all">Semua Layanan</option>
            <option value="ajb">AJB (Jual Beli)</option>
            <option value="hibah">Hibah</option>
            <option value="apht">APHT</option>
          </select>
        </div>

        <button onClick={() => { setPeriod('2026-06'); setServiceType('all'); }} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
          <RotateCcw size={14} />
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
          Memuat data laporan analitik...
        </div>
      ) : (
        <>
          {/* Metrics Summary Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
            
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Matter Masuk</span>
              <strong style={{ fontSize: '1.6rem', fontWeight: 700, display: 'block', marginTop: '0.2rem' }}>
                {stats.total} berkas
              </strong>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Selesai (Closed)</span>
              <strong style={{ fontSize: '1.6rem', fontWeight: 700, display: 'block', color: 'var(--color-emerald)', marginTop: '0.2rem' }}>
                {stats.completed} berkas
              </strong>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Dibatalkan</span>
              <strong style={{ fontSize: '1.6rem', fontWeight: 700, display: 'block', color: 'var(--color-crimson)', marginTop: '0.2rem' }}>
                {stats.cancelled} berkas
              </strong>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Rata-rata Durasi SLA</span>
              <strong style={{ fontSize: '1.6rem', fontWeight: 700, display: 'block', color: 'var(--color-gold)', marginTop: '0.2rem' }}>
                {stats.avgDays} hari
              </strong>
            </div>

          </div>

          {/* Charts Layout Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
            
            {/* SVG Trend Bar Chart */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                Tren Pengajuan Perkara (Mingguan)
              </h3>
              
              {/* Custom SVG Bar Chart */}
              <div style={{ height: '220px', width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', paddingTop: '1.5rem', paddingBottom: '0.5rem' }}>
                {stats.chartData.map((val, idx) => {
                  const barHeight = (val / maxChartVal) * 160; // scale to max 160px
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{val}</span>
                      <div style={{
                        width: '32px',
                        height: `${barHeight}px`,
                        background: 'linear-gradient(to top, var(--color-emerald-hover), var(--color-emerald))',
                        borderRadius: '4px 4px 0 0',
                        boxShadow: 'var(--shadow-emerald-glow)',
                        transition: 'height 0.3s ease-out'
                      }} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Minggu {idx + 1}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Service Distribution List */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                Distribusi Layanan
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, justifyContent: 'center' }}>
                {stats.serviceDist.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Belum ada data distribusi layanan untuk periode ini.</div>
                ) : stats.serviceDist.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span>{item.name}</span>
                      <strong>{item.count} berkas ({item.pct}%)</strong>
                    </div>
                    {/* Progress line indicator */}
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${item.pct}%`, height: '100%', backgroundColor: item.color, borderRadius: '3px' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </>
      )}

    </div>
  );
}
