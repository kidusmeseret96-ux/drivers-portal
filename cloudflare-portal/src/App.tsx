import {useCallback, useEffect, useState} from 'react';
import {ChangePasswordModal} from './components/ChangePasswordModal';
import {MemberSelfPortal} from './components/MemberSelfPortal';
import {OfficePortalShell} from './components/OfficePortalShell';
import {PortalLoginScreen} from './components/PortalLoginScreen';
import {translatePortal} from './i18n/portalCopy';
import {
  fetchPortalBranding,
  portalGetWorkspace,
  portalLogout,
  type PortalBranding,
  type PortalSession,
  type PortalWorkspace,
} from './lib/supabasePortal';
import type {LanguageCode} from './types/ada';

const PORTAL_LANG_STORAGE_KEY = 'routeledger_portal_lang';
const VALID_LANGS: LanguageCode[] = ['en', 'am', 'om', 'ti', 'so', 'aa'];

function getSavedPortalLanguage(): LanguageCode | null {
  try {
    const saved = window.localStorage.getItem(PORTAL_LANG_STORAGE_KEY);
    if (saved && VALID_LANGS.includes(saved as LanguageCode)) {
      return saved as LanguageCode;
    }
  } catch {
    // ignore storage access issues
  }
  return null;
}

export default function App() {
  const [branding, setBranding] = useState<PortalBranding>({
    associationName: 'ADAMA HEAVY TRUCK DRIVERS EDIR',
    language: 'en',
  });
  const [language, setLanguage] = useState<LanguageCode>(() => getSavedPortalLanguage() ?? 'en');
  const [session, setSession] = useState<PortalSession | null>(null);
  const [workspace, setWorkspace] = useState<PortalWorkspace | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const handleLanguageChange = useCallback((nextLang: LanguageCode) => {
    setLanguage(nextLang);
    try {
      window.localStorage.setItem(PORTAL_LANG_STORAGE_KEY, nextLang);
    } catch {
      // ignore storage access issues
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language || 'en';
  }, [language]);

  useEffect(() => {
    void fetchPortalBranding().then((nextBranding) => {
      setBranding(nextBranding);
      if (!getSavedPortalLanguage() && nextBranding.language) {
        setLanguage(nextBranding.language);
      }
    });
  }, []);

  const loadWorkspace = useCallback(async (activeSession: PortalSession) => {
    setLoadingWorkspace(true);
    setLoadError(null);
    try {
      const ws = await portalGetWorkspace(activeSession.token);
      setWorkspace(ws);
      if (!getSavedPortalLanguage() && ws.settings?.language) {
        setLanguage(ws.settings.language);
      }
      if (ws.mustChangePassword) {
        setShowChangePassword(true);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load portal workspace.');
    } finally {
      setLoadingWorkspace(false);
    }
  }, []);

  const handleLoginSuccess = async (nextSession: PortalSession) => {
    setSession(nextSession);
    await loadWorkspace(nextSession);
  };

  const handleLogout = async () => {
    const token = session?.token;
    setSession(null);
    setWorkspace(null);
    setShowChangePassword(false);
    setLoadError(null);
    if (token) {
      await portalLogout(token).catch(() => {});
    }
  };

  if (!session) {
    return (
      <PortalLoginScreen
        branding={branding}
        language={language}
        onLanguageChange={handleLanguageChange}
        onSuccess={handleLoginSuccess}
      />
    );
  }

  if (loadingWorkspace && !workspace) {
    return (
      <div className="ada-canvas-bg flex min-h-screen items-center justify-center p-6">
        <div className="ada-surface rounded-2xl border px-8 py-6 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#0B2C5D] border-t-transparent" />
          <p className="mt-3 text-xs font-medium text-slate-600 dark:text-slate-300">
            {translatePortal(language, 'loadingWorkspace')}
          </p>
        </div>
      </div>
    );
  }

  if (loadError && !workspace) {
    return (
      <div className="ada-canvas-bg flex min-h-screen items-center justify-center p-6">
        <div className="ada-surface max-w-md space-y-4 rounded-2xl border p-6 text-center">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">{loadError}</p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => loadWorkspace(session)}
              className="rounded-lg bg-[#0B2C5D] px-4 py-2 text-xs font-semibold text-white"
            >
              {translatePortal(language, 'retryBtn')}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            >
              {translatePortal(language, 'backToSignInBtn')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!workspace) return null;

  return (
    <>
      {workspace.isFullAccess ? (
        <OfficePortalShell
          token={session.token}
          initialWorkspace={workspace}
          language={language}
          onLanguageChange={handleLanguageChange}
          onRefresh={() => loadWorkspace(session)}
          onOpenChangePassword={() => setShowChangePassword(true)}
          onLogout={handleLogout}
        />
      ) : (
        <MemberSelfPortal
          workspace={workspace}
          language={language}
          onLanguageChange={handleLanguageChange}
          onRefresh={() => loadWorkspace(session)}
          onOpenChangePassword={() => setShowChangePassword(true)}
          onLogout={handleLogout}
        />
      )}

      <ChangePasswordModal
        isOpen={showChangePassword}
        token={session.token}
        memberId={session.memberId}
        language={language}
        forceDefaultNotice={workspace.mustChangePassword}
        onClose={() => setShowChangePassword(false)}
        onChanged={() => {
          setWorkspace((prev) => (prev ? {...prev, mustChangePassword: false} : prev));
        }}
      />
    </>
  );
}
