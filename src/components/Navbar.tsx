import React, { useState, useEffect } from 'react';
import { Database, HardDrive, Clock, LogOut, UserCheck, Shield } from 'lucide-react';
import { UserSession, SystemStatus } from '../types.js';

interface NavbarProps {
  user: UserSession;
  systemStatus: SystemStatus | null;
  onLogout: () => void;
  onOpenDbInspector: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  systemStatus,
  onLogout,
  onOpenDbInspector,
}) => {
  const [wibTime, setWibTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      try {
        const str = new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(new Date());
        setWibTime(`${str} WIB`);
      } catch {
        setWibTime('');
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isPostgresConnected = systemStatus?.database?.connected;

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 flex items-center justify-between text-slate-200 shrink-0">
      {/* Brand & Purpose */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-lg">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-sm text-white tracking-tight">
              Aktivitas Perangkat
            </span>
            <span className="hidden sm:inline-block ml-2 text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
              v1.0 (Audit Sah)
            </span>
          </div>
        </div>
      </div>

      {/* Status Indicators & Clock */}
      <div className="flex items-center gap-2 sm:gap-3 text-xs">
        {/* Live WIB Clock */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 font-mono text-slate-300">
          <Clock className="w-3.5 h-3.5 text-sky-400" />
          <span>{wibTime || 'Asia/Jakarta (WIB)'}</span>
        </div>

        {/* Monitoring Active / Pause Switch */}
        {systemStatus?.monitoring && (
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium text-[11px] ${
              systemStatus.monitoring.active
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
            }`}
            title="Status persetujuan & pencatatan telemetri perangkat"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                systemStatus.monitoring.active ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            <span>{systemStatus.monitoring.active ? 'Audit: Aktif' : 'Audit: Dijeda'}</span>
          </div>
        )}

        {/* Database Status Button */}
        <button
          onClick={onOpenDbInspector}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
            isPostgresConnected
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/40'
              : 'bg-amber-950/40 border-amber-800/60 text-amber-300 hover:bg-amber-900/40'
          }`}
          title="Klik untuk melihat status koneksi dan schema database PostgreSQL"
        >
          <Database className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">PostgreSQL:</span>
          <span className="font-medium">
            {isPostgresConnected ? 'Terhubung' : 'Demo / Standby'}
          </span>
        </button>

        {/* Storage status */}
        <div
          className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px]"
          title={`Path penyimpanan screenshot: ${systemStatus?.storage?.path || '/srv/app-data/screenshots/'}`}
        >
          <HardDrive className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">VM Disk:</span>
          <span>{systemStatus?.storage?.fileCount ?? 0} file</span>
        </div>

        {/* User Info */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/60 text-slate-200">
            <UserCheck className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-medium">{user.username}</span>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-800/40 transition-colors cursor-pointer"
            title="Keluar dari sesi dashboard"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
};
