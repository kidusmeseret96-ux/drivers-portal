import React, {useMemo, useState} from 'react';
import {CheckCircle2, Download, Plus, Route, Search, Truck} from 'lucide-react';
import {ModalShell} from '../../components/ModalShell';
import {StatusText} from '../../components/StatusText';
import {VehiclePlateBadge} from '../../components/VehiclePlateBadge';
import {translate} from '../../i18n/translations';
import type {AdaMember, AdaSettings, AdaTrip, TripStatus} from '../../types/ada';
import {
  createId,
  downloadCsv,
  formatDate,
  nextSequentialCode,
  todayIsoDate,
} from '../../utils/formatters';

interface AdaTripsViewProps {
  settings: AdaSettings;
  trips: AdaTrip[];
  members: AdaMember[];
  onSaveTrip: (trip: AdaTrip) => Promise<void>;
  onUpdateTripStatus: (tripId: string, status: TripStatus) => Promise<void>;
}

const CORRIDOR_SUGGESTIONS = [
  'Modjo Dry Port → Djibouti Port',
  'Adama → Modjo → Kality Terminal',
  'Adama → Awash → Dire Dawa',
  'Adama → Hawassa Industrial Park',
  'Adama → Jimma Freight Line',
];

export const AdaTripsView: React.FC<AdaTripsViewProps> = ({
  settings,
  trips,
  members,
  onSaveTrip,
  onUpdateTripStatus,
}) => {
  const lang = settings.language;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | TripStatus>('All');
  const [showModal, setShowModal] = useState(false);

  const activeMembers = useMemo(
    () => members.filter((m) => !m.deletedAt && m.status === 'Active'),
    [members]
  );
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  // Modal Form State
  const [memberId, setMemberId] = useState(activeMembers[0]?.id ?? '');
  const [waybillRef, setWaybillRef] = useState('');
  const [routeCorridor, setRouteCorridor] = useState(CORRIDOR_SUGGESTIONS[0]);
  const [cargoDescription, setCargoDescription] = useState('');
  const [tonnage, setTonnage] = useState(32);
  const [dispatchDate, setDispatchDate] = useState(todayIsoDate());
  const [notes, setNotes] = useState('');

  const summary = useMemo(() => {
    const dispatched = trips.filter((t) => t.status === 'Dispatched').length;
    const completed = trips.filter((t) => t.status === 'Completed').length;
    const totalTons = trips
      .filter((t) => t.status !== 'Cancelled')
      .reduce((s, t) => s + (Number(t.tonnage) || 0), 0);
    return {total: trips.length, dispatched, completed, totalTons};
  }, [trips]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return trips
      .filter((t) => {
        if (statusFilter !== 'All' && t.status !== statusFilter) return false;
        if (!q) return true;
        const m = memberMap.get(t.memberId);
        return (
          t.waybillRef.toLowerCase().includes(q) ||
          t.routeCorridor.toLowerCase().includes(q) ||
          t.cargoDescription.toLowerCase().includes(q) ||
          t.vehiclePlate.toLowerCase().includes(q) ||
          (m?.fullName.toLowerCase().includes(q) ?? false) ||
          (m?.memberId.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => b.dispatchDate.localeCompare(a.dispatchDate));
  }, [trips, statusFilter, searchQuery, memberMap]);

  const translateTripStatus = (st: TripStatus) => {
    if (st === 'Dispatched') return translate(lang, 'statusDispatched');
    if (st === 'Completed') return translate(lang, 'statusCompleted');
    return translate(lang, 'statusCancelled');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenId = memberId || activeMembers[0]?.id;
    const chosenMember = memberMap.get(chosenId);
    if (!chosenId || !routeCorridor.trim() || !cargoDescription.trim()) return;

    const autoRef =
      waybillRef.trim() ||
      nextSequentialCode(
        'WB-2026-',
        trips.map((t) => t.waybillRef),
        4
      );

    await onSaveTrip({
      id: createId('trp'),
      waybillRef: autoRef,
      memberId: chosenId,
      vehiclePlate: chosenMember?.vehiclePlate || 'NO-PLATE',
      routeCorridor: routeCorridor.trim(),
      cargoDescription: cargoDescription.trim(),
      tonnage: Number(tonnage) || 0,
      dispatchDate,
      status: 'Dispatched',
      notes: notes.trim() || undefined,
      recordedBy: settings.currentUserName,
      createdAt: new Date().toISOString(),
    });

    setShowModal(false);
    setWaybillRef('');
    setCargoDescription('');
    setNotes('');
  };

  const handleExportCsv = () => {
    downloadCsv(
      `ada-trip-dispatch-${todayIsoDate()}.csv`,
      [
        'Waybill Ref',
        'Driver ID',
        'Driver Name',
        'Vehicle Plate',
        'Route Corridor',
        'Cargo Description',
        'Tonnage (Tons)',
        'Dispatch Date',
        'Completed Date',
        'Status',
      ],
      filtered.map((t) => {
        const m = memberMap.get(t.memberId);
        return [
          t.waybillRef,
          m?.memberId ?? '',
          m?.fullName ?? '',
          t.vehiclePlate,
          t.routeCorridor,
          t.cargoDescription,
          t.tonnage,
          t.dispatchDate,
          t.completedDate ?? '',
          t.status,
        ];
      })
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {translate(lang, 'tripDispatch')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            {translate(lang, 'tripsSubtitle')}
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
            {translate(lang, 'logTripBtn')}
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="ada-surface rounded-xl border p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'totalTripsCard')}
          </span>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {summary.total}
          </p>
        </div>
        <div className="ada-surface rounded-xl border p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'activeTransitCard')}
          </span>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {summary.dispatched}
          </p>
        </div>
        <div className="ada-surface rounded-xl border p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'completedTripsCard')}
          </span>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {summary.completed}
          </p>
        </div>
        <div className="ada-surface rounded-xl border p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'totalTonnageCard')}
          </span>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#034EA2] dark:text-sky-400">
            {summary.totalTons.toLocaleString()} t
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
            placeholder={translate(lang, 'tripsSearchPlaceholder')}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800">
          {(['All', 'Dispatched', 'Completed', 'Cancelled'] as const).map((st) => (
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
              {st === 'All' ? translate(lang, 'all') : translateTripStatus(st)}
            </button>
          ))}
        </div>
      </div>

      {/* Trips Table */}
      <div className="ada-surface overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-[#EBF2FA] text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                <th className="px-5 py-3 font-semibold">{translate(lang, 'waybillRefLabel')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'member')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'colVehiclePlate')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'routeCorridorLabel')}</th>
                <th className="px-4 py-3 text-right font-semibold">{translate(lang, 'tonnageLabel')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'dispatchDateLabel')}</th>
                <th className="px-4 py-3 font-semibold">{translate(lang, 'status')}</th>
                <th className="px-5 py-3 text-right font-semibold">{translate(lang, 'actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    {translate(lang, 'noTripsMatch')}
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const m = memberMap.get(t.memberId);
                  return (
                    <tr
                      key={t.id}
                      className="transition-colors hover:bg-sky-50/50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-3 font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {t.waybillRef}
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
                        <VehiclePlateBadge plate={t.vehiclePlate} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                          <Route className="h-3.5 w-3.5 shrink-0 text-[#034EA2] dark:text-sky-400" />
                          <span>{t.routeCorridor}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {t.cargoDescription}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {t.tonnage} t
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(t.dispatchDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusText
                          label={translateTripStatus(t.status)}
                          tone={
                            t.status === 'Completed'
                              ? 'success'
                              : t.status === 'Cancelled'
                                ? 'danger'
                                : 'warning'
                          }
                        />
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {t.status === 'Dispatched' ? (
                          <button
                            type="button"
                            onClick={() => onUpdateTripStatus(t.id, 'Completed')}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {translate(lang, 'markCompletedBtn')}
                          </button>
                        ) : (
                          <span className="font-mono text-[11px] text-slate-500">
                            {t.completedDate ? formatDate(t.completedDate) : '—'}
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

      {/* Log Trip Modal */}
      <ModalShell
        isOpen={showModal}
        title={translate(lang, 'logTripTitle')}
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

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'routeCorridorLabel')}
              </label>
              <input
                type="text"
                required
                list="ada-corridors"
                value={routeCorridor}
                onChange={(e) => setRouteCorridor(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <datalist id="ada-corridors">
                {CORRIDOR_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'cargoDescLabel')}
              </label>
              <input
                type="text"
                required
                value={cargoDescription}
                onChange={(e) => setCargoDescription(e.target.value)}
                placeholder="e.g. 40ft Export Coffee Container"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'tonnageLabel')}
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={tonnage}
                onChange={(e) => setTonnage(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'dispatchDateLabel')}
              </label>
              <input
                type="date"
                required
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'waybillRefLabel')} ({translate(lang, 'referenceOptional')})
              </label>
              <input
                type="text"
                value={waybillRef}
                onChange={(e) => setWaybillRef(e.target.value)}
                placeholder={translate(lang, 'referencePlaceholder')}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {translate(lang, 'notesOptional')}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
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
              <Truck className="h-3.5 w-3.5 text-amber-300" />
              {translate(lang, 'logTripBtn')}
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
};
