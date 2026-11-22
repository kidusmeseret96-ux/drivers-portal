import React, {useEffect, useMemo, useState} from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  FlipHorizontal2,
  IdCard,
  Printer,
  Search,
  X,
} from 'lucide-react';
import {LANGUAGE_OPTIONS} from '../i18n/translations';
import type {AdaMember, AdaSettings, LanguageCode} from '../types/ada';
import {
  downloadInvertedBatchIdCardsSheet,
  downloadNormalBatchIdCardsSheet,
  generateBatchIdSheetPreviewDataUrl,
} from '../utils/idCardExport';

interface BatchIdPrintSectionProps {
  members: AdaMember[];
  settings: AdaSettings;
  onNotice?: (message: string) => void;
}

const MAX_BATCH_IDS = 5;

export const BatchIdPrintSection: React.FC<BatchIdPrintSectionProps> = ({
  members,
  settings,
  onNotice,
}) => {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [printLang, setPrintLang] = useState<LanguageCode>(
    settings.defaultPrintLanguage ?? settings.language
  );
  const [previewInverted, setPreviewInverted] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [renderingPreview, setRenderingPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const availableMembers = useMemo(
    () =>
      members
        .filter((m) => !m.deletedAt && m.status !== 'Removed')
        .slice()
        .sort((a, b) => a.memberId.localeCompare(b.memberId)),
    [members]
  );

  // Keep selectedIds synced if members list changes
  useEffect(() => {
    const validSet = new Set(availableMembers.map((m) => m.id));
    setSelectedIds((prev) => prev.filter((id) => validSet.has(id)).slice(0, MAX_BATCH_IDS));
  }, [availableMembers]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableMembers;
    return availableMembers.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.memberId.toLowerCase().includes(q) ||
        (m.vehiclePlate || '').toLowerCase().includes(q) ||
        (m.phone || '').toLowerCase().includes(q)
    );
  }, [availableMembers, search]);

  const selectedMembers = useMemo(() => {
    const map = new Map(availableMembers.map((m) => [m.id, m]));
    return selectedIds.map((id) => map.get(id)).filter((m): m is AdaMember => Boolean(m));
  }, [availableMembers, selectedIds]);

  useEffect(() => {
    let cancelled = false;
    if (selectedMembers.length === 0) {
      setPreviewDataUrl(null);
      setRenderingPreview(false);
      return;
    }

    setRenderingPreview(true);
    void generateBatchIdSheetPreviewDataUrl(selectedMembers, settings, previewInverted, printLang)
      .then((url) => {
        if (!cancelled) setPreviewDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewDataUrl(null);
      })
      .finally(() => {
        if (!cancelled) setRenderingPreview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMembers, settings, previewInverted, printLang]);

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= MAX_BATCH_IDS) {
        return prev;
      }
      return [...prev, id];
    });
  };

  const moveSelected = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= selectedIds.length) return;
    setSelectedIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handleSelectFirstFive = () => {
    setSelectedIds(filteredMembers.slice(0, MAX_BATCH_IDS).map((m) => m.id));
  };

  const handleDownloadInverted = async () => {
    if (selectedMembers.length === 0 || downloading) return;
    setDownloading(true);
    try {
      await downloadInvertedBatchIdCardsSheet(selectedMembers, settings, printLang);
      onNotice?.(
        `Downloaded horizontally inverted A4 print sheet (${selectedMembers.length} ID${selectedMembers.length > 1 ? 's' : ''}).`
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadNormal = async () => {
    if (selectedMembers.length === 0 || downloading) return;
    setDownloading(true);
    try {
      await downloadNormalBatchIdCardsSheet(selectedMembers, settings, printLang);
      onNotice?.(
        `Downloaded upright A4 ID sheet (${selectedMembers.length} ID${selectedMembers.length > 1 ? 's' : ''}).`
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="ada-surface rounded-xl p-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-[#034EA2] dark:text-sky-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Print IDs
            </h2>
            <span className="rounded-md bg-[#0B2C5D]/10 px-2 py-0.5 font-mono text-[11px] font-bold text-[#0B2C5D] dark:bg-sky-500/20 dark:text-sky-300">
              {selectedMembers.length} / {MAX_BATCH_IDS} selected
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Select up to 5 members to stack Front (left) and Back (right) in 5 rows on an A4 sheet.
            Download exports horizontally inverted so printing &amp; laminating comes out right-side up.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={printLang}
            onChange={(e) => setPrintLang(e.target.value as LanguageCode)}
            aria-label="ID print language"
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.nativeLabel}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={selectedMembers.length === 0 || downloading}
            onClick={handleDownloadInverted}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2C5D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#034EA2] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#034EA2] dark:hover:bg-sky-600"
          >
            <Download className="h-3.5 w-3.5 text-amber-300" />
            {downloading ? 'Preparing PNG...' : 'Download Print IDs (Inverted)'}
          </button>

          <button
            type="button"
            disabled={selectedMembers.length === 0 || downloading}
            onClick={handleDownloadNormal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            Normal PNG
          </button>
        </div>
      </div>

      {/* Picker + Selected Stack + Sheet Preview */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Member selector (max 5) */}
        <div className="space-y-3 lg:col-span-5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ID, name, or plate..."
                className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:border-[#034EA2] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              type="button"
              disabled={filteredMembers.length === 0}
              onClick={handleSelectFirstFive}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              First 5
            </button>
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Clear
              </button>
            )}
          </div>

          <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/70 p-2 dark:border-slate-700 dark:bg-slate-900/50">
            {availableMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <IdCard className="mb-1.5 h-6 w-6 text-slate-400" />
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  No members available yet. Add members first to print IDs.
                </p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                No matching members found.
              </p>
            ) : (
              filteredMembers.map((member) => {
                const slotIndex = selectedIds.indexOf(member.id);
                const isSelected = slotIndex !== -1;
                const limitReached = !isSelected && selectedIds.length >= MAX_BATCH_IDS;
                return (
                  <button
                    key={member.id}
                    type="button"
                    disabled={limitReached}
                    onClick={() => toggleMember(member.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? 'border-[#034EA2] bg-sky-50/90 dark:border-sky-500 dark:bg-sky-950/40'
                        : limitReached
                          ? 'cursor-not-allowed border-slate-200 bg-white/50 opacity-50 dark:border-slate-800 dark:bg-slate-900/30'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-[#0B2C5D] dark:text-sky-300">
                          {member.memberId}
                        </span>
                        <span className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {member.fullName}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {member.vehiclePlate || 'No plate'} · {member.role}
                      </p>
                    </div>
                    {isSelected ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#0B2C5D] px-2 py-0.5 font-mono text-[11px] font-bold text-white dark:bg-[#034EA2]">
                        <Check className="h-3 w-3" />#{slotIndex + 1}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[11px] font-medium text-slate-400">
                        Select
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Selected row order (1 = Top, 5 = Bottom) */}
          {selectedMembers.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Stack Order (Top → Bottom)
              </p>
              <div className="space-y-1">
                {selectedMembers.map((member, idx) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#0B2C5D] font-mono text-[10px] font-bold text-white">
                        {idx + 1}
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        {member.memberId}
                      </span>
                      <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                        {member.fullName}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveSelected(idx, -1)}
                        aria-label="Move up"
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === selectedMembers.length - 1}
                        onClick={() => moveSelected(idx, 1)}
                        aria-label="Move down"
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleMember(member.id)}
                        aria-label="Remove from print sheet"
                        className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: A4 stacked preview (Front Left | Back Right, 5 rows) */}
        <div className="lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-slate-100/80 p-3 dark:border-slate-700 dark:bg-slate-950/60">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                {previewInverted
                  ? 'Inverted Print Preview (Mirrored Horizontally)'
                  : 'Sheet Layout Preview (Front Left | Back Right)'}
              </div>
              <button
                type="button"
                disabled={selectedMembers.length === 0}
                onClick={() => setPreviewInverted((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <FlipHorizontal2 className="h-3 w-3" />
                {previewInverted ? 'Show Upright Preview' : 'Preview Inverted Output'}
              </button>
            </div>

            {selectedMembers.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/70 p-6 text-center dark:border-slate-700 dark:bg-slate-900/40">
                <IdCard className="mb-2 h-8 w-8 text-slate-400" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Select up to 5 members on the left
                </p>
                <p className="mt-1 max-w-sm text-[11px] text-slate-500 dark:text-slate-400">
                  Each row places Front on the left and Back on the right, stacked 1 to 5 on an A4
                  print sheet. Download automatically exports horizontally inverted for lamination.
                </p>
              </div>
            ) : renderingPreview && !previewDataUrl ? (
              <div className="flex min-h-[260px] items-center justify-center rounded-lg bg-white/80 dark:bg-slate-900/50">
                <p className="text-xs font-medium text-slate-500">Rendering A4 sheet preview...</p>
              </div>
            ) : previewDataUrl ? (
              <div className="mx-auto max-w-[440px] overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
                <img
                  src={previewDataUrl}
                  alt="Batch member ID cards A4 sheet preview"
                  className="block h-auto w-full"
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};
