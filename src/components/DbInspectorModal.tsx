import React, { useState, useEffect } from 'react';
import {
  Database,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Table,
  Layers,
  Sparkles,
  Key,
  Calendar,
  Lock,
} from 'lucide-react';
import {
  getSchemaInspection,
  configureSchema,
  seedSampleData,
  testDatabaseConnection,
  downloadBackupManifest,
} from '../services/api.js';
import { SchemaInspectionResult, TableSchemaInfo } from '../types.js';

interface DbInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchemaUpdated?: () => void;
}

export const DbInspectorModal: React.FC<DbInspectorModalProps> = ({
  isOpen,
  onClose,
  onSchemaUpdated,
}) => {
  const [data, setData] = useState<SchemaInspectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedColumnMapping, setSelectedColumnMapping] = useState({
    keyword: 'keyword',
    timestamp: 'timestamp',
  });
  const [actionMessage, setActionMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Custom connection form state
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [dbHost, setDbHost] = useState('127.0.0.1');
  const [dbPort, setDbPort] = useState('5432');
  const [dbUser, setDbUser] = useState('postgres');
  const [dbPass, setDbPass] = useState('');
  const [dbName, setDbName] = useState('device_activity_db');
  const [dbSsl, setDbSsl] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState(false);

  const loadSchema = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSchemaInspection();
      setData(res.schema);
      if (res.schema.activeKeywordTable) {
        setSelectedTable(res.schema.activeKeywordTable);
      } else if (res.schema.tables.length > 0) {
        setSelectedTable(res.schema.tables[0].name);
      }
      if (res.schema.activeKeywordColumnMapping) {
        setSelectedColumnMapping({
          keyword: res.schema.activeKeywordColumnMapping.keyword || 'keyword',
          timestamp: res.schema.activeKeywordColumnMapping.timestamp || 'timestamp',
        });
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memeriksa schema PostgreSQL.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSchema();
    }
  }, [isOpen]);

  const handleApplyTable = async () => {
    if (!selectedTable) return;
    try {
      await configureSchema(selectedTable, selectedColumnMapping);
      setActionMessage({ text: `Sumber data dialihkan ke tabel "${selectedTable}".` });
      if (onSchemaUpdated) onSchemaUpdated();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      setActionMessage({ text: err.message, isError: true });
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setActionMessage(null);
    try {
      const res = await seedSampleData();
      setActionMessage({
        text: 'Inisialisasi berhasil: Tabel device_activity_logs & screenshot_metadata siap digunakan!',
      });
      await loadSchema();
      if (onSchemaUpdated) onSchemaUpdated();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Gagal melakukan inisialisasi tabel.', isError: true });
    } finally {
      setSeeding(false);
    }
  };

  const handleTestAndConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingConnection(true);
    setActionMessage(null);
    try {
      const res = await testDatabaseConnection({
        host: dbHost,
        port: parseInt(dbPort, 10),
        user: dbUser,
        password: dbPass,
        database: dbName,
        ssl: dbSsl,
      });
      setActionMessage({ text: res.message });
      setShowConnectForm(false);
      await loadSchema();
      if (onSchemaUpdated) onSchemaUpdated();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Gagal menguji koneksi PostgreSQL.', isError: true });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleDownloadBackup = async () => {
    setDownloadingBackup(true);
    try {
      await downloadBackupManifest();
      setActionMessage({ text: 'Berkas cadangan JSON berhasil diunduh.' });
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Gagal mengunduh cadangan.', isError: true });
    } finally {
      setDownloadingBackup(false);
    }
  };

  if (!isOpen) return null;

  const currentTableObj = data?.tables.find((t) => t.name === selectedTable);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl text-slate-100 text-xs">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-lg">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Inspeksi Koneksi &amp; Schema Database PostgreSQL
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Memeriksa tabel dan kolom riil tanpa mengubah atau menghapus data sumber.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadSchema}
              disabled={loading}
              className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Refresh Schema"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5 space-y-4">
          {actionMessage && (
            <div
              className={`p-3 rounded-lg flex items-center gap-2 ${
                actionMessage.isError
                  ? 'bg-rose-950/60 border border-rose-800 text-rose-300'
                  : 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
              }`}
            >
              {actionMessage.isError ? (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{actionMessage.text}</span>
            </div>
          )}

          {/* Connection Overview Banner */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  data?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <div>
                <div className="font-semibold text-slate-200">
                  Status: {data?.connected ? 'Terhubung ke PostgreSQL Aktif' : 'Mode Fallback / Sandboxing Lokal'}
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Host: {data?.dbConfigSafe.host}:{data?.dbConfigSafe.port} &bull; DB: {data?.dbConfigSafe.database} &bull; User: {data?.dbConfigSafe.user}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowConnectForm(!showConnectForm)}
                className="px-2.5 py-1 rounded bg-sky-900/40 hover:bg-sky-800/50 text-sky-300 border border-sky-700/50 text-[11px] font-medium transition-colors cursor-pointer"
              >
                {showConnectForm ? 'Tutup Pengaturan' : 'Ubah / Uji Koneksi DB'}
              </button>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>Password DB: [Aman]</span>
              </div>
            </div>
          </div>

          {/* Collapsible Manual PostgreSQL Connection Form */}
          {showConnectForm && (
            <form onSubmit={handleTestAndConnect} className="p-4 bg-slate-950 border border-sky-800/60 rounded-xl space-y-3">
              <h5 className="font-semibold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-sky-400" />
                Uji &amp; Hubungkan PostgreSQL Manual
              </h5>
              <p className="text-[11px] text-slate-400">
                Masukkan parameter koneksi database PostgreSQL VM. Sistem akan menguji koneksi (timeout 4 detik) dan langsung mengalihkan sumber data tanpa me-restart server.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-slate-400 text-[10px] mb-1">Host:</label>
                  <input
                    type="text"
                    required
                    value={dbHost}
                    onChange={(e) => setDbHost(e.target.value)}
                    placeholder="127.0.0.1"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px] mb-1">Port:</label>
                  <input
                    type="text"
                    required
                    value={dbPort}
                    onChange={(e) => setDbPort(e.target.value)}
                    placeholder="5432"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px] mb-1">User:</label>
                  <input
                    type="text"
                    required
                    value={dbUser}
                    onChange={(e) => setDbUser(e.target.value)}
                    placeholder="postgres"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px] mb-1">Database:</label>
                  <input
                    type="text"
                    required
                    value={dbName}
                    onChange={(e) => setDbName(e.target.value)}
                    placeholder="device_activity_db"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-400 text-[10px] mb-1">Password Database:</label>
                  <input
                    type="password"
                    value={dbPass}
                    onChange={(e) => setDbPass(e.target.value)}
                    placeholder="Masukkan password database..."
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs font-mono"
                  />
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-xs">
                    <input
                      type="checkbox"
                      checked={dbSsl}
                      onChange={(e) => setDbSsl(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-sky-500"
                    />
                    <span>Gunakan SSL / TLS</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConnectForm(false)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={testingConnection}
                  className="px-4 py-1 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white rounded text-xs font-medium cursor-pointer"
                >
                  {testingConnection ? 'Menguji Koneksi...' : 'Uji & Terapkan Koneksi'}
                </button>
              </div>
            </form>
          )}

          {data?.error && (
            <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <span className="font-semibold block">Catatan Koneksi Database:</span>
                <span className="text-[11px]">{data.error}</span>
              </div>
            </div>
          )}

          {/* Table Selector & Column Mapping */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
              <Table className="w-4 h-4 text-sky-400" />
              Tabel Sumber Data Keyword &amp; Event
            </h4>
            <p className="text-slate-400 text-[11px] mb-3 leading-relaxed">
              Pilih tabel yang memuat catatan aktivitas perangkat. Sistem akan membaca record dengan parameterized SELECT query tanpa mengubah atau menghapus data asli.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Pilih Tabel:</label>
                <select
                  value={selectedTable}
                  onChange={(e) => {
                    const tbl = e.target.value;
                    setSelectedTable(tbl);
                    const tObj = data?.tables.find((t) => t.name === tbl);
                    if (tObj) {
                      setSelectedColumnMapping({
                        keyword: tObj.candidateKeywordColumn || 'keyword',
                        timestamp: tObj.candidateTimestampColumn || 'timestamp',
                      });
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-200 focus:outline-none"
                >
                  {data?.tables.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} ({t.rowCount} baris)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Kolom Keyword / Event:</label>
                <select
                  value={selectedColumnMapping.keyword}
                  onChange={(e) =>
                    setSelectedColumnMapping({ ...selectedColumnMapping, keyword: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-200 focus:outline-none"
                >
                  {currentTableObj?.columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Kolom Waktu (Timestamp):</label>
                <select
                  value={selectedColumnMapping.timestamp}
                  onChange={(e) =>
                    setSelectedColumnMapping({ ...selectedColumnMapping, timestamp: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-200 focus:outline-none"
                >
                  {currentTableObj?.columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} {c.isTimestamp ? '⏱ (Timestamp)' : `(${c.type})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleApplyTable}
                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-md font-medium transition-colors cursor-pointer"
              >
                Terapkan Mapping Kolom Ini
              </button>
            </div>
          </div>

          {/* Inspected Columns Breakdown */}
          {currentTableObj && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <h4 className="font-semibold text-slate-200 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  Struktur Kolom Tabel: <code className="text-sky-300">{currentTableObj.name}</code>
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  Total {currentTableObj.columns.length} kolom &bull; {currentTableObj.rowCount} record
                </span>
              </h4>

              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                      <th className="py-2 px-3">Nama Kolom</th>
                      <th className="py-2 px-3">Tipe Data</th>
                      <th className="py-2 px-3">Primary Key</th>
                      <th className="py-2 px-3">Indikator Waktu</th>
                      <th className="py-2 px-3">Nullable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {currentTableObj.columns.map((col) => (
                      <tr key={col.name} className="hover:bg-slate-900/60 font-mono">
                        <td className="py-2 px-3 text-slate-200 font-medium">
                          {col.name}
                        </td>
                        <td className="py-2 px-3 text-slate-400">{col.type}</td>
                        <td className="py-2 px-3">
                          {col.isPrimaryKey ? (
                            <span className="inline-flex items-center gap-1 text-amber-400">
                              <Key className="w-3 h-3" /> PK
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {col.isTimestamp ? (
                            <span className="inline-flex items-center gap-1 text-sky-400">
                              <Calendar className="w-3 h-3" /> Timestamp
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-400">
                          {col.nullable ? 'YES' : 'NO'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Seed Sample & Permissions Helper */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h5 className="font-semibold text-slate-200">
                Inisialisasi Tabel &amp; Data Sampel Audit
              </h5>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Membuat tabel <code className="text-sky-300">device_activity_logs</code> dan tabel metadata screenshot <code className="text-sky-300">screenshot_metadata</code> jika belum ada.
              </p>
            </div>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>{seeding ? 'Memproses...' : 'Inisialisasi Tabel'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <button
            type="button"
            onClick={handleDownloadBackup}
            disabled={downloadingBackup}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-medium text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Unduh backup metadata JSON dari seluruh aktivitas dan screenshot"
          >
            <span>{downloadingBackup ? 'Menyiapkan Cadangan...' : 'Unduh Cadangan Metadata (JSON)'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium cursor-pointer"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
