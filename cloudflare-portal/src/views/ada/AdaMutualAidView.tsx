import React, {useMemo, useState} from 'react';
import {CheckCircle2, Download, HandHeart, Plus} from 'lucide-react';
import {ModalShell} from '../../components/ModalShell';
import {StatusText} from '../../components/StatusText';
import {translate, translateMethod, translateStatus} from '../../i18n/translations';
import type {
  AdaMember,
  AdaMutualAidPayout,
  AdaSettings,
  MutualAidStatus,
  MutualAidType,
  PaymentMethod,
} from '../../types/ada';
import {
  createId,
  downloadCsv,
  formatCurrency,
  formatDate,
  nextSequentialCode,
  todayIsoDate,
} from '../../utils/formatters';

interface AdaMutualAidViewProps {
  settings: AdaSettings;
  payouts: AdaMutualAidPayout[];
  members: AdaMember[];
  onSavePayout: (payout: AdaMutualAidPayout) => Promise<void>;
  onMarkPaid: (payoutId: string) => Promise<void>;
}

const METHODS: PaymentMethod[] = [
  'Cash',
  'Telebirr',
  'CBE Birr',
  'E-Birr',
  'Abyssinia Bank',
  'Awash Bank',
  'Dashen Bank',
  'Sinqee Bank',
  'Cooperative Bank of Oromia',
];

const AID_TYPES: MutualAidType[] = [
  'Bereavement',
  'Road Accident',
  'Medical Support',
  'Family Support',
];

export const AdaMutualAidView: React.FC<AdaMutualAidViewProps> = ({
  settings,
  payouts,
  members,
  onSavePayout,
  onMarkPaid,
}) => {
  const lang = settings.language;
  const [statusFilter, setStatusFilter] = useState<'All' | MutualAidStatus>('All');
  const [showModal, setShowModal] = useState(false);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const eligibleMembers = useMemo(() => members.filter((m) => !m.deletedAt), [members]);

  // Modal Form State
  const [memberId, setMemberId] = useState(eligibleMembers[0]?.id ?? '');
  const [aidType, setAidType] = useState<MutualAidType>('Bereavement');
  const [beneficiaryName, setBeneficiaryName] = useState(
    eligibleMembers[0]?.spouse?.name || eligibleMembers[0]?.fullName || ''
  );
  const [amount, setAmount] = useState(5000);
  const [method, setMethod] = useState<PaymentMethod>('CBE Birr');
  const [date, setDate] = useState(todayIsoDate());
  const [voucherRef, setVoucherRef] = useState('');
  const [description, setDescription] = useState('');

  const handleMemberChange = (nextId: string) => {
    setMemberId(nextId);
    const m = memberMap.get(nextId);
    if (m) {
      setBeneficiaryName(m.spouse?.name || m.emergencyContactName || m.fullName);
    }
  };

  const translateAidType = (t: MutualAidType) => {
    if (t === 'Bereavement') return translate(lang, 'aidBereavement');
    if (t === 'Road Accident') return translate(lang, 'aidRoadAccident');
    if (t === 'Medical Support') return translate(lang, 'aidMedical');
    return translate(lang, 'aidFamily');
  };

  const summary = useMemo(() => {
    const paidSum = payouts
      .filter((p) => p.status === 'Paid')
      .reduce((s, p) => s + p.amount, 0);
    const pendingSum = payouts
      .filter((p) => p.status === 'Pending')
      .reduce((s, p) => s + p.amount, 0);
    return {
      paidSum,
      pendingSum,
      totalCases: payouts.length,
    };
  }, [payouts]);

  const filtered = useMemo(
    () =>
      payouts
        .filter((p) => statusFilter === 'All' || p.status === statusFilter)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [payouts, statusFilter]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenId = memberId || eligibleMembers[0]?.id;
    if (!chosenId || !beneficiaryName.trim()) return;

    const autoRef =
      voucherRef.trim() ||
      nextSequentialCode(
        'EDR-2026-',
        payouts.map((p) => p.voucherRef),
        4
      );

    await onSavePayout({
      id: createId('aid'),
      voucherRef: autoRef,
      memberId: chosenId,
      aidType,
      beneficiaryName: beneficiaryName.trim(),
      amount: Number(amount) || 0,
      method,
      date,
      status: 'Pending',
      description: description.trim() || translateAidType(aidType),
      recordedBy: settings.currentUserName,
      createdAt: new Date().toISOString(),
    });

    setShowModal(false);
    setVoucherRef('');
    setDescription('');
  };

  const handleExportCsv = () => {
    downloadCsv(
      `ada-edir-mutual-aid-${todayIsoDate()}.csv`,
      [
        'Voucher Ref',
        'Member ID',
        'Member Name',
        'Support Category',
        'Beneficiary',
        'Method',
        'Date',
        'Paid Date',
        'Status',
        'Amount (ETB)',
        'Description',
      ],
      filtered.map((p) => {
        const m = memberMap.get(p.memberId);
        return [
          p.voucherRef,
          m?.memberId ?? '',
          m?.fullName ?? '',
          p.aidType,
          p.beneficiaryName,
          p.method,
          p.date,
          p.paidDate ?? '',
          p.status,
          p.amount,
          p.description,
        ];
      })
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {translate(lang, 'mutualAid')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            {translate(lang, 'mutualAidSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            {translate(lang, 'exportCsv')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!memberId && eligibleMembers[0]) handleMemberChange(eligibleMembers[0].id);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2C5D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#034EA2] whitespace-nowrap shrink-0 dark:bg-[#034EA2] dark:hover:bg-sky-600"
          >
            <Plus className="h-3.5 w-3.5 text-amber-300" />
            {translate(lang, 'recordAidBtn')}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="ada-surface rounded-xl border p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'totalDisbursedCard')}
          </span>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatCurrency(summary.paidSum, settings.currency)}
          </p>
        </div>
        <div className="ada-surface rounded-xl border p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'pendingAidCard')}
          </span>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {formatCurrency(summary.pendingSum, settings.currency)}
          </p>
        </div>
        <div className="ada-surface rounded-xl border p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'aidCasesCard')}
          </span>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {summary.totalCases}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="ada-surface flex items-center justify-between rounded-xl border p-4">
        <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800">
          {(['All', 'Pending', 'Paid'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
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

      {/* Payouts Table */}
      <div className="ada-surface overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-[#EBF2FA] text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                <th className="px-5 py-3 font-semibold">{translate(lang, 'voucherRefLabel')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'member')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'aidTypeLabel')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'beneficiaryLabel')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'method')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'date')}</th>
                <th className="px-4 py-3 text-right font-semibold">{translate(lang, 'amount')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'status')}</th>
                <th className="px-5 py-3 text-right font-semibold">{translate(lang, 'actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    {translate(lang, 'noMutualAidMatch')}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const m = memberMap.get(p.memberId);
                  return (
                    <tr
                      key={p.id}
                      className="transition-colors hover:bg-sky-50/50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-3 font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {p.voucherRef}
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
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {translateAidType(p.aidType)}
                        </div>
                        <div className="text-[11px] text-slate-500">{p.description}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                        {p.beneficiaryName}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {translateMethod(lang, p.method)}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(p.date)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatCurrency(p.amount, settings.currency)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusText
                          label={translateStatus(lang, p.status)}
                          tone={p.status === 'Paid' ? 'success' : 'warning'}
                        />
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {p.status === 'Pending' ? (
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Mutual Aid Modal */}
      <ModalShell
        isOpen={showModal}
        title={translate(lang, 'recordAidTitle')}
        onClose={() => setShowModal(false)}
        closeLabel={translate(lang, 'close')}
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'memberRequired')}
              </label>
              <select
                required
                value={memberId}
                onChange={(e) => handleMemberChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {eligibleMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.memberId} · {m.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'aidTypeLabel')}
              </label>
              <select
                value={aidType}
                onChange={(e) => setAidType(e.target.value as MutualAidType)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {AID_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {translateAidType(t)}
                  </option>
                ))}
              </select>
            </div>

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

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'beneficiaryLabel')}
              </label>
              <input
                type="text"
                required
                value={beneficiaryName}
                onChange={(e) => setBeneficiaryName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'paymentMethod')}
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {translateMethod(lang, pm)}
                  </option>
                ))}
              </select>
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

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'voucherRefLabel')} ({translate(lang, 'referenceOptional')})
              </label>
              <input
                type="text"
                value={voucherRef}
                onChange={(e) => setVoucherRef(e.target.value)}
                placeholder={translate(lang, 'referencePlaceholder')}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'descriptionRequired')}
              </label>
              <textarea
                rows={2}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Reason / family note for mutual-aid committee record..."
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {translate(lang, 'cancel')}
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2C5D] px-5 py-2 text-xs font-semibold text-white hover:bg-[#034EA2] dark:bg-[#034EA2] dark:hover:bg-sky-600"
            >
              <HandHeart className="h-3.5 w-3.5 text-amber-300" />
              {translate(lang, 'recordAidBtn')}
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
};
