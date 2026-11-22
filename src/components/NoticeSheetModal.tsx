import React, {useEffect, useMemo, useState} from 'react';
import {Download, FileText, Globe} from 'lucide-react';
import {LANGUAGE_OPTIONS, translate} from '../i18n/translations';
import type {AdaMember, AdaPayment, AdaSettings, LanguageCode} from '../types/ada';
import {
  calculateOverdueAccounts,
  getExpiringBolo,
  getExpiringDriverLicences,
  getExpiringHighwayClearance,
  getExpiringInsurance,
  getExpiringMedical,
} from '../utils/adaCalculations';
import {
  downloadBatchNoticeSheetHtml,
  type ExpiringComplianceItem,
} from '../utils/documentExports';
import {formatEthiopianDate} from '../utils/ethiopianCalendar';
import {downloadCsv, formatCurrency, formatDate, todayIsoDate} from '../utils/formatters';
import {ModalShell} from './ModalShell';

interface NoticeSheetModalProps {
  isOpen: boolean;
  settings: AdaSettings;
  members: AdaMember[];
  payments: AdaPayment[];
  onClose: () => void;
}

export const NoticeSheetModal: React.FC<NoticeSheetModalProps> = ({
  isOpen,
  settings,
  members,
  payments,
  onClose,
}) => {
  const uiLang = settings.language;
  const [printLang, setPrintLang] = useState<LanguageCode>(
    settings.defaultPrintLanguage ?? settings.language
  );

  useEffect(() => {
    if (isOpen) {
      setPrintLang(settings.defaultPrintLanguage ?? settings.language);
    }
  }, [isOpen, settings.defaultPrintLanguage, settings.language]);

  const overdue = useMemo(
    () => calculateOverdueAccounts(members, payments, settings),
    [members, payments, settings]
  );

  const expiringItems = useMemo<ExpiringComplianceItem[]>(() => {
    const list: ExpiringComplianceItem[] = [];
    for (const item of getExpiringDriverLicences(members, 30)) {
      list.push({
        member: item.member,
        docTypeLabel: translate(printLang, 'licenceExpiry'),
        expiryDate: item.member.licenseExpiry,
        daysLeft: item.daysLeft,
      });
    }
    for (const item of getExpiringInsurance(members, 30)) {
      list.push({
        member: item.member,
        docTypeLabel: translate(printLang, 'insuranceExpiry'),
        expiryDate: item.member.insuranceExpiry || '',
        daysLeft: item.daysLeft,
      });
    }
    for (const item of getExpiringBolo(members, 30)) {
      list.push({
        member: item.member,
        docTypeLabel: translate(printLang, 'boloExpiry'),
        expiryDate: item.member.boloExpiry || '',
        daysLeft: item.daysLeft,
      });
    }
    for (const item of getExpiringMedical(members, 30)) {
      list.push({
        member: item.member,
        docTypeLabel: translate(printLang, 'medicalExpiry'),
        expiryDate: item.member.medicalExpiry || '',
        daysLeft: item.daysLeft,
      });
    }
    for (const item of getExpiringHighwayClearance(members, 30)) {
      list.push({
        member: item.member,
        docTypeLabel: translate(printLang, 'highwayClearanceExpiry'),
        expiryDate: item.member.highwayClearanceExpiry || '',
        daysLeft: item.daysLeft,
      });
    }
    return list.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [members, printLang]);

  if (!isOpen) return null;

  const today = todayIsoDate();
  const ecToday =
    settings.showEthiopianCalendar !== false ? formatEthiopianDate(today, printLang) : '';

  const handleDownloadHtml = () => {
    downloadBatchNoticeSheetHtml(overdue.rows, expiringItems, settings, printLang);
  };

  const handleExportCsv = () => {
    const overdueCsv = overdue.rows.map((r) => [
      'Overdue Dues',
      r.member.memberId,
      r.member.fullName,
      r.member.vehiclePlate,
      r.member.phone,
      r.dueDate,
      `${r.daysLate} days late`,
      formatCurrency(r.totalDue, settings.currency),
    ]);
    const expCsv = expiringItems.map((e) => [
      e.docTypeLabel,
      e.member.memberId,
      e.member.fullName,
      e.member.vehiclePlate,
      e.member.phone,
      e.expiryDate,
      e.daysLeft < 0 ? 'Expired' : `${e.daysLeft} days left`,
      '—',
    ]);
    downloadCsv(
      `ada-batch-notices-${today}-${printLang}.csv`,
      ['Notice Type', 'Member ID', 'Driver Name', 'Plate', 'Phone', 'Date / Expiry', 'Status', 'Amount Due'],
      [...overdueCsv, ...expCsv]
    );
  };

  return (
    <ModalShell
      isOpen={isOpen}
      title={translate(uiLang, 'noticeSheetTitle')}
      subtitle={`${formatDate(today)}${ecToday ? ` · ${ecToday}` : ''}`}
      onClose={onClose}
      closeLabel={translate(uiLang, 'close')}
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              {translate(printLang, 'overdueDues')}: {overdue.rows.length} (
              {formatCurrency(overdue.totalOutstanding, settings.currency)})
            </span>
            <span className="font-semibold text-red-700 dark:text-red-400">
              {translate(printLang, 'fleetInsurance')}: {expiringItems.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-[#034EA2] dark:text-sky-400" />
            <label className="font-medium text-slate-600 dark:text-slate-300">
              {translate(uiLang, 'printLangLabel')}:
            </label>
            <select
              value={printLang}
              onChange={(e) => setPrintLang(e.target.value as LanguageCode)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.nativeLabel} ({opt.label})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Overdue Dues Preview */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="bg-[#EBF2FA] px-4 py-2 font-semibold text-[#0B2C5D] dark:bg-slate-900 dark:text-sky-300">
            {translate(printLang, 'overdueDues')} ({overdue.rows.length})
          </div>
          {overdue.rows.length === 0 ? (
            <p className="p-4 text-slate-500">{translate(printLang, 'noOverdueMembers')}</p>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                    <th className="px-4 py-2">{translate(printLang, 'member')}</th>
                    <th className="px-3 py-2">{translate(printLang, 'colVehiclePlate')}</th>
                    <th className="px-3 py-2">{translate(printLang, 'colDaysLate')}</th>
                    <th className="px-4 py-2 text-right">{translate(printLang, 'colTotalDue')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {overdue.rows.map((r) => (
                    <tr key={r.member.id}>
                      <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">
                        {r.member.fullName}{' '}
                        <span className="font-mono text-[11px] text-slate-500">
                          ({r.member.memberId})
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono">{r.member.vehiclePlate || '—'}</td>
                      <td className="px-3 py-2 font-mono text-red-600 dark:text-red-400">
                        {r.daysLate} {translate(printLang, 'days')}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-bold">
                        {formatCurrency(r.totalDue, settings.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Expiring Compliance Preview */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="bg-[#EBF2FA] px-4 py-2 font-semibold text-[#0B2C5D] dark:bg-slate-900 dark:text-sky-300">
            {translate(printLang, 'fleetInsurance')} ({expiringItems.length})
          </div>
          {expiringItems.length === 0 ? (
            <p className="p-4 text-slate-500">{translate(printLang, 'noExpiringCompliance')}</p>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                    <th className="px-4 py-2">{translate(printLang, 'member')}</th>
                    <th className="px-3 py-2">{translate(printLang, 'colVehiclePlate')}</th>
                    <th className="px-3 py-2">{translate(printLang, 'category')}</th>
                    <th className="px-3 py-2">{translate(printLang, 'date')}</th>
                    <th className="px-4 py-2 text-right">{translate(printLang, 'status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {expiringItems.map((item, idx) => (
                    <tr key={`${item.member.id}-${idx}`}>
                      <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">
                        {item.member.fullName}
                      </td>
                      <td className="px-3 py-2 font-mono">{item.member.vehiclePlate || '—'}</td>
                      <td className="px-3 py-2">{item.docTypeLabel}</td>
                      <td className="px-3 py-2 font-mono">{formatDate(item.expiryDate)}</td>
                      <td
                        className={`px-4 py-2 text-right font-semibold ${
                          item.daysLeft < 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {item.daysLeft < 0
                          ? translate(printLang, 'expiredLabel')
                          : translate(printLang, 'daysLeftLabel', {days: item.daysLeft})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {translate(uiLang, 'close')}
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            {translate(uiLang, 'exportCsv')}
          </button>
          <button
            type="button"
            onClick={handleDownloadHtml}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2C5D] px-4 py-2 font-semibold text-white hover:bg-[#034EA2] dark:bg-[#034EA2] dark:hover:bg-sky-600"
          >
            <FileText className="h-3.5 w-3.5 text-amber-300" />
            {translate(uiLang, 'downloadNoticeSheetBtn')}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
