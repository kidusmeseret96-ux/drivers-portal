import React, {useMemo} from 'react';
import {RotateCcw} from 'lucide-react';
import {StatusText} from '../../components/StatusText';
import {VehiclePlateBadge} from '../../components/VehiclePlateBadge';
import {translate, translateStatus} from '../../i18n/translations';
import type {AdaMember, AdaSettings} from '../../types/ada';
import {formatDate} from '../../utils/formatters';

interface AdaDeletedMembersViewProps {
  settings: AdaSettings;
  members: AdaMember[];
  onRestoreMember: (memberId: string) => Promise<void>;
}

export const AdaDeletedMembersView: React.FC<AdaDeletedMembersViewProps> = ({
  settings,
  members,
  onRestoreMember,
}) => {
  const lang = settings.language;
  const archived = useMemo(
    () =>
      members
        .filter((m) => Boolean(m.deletedAt))
        .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? '')),
    [members]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {translate(lang, 'deletedMembers')}
        </h1>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {translate(lang, 'deletedMembersSubtitle')}
        </p>
      </div>

      <div className="ada-surface overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-[#EBF2FA] text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                <th className="px-5 py-3 font-medium">{translate(lang, 'colMemberId')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'phone')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'colVehiclePlate')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'colPriorStatus')}</th>
                <th className="px-4 py-3 font-medium">{translate(lang, 'colDeletionDate')}</th>
                <th className="px-5 py-3 text-right font-medium">{translate(lang, 'actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {archived.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    {translate(lang, 'noDeletedMembers')}
                  </td>
                </tr>
              ) : (
                archived.map((m) => (
                  <tr
                    key={m.id}
                    className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {m.fullName}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {m.previousMemberId || m.memberId}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">
                      {m.phone || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <VehiclePlateBadge plate={m.vehiclePlate} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusText
                        label={translateStatus(lang, m.statusBeforeDelete ?? m.status)}
                        tone="neutral"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {formatDate(m.deletedAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onRestoreMember(m.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {translate(lang, 'restore')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
