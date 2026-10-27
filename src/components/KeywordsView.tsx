import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Calendar,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Database,
  SlidersHorizontal,
  Info,
  Clock,
  Laptop,
  CheckCircle,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { fetchKeywords, KeywordsResponse } from '../services/api.js';
import { ActivityLog } from '../types.js';
import { formatToWIB, formatDateOnlyWIB, formatTimeOnlyWIB, formatRelativeTime } from '../utils/date.js';

interface KeywordsViewProps {
  onOpenDbInspector: () => void;
}

export const KeywordsView: React.FC<KeywordsViewProps> = ({ onOpenDbInspector }) => {
  const [data, setData] = useState<KeywordsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<ActivityLog | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchKeywords({
        page,
        limit,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: search || undefined,
      });
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data keyword dari database.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, startDate, endDate, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleClearFilters = () => {
    setSearch('');
    setSearchInput('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const setPresetToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
    setPage(1);
  };

  const setPresetLast7Days = () => {
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setStartDate(start);
    setEndDate(end);
    setPage(1);
  };

  // Export CSV for audit logs
  const handleExportCsv = () => {
    if (!data || data.records.length === 0) return;
    const headers = ['ID', 'Keyword / Event', 'Tipe Event', 'Device ID', 'Waktu (WIB)', 'Waktu UTC', 'Detail'];
    const rows = data.records.map(r => [
      `"${r.id}"`,
      `"${r.keyword.replace(/"/g, '""')}"`,
      `"${r.event_type || ''}"`,
      `"${r.device_id || ''}"`,
      `"${formatToWIB(r.timestamp)}"`,
      `"${r.timestamp}"`,
      `"${(r.details || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `audit_keywords_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Header & Table Context Banner */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">
                Log Keyword &amp; Aktivitas Perangkat
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-950 border border-sky-800 text-sky-300 font-mono">
                Asia/Jakarta (WIB)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Catatan entri keyword, perintah sistem, dan event aktivitas perangkat berizin, diurutkan dari yang terbaru.
            </p>
          </div>

          {/* Database Source Table Indicator */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenDbInspector}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-700/80 text-xs text-slate-300 transition-colors cursor-pointer"
              title="Periksa dan sesuaikan tabel PostgreSQL yang aktif"
            >
              <Database className="w-3.5 h-3.5 text-sky-400" />
              <span>Sumber:</span>
              <span className="font-mono text-white font-medium">
                {data?.tableName || 'Memuat...'}
              </span>
              <SlidersHorizontal className="w-3 h-3 text-slate-400 ml-1" />
            </button>

            <button
              onClick={handleExportCsv}
              disabled={!data || data.records.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Ekspor data halaman ini ke format CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-sm w-full">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Cari keyword, event, atau device ID..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-xs font-medium transition-colors cursor-pointer"
            >
              Cari
            </button>
          </form>

          {/* Date Range Picker */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-md px-2.5 py-1 text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Dari:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-slate-200 focus:outline-none text-xs"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-md px-2.5 py-1 text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Sampai:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-slate-200 focus:outline-none text-xs"
              />
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={setPresetToday}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors cursor-pointer"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={setPresetLast7Days}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors cursor-pointer"
              >
                7 Hari
              </button>
              {(search || startDate || endDate) && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-2 py-1 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 rounded text-xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => loadData()}
              disabled={loading}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-slate-300 border border-slate-700 transition-colors cursor-pointer ml-1"
              title="Perbarui data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="m-4 p-3 bg-rose-950/70 border border-rose-800 rounded-lg text-rose-200 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => loadData()}
            className="underline hover:text-white ml-3 cursor-pointer"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Main Table Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Keyword / Event</th>
                <th className="py-3 px-3">Tipe Aktivitas</th>
                <th className="py-3 px-3">Device ID</th>
                <th className="py-3 px-4">Waktu (Asia/Jakarta)</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {loading && !data ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    <div className="inline-block w-6 h-6 border-2 border-slate-600 border-t-sky-400 rounded-full animate-spin mb-2"></div>
                    <div>Mengambil catatan aktivitas dari PostgreSQL...</div>
                  </td>
                </tr>
              ) : !data || data.records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <Info className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-300">Tidak ada catatan aktivitas yang cocok.</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Coba sesuaikan filter tanggal atau kata kunci pencarian Anda.
                    </p>
                  </td>
                </tr>
              ) : (
                data.records.map((log) => {
                  const eventClass = getEventTypeColor(log.event_type);
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-850/60 transition-colors group cursor-pointer"
                      onClick={() => setSelectedRecord(log)}
                    >
                      {/* Keyword / Event */}
                      <td className="py-3 px-4 font-mono text-slate-100 max-w-xs md:max-w-md truncate">
                        <span className="font-semibold text-sky-300 group-hover:text-sky-200 transition-colors">
                          {log.keyword}
                        </span>
                        {log.details && (
                          <span className="block text-[11px] text-slate-400 truncate mt-0.5 font-sans">
                            {log.details}
                          </span>
                        )}
                      </td>

                      {/* Event Type */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono border ${eventClass}`}>
                          {log.event_type || 'ACTIVITY'}
                        </span>
                      </td>

                      {/* Device ID */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-300">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <Laptop className="w-3.5 h-3.5 text-slate-500" />
                          <span>{log.device_id}</span>
                        </div>
                      </td>

                      {/* Date & Time in WIB */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                        <div className="font-medium text-slate-200">
                          {formatDateOnlyWIB(log.timestamp)}
                        </div>
                        <div className="text-[11px] text-sky-400/90 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 text-sky-400/70" />
                          {formatTimeOnlyWIB(log.timestamp)}
                          <span className="text-slate-500 ml-1">
                            ({formatRelativeTime(log.timestamp)})
                          </span>
                        </div>
                      </td>

                      {/* Consent & Audit Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                          title="Aktivitas tercatat dengan persetujuan audit pengguna yang sah"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Sah
                        </span>
                      </td>

                      {/* Detail action */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRecord(log);
                          }}
                          className="text-xs text-sky-400 hover:text-sky-300 font-medium px-2 py-1 rounded hover:bg-sky-950/40 transition-colors"
                        >
                          Lihat
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div>
          {data ? (
            <span>
              Menampilkan <span className="font-medium text-slate-200">{data.records.length}</span> dari{' '}
              <span className="font-medium text-slate-200">{data.total}</span> record &bull; Halaman{' '}
              <span className="font-medium text-slate-200">{data.page}</span> dari{' '}
              <span className="font-medium text-slate-200">{data.totalPages || 1}</span>
            </span>
          ) : (
            <span>Memuat...</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Limit selector */}
          <select
            value={limit}
            onChange={(e) => {
              setLimit(parseInt(e.target.value, 10));
              setPage(1);
            }}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300 text-xs focus:outline-none"
          >
            <option value="15">15 per halaman</option>
            <option value="30">30 per halaman</option>
            <option value="50">50 per halaman</option>
            <option value="100">100 per halaman</option>
          </select>

          {/* Prev/Next buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
              title="Halaman sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-slate-300">
              {page}
            </span>
            <button
              onClick={() => setPage((p) => (data && p < data.totalPages ? p + 1 : p))}
              disabled={!data || page >= data.totalPages || loading}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
              title="Halaman berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Record Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-sky-400" />
                Rincian Entri Aktivitas
              </h3>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-0.5">Keyword / Event String:</label>
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-md font-mono text-sky-300 break-all select-all">
                  {selectedRecord.keyword}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-0.5">Tipe Event:</label>
                  <div className="font-mono text-slate-200">
                    {selectedRecord.event_type}
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Device ID:</label>
                  <div className="font-mono text-slate-200">
                    {selectedRecord.device_id}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-0.5">Waktu Pencatatan (WIB):</label>
                <div className="text-slate-200 font-mono">
                  {formatToWIB(selectedRecord.timestamp)}
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  UTC ISO: {selectedRecord.timestamp}
                </div>
              </div>

              {selectedRecord.details && (
                <div>
                  <label className="text-slate-400 block mb-0.5">Keterangan / Konteks:</label>
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-md text-slate-300">
                    {selectedRecord.details}
                  </div>
                </div>
              )}

              {selectedRecord.raw && (
                <div>
                  <label className="text-slate-400 block mb-0.5">Payload Mentah Kolom PostgreSQL:</label>
                  <pre className="p-2.5 bg-slate-950 border border-slate-800 rounded-md text-[11px] text-slate-400 font-mono overflow-auto max-h-40">
                    {JSON.stringify(selectedRecord.raw, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-medium cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function getEventTypeColor(type: string): string {
  switch (type?.toUpperCase()) {
    case 'KEYWORD':
      return 'bg-amber-950/60 text-amber-300 border-amber-800/50';
    case 'KEYSTROKE':
    case 'KEYSTROKE_EVENT':
      return 'bg-indigo-950/60 text-indigo-300 border-indigo-800/50';
    case 'CAMERA':
      return 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50';
    case 'SYSTEM':
    case 'SYSTEM_COMMAND':
      return 'bg-purple-950/60 text-purple-300 border-purple-800/50';
    case 'URL_VISIT':
      return 'bg-blue-950/60 text-blue-300 border-blue-800/50';
    case 'FILE_OPEN':
    case 'FILE_DOWNLOAD':
      return 'bg-teal-950/60 text-teal-300 border-teal-800/50';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}
