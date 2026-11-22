import React, {useEffect} from 'react';
import {X} from 'lucide-react';

interface ModalShellProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  closeLabel?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

let activeModalLockCount = 0;

export function acquireModalPrintLock(): void {
  activeModalLockCount += 1;
  if (typeof document !== 'undefined') {
    document.body.classList.add('ada-modal-open');
  }
}

export function releaseModalPrintLock(): void {
  activeModalLockCount = Math.max(0, activeModalLockCount - 1);
  if (activeModalLockCount === 0 && typeof document !== 'undefined') {
    document.body.classList.remove('ada-modal-open');
  }
}

export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  title,
  subtitle,
  onClose,
  closeLabel = 'Close',
  maxWidthClass = 'max-w-xl',
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    acquireModalPrintLock();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      releaseModalPrintLock();
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-print-backdrop fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs p-3 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex min-h-full items-start justify-center py-2 sm:items-center">
        <div
          onClick={(e) => e.stopPropagation()}
          className={`modal-print-dialog flex max-h-[calc(100dvh-2rem)] w-full ${maxWidthClass} flex-col overflow-hidden rounded-2xl border border-slate-300 bg-[#F8FAFC] shadow-2xl dark:border-slate-700 dark:bg-[#0F172A] sm:max-h-[90dvh]`}
        >
          {/* Official Navy Top Accent + Fixed Header */}
          <div className="no-print shrink-0">
            <div className="grid h-1 grid-cols-3">
              <div className="bg-[#078930]" />
              <div className="bg-[#FCDD09]" />
              <div className="bg-[#DA121A]" />
            </div>
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-[#0B2C5D] px-5 py-3.5 text-white dark:border-slate-800 dark:bg-[#0B172B]">
              <div className="min-w-0">
                {subtitle && (
                  <p className="font-mono text-[11px] font-medium text-amber-300 truncate">
                    {subtitle}
                  </p>
                )}
                <h3 className="font-display text-sm font-bold leading-snug text-white sm:text-base">
                  {title}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="shrink-0 rounded-lg p-1.5 text-sky-200 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="modal-print-scroll min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
        </div>
      </div>
    </div>
  );
};
