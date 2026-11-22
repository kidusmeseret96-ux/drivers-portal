import React, {useMemo, useState} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Download,
  HandHeart,
  IdCard,
  KeyRound,
  LogOut,
  Moon,
  Receipt,
  RefreshCw,
  Route,
  ShieldCheck,
  Sun,
  Truck,
  User,
  Wrench,
} from 'lucide-react';
import {
  translate,
  translateGender,
  translateRole,
  translateSpouseLabel,
  translateStatus,
} from '../i18n/translations';
import type {PortalWorkspace} from '../lib/supabasePortal';
import type {AdaPayment} from '../types/ada';
import {calculateOverdueAccounts} from '../utils/adaCalculations';
import {formatEthiopianDate} from '../utils/ethiopianCalendar';
import {daysUntil, formatCurrency, formatDate, todayIsoDate} from '../utils/formatters';
import {
  ASSOCIATION_LOGO_PATH,
  downloadInvertedIdCardImage,
  downloadNormalIdCardImage,
} from '../utils/idCardExport';
import {MemberIdCardModal} from './MemberIdCardModal';
import {PaymentReceiptModal} from './PaymentReceiptModal';
import {StatusText} from './StatusText';
import {VehiclePlateBadge} from './VehiclePlateBadge';

type SelfTab = 'profile' | 'payments' | 'penalties' | 'trips' | 'aid';

interface MemberSelfPortalProps {
  workspace: PortalWorkspace;
  onRefresh: () => Promise<void>;
  onOpenChangePassword: () => void;
  onLogout: () => void;
}

function ExpiryBadge({label, date}: {label: string; date?: string}) {
  const days = daysUntil(date);
  let tone = 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300';
  let statusText = date ? formatDate(date) : 'Not on file';
  if (days !== null) {
    if (days < 0) {
      tone = 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300';
      statusText = `${formatDate(date)} (Expired)`;
    } else if (days <= 30) {
      tone = 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300';
      statusText = `${formatDate(date)} (${days}d left)`;
    } else {
      tone = 'border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300';
    }
  }
  return (
    <div className={`rounded-xl border p-3.5 ${tone}`}>
      <p className="text-[11px] font-medium opacity-80">{label}</p>
      <p className="mt-1 font-mono text-xs font-semibold">{statusText}</p>
    </div>
  );
}

export const MemberSelfPortal: React.FC<MemberSelfPortalProps> = ({
  workspace,
  onRefresh,
  onOpenChangePassword,
  onLogout,
}) => {
  const {currentMember: member, settings, payments, penalties, trips, mutualAid, incidents} =
    workspace;
  const lang = settings.language || 'en';
  const [activeTab, setActiveTab] = useState<SelfTab>('profile');
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [refreshing, setRefreshing] = useState(false);
  const [showIdModal, setShowIdModal] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<AdaPayment | null>(null);
  const [downloadingCard, setDownloadingCard] = useState(false);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    if (next) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const approvedTotal = useMemo(
    () =>
      payments
        .filter((p) => p.status === 'Approved')
        .reduce((sum, p) => sum + p.amount, 0),
    [payments]
  );

  const unpaidPenaltiesTotal = useMemo(
    () =>
      penalties
        .filter((p) => p.status === 'Unpaid')
        .reduce((sum, p) => sum + p.amount, 0),
    [penalties]
  );

  const overdueStanding = useMemo(() => {
    const res = calculateOverdueAccounts([member], payments, settings);
    return res.rows[0] ?? null;
  }, [member, payments, settings]);

  const spouseHeading = translateSpouseLabel(lang, member.gender);
  const ecToday =
    settings.showEthiopianCalendar !== false
      ? formatEthiopianDate(todayIsoDate(), lang)
      : '';

  const handleDownloadCard = async (inverted: boolean) => {
    setDownloadingCard(true);
    try {
      if (inverted) {
        await downloadInvertedIdCardImage(member, settings);
      } else {
        await downloadNormalIdCardImage(member, settings);
      }
    } finally {
      setDownloadingCard(false);
    }
  };

  const tabs: {id: SelfTab; label: string; icon: typeof User; count?: number}[] = [
    {id: 'profile', label: 'My Profile & ID', icon: User},
    {id: 'payments', label: 'My Payments', icon: CreditCard, count: payments.length},
    {id: 'penalties', label: 'My Penalties', icon: AlertTriangle, count: penalties.length},
    {id: 'trips', label: 'My Trips', icon: Route, count: trips.length},
    {
      id: 'aid',
      label: 'Mutual Aid & Incidents',
      icon: HandHeart,
      count: mutualAid.length + incidents.length,
    },
  ];

  return (
    <div className="ada-canvas-bg min-h-screen text-slate-900 dark:text-slate-100">
      {/* Tri-color accent */}
      <div className="grid h-1 grid-cols-3">
        <div className="bg-[#078930]" />
        <div className="bg-[#FCDD09]" />
        <div className="bg-[#DA121A]" />
      </div>

      {/* Header */}
      <header className="no-print sticky top-0 z-20 border-b border-slate-300/80 bg-[#0B2C5D] text-white shadow-sm dark:border-slate-800 dark:bg-[#0B172B]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-amber-300/90 bg-white">
              <img
                src={settings.logoDataUrl || ASSOCIATION_LOGO_PATH}
                alt={settings.associationName}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-xs font-bold uppercase tracking-wide text-white sm:text-sm">
                {settings.associationName}
              </p>
              <p className="truncate text-[11px] text-sky-200">
                Personal Member Portal · <span className="font-mono">{member.memberId}</span>
                {ecToday ? ` · ${ecToday}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleDark}
              className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/20"
            >
              {dark ? <Sun className="h-3.5 w-3.5 text-amber-300" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true);
                try {
                  await onRefresh();
                } finally {
                  setRefreshing(false);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={onOpenChangePassword}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/60 bg-amber-400/15 px-2.5 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-400/25"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Change Password</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-500/30"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        {workspace.mustChangePassword && (
          <div className="no-print flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold">You are still using the default password (0000)</p>
                <p className="mt-0.5 text-[11px] opacity-90">
                  Change your password now to protect your private profile, ID card, and payment records.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenChangePassword}
              className="shrink-0 rounded-lg bg-[#0B2C5D] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#034EA2]"
            >
              Change Password Now
            </button>
          </div>
        )}

        {/* Member Hero Banner */}
        <section className="ada-surface rounded-2xl border p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {member.photoDataUrl ? (
                <img
                  src={member.photoDataUrl}
                  alt={member.fullName}
                  className="h-16 w-16 rounded-xl border border-slate-200 object-cover dark:border-slate-700"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#0B2C5D] text-lg font-bold text-amber-300">
                  {member.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {member.fullName}
                  </h1>
                  <span className="rounded-md bg-[#0B2C5D]/10 px-2 py-0.5 font-mono text-xs font-bold text-[#0B2C5D] dark:bg-sky-900/40 dark:text-sky-300">
                    {member.memberId}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400">
                  <span>{translateRole(lang, member.role)}</span>
                  <span>·</span>
                  <VehiclePlateBadge plate={member.vehiclePlate} />
                  <span>·</span>
                  <StatusText
                    label={translateStatus(lang, member.status)}
                    tone={member.status === 'Active' ? 'success' : 'danger'}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowIdModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2C5D] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#034EA2] dark:bg-[#034EA2]"
              >
                <IdCard className="h-3.5 w-3.5 text-amber-300" />
                View Digital ID Card
              </button>
              <button
                type="button"
                disabled={downloadingCard}
                onClick={() => handleDownloadCard(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Download className="h-3.5 w-3.5" />
                Save ID (PNG)
              </button>
            </div>
          </div>

          {/* Personal Standing Cards */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                My Total Approved Payments
              </p>
              <p className="mt-1 font-mono text-base font-bold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(approvedTotal, settings.currency)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Current Month Overdue Dues
              </p>
              <p
                className={`mt-1 font-mono text-base font-bold ${
                  overdueStanding
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {overdueStanding
                  ? `${formatCurrency(overdueStanding.totalDue, settings.currency)} (${overdueStanding.daysLate}d late)`
                  : 'All Clear'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                My Unpaid Penalties
              </p>
              <p
                className={`mt-1 font-mono text-base font-bold ${
                  unpaidPenaltiesTotal > 0
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {unpaidPenaltiesTotal > 0
                  ? formatCurrency(unpaidPenaltiesTotal, settings.currency)
                  : 'None'}
              </p>
            </div>
          </div>
        </section>

        {/* Navigation Tabs */}
        <div className="no-print flex flex-wrap gap-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-[#0B2C5D] bg-[#0B2C5D] text-white dark:border-[#034EA2] dark:bg-[#034EA2]'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
                {typeof t.count === 'number' && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab 1: My Profile & Compliance */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <section className="ada-surface rounded-2xl border p-5 space-y-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <User className="h-4 w-4 text-[#034EA2] dark:text-sky-400" />
                Personal &amp; Contact Information
              </h2>
              <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                <div>
                  <span className="text-slate-500">Phone</span>
                  <p className="mt-0.5 font-mono font-semibold">{member.phone || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Gender &amp; Age</span>
                  <p className="mt-0.5 font-semibold">
                    {translateGender(lang, member.gender)} · {member.age || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Blood Type</span>
                  <p className="mt-0.5 font-semibold">{member.bloodType || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Join Date</span>
                  <p className="mt-0.5 font-mono font-semibold">{formatDate(member.joinDate)}</p>
                </div>
                <div>
                  <span className="text-slate-500">Employer / Corridor</span>
                  <p className="mt-0.5 font-semibold">{member.employer || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Location</span>
                  <p className="mt-0.5 font-semibold">{member.location || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Emergency Contact</span>
                  <p className="mt-0.5 font-semibold">{member.emergencyContactName || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Emergency Phone</span>
                  <p className="mt-0.5 font-mono font-semibold">
                    {member.emergencyContactPhone || '—'}
                  </p>
                </div>
              </div>
            </section>

            <section className="ada-surface rounded-2xl border p-5 space-y-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Truck className="h-4 w-4 text-[#034EA2] dark:text-sky-400" />
                My Truck, Licence &amp; Compliance Documents
              </h2>
              <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
                <div>
                  <span className="text-slate-500">Truck Make / Model</span>
                  <p className="mt-0.5 font-semibold">{member.vehicleMakeModel || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Trailer / Chassis No.</span>
                  <p className="mt-0.5 font-mono font-semibold">
                    {member.trailerPlateOrChassis || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Driver Licence No.</span>
                  <p className="mt-0.5 font-mono font-semibold">{member.licenseNumber || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Insurance Provider</span>
                  <p className="mt-0.5 font-semibold">{member.insuranceProvider || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Insurance Policy No.</span>
                  <p className="mt-0.5 font-mono font-semibold">
                    {member.insurancePolicyNumber || '—'}{' '}
                    {member.insuranceType ? `(${member.insuranceType})` : ''}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-5">
                <ExpiryBadge label="Driver Licence Expiry" date={member.licenseExpiry} />
                <ExpiryBadge label="Annual Bolo Expiry" date={member.boloExpiry} />
                <ExpiryBadge label="Insurance Expiry" date={member.insuranceExpiry} />
                <ExpiryBadge label="Medical Fitness Expiry" date={member.medicalExpiry} />
                <ExpiryBadge
                  label="Highway Clearance"
                  date={member.highwayClearanceExpiry}
                />
              </div>
            </section>

            {(member.isMarried && member.spouse?.name) || member.children.length > 0 ? (
              <section className="ada-surface rounded-2xl border p-5 space-y-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <ShieldCheck className="h-4 w-4 text-[#034EA2] dark:text-sky-400" />
                  Registered Family ({spouseHeading} &amp; Children)
                </h2>
                {member.isMarried && member.spouse?.name && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3.5 text-xs dark:border-slate-800 dark:bg-slate-900">
                    <span className="text-slate-500">{spouseHeading}:</span>{' '}
                    <strong className="text-slate-900 dark:text-slate-100">
                      {member.spouse.name}
                    </strong>
                    {member.spouse.phone ? ` · ${member.spouse.phone}` : ''}
                    {member.spouse.occupation ? ` · ${member.spouse.occupation}` : ''}
                  </div>
                )}
                {member.children.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {member.children.map((ch, idx) => (
                      <div
                        key={ch.id}
                        className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900"
                      >
                        <p className="font-semibold">
                          {idx + 1}. {ch.name}
                        </p>
                        <p className="mt-0.5 text-slate-500">
                          {translateGender(lang, ch.gender)} · {formatDate(ch.dateOfBirth)} ·{' '}
                          {ch.occupationOrGrade || '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : null}
          </div>
        )}

        {/* Tab 2: My Payments */}
        {activeTab === 'payments' && (
          <section className="ada-surface overflow-hidden rounded-2xl border">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h2 className="text-sm font-semibold">My Payment History &amp; Official Receipts</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#EBF2FA] text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                    <th className="px-4 py-3 font-medium">Reference</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                        No payment records found for your account yet.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3 font-mono font-semibold">{p.reference}</td>
                        <td className="px-4 py-3">{p.categoryName}</td>
                        <td className="px-4 py-3">{p.method}</td>
                        <td className="px-4 py-3 font-mono">{formatDate(p.date)}</td>
                        <td className="px-4 py-3 font-mono font-semibold">
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
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setReceiptPayment(p)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            <Receipt className="h-3 w-3" />
                            Invoice
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tab 3: My Penalties */}
        {activeTab === 'penalties' && (
          <section className="ada-surface overflow-hidden rounded-2xl border">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h2 className="text-sm font-semibold">My Penalties &amp; Violations</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#EBF2FA] text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                    <th className="px-4 py-3 font-medium">Reason</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {penalties.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                          No penalties on your record.
                        </span>
                      </td>
                    </tr>
                  ) : (
                    penalties.map((pnl) => (
                      <tr key={pnl.id}>
                        <td className="px-4 py-3 font-semibold">{pnl.reason}</td>
                        <td className="px-4 py-3 font-mono">{formatDate(pnl.date)}</td>
                        <td className="px-4 py-3 font-mono font-semibold">
                          {formatCurrency(pnl.amount, settings.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusText
                            label={translateStatus(lang, pnl.status)}
                            tone={pnl.status === 'Paid' ? 'success' : 'danger'}
                          />
                        </td>
                        <td className="px-4 py-3 text-slate-500">{pnl.note || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tab 4: My Trips */}
        {activeTab === 'trips' && (
          <section className="ada-surface overflow-hidden rounded-2xl border">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h2 className="text-sm font-semibold">My Dispatched Freight Trips</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#EBF2FA] text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                    <th className="px-4 py-3 font-medium">Waybill</th>
                    <th className="px-4 py-3 font-medium">Route Corridor</th>
                    <th className="px-4 py-3 font-medium">Cargo</th>
                    <th className="px-4 py-3 font-medium">Dispatch Date</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {trips.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                        No dispatch trips logged for your truck yet.
                      </td>
                    </tr>
                  ) : (
                    trips.map((trp) => (
                      <tr key={trp.id}>
                        <td className="px-4 py-3 font-mono font-semibold">{trp.waybillRef}</td>
                        <td className="px-4 py-3">{trp.routeCorridor}</td>
                        <td className="px-4 py-3">
                          {trp.cargoDescription} ({trp.tonnage}t)
                        </td>
                        <td className="px-4 py-3 font-mono">{formatDate(trp.dispatchDate)}</td>
                        <td className="px-4 py-3">
                          <StatusText
                            label={trp.status}
                            tone={
                              trp.status === 'Completed'
                                ? 'success'
                                : trp.status === 'Cancelled'
                                  ? 'danger'
                                  : 'warning'
                            }
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tab 5: Mutual Aid & Incidents */}
        {activeTab === 'aid' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="ada-surface overflow-hidden rounded-2xl border">
              <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <HandHeart className="h-4 w-4 text-[#034EA2] dark:text-sky-400" />
                  My Edir Mutual-Aid Payouts
                </h2>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {mutualAid.length === 0 ? (
                  <p className="px-5 py-8 text-center text-xs text-slate-500">
                    No mutual-aid records for your account.
                  </p>
                ) : (
                  mutualAid.map((aid) => (
                    <div key={aid.id} className="space-y-1 px-5 py-3.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">
                          {aid.aidType} · <span className="font-mono">{aid.voucherRef}</span>
                        </span>
                        <StatusText
                          label={aid.status}
                          tone={aid.status === 'Paid' ? 'success' : 'warning'}
                        />
                      </div>
                      <p className="font-mono font-bold text-[#0B2C5D] dark:text-sky-300">
                        {formatCurrency(aid.amount, settings.currency)} · {aid.method}
                      </p>
                      <p className="text-slate-500">{aid.description}</p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="ada-surface overflow-hidden rounded-2xl border">
              <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Wrench className="h-4 w-4 text-[#034EA2] dark:text-sky-400" />
                  My Incidents &amp; Roadside Advances
                </h2>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {incidents.length === 0 ? (
                  <p className="px-5 py-8 text-center text-xs text-slate-500">
                    No incident advances logged for your account.
                  </p>
                ) : (
                  incidents.map((inc) => (
                    <div key={inc.id} className="space-y-1 px-5 py-3.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">
                          {inc.kind} · <span className="font-mono">{inc.refCode}</span>
                        </span>
                        <StatusText
                          label={inc.status}
                          tone={inc.status === 'Settled' ? 'success' : 'warning'}
                        />
                      </div>
                      <p className="font-mono font-bold text-[#0B2C5D] dark:text-sky-300">
                        {formatCurrency(inc.amount, settings.currency)} · {inc.locationOrCorridor}
                      </p>
                      <p className="text-slate-500">{inc.description}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      <MemberIdCardModal
        member={showIdModal ? member : null}
        allMembers={[member]}
        payments={payments}
        penalties={penalties}
        settings={settings}
        onClose={() => setShowIdModal(false)}
      />

      <PaymentReceiptModal
        payment={receiptPayment}
        member={member}
        settings={settings}
        onClose={() => setReceiptPayment(null)}
      />
    </div>
  );
};
