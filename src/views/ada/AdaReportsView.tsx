import React, {useMemo, useState} from 'react';
import {Download, FileText} from 'lucide-react';
import {NoticeSheetModal} from '../../components/NoticeSheetModal';
import {translate} from '../../i18n/translations';
import type {
  AdaExpense,
  AdaMember,
  AdaPayment,
  AdaPenalty,
  AdaSettings,
} from '../../types/ada';
import {buildMonthlySeries, calculateOverdueAccounts} from '../../utils/adaCalculations';
import {
  currentMonthIso,
  downloadCsv,
  downloadJson,
  formatCurrency,
  todayIsoDate,
} from '../../utils/formatters';

interface AdaReportsViewProps {
  settings: AdaSettings;
  members: AdaMember[];
  payments: AdaPayment[];
  penalties: AdaPenalty[];
  expenses: AdaExpense[];
}

export const AdaReportsView: React.FC<AdaReportsViewProps> = ({
  settings,
  members,
  payments,
  penalties,
  expenses,
}) => {
  const lang = settings.language;
  const [showNoticeSheet, setShowNoticeSheet] = useState(false);
  const thisMonth = currentMonthIso();
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const activeMembersCount = useMemo(
    () => members.filter((m) => !m.deletedAt && m.status === 'Active').length,
    [members]
  );

  const overdue = useMemo(
    () => calculateOverdueAccounts(members, payments, settings),
    [members, payments, settings]
  );

  const monthlyDuesReceived = useMemo(
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

  const otherContributions = useMemo(
    () =>
      payments
        .filter(
          (p) =>
            p.status === 'Approved' &&
            p.date.startsWith(thisMonth) &&
            p.categoryId !== 'cat_in_monthly' &&
            p.categoryName.toLowerCase() !== 'monthly dues'
        )
        .reduce((s, p) => s + p.amount, 0),
    [payments, thisMonth]
  );

  const officeExpenses = useMemo(
    () =>
      expenses
        .filter((e) => e.date.startsWith(thisMonth))
        .reduce((s, e) => s + e.amount, 0),
    [expenses, thisMonth]
  );

  const openPenaltiesAmount = useMemo(
    () => penalties.filter((p) => p.status === 'Unpaid').reduce((s, p) => s + p.amount, 0),
    [penalties]
  );

  const series = useMemo(
    () => buildMonthlySeries(payments, expenses, 6),
    [payments, expenses]
  );
  const maxVal = Math.max(...series.map((s) => Math.max(s.income, s.expenses)), 1000);

  const channelMix = useMemo(() => {
    const approved = payments.filter(
      (p) => p.status === 'Approved' && p.date.startsWith(thisMonth)
    );
    let cash = 0;
    let mobile = 0;
    let bank = 0;
    for (const p of approved) {
      if (p.method === 'Cash') cash += p.amount;
      else if (p.method === 'Telebirr' || p.method === 'CBE Birr' || p.method === 'E-Birr') mobile += p.amount;
      else bank += p.amount;
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

  const handleDownloadSummary = () => {
    downloadJson(`ada-monthly-summary-${thisMonth}.json`, {
      generatedAt: new Date().toISOString(),
      associationName: settings.associationName,
      period: thisMonth,
      currency: settings.currency,
      metrics: {
        activeMembers: activeMembersCount,
        monthlyDuesReceived,
        outstandingDues: overdue.totalOutstanding,
        otherContributions,
        officeExpenses,
        openPenaltiesAmount,
      },
      monthlySeries: series,
    });
  };

  const handleExportMonthlyCollectionsCsv = () => {
    downloadCsv(
      `ada-monthly-collections-${todayIsoDate()}.csv`,
      ['Month', 'Total Approved Income (ETB)', 'Monthly Dues (ETB)', 'Expenses (ETB)', 'Net (ETB)'],
      series.map((s) => [s.monthKey, s.income, s.monthlyDues, s.expenses, s.income - s.expenses])
    );
  };

  const handleExportLedgerCsv = () => {
    const inc = payments.map((p) => [
      'Income',
      p.date,
      p.reference,
      memberMap.get(p.memberId)?.fullName ?? 'Member',
      p.categoryName,
      p.method,
      p.status,
      p.amount,
    ]);
    const exp = expenses.map((e) => [
      'Expense',
      e.date,
      e.id,
      e.description,
      e.categoryName,
      e.method,
      'Recorded',
      -e.amount,
    ]);
    downloadCsv(
      `ada-full-ledger-${todayIsoDate()}.csv`,
      ['Type', 'Date', 'Reference', 'Member / Description', 'Category', 'Method', 'Status', 'Amount (ETB)'],
      [...inc, ...exp]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {translate(lang, 'reports')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'reportsSubtitle', {month: thisMonth})}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowNoticeSheet(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <FileText className="h-3.5 w-3.5 text-[#034EA2] dark:text-sky-400" />
            {translate(lang, 'downloadNoticeSheetBtn')}
          </button>
          <button
            type="button"
            onClick={handleDownloadSummary}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <FileText className="h-3.5 w-3.5" />
            {translate(lang, 'downloadSummaryBtn')}
          </button>
          <button
            type="button"
            onClick={handleExportMonthlyCollectionsCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            {translate(lang, 'exportMonthlyCsvBtn')}
          </button>
          <button
            type="button"
            onClick={handleExportLedgerCsv}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2C5D] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#034EA2] whitespace-nowrap shrink-0 dark:bg-[#034EA2] dark:hover:bg-sky-600"
          >
            <Download className="h-3.5 w-3.5 text-amber-300" />
            {translate(lang, 'exportLedgerCsv')}
          </button>
        </div>
      </div>

      {/* 6 Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="ada-surface rounded-xl border p-5">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'activeMembers')}
          </span>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {activeMembersCount}
          </p>
        </div>
        <div className="ada-surface rounded-xl border p-5">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'monthlyDuesReceivedCard', {month: thisMonth})}
          </span>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatCurrency(monthlyDuesReceived, settings.currency)}
          </p>
        </div>
        <div className="ada-surface rounded-xl border p-5">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'outstandingDues')}
          </span>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {formatCurrency(overdue.totalOutstanding, settings.currency)}
          </p>
        </div>
        <div className="ada-surface rounded-xl border p-5">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'otherContributionsCard', {month: thisMonth})}
          </span>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatCurrency(otherContributions, settings.currency)}
          </p>
        </div>
        <div className="ada-surface rounded-xl border p-5">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'officeExpensesCard', {month: thisMonth})}
          </span>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-red-700 dark:text-red-400">
            {formatCurrency(officeExpenses, settings.currency)}
          </p>
        </div>
        <div className="ada-surface rounded-xl border p-5">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'openPenaltiesReportCard')}
          </span>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-red-700 dark:text-red-400">
            {formatCurrency(openPenaltiesAmount, settings.currency)}
          </p>
        </div>
      </div>

      {/* Collection Channels Breakdown */}
      <section className="ada-surface rounded-xl border p-6">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {translate(lang, 'channelMixTitle')}
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300">
                {translate(lang, 'cashChannelLabel')}
              </span>
              <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {channelMix.cashPct}%
              </span>
            </div>
            <p className="font-mono text-base font-bold tabular-nums text-slate-900 dark:text-slate-100">
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
              <span className="truncate text-slate-600 dark:text-slate-300">
                {translate(lang, 'mobileMoneyChannelLabel')}
              </span>
              <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {channelMix.mobilePct}%
              </span>
            </div>
            <p className="font-mono text-base font-bold tabular-nums text-slate-900 dark:text-slate-100">
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
              <span className="truncate text-slate-600 dark:text-slate-300">
                {translate(lang, 'bankTransferChannelLabel')}
              </span>
              <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {channelMix.bankPct}%
              </span>
            </div>
            <p className="font-mono text-base font-bold tabular-nums text-slate-900 dark:text-slate-100">
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

      {/* Monthly Collections Chart */}
      <section className="ada-surface rounded-xl border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {translate(lang, 'monthlyCollectionsVsExpenses')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {translate(lang, 'monthlyCollectionsSubtitle')}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#0B2C5D] dark:bg-sky-400" />
              {translate(lang, 'approvedIncomeLegend')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-red-500/80 dark:bg-red-400/80" />
              {translate(lang, 'officeExpensesLegend')}
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-6 gap-4 border-b border-slate-200 pb-3 dark:border-slate-800">
          {series.map((pt) => {
            const incH = Math.max(4, Math.round((pt.income / maxVal) * 160));
            const expH = Math.max(4, Math.round((pt.expenses / maxVal) * 160));
            return (
              <div key={pt.monthKey} className="flex flex-col items-center">
                <div className="flex h-44 items-end gap-1.5">
                  <div
                    title={`${translate(lang, 'typeIncome')}: ${formatCurrency(pt.income, settings.currency)}`}
                    className="w-6 rounded-t bg-[#0B2C5D] dark:bg-sky-400"
                    style={{height: `${incH}px`}}
                  />
                  <div
                    title={`${translate(lang, 'typeExpense')}: ${formatCurrency(pt.expenses, settings.currency)}`}
                    className="w-6 rounded-t bg-red-500/75 dark:bg-red-400/75"
                    style={{height: `${expH}px`}}
                  />
                </div>
                <span className="mt-2 font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                  {pt.label}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                  {formatCurrency(pt.income, settings.currency)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <NoticeSheetModal
        isOpen={showNoticeSheet}
        settings={settings}
        members={members}
        payments={payments}
        onClose={() => setShowNoticeSheet(false)}
      />
    </div>
  );
};
