import React, {useEffect, useState} from 'react';
import {CheckCircle2, Download, Globe} from 'lucide-react';
import {
  LANGUAGE_OPTIONS,
  translate,
  translateMethod,
  translateRole,
  translateStatus,
} from '../i18n/translations';
import type {
  AdaMember,
  AdaPayment,
  AdaSettings,
  LanguageCode,
  PaymentMethod,
} from '../types/ada';
import {downloadOfficialInvoicePng} from '../utils/documentExports';
import {formatEthiopianDate} from '../utils/ethiopianCalendar';
import {formatCurrency, formatDate} from '../utils/formatters';
import {ASSOCIATION_AMHARIC_TITLE, ASSOCIATION_LOGO_PATH} from '../utils/idCardExport';
import {ModalShell} from './ModalShell';

export interface OfficialInvoiceData {
  invoiceNo: string;
  date: string;
  amount: number;
  categoryName: string;
  method: PaymentMethod | string;
  status: string;
  partyRole?: 'payer' | 'vendor';
  partyName: string;
  partySub?: string;
  recordedBy: string;
  reviewerRole?: string;
  confirmationMessage?: string;
  note?: string;
}

interface PaymentReceiptModalProps {
  payment?: AdaPayment | null;
  invoice?: OfficialInvoiceData | null;
  member?: AdaMember;
  settings: AdaSettings;
  onClose: () => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  payment,
  invoice,
  member,
  settings,
  onClose,
}) => {
  const uiLang = settings.language;
  const defaultPrint = settings.defaultPrintLanguage ?? settings.language;
  const [printLang, setPrintLang] = useState<LanguageCode>(defaultPrint);
  const [isExporting, setIsExporting] = useState(false);

  const doc: OfficialInvoiceData | null = invoice
    ? invoice
    : payment
      ? {
          invoiceNo: payment.reference,
          date: payment.date,
          amount: payment.amount,
          categoryName: payment.categoryName,
          method: payment.method,
          status: payment.status,
          partyRole: 'payer',
          partyName: member?.fullName ?? translate(printLang, 'member'),
          partySub: `${member?.memberId ?? '—'}${member?.vehiclePlate ? ` · ${member.vehiclePlate}` : ''}`,
          recordedBy: payment.recordedBy,
          reviewerRole: payment.reviewerRole,
          confirmationMessage: payment.confirmationMessage,
          note: payment.note,
        }
      : null;

  useEffect(() => {
    if (doc) {
      setPrintLang(settings.defaultPrintLanguage ?? settings.language);
    }
  }, [doc?.invoiceNo, settings.defaultPrintLanguage, settings.language]);

  if (!doc) return null;

  const assocUpper = (settings.associationName || 'ADAMA HEAVY TRUCK DRIVERS EDIR').toUpperCase();
  const isSuccess = doc.status === 'Approved' || doc.status === 'Paid';
  const isDanger = doc.status === 'Rejected' || doc.status === 'Unpaid';
  const ecDate =
    settings.showEthiopianCalendar !== false ? formatEthiopianDate(doc.date, printLang) : '';

  const handleDownloadPng = async () => {
    setIsExporting(true);
    try {
      await downloadOfficialInvoicePng(doc, settings, printLang);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ModalShell
      isOpen={Boolean(doc)}
      title={translate(uiLang, 'officialReceiptTitle')}
      subtitle={`${translate(uiLang, 'receiptNoLabel')}: ${doc.invoiceNo}`}
      onClose={onClose}
      closeLabel={translate(uiLang, 'close')}
      maxWidthClass="max-w-xl"
    >
      <div className="space-y-4">
        {/* Printable Invoice / Receipt Preview Card */}
        <div className="print-card overflow-hidden rounded-xl border-2 border-[#0B2C5D]/85 bg-white text-slate-900 shadow-sm dark:border-slate-700">
          {/* Top Ethiopian flag stripe */}
          <div className="grid h-1.5 grid-cols-3">
            <div className="bg-[#078930]" />
            <div className="bg-[#FCDD09]" />
            <div className="bg-[#DA121A]" />
          </div>

          {/* Association Letterhead with Logo & Official Uppercase Name */}
          <div className="border-b border-slate-200 bg-gradient-to-r from-[#EBF5FF] to-[#F8FBFF] px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-[#0B2C5D] bg-white shadow-xs">
                <img
                  src={settings.logoDataUrl || ASSOCIATION_LOGO_PATH}
                  alt={assocUpper}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-bold text-[#034EA2]">
                  {ASSOCIATION_AMHARIC_TITLE}
                </p>
                <p className="font-display text-sm font-extrabold leading-tight tracking-wide text-[#0B2C5D]">
                  {assocUpper}
                </p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-slate-200/80 pt-2 text-[11px]">
              <span className="font-display font-bold uppercase tracking-wide text-[#0B2C5D]">
                {translate(printLang, 'officialReceiptTitle')}
              </span>
              <span className="font-mono font-bold text-[#034EA2]">{doc.invoiceNo}</span>
            </div>
          </div>

          <div className="space-y-4 p-5 text-xs">
            {/* Highlighted Amount */}
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-[11px] font-medium text-slate-500">
                  {translate(printLang, 'amount')}
                </p>
                <p className="font-mono text-2xl font-extrabold tabular-nums text-[#0B2C5D]">
                  {formatCurrency(doc.amount, settings.currency)}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold ${
                    isSuccess
                      ? 'bg-emerald-100 text-emerald-800'
                      : isDanger
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {isSuccess && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {translateStatus(printLang, doc.status)}
                </span>
                <p className="mt-1 font-mono text-[11px] text-slate-700">{formatDate(doc.date)}</p>
                {ecDate && <p className="text-[10px] font-semibold text-[#034EA2]">{ecDate}</p>}
              </div>
            </div>

            {/* Key Invoice Fields */}
            <div className="grid grid-cols-2 gap-3 border-b border-dashed border-slate-300 pb-4">
              <div>
                <span className="text-[11px] text-slate-500">
                  {doc.partyRole === 'vendor'
                    ? translate(printLang, 'paidToVendorLabel')
                    : translate(printLang, 'receivedFromLabel')}
                </span>
                <p className="mt-0.5 font-semibold text-slate-900">{doc.partyName}</p>
                {doc.partySub && (
                  <p className="font-mono text-[11px] text-slate-500">{doc.partySub}</p>
                )}
              </div>
              <div>
                <span className="text-[11px] text-slate-500">
                  {translate(printLang, 'paymentForLabel')}
                </span>
                <p className="mt-0.5 font-semibold text-slate-900">{doc.categoryName}</p>
                <p className="text-[11px] text-slate-500">
                  {translateMethod(printLang, doc.method)}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slate-500">
                  {translate(printLang, 'recordedByLabel')}
                </span>
                <p className="mt-0.5 font-medium text-slate-800">{doc.recordedBy}</p>
              </div>
              {doc.reviewerRole && (
                <div>
                  <span className="text-[11px] text-slate-500">
                    {translate(printLang, 'reviewerRoleLabel')}
                  </span>
                  <p className="mt-0.5 font-medium text-slate-800">
                    {translateRole(printLang, doc.reviewerRole)}
                  </p>
                </div>
              )}
            </div>

            {(doc.confirmationMessage || doc.note) && (
              <div className="space-y-1.5 text-[11px] text-slate-600">
                {doc.confirmationMessage && (
                  <p>
                    <strong className="text-slate-800">Ref/SMS:</strong> {doc.confirmationMessage}
                  </p>
                )}
                {doc.note && (
                  <p>
                    <strong className="text-slate-800">{translate(printLang, 'note')}:</strong>{' '}
                    {doc.note}
                  </p>
                )}
              </div>
            )}

            {/* Dual Signature Lines + Official Stamp */}
            <div className="grid grid-cols-12 items-end gap-3 pt-2 text-[10px] text-slate-500">
              <div className="col-span-4">
                <div className="h-10 border-b border-slate-400" />
                <p className="mt-1 font-medium text-slate-700">
                  {translate(printLang, 'payerSignatureLabel')}
                </p>
              </div>
              <div className="col-span-5">
                <div className="flex h-10 items-end justify-center border-b border-slate-400 pb-0.5">
                  {settings.chairmanSignatureDataUrl && (
                    <img
                      src={settings.chairmanSignatureDataUrl}
                      alt={translate(printLang, 'authorizedSignLabel')}
                      className="max-h-9 w-auto object-contain"
                    />
                  )}
                </div>
                <p className="mt-1 font-medium text-slate-700">
                  {translate(printLang, 'authorizedSignLabel')}
                </p>
              </div>
              <div className="col-span-3 flex justify-end">
                <div className="flex h-14 w-16 items-center justify-center rounded border border-dashed border-slate-400 bg-slate-50 p-1 text-center">
                  {settings.officialStampDataUrl ? (
                    <img
                      src={settings.officialStampDataUrl}
                      alt={translate(printLang, 'officialStampBoxLabel')}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-[8px] font-semibold uppercase leading-tight text-slate-500">
                      {translate(printLang, 'officialStampBoxLabel')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-mono text-[10px] text-slate-400">
              <span>{assocUpper}</span>
              <span>{translate(printLang, 'officeCopyLabel')}</span>
            </div>
          </div>
        </div>

        {/* Language Picker + PNG Download Actions */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-[#034EA2] dark:text-sky-400" />
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {translate(uiLang, 'close')}
            </button>
            <button
              type="button"
              disabled={isExporting}
              onClick={handleDownloadPng}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2C5D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#034EA2] disabled:opacity-60 dark:bg-[#034EA2] dark:hover:bg-sky-600"
            >
              <Download className="h-3.5 w-3.5 text-amber-300" />
              {translate(uiLang, 'downloadInvoicePngBtn')}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};
