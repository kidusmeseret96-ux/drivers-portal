import React, {useEffect, useMemo, useState} from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Clock,
  CreditCard,
  HandHeart,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Receipt,
  RefreshCw,
  Route,
  Settings,
  ShieldCheck,
  Sun,
  UserMinus,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import {translate, translateRole, type TranslationKey} from '../i18n/translations';
import {
  portalAdminMutate,
  portalAdminResetMemberPassword,
  type PortalWorkspace,
} from '../lib/supabasePortal';
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
} from '../types/ada';
import {formatEthiopianDate} from '../utils/ethiopianCalendar';
import {todayIsoDate} from '../utils/formatters';
import {ASSOCIATION_LOGO_PATH} from '../utils/idCardExport';
import {AdaDeletedMembersView} from '../views/ada/AdaDeletedMembersView';
import {AdaFleetInsuranceView} from '../views/ada/AdaFleetInsuranceView';
import {AdaHowToUseView} from '../views/ada/AdaHowToUseView';
import {AdaIncidentsView} from '../views/ada/AdaIncidentsView';
import {AdaLedgerView} from '../views/ada/AdaLedgerView';
import {AdaMembersView} from '../views/ada/AdaMembersView';
import {AdaMutualAidView} from '../views/ada/AdaMutualAidView';
import {AdaOverdueView} from '../views/ada/AdaOverdueView';
import {AdaOverviewView} from '../views/ada/AdaOverviewView';
import {AdaPaymentsView} from '../views/ada/AdaPaymentsView';
import {AdaPenaltiesView} from '../views/ada/AdaPenaltiesView';
import {AdaReportsView} from '../views/ada/AdaReportsView';
import {AdaSettingsView} from '../views/ada/AdaSettingsView';
import {AdaTripsView} from '../views/ada/AdaTripsView';

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

interface OfficePortalShellProps {
  token: string;
  initialWorkspace: PortalWorkspace;
  onRefresh: () => Promise<void>;
  onOpenChangePassword: () => void;
  onLogout: () => void;
}

export const OfficePortalShell: React.FC<OfficePortalShellProps> = ({
  token,
  initialWorkspace,
  onRefresh,
  onOpenChangePassword,
  onLogout,
}) => {
  const [activeView, setActiveView] = useState<AdaView>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [settings, setSettings] = useState<AdaSettings>(initialWorkspace.settings);
  const [members, setMembers] = useState<AdaMember[]>(initialWorkspace.members);
  const [payments, setPayments] = useState<AdaPayment[]>(initialWorkspace.payments);
  const [penalties, setPenalties] = useState<AdaPenalty[]>(initialWorkspace.penalties);
  const [expenses, setExpenses] = useState<AdaExpense[]>(initialWorkspace.expenses);
  const [trips, setTrips] = useState<AdaTrip[]>(initialWorkspace.trips);
  const [mutualAid, setMutualAid] = useState<AdaMutualAidPayout[]>(initialWorkspace.mutualAid);
  const [incidents, setIncidents] = useState<AdaIncidentAdvance[]>(initialWorkspace.incidents);

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
    setSettings(initialWorkspace.settings);
    setMembers(initialWorkspace.members);
    setPayments(initialWorkspace.payments);
    setPenalties(initialWorkspace.penalties);
    setExpenses(initialWorkspace.expenses);
    setTrips(initialWorkspace.trips);
    setMutualAid(initialWorkspace.mutualAid);
    setIncidents(initialWorkspace.incidents);
  }, [initialWorkspace]);

  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  const pendingPaymentsCount = useMemo(
    () => payments.filter((p) => p.status === 'Pending').length,
    [payments]
  );

  const currentMember = initialWorkspace.currentMember;
  const userInitials = useMemo(
    () =>
      (currentMember?.fullName || 'AD')
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
    [currentMember?.fullName]
  );

  const handleAddMember = async (member: AdaMember) => {
    await portalAdminMutate(token, 'members', member);
    setMembers((prev) => [...prev, member]);
  };

  const handleBulkAddMembers = async (newMembers: AdaMember[]) => {
    for (const m of newMembers) {
      await portalAdminMutate(token, 'members', m);
    }
    setMembers((prev) => [...prev, ...newMembers]);
  };

  const handleArchiveMember = async (id: string) => {
    const existing = members.find((m) => m.id === id);
    if (!existing) return;
    const archived: AdaMember = {
      ...existing,
      statusBeforeDelete: existing.status,
      deletedAt: todayIsoDate(),
    };
    await portalAdminMutate(token, 'members', archived);
    setMembers((prev) => prev.map((m) => (m.id === id ? archived : m)));
  };

  const handleRestoreMember = async (id: string) => {
    const existing = members.find((m) => m.id === id);
    if (!existing) return;
    const restored: AdaMember = {
      ...existing,
      status: existing.statusBeforeDelete ?? 'Active',
      deletedAt: undefined,
      statusBeforeDelete: undefined,
    };
    await portalAdminMutate(token, 'members', restored);
    setMembers((prev) => prev.map((m) => (m.id === id ? restored : m)));
  };

  const handleUpdateMemberRole = async (memberId: string, nextRole: string) => {
    const existing = members.find((m) => m.id === memberId);
    if (!existing) return;
    const updated: AdaMember = {...existing, role: nextRole};
    await portalAdminMutate(token, 'members', updated);
    setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
  };

  const handleResetPortalPin = async (memberId: string) => {
    await portalAdminResetMemberPassword(token, memberId);
  };

  const handleSavePayment = async (payment: AdaPayment) => {
    await portalAdminMutate(token, 'payments', payment);
    setPayments((prev) => [payment, ...prev]);
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
    await portalAdminMutate(token, 'payments', updated);
    setPayments((prev) => prev.map((p) => (p.id === paymentId ? updated : p)));
  };

  const handleSavePenalty = async (penalty: AdaPenalty) => {
    await portalAdminMutate(token, 'penalties', penalty);
    setPenalties((prev) => [penalty, ...prev]);
  };

  const handleMarkPenaltyPaid = async (penaltyId: string) => {
    const existing = penalties.find((p) => p.id === penaltyId);
    if (!existing) return;
    const updated: AdaPenalty = {...existing, status: 'Paid', paidDate: todayIsoDate()};
    await portalAdminMutate(token, 'penalties', updated);
    setPenalties((prev) => prev.map((p) => (p.id === penaltyId ? updated : p)));
  };

  const handleSaveExpense = async (expense: AdaExpense) => {
    await portalAdminMutate(token, 'expenses', expense);
    setExpenses((prev) => [expense, ...prev]);
  };

  const handleUpdateMemberCompliance = async (
    memberId: string,
    patch: Partial<AdaMember>
  ) => {
    const existing = members.find((m) => m.id === memberId);
    if (!existing) return;
    const updated: AdaMember = {...existing, ...patch};
    await portalAdminMutate(token, 'members', updated);
    setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
  };

  const handleSaveTrip = async (trip: AdaTrip) => {
    await portalAdminMutate(token, 'trips', trip);
    setTrips((prev) => [trip, ...prev]);
  };

  const handleUpdateTripStatus = async (tripId: string, status: TripStatus) => {
    const existing = trips.find((t) => t.id === tripId);
    if (!existing) return;
    const updated: AdaTrip = {
      ...existing,
      status,
      completedDate: status === 'Completed' ? todayIsoDate() : existing.completedDate,
    };
    await portalAdminMutate(token, 'trips', updated);
    setTrips((prev) => prev.map((t) => (t.id === tripId ? updated : t)));
  };

  const handleSaveMutualAid = async (payout: AdaMutualAidPayout) => {
    await portalAdminMutate(token, 'mutualAid', payout);
    setMutualAid((prev) => [payout, ...prev]);
  };

  const handleMarkMutualAidPaid = async (payoutId: string) => {
    const existing = mutualAid.find((p) => p.id === payoutId);
    if (!existing) return;
    const updated: AdaMutualAidPayout = {...existing, status: 'Paid', paidDate: todayIsoDate()};
    await portalAdminMutate(token, 'mutualAid', updated);
    setMutualAid((prev) => prev.map((p) => (p.id === payoutId ? updated : p)));
  };

  const handleSaveIncident = async (incident: AdaIncidentAdvance) => {
    await portalAdminMutate(token, 'incidents', incident);
    setIncidents((prev) => [incident, ...prev]);
  };

  const handleMarkIncidentSettled = async (incidentId: string) => {
    const existing = incidents.find((i) => i.id === incidentId);
    if (!existing) return;
    const updated: AdaIncidentAdvance = {
      ...existing,
      status: 'Settled',
      settledDate: todayIsoDate(),
    };
    await portalAdminMutate(token, 'incidents', updated);
    setIncidents((prev) => prev.map((i) => (i.id === incidentId ? updated : i)));
  };

  const handleSaveSettings = async (next: AdaSettings) => {
    await portalAdminMutate(token, 'settings', next);
    setSettings(next);
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

  const handleRestoreBackup = async () => {
    throw new Error('Restore full backup from the offline desktop office application.');
  };

  const handleResetDemoData = async () => {
    throw new Error('Demo reset is only available from the offline desktop application.');
  };

  const navigate = (view: AdaView) => {
    if (view !== 'payments') setPaymentsInitialFilter('All');
    setActiveView(view);
    setMobileMenuOpen(false);
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

  return (
    <div className="ada-canvas-bg flex min-h-screen text-slate-900 dark:text-slate-100">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-300/80 bg-[#F3F6FB] transition-transform duration-150 dark:border-slate-800 dark:bg-[#0B1220] lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="grid h-1 shrink-0 grid-cols-3">
          <div className="bg-[#078930]" />
          <div className="bg-[#FCDD09]" />
          <div className="bg-[#DA121A]" />
        </div>

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
                Cloud Office Portal
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
                {currentMember.fullName}
              </p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {currentMember.memberId} · {translateRole(settings.language, currentMember.role)}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
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
              {ecTodayLabel && (
                <span className="hidden md:inline font-semibold text-[11px] text-[#034EA2] dark:text-sky-400">
                  ({ecTodayLabel})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleSaveSettings({...settings, theme: isDark ? 'light' : 'dark'})}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-amber-300"
            >
              {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>

            <button
              type="button"
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true);
                try {
                  await onRefresh();
                } finally {
                  setRefreshing(false);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPaymentsInitialFilter('Pending');
                setActiveView('payments');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Bell className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span className="font-mono font-semibold tabular-nums">{pendingPaymentsCount}</span>
            </button>

            <button
              type="button"
              onClick={onOpenChangePassword}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <KeyRound className="h-3.5 w-3.5 text-[#034EA2] dark:text-sky-400" />
              <span className="hidden xl:inline">Password</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-[1320px] space-y-4">
            {initialWorkspace.mustChangePassword && (
              <div className="no-print flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  You are signed in with the default PIN <strong className="font-mono">0000</strong>. Change your personal password to protect your office access.
                </span>
                <button
                  type="button"
                  onClick={onOpenChangePassword}
                  className="shrink-0 rounded-lg bg-[#0B2C5D] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Change Password
                </button>
              </div>
            )}

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
                onCollectOverdue={(memberId, totalDue, daysLate) => {
                  setPaymentsInitialFilter('All');
                  setPaymentPrefill({
                    memberId,
                    amount: totalDue,
                    categoryId: 'cat_in_monthly',
                    note: `Monthly dues + ${daysLate}d late charge`,
                  });
                  setOpenCreatePaymentOnMount(true);
                  setActiveView('payments');
                }}
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
                onSaveSettings={handleSaveSettings}
                onBuildBackup={handleBuildBackup}
                onRestoreBackup={handleRestoreBackup}
                onResetDemoData={handleResetDemoData}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
