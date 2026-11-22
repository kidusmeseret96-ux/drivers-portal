import React, {useEffect, useState} from 'react';
import {Download, Globe, Upload} from 'lucide-react';
import {
  LANGUAGE_OPTIONS,
  translate,
  translateGender,
  translateRole,
} from '../i18n/translations';
import type {AdaMember, AdaSettings, LanguageCode} from '../types/ada';
import {downloadComplianceFormPng} from '../utils/documentExports';
import {formatEthiopianDate} from '../utils/ethiopianCalendar';
import {
  compressImageToDataUrl,
  formatCurrency,
  formatDate,
  todayIsoDate,
} from '../utils/formatters';
import {ASSOCIATION_AMHARIC_TITLE, ASSOCIATION_LOGO_PATH} from '../utils/idCardExport';
import {ModalShell} from './ModalShell';

export interface ComplianceFormDraft {
  memberId?: string;
  fullName?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  vehiclePlate?: string;
  vehicleMakeModel?: string;
  trailerPlateOrChassis?: string;
  role?: string;
  location?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  joinDate?: string;
  signatureDataUrl?: string;
}

interface MemberComplianceFormModalProps {
  isOpen: boolean;
  memberData: AdaMember | ComplianceFormDraft | null;
  settings: AdaSettings;
  onClose: () => void;
  onMemberSignatureChange?: (dataUrl?: string) => void;
}

function BlankOrValue({value, mono = false}: {value?: string; mono?: boolean}) {
  const clean = value?.trim();
  if (!clean) {
    return (
      <span className="inline-block min-w-[120px] border-b border-dotted border-slate-400 text-slate-400">
        &nbsp;
      </span>
    );
  }
  return (
    <span className={`${mono ? 'font-mono' : ''} font-semibold text-slate-900`}>{clean}</span>
  );
}

export const MemberComplianceFormModal: React.FC<MemberComplianceFormModalProps> = ({
  isOpen,
  memberData,
  settings,
  onClose,
  onMemberSignatureChange,
}) => {
  const uiLang = settings.language;
  const defaultPrint = settings.defaultPrintLanguage ?? settings.language;
  const [printLang, setPrintLang] = useState<LanguageCode>(defaultPrint);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPrintLang(settings.defaultPrintLanguage ?? settings.language);
    }
  }, [isOpen, settings.defaultPrintLanguage, settings.language]);

  if (!isOpen || !memberData) return null;

  const assocUpper = (settings.associationName || 'ADAMA HEAVY TRUCK DRIVERS EDIR').toUpperCase();
  const formattedMonthly = formatCurrency(settings.monthlyDueAmount, settings.currency);
  const joinIso = memberData.joinDate || todayIsoDate();
  const ecJoin =
    settings.showEthiopianCalendar !== false ? formatEthiopianDate(joinIso, printLang) : '';
  const memberSig =
    'signatureDataUrl' in memberData ? memberData.signatureDataUrl : undefined;

  const handleUploadMemberSig = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onMemberSignatureChange) return;
    const {dataUrl} = await compressImageToDataUrl(file, 700, 0.9, true);
    onMemberSignatureChange(dataUrl);
  };

  const handleDownloadFormPng = async () => {
    setIsExporting(true);
    try {
      await downloadComplianceFormPng(memberData, settings, printLang);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      title={translate(uiLang, 'complianceFormTitle')}
      subtitle={`${assocUpper} · ${memberData.memberId || translate(uiLang, 'complianceToBeAssigned')}`}
      onClose={onClose}
      closeLabel={translate(uiLang, 'close')}
      maxWidthClass="max-w-3xl"
    >
      <div className="space-y-4">
        <div className="print-card overflow-hidden rounded-xl border-2 border-[#0B2C5D]/85 bg-white text-slate-900 shadow-sm">
          {/* Ethiopian Tri-Color Top Stripe */}
          <div className="grid h-1.5 grid-cols-3">
            <div className="bg-[#078930]" />
            <div className="bg-[#FCDD09]" />
            <div className="bg-[#DA121A]" />
          </div>

          {/* Official Letterhead Bearing Logo + Uppercase Association Name */}
          <div className="border-b border-slate-200 bg-gradient-to-r from-[#EBF5FF] via-[#F7FAFF] to-[#EBF5FF] px-6 py-4">
            <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-[#0B2C5D] bg-white shadow-xs">
                <img
                  src={settings.logoDataUrl || ASSOCIATION_LOGO_PATH}
                  alt={assocUpper}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#034EA2]">{ASSOCIATION_AMHARIC_TITLE}</p>
                <h2 className="font-display text-base font-extrabold tracking-wide text-[#0B2C5D] sm:text-lg">
                  {assocUpper}
                </h2>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  {translate(printLang, 'complianceFormTitle')} ·{' '}
                  {translate(printLang, 'complianceFormSubtitle')}
                </p>
              </div>
              <div className="shrink-0 rounded-lg border border-[#0B2C5D]/30 bg-white px-3 py-1.5 text-right">
                <span className="block text-[9px] font-bold uppercase text-slate-500">
                  {translate(printLang, 'colMemberId')}
                </span>
                <span className="font-mono text-xs font-extrabold text-[#0B2C5D]">
                  {memberData.memberId || translate(printLang, 'complianceToBeAssigned')}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6 text-xs">
            {/* Member & Truck Particulars */}
            <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  {translate(printLang, 'fullName').replace(' *', '')}
                </span>
                <div className="mt-0.5">
                  <BlankOrValue value={memberData.fullName} />
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  {translate(printLang, 'phone')} / {translate(printLang, 'gender')}
                </span>
                <div className="mt-0.5 flex flex-wrap gap-2">
                  <BlankOrValue value={memberData.phone} mono />
                  {memberData.gender && (
                    <span className="text-slate-600">
                      ({translateGender(printLang, memberData.gender)})
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  {translate(printLang, 'colVehiclePlate')} &amp;{' '}
                  {translate(printLang, 'vehicleMakeModel')}
                </span>
                <div className="mt-0.5">
                  <BlankOrValue
                    value={
                      [memberData.vehiclePlate, memberData.vehicleMakeModel]
                        .filter(Boolean)
                        .join(' · ') || undefined
                    }
                    mono
                  />
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  {translate(printLang, 'licenceNumber')} /{' '}
                  {translate(printLang, 'insurancePolicyNo')}
                </span>
                <div className="mt-0.5">
                  <BlankOrValue
                    value={
                      [
                        memberData.licenseNumber,
                        memberData.insuranceProvider
                          ? `${memberData.insuranceProvider}${
                              memberData.insurancePolicyNumber
                                ? ` (${memberData.insurancePolicyNumber})`
                                : ''
                            }`
                          : memberData.insurancePolicyNumber,
                      ]
                        .filter(Boolean)
                        .join(' · ') || undefined
                    }
                    mono
                  />
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  {translate(printLang, 'locationPlace')} / {translate(printLang, 'role')}
                </span>
                <div className="mt-0.5">
                  <BlankOrValue
                    value={
                      [
                        memberData.location,
                        memberData.role ? translateRole(printLang, memberData.role) : undefined,
                      ]
                        .filter(Boolean)
                        .join(' · ') || undefined
                    }
                  />
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  {translate(printLang, 'emergencyName')} / {translate(printLang, 'colJoinDate')}
                </span>
                <div className="mt-0.5">
                  <BlankOrValue
                    value={[
                      memberData.emergencyContactName,
                      memberData.emergencyContactPhone,
                      ecJoin ? `${formatDate(joinIso)} (${ecJoin})` : formatDate(joinIso),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                </div>
              </div>
            </div>

            {/* Bylaws Pledge Clauses */}
            <div className="space-y-2.5 rounded-lg border border-slate-200 p-4">
              <p className="font-semibold leading-relaxed text-slate-800">
                {translate(printLang, 'complianceIntroText')}
              </p>
              <ul className="space-y-1.5 pl-1 text-[11.5px] leading-relaxed text-slate-700">
                <li>{translate(printLang, 'complianceClause1')}</li>
                <li>
                  {translate(printLang, 'complianceClause2', {
                    amount: formattedMonthly,
                    day: settings.monthlyDueDay,
                  })}
                </li>
                <li>{translate(printLang, 'complianceClause3')}</li>
                <li>{translate(printLang, 'complianceClause4')}</li>
                <li>{translate(printLang, 'complianceClause5')}</li>
              </ul>
            </div>

            {/* Dual Signature Places: New Member & Association Authority + Stamp */}
            <div className="grid grid-cols-1 gap-5 pt-2 sm:grid-cols-2">
              {/* New Member Signature */}
              <div className="rounded-lg border border-slate-300 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#0B2C5D]">
                    {translate(printLang, 'complianceMemberSigTitle')}
                  </p>
                  {onMemberSignatureChange && (
                    <div className="no-print flex items-center gap-1.5">
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-100">
                        <Upload className="h-2.5 w-2.5" />
                        {memberSig
                          ? translate(uiLang, 'replace')
                          : translate(uiLang, 'uploadSignatureBtn')}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleUploadMemberSig}
                          className="hidden"
                        />
                      </label>
                      {memberSig && (
                        <button
                          type="button"
                          onClick={() => onMemberSignatureChange(undefined)}
                          className="text-[10px] font-semibold text-red-600 hover:underline"
                        >
                          {translate(uiLang, 'clearBtn')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-3 space-y-3 text-[11px] text-slate-700">
                  <div>
                    <span className="text-slate-500">
                      {translate(printLang, 'fullName').replace(' *', '')}:
                    </span>{' '}
                    <BlankOrValue value={memberData.fullName} />
                  </div>
                  <div className="pt-2">
                    <div className="flex h-12 items-end justify-center border-b border-slate-500 pb-1">
                      {memberSig && (
                        <img
                          src={memberSig}
                          alt={translate(printLang, 'signatureLineLabel')}
                          className="max-h-11 w-auto object-contain"
                        />
                      )}
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-600">
                      <span>{translate(printLang, 'signatureLineLabel')}</span>
                      <span>{translate(printLang, 'date')}: ____ / ____ / ________</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Authority Signature + Official Stamp */}
              <div className="rounded-lg border border-slate-300 bg-slate-50/50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#0B2C5D]">
                  {translate(printLang, 'complianceAuthoritySigTitle')}
                </p>
                <div className="mt-3 space-y-3 text-[11px] text-slate-700">
                  <div>
                    <span className="text-slate-500">
                      {translate(printLang, 'complianceAuthorityRoleLabel')}:
                    </span>{' '}
                    <span className="font-semibold text-slate-900">{settings.currentUserName}</span>
                  </div>
                  <div className="flex items-end gap-3 pt-2">
                    <div className="flex-1">
                      <div className="flex h-12 items-end justify-center border-b border-slate-500 pb-1">
                        {settings.chairmanSignatureDataUrl && (
                          <img
                            src={settings.chairmanSignatureDataUrl}
                            alt={translate(printLang, 'complianceAuthoritySigTitle')}
                            className="max-h-11 w-auto object-contain"
                          />
                        )}
                      </div>
                      <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-600">
                        <span>{translate(printLang, 'signatureLineLabel')}</span>
                        <span>{translate(printLang, 'date')}: ____ / ____ / ____</span>
                      </div>
                    </div>
                    <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded border border-dashed border-slate-400 bg-white p-1 text-center text-[9px] font-semibold uppercase leading-tight text-slate-500">
                      {settings.officialStampDataUrl ? (
                        <img
                          src={settings.officialStampDataUrl}
                          alt={translate(printLang, 'officialStampBoxLabel')}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        translate(printLang, 'officialStampBoxLabel')
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-2 text-center font-mono text-[10px] text-slate-500">
              {assocUpper} · {ASSOCIATION_AMHARIC_TITLE}
            </div>
          </div>
        </div>

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

          <div className="flex items-center gap-2.5">
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
              onClick={handleDownloadFormPng}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2C5D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#034EA2] disabled:opacity-60 dark:bg-[#034EA2] dark:hover:bg-sky-600"
            >
              <Download className="h-3.5 w-3.5 text-amber-300" />
              {translate(uiLang, 'downloadFormPngBtn')}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};
