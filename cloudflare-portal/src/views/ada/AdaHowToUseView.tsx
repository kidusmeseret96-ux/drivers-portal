import React, {useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {getGuideSections, translate} from '../../i18n/translations';
import type {AdaSettings} from '../../types/ada';

interface AdaHowToUseViewProps {
  settings: AdaSettings;
}

export const AdaHowToUseView: React.FC<AdaHowToUseViewProps> = ({settings}) => {
  const lang = settings.language;
  const [openId, setOpenId] = useState<string>('dashboard');
  const sections = getGuideSections(lang);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {translate(lang, 'howToUse')}
        </h1>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {translate(lang, 'howToUseSubtitle', {name: settings.associationName})}
        </p>
      </div>

      <div className="ada-surface divide-y divide-slate-200 overflow-hidden rounded-xl border dark:divide-slate-800">
        {sections.map((sec) => {
          const isOpen = openId === sec.id;
          return (
            <div key={sec.id}>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? '' : sec.id)}
                className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {sec.title}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                  {sec.body}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
