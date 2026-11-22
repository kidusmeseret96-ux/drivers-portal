import React, {useMemo, useState} from 'react';
import {
  CheckCircle2,
  Download,
  FileCheck2,
  Plus,
  Printer,
  Wrench,
} from 'lucide-react';
import {ModalShell} from '../../components/ModalShell';
import {
  type OfficialInvoiceData,
  PaymentReceiptModal,
} from '../../components/PaymentReceiptModal';
import {StatusText} from '../../components/StatusText';
import {VehiclePlateBadge} from '../../components/VehiclePlateBadge';
import {translate} from '../../i18n/translations';
import type {
  AdaIncidentAdvance,
  AdaMember,
  AdaSettings,
  IncidentAdvanceKind,
  IncidentAdvanceStatus,
} from '../../types/ada';
import {
  createId,
  downloadCsv,
  formatCurrency,
  formatDate,
  nextSequentialCode,
  todayIsoDate,
} from '../../utils/formatters';

interface AdaIncidentsViewProps {
  settings: AdaSettings;
  incidents: AdaIncidentAdvance[];
  members: AdaMember[];
  onSaveIncident: (incident: AdaIncidentAdvance) => Promise<void>;
  onMarkSettled: (incidentId: string) => Promise<void>;
}

const INCIDENT_KINDS: IncidentAdvanceKind[] = [
  'Fuel Advance',
  'Toll Advance',
  'Roadside Repair',
  'Breakdown',
  'Cargo Incident',
];

export const AdaIncidentsView: React.FC<AdaIncidentsViewProps> = ({
  settings,
  incidents,
  members,
  onSaveIncident,
  onMarkSettled,
}) => {
  const lang = settings.language;
  const [filter, setFilter] = useState<'All' | IncidentAdvanceStatus>('All');
  const [showAdd, setShowAdd] = useState(false);
  const [invoiceTarget, setInvoiceTarget] = useState<OfficialInvoiceData | null>(null);

  const activeMembers = useMemo(
    () => members.filter((m) => !m.deletedAt && m.status === 'Active'),
    [members]
  );
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const [memberId, setMemberId] = useState(activeMembers[0]?.id ?? '');
  const [kind, setKind] = useState<IncidentAdvanceKind>('Fuel Advance');
  const [amount, setAmount] = useState(2500);
  const [date, setDate] = useState(todayIsoDate());
  const [locationOrCorridor, setLocationOrCorridor] = useState('Adama → Modjo Corridor');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<IncidentAdvanceStatus>('Open');
  const [isSaving, setIsSaving] = useState(false);

  const filtered = useMemo(() => {
    const list =
      filter === 'All' ? incidents : incidents.filter((inc) => inc.status === filter);
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [incidents, filter]);

  const summary = useMemo(() => {
    const openRows = incidents.filter((i) => i.status === 'Open');
    const settledRows = incidents.filter((i) => i.status === 'Settled');
    return {
      openCount: openRows.length,
      openAmount: openRows.reduce((s, i) => s + i.amount, 0),
      settledAmount: settledRows.reduce((s, i) => s + i.amount, 0),
    };
  }, [incidents]);

  const openModal = () => {
    setMemberId((prev) => prev || activeMembers[0]?.id || '');
    setDate(todayIsoDate());
    setDescription('');
    setStatus('Open');
    setShowAdd(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetMember = memberMap.get(memberId);
    if (!targetMember) return;
    setIsSaving(true);
    try {
      const refCode = nextSequentialCode(
        `INC-${new Date().getFullYear()}-`,
        incidents.map((i) => i.refCode),
        3
      );
      await onSaveIncident({
        id: createId('inc'),
        refCode,
        memberId,
        vehiclePlate: targetMember.vehiclePlate || '—',
        kind,
        amount: Math.max(0, Number(amount) || 0),
        date,
        locationOrCorridor: locationOrCorridor.trim() || '—',
        description: description.trim() || kind,
        status,
        settledDate: status === 'Settled' ? date : undefined,
        recordedBy: settings.currentUserName,
        createdAt: new Date().toISOString(),
      });
      setShowAdd(false);
    } finally {
      setIsSaving(false);
    }
  };

  const openReceipt = (inc: AdaIncidentAdvance) => {
    const m = memberMap.get(inc.memberId);
    setInvoiceTarget({
      invoiceNo: inc.refCode,
      date: inc.date,
      amount: inc.amount,
      categoryName: inc.kind,
      method: 'Cash',
      status: inc.status === 'Settled' ? 'Paid' : 'Pending',
      partyRole: 'payer',
      partyName: m?.fullName ?? translate(lang, 'member'),
      partySub: `${m?.memberId ?? '—'} · ${inc.vehiclePlate}`,
      recordedBy: inc.recordedBy,
      confirmationMessage: inc.locationOrCorridor,
      note: inc.description,
    });
  };

  const handleExportCsv = () => {
    downloadCsv(
      `ada-incidents-advances-${todayIsoDate()}.csv`,
      [
        'Reference',
        'Date',
        'Member ID',
        'Driver',
        'Plate',
        'Type',
        'Corridor / Location',
        'Amount (ETB)',
        'Status',
        'Settled Date',
        'Description',
      ],
      filtered.map((i) => {
        const m = memberMap.get(i.memberId);
        return [
          i.refCode,
          i.date,
          m?.memberId ?? '',
          m?.fullName ?? '',
          i.vehiclePlate,
          i.kind,
          i.locationOrCorridor,
          i.amount,
          i.status,
          i.settledDate ?? '',
          i.description,
        ];
      })
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {translate(lang, 'incidentsNav')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'incidentsSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            {translate(lang, 'exportCsv')}
          </button>
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2C5D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#034EA2] whitespace-nowrap dark:bg-[#034EA2] dark:hover:bg-sky-600"
          >
            <Plus className="h-3.5 w-3.5 text-amber-300" />
            {translate(lang, 'recordIncidentBtn')}
          </button>
        </div>
      </div>

      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="ada-surface rounded-xl border p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{translate(lang, 'openAdvancesCard')}</span>
            <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {formatCurrency(summary.openAmount, settings.currency)}
          </p>
        </div>

        <div className="ada-surface rounded-xl border p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{translate(lang, 'activeIncidentsCard')}</span>
            <FileCheck2 className="h-4 w-4 text-[#034EA2] dark:text-sky-400" />
          </div>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {summary.openCount}
          </p>
        </div>

        <div className="ada-surface rounded-xl border p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{translate(lang, 'settledAdvancesCard')}</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatCurrency(summary.settledAmount, settings.currency)}
          </p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="ada-surface flex items-center justify-between rounded-xl border p-3">
        <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800">
          {(['All', 'Open', 'Settled'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filter === key
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              {key === 'All' ? translate(lang, 'all') : key}
            </button>
          ))}
        </div>
      </div>

      {/* Records Table */}
      <div className="ada-surface overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-[#EBF2FA] text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                <th className="px-5 py-3 font-semibold">{translate(lang, 'colReference')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'member')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'colVehiclePlate')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'category')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'locationPlace')}</th>
                <th className="px-4 py-3 text-right font-semibold">{translate(lang, 'amount')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'status')}</th>
                <th className="px-5 py-3 text-right font-semibold">{translate(lang, 'actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    —
                  </td>
                </tr>
              ) : (
                filtered.map((inc) => {
                  const m = memberMap.get(inc.memberId);
                  return (
                    <tr
                      key={inc.id}
                      className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {inc.refCode}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {formatDate(inc.date)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {m?.fullName ?? translate(lang, 'member')}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {m?.memberId ?? '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <VehiclePlateBadge plate={inc.vehiclePlate} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {inc.kind}
                        </div>
                        <div className="max-w-xs truncate text-[11px] text-slate-500">
                          {inc.description}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {inc.locationOrCorridor}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {formatCurrency(inc.amount, settings.currency)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusText
                          label={inc.status}
                          tone={inc.status === 'Settled' ? 'success' : 'warning'}
                        />
                        {inc.settledDate && (
                          <div className="font-mono text-[10px] text-slate-500">
                            {formatDate(inc.settledDate)}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openReceipt(inc)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            <Printer className="h-3 w-3 text-[#034EA2] dark:text-sky-400" />
                            {translate(lang, 'receiptBtn')}
                          </button>
                          {inc.status === 'Open' && (
                            <button
                              type="button"
                              onClick={() => onMarkSettled(inc.id)}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {translate(lang, 'markSettledBtn')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Incident / Advance Modal */}
      <ModalShell
        isOpen={showAdd}
        title={translate(lang, 'recordIncidentBtn')}
        onClose={() => setShowAdd(false)}
        closeLabel={translate(lang, 'close')}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'member')}
              </label>
              <select
                required
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {activeMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.memberId} · {m.fullName} ({m.vehiclePlate || translate(lang, 'noPlate')})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'category')}
              </label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as IncidentAdvanceKind)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {INCIDENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'amount')} ({settings.currency})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'date')}
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'status')}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as IncidentAdvanceStatus)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="Open">Open</option>
                <option value="Settled">Settled</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'locationPlace')}
              </label>
              <input
                type="text"
                value={locationOrCorridor}
                onChange={(e) => setLocationOrCorridor(e.target.value)}
                placeholder="e.g. Awash Arba / Modjo Depot"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'colDescription')}
              </label>
              <textarea
                rows={2}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
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

      <PaymentReceiptModal
        invoice={invoiceTarget}
        settings={settings}
        onClose={() => setInvoiceTarget(null)}
      />
    </div>
  );
};
