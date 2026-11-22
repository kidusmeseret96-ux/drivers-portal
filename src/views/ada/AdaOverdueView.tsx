import React, {useMemo, useState} from 'react';
import {Check, Copy, CreditCard, Download, FileText} from 'lucide-react';
import {NoticeSheetModal} from '../../components/NoticeSheetModal';
import {VehiclePlateBadge} from '../../components/VehiclePlateBadge';
import {translate} from '../../i18n/translations';
import type {AdaMember, AdaPayment, AdaSettings} from '../../types/ada';
import {buildOverdueReminderText, calculateOverdueAccounts} from '../../utils/adaCalculations';
import {downloadCsv, formatCurrency, formatDate, todayIsoDate} from '../../utils/formatters';

interface AdaOverdueViewProps {
  settings: AdaSettings;
  members: AdaMember[];
  payments: AdaPayment[];
  onCollectOverdue?: (memberId: string, totalDue: number, daysLate: number) => void;
}

export const AdaOverdueView: React.FC<AdaOverdueViewProps> = ({
  settings,
  members,
  payments,
  onCollectOverdue,
}) => {
  const lang = settings.language;
  const [copiedMemberId, setCopiedMemberId] = useState<string | null>(null);
  const [showNoticeSheet, setShowNoticeSheet] = useState(false);
  const overdue = useMemo(
    () => calculateOverdueAccounts(members, payments, settings),
    [members, payments, settings]
  );

  const handleCopyReminder = async (row: (typeof overdue.rows)[number]) => {
    const text = buildOverdueReminderText(row, settings, lang);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for restricted clipboard contexts
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedMemberId(row.member.id);
    setTimeout(() => {
      setCopiedMemberId((prev) => (prev === row.member.id ? null : prev));
    }, 2200);
  };

  const handleExportCsv = () => {
    downloadCsv(
      `ada-overdue-dues-${todayIsoDate()}.csv`,
      [
        'Member ID',
        'Member Name',
        'Phone',
        'Vehicle Plate',
        'Monthly Dues (ETB)',
        'Due Date',
        'Days Late',
        'Daily Charge (ETB)',
        'Total Late Charges (ETB)',
        'Total Due (ETB)',
      ],
      overdue.rows.map((r) => [
        r.member.memberId,
        r.member.fullName,
        r.member.phone,
        r.member.vehiclePlate,
        r.monthlyDues,
        r.dueDate,
        r.daysLate,
        r.dailyCharge,
        r.lateCharges,
        r.totalDue,
      ])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {translate(lang, 'overdueDues')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'overdueSubtitle', {
              amount: formatCurrency(settings.monthlyDueAmount, settings.currency),
              day: settings.monthlyDueDay,
              charge: formatCurrency(settings.dailyLateCharge, settings.currency),
              nextDay: settings.monthlyDueDay + 1,
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowNoticeSheet(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <FileText className="h-3.5 w-3.5 text-[#034EA2] dark:text-sky-400" />
            {translate(lang, 'downloadNoticeSheetBtn')}
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            {translate(lang, 'exportOverdueCsv')}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="ada-surface rounded-xl border p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'overdueMembersCard')}
          </span>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-red-700 dark:text-red-400">
            {overdue.rows.length}
          </p>
        </div>
        <div className="ada-surface rounded-xl border p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'totalLateChargesCard')}
          </span>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {formatCurrency(overdue.totalLateCharges, settings.currency)}
          </p>
        </div>
        <div className="ada-surface rounded-xl border p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'currentDueDayCard')}
          </span>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {translate(lang, 'dayNumberLabel', {day: settings.monthlyDueDay})} (
            {formatDate(overdue.currentDueDateStr)})
          </p>
        </div>
      </div>

      {/* Overdue Table */}
      <div className="ada-surface overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-[#EBF2FA] text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                <th className="px-5 py-3 font-medium">{translate(lang, 'member')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'colVehiclePlate')}</th>
                <th className="px-4 py-3 text-right font-medium">
                  {translate(lang, 'colMonthlyDues')}
                </th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'colDueDate')}</th>
                <th className="px-4 py-3 text-right font-medium">
                  {translate(lang, 'colDaysLate')}
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  {translate(lang, 'colDailyCharge')}
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  {translate(lang, 'colTotalDue')}
                </th>
                <th className="px-5 py-3 text-right font-medium">{translate(lang, 'actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {overdue.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    {translate(lang, 'noOverdueMembers')}
                  </td>
                </tr>
              ) : (
                overdue.rows.map((r) => (
                  <tr
                    key={r.member.id}
                    className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {r.member.fullName}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {r.member.memberId} · {r.member.phone || translate(lang, 'noPhone')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <VehiclePlateBadge plate={r.member.vehiclePlate} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(r.monthlyDues, settings.currency)}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {formatDate(r.dueDate)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-red-700 dark:text-red-400">
                      {r.daysLate} {translate(lang, 'days')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {formatCurrency(r.dailyCharge, settings.currency)}
                      {translate(lang, 'perDay')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatCurrency(r.totalDue, settings.currency)}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyReminder(r)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {copiedMemberId === r.member.id ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-emerald-700 dark:text-emerald-400">
                                {translate(lang, 'copiedReminderBtn')}
                              </span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              {translate(lang, 'copyReminderBtn')}
                            </>
                          )}
                        </button>
                        {onCollectOverdue && (
                          <button
                            type="button"
                            onClick={() =>
                              onCollectOverdue(r.member.id, r.totalDue, r.daysLate)
                            }
                            className="inline-flex items-center gap-1 rounded-md bg-[#0B2C5D] px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#034EA2] whitespace-nowrap dark:bg-[#034EA2] dark:hover:bg-sky-600"
                          >
                            <CreditCard className="h-3 w-3 text-amber-300" />
                            {translate(lang, 'collectDuesBtn')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
