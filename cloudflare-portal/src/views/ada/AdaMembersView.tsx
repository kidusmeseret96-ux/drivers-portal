import React, {useMemo, useState} from 'react';
import {Check, Download, IdCard, KeyRound, Plus, Printer, Search, Trash2, Upload, X} from 'lucide-react';
import {AddMemberModal} from '../../components/AddMemberModal';
import {MemberComplianceFormModal} from '../../components/MemberComplianceFormModal';
import {MemberIdCardModal} from '../../components/MemberIdCardModal';
import {ModalShell} from '../../components/ModalShell';
import {StatusText} from '../../components/StatusText';
import {VehiclePlateBadge} from '../../components/VehiclePlateBadge';
import {
  translate,
  translateRole,
  translateStatus,
} from '../../i18n/translations';
import {
  type AdaMember,
  type AdaPayment,
  type AdaPenalty,
  type AdaSettings,
  DEFAULT_MEMBER_ROLES,
  type MemberRole,
  type MemberStatus,
} from '../../types/ada';
import {getExpiringDriverLicences} from '../../utils/adaCalculations';
import {
  createId,
  downloadCsv,
  formatDate,
  nextSequentialCode,
  parseCsvText,
  todayIsoDate,
} from '../../utils/formatters';
import {downloadInvertedIdCardImage} from '../../utils/idCardExport';

interface AdaMembersViewProps {
  settings: AdaSettings;
  members: AdaMember[];
  payments?: AdaPayment[];
  penalties?: AdaPenalty[];
  onAddMember: (member: AdaMember) => Promise<void>;
  onBulkAddMembers: (members: AdaMember[]) => Promise<void>;
  onArchiveMember: (memberId: string) => Promise<void>;
  onUpdateMemberRole?: (memberId: string, nextRole: string) => Promise<void>;
  onResetPortalPin?: (memberId: string) => Promise<void>;
}

export const AdaMembersView: React.FC<AdaMembersViewProps> = ({
  settings,
  members,
  payments = [],
  penalties = [],
  onAddMember,
  onBulkAddMembers,
  onArchiveMember,
  onUpdateMemberRole,
  onResetPortalPin,
}) => {
  const lang = settings.language;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | MemberStatus>('All');
  const [roleFilter, setRoleFilter] = useState<'All' | MemberRole>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvNotice, setCsvNotice] = useState<string | null>(null);
  const [viewingMemberId, setViewingMemberId] = useState<string | null>(null);
  const viewingMember = useMemo(
    () => (viewingMemberId ? members.find((m) => m.id === viewingMemberId) ?? null : null),
    [members, viewingMemberId]
  );
  const setViewingMember = (m: AdaMember | null) => setViewingMemberId(m ? m.id : null);
  const [complianceMember, setComplianceMember] = useState<AdaMember | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmResetPinId, setConfirmResetPinId] = useState<string | null>(null);
  const [resetPinDoneId, setResetPinDoneId] = useState<string | null>(null);
  const [resettingPinId, setResettingPinId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const handlePrintIdImage = async (member: AdaMember) => {
    setPrintingId(member.id);
    try {
      await downloadInvertedIdCardImage(member, settings);
    } finally {
      setPrintingId(null);
    }
  };

  const handleSaveNewMember = async (member: AdaMember, openComplianceAfter?: boolean) => {
    await onAddMember(member);
    if (openComplianceAfter) {
      setComplianceMember(member);
    } else {
      setViewingMember(member);
    }
  };

  const activeDirectoryMembers = useMemo(
    () => members.filter((m) => !m.deletedAt),
    [members]
  );

  const platedCount = useMemo(
    () => activeDirectoryMembers.filter((m) => Boolean(m.vehiclePlate?.trim())).length,
    [activeDirectoryMembers]
  );

  const expiringCount = useMemo(
    () => getExpiringDriverLicences(members, 30).length,
    [members]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qNorm = q.replace(/[\s-]+/g, '');
    return activeDirectoryMembers
      .filter((m) => {
        if (statusFilter !== 'All' && m.status !== statusFilter) return false;
        if (roleFilter !== 'All' && m.role !== roleFilter) return false;
        if (!q) return true;
        return (
          m.fullName.toLowerCase().includes(q) ||
          m.memberId.toLowerCase().includes(q) ||
          m.phone.toLowerCase().includes(q) ||
          m.vehiclePlate.toLowerCase().includes(q) ||
          (qNorm.length > 0 &&
            (m.memberId.toLowerCase().replace(/[\s-]+/g, '').includes(qNorm) ||
              m.vehiclePlate.toLowerCase().replace(/[\s-]+/g, '').includes(qNorm)))
        );
      })
      .sort((a, b) => a.memberId.localeCompare(b.memberId));
  }, [activeDirectoryMembers, statusFilter, roleFilter, searchQuery]);

  const handleExportCsv = () => {
    downloadCsv(
      `ada-members-${todayIsoDate()}.csv`,
      [
        'Member ID',
        'Full Name',
        'Phone',
        'Gender',
        'Date of Birth',
        'Age',
        'Blood Type',
        'Vehicle Plate',
        'Role',
        'Employer',
        'Location',
        'Join Date',
        'Status',
        'Emergency Contact Name',
        'Emergency Contact Phone',
        'Licence Number',
        'Licence Expiry',
      ],
      filtered.map((m) => [
        m.memberId,
        m.fullName,
        m.phone,
        m.gender,
        m.dateOfBirth,
        m.age,
        m.bloodType,
        m.vehiclePlate,
        m.role,
        m.employer,
        m.location,
        m.joinDate,
        m.status,
        m.emergencyContactName,
        m.emergencyContactPhone,
        m.licenseNumber,
        m.licenseExpiry,
      ])
    );
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ''));
    reader.readAsText(file);
  };

  const handleImportCsv = async () => {
    const {headers, rows} = parseCsvText(csvText);
    if (headers.length === 0 || rows.length === 0) {
      setCsvNotice(translate(lang, 'csvErrorEmpty'));
      return;
    }

    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const findCol = (aliases: string[]) =>
      headers.findIndex((h) => aliases.some((a) => norm(h).includes(a)));

    const nameIdx = findCol(['fullname', 'name', 'membername']);
    if (nameIdx === -1) {
      setCsvNotice(translate(lang, 'csvErrorNoName'));
      return;
    }

    const phoneIdx = findCol(['phone', 'mobile', 'tel']);
    const plateIdx = findCol(['plate', 'vehicleplate']);
    const roleIdx = findCol(['role', 'position']);
    const joinIdx = findCol(['joindate', 'joined']);
    const statusIdx = findCol(['status']);
    const employerIdx = findCol(['employer', 'company']);
    const locationIdx = findCol(['location', 'address', 'place']);
    const emNameIdx = findCol(['emergencycontactname', 'emergencyname']);
    const emPhoneIdx = findCol(['emergencycontactphone', 'emergencyphone']);

    const existingCodes = members.map((m) => m.memberId);
    const imported: AdaMember[] = [];

    for (const row of rows) {
      const fullName = (row[nameIdx] ?? '').trim();
      if (!fullName) continue;
      const memberId = nextSequentialCode(
        'ADA-',
        [...existingCodes, ...imported.map((i) => i.memberId)],
        4
      );
      const rawStatus = statusIdx >= 0 ? row[statusIdx]?.trim() : 'Active';
      const status: MemberStatus =
        rawStatus === 'Removed' || rawStatus === 'Deceased' ? rawStatus : 'Active';
      const rawRole = (roleIdx >= 0 ? row[roleIdx]?.trim() : 'Member') || 'Member';
      const roleNormalized = rawRole.toLowerCase();
      const configuredRoles =
        settings.memberRoles && settings.memberRoles.length > 0
          ? settings.memberRoles
          : [...DEFAULT_MEMBER_ROLES];
      const matchedConfigured = configuredRoles.find(
        (r) => r.toLowerCase() === roleNormalized
      );
      const role: MemberRole =
        matchedConfigured ??
        (roleNormalized === 'vice-manager' ? 'Vice manager' : 'Member');

      imported.push({
        id: createId('mem'),
        memberId,
        fullName,
        phone: phoneIdx >= 0 ? row[phoneIdx]?.trim() ?? '' : '',
        gender: 'Male',
        dateOfBirth: '',
        age: '',
        bloodType: 'O+',
        vehiclePlate: plateIdx >= 0 ? (row[plateIdx]?.trim() ?? '').toUpperCase() : '',
        role,
        employer: employerIdx >= 0 ? row[employerIdx]?.trim() ?? '' : '',
        location: locationIdx >= 0 ? row[locationIdx]?.trim() ?? '' : '',
        joinDate: joinIdx >= 0 && row[joinIdx]?.trim() ? row[joinIdx].trim() : todayIsoDate(),
        status,
        emergencyContactName: emNameIdx >= 0 ? row[emNameIdx]?.trim() ?? '' : '',
        emergencyContactPhone: emPhoneIdx >= 0 ? row[emPhoneIdx]?.trim() ?? '' : '',
        licenseNumber: '',
        licenseExpiry: '',
        isMarried: false,
        children: [],
        createdAt: new Date().toISOString(),
      });
    }

    if (imported.length === 0) {
      setCsvNotice(translate(lang, 'csvErrorNoRows'));
      return;
    }

    await onBulkAddMembers(imported);
    setCsvText('');
    setCsvNotice(null);
    setShowCsvModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {translate(lang, 'members')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'membersSubtitle', {count: activeDirectoryMembers.length})} ·{' '}
            {translate(lang, 'platedTrucksLabel', {count: platedCount})} ·{' '}
            <span className={expiringCount > 0 ? 'text-amber-700 dark:text-amber-400 font-medium' : ''}>
              {translate(lang, 'expiringSoonLabel', {count: expiringCount})}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setCsvNotice(null);
              setShowCsvModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Upload className="h-3.5 w-3.5" />
            {translate(lang, 'importCsv')}
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            {translate(lang, 'exportCsv')}
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2C5D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#034EA2] whitespace-nowrap shrink-0 dark:bg-[#034EA2] dark:hover:bg-sky-600"
          >
            <Plus className="h-3.5 w-3.5 text-amber-300" />
            {translate(lang, 'addMember')}
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="ada-surface flex flex-col gap-3 rounded-xl border p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-lg">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="members-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={translate(lang, 'membersSearchPlaceholder')}
            placeholder={translate(lang, 'membersSearchPlaceholder')}
            className={`w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 ${
              searchQuery ? 'pr-8' : 'pr-3'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label={translate(lang, 'clear')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(['All', 'Active', 'Removed', 'Deceased'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                {st === 'All' ? translate(lang, 'all') : translateStatus(lang, st)}
              </button>
            ))}
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'All' | MemberRole)}
            aria-label={translate(lang, 'role')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="All">{translate(lang, 'allRoles')}</option>
            {(settings.memberRoles && settings.memberRoles.length > 0
              ? settings.memberRoles
              : [...DEFAULT_MEMBER_ROLES]
            ).map((r) => (
              <option key={r} value={r}>
                {translateRole(lang, r)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Directory Table */}
      <div className="ada-surface overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-[#EBF2FA] text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                <th className="px-5 py-3 font-medium">{translate(lang, 'colMemberId')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'phone')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'colVehiclePlate')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'role')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'colJoinDate')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'status')}</th>
                <th className="px-5 py-3 text-right font-medium">{translate(lang, 'actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    {translate(lang, 'noMembersMatch')}
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr
                    key={m.id}
                    className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => setViewingMember(m)}
                        className="text-left hover:underline"
                      >
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {m.fullName}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">{m.memberId}</div>
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {m.phone || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <VehiclePlateBadge plate={m.vehiclePlate} />
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {translateRole(lang, m.role)}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatDate(m.joinDate)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusText
                        label={translateStatus(lang, m.status)}
                        tone={
                          m.status === 'Active'
                            ? 'success'
                            : m.status === 'Deceased'
                              ? 'neutral'
                              : 'danger'
                        }
                      />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setViewingMember(m)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <IdCard className="h-3 w-3" />
                          {translate(lang, 'recordIdBtn')}
                        </button>
                        <button
                          type="button"
                          disabled={printingId === m.id}
                          onClick={() => handlePrintIdImage(m)}
                          className="inline-flex items-center gap-1 rounded-md border border-[#034EA2]/40 bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-semibold text-[#034EA2] hover:bg-[#DBEAFE] disabled:opacity-60 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                        >
                          <Printer className="h-3 w-3" />
                          {translate(lang, 'printIdBtn')}
                        </button>
                        {onResetPortalPin && (
                          confirmResetPinId === m.id ? (
                            <div className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 dark:border-amber-800 dark:bg-amber-950/40">
                              <span className="px-1 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                                0000?
                              </span>
                              <button
                                type="button"
                                disabled={resettingPinId === m.id}
                                onClick={async () => {
                                  setResettingPinId(m.id);
                                  try {
                                    await onResetPortalPin(m.id);
                                    setConfirmResetPinId(null);
                                    setResetPinDoneId(m.id);
                                    setTimeout(() => {
                                      setResetPinDoneId((prev) => (prev === m.id ? null : prev));
                                    }, 3000);
                                  } finally {
                                    setResettingPinId(null);
                                  }
                                }}
                                className="rounded bg-[#0B2C5D] px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-[#034EA2] disabled:opacity-60"
                              >
                                {translate(lang, 'confirm')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmResetPinId(null)}
                                className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                              >
                                {translate(lang, 'cancel')}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDeleteId(null);
                                setConfirmResetPinId(m.id);
                              }}
                              title="Reset this member's portal PIN back to 0000"
                              className="inline-flex items-center gap-1 rounded-md border border-amber-300/80 bg-amber-50/70 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/60"
                            >
                              {resetPinDoneId === m.id ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                  <span>0000</span>
                                </>
                              ) : (
                                <>
                                  <KeyRound className="h-3 w-3" />
                                  <span>Reset PIN</span>
                                </>
                              )}
                            </button>
                          )
                        )}
                        {confirmDeleteId === m.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                await onArchiveMember(m.id);
                                setConfirmDeleteId(null);
                              }}
                              className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
                            >
                              {translate(lang, 'confirm')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:text-slate-300"
                            >
                              {translate(lang, 'cancel')}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmResetPinId(null);
                              setConfirmDeleteId(m.id);
                            }}
                            aria-label={`${translate(lang, 'delete')} ${m.fullName}`}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400"
                          >
                            <Trash2 className="h-3 w-3" />
                            {translate(lang, 'delete')}
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

      {/* Add Member Drawer */}
      {showAddModal && (
        <AddMemberModal
          isOpen={showAddModal}
          language={lang}
          settings={settings}
          existingMembers={members}
          onClose={() => setShowAddModal(false)}
          onSaveMember={handleSaveNewMember}
        />
      )}

      {/* Member Record & Two-Sided ID Card Modal */}
      <MemberIdCardModal
        member={viewingMember}
        allMembers={members}
        payments={payments}
        penalties={penalties}
        settings={settings}
        onChangeMemberRole={onUpdateMemberRole}
        onResetPortalPin={onResetPortalPin}
        onClose={() => setViewingMember(null)}
      />

      {/* Printable New Member Compliance Form Modal */}
      <MemberComplianceFormModal
        isOpen={Boolean(complianceMember)}
        memberData={complianceMember}
        settings={settings}
        onClose={() => setComplianceMember(null)}
      />

      {/* CSV Import Modal */}
      <ModalShell
        isOpen={showCsvModal}
        title={translate(lang, 'csvImportTitle')}
        onClose={() => setShowCsvModal(false)}
        closeLabel={translate(lang, 'close')}
        maxWidthClass="max-w-xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {translate(lang, 'csvImportHelp')}
          </p>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Upload className="h-3.5 w-3.5" />
            {translate(lang, 'chooseCsvFile')}
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvFileUpload}
              className="hidden"
            />
          </label>
          <textarea
            rows={7}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={'name,phone,plate,role,join date,status,employer,location\nAbebe Kebede,+251911223344,AA-3-B12004,Member,2026-11-10,Active,Addis Fleet,Bole'}
            className="w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-[11px] text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          {csvNotice && <p className="text-xs text-red-600 dark:text-red-400">{csvNotice}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCsvModal(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {translate(lang, 'cancel')}
            </button>
            <button
              type="button"
              onClick={handleImportCsv}
              className="rounded-lg bg-[#0B2C5D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#034EA2] dark:bg-[#034EA2]"
            >
              {translate(lang, 'importMembersBtn')}
            </button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
};
