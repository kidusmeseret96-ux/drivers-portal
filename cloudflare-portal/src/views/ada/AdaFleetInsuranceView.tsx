import React, {useMemo, useState} from 'react';
import {Download, FileCheck2, FileText, Search, ShieldAlert, ShieldCheck, Truck, Upload} from 'lucide-react';
import {ModalShell} from '../../components/ModalShell';
import {NoticeSheetModal} from '../../components/NoticeSheetModal';
import {StatusText} from '../../components/StatusText';
import {VehiclePlateBadge} from '../../components/VehiclePlateBadge';
import {translate} from '../../i18n/translations';
import type {AdaMember, AdaPayment, AdaSettings, InsuranceType} from '../../types/ada';
import {
  compressImageToDataUrl,
  daysUntil,
  downloadCsv,
  formatDate,
  todayIsoDate,
} from '../../utils/formatters';

interface AdaFleetInsuranceViewProps {
  settings: AdaSettings;
  members: AdaMember[];
  payments: AdaPayment[];
  onUpdateMemberCompliance: (memberId: string, patch: Partial<AdaMember>) => Promise<void>;
}

type FleetFilter = 'All' | 'Attention' | 'Insured';

export const AdaFleetInsuranceView: React.FC<AdaFleetInsuranceViewProps> = ({
  settings,
  members,
  payments,
  onUpdateMemberCompliance,
}) => {
  const lang = settings.language;
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FleetFilter>('All');
  const [editingMember, setEditingMember] = useState<AdaMember | null>(null);
  const [showNoticeSheet, setShowNoticeSheet] = useState(false);

  // Edit compliance form state
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleMakeModel, setVehicleMakeModel] = useState('');
  const [trailerPlateOrChassis, setTrailerPlateOrChassis] = useState('');
  const [boloExpiry, setBoloExpiry] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');
  const [insuranceType, setInsuranceType] = useState<InsuranceType>('Third-Party');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [medicalExpiry, setMedicalExpiry] = useState('');
  const [highwayClearanceExpiry, setHighwayClearanceExpiry] = useState('');
  const [insuranceImageDataUrl, setInsuranceImageDataUrl] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  const activeMembers = useMemo(
    () => members.filter((m) => !m.deletedAt && m.status === 'Active'),
    [members]
  );

  const openEditModal = (m: AdaMember) => {
    setEditingMember(m);
    setVehiclePlate(m.vehiclePlate ?? '');
    setVehicleMakeModel(m.vehicleMakeModel ?? '');
    setTrailerPlateOrChassis(m.trailerPlateOrChassis ?? '');
    setBoloExpiry(m.boloExpiry ?? '');
    setInsuranceProvider(m.insuranceProvider ?? '');
    setInsurancePolicyNumber(m.insurancePolicyNumber ?? '');
    setInsuranceType(m.insuranceType ?? 'Third-Party');
    setInsuranceExpiry(m.insuranceExpiry ?? '');
    setMedicalExpiry(m.medicalExpiry ?? '');
    setHighwayClearanceExpiry(m.highwayClearanceExpiry ?? '');
    setInsuranceImageDataUrl(m.insuranceImageDataUrl);
  };

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const {dataUrl} = await compressImageToDataUrl(file, 1000, 0.78);
    setInsuranceImageDataUrl(dataUrl);
  };

  const handleSaveCompliance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setIsSaving(true);
    try {
      await onUpdateMemberCompliance(editingMember.id, {
        vehiclePlate: vehiclePlate.trim().toUpperCase(),
        vehicleMakeModel: vehicleMakeModel.trim() || undefined,
        trailerPlateOrChassis: trailerPlateOrChassis.trim().toUpperCase() || undefined,
        boloExpiry: boloExpiry || undefined,
        insuranceProvider: insuranceProvider.trim() || undefined,
        insurancePolicyNumber: insurancePolicyNumber.trim().toUpperCase() || undefined,
        insuranceType:
          insuranceProvider.trim() || insurancePolicyNumber.trim() ? insuranceType : undefined,
        insuranceExpiry: insuranceExpiry || undefined,
        medicalExpiry: medicalExpiry || undefined,
        highwayClearanceExpiry: highwayClearanceExpiry || undefined,
        insuranceImageDataUrl,
      });
      setEditingMember(null);
    } finally {
      setIsSaving(false);
    }
  };

  const summary = useMemo(() => {
    let plated = 0;
    let validInsured = 0;
    let expiringOrExpired = 0;
    let missingCoverage = 0;

    for (const m of activeMembers) {
      if (m.vehiclePlate?.trim()) plated++;
      const insDays = daysUntil(m.insuranceExpiry);
      const boloDays = daysUntil(m.boloExpiry);
      const licDays = daysUntil(m.licenseExpiry);
      const medDays = daysUntil(m.medicalExpiry);
      const hwyDays = daysUntil(m.highwayClearanceExpiry);

      const hasIns = Boolean(m.insuranceProvider && m.insurancePolicyNumber && m.insuranceExpiry);
      const hasBolo = Boolean(m.boloExpiry);

      if (hasIns && insDays !== null && insDays > 0) {
        validInsured++;
      }
      if (!hasIns || !hasBolo) {
        missingCoverage++;
      }
      if (
        (insDays !== null && insDays <= 30) ||
        (boloDays !== null && boloDays <= 30) ||
        (licDays !== null && licDays <= 30) ||
        (medDays !== null && medDays <= 30) ||
        (hwyDays !== null && hwyDays <= 30)
      ) {
        expiringOrExpired++;
      }
    }

    return {plated, validInsured, expiringOrExpired, missingCoverage};
  }, [activeMembers]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeMembers.filter((m) => {
      const insDays = daysUntil(m.insuranceExpiry);
      const boloDays = daysUntil(m.boloExpiry);
      const licDays = daysUntil(m.licenseExpiry);
      const medDays = daysUntil(m.medicalExpiry);
      const hwyDays = daysUntil(m.highwayClearanceExpiry);
      const needsAttention =
        !m.insurancePolicyNumber ||
        !m.insuranceExpiry ||
        !m.boloExpiry ||
        (insDays !== null && insDays <= 30) ||
        (boloDays !== null && boloDays <= 30) ||
        (licDays !== null && licDays <= 30) ||
        (medDays !== null && medDays <= 30) ||
        (hwyDays !== null && hwyDays <= 30);

      if (filter === 'Attention' && !needsAttention) return false;
      if (filter === 'Insured' && !(m.insurancePolicyNumber && insDays !== null && insDays > 0)) {
        return false;
      }

      if (!q) return true;
      return (
        m.fullName.toLowerCase().includes(q) ||
        m.memberId.toLowerCase().includes(q) ||
        m.vehiclePlate.toLowerCase().includes(q) ||
        (m.vehicleMakeModel?.toLowerCase().includes(q) ?? false) ||
        (m.insuranceProvider?.toLowerCase().includes(q) ?? false) ||
        (m.insurancePolicyNumber?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [activeMembers, filter, searchQuery]);

  const renderDateBadge = (iso?: string) => {
    if (!iso) {
      return <StatusText label={translate(lang, 'missingLabel')} tone="neutral" />;
    }
    const d = daysUntil(iso);
    if (d !== null && d < 0) {
      return (
        <div>
          <StatusText label={translate(lang, 'expiredLabel')} tone="danger" />
          <div className="font-mono text-[11px] text-slate-500">{formatDate(iso)}</div>
        </div>
      );
    }
    if (d !== null && d <= 30) {
      return (
        <div>
          <StatusText label={translate(lang, 'daysLeftLabel', {days: d})} tone="warning" />
          <div className="font-mono text-[11px] text-slate-500">{formatDate(iso)}</div>
        </div>
      );
    }
    return (
      <div>
        <StatusText label={translate(lang, 'validLabel')} tone="success" />
        <div className="font-mono text-[11px] text-slate-500">{formatDate(iso)}</div>
      </div>
    );
  };

  const handleExportCsv = () => {
    downloadCsv(
      `ada-fleet-insurance-${todayIsoDate()}.csv`,
      [
        'Member ID',
        'Driver Name',
        'Vehicle Plate',
        'Make / Model',
        'Trailer / Chassis',
        'Insurance Provider',
        'Policy Number',
        'Coverage Type',
        'Insurance Expiry',
        'Bolo Expiry',
        'Licence Expiry',
        'Medical Fitness Expiry',
        'Highway Clearance Expiry',
      ],
      filtered.map((m) => [
        m.memberId,
        m.fullName,
        m.vehiclePlate,
        m.vehicleMakeModel ?? '',
        m.trailerPlateOrChassis ?? '',
        m.insuranceProvider ?? '',
        m.insurancePolicyNumber ?? '',
        m.insuranceType ?? '',
        m.insuranceExpiry ?? '',
        m.boloExpiry ?? '',
        m.licenseExpiry,
        m.medicalExpiry ?? '',
        m.highwayClearanceExpiry ?? '',
      ])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {translate(lang, 'fleetInsurance')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            {translate(lang, 'fleetSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowNoticeSheet(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <FileText className="h-3.5 w-3.5 text-[#034EA2] dark:text-sky-400" />
            {translate(lang, 'downloadNoticeSheetBtn')}
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            {translate(lang, 'exportCsv')}
          </button>
        </div>
      </div>

      {/* 4 Compliance Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="ada-surface rounded-xl border p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{translate(lang, 'totalVehiclesCard')}</span>
            <Truck className="h-4 w-4 text-[#034EA2] dark:text-sky-400" />
          </div>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {summary.plated}
          </p>
        </div>

        <div className="ada-surface rounded-xl border p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{translate(lang, 'activeInsuredCard')}</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {summary.validInsured}
          </p>
        </div>

        <div className="ada-surface rounded-xl border p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{translate(lang, 'expiringExpiredCard')}</span>
            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {summary.expiringOrExpired}
          </p>
        </div>

        <div className="ada-surface rounded-xl border p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{translate(lang, 'missingCoverageCard')}</span>
            <FileCheck2 className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-red-700 dark:text-red-400">
            {summary.missingCoverage}
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="ada-surface flex flex-col gap-3 rounded-xl border p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={translate(lang, 'membersSearchPlaceholder')}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800">
          {([
            ['All', translate(lang, 'filterAllFleet')],
            ['Attention', translate(lang, 'filterAttention')],
            ['Insured', translate(lang, 'filterInsured')],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                filter === key
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Registry Table */}
      <div className="ada-surface overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-[#EBF2FA] text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                <th className="px-5 py-3 font-semibold">{translate(lang, 'member')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'colVehiclePlate')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'insuranceProvider')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'insuranceExpiry')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'boloExpiry')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'licenceExpiry')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'medicalExpiry')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'highwayClearanceExpiry')}</th>
                <th className="px-5 py-3 text-right font-semibold">{translate(lang, 'actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    {translate(lang, 'noMembersMatch')}
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr
                    key={m.id}
                    className="transition-colors hover:bg-sky-50/50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {m.fullName}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {m.memberId} · {m.phone || translate(lang, 'noPhone')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <VehiclePlateBadge plate={m.vehiclePlate} />
                      {m.vehicleMakeModel && (
                        <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                          {m.vehicleMakeModel}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {m.insuranceProvider ? (
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {m.insuranceProvider}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {m.insurancePolicyNumber || '—'} · {m.insuranceType || 'Third-Party'}
                          </div>
                        </div>
                      ) : (
                        <StatusText label={translate(lang, 'missingLabel')} tone="danger" />
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{renderDateBadge(m.insuranceExpiry)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{renderDateBadge(m.boloExpiry)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{renderDateBadge(m.licenseExpiry)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{renderDateBadge(m.medicalExpiry)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {renderDateBadge(m.highwayClearanceExpiry)}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEditModal(m)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[#0B2C5D] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#034EA2] dark:bg-[#034EA2] dark:hover:bg-sky-600"
                      >
                        {translate(lang, 'updatePolicyBoloBtn')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update Vehicle, Bolo & Insurance Modal */}
      <ModalShell
        isOpen={Boolean(editingMember)}
        title={translate(lang, 'updateFleetComplianceTitle')}
        subtitle={editingMember ? `${editingMember.memberId} · ${editingMember.fullName}` : undefined}
        onClose={() => setEditingMember(null)}
        closeLabel={translate(lang, 'close')}
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleSaveCompliance} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'colVehiclePlate')}
              </label>
              <input
                type="text"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs uppercase text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'vehicleMakeModel')}
              </label>
              <input
                type="text"
                value={vehicleMakeModel}
                onChange={(e) => setVehicleMakeModel(e.target.value)}
                placeholder="e.g. Sinotruk HOWO 371"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'trailerPlateChassis')}
              </label>
              <input
                type="text"
                value={trailerPlateOrChassis}
                onChange={(e) => setTrailerPlateOrChassis(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs uppercase text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'boloExpiry')}
              </label>
              <input
                type="date"
                value={boloExpiry}
                onChange={(e) => setBoloExpiry(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'insuranceProvider')}
              </label>
              <input
                type="text"
                value={insuranceProvider}
                onChange={(e) => setInsuranceProvider(e.target.value)}
                placeholder="Ethiopian Insurance Corp / Nyala / Awash"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'insurancePolicyNo')}
              </label>
              <input
                type="text"
                value={insurancePolicyNumber}
                onChange={(e) => setInsurancePolicyNumber(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs uppercase text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'insuranceTypeLabel')}
              </label>
              <select
                value={insuranceType}
                onChange={(e) => setInsuranceType(e.target.value as InsuranceType)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="Third-Party">{translate(lang, 'coverageThirdParty')}</option>
                <option value="Comprehensive">{translate(lang, 'coverageComprehensive')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'insuranceExpiry')}
              </label>
              <input
                type="date"
                value={insuranceExpiry}
                onChange={(e) => setInsuranceExpiry(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'medicalExpiry')}
              </label>
              <input
                type="date"
                value={medicalExpiry}
                onChange={(e) => setMedicalExpiry(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'highwayClearanceExpiry')}
              </label>
              <input
                type="date"
                value={highwayClearanceExpiry}
                onChange={(e) => setHighwayClearanceExpiry(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'insuranceCertImage')}
              </label>
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <Upload className="h-3.5 w-3.5" />
                  {insuranceImageDataUrl ? translate(lang, 'replace') : translate(lang, 'upload')}
                  <input type="file" accept="image/*" onChange={handleCertUpload} className="hidden" />
                </label>
                {insuranceImageDataUrl && (
                  <>
                    <img
                      src={insuranceImageDataUrl}
                      alt="Insurance policy"
                      className="h-10 w-16 rounded border border-slate-300 object-cover dark:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => setInsuranceImageDataUrl(undefined)}
                      className="text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      {translate(lang, 'clear')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setEditingMember(null)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {translate(lang, 'cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-[#0B2C5D] px-5 py-2 text-xs font-semibold text-white hover:bg-[#034EA2] disabled:opacity-60 dark:bg-[#034EA2] dark:hover:bg-sky-600"
            >
              {isSaving ? translate(lang, 'savingLabel') : translate(lang, 'save')}
            </button>
          </div>
        </form>
      </ModalShell>

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
