import {useEffect, useMemo, useState} from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Clock,
  CreditCard,
  HandHeart,
  LayoutDashboard,
  Lock,
  Menu,
  Moon,
  Receipt,
  Route,
  Settings,
  ShieldCheck,
  Sun,
  UserMinus,
  Users,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react';
import {LoginScreen} from './components/LoginScreen';
import {PWAInstallButton} from './components/PWAInstallButton';
import {
  applyCloudSnapshotToLocal,
  bulkPutAda,
  enqueueBulkSyncItems,
  enqueueSyncItem,
  importAdaBackup,
  initAndLoadAdaDb,
  putAda,
  resetAdaToDemo,
} from './db/adaDb';
import {DEFAULT_ADA_SETTINGS} from './db/adaSeed';
import {
  flushSyncQueueToSupabase,
  isSupabaseSyncConfigured,
  pullSnapshotFromSupabase,
  pushFullSnapshotToSupabase,
} from './db/supabaseSync';
import {useOnlineStatus} from './hooks/useOnlineStatus';
import {translate, type TranslationKey} from './i18n/translations';
import type {
  AdaExpense,
  AdaFullBackup,
  AdaIncidentAdvance,
  AdaMember,
  AdaMutualAidPayout,
  AdaPayment,
  AdaPenalty,
  AdaSettings,
  AdaTrip,
  AdaView,
  PaymentApprovalStatus,
  TripStatus,
} from './types/ada';
import {formatEthiopianDate} from './utils/ethiopianCalendar';
import {nextAvailableAdaMemberId, todayIsoDate} from './utils/formatters';
import {ASSOCIATION_LOGO_PATH} from './utils/idCardExport';
import {AdaDeletedMembersView} from './views/ada/AdaDeletedMembersView';
import {AdaFleetInsuranceView} from './views/ada/AdaFleetInsuranceView';
import {AdaHowToUseView} from './views/ada/AdaHowToUseView';
import {AdaIncidentsView} from './views/ada/AdaIncidentsView';
import {AdaLedgerView} from './views/ada/AdaLedgerView';
import {AdaMembersView} from './views/ada/AdaMembersView';
import {AdaMutualAidView} from './views/ada/AdaMutualAidView';
import {AdaOverdueView} from './views/ada/AdaOverdueView';
import {AdaOverviewView} from './views/ada/AdaOverviewView';
import {AdaPaymentsView} from './views/ada/AdaPaymentsView';
import {AdaPenaltiesView} from './views/ada/AdaPenaltiesView';
import {AdaReportsView} from './views/ada/AdaReportsView';
import {AdaSettingsView} from './views/ada/AdaSettingsView';
import {AdaTripsView} from './views/ada/AdaTripsView';

interface NavConfig {
  id: AdaView;
  labelKey: TranslationKey;
  icon: typeof LayoutDashboard;
}

const NAV_CONFIG: NavConfig[] = [
  {id: 'overview', labelKey: 'overview', icon: LayoutDashboard},
  {id: 'members', labelKey: 'members', icon: Users},
  {id: 'fleet', labelKey: 'fleetInsurance', icon: ShieldCheck},
  {id: 'trips', labelKey: 'tripDispatch', icon: Route},
  {id: 'incidents', labelKey: 'incidentsNav', icon: Wrench},
  {id: 'mutual-aid', labelKey: 'mutualAid', icon: HandHeart},
  {id: 'deleted-members', labelKey: 'deletedMembers', icon: UserMinus},
  {id: 'payments', labelKey: 'payments', icon: CreditCard},
  {id: 'overdue', labelKey: 'overdueDues', icon: Clock},
  {id: 'penalties', labelKey: 'penalties', icon: AlertTriangle},
  {id: 'ledger', labelKey: 'ledger', icon: Receipt},
  {id: 'reports', labelKey: 'reports', icon: BarChart3},
  {id: 'how-to-use', labelKey: 'howToUse', icon: BookOpen},
  {id: 'settings', labelKey: 'settings', icon: Settings},
];

export default function App() {
  const isOnline = useOnlineStatus();
  const [isLoading, setIsLoading] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [activeView, setActiveView] = useState<AdaView>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [settings, setSettings] = useState<AdaSettings>(DEFAULT_ADA_SETTINGS);
  const [members, setMembers] = useState<AdaMember[]>([]);
  const [payments, setPayments] = useState<AdaPayment[]>([]);
  const [penalties, setPenalties] = useState<AdaPenalty[]>([]);
  const [expenses, setExpenses] = useState<AdaExpense[]>([]);
  const [trips, setTrips] = useState<AdaTrip[]>([]);
  const [mutualAid, setMutualAid] = useState<AdaMutualAidPayout[]>([]);
  const [incidents, setIncidents] = useState<AdaIncidentAdvance[]>([]);

  const [paymentsInitialFilter, setPaymentsInitialFilter] = useState<
    'All' | PaymentApprovalStatus
  >('All');
  const [openCreatePaymentOnMount, setOpenCreatePaymentOnMount] = useState(false);
  const [paymentPrefill, setPaymentPrefill] = useState<{
    memberId: string;
    amount: number;
    categoryId?: string;
    note?: string;
  } | null>(null);

  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.lang = settings.language || 'en';
  }, [settings.language]);

  useEffect(() => {
    let active = true;
    initAndLoadAdaDb().then((state) => {
      if (!active) return;
      setSettings(state.settings);
      setMembers(state.members);
      setPayments(state.payments);
      setPenalties(state.penalties);
      setExpenses(state.expenses);
      setTrips(state.trips);
      setMutualAid(state.mutualAid);
      setIncidents(state.incidents);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const triggerBackgroundSync = async (activeSettings: AdaSettings) => {
    if (!isOnline || activeSettings.autoSyncOnline === false) return;
    if (!isSupabaseSyncConfigured(activeSettings)) return;
    try {
      await flushSyncQueueToSupabase(activeSettings);
    } catch (err) {
      console.warn('Background Supabase sync deferred:', err);
    }
  };

  useEffect(() => {
    if (
      isLoading ||
      !isOnline ||
      settings.autoSyncOnline === false ||
      !isSupabaseSyncConfigured(settings)
    ) {
      return;
    }

    const flush = () => {
      void flushSyncQueueToSupabase(settings).catch((err) => {
        console.warn('Online sync flush deferred:', err);
      });
    };

    flush();
    window.addEventListener('online', flush);
    window.addEventListener('focus', flush);
    return () => {
      window.removeEventListener('online', flush);
      window.removeEventListener('focus', flush);
    };
  }, [
    isLoading,
    isOnline,
    settings.autoSyncOnline,
    settings.supabaseUrl,
    settings.supabaseAnonKey,
    settings.supabaseSyncKey,
  ]);

  const pendingPaymentsCount = useMemo(
    () => payments.filter((p) => p.status === 'Pending').length,
    [payments]
  );

  const currentDateLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    []
  );

  const userInitials = useMemo(
    () =>
      settings.currentUserName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'AD',
    [settings.currentUserName]
  );

  // Handlers (always persist offline first, queue for Supabase upload, flush when online)
  const handleAddMember = async (member: AdaMember) => {
    await putAda('members', member);
    await enqueueSyncItem('members', member.id, member);
    setMembers((prev) => [...prev, member]);
    void triggerBackgroundSync(settings);
  };

  const handleBulkAddMembers = async (newMembers: AdaMember[]) => {
    await bulkPutAda('members', newMembers);
    await enqueueBulkSyncItems('members', newMembers);
    setMembers((prev) => [...prev, ...newMembers]);
    void triggerBackgroundSync(settings);
  };

  const handleUpdateMember = async (updated: AdaMember) => {
    await putAda('members', updated);
    await enqueueSyncItem('members', updated.id, updated);
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    void triggerBackgroundSync(settings);
  };

  const handleArchiveMember = async (id: string) => {
    const existing = members.find((m) => m.id === id);
    if (!existing) return;
    const originalCode = existing.previousMemberId || existing.memberId;
    const archived: AdaMember = {
      ...existing,
      memberId: existing.deletedAt
        ? existing.memberId
        : `DEL-${originalCode}-${existing.id.slice(-4)}`,
      previousMemberId: originalCode,
      statusBeforeDelete: existing.status,
      deletedAt: todayIsoDate(),
    };
    await putAda('members', archived);
    await enqueueSyncItem('members', archived.id, archived);
    setMembers((prev) => prev.map((m) => (m.id === id ? archived : m)));
    void triggerBackgroundSync(settings);
  };

  const handleRestoreMember = async (id: string) => {
    const existing = members.find((m) => m.id === id);
    if (!existing) return;
    const desiredId =
      existing.previousMemberId ||
      (existing.memberId.startsWith('DEL-')
        ? existing.memberId.replace(/^DEL-/, '').replace(/-[^-]+$/, '')
        : existing.memberId);
    const isDesiredTaken = members.some(
      (m) =>
        !m.deletedAt &&
        m.id !== existing.id &&
        m.memberId.trim().toUpperCase() === desiredId.trim().toUpperCase()
    );
    const restoredMemberId = isDesiredTaken ? nextAvailableAdaMemberId(members) : desiredId;
    const restored: AdaMember = {
      ...existing,
      memberId: restoredMemberId,
      status: existing.statusBeforeDelete ?? 'Active',
      deletedAt: undefined,
      statusBeforeDelete: undefined,
      previousMemberId: undefined,
    };
    await putAda('members', restored);
    await enqueueSyncItem('members', restored.id, restored);
    setMembers((prev) => prev.map((m) => (m.id === id ? restored : m)));
    void triggerBackgroundSync(settings);
  };

  const handleUpdateMemberRole = async (memberId: string, nextRole: string) => {
    const existing = members.find((m) => m.id === memberId);
    if (!existing) return;
    const updated: AdaMember = {...existing, role: nextRole};
    await putAda('members', updated);
    await enqueueSyncItem('members', updated.id, updated);
    setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
    void triggerBackgroundSync(settings);
  };

  const handleResetPortalPin = async (memberId: string) => {
    await enqueueSyncItem('resetPin', memberId, {memberId});
    void triggerBackgroundSync(settings);
  };

  const handleSavePayment = async (payment: AdaPayment) => {
    await putAda('payments', payment);
    await enqueueSyncItem('payments', payment.id, payment);
    setPayments((prev) => [payment, ...prev]);
    void triggerBackgroundSync(settings);
  };

  const handleUpdatePaymentStatus = async (
    paymentId: string,
    status: PaymentApprovalStatus,
    reviewerRole?: string
  ) => {
    const existing = payments.find((p) => p.id === paymentId);
    if (!existing) return;
    const updated: AdaPayment = {
      ...existing,
      status,
      reviewerRole: reviewerRole ?? existing.reviewerRole,
    };
    await putAda('payments', updated);
    await enqueueSyncItem('payments', updated.id, updated);
    setPayments((prev) => prev.map((p) => (p.id === paymentId ? updated : p)));
    void triggerBackgroundSync(settings);
  };

  const handleSavePenalty = async (penalty: AdaPenalty) => {
    await putAda('penalties', penalty);
    await enqueueSyncItem('penalties', penalty.id, penalty);
    setPenalties((prev) => [penalty, ...prev]);
    void triggerBackgroundSync(settings);
  };

  const handleMarkPenaltyPaid = async (penaltyId: string) => {
    const existing = penalties.find((p) => p.id === penaltyId);
    if (!existing) return;
    const updated: AdaPenalty = {
      ...existing,
      status: 'Paid',
      paidDate: todayIsoDate(),
    };
    await putAda('penalties', updated);
    await enqueueSyncItem('penalties', updated.id, updated);
    setPenalties((prev) => prev.map((p) => (p.id === penaltyId ? updated : p)));
    void triggerBackgroundSync(settings);
  };

  const handleSaveExpense = async (expense: AdaExpense) => {
    await putAda('expenses', expense);
    await enqueueSyncItem('expenses', expense.id, expense);
    setExpenses((prev) => [expense, ...prev]);
    void triggerBackgroundSync(settings);
  };

  const handleUpdateMemberCompliance = async (
    memberId: string,
    patch: Partial<AdaMember>
  ) => {
    const existing = members.find((m) => m.id === memberId);
    if (!existing) return;
    const updated: AdaMember = {...existing, ...patch};
    await putAda('members', updated);
    await enqueueSyncItem('members', updated.id, updated);
    setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
    void triggerBackgroundSync(settings);
  };

  const handleSaveTrip = async (trip: AdaTrip) => {
    await putAda('trips', trip);
    await enqueueSyncItem('trips', trip.id, trip);
    setTrips((prev) => [trip, ...prev]);
    void triggerBackgroundSync(settings);
  };

  const handleUpdateTripStatus = async (tripId: string, status: TripStatus) => {
    const existing = trips.find((t) => t.id === tripId);
    if (!existing) return;
    const updated: AdaTrip = {
      ...existing,
      status,
      completedDate: status === 'Completed' ? todayIsoDate() : existing.completedDate,
    };
    await putAda('trips', updated);
    await enqueueSyncItem('trips', updated.id, updated);
    setTrips((prev) => prev.map((t) => (t.id === tripId ? updated : t)));
    void triggerBackgroundSync(settings);
  };

  const handleSaveMutualAid = async (payout: AdaMutualAidPayout) => {
    await putAda('mutualAid', payout);
    await enqueueSyncItem('mutualAid', payout.id, payout);
    setMutualAid((prev) => [payout, ...prev]);
    void triggerBackgroundSync(settings);
  };

  const handleMarkMutualAidPaid = async (payoutId: string) => {
    const existing = mutualAid.find((p) => p.id === payoutId);
    if (!existing) return;
    const updated: AdaMutualAidPayout = {
      ...existing,
      status: 'Paid',
      paidDate: todayIsoDate(),
    };
    await putAda('mutualAid', updated);
    await enqueueSyncItem('mutualAid', updated.id, updated);
    setMutualAid((prev) => prev.map((p) => (p.id === payoutId ? updated : p)));
    void triggerBackgroundSync(settings);
  };

  const handleSaveIncident = async (incident: AdaIncidentAdvance) => {
    await putAda('incidents', incident);
    await enqueueSyncItem('incidents', incident.id, incident);
    setIncidents((prev) => [incident, ...prev]);
    void triggerBackgroundSync(settings);
  };

  const handleMarkIncidentSettled = async (incidentId: string) => {
    const existing = incidents.find((i) => i.id === incidentId);
    if (!existing) return;
    const updated: AdaIncidentAdvance = {
      ...existing,
      status: 'Settled',
      settledDate: todayIsoDate(),
    };
    await putAda('incidents', updated);
    await enqueueSyncItem('incidents', updated.id, updated);
    setIncidents((prev) => prev.map((i) => (i.id === incidentId ? updated : i)));
    void triggerBackgroundSync(settings);
  };

  const handlePushAllToSupabase = async (settingsOverride?: AdaSettings) => {
    const activeSettings = settingsOverride ?? settings;
    const res = await pushFullSnapshotToSupabase({
      settings: activeSettings,
      members,
      payments,
      penalties,
      expenses,
      trips,
      mutualAid,
      incidents,
    });
    const stampedSettings: AdaSettings = {...activeSettings, lastSyncedAt: res.syncedAt};
    await putAda('settings', stampedSettings);
    setSettings(stampedSettings);
    return res;
  };

  const handleSaveSettings = async (next: AdaSettings) => {
    const configChanged =
      next.supabaseUrl !== settings.supabaseUrl ||
      next.supabaseAnonKey !== settings.supabaseAnonKey ||
      next.supabaseSyncKey !== settings.supabaseSyncKey;
    const needsInitialFullPush =
      isSupabaseSyncConfigured(next) &&
      isOnline &&
      next.autoSyncOnline !== false &&
      (!next.lastSyncedAt || configChanged);

    await putAda('settings', next);
    await enqueueSyncItem('settings', 'primary', next);
    setSettings(next);

    if (needsInitialFullPush) {
      void handlePushAllToSupabase(next).catch((err) => {
        console.warn('Initial Supabase full push deferred:', err);
      });
    } else {
      void triggerBackgroundSync(next);
    }
  };

  const handlePullFromSupabase = async (settingsOverride?: AdaSettings) => {
    const activeSettings = settingsOverride ?? settings;
    const snapshot = await pullSnapshotFromSupabase(activeSettings);
    const mergedState = await applyCloudSnapshotToLocal(snapshot, activeSettings);
    setSettings(mergedState.settings);
    setMembers(mergedState.members);
    setPayments(mergedState.payments);
    setPenalties(mergedState.penalties);
    setExpenses(mergedState.expenses);
    setTrips(mergedState.trips);
    setMutualAid(mergedState.mutualAid);
    setIncidents(mergedState.incidents);
  };

  const handleToggleTheme = async () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    await handleSaveSettings({...settings, theme: nextTheme});
  };

  const handleBuildBackup = (): AdaFullBackup => ({
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    app: 'ADA-System',
    settings,
    members,
    payments,
    penalties,
    expenses,
    trips,
    mutualAid,
    incidents,
  });

  const handleRestoreBackup = async (backup: AdaFullBackup) => {
    const state = await importAdaBackup(backup);
    setSettings(state.settings);
    setMembers(state.members);
    setPayments(state.payments);
    setPenalties(state.penalties);
    setExpenses(state.expenses);
    setTrips(state.trips);
    setMutualAid(state.mutualAid);
    setIncidents(state.incidents);
  };

  const handleResetDemoData = async () => {
    const state = await resetAdaToDemo();
    setSettings(state.settings);
    setMembers(state.members);
    setPayments(state.payments);
    setPenalties(state.penalties);
    setExpenses(state.expenses);
    setTrips(state.trips);
    setMutualAid(state.mutualAid);
    setIncidents(state.incidents);
  };

  const navigate = (view: AdaView) => {
    if (view !== 'payments') {
      setPaymentsInitialFilter('All');
    }
    setActiveView(view);
    setMobileMenuOpen(false);
  };

  const openPendingPaymentsShortcut = () => {
    setPaymentsInitialFilter('Pending');
    setActiveView('payments');
    setMobileMenuOpen(false);
  };

  const handleCollectOverduePayment = (memberId: string, totalDue: number, daysLate: number) => {
    setPaymentsInitialFilter('All');
    setPaymentPrefill({
      memberId,
      amount: totalDue,
      categoryId: 'cat_in_monthly',
      note: `Monthly dues + ${daysLate}d late charge`,
    });
    setOpenCreatePaymentOnMount(true);
    setActiveView('payments');
  };

  const currentNavTitle = useMemo(() => {
    const item = NAV_CONFIG.find((n) => n.id === activeView);
    return item ? translate(settings.language, item.labelKey) : '';
  }, [activeView, settings.language]);

  const isDark = settings.theme === 'dark';
  const ecTodayLabel =
    settings.showEthiopianCalendar !== false
      ? formatEthiopianDate(todayIsoDate(), settings.language)
      : '';

  if (!isLoading && settings.requireLogin !== false && !isUnlocked) {
    return <LoginScreen settings={settings} onUnlock={() => setIsUnlocked(true)} />;
  }

  return (
    <div className="ada-canvas-bg flex min-h-screen text-slate-900 dark:text-slate-100">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar Navigation */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-300/80 bg-[#F3F6FB] transition-transform duration-150 dark:border-slate-800 dark:bg-[#0B1220] lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Ethiopian tri-color accent hairline */}
        <div className="grid h-1 shrink-0 grid-cols-3">
          <div className="bg-[#078930]" />
          <div className="bg-[#FCDD09]" />
          <div className="bg-[#DA121A]" />
        </div>

        {/* Brand Lockup with Association Emblem */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#0B2C5D] px-4 py-3.5 text-white dark:border-slate-800 dark:bg-[#0B172B]">
          <button
            type="button"
            onClick={() => navigate('overview')}
            className="flex items-center gap-3 text-left min-w-0"
          >
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-amber-300/80 bg-white shadow-xs">
              <img
                src={settings.logoDataUrl || ASSOCIATION_LOGO_PATH}
                alt={settings.associationName}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="font-display text-[11px] font-bold uppercase leading-tight tracking-wide text-white">
                {settings.associationName}
              </p>
              <p className="truncate text-[10px] font-medium text-sky-200/90">
                {translate(settings.language, 'heavyTransportDesk')}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
            className="rounded-md p-1 text-sky-200 hover:bg-white/10 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_CONFIG.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#0B2C5D] text-white shadow-xs dark:bg-[#034EA2] dark:text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100'
                }`}
              >
                <span className="inline-flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-amber-300' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                  <span>{translate(settings.language, item.labelKey)}</span>
                </span>
                {item.id === 'payments' && pendingPaymentsCount > 0 && (
                  <span
                    className={`font-mono text-[11px] font-bold tabular-nums ${
                      isActive ? 'text-amber-300' : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {pendingPaymentsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-300/70 bg-[#E8EEF7] p-4 text-xs dark:border-slate-800 dark:bg-[#080E1A]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0B2C5D] text-xs font-bold text-amber-300 dark:bg-[#034EA2]">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                {settings.currentUserName}
              </p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {translate(settings.language, 'offlineReady')}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header with current date, Day/Night mode toggle, notification shortcut, current-user avatar */}
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-300/80 bg-[#F6F9FD]/95 px-4 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-[#0F172A]/95">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
              <span className="font-display text-sm font-bold text-[#0B2C5D] dark:text-slate-100 truncate">
                {currentNavTitle}
              </span>
              <span className="hidden sm:inline" aria-hidden="true">
                ·
              </span>
              <span className="hidden sm:inline font-mono text-[11px]">{currentDateLabel}</span>
              {ecTodayLabel && (
                <span className="hidden md:inline font-semibold text-[11px] text-[#034EA2] dark:text-sky-400">
                  ({ecTodayLabel})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleToggleTheme}
              aria-label={
                isDark ? translate(settings.language, 'lightModeBtn') : translate(settings.language, 'darkModeBtn')
              }
              title={
                isDark ? translate(settings.language, 'lightModeBtn') : translate(settings.language, 'darkModeBtn')
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-amber-300 dark:hover:bg-slate-700"
            >
              {isDark ? (
                <Sun className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <Moon className="h-3.5 w-3.5 text-[#0B2C5D]" />
              )}
              <span className="hidden sm:inline">
                {isDark
                  ? translate(settings.language, 'dayModeShort')
                  : translate(settings.language, 'nightModeShort')}
              </span>
            </button>

            <button
              type="button"
              onClick={openPendingPaymentsShortcut}
              title="Open pending payments awaiting approval"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Bell className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span className="font-mono font-semibold tabular-nums">
                {pendingPaymentsCount}
              </span>
              <span className="hidden sm:inline">
                {translate(settings.language, 'pendingLabel')}
              </span>
            </button>

            <PWAInstallButton language={settings.language} />

            {settings.requireLogin !== false && (
              <button
                type="button"
                onClick={() => setIsUnlocked(false)}
                title={translate(settings.language, 'lockAppBtn')}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Lock className="h-3.5 w-3.5 text-[#034EA2] dark:text-sky-400" />
                <span className="hidden xl:inline">{translate(settings.language, 'lockAppBtn')}</span>
              </button>
            )}

            <div
              className="flex items-center gap-2 pl-1"
              title={`Current office user: ${settings.currentUserName}`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B2C5D] text-xs font-bold text-amber-300 dark:bg-[#034EA2]">
                {userInitials}
              </div>
              <span className="hidden md:inline text-xs font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                {settings.currentUserName}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-[1320px]">
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-8 w-64 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-24 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
                    />
                  ))}
                </div>
              </div>
            ) : (
              <>
                {activeView === 'overview' && (
                  <AdaOverviewView
                    settings={settings}
                    members={members}
                    payments={payments}
                    expenses={expenses}
                    onNavigate={navigate}
                    onOpenRecordPayment={() => {
                      setPaymentsInitialFilter('All');
                      setPaymentPrefill(null);
                      setOpenCreatePaymentOnMount(true);
                      setActiveView('payments');
                    }}
                  />
                )}

                {activeView === 'members' && (
                  <AdaMembersView
                    settings={settings}
                    members={members}
                    payments={payments}
                    penalties={penalties}
                    onAddMember={handleAddMember}
                    onUpdateMember={handleUpdateMember}
                    onBulkAddMembers={handleBulkAddMembers}
                    onArchiveMember={handleArchiveMember}
                    onUpdateMemberRole={handleUpdateMemberRole}
                    onResetPortalPin={handleResetPortalPin}
                  />
                )}

                {activeView === 'fleet' && (
                  <AdaFleetInsuranceView
                    settings={settings}
                    members={members}
                    payments={payments}
                    onUpdateMemberCompliance={handleUpdateMemberCompliance}
                  />
                )}

                {activeView === 'trips' && (
                  <AdaTripsView
                    settings={settings}
                    trips={trips}
                    members={members}
                    onSaveTrip={handleSaveTrip}
                    onUpdateTripStatus={handleUpdateTripStatus}
                  />
                )}

                {activeView === 'incidents' && (
                  <AdaIncidentsView
                    settings={settings}
                    incidents={incidents}
                    members={members}
                    onSaveIncident={handleSaveIncident}
                    onMarkSettled={handleMarkIncidentSettled}
                  />
                )}

                {activeView === 'mutual-aid' && (
                  <AdaMutualAidView
                    settings={settings}
                    payouts={mutualAid}
                    members={members}
                    onSavePayout={handleSaveMutualAid}
                    onMarkPaid={handleMarkMutualAidPaid}
                  />
                )}

                {activeView === 'deleted-members' && (
                  <AdaDeletedMembersView
                    settings={settings}
                    members={members}
                    onRestoreMember={handleRestoreMember}
                  />
                )}

                {activeView === 'payments' && (
                  <AdaPaymentsView
                    settings={settings}
                    payments={payments}
                    members={members}
                    initialFilter={paymentsInitialFilter}
                    openCreateOnMount={openCreatePaymentOnMount}
                    prefill={paymentPrefill}
                    onConsumeCreateFlag={() => {
                      setOpenCreatePaymentOnMount(false);
                      setPaymentPrefill(null);
                    }}
                    onSavePayment={handleSavePayment}
                    onUpdateStatus={handleUpdatePaymentStatus}
                  />
                )}

                {activeView === 'overdue' && (
                  <AdaOverdueView
                    settings={settings}
                    members={members}
                    payments={payments}
                    onCollectOverdue={handleCollectOverduePayment}
                  />
                )}

                {activeView === 'penalties' && (
                  <AdaPenaltiesView
                    settings={settings}
                    penalties={penalties}
                    members={members}
                    onSavePenalty={handleSavePenalty}
                    onMarkPaid={handleMarkPenaltyPaid}
                  />
                )}

                {activeView === 'ledger' && (
                  <AdaLedgerView
                    settings={settings}
                    payments={payments}
                    expenses={expenses}
                    members={members}
                    onSaveExpense={handleSaveExpense}
                  />
                )}

                {activeView === 'reports' && (
                  <AdaReportsView
                    settings={settings}
                    members={members}
                    payments={payments}
                    penalties={penalties}
                    expenses={expenses}
                  />
                )}

                {activeView === 'how-to-use' && <AdaHowToUseView settings={settings} />}

                {activeView === 'settings' && (
                  <AdaSettingsView
                    settings={settings}
                    members={members}
                    onSaveSettings={handleSaveSettings}
                    onBuildBackup={handleBuildBackup}
                    onRestoreBackup={handleRestoreBackup}
                    onResetDemoData={handleResetDemoData}
                    onPushAllToSupabase={handlePushAllToSupabase}
                    onPullFromSupabase={handlePullFromSupabase}
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {!isOnline && (
        <div className="no-print fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 shadow-sm dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span>{translate(settings.language, 'offlineBanner')}</span>
        </div>
      )}
    </div>
  );
}
