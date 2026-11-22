import React, {useMemo} from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  Landmark,
  Plus,
  Receipt,
  ShieldAlert,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import {StatusText} from '../../components/StatusText';
import {
  translate,
  translateMethod,
  translateStatus,
} from '../../i18n/translations';
import type {
  AdaExpense,
  AdaMember,
  AdaPayment,
  AdaSettings,
  AdaView,
} from '../../types/ada';
import {
  buildMonthlySeries,
  calculateOverdueAccounts,
  getExpiringBolo,
  getExpiringDriverLicences,
  getExpiringHighwayClearance,
  getExpiringInsurance,
  getExpiringMedical,
} from '../../utils/adaCalculations';
import {formatEthiopianDate} from '../../utils/ethiopianCalendar';
import {
  currentMonthIso,
  downloadCsv,
  formatCurrency,
  formatDate,
  todayIsoDate,
} from '../../utils/formatters';
import {ASSOCIATION_LOGO_PATH} from '../../utils/idCardExport';

interface AdaOverviewViewProps {
  settings: AdaSettings;
  members: AdaMember[];
  payments: AdaPayment[];
  expenses: AdaExpense[];
  onNavigate: (view: AdaView) => void;
  onOpenRecordPayment: () => void;
}

export const AdaOverviewView: React.FC<AdaOverviewViewProps> = ({
  settings,
  members,
  payments,
  expenses,
  onNavigate,
  onOpenRecordPayment,
}) => {
  const lang = settings.language;
  const now = new Date();
  const thisMonth = currentMonthIso();
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const activeMembers = useMemo(
    () => members.filter((m) => !m.deletedAt && m.status === 'Active'),
    [members]
  );

  const platedTrucksCount = useMemo(
    () => activeMembers.filter((m) => Boolean(m.vehiclePlate?.trim())).length,
    [activeMembers]
  );

  const joinedThisMonth = useMemo(
    () => activeMembers.filter((m) => m.joinDate.startsWith(thisMonth)).length,
    [activeMembers, thisMonth]
  );

  const collectedThisMonth = useMemo(
    () =>
      payments
        .filter((p) => p.status === 'Approved' && p.date.startsWith(thisMonth))
        .reduce((s, p) => s + p.amount, 0),
    [payments, thisMonth]
  );

  const collectedLastMonth = useMemo(
    () =>
      payments
        .filter((p) => p.status === 'Approved' && p.date.startsWith(lastMonth))
        .reduce((s, p) => s + p.amount, 0),
    [payments, lastMonth]
  );

  const monthlyDiff = collectedThisMonth - collectedLastMonth;

  const overdue = useMemo(
    () => calculateOverdueAccounts(members, payments, settings),
    [members, payments, settings]
  );

  const expiringLicences = useMemo(
    () => getExpiringDriverLicences(members, 30),
    [members]
  );

  const expiringInsurance = useMemo(
    () => getExpiringInsurance(members, 30),
    [members]
  );

  const expiringBolo = useMemo(
    () => getExpiringBolo(members, 30),
    [members]
  );

  const expiringMedical = useMemo(
    () => getExpiringMedical(members, 30),
    [members]
  );

  const expiringHighway = useMemo(
    () => getExpiringHighwayClearance(members, 30),
    [members]
  );

  const combinedExpiringCount = useMemo(() => {
    const ids = new Set<string>([
      ...expiringLicences.map((i) => i.member.id),
      ...expiringInsurance.map((i) => i.member.id),
      ...expiringBolo.map((i) => i.member.id),
      ...expiringMedical.map((i) => i.member.id),
      ...expiringHighway.map((i) => i.member.id),
    ]);
    return ids.size;
  }, [expiringLicences, expiringInsurance, expiringBolo, expiringMedical, expiringHighway]);

  const validLicencesCount = useMemo(() => {
    const expiringSet = new Set(expiringLicences.map((item) => item.member.id));
    return activeMembers.filter((m) => Boolean(m.licenseNumber?.trim()) && !expiringSet.has(m.id)).length;
  }, [activeMembers, expiringLicences]);

  const expensesThisMonth = useMemo(
    () =>
      expenses
        .filter((e) => e.date.startsWith(thisMonth))
        .reduce((s, e) => s + e.amount, 0),
    [expenses, thisMonth]
  );

  const pendingPayments = useMemo(
    () => payments.filter((p) => p.status === 'Pending'),
    [payments]
  );

  const recentPayments = useMemo(
    () => [...payments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
    [payments]
  );

  const monthlySeries = useMemo(
    () => buildMonthlySeries(payments, expenses, 6),
    [payments, expenses]
  );

  const maxChartVal = Math.max(
    settings.monthlyDuesTarget,
    ...monthlySeries.map((pt) => pt.income),
    1000
  );

  const duesCollectedThisMonth = useMemo(
    () =>
      payments
        .filter(
          (p) =>
            p.status === 'Approved' &&
            p.date.startsWith(thisMonth) &&
            (p.categoryId === 'cat_in_monthly' ||
              p.categoryName.toLowerCase() === 'monthly dues')
        )
        .reduce((s, p) => s + p.amount, 0),
    [payments, thisMonth]
  );

  const targetPct =
    settings.monthlyDuesTarget > 0
      ? Math.min(100, Math.round((duesCollectedThisMonth / settings.monthlyDuesTarget) * 100))
      : 0;

  const channelMix = useMemo(() => {
    const approvedThisMonth = payments.filter(
      (p) => p.status === 'Approved' && p.date.startsWith(thisMonth)
    );
    let cash = 0;
    let mobile = 0;
    let bank = 0;
    for (const p of approvedThisMonth) {
      if (p.method === 'Cash') {
        cash += p.amount;
      } else if (p.method === 'Telebirr' || p.method === 'CBE Birr' || p.method === 'E-Birr') {
        mobile += p.amount;
      } else {
        bank += p.amount;
      }
    }
    const total = Math.max(1, cash + mobile + bank);
    return {
      cash,
      mobile,
      bank,
      cashPct: Math.round((cash / total) * 100),
      mobilePct: Math.round((mobile / total) * 100),
      bankPct: Math.round((bank / total) * 100),
    };
  }, [payments, thisMonth]);

  const recentActivity = useMemo(() => {
    const incRows = payments
      .filter((p) => p.status === 'Approved')
      .map((p) => ({
        id: `inc_${p.id}`,
        type: 'Income' as const,
        date: p.date,
        title: `${p.categoryName} · ${memberMap.get(p.memberId)?.fullName ?? 'Member'}`,
        method: p.method,
        amount: p.amount,
      }));
    const expRows = expenses.map((e) => ({
      id: `exp_${e.id}`,
      type: 'Expense' as const,
      date: e.date,
      title: `${e.categoryName} · ${e.description}`,
      method: e.method,
      amount: e.amount,
    }));
    return [...incRows, ...expRows]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6);
  }, [payments, expenses, memberMap]);

  const handleExportSummaryReport = () => {
    downloadCsv(
      `ada-overview-report-${todayIsoDate()}.csv`,
      ['Month', 'Total Income (ETB)', 'Monthly Dues (ETB)', 'Expenses (ETB)', 'Net (ETB)'],
      monthlySeries.map((pt) => [
        pt.monthKey,
        pt.income,
        pt.monthlyDues,
        pt.expenses,
        pt.income - pt.expenses,
      ])
    );
  };

  return (
    <div className="space-y-6">
      {/* Drivers Association Command Strip */}
      <section className="ada-surface overflow-hidden rounded-xl border">
        <div className="grid h-1 grid-cols-3">
          <div className="bg-[#078930]" />
          <div className="bg-[#FCDD09]" />
          <div className="bg-[#DA121A]" />
        </div>

        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-[#034EA2] bg-white shadow-xs dark:border-sky-400">
              <img
                src={settings.logoDataUrl || ASSOCIATION_LOGO_PATH}
                alt={settings.associationName}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-[#034EA2] dark:text-sky-400">
                {(settings.associationName || 'ADAMA HEAVY TRUCK DRIVERS EDIR').toUpperCase()}
              </p>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-2.5">
                <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {translate(lang, 'overview')}
                </h1>
                {settings.showEthiopianCalendar !== false && (
                  <span className="font-mono text-xs font-semibold text-[#034EA2] dark:text-sky-400">
                    {formatEthiopianDate(todayIsoDate(), lang)}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Truck className="h-3.5 w-3.5 text-[#034EA2] dark:text-sky-400" />
                  <span className="tabular-nums">
                    {translate(lang, 'platedTrucksLabel', {count: platedTrucksCount})}
                  </span>
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {translate(lang, 'validLicencesLabel', {count: validLicencesCount})}
                </span>
                <span aria-hidden="true">·</span>
                <span
                  className={`tabular-nums font-medium ${
                    combinedExpiringCount > 0
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {translate(lang, 'expiringSoonLabel', {count: combinedExpiringCount})}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenRecordPayment}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2C5D] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#034EA2] whitespace-nowrap shrink-0 dark:bg-[#034EA2] dark:hover:bg-sky-600"
            >
              <Plus className="h-3.5 w-3.5 text-amber-300" />
              {translate(lang, 'recordPayment')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('overdue')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {translate(lang, 'reviewOverdueDues')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('payments')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {translate(lang, 'allPayments')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('ledger')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {translate(lang, 'viewLedger')}
            </button>
            <button
              type="button"
              onClick={handleExportSummaryReport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Download className="h-3.5 w-3.5" />
              {translate(lang, 'exportReport')}
            </button>
          </div>
        </div>
      </section>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="ada-surface rounded-xl border p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{translate(lang, 'activeMembers')}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#034EA2] dark:bg-sky-950/60 dark:text-sky-400">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {activeMembers.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {translate(lang, 'joinedThisMonth', {count: joinedThisMonth})}
          </p>
        </div>

        <div className="ada-surface rounded-xl border p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{translate(lang, 'collectedThisMonth')}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatCurrency(collectedThisMonth, settings.currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {monthlyDiff >= 0 ? '+' : ''}
            {formatCurrency(monthlyDiff, settings.currency)} {translate(lang, 'vsLastMonth')}
          </p>
        </div>

        <div className="ada-surface rounded-xl border p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{translate(lang, 'outstandingDues')}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {formatCurrency(overdue.totalOutstanding, settings.currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {translate(lang, 'membersNeedingFollowUp', {count: overdue.rows.length})}
          </p>
        </div>

        <div className="ada-surface rounded-xl border p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{translate(lang, 'expensesThisMonth')}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400">
              <Receipt className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatCurrency(expensesThisMonth, settings.currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {translate(lang, 'pendingApprovalsCount', {count: pendingPayments.length})}
          </p>
        </div>
      </div>

      {/* Overdue Notice + Expiring Licences Banner */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
              <div>
                <h2 className="text-xs font-semibold text-amber-950 dark:text-amber-200">
                  {translate(lang, 'overdueNotice')}
                </h2>
                <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-300">
                  {translate(lang, 'overdueBannerBody', {
                    count: overdue.rows.length,
                    amount: formatCurrency(settings.monthlyDueAmount, settings.currency),
                    day: settings.monthlyDueDay,
                    charge: formatCurrency(settings.dailyLateCharge, settings.currency),
                    nextDay: settings.monthlyDueDay + 1,
                  })}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('overdue')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-950 hover:underline whitespace-nowrap shrink-0 dark:text-amber-200"
            >
              {translate(lang, 'view')}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="ada-surface rounded-xl border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <ShieldAlert
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  combinedExpiringCount > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              />
              <div>
                <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {translate(lang, 'expiringComplianceTitle')}
                </h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {combinedExpiringCount === 0
                    ? translate(lang, 'noExpiringCompliance')
                    : [
                        ...expiringInsurance.slice(0, 2).map(
                          (item) =>
                            `${item.member.fullName} (Ins: ${
                              item.daysLeft < 0
                                ? translate(lang, 'expiredLabel')
                                : translate(lang, 'daysLeftLabel', {days: item.daysLeft})
                            })`
                        ),
                        ...expiringLicences.slice(0, 2).map(
                          (item) =>
                            `${item.member.fullName} (Lic: ${
                              item.daysLeft < 0
                                ? translate(lang, 'expiredLabel')
                                : translate(lang, 'daysLeftLabel', {days: item.daysLeft})
                            })`
                        ),
                        ...expiringMedical.slice(0, 1).map(
                          (item) =>
                            `${item.member.fullName} (Med: ${
                              item.daysLeft < 0
                                ? translate(lang, 'expiredLabel')
                                : translate(lang, 'daysLeftLabel', {days: item.daysLeft})
                            })`
                        ),
                        ...expiringHighway.slice(0, 1).map(
                          (item) =>
                            `${item.member.fullName} (Hwy: ${
                              item.daysLeft < 0
                                ? translate(lang, 'expiredLabel')
                                : translate(lang, 'daysLeftLabel', {days: item.daysLeft})
                            })`
                        ),
                      ].join(' · ')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('fleet')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#034EA2] hover:underline whitespace-nowrap shrink-0 dark:text-sky-400"
            >
              {translate(lang, 'fleetInsurance')}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main 2-column grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left 2 columns: Recent Member Payments + Collection Channels Breakdown */}
        <div className="xl:col-span-2 space-y-6">
          <section className="ada-surface overflow-hidden rounded-xl border">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {translate(lang, 'recentMemberPayments')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {translate(lang, 'awaitingReviewSummary', {
                    count: pendingPayments.length,
                    amount: formatCurrency(
                      pendingPayments.reduce((s, p) => s + p.amount, 0),
                      settings.currency
                    ),
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('payments')}
                className="text-xs font-semibold text-[#034EA2] hover:underline dark:text-sky-400"
              >
                {translate(lang, 'openPayments')}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#EBF2FA] text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                    <th className="px-5 py-2.5 font-medium">{translate(lang, 'member')}</th>
                    <th className="px-4 py-2.5 font-medium">{translate(lang, 'category')}</th>
                    <th className="px-4 py-2.5 font-medium">{translate(lang, 'method')}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{translate(lang, 'amount')}</th>
                    <th className="px-5 py-2.5 font-medium">{translate(lang, 'status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {recentPayments.map((p) => {
                    const m = memberMap.get(p.memberId);
                    return (
                      <tr
                        key={p.id}
                        className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-5 py-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {m?.fullName ?? translate(lang, 'member')}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {m?.memberId ?? '—'}
                            {m?.vehiclePlate ? ` · ${m.vehiclePlate}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {p.categoryName}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {translateMethod(lang, p.method)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                          {formatCurrency(p.amount, settings.currency)}
                        </td>
                        <td className="px-5 py-3">
                          <StatusText
                            label={translateStatus(lang, p.status)}
                            tone={
                              p.status === 'Approved'
                                ? 'success'
                                : p.status === 'Rejected'
                                  ? 'danger'
                                  : 'warning'
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Payment Channel Reconciliation (Cash Drawer vs Mobile Money vs Banks) */}
          <section className="ada-surface rounded-xl border p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-[#034EA2] dark:text-sky-400" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {translate(lang, 'channelMixTitle')}
                </h2>
              </div>
              <span className="font-mono text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                {formatCurrency(collectedThisMonth, settings.currency)}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {translate(lang, 'cashChannelLabel')}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                    {channelMix.cashPct}%
                  </span>
                </div>
                <p className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatCurrency(channelMix.cash, settings.currency)}
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500"
                    style={{width: `${channelMix.cashPct}%`}}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                    {translate(lang, 'mobileMoneyChannelLabel')}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                    {channelMix.mobilePct}%
                  </span>
                </div>
                <p className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatCurrency(channelMix.mobile, settings.currency)}
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-[#034EA2] dark:bg-sky-400"
                    style={{width: `${channelMix.mobilePct}%`}}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                    {translate(lang, 'bankTransferChannelLabel')}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                    {channelMix.bankPct}%
                  </span>
                </div>
                <p className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatCurrency(channelMix.bank, settings.currency)}
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-amber-500 dark:bg-amber-400"
                    style={{width: `${channelMix.bankPct}%`}}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Monthly Collection Trend + Target + Recent Office Activity */}
        <div className="space-y-6">
          <section className="ada-surface rounded-xl border p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {translate(lang, 'monthlyCollectionTrend')}
              </h2>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {translate(lang, 'months6')}
              </span>
            </div>

            {/* Target Bar */}
            <div className="mt-4">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-slate-600 dark:text-slate-400">
                  {translate(lang, 'monthlyDuesTargetLabel')}
                </span>
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatCurrency(duesCollectedThisMonth, settings.currency)} /{' '}
                  {formatCurrency(settings.monthlyDuesTarget, settings.currency)} ({targetPct}%)
                </span>
              </div>
              <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-[#034EA2] dark:bg-amber-400"
                  style={{width: `${targetPct}%`}}
                />
              </div>
            </div>

            {/* Bar Chart */}
            <div className="mt-5 flex h-36 items-end gap-2.5 border-b border-slate-200 pb-2 dark:border-slate-800">
              {monthlySeries.map((pt) => {
                const hPct = Math.max(4, Math.round((pt.income / maxChartVal) * 100));
                return (
                  <div key={pt.monthKey} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="font-mono text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                      {pt.income > 0 ? Math.round(pt.income) : 0}
                    </span>
                    <div className="flex h-24 w-full items-end justify-center">
                      <div
                        title={`${pt.label}: ${formatCurrency(pt.income, settings.currency)}`}
                        className="w-full max-w-[28px] rounded-t bg-[#0B2C5D] transition-opacity hover:opacity-85 dark:bg-sky-400"
                        style={{height: `${hPct}%`}}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex gap-2.5 text-center text-[10px] font-mono text-slate-500 dark:text-slate-400">
              {monthlySeries.map((pt) => (
                <span key={pt.monthKey} className="flex-1">
                  {pt.label}
                </span>
              ))}
            </div>
          </section>

          <section className="ada-surface rounded-xl border p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {translate(lang, 'recentOfficeActivity')}
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('ledger')}
                className="text-xs font-semibold text-[#034EA2] hover:underline dark:text-sky-400"
              >
                {translate(lang, 'ledgerShort')}
              </button>
            </div>

            <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
              {recentActivity.map((act) => (
                <li key={act.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                      {act.title}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {formatDate(act.date)} · {translateMethod(lang, act.method)}
                    </p>
                  </div>
                  <span
                    className={`font-mono font-semibold tabular-nums whitespace-nowrap ${
                      act.type === 'Income'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-700 dark:text-red-400'
                    }`}
                  >
                    {act.type === 'Income' ? '+' : '-'}
                    {formatCurrency(act.amount, settings.currency)}
                  </span>
                </li>
              ))}
              {recentActivity.length === 0 && (
                <li className="py-4 text-xs text-slate-500">
                  <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />
                  {translate(lang, 'noRecentActivity')}
                </li>
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};
