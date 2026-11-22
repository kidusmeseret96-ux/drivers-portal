import React, {useMemo, useState} from 'react';
import {Check, Download, Eye, Plus, Printer, Search, Upload} from 'lucide-react';
import {ModalShell} from '../../components/ModalShell';
import {PaymentReceiptModal} from '../../components/PaymentReceiptModal';
import {StatusText} from '../../components/StatusText';
import {
  translate,
  translateMethod,
  translateStatus,
} from '../../i18n/translations';
import type {
  AdaMember,
  AdaPayment,
  AdaSettings,
  PaymentApprovalStatus,
  PaymentMethod,
} from '../../types/ada';
import {
  compressImageToDataUrl,
  createId,
  downloadCsv,
  formatCurrency,
  formatDate,
  nextPaymentReference,
  todayIsoDate,
} from '../../utils/formatters';

interface AdaPaymentsViewProps {
  settings: AdaSettings;
  payments: AdaPayment[];
  members: AdaMember[];
  initialFilter?: 'All' | PaymentApprovalStatus;
  openCreateOnMount?: boolean;
  prefill?: {
    memberId: string;
    amount: number;
    categoryId?: string;
    note?: string;
  } | null;
  onConsumeCreateFlag?: () => void;
  onSavePayment: (payment: AdaPayment) => Promise<void>;
  onUpdateStatus: (paymentId: string, status: PaymentApprovalStatus, reviewerRole?: string) => Promise<void>;
}

const PAYMENT_METHODS: PaymentMethod[] = [
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

export const AdaPaymentsView: React.FC<AdaPaymentsViewProps> = ({
  settings,
  payments,
  members,
  initialFilter = 'All',
  openCreateOnMount = false,
  prefill = null,
  onConsumeCreateFlag,
  onSavePayment,
  onUpdateStatus,
}) => {
  const lang = settings.language;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | PaymentApprovalStatus>(initialFilter);
  const [showModal, setShowModal] = useState(openCreateOnMount);
  const [proofModalPayment, setProofModalPayment] = useState<AdaPayment | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<AdaPayment | null>(null);
  const [reviewingPayment, setReviewingPayment] = useState<AdaPayment | null>(null);
  const [reviewDecision, setReviewDecision] = useState<PaymentApprovalStatus>('Approved');
  const [reviewRole, setReviewRole] = useState(settings.reviewerRoles[0] ?? 'Treasurer');

  const activeMembers = useMemo(
    () => members.filter((m) => !m.deletedAt && m.status === 'Active'),
    [members]
  );
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const activeCategories = useMemo(
    () => settings.incomingCategories.filter((c) => !c.archived),
    [settings.incomingCategories]
  );

  // Sync filter if triggered via header notification shortcut
  React.useEffect(() => {
    setStatusFilter(initialFilter);
  }, [initialFilter]);

  // New payment form state
  const [memberId, setMemberId] = useState(activeMembers[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(activeCategories[0]?.id ?? 'other');
  const [customReason, setCustomReason] = useState('');
  const [amount, setAmount] = useState(activeCategories[0]?.defaultAmount ?? 500);
  const [method, setMethod] = useState<PaymentMethod>('Cash');
  const [date, setDate] = useState(todayIsoDate());
  const [reviewerRole, setReviewerRole] = useState(settings.reviewerRoles[0] ?? 'Treasurer');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [proofImageDataUrl, setProofImageDataUrl] = useState<string | undefined>(undefined);
  const [printInvoiceAfter, setPrintInvoiceAfter] = useState(false);

  React.useEffect(() => {
    if (openCreateOnMount) {
      if (prefill) {
        setMemberId(prefill.memberId);
        setAmount(prefill.amount);
        if (prefill.categoryId) setCategoryId(prefill.categoryId);
        if (prefill.note) setNote(prefill.note);
      } else if (!memberId && activeMembers[0]) {
        setMemberId(activeMembers[0].id);
      }
      setShowModal(true);
      onConsumeCreateFlag?.();
    }
  }, [openCreateOnMount, prefill, onConsumeCreateFlag, memberId, activeMembers]);

  const handleCategorySelect = (nextCatId: string) => {
    setCategoryId(nextCatId);
    if (nextCatId !== 'other') {
      const cat = activeCategories.find((c) => c.id === nextCatId);
      if (cat) setAmount(cat.defaultAmount);
    }
  };

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const {dataUrl} = await compressImageToDataUrl(file, 1000, 0.78);
    setProofImageDataUrl(dataUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenMemberId = memberId || activeMembers[0]?.id;
    if (!chosenMemberId) return;

    const chosenCategory = activeCategories.find((c) => c.id === categoryId);
    const categoryName =
      categoryId === 'other'
        ? customReason.trim() || 'Other'
        : chosenCategory?.name ?? 'Monthly dues';

    const autoRef =
      reference.trim() || nextPaymentReference(payments.map((p) => p.reference));

    const newPayment: AdaPayment = {
      id: createId('pay'),
      reference: autoRef,
      memberId: chosenMemberId,
      categoryId,
      categoryName,
      customReason: categoryId === 'other' ? customReason.trim() : undefined,
      amount: Number(amount) || 0,
      method,
      date,
      reviewerRole,
      status: settings.requirePaymentApproval ? 'Pending' : 'Approved',
      confirmationMessage: method !== 'Cash' ? confirmationMessage.trim() : undefined,
      proofImageDataUrl: method !== 'Cash' ? proofImageDataUrl : undefined,
      note: note.trim() || undefined,
      recordedBy: settings.currentUserName,
      createdAt: new Date().toISOString(),
    };

    await onSavePayment(newPayment);
    const shouldPrint = printInvoiceAfter;
    setShowModal(false);
    setReference('');
    setNote('');
    setCustomReason('');
    setConfirmationMessage('');
    setProofImageDataUrl(undefined);
    setPrintInvoiceAfter(false);
    if (shouldPrint) {
      setReceiptPayment(newPayment);
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return payments
      .filter((p) => {
        if (statusFilter !== 'All' && p.status !== statusFilter) return false;
        if (!q) return true;
        const m = memberMap.get(p.memberId);
        return (
          p.reference.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q) ||
          (m?.fullName.toLowerCase().includes(q) ?? false) ||
          (m?.memberId.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [payments, statusFilter, searchQuery, memberMap]);

  const approvalTotals = useMemo(() => {
    const pending = payments.filter((p) => p.status === 'Pending');
    const approved = payments.filter((p) => p.status === 'Approved');
    const rejected = payments.filter((p) => p.status === 'Rejected');
    return {
      pendingCount: pending.length,
      pendingSum: pending.reduce((s, p) => s + p.amount, 0),
      approvedCount: approved.length,
      approvedSum: approved.reduce((s, p) => s + p.amount, 0),
      rejectedCount: rejected.length,
    };
  }, [payments]);

  const handleExportCsv = () => {
    downloadCsv(
      `ada-payments-${todayIsoDate()}.csv`,
      [
        'Reference',
        'Member ID',
        'Member Name',
        'Category',
        'Method',
        'Date',
        'Amount (ETB)',
        'Approval Status',
        'Reviewer Role',
        'Confirmation Message',
        'Note',
      ],
      filtered.map((p) => {
        const m = memberMap.get(p.memberId);
        return [
          p.reference,
          m?.memberId ?? '',
          m?.fullName ?? '',
          p.categoryName,
          p.method,
          p.date,
          p.amount,
          p.status,
          p.reviewerRole,
          p.confirmationMessage ?? '',
          p.note ?? '',
        ];
      })
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {translate(lang, 'payments')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'paymentsSubtitle')}
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
              if (!memberId && activeMembers[0]) setMemberId(activeMembers[0].id);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2C5D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#034EA2] whitespace-nowrap shrink-0 dark:bg-[#034EA2] dark:hover:bg-sky-600"
          >
            <Plus className="h-3.5 w-3.5 text-amber-300" />
            {translate(lang, 'recordPayment')}
          </button>
        </div>
      </div>

      {/* Approval Totals Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="ada-surface rounded-xl border p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'pendingApprovalCard', {count: approvalTotals.pendingCount})}
          </span>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {formatCurrency(approvalTotals.pendingSum, settings.currency)}
          </p>
        </div>
        <div className="ada-surface rounded-xl border p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'approvedIncomeCard', {count: approvalTotals.approvedCount})}
          </span>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatCurrency(approvalTotals.approvedSum, settings.currency)}
          </p>
        </div>
        <div className="ada-surface rounded-xl border p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'rejectedEntriesCard')}
          </span>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-red-700 dark:text-red-400">
            {approvalTotals.rejectedCount}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="ada-surface flex flex-col gap-3 rounded-xl border p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={translate(lang, 'paymentsSearchPlaceholder')}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800">
          {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === st
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              {st === 'All' ? translate(lang, 'all') : translateStatus(lang, st)}
            </button>
          ))}
        </div>
      </div>

      {/* Payments Table */}
      <div className="ada-surface overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-[#EBF2FA] text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                <th className="px-5 py-3 font-medium">{translate(lang, 'colReference')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'member')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'category')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'method')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'date')}</th>
                <th className="px-4 py-3 text-right font-medium">{translate(lang, 'amount')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'colStatusReviewer')}</th>
                <th className="px-5 py-3 text-right font-medium">{translate(lang, 'actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    {translate(lang, 'noPaymentsMatch')}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const m = memberMap.get(p.memberId);
                  return (
                    <tr
                      key={p.id}
                      className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-3 font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {p.reference}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {m?.fullName ?? translate(lang, 'member')}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {m?.memberId ?? '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {p.categoryName}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {translateMethod(lang, p.method)}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(p.date)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatCurrency(p.amount, settings.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusText
                          label={translateStatus(lang, p.status)}
                          tone={
                            p.status === 'Approved'
                              ? 'success'
                              : p.status === 'Rejected'
                                ? 'danger'
                                : 'warning'
                          }
                        />
                        <div className="text-[11px] text-slate-500">{p.reviewerRole}</div>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {(p.confirmationMessage || p.proofImageDataUrl) && (
                            <button
                              type="button"
                              onClick={() => setProofModalPayment(p)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                            >
                              <Eye className="h-3 w-3" />
                              {translate(lang, 'proof')}
                            </button>
                          )}
                          {p.status === 'Pending' && (
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(p.id, 'Approved', p.reviewerRole)}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                            >
                              <Check className="h-3 w-3" />
                              {translate(lang, 'approve')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setReceiptPayment(p)}
                            className="inline-flex items-center gap-1 rounded-md border border-[#034EA2]/35 bg-[#EFF6FF] px-2 py-1 text-[11px] font-semibold text-[#034EA2] hover:bg-[#DBEAFE] dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                          >
                            <Printer className="h-3 w-3" />
                            {translate(lang, 'receiptBtn')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReviewingPayment(p);
                              setReviewDecision(p.status === 'Pending' ? 'Approved' : p.status);
                              setReviewRole(p.reviewerRole);
                            }}
                            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                          >
                            {translate(lang, 'review')}
                          </button>
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

      {/* Record Payment Modal */}
      <ModalShell
        isOpen={showModal}
        title={translate(lang, 'recordPaymentTitle')}
        onClose={() => setShowModal(false)}
        closeLabel={translate(lang, 'close')}
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {translate(lang, 'activeMemberRequired')}
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
                    {translate(lang, 'paymentCategory')}
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => handleCategorySelect(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {activeCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                    <option value="other">{translate(lang, 'otherCustomReasonOpt')}</option>
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

                {categoryId === 'other' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      {translate(lang, 'customReasonRequired')}
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

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {translate(lang, 'paymentMethod')}
                  </label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm} value={pm}>
                        {translateMethod(lang, pm)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {translate(lang, 'paymentDate')}
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
                    {translate(lang, 'assignedReviewerRole')}
                  </label>
                  <select
                    value={reviewerRole}
                    onChange={(e) => setReviewerRole(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {settings.reviewerRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {translate(lang, 'referenceOptional')}
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder={translate(lang, 'referencePlaceholder')}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                {method !== 'Cash' && (
                  <>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        {translate(lang, 'bankConfirmMsgRequired')}
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={confirmationMessage}
                        onChange={(e) => setConfirmationMessage(e.target.value)}
                        placeholder={translate(lang, 'bankConfirmPlaceholder', {method})}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        {translate(lang, 'confirmScreenshotOpt')}
                      </label>
                      <div className="mt-1 flex items-center gap-3">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          <Upload className="h-3.5 w-3.5" />
                          {translate(lang, 'attachScreenshot')}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleProofUpload}
                            className="hidden"
                          />
                        </label>
                        {proofImageDataUrl && (
                          <span className="text-xs text-emerald-700 dark:text-emerald-400">
                            {translate(lang, 'screenshotAttached')}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {translate(lang, 'note')}
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[#0B2C5D] dark:text-sky-300">
                    <input
                      type="checkbox"
                      checked={printInvoiceAfter}
                      onChange={(e) => setPrintInvoiceAfter(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {translate(lang, 'printInvoiceOptionalCheckbox')}
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  {translate(lang, 'cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#0B2C5D] px-5 py-2 text-xs font-semibold text-white hover:bg-[#034EA2] dark:bg-[#034EA2] dark:hover:bg-sky-600"
                >
                  {translate(lang, 'savePaymentBtn')}
                </button>
              </div>
            </form>
      </ModalShell>

      {/* View Proof Modal */}
      <ModalShell
        isOpen={Boolean(proofModalPayment)}
        title={proofModalPayment ? translate(lang, 'paymentProofTitle', {ref: proofModalPayment.reference}) : ''}
        onClose={() => setProofModalPayment(null)}
        closeLabel={translate(lang, 'close')}
        maxWidthClass="max-w-md"
      >
        {proofModalPayment && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {translate(lang, 'method')}:{' '}
              <strong>{translateMethod(lang, proofModalPayment.method)}</strong> ·{' '}
              {translate(lang, 'amount')}:{' '}
              <strong className="font-mono">
                {formatCurrency(proofModalPayment.amount, settings.currency)}
              </strong>
            </p>
            {proofModalPayment.confirmationMessage && (
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                {proofModalPayment.confirmationMessage}
              </div>
            )}
            {proofModalPayment.note && (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {proofModalPayment.note}
              </p>
            )}
            {proofModalPayment.proofImageDataUrl && (
              <img
                src={proofModalPayment.proofImageDataUrl}
                alt="Payment confirmation screenshot"
                className="max-h-72 w-full rounded-lg border border-slate-200 object-contain dark:border-slate-700"
              />
            )}
          </div>
        )}
      </ModalShell>

      {/* Review Decision Modal */}
      <ModalShell
        isOpen={Boolean(reviewingPayment)}
        title={reviewingPayment ? translate(lang, 'reviewPaymentTitle', {ref: reviewingPayment.reference}) : ''}
        onClose={() => setReviewingPayment(null)}
        closeLabel={translate(lang, 'close')}
        maxWidthClass="max-w-sm"
      >
        {reviewingPayment && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'approvalStatusLabel')}
              </label>
              <select
                value={reviewDecision}
                onChange={(e) => setReviewDecision(e.target.value as PaymentApprovalStatus)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="Pending">{translateStatus(lang, 'Pending')}</option>
                <option value="Approved">{translateStatus(lang, 'Approved')}</option>
                <option value="Rejected">{translateStatus(lang, 'Rejected')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'reviewerRoleLabel')}
              </label>
              <select
                value={reviewRole}
                onChange={(e) => setReviewRole(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {settings.reviewerRoles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReviewingPayment(null)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {translate(lang, 'cancel')}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onUpdateStatus(reviewingPayment.id, reviewDecision, reviewRole);
                  setReviewingPayment(null);
                }}
                className="rounded-lg bg-[#0B2C5D] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#034EA2] dark:bg-[#034EA2]"
              >
                {translate(lang, 'saveDecisionBtn')}
              </button>
            </div>
          </div>
        )}
      </ModalShell>

      {/* Official ETB Payment Receipt Modal */}
      <PaymentReceiptModal
        payment={receiptPayment}
        member={receiptPayment ? memberMap.get(receiptPayment.memberId) : undefined}
        settings={settings}
        onClose={() => setReceiptPayment(null)}
      />
    </div>
  );
};
