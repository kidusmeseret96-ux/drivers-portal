import React, {useEffect, useState} from 'react';
import {Check, Download, FileCheck2, FileText, Globe, KeyRound, Pencil, Printer, ShieldCheck, X} from 'lucide-react';
import {getPortalFullAccessRoles} from '../lib/supabasePortal';
import {
  LANGUAGE_OPTIONS,
  translate,
  translateGender,
  translateRole,
  translateSpouseLabel,
  translateStatus,
} from '../i18n/translations';
import {
  DEFAULT_MEMBER_ROLES,
  type AdaMember,
  type AdaPayment,
  type AdaPenalty,
  type AdaSettings,
  type LanguageCode,
} from '../types/ada';
import {buildBarcodeBars, calculateOverdueAccounts} from '../utils/adaCalculations';
import {formatEthiopianDate} from '../utils/ethiopianCalendar';
import {formatCurrency, formatDate} from '../utils/formatters';
import {
  ASSOCIATION_AMHARIC_TITLE,
  ASSOCIATION_ENGLISH_TITLE,
  ASSOCIATION_LOGO_PATH,
  downloadInvertedIdCardImage,
  downloadNormalIdCardImage,
} from '../utils/idCardExport';
import {MemberComplianceFormModal} from './MemberComplianceFormModal';
import {acquireModalPrintLock, releaseModalPrintLock} from './ModalShell';

interface MemberIdCardModalProps {
  member: AdaMember | null;
  allMembers?: AdaMember[];
  payments?: AdaPayment[];
  penalties?: AdaPenalty[];
  settings: AdaSettings;
  onChangeMemberRole?: (memberId: string, nextRole: string) => Promise<void>;
  onResetPortalPin?: (memberId: string) => Promise<void>;
  onEditMember?: (member: AdaMember) => void;
  onClose: () => void;
}

function DocumentSlot({
  label,
  emptyLabel,
  dataUrl,
}: {
  label: string;
  emptyLabel: string;
  dataUrl?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{label}</p>
      {dataUrl ? (
        <div className="mt-2 h-24 overflow-hidden rounded border border-slate-200 bg-white dark:border-slate-700">
          <img src={dataUrl} alt={label} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="mt-2 flex h-24 flex-col items-center justify-center rounded border border-dashed border-slate-300 text-[11px] text-slate-400 dark:border-slate-700">
          <FileText className="mb-1 h-4 w-4" />
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

export const MemberIdCardModal: React.FC<MemberIdCardModalProps> = ({
  member,
  allMembers = [],
  payments = [],
  penalties = [],
  settings,
  onChangeMemberRole,
  onResetPortalPin,
  onEditMember,
  onClose,
}) => {
  const uiLang = settings.language;
  const [tab, setTab] = useState<'card' | 'record'>('card');
  const [printLang, setPrintLang] = useState<LanguageCode>(
    settings.defaultPrintLanguage ?? settings.language
  );
  const [isExporting, setIsExporting] = useState(false);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [pinResetSaved, setPinResetSaved] = useState(false);

  useEffect(() => {
    if (!member) return;
    setPrintLang(settings.defaultPrintLanguage ?? settings.language);
    acquireModalPrintLock();
    return () => {
      releaseModalPrintLock();
    };
  }, [member?.id, settings.defaultPrintLanguage, settings.language]);

  if (!member) return null;

  const cardLang = printLang;
  const barcodeBars = buildBarcodeBars(member.memberId);
  const lastBar = barcodeBars[barcodeBars.length - 1];
  const barcodeWidth = lastBar ? lastBar.x + lastBar.width + 4 : 120;

  const spouseHeading = translateSpouseLabel(uiLang, member.gender);
  const emptyDocLabel = translate(uiLang, 'noFileUploaded');

  const totalApprovedPaid = payments
    .filter((p) => p.memberId === member.id && p.status === 'Approved')
    .reduce((sum, p) => sum + p.amount, 0);

  const unpaidPenaltiesTotal = penalties
    .filter((p) => p.memberId === member.id && p.status === 'Unpaid')
    .reduce((sum, p) => sum + p.amount, 0);

  const overdueSummary = calculateOverdueAccounts(
    allMembers.length > 0 ? allMembers : [member],
    payments,
    settings
  );
  const memberOverdueRow = overdueSummary.rows.find((r) => r.member.id === member.id);
  const memberOverdueAmount = memberOverdueRow?.totalDue ?? 0;

  const joinEc =
    settings.showEthiopianCalendar !== false && member.joinDate
      ? formatEthiopianDate(member.joinDate, cardLang)
      : '';

  const handleDownloadNormalPng = async () => {
    setIsExporting(true);
    try {
      await downloadNormalIdCardImage(member, settings, printLang);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadInvertedPng = async () => {
    setIsExporting(true);
    try {
      await downloadInvertedIdCardImage(member, settings, printLang);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div
        className={`modal-print-backdrop fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs p-3 sm:p-6 ${
          showComplianceModal ? 'no-print' : ''
        }`}
        onClick={onClose}
      >
        <div className="flex min-h-full items-start justify-center py-2 sm:items-center">
          <div
            onClick={(e) => e.stopPropagation()}
            className="modal-print-dialog flex max-h-[calc(100dvh-2rem)] sm:max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-300 bg-[#F8FAFC] shadow-2xl dark:border-slate-700 dark:bg-[#0F172A]"
          >
            {/* Top controls */}
            <div className="no-print shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {member.memberId} · {translateStatus(uiLang, member.status)}
                  </p>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {member.fullName}
                  </h2>
                </div>
                <div className="ml-2 flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setTab('card')}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      tab === 'card'
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {translate(uiLang, 'tabTwoSidedCard')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('record')}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      tab === 'record'
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {translate(uiLang, 'tabFullRecordDocs')}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800">
                  <Globe className="h-3.5 w-3.5 text-[#034EA2] dark:text-sky-400" />
                  <select
                    aria-label={translate(uiLang, 'printLangLabel')}
                    value={printLang}
                    onChange={(e) => setPrintLang(e.target.value as LanguageCode)}
                    className="bg-transparent text-xs font-medium text-slate-800 outline-none dark:text-slate-100"
                  >
                    {LANGUAGE_OPTIONS.map((opt) => (
                      <option
                        key={opt.code}
                        value={opt.code}
                        className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                      >
                        {opt.nativeLabel}
                      </option>
                    ))}
                  </select>
                </div>

                {onEditMember && (
                  <button
                    type="button"
                    onClick={() => onEditMember(member)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <Pencil className="h-3.5 w-3.5 text-[#034EA2] dark:text-sky-400" />
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowComplianceModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <FileCheck2 className="h-3.5 w-3.5 text-[#034EA2] dark:text-sky-400" />
                  {translate(uiLang, 'complianceFormBtn')}
                </button>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handleDownloadNormalPng}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#034EA2]/40 bg-[#EFF6FF] px-3 py-1.5 text-xs font-semibold text-[#0B2C5D] hover:bg-[#DBEAFE] disabled:opacity-60 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
                >
                  <Download className="h-3.5 w-3.5" />
                  {translate(uiLang, 'downloadCardPngBtn')}
                </button>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handleDownloadInvertedPng}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#034EA2] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0B2C5D] disabled:opacity-60"
                >
                  <Printer className="h-3.5 w-3.5 text-amber-300" />
                  {translate(uiLang, 'downloadInvertedSheetBtn')}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={translate(uiLang, 'close')}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="modal-print-scroll flex-1 overflow-y-auto p-6">
              {tab === 'card' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* FRONT OF CARD (Normal Orientation) */}
                    <div className="print-card relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-[#0F3D7A] bg-gradient-to-br from-white via-[#F4F9FF] to-[#E6F1FC] text-slate-900 shadow-md">
                      <div>
                        <div className="bg-gradient-to-r from-[#EBF7FF] to-[#D7EEFF] px-3 py-2">
                          <div className="flex items-center gap-3 py-0.5">
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-[#034EA2] bg-white shadow-xs">
                              <img
                                src={settings.logoDataUrl || ASSOCIATION_LOGO_PATH}
                                alt={settings.associationName || ASSOCIATION_ENGLISH_TITLE}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-extrabold text-[#034EA2]">
                                {ASSOCIATION_AMHARIC_TITLE}
                              </p>
                              <p className="truncate font-display text-[13px] font-extrabold tracking-wide text-[#0B2C5D]">
                                {(settings.associationName || ASSOCIATION_ENGLISH_TITLE).toUpperCase()}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="grid h-1 grid-cols-3">
                          <div className="bg-[#078930]" />
                          <div className="bg-[#FCDD09]" />
                          <div className="bg-[#DA121A]" />
                        </div>
                      </div>

                      <div className="relative px-5 py-4">
                        <div className="flex gap-4">
                          <div className="flex w-28 shrink-0 flex-col items-center">
                            <div className="h-32 w-28 overflow-hidden rounded-xl border-2 border-[#034EA2] bg-white shadow-xs">
                              {member.photoDataUrl ? (
                                <img
                                  src={member.photoDataUrl}
                                  alt={member.fullName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xl font-extrabold text-[#0B2C5D]">
                                  {member.fullName
                                    .split(' ')
                                    .map((n) => n[0])
                                    .slice(0, 2)
                                    .join('')
                                    .toUpperCase()}
                                </div>
                              )}
                            </div>

                            <div className="mt-2 w-full rounded-md bg-[#0B2C5D] px-2 py-1 text-center font-mono text-xs font-bold tracking-wide text-amber-300">
                              {member.memberId}
                            </div>

                            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-800">
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  member.status === 'Active'
                                    ? 'bg-emerald-600'
                                    : member.status === 'Deceased'
                                      ? 'bg-slate-500'
                                      : 'bg-red-600'
                                }`}
                              />
                              <span>{translateStatus(cardLang, member.status)}</span>
                            </div>
                          </div>

                          <div className="min-w-0 flex-1 space-y-2.5 text-xs">
                            <div className="border-b border-[#034EA2]/20 pb-1.5">
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {translate(cardLang, 'fullName').replace(' *', '')}
                              </span>
                              <p className="truncate text-base font-extrabold text-[#0B2C5D]">
                                {member.fullName}
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="block text-[10px] font-semibold uppercase text-slate-500">
                                  {translate(cardLang, 'role')}
                                </span>
                                <p className="truncate font-bold text-slate-900">
                                  {translateRole(cardLang, member.role)}
                                </p>
                              </div>
                              <div>
                                <span className="block text-[10px] font-semibold uppercase text-slate-500">
                                  {translate(cardLang, 'gender')}
                                </span>
                                <p className="font-bold text-slate-900">
                                  {translateGender(cardLang, member.gender)}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 items-end gap-2">
                              <div>
                                <span className="block text-[10px] font-semibold uppercase text-slate-500">
                                  {translate(cardLang, 'colVehiclePlate')}
                                </span>
                                <div className="mt-0.5 inline-block rounded border border-[#034EA2] bg-white px-2 py-0.5 font-mono text-xs font-extrabold text-[#034EA2]">
                                  {member.vehiclePlate || '—'}
                                </div>
                              </div>
                              <div>
                                <span className="block text-[10px] font-semibold uppercase text-slate-500">
                                  {translate(cardLang, 'phone')}
                                </span>
                                <p className="truncate font-mono text-[11px] font-bold text-slate-900">
                                  {member.phone || '—'}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-0.5">
                              <div className="min-w-0">
                                <span className="block text-[10px] font-semibold uppercase text-slate-500">
                                  {translate(cardLang, 'employer')}
                                </span>
                                <p className="truncate font-medium text-slate-800">
                                  {member.employer || '—'}
                                </p>
                              </div>
                              <div className="min-w-0">
                                <span className="block text-[10px] font-semibold uppercase text-slate-500">
                                  {translate(cardLang, 'locationPlace')}
                                </span>
                                <p className="truncate font-medium text-slate-800">
                                  {member.location || '—'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-[#0B2C5D] px-5 py-2 text-[10px]">
                        <span className="font-bold tracking-wider text-amber-300">
                          OFFICIAL DRIVER MEMBERSHIP CARD
                        </span>
                        <span className="font-mono font-semibold text-slate-200">
                          {translate(cardLang, 'joinedDateLabel', {
                            date: joinEc ? `${formatDate(member.joinDate)} (${joinEc})` : formatDate(member.joinDate),
                          })}
                        </span>
                      </div>
                    </div>

                    {/* BACK OF CARD (Normal Orientation) */}
                    <div className="print-card flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-[#0F3D7A] bg-gradient-to-br from-white via-[#F4F9FF] to-[#E6F1FC] text-slate-900 shadow-md">
                      <div>
                        <div className="flex items-center justify-between bg-gradient-to-r from-[#0B2C5D] to-[#034EA2] px-4 py-2.5 text-white">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/70 bg-white">
                              <img
                                src={settings.logoDataUrl || ASSOCIATION_LOGO_PATH}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-bold leading-tight text-white">
                                {ASSOCIATION_AMHARIC_TITLE}
                              </p>
                              <p className="truncate text-[9px] font-semibold tracking-wide text-sky-200">
                                {(settings.associationName || ASSOCIATION_ENGLISH_TITLE).toUpperCase()}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 font-mono text-xs font-bold text-amber-300">
                            {member.memberId}
                          </span>
                        </div>

                        <div className="grid h-1 grid-cols-3">
                          <div className="bg-[#078930]" />
                          <div className="bg-[#FCDD09]" />
                          <div className="bg-[#DA121A]" />
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-xs">
                          <div>
                            <span className="block text-[10px] font-semibold uppercase text-slate-500">
                              {translate(cardLang, 'licenceNumber')}
                            </span>
                            <p className="font-mono font-bold text-slate-900">
                              {member.licenseNumber || '—'}
                            </p>
                          </div>
                          <div>
                            <span className="block text-[10px] font-semibold uppercase text-slate-500">
                              {translate(cardLang, 'licenceExpiry')}
                            </span>
                            <p className="font-mono font-bold text-slate-900">
                              {formatDate(member.licenseExpiry)}
                            </p>
                          </div>
                          <div>
                            <span className="block text-[10px] font-semibold uppercase text-slate-500">
                              {translate(cardLang, 'bloodType')}
                            </span>
                            <span className="mt-0.5 inline-block rounded border border-red-500 bg-red-50 px-2.5 py-0.5 font-mono text-xs font-extrabold text-red-700">
                              {member.bloodType || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] font-semibold uppercase text-slate-500">
                              {translate(cardLang, 'dob')}
                            </span>
                            <p className="font-mono font-bold text-slate-900">
                              {formatDate(member.dateOfBirth)}
                            </p>
                          </div>
                          <div className="col-span-1">
                            <span className="block text-[10px] font-semibold uppercase text-slate-500">
                              {translate(cardLang, 'emergencyName')}
                            </span>
                            <p className="font-bold text-slate-900">
                              {member.emergencyContactName || '—'}
                            </p>
                            <p className="font-mono text-[11px] font-semibold text-[#034EA2]">
                              {member.emergencyContactPhone || ''}
                            </p>
                          </div>
                          <div className="relative rounded-lg border border-slate-200 bg-white/90 p-2.5 text-[10px] text-slate-600">
                            {settings.officialStampDataUrl && (
                              <img
                                src={settings.officialStampDataUrl}
                                alt=""
                                className="pointer-events-none absolute right-2 top-5 h-11 w-11 object-contain opacity-85"
                              />
                            )}
                            <p className="flex items-center gap-1 font-bold text-[#0B2C5D]">
                              <ShieldCheck className="h-3 w-3 shrink-0 text-[#034EA2]" />
                              AUTHORIZED SEAL
                            </p>
                            <p className="mt-0.5 pr-8 text-[9px] leading-snug">
                              Property of {(settings.associationName || ASSOCIATION_ENGLISH_TITLE).toUpperCase()}.
                            </p>
                            <div className="mt-2 flex h-5 items-end border-b border-slate-400">
                              {settings.chairmanSignatureDataUrl && (
                                <img
                                  src={settings.chairmanSignatureDataUrl}
                                  alt=""
                                  className="max-h-5 w-auto object-contain"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 bg-white px-4 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <svg
                            viewBox={`0 0 ${barcodeWidth} 34`}
                            className="h-9 w-44 text-slate-900"
                            aria-label={`Membership barcode ${member.memberId}`}
                          >
                            {barcodeBars.map((bar, idx) => (
                              <rect
                                key={idx}
                                x={bar.x}
                                y={2}
                                width={bar.width}
                                height={28}
                                fill="currentColor"
                              />
                            ))}
                          </svg>
                          <div className="min-w-0 text-right">
                            <p className="font-mono text-xs font-extrabold text-[#0B2C5D]">
                              {member.memberId}
                            </p>
                            <p className="truncate text-[9px] font-semibold text-[#034EA2]">
                              {ASSOCIATION_AMHARIC_TITLE}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="no-print text-center text-[11px] text-slate-500 dark:text-slate-400">
                    {translate(uiLang, 'idPrintHint')}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Driver Account Standing Summary */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[#034EA2] dark:text-sky-400">
                      {translate(uiLang, 'accountStandingTitle')}
                    </h3>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 dark:border-slate-800 dark:bg-[#111827]">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {translate(uiLang, 'totalApprovedPaidLabel')}
                        </span>
                        <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(totalApprovedPaid, settings.currency)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 dark:border-slate-800 dark:bg-[#111827]">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {translate(uiLang, 'currentOverdueDuesLabel')}
                        </span>
                        <p
                          className={`mt-0.5 font-mono text-sm font-bold tabular-nums ${
                            memberOverdueAmount > 0
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {memberOverdueAmount > 0
                            ? formatCurrency(memberOverdueAmount, settings.currency)
                            : translate(uiLang, 'clearStandingLabel')}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 dark:border-slate-800 dark:bg-[#111827]">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {translate(uiLang, 'unpaidPenaltiesLabel')}
                        </span>
                        <p
                          className={`mt-0.5 font-mono text-sm font-bold tabular-nums ${
                            unpaidPenaltiesTotal > 0
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {unpaidPenaltiesTotal > 0
                            ? formatCurrency(unpaidPenaltiesTotal, settings.currency)
                            : translate(uiLang, 'clearStandingLabel')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Role & Cloudflare Portal Access Controls */}
                  {(onChangeMemberRole || onResetPortalPin) && (
                    <div className="no-print flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/50 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          Role &amp; Online Portal Access ({member.memberId})
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {getPortalFullAccessRoles(settings).some(
                            (r) => r.toLowerCase() === (member.role || 'Member').toLowerCase()
                          )
                            ? 'Full Office Portal Access enabled for this role (sees all association records).'
                            : 'Self-Service Member Access (sees only their own profile, ID card, dues & trips). Default PIN: 0000.'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {onChangeMemberRole && (
                          <select
                            value={member.role}
                            aria-label="Member portal role"
                            onChange={(e) => onChangeMemberRole(member.id, e.target.value)}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                          >
                            {(settings.memberRoles && settings.memberRoles.length > 0
                              ? settings.memberRoles
                              : [...DEFAULT_MEMBER_ROLES]
                            ).map((r) => (
                              <option key={r} value={r}>
                                {translateRole(uiLang, r)}
                              </option>
                            ))}
                          </select>
                        )}
                        {onResetPortalPin && (
                          <button
                            type="button"
                            onClick={async () => {
                              await onResetPortalPin(member.id);
                              setPinResetSaved(true);
                              setTimeout(() => setPinResetSaved(false), 3000);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            {pinResetSaved ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                Reset to 0000
                              </>
                            ) : (
                              <>
                                <KeyRound className="h-3.5 w-3.5 text-[#034EA2] dark:text-sky-400" />
                                Reset Portal PIN (0000)
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Full Record View */}
                  <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 p-5 text-xs dark:border-slate-800 sm:grid-cols-4">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">
                        {translate(uiLang, 'gender')} &amp; {translate(uiLang, 'ageLabel')}
                      </span>
                      <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                        {translateGender(uiLang, member.gender)} ·{' '}
                        {member.age !== '' ? `${member.age} ${translate(uiLang, 'yrs')}` : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">
                        {translate(uiLang, 'dob')}
                      </span>
                      <p className="mt-1 font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {formatDate(member.dateOfBirth)}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">
                        {translate(uiLang, 'bloodType')}
                      </span>
                      <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                        {member.bloodType || '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">
                        {translate(uiLang, 'colJoinDate')}
                      </span>
                      <p className="mt-1 font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {formatDate(member.joinDate)}
                      </p>
                      {settings.showEthiopianCalendar !== false && member.joinDate && (
                        <p className="text-[10px] font-medium text-[#034EA2] dark:text-sky-400">
                          {formatEthiopianDate(member.joinDate, uiLang)}
                        </p>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">
                        {translate(uiLang, 'licenceNumber')}
                      </span>
                      <p className="mt-1 font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {member.licenseNumber || '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">
                        {translate(uiLang, 'licenceExpiry')}
                      </span>
                      <p className="mt-1 font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {formatDate(member.licenseExpiry)}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 dark:text-slate-400">
                        {translate(uiLang, 'emergencyName')}
                      </span>
                      <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                        {member.emergencyContactName || '—'}{' '}
                        {member.emergencyContactPhone ? `(${member.emergencyContactPhone})` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Vehicle, Annual Bolo, Insurance, Medical & Highway Clearance */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111827]">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[#034EA2] dark:text-sky-400">
                      {translate(uiLang, 'secInsuranceBolo')}
                    </h3>
                    <div className="mt-3 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">
                          {translate(uiLang, 'vehicleMakeModel')}
                        </span>
                        <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                          {member.vehicleMakeModel || '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">
                          {translate(uiLang, 'trailerPlateChassis')}
                        </span>
                        <p className="mt-1 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {member.trailerPlateOrChassis || '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">
                          {translate(uiLang, 'boloExpiry')}
                        </span>
                        <p className="mt-1 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {formatDate(member.boloExpiry)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">
                          {translate(uiLang, 'insuranceProvider')}
                        </span>
                        <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                          {member.insuranceProvider || '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">
                          {translate(uiLang, 'insurancePolicyNo')}
                        </span>
                        <p className="mt-1 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {member.insurancePolicyNumber || '—'}
                          {member.insuranceType ? ` · ${member.insuranceType}` : ''}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">
                          {translate(uiLang, 'insuranceExpiry')}
                        </span>
                        <p className="mt-1 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {formatDate(member.insuranceExpiry)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">
                          {translate(uiLang, 'medicalExpiry')}
                        </span>
                        <p className="mt-1 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {formatDate(member.medicalExpiry)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">
                          {translate(uiLang, 'highwayClearanceExpiry')}
                        </span>
                        <p className="mt-1 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {formatDate(member.highwayClearanceExpiry)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Member Documents */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {translate(uiLang, 'memberDocsHeading')}
                    </h3>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
                      <DocumentSlot
                        label={translate(uiLang, 'licenceImage')}
                        emptyLabel={emptyDocLabel}
                        dataUrl={member.licenseImageDataUrl}
                      />
                      <DocumentSlot
                        label={translate(uiLang, 'insuranceCertImage')}
                        emptyLabel={emptyDocLabel}
                        dataUrl={member.insuranceImageDataUrl}
                      />
                      <DocumentSlot
                        label={translate(uiLang, 'faydaFront')}
                        emptyLabel={emptyDocLabel}
                        dataUrl={member.faydaFrontDataUrl}
                      />
                      <DocumentSlot
                        label={translate(uiLang, 'faydaBack')}
                        emptyLabel={emptyDocLabel}
                        dataUrl={member.faydaBackDataUrl}
                      />
                      <DocumentSlot
                        label={translate(uiLang, 'signatureLineLabel')}
                        emptyLabel={emptyDocLabel}
                        dataUrl={member.signatureDataUrl}
                      />
                    </div>
                  </div>

                  {/* Spouse Section */}
                  <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {translate(uiLang, 'spouseDetailsHeading', {spouse: spouseHeading})}
                    </h3>
                    {!member.isMarried || !member.spouse?.name ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {translate(uiLang, 'notMarriedRecorded')}
                      </p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 p-4 text-xs dark:border-slate-800 sm:grid-cols-4">
                          <div>
                            <span className="text-slate-500">
                              {translate(uiLang, 'spouseNameLabel', {spouse: spouseHeading})}
                            </span>
                            <p className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                              {member.spouse.name}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">{translate(uiLang, 'ageLabel')}</span>
                            <p className="mt-0.5 font-mono text-slate-900 dark:text-slate-100">
                              {member.spouse.age !== ''
                                ? `${member.spouse.age} ${translate(uiLang, 'yrs')}`
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">
                              {translate(uiLang, 'occupationLabel')}
                            </span>
                            <p className="mt-0.5 text-slate-900 dark:text-slate-100">
                              {member.spouse.occupation || '—'}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">{translate(uiLang, 'phone')}</span>
                            <p className="mt-0.5 font-mono text-slate-900 dark:text-slate-100">
                              {member.spouse.phone || '—'}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <DocumentSlot
                            label={translate(uiLang, 'spousePhotoLabel', {spouse: spouseHeading})}
                            emptyLabel={emptyDocLabel}
                            dataUrl={member.spouse.photoDataUrl}
                          />
                          <DocumentSlot
                            label={translate(uiLang, 'spouseFaydaFrontLabel', {
                              spouse: spouseHeading,
                            })}
                            emptyLabel={emptyDocLabel}
                            dataUrl={member.spouse.faydaFrontDataUrl}
                          />
                          <DocumentSlot
                            label={translate(uiLang, 'spouseFaydaBackLabel', {
                              spouse: spouseHeading,
                            })}
                            emptyLabel={emptyDocLabel}
                            dataUrl={member.spouse.faydaBackDataUrl}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Children Section */}
                  <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {translate(uiLang, 'childrenHeading', {count: member.children.length})}
                    </h3>
                    {member.children.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {translate(uiLang, 'noChildrenRecorded')}
                      </p>
                    ) : (
                      <div className="mt-3 space-y-4">
                        {member.children.map((child, idx) => (
                          <div
                            key={child.id}
                            className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800"
                          >
                            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
                              <div>
                                <span className="text-slate-500">
                                  {translate(uiLang, 'childNumber', {num: idx + 1})}
                                </span>
                                <p className="font-semibold text-slate-900 dark:text-slate-100">
                                  {child.name || translate(uiLang, 'unnamedChild')}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-500">{translate(uiLang, 'gender')}</span>
                                <p className="text-slate-900 dark:text-slate-100">
                                  {translateGender(uiLang, child.gender)}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-500">
                                  {translate(uiLang, 'dob')} / {translate(uiLang, 'ageLabel')}
                                </span>
                                <p className="font-mono text-slate-900 dark:text-slate-100">
                                  {formatDate(child.dateOfBirth)} (
                                  {child.age !== '' ? `${child.age}` : '—'})
                                </p>
                              </div>
                              <div className="col-span-2">
                                <span className="text-slate-500">
                                  {translate(uiLang, 'childOccupationGrade')}
                                </span>
                                <p className="text-slate-900 dark:text-slate-100">
                                  {child.occupationOrGrade || '—'}
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <DocumentSlot
                                label={translate(uiLang, 'childPhoto')}
                                emptyLabel={emptyDocLabel}
                                dataUrl={child.photoDataUrl}
                              />
                              <DocumentSlot
                                label={translate(uiLang, 'childFaydaFront')}
                                emptyLabel={emptyDocLabel}
                                dataUrl={child.faydaFrontDataUrl}
                              />
                              <DocumentSlot
                                label={translate(uiLang, 'childFaydaBack')}
                                emptyLabel={emptyDocLabel}
                                dataUrl={child.faydaBackDataUrl}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <MemberComplianceFormModal
        isOpen={showComplianceModal}
        memberData={member}
        settings={settings}
        onClose={() => setShowComplianceModal(false)}
      />
    </>
  );
};
