import React from 'react';
import { KeyRound, Image as ImageIcon, Database, Terminal, LogOut } from 'lucide-react';

export type ActiveTab = 'keywords' | 'screenshots';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenDbInspector: () => void;
  onOpenDeploymentGuide: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onOpenDbInspector,
  onOpenDeploymentGuide,
  onLogout,
}) => {
  return (
    <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
      {/* Primary Navigation - Strictly only 2 data menus */}
      <div className="p-3">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
          Menu Utama
        </div>

        <nav className="space-y-1">
          {/* Menu 1: Keyword */}
          <button
            onClick={() => onTabChange('keywords')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'keywords'
                ? 'bg-sky-600/15 text-sky-400 border border-sky-500/30 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <KeyRound className={`w-4 h-4 ${activeTab === 'keywords' ? 'text-sky-400' : 'text-slate-400'}`} />
            <span>Keyword</span>
          </button>

          {/* Menu 2: Screenshot */}
          <button
            onClick={() => onTabChange('screenshots')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'screenshots'
                ? 'bg-sky-600/15 text-sky-400 border border-sky-500/30 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ImageIcon className={`w-4 h-4 ${activeTab === 'screenshots' ? 'text-sky-400' : 'text-slate-400'}`} />
            <span>Screenshot</span>
          </button>
        </nav>
      </div>

      {/* Utilities & Session Footer */}
      <div className="p-3 border-t border-slate-800 space-y-1">
        <div className="px-3 py-1 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
          Konfigurasi &amp; Info
        </div>

        {/* Database & Schema Inspector */}
        <button
          onClick={onOpenDbInspector}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <Database className="w-3.5 h-3.5 text-slate-400" />
          <span>Pemeriksaan Schema DB</span>
        </button>

        {/* Ubuntu Deployment Guide */}
        <button
          onClick={onOpenDeploymentGuide}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <Terminal className="w-3.5 h-3.5 text-slate-400" />
          <span>Panduan Deploy Ubuntu</span>
        </button>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 mt-2 rounded-lg text-xs text-rose-400 hover:bg-rose-950/30 border border-rose-900/30 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-400" />
          <span>Keluar (Logout)</span>
        </button>
      </div>
    </aside>
  );
};
