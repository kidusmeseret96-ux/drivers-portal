import React, {useMemo, useState} from 'react';
import {CheckCircle2, Plus, Printer} from 'lucide-react';
import {ModalShell} from '../../components/ModalShell';
import {type OfficialInvoiceData, PaymentReceiptModal} from '../../components/PaymentReceiptModal';
import {StatusText} from '../../components/StatusText';
import {translate, translateStatus} from '../../i18n/translations';
import type {
  AdaMember,
  AdaPenalty,
  AdaSettings,
  PenaltyStatus,
} from '../../types/ada';
import {
  createId,
  currentMonthIso,
  formatCurrency,
  formatDate,
  todayIsoDate,
} from '../../utils/formatters';

interface AdaPenaltiesViewProps {
  settings: AdaSettings;
  penalties: AdaPenalty[];
  members: AdaMember[];
  onSavePenalty: (penalty: AdaPenalty) => Promise<void>;
  onMarkPaid: (penaltyId: string) => Promise<void>;
}

export const AdaPenaltiesView: React.FC<AdaPenaltiesViewProps> = ({
  settings,
  penalties,
  members,
  onSavePenalty,
  onMarkPaid,
}) => {
  const lang = settings.language;
  const [statusFilter, setStatusFilter] = useState<'All' | PenaltyStatus>('All');
  const [showModal, setShowModal] = useState(false);

  const activeMembers = useMemo(
    () => members.filter((m) => !m.deletedAt && m.status === 'Active'),
    [members]
  );
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const presets = useMemo(
    () => settings.penaltyPresets.filter((p) => !p.archived),
    [settings.penaltyPresets]
  );

  const [memberId, setMemberId] = useState(activeMembers[0]?.id ?? '');
  const [presetId, setPresetId] = useState(presets[0]?.id ?? 'custom');
  const [customReason, setCustomReason] = useState('');
  const [amount, setAmount] = useState(presets[0]?.defaultAmount ?? 100);
  const [date, setDate] = useState(todayIsoDate());
  const [note, setNote] = useState('');
  const [printInvoiceAfter, setPrintInvoiceAfter] = useState(false);
  const [invoiceDoc, setInvoiceDoc] = useState<OfficialInvoiceData | null>(null);

  const thisMonth = currentMonthIso();

  const summary = useMemo(() => {
    const unpaid = penalties.filter((p) => p.status === 'Unpaid');
    const settledThisMonth = penalties.filter(
      (p) => p.status === 'Paid' && (p.paidDate ?? p.date).startsWith(thisMonth)
    );
    return {
      openCount: unpaid.length,
      outstandingAmount: unpaid.reduce((s, p) => s + p.amount, 0),
      settledMonthAmount: settledThisMonth.reduce((s, p) => s + p.amount, 0),
    };
  }, [penalties, thisMonth]);

  const filtered = useMemo(
    () =>
      penalties
        .filter((p) => statusFilter === 'All' || p.status === statusFilter)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [penalties, statusFilter]
  );

  const handlePresetChange = (id: string) => {
    setPresetId(id);
    if (id !== 'custom') {
      const found = presets.find((p) => p.id === id);
      if (found) setAmount(found.defaultAmount);
    }
  };

  const buildPenaltyInvoice = (p: AdaPenalty): OfficialInvoiceData => {
    const m = memberMap.get(p.memberId);
    return {
      invoiceNo: `INV-${p.id.slice(-8).toUpperCase()}`,
      date: p.paidDate ?? p.date,
      amount: p.amount,
      categoryName: `${translate(lang, 'penalties')}: ${p.reason}`,
      method: 'Cash',
      status: p.status,
      partyRole: 'payer',
      partyName: m?.fullName ?? translate(lang, 'member'),
      partySub: `${m?.memberId ?? '—'}${m?.vehiclePlate ? ` · ${m.vehiclePlate}` : ''}`,
      recordedBy: p.recordedBy,
      note: p.note,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenMember = memberId || activeMembers[0]?.id;
    if (!chosenMember) return;
    const isCustom = presetId === 'custom';
    const reason = isCustom
      ? customReason.trim() || 'Custom violation'
      : presets.find((p) => p.id === presetId)?.name ?? 'Violation';

    const newPenalty: AdaPenalty = {
      id: createId('pnl'),
      memberId: chosenMember,
      reason,
      isCustom,
      amount: Number(amount) || 0,
      date,
      status: 'Unpaid',
      recordedBy: settings.currentUserName,
      note: note.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    await onSavePenalty(newPenalty);
    const shouldPrint = printInvoiceAfter;
    setShowModal(false);
    setCustomReason('');
    setNote('');
    setPrintInvoiceAfter(false);
    if (shouldPrint) {
      setInvoiceDoc(buildPenaltyInvoice(newPenalty));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {translate(lang, 'penalties')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'penaltiesSubtitle')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!memberId && activeMembers[0]) setMemberId(activeMembers[0].id);
            setShowModal(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2C5D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#034EA2] whitespace-nowrap shrink-0 dark:bg-[#034EA2] dark:hover:bg-sky-600"
        >
          <Plus className="h-3.5 w-3.5 text-amber-300" />
          {translate(lang, 'recordPenaltyBtn')}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="ada-surface rounded-xl border p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'openPenaltiesCard')}
          </span>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {summary.openCount}
          </p>
        </div>
        <div className="ada-surface rounded-xl border p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'outstandingAmountCard')}
          </span>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-red-700 dark:text-red-400">
            {formatCurrency(summary.outstandingAmount, settings.currency)}
          </p>
        </div>
        <div className="ada-surface rounded-xl border p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'settledThisMonthCard')}
          </span>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatCurrency(summary.settledMonthAmount, settings.currency)}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="ada-surface flex items-center justify-between rounded-xl border p-4">
        <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800">
          {(['All', 'Unpaid', 'Paid'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {st === 'All' ? translate(lang, 'all') : translateStatus(lang, st)}
            </button>
          ))}
        </div>
      </div>

      {/* Penalties Table */}
      <div className="ada-surface overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-[#EBF2FA] text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                <th className="px-5 py-3 font-medium">{translate(lang, 'member')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'colViolationReason')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'date')}</th>
                <th className="px-4 py-3 text-right font-medium">{translate(lang, 'amount')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'status')}</th>
                <th className="px-5 py-3 text-right font-medium">{translate(lang, 'actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    {translate(lang, 'noPenaltiesMatch')}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const m = memberMap.get(p.memberId);
                  return (
                    <tr key={p.id}>
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {m?.fullName ?? translate(lang, 'member')}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {m?.memberId ?? '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {p.reason}
                        </div>
                        {p.note && <div className="text-[11px] text-slate-500">{p.note}</div>}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {formatDate(p.date)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {formatCurrency(p.amount, settings.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusText
                          label={translateStatus(lang, p.status)}
                          tone={p.status === 'Paid' ? 'success' : 'danger'}
                        />
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setInvoiceDoc(buildPenaltyInvoice(p))}
                            className="inline-flex items-center gap-1 rounded-md border border-[#034EA2]/35 bg-[#EFF6FF] px-2 py-1 text-[11px] font-semibold text-[#034EA2] hover:bg-[#DBEAFE] dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                          >
                            <Printer className="h-3 w-3" />
                            {translate(lang, 'receiptBtn')}
                          </button>
                          {p.status === 'Unpaid' ? (
                            <button
                              type="button"
                              onClick={() => onMarkPaid(p.id)}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {translate(lang, 'markPaidBtn')}
                            </button>
                          ) : (
                            <span className="font-mono text-[11px] text-slate-500">
                              {translate(lang, 'paidOnDate', {date: formatDate(p.paidDate)})}
                            </span>
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

      {/* Record Penalty Modal */}
      <ModalShell
        isOpen={showModal}
        title={translate(lang, 'recordPenaltyTitle')}
        onClose={() => setShowModal(false)}
        closeLabel={translate(lang, 'close')}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(lang, 'memberRequired')}
                </label>
                <select
                  required
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  {activeMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.memberId} · {m.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(lang, 'violationReasonLabel')}
                </label>
                <select
                  value={presetId}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatCurrency(p.defaultAmount, settings.currency)})
                    </option>
                  ))}
                  <option value="custom">{translate(lang, 'customViolationOpt')}</option>
                </select>
              </div>

              {presetId === 'custom' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {translate(lang, 'describeViolationRequired')}
                  </label>
                  <input
                    type="text"
                    required
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {translate(lang, 'amount')} ({settings.currency}) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value) || 0)}
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
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(lang, 'notesOptional')}
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[#0B2C5D] dark:text-sky-300">
                <input
                  type="checkbox"
                  checked={printInvoiceAfter}
                  onChange={(e) => setPrintInvoiceAfter(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {translate(lang, 'printInvoiceOptionalCheckbox')}
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  {translate(lang, 'cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#0B2C5D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#034EA2] dark:bg-[#034EA2]"
                >
                  {translate(lang, 'savePenaltyBtn')}
                </button>
              </div>
            </form>
      </ModalShell>

      <PaymentReceiptModal
        invoice={invoiceDoc}
        settings={settings}
        onClose={() => setInvoiceDoc(null)}
      />
    </div>
  );
};
