import { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar.js';
import { Sidebar, ActiveTab } from './components/Sidebar.js';
import { KeywordsView } from './components/KeywordsView.js';
import { ScreenshotsView } from './components/ScreenshotsView.js';
import { LoginView } from './components/LoginView.js';
import { DbInspectorModal } from './components/DbInspectorModal.js';
import { DeploymentGuideModal } from './components/DeploymentGuideModal.js';
import { authStorage, logout, getSystemStatus, verifyCurrentSession } from './services/api.js';
import { UserSession, SystemStatus } from './types.js';

export default function App() {
  const [user, setUser] = useState<UserSession | null>(() => authStorage.getUser());
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('keywords');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  // Modals
  const [isDbInspectorOpen, setIsDbInspectorOpen] = useState(false);
  const [isDeploymentGuideOpen, setIsDeploymentGuideOpen] = useState(false);

  // Refresh system status (DB connection, disk storage, WIB clock)
  const loadSystemStatus = useCallback(async () => {
    try {
      const status = await getSystemStatus();
      setSystemStatus(status);
    } catch {
      // Ignore background status failure if session lost
    }
  }, []);

  // Check auth session on startup
  useEffect(() => {
    const initAuth = async () => {
      const token = authStorage.getToken();
      if (!token) {
        setUser(null);
        setIsInitializing(false);
        return;
      }

      try {
        const res = await verifyCurrentSession();
        setUser(res.user);
        await loadSystemStatus();
      } catch {
        authStorage.clear();
        setUser(null);
      } finally {
        setIsInitializing(false);
      }
    };

    initAuth();

    // Listen for unauthorized events dispatched by API service
    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [loadSystemStatus]);

  // Periodic system status refresh every 30s
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(loadSystemStatus, 30000);
    return () => clearInterval(interval);
  }, [user, loadSystemStatus]);

  const handleLoginSuccess = (loggedInUser: UserSession) => {
    setUser(loggedInUser);
    loadSystemStatus();
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-sky-400 rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-mono">Memverifikasi sesi aman...</p>
      </div>
    );
  }

  // If not authenticated, render Login view
  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden font-sans select-none">
      {/* Top Navigation */}
      <Navbar
        user={user}
        systemStatus={systemStatus}
        onLogout={handleLogout}
        onOpenDbInspector={() => setIsDbInspectorOpen(true)}
      />

      {/* Main Workspace: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onOpenDbInspector={() => setIsDbInspectorOpen(true)}
          onOpenDeploymentGuide={() => setIsDeploymentGuideOpen(true)}
          onLogout={handleLogout}
        />

        {/* Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-950">
          {activeTab === 'keywords' ? (
            <KeywordsView onOpenDbInspector={() => setIsDbInspectorOpen(true)} />
          ) : (
            <ScreenshotsView />
          )}
        </main>
      </div>

      {/* Modals */}
      <DbInspectorModal
        isOpen={isDbInspectorOpen}
        onClose={() => setIsDbInspectorOpen(false)}
        onSchemaUpdated={loadSystemStatus}
      />

      <DeploymentGuideModal
        isOpen={isDeploymentGuideOpen}
        onClose={() => setIsDeploymentGuideOpen(false)}
      />
    </div>
  );
}
