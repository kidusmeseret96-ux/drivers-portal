import React, {useMemo, useState} from 'react';
import {Download, Plus, Printer} from 'lucide-react';
import {ModalShell} from '../../components/ModalShell';
import {type OfficialInvoiceData, PaymentReceiptModal} from '../../components/PaymentReceiptModal';
import {
  translate,
  translateMethod,
  translateStatus,
} from '../../i18n/translations';
import type {
  AdaExpense,
  AdaMember,
  AdaPayment,
  AdaSettings,
  PaymentMethod,
} from '../../types/ada';
import {
  createId,
  currentMonthIso,
  downloadCsv,
  formatCurrency,
  formatDate,
  todayIsoDate,
} from '../../utils/formatters';

interface AdaLedgerViewProps {
  settings: AdaSettings;
  payments: AdaPayment[];
  expenses: AdaExpense[];
  members: AdaMember[];
  onSaveExpense: (expense: AdaExpense) => Promise<void>;
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

export const AdaLedgerView: React.FC<AdaLedgerViewProps> = ({
  settings,
  payments,
  expenses,
  members,
  onSaveExpense,
}) => {
  const lang = settings.language;
  const [typeFilter, setTypeFilter] = useState<'All' | 'Income' | 'Expense'>('All');
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const outgoingCategories = useMemo(
    () => settings.outgoingCategories.filter((c) => !c.archived),
    [settings.outgoingCategories]
  );

  const [categoryId, setCategoryId] = useState(outgoingCategories[0]?.id ?? 'other');
  const [customReason, setCustomReason] = useState('');
  const [amount, setAmount] = useState(outgoingCategories[0]?.defaultAmount ?? 500);
  const [method, setMethod] = useState<PaymentMethod>('Cash');
  const [date, setDate] = useState(todayIsoDate());
  const [description, setDescription] = useState('');
  const [printInvoiceAfter, setPrintInvoiceAfter] = useState(false);
  const [invoiceDoc, setInvoiceDoc] = useState<OfficialInvoiceData | null>(null);

  const thisMonth = currentMonthIso();

  const combinedRows = useMemo(() => {
    const incomeEntries = payments.map((p) => {
      const m = memberMap.get(p.memberId);
      return {
        id: `inc_${p.id}`,
        type: 'Income' as const,
        description: `${m?.fullName ?? translate(lang, 'member')} (${m?.memberId ?? '—'}) · ${p.reference} [${translateStatus(lang, p.status)}]`,
        category: p.categoryName,
        method: p.method,
        date: p.date,
        recorder: p.recordedBy,
        amount: p.amount,
        approved: p.status === 'Approved',
        invoice: {
          invoiceNo: p.reference,
          date: p.date,
          amount: p.amount,
          categoryName: p.categoryName,
          method: p.method,
          status: p.status,
          partyRole: 'payer' as const,
          partyName: m?.fullName ?? translate(lang, 'member'),
          partySub: `${m?.memberId ?? '—'}${m?.vehiclePlate ? ` · ${m.vehiclePlate}` : ''}`,
          recordedBy: p.recordedBy,
          reviewerRole: p.reviewerRole,
          confirmationMessage: p.confirmationMessage,
          note: p.note,
        },
      };
    });

    const expenseEntries = expenses.map((e) => ({
      id: `exp_${e.id}`,
      type: 'Expense' as const,
      description: e.description,
      category: e.categoryName,
      method: e.method,
      date: e.date,
      recorder: e.recordedBy,
      amount: e.amount,
      approved: true,
      invoice: {
        invoiceNo: `INV-${e.id.slice(-8).toUpperCase()}`,
        date: e.date,
        amount: e.amount,
        categoryName: e.categoryName,
        method: e.method,
        status: 'Paid',
        partyRole: 'vendor' as const,
        partyName: e.description,
        partySub: e.categoryName,
        recordedBy: e.recordedBy,
      },
    }));

    return [...incomeEntries, ...expenseEntries]
      .filter((row) => typeFilter === 'All' || row.type === typeFilter)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [payments, expenses, memberMap, typeFilter, lang]);

  const monthlySummary = useMemo(() => {
    const monthlyIncome = payments
      .filter((p) => p.status === 'Approved' && p.date.startsWith(thisMonth))
      .reduce((s, p) => s + p.amount, 0);
    const monthlyExpenses = expenses
      .filter((e) => e.date.startsWith(thisMonth))
      .reduce((s, e) => s + e.amount, 0);
    return {
      monthlyIncome,
      monthlyExpenses,
      netBalance: monthlyIncome - monthlyExpenses,
    };
  }, [payments, expenses, thisMonth]);

  const handleCategoryChange = (id: string) => {
    setCategoryId(id);
    if (id !== 'other') {
      const cat = outgoingCategories.find((c) => c.id === id);
      if (cat) setAmount(cat.defaultAmount);
    }
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const isOther = categoryId === 'other';
    const categoryName = isOther
      ? customReason.trim() || 'Other Expense'
      : outgoingCategories.find((c) => c.id === categoryId)?.name ?? 'Expense';

    const newExpense: AdaExpense = {
      id: createId('exp'),
      categoryId,
      categoryName,
      customReason: isOther ? customReason.trim() : undefined,
      amount: Number(amount) || 0,
      method,
      date,
      description: description.trim() || categoryName,
      recordedBy: settings.currentUserName,
      createdAt: new Date().toISOString(),
    };

    await onSaveExpense(newExpense);
    const shouldPrint = printInvoiceAfter;
    setShowExpenseModal(false);
    setCustomReason('');
    setDescription('');
    setPrintInvoiceAfter(false);
    if (shouldPrint) {
      setInvoiceDoc({
        invoiceNo: `INV-${newExpense.id.slice(-8).toUpperCase()}`,
        date: newExpense.date,
        amount: newExpense.amount,
        categoryName: newExpense.categoryName,
        method: newExpense.method,
        status: 'Paid',
        partyRole: 'vendor',
        partyName: newExpense.description,
        partySub: newExpense.categoryName,
        recordedBy: newExpense.recordedBy,
      });
    }
  };

  const handleExportCsv = () => {
    downloadCsv(
      `ada-office-ledger-${todayIsoDate()}.csv`,
      ['Type', 'Description', 'Category', 'Method', 'Date', 'Recorder', 'Amount (ETB)'],
      combinedRows.map((r) => [
        r.type,
        r.description,
        r.category,
        r.method,
        r.date,
        r.recorder,
        r.type === 'Expense' ? -r.amount : r.amount,
      ])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {translate(lang, 'ledger')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'ledgerSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            {translate(lang, 'exportLedgerCsv')}
          </button>
          <button
            type="button"
            onClick={() => setShowExpenseModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2C5D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#034EA2] whitespace-nowrap shrink-0 dark:bg-[#034EA2] dark:hover:bg-sky-600"
          >
            <Plus className="h-3.5 w-3.5 text-amber-300" />
            {translate(lang, 'recordExpenseBtn')}
          </button>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="ada-surface rounded-xl border p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'monthlyIncomeApprovedCard')}
          </span>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatCurrency(monthlySummary.monthlyIncome, settings.currency)}
          </p>
        </div>
        <div className="ada-surface rounded-xl border p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'monthlyExpensesCard')}
          </span>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-red-700 dark:text-red-400">
            {formatCurrency(monthlySummary.monthlyExpenses, settings.currency)}
          </p>
        </div>
        <div className="ada-surface rounded-xl border p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'netOperatingBalanceCard')}
          </span>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatCurrency(monthlySummary.netBalance, settings.currency)}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="ada-surface flex items-center justify-between rounded-xl border p-4">
        <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800">
          {(['All', 'Income', 'Expense'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === t
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t === 'All'
                ? translate(lang, 'allEntriesFilter')
                : t === 'Income'
                  ? translate(lang, 'incomeOnlyFilter')
                  : translate(lang, 'expensesOnlyFilter')}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="ada-surface overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-[#EBF2FA] text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                <th className="px-5 py-3 font-medium">{translate(lang, 'colType')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'colDescription')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'category')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'method')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'date')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'colRecorder')}</th>
                <th className="px-4 py-3 text-right font-medium">{translate(lang, 'amount')}</th>
                <th className="px-5 py-3 text-right font-medium">{translate(lang, 'receiptBtn')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {combinedRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-3 font-semibold whitespace-nowrap">
                    <span
                      className={
                        row.type === 'Income'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }
                    >
                      {translateStatus(lang, row.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                    {row.description}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.category}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {translateMethod(lang, row.method)}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.recorder}</td>
                  <td
                    className={`px-4 py-3 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                      row.type === 'Income'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-700 dark:text-red-400'
                    }`}
                  >
                    {row.type === 'Income' ? '+' : '-'}
                    {formatCurrency(row.amount, settings.currency)}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setInvoiceDoc(row.invoice)}
                      className="inline-flex items-center gap-1 rounded-md border border-[#034EA2]/35 bg-[#EFF6FF] px-2 py-1 text-[11px] font-semibold text-[#034EA2] hover:bg-[#DBEAFE] dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                    >
                      <Printer className="h-3 w-3" />
                      {translate(lang, 'receiptBtn')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal */}
      <ModalShell
        isOpen={showExpenseModal}
        title={translate(lang, 'recordExpenseTitle')}
        onClose={() => setShowExpenseModal(false)}
        closeLabel={translate(lang, 'close')}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSubmitExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(lang, 'expenseCategoryLabel')}
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  {outgoingCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="other">{translate(lang, 'otherCustomCategoryOpt')}</option>
                </select>
              </div>

              {categoryId === 'other' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {translate(lang, 'customCategoryRequired')}
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
                  {translate(lang, 'descriptionRequired')}
                </label>
                <textarea
                  rows={2}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
                  onClick={() => setShowExpenseModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  {translate(lang, 'cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#0B2C5D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#034EA2] dark:bg-[#034EA2]"
                >
                  {translate(lang, 'saveExpenseBtn')}
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
