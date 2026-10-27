import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Upload,
  Image as ImageIcon,
  LayoutGrid,
  Table as TableIcon,
  Maximize2,
  Download,
  X,
  Info,
  Clock,
  Laptop,
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
  CheckSquare,
  Square,
  AlertTriangle,
} from 'lucide-react';
import {
  fetchScreenshots,
  getScreenshotImageUrl,
  uploadScreenshot,
  uploadScreenshotsBatch,
  deleteScreenshot,
  deleteScreenshotsBatch,
  syncScreenshotsDisk,
  ScreenshotsResponse,
} from '../services/api.js';
import { ScreenshotItem } from '../types.js';
import { formatToWIB, formatDateOnlyWIB, formatTimeOnlyWIB, formatRelativeTime, formatBytes } from '../utils/date.js';

export const ScreenshotsView: React.FC = () => {
  const [data, setData] = useState<ScreenshotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View mode: 'gallery' or 'table'
  const [viewMode, setViewMode] = useState<'gallery' | 'table'>('gallery');

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deviceId, setDeviceId] = useState('');

  // Selected screenshot for lightbox preview modal
  const [selectedItem, setSelectedItem] = useState<ScreenshotItem | null>(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTab, setUploadTab] = useState<'upload' | 'scp' | 'script'>('upload');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadDeviceId, setUploadDeviceId] = useState('DEVICE-01');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Deletion modal states
  const [itemToDelete, setItemToDelete] = useState<ScreenshotItem | null>(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSyncDisk = async () => {
    setSyncLoading(true);
    try {
      const res = await syncScreenshotsDisk();
      setToast({
        type: 'success',
        message: res.message || `Sinkronisasi berhasil! ${res.syncedCount || 0} berkas disk terindeks.`,
      });
      await loadData();
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || 'Gagal menyinkronkan berkas dari direktori disk VM.',
      });
    } finally {
      setSyncLoading(false);
    }
  };

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const toggleSelectItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (!data?.records) return;
    if (selectedIds.length === data.records.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.records.map((r) => r.id));
    }
  };

  const confirmSingleDelete = async () => {
    if (!itemToDelete) return;
    setDeleteLoading(true);
    try {
      const res = await deleteScreenshot(itemToDelete.id);
      setToast({
        type: 'success',
        message: `Berhasil! File "${itemToDelete.original_filename || itemToDelete.filename}" telah dihapus dari disk VM & database.`,
      });
      if (selectedItem?.id === itemToDelete.id) {
        setSelectedItem(null);
      }
      setSelectedIds((prev) => prev.filter((id) => id !== itemToDelete.id));
      setItemToDelete(null);
      await loadData();
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || 'Gagal menghapus file screenshot dari server.',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const confirmBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    setDeleteLoading(true);
    try {
      const res = await deleteScreenshotsBatch(selectedIds);
      setToast({
        type: 'success',
        message: `Berhasil! ${res.message || `${selectedIds.length} file screenshot telah dibersihkan.`}`,
      });
      if (selectedItem && selectedIds.includes(selectedItem.id)) {
        setSelectedItem(null);
      }
      setSelectedIds([]);
      setShowBatchDeleteModal(false);
      await loadData();
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || 'Gagal menghapus screenshot terpilih.',
      });
    } finally {
      setDeleteLoading(false);
    }
  };


  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchScreenshots({
        page,
        limit,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        deviceId: deviceId || undefined,
      });
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat galeri screenshot dari server.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, startDate, endDate, deviceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setDeviceId('');
    setPage(1);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadFiles.length === 0) {
      setUploadMessage({ text: 'Pilih minimal satu file screenshot (PNG atau JPG) terlebih dahulu.', isError: true });
      return;
    }

    setUploadLoading(true);
    setUploadMessage(null);

    try {
      const res = await uploadScreenshotsBatch(uploadFiles, uploadDeviceId, uploadNotes);
      setUploadMessage({
        text: `Berhasil! ${res.message || `${uploadFiles.length} screenshot tersimpan di /srv/app-data/screenshots/ VM.`}`,
      });
      setUploadFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      // Immediately reload data in the background
      loadData();
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadMessage(null);
        loadData();
      }, 1200);
    } catch (err: any) {
      setUploadMessage({ text: err.message || 'Gagal mengunggah screenshot.', isError: true });
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">
                Galeri Screenshot Perangkat
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-950 border border-sky-800 text-sky-300 font-mono">
                Asia/Jakarta (WIB)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Berkas gambar JPG/PNG disimpan langsung pada filesystem lokal VM (bukan Base64/MinIO). Metadata dikelola melalui tabel PostgreSQL terpisah.
            </p>
          </div>

          {/* Action buttons & View toggle */}
          <div className="flex items-center gap-2">
            {/* View switcher */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('gallery')}
                className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                  viewMode === 'gallery'
                    ? 'bg-sky-600 text-white font-medium shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Tampilan Galeri"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-sky-600 text-white font-medium shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Tampilan Tabel"
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Sync Disk Button */}
            <button
              onClick={handleSyncDisk}
              disabled={syncLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              title="Pindai dan sinkronkan semua berkas di /srv/app-data/screenshots/ ke database"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${syncLoading ? 'animate-spin' : ''}`} />
              <span>{syncLoading ? 'Sinkronisasi...' : 'Sinkronkan Disk VM'}</span>
            </button>

            {/* Test Upload Button */}
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition-colors shadow-sm cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Uji Unggah (Ingestion)</span>
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Date Range Picker */}
          <div className="flex flex-wrap items-center gap-2">
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

            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-md px-2.5 py-1 text-slate-300">
              <Laptop className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter Device ID..."
                value={deviceId}
                onChange={(e) => {
                  setDeviceId(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-slate-200 focus:outline-none text-xs w-28"
              />
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setStartDate(today);
                  setEndDate(today);
                  setPage(1);
                }}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors cursor-pointer"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  const end = new Date().toISOString().split('T')[0];
                  const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                  setStartDate(start);
                  setEndDate(end);
                  setPage(1);
                }}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors cursor-pointer"
              >
                7 Hari
              </button>
            </div>

            {(startDate || endDate || deviceId) && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-2 py-1 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 rounded text-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Reset
              </button>
            )}

            <button
              onClick={() => loadData()}
              disabled={loading}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              title="Perbarui daftar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            </button>
          </div>

          {/* Storage Directory Path Badge */}
          <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px] bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
            <HardDrive className="w-3.5 h-3.5 text-sky-400" />
            <span>Path VM:</span>
            <span className="text-slate-300">{data?.storagePath || '/srv/app-data/screenshots/'}</span>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`mx-4 mt-3 p-3 rounded-lg text-xs flex items-center justify-between border shadow-sm transition-all animate-fade-in ${
            toast.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/70 border-rose-800 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="p-1 hover:text-white rounded hover:bg-black/20 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Batch Selection Action Bar */}
      {selectedIds.length > 0 && (
        <div className="mx-4 mt-3 p-2.5 bg-sky-950/80 border border-sky-800/80 rounded-xl flex items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-sky-200 flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-sky-400" />
              <span>{selectedIds.length} screenshot terpilih</span>
            </span>
            <button
              onClick={() => setSelectedIds([])}
              className="text-slate-400 hover:text-white underline text-[11px] cursor-pointer"
            >
              Batalkan Pilihan
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBatchDeleteModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium transition-colors shadow-xs cursor-pointer text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus ({selectedIds.length}) File Terpilih</span>
            </button>
          </div>
        </div>
      )}

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

      {/* Main Content: Gallery or Table */}
      <div className="flex-1 overflow-auto p-4">
        {loading && !data ? (
          <div className="py-24 text-center text-slate-500">
            <div className="inline-block w-8 h-8 border-2 border-slate-600 border-t-sky-400 rounded-full animate-spin mb-2"></div>
            <div>Memuat metadata screenshot dari database PostgreSQL...</div>
          </div>
        ) : !data || data.records.length === 0 ? (
          <div className="py-24 text-center text-slate-400 bg-slate-900/40 border border-slate-800/80 rounded-xl p-8 max-w-lg mx-auto mt-6">
            <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-200">Belum Ada Screenshot Tersimpan</h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Screenshot akan muncul di sini saat agen perekam perangkat mengunggah gambar ke endpoint backend atau Anda dapat menyinkronkan berkas yang sudah ada di disk VM.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={handleSyncDisk}
                disabled={syncLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${syncLoading ? 'animate-spin' : ''}`} />
                <span>{syncLoading ? 'Menyinkronkan Berkas...' : 'Sinkronkan Berkas Disk VM'}</span>
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Uji Unggah Screenshot</span>
              </button>
            </div>
          </div>
        ) : viewMode === 'gallery' ? (
          /* Gallery Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.records.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`group bg-slate-900 border rounded-xl overflow-hidden transition-all duration-200 shadow-sm hover:shadow-lg flex flex-col cursor-pointer ${
                    isSelected
                      ? 'border-sky-500 ring-1 ring-sky-500/50 bg-slate-900/90'
                      : 'border-slate-800/90 hover:border-sky-500/50 hover:shadow-sky-500/5'
                  }`}
                >
                  {/* Thumbnail Image Box */}
                  <div className="relative aspect-video bg-slate-950 overflow-hidden flex items-center justify-center border-b border-slate-800/80">
                    <img
                      src={getScreenshotImageUrl(item.id)}
                      alt={item.original_filename}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <span className="p-2 bg-slate-900/90 text-white rounded-full border border-slate-700 shadow-md">
                        <Maximize2 className="w-4 h-4" />
                      </span>
                    </div>

                    {/* Selection Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => toggleSelectItem(item.id, e)}
                      className={`absolute top-2 left-2 z-10 p-1 rounded-md backdrop-blur-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-sky-600 text-white shadow'
                          : 'bg-slate-950/80 text-slate-400 hover:text-white border border-slate-700/80'
                      }`}
                      title={isSelected ? 'Batalkan pilihan' : 'Pilih screenshot'}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-3.5 h-3.5" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Device Tag Badge */}
                    <div className="absolute top-2 left-9 px-2 py-0.5 rounded bg-slate-950/80 backdrop-blur-xs border border-slate-700/80 text-[10px] font-mono text-slate-200">
                      {item.device_id}
                    </div>

                    {/* Quick Delete Action Button on Card */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemToDelete(item);
                      }}
                      className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-slate-950/80 hover:bg-rose-900/90 text-slate-400 hover:text-rose-200 border border-slate-700/80 hover:border-rose-600 transition-all cursor-pointer shadow opacity-80 group-hover:opacity-100"
                      title="Hapus screenshot ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* File Size */}
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-slate-950/80 backdrop-blur-xs text-[10px] font-mono text-slate-300">
                      {formatBytes(item.file_size)}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-slate-200 truncate pr-2" title={item.original_filename}>
                          {item.original_filename}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.2 rounded">
                          {item.storage_status}
                        </span>
                      </div>

                      <div className="text-[11px] text-sky-400 font-mono flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3 text-sky-400/80" />
                        <span>{formatToWIB(item.timestamp)}</span>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="truncate text-slate-400 font-mono text-[10px] max-w-[150px]" title={item.filename}>
                        {item.filename}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setItemToDelete(item);
                          }}
                          className="p-1 hover:bg-rose-950/80 text-slate-500 hover:text-rose-300 rounded transition-colors cursor-pointer"
                          title="Hapus foto"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="cursor-pointer text-slate-400 hover:text-white"
                      title="Pilih semua di halaman ini"
                    >
                      {data.records.length > 0 && selectedIds.length === data.records.length ? (
                        <CheckSquare className="w-4 h-4 text-sky-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Preview</th>
                  <th className="py-3 px-4">Nama Berkas</th>
                  <th className="py-3 px-3">Device ID</th>
                  <th className="py-3 px-4">Tanggal &amp; Waktu (WIB)</th>
                  <th className="py-3 px-3">Ukuran</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {data.records.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`transition-colors cursor-pointer ${
                        isSelected ? 'bg-sky-950/30 hover:bg-sky-950/40' : 'hover:bg-slate-850/60'
                      }`}
                    >
                      <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => toggleSelectItem(item.id, e)}
                          className="cursor-pointer text-slate-400 hover:text-white"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-sky-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-2 px-4 w-16">
                        <div className="w-12 h-8 rounded bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                          <img
                            src={getScreenshotImageUrl(item.id)}
                            alt={item.original_filename}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div className="text-slate-100 font-medium">{item.original_filename}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{item.filename}</div>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {item.device_id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200 font-medium">{formatDateOnlyWIB(item.timestamp)}</div>
                        <div className="text-[11px] text-sky-400 font-mono">{formatTimeOnlyWIB(item.timestamp)}</div>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {formatBytes(item.file_size)}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                          {item.storage_status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedItem(item);
                            }}
                            className="text-sky-400 hover:text-sky-300 font-medium px-2 py-1 rounded hover:bg-sky-950/40"
                          >
                            Pratinjau
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setItemToDelete(item);
                            }}
                            className="p-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-950/60 rounded border border-transparent hover:border-rose-800 transition-colors cursor-pointer"
                            title="Hapus file screenshot"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div>
          {data ? (
            <span>
              Menampilkan <span className="font-medium text-slate-200">{data.records.length}</span> dari{' '}
              <span className="font-medium text-slate-200">{data.total}</span> screenshot &bull; Halaman{' '}
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
            <option value="12">12 per halaman</option>
            <option value="24">24 per halaman</option>
            <option value="48">48 per halaman</option>
          </select>

          {/* Prev/Next buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-slate-300">{page}</span>
            <button
              onClick={() => setPage((p) => (data && p < data.totalPages ? p + 1 : p))}
              disabled={!data || page >= data.totalPages || loading}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox / Preview Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-sky-400" />
                  Pratinjau Screenshot &bull; {selectedItem.original_filename}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Waktu: {formatToWIB(selectedItem.timestamp)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={getScreenshotImageUrl(selectedItem.id)}
                  download={selectedItem.filename}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs transition-colors cursor-pointer"
                  title="Unduh gambar screenshot"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>Unduh</span>
                </a>
                <button
                  type="button"
                  onClick={() => setItemToDelete(selectedItem)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900/90 text-rose-300 border border-rose-800 text-xs transition-colors cursor-pointer"
                  title="Hapus berkas foto dari disk VM dan metadata"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Hapus</span>
                </button>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Image Preview */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/90 min-h-[320px]">
              <img
                src={getScreenshotImageUrl(selectedItem.id)}
                alt={selectedItem.original_filename}
                className="max-h-[55vh] max-w-full object-contain rounded-lg border border-slate-800 shadow-md"
              />
            </div>

            {/* Modal Footer: Metadata Details */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-slate-400 block text-[11px]">ID Metadata:</span>
                  <span className="font-mono text-slate-200">{selectedItem.id}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Nama Berkas Unik VM:</span>
                  <span className="font-mono text-slate-200 truncate block" title={selectedItem.filename}>
                    {selectedItem.filename}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Ukuran &amp; Format:</span>
                  <span className="font-mono text-slate-200">
                    {formatBytes(selectedItem.file_size)} ({selectedItem.mime_type})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Device ID:</span>
                  <span className="font-mono text-slate-200">{selectedItem.device_id}</span>
                </div>
              </div>

              {selectedItem.notes && (
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-slate-400">
                  <span className="text-slate-400 text-[11px] block">Catatan Aktivitas:</span>
                  <p className="text-slate-300 mt-0.5">{selectedItem.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Single Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-950/80 border border-rose-800/80">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Konfirmasi Hapus File Screenshot</h3>
                <p className="text-xs text-slate-400">Penghapusan fisik dari direktori disk VM</p>
              </div>
            </div>

            <div className="py-4 space-y-3">
              {/* Image Thumbnail & Details Preview */}
              <div className="flex gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 items-center">
                <div className="w-16 h-12 rounded-lg bg-black overflow-hidden shrink-0 border border-slate-800">
                  <img
                    src={getScreenshotImageUrl(itemToDelete.id)}
                    alt={itemToDelete.original_filename}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 text-xs">
                  <div className="font-medium text-slate-200 truncate" title={itemToDelete.original_filename}>
                    {itemToDelete.original_filename}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono truncate" title={itemToDelete.filename}>
                    {itemToDelete.filename}
                  </div>
                  <div className="text-[10px] text-sky-400 font-mono mt-0.5">
                    {formatToWIB(itemToDelete.timestamp)} &bull; {formatBytes(itemToDelete.file_size)}
                  </div>
                </div>
              </div>

              {/* Warning box */}
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-rose-200 text-xs leading-relaxed">
                <p className="font-medium text-rose-300 mb-1 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Peringatan Permanen:</span>
                </p>
                File fisik gambar akan dihapus dari folder VM (<code className="font-mono text-rose-300 text-[11px] bg-rose-950 px-1 py-0.5 rounded">/srv/app-data/screenshots/</code>) dan metadata pada database akan dibersihkan. Tindakan tidak dapat dibatalkan.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={confirmSingleDelete}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors cursor-pointer shadow-md disabled:opacity-50"
              >
                {deleteLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-950/80 border border-rose-800/80">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Hapus Massal Screenshot</h3>
                <p className="text-xs text-slate-400">{selectedIds.length} berkas foto dipilih</p>
              </div>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                Anda akan menghapus <span className="font-bold text-white">{selectedIds.length} screenshot</span> secara sekaligus.
              </p>

              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-rose-200 text-xs leading-relaxed">
                <p className="font-medium text-rose-300 mb-1 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Peringatan Permanen:</span>
                </p>
                Semua berkas fisik yang sesuai akan dihapus dari direktori VM (<code className="font-mono text-rose-300 text-[11px] bg-rose-950 px-1 py-0.5 rounded">/srv/app-data/screenshots/</code>) dan database akan diperbarui. Tindakan ini tidak dapat dipulihkan.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setShowBatchDeleteModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={confirmBatchDelete}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors cursor-pointer shadow-md disabled:opacity-50"
              >
                {deleteLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus {selectedIds.length} File...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus Semua ({selectedIds.length}) File</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Test Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-sky-400" />
                Sinkronisasi Screenshot dari Laptop ke Web
              </h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadMessage(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 mt-3 shrink-0">
              <button
                type="button"
                onClick={() => setUploadTab('upload')}
                className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                  uploadTab === 'upload'
                    ? 'border-sky-500 text-sky-400 bg-sky-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                1. Unggah Langsung (Web)
              </button>
              <button
                type="button"
                onClick={() => setUploadTab('scp')}
                className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                  uploadTab === 'scp'
                    ? 'border-sky-500 text-sky-400 bg-sky-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                2. SCP / FileZilla (Massal)
              </button>
              <button
                type="button"
                onClick={() => setUploadTab('script')}
                className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                  uploadTab === 'script'
                    ? 'border-sky-500 text-sky-400 bg-sky-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                3. Auto-Sync Windows
              </button>
            </div>

            <div className="overflow-y-auto mt-4 space-y-3.5 pr-1 text-xs">
              {uploadMessage && (
                <div
                  className={`p-3 rounded-lg text-xs flex flex-col gap-2 ${
                    uploadMessage.isError
                      ? 'bg-rose-950/60 border border-rose-800 text-rose-300'
                      : 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {uploadMessage.isError ? (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <span className="break-words leading-relaxed">{uploadMessage.text}</span>
                  </div>
                  {uploadMessage.isError && (uploadMessage.text.includes('EACCES') || uploadMessage.text.includes('permission denied')) && (
                    <div className="mt-1 p-2.5 rounded bg-slate-950 border border-rose-900/60 text-slate-300 font-sans text-[11px] space-y-1">
                      <p className="font-semibold text-rose-300">Solusi Izin VM (Jalankan di Terminal VM Ubuntu):</p>
                      <code className="block bg-slate-900 p-1.5 rounded font-mono text-emerald-400 select-all border border-slate-800">
                        sudo chown -R $USER:$USER /srv/app-data/screenshots &amp;&amp; sudo chmod -R 775 /srv/app-data/screenshots
                      </code>
                    </div>
                  )}
                </div>
              )}

              {uploadTab === 'upload' && (
                <form onSubmit={handleUploadSubmit} className="space-y-3.5">
                  <p className="text-slate-300 leading-relaxed">
                    Pilih file screenshot dari folder <code className="bg-slate-950 px-1.5 py-0.5 rounded text-sky-300 font-mono">screenshots</code> di laptop Anda. Nama file asli (seperti <code className="text-emerald-400 font-mono">screenshot_keyword_*.png</code>) akan dipertahankan sehingga otomatis cocok dengan log database PostgreSQL.
                  </p>

                  <div className="p-4 border-2 border-dashed border-slate-700 hover:border-sky-500/70 rounded-xl bg-slate-950/60 text-center transition-colors">
                    <input
                      type="file"
                      ref={fileInputRef}
                      multiple
                      accept="image/jpeg,image/png,image/jpg"
                      required
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          setUploadFiles(Array.from(e.target.files));
                        }
                      }}
                      className="hidden"
                      id="batch-file-input"
                    />
                    <label htmlFor="batch-file-input" className="cursor-pointer block">
                      <Upload className="w-8 h-8 text-sky-400 mx-auto mb-2" />
                      <span className="font-semibold text-white block">
                        Klik untuk memilih berkas screenshot (Bisa pilih banyak sekaligus)
                      </span>
                      <span className="text-slate-400 text-[11px] mt-1 block">
                        Format didukung: PNG, JPG (maks. 50 file per batch)
                      </span>
                    </label>

                    {uploadFiles.length > 0 && (
                      <div className="mt-3 p-2 bg-sky-950/40 border border-sky-800/50 rounded text-sky-300 text-left font-mono text-[11px] max-h-24 overflow-y-auto">
                        <strong>{uploadFiles.length} file dipilih:</strong>
                        <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-300">
                          {uploadFiles.slice(0, 5).map((f, i) => (
                            <li key={i}>{f.name} ({(f.size / 1024).toFixed(0)} KB)</li>
                          ))}
                          {uploadFiles.length > 5 && <li>...dan {uploadFiles.length - 5} file lainnya</li>}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Device ID:</label>
                      <input
                        type="text"
                        value={uploadDeviceId}
                        onChange={(e) => setUploadDeviceId(e.target.value)}
                        placeholder="DEVICE-01"
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-slate-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Catatan Tambahan:</label>
                      <input
                        type="text"
                        value={uploadNotes}
                        onChange={(e) => setUploadNotes(e.target.value)}
                        placeholder="Sinkronisasi manual"
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-slate-200"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(false)}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={uploadLoading || uploadFiles.length === 0}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      {uploadLoading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>Menyimpan ke VM Disk...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>Unggah {uploadFiles.length > 0 ? `(${uploadFiles.length} File)` : ''}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {uploadTab === 'scp' && (
                <div className="space-y-3">
                  <p className="text-slate-300 leading-relaxed">
                    Jika Anda memiliki puluhan atau ratusan file di laptop Windows, cara paling cepat adalah menyalin satu folder penuh langsung ke direktori penyimpanan VM (<code className="text-sky-300 font-mono">/srv/app-data/screenshots/</code>).
                  </p>

                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
                    <span className="font-semibold text-white block">Perintah PowerShell / CMD Windows:</span>
                    <pre className="p-2.5 bg-black rounded font-mono text-[11px] text-emerald-400 overflow-x-auto whitespace-pre">
                      scp -r C:\Path\Ke\screenshots\* ubuntu@IP_VM_ANDA:/srv/app-data/screenshots/
                    </pre>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
                    <span className="font-semibold text-white block">Atau Menggunakan FileZilla / WinSCP (GUI):</span>
                    <ol className="list-decimal list-inside text-slate-300 space-y-1 pl-1">
                      <li>Buka WinSCP / FileZilla di Windows.</li>
                      <li>Koneksikan dengan protokol <strong>SFTP</strong>, Host: <code className="text-sky-300 font-mono">IP_VM_ANDA</code>, Port: 22, User: <code className="text-sky-300 font-mono">ubuntu</code>.</li>
                      <li>Di panel kanan (server), buka folder: <code className="text-emerald-400 font-mono">/srv/app-data/screenshots/</code>.</li>
                      <li>Drag &amp; drop seluruh isi folder <code className="text-amber-300 font-mono">screenshots</code> dari laptop Anda ke sana.</li>
                    </ol>
                  </div>
                </div>
              )}

              {uploadTab === 'script' && (
                <div className="space-y-3">
                  <p className="text-slate-300 leading-relaxed">
                    Aplikasi background Windows dapat langsung menembakkan setiap screenshot baru ke REST API dashboard menggunakan endpoint ingest.
                  </p>

                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
                    <span className="font-semibold text-white block">Endpoint Ingest HTTP POST:</span>
                    <div className="p-2 bg-black rounded font-mono text-[11px] text-sky-400">
                      POST http://IP_VM_ANDA:3000/api/screenshots/ingest
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
                    <span className="font-semibold text-white block">Contoh Kode Python (di Windows Client):</span>
                    <pre className="p-2.5 bg-black rounded font-mono text-[11px] text-emerald-400 overflow-x-auto whitespace-pre leading-relaxed">
{`import requests

def upload_screenshot_to_web(image_path):
    url = "http://IP_VM_ANDA:3000/api/screenshots/ingest"
    with open(image_path, "rb") as f:
        files = {"screenshot": f}
        # Sertakan x-api-key jika dikonfigurasi di .env
        headers = {"x-api-key": "devmon-sync-secret-2026"}
        res = requests.post(url, files=files, headers=headers)
        return res.status_code == 201`}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
