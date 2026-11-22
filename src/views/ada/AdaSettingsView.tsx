import React, {useEffect, useState} from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CloudUpload,
  CloudDownload,
  Download,
  Eye,
  EyeOff,
  Globe,
  Languages,
  Lock,
  Moon,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Stamp,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import {ModalShell} from '../../components/ModalShell';
import {getDefaultFullAccessRoles, isSupabaseSyncConfigured} from '../../db/supabaseSync';
import {LANGUAGE_OPTIONS, translate, translateRole} from '../../i18n/translations';
import {
  type AdaFullBackup,
  type AdaSettings,
  type CategoryConfig,
  DEFAULT_MEMBER_ROLES,
  type LanguageCode,
} from '../../types/ada';
import {
  compressImageToDataUrl,
  createId,
  downloadJson,
  todayIsoDate,
} from '../../utils/formatters';
import {ASSOCIATION_LOGO_PATH} from '../../utils/idCardExport';

interface AdaSettingsViewProps {
  settings: AdaSettings;
  onSaveSettings: (next: AdaSettings) => Promise<void>;
  onBuildBackup: () => AdaFullBackup;
  onRestoreBackup: (backup: AdaFullBackup) => Promise<void>;
  onResetDemoData: () => Promise<void>;
  onPushAllToSupabase?: (settingsOverride?: AdaSettings) => Promise<{syncedCount: number; syncedAt: string}>;
  onPullFromSupabase?: (settingsOverride?: AdaSettings) => Promise<void>;
}

function CategoryManager({
  lang,
  title,
  subtitle,
  items,
  currency,
  onChange,
}: {
  lang: LanguageCode;
  title: string;
  subtitle: string;
  items: CategoryConfig[];
  currency: string;
  onChange: (next: CategoryConfig[]) => void;
}) {
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState(100);
  const [previewAttachment, setPreviewAttachment] = useState<{name: string; url: string} | null>(
    null
  );

  const visibleItems = items.filter((i) => !i.archived);

  const handleAttach = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      onChange(
        items.map((item) =>
          item.id === id
            ? {...item, attachmentDataUrl: dataUrl, attachmentName: file.name}
            : item
        )
      );
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className="ada-surface rounded-xl border p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>

      <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {visibleItems.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
          >
            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={item.name}
                onChange={(e) =>
                  onChange(
                    items.map((it) =>
                      it.id === item.id ? {...it, name: e.target.value} : it
                    )
                  )
                }
                aria-label={item.name}
                className="w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 font-medium text-slate-900 hover:border-slate-200 focus:border-slate-300 focus:bg-white focus:outline-none dark:text-slate-100 dark:hover:border-slate-700 dark:focus:border-slate-700 dark:focus:bg-slate-950"
              />
              {item.attachmentName && (
                <button
                  type="button"
                  onClick={() =>
                    setPreviewAttachment({
                      name: item.attachmentName ?? 'Attachment',
                      url: item.attachmentDataUrl ?? '',
                    })
                  }
                  className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-amber-700 hover:underline dark:text-amber-400"
                >
                  <Eye className="h-3 w-3" />
                  {translate(lang, 'view')} {item.attachmentName}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="font-mono text-[11px] text-slate-500">{currency}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.defaultAmount}
                  onChange={(e) =>
                    onChange(
                      items.map((it) =>
                        it.id === item.id
                          ? {...it, defaultAmount: Number(e.target.value) || 0}
                          : it
                      )
                    )
                  }
                  className="w-24 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
                <Upload className="h-3 w-3" />
                {translate(lang, 'file')}
                <input
                  type="file"
                  onChange={(e) => handleAttach(item.id, e)}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                title={translate(lang, 'delete')}
                onClick={() =>
                  onChange(
                    items.map((it) => (it.id === item.id ? {...it, archived: true} : it))
                  )
                }
                className="rounded border border-red-200 p-1 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={translate(lang, 'newCategoryPlaceholder')}
          className="flex-1 min-w-[160px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={newAmount}
          onChange={(e) => setNewAmount(Number(e.target.value) || 0)}
          className="w-24 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={() => {
            if (!newName.trim()) return;
            onChange([
              ...items,
              {
                id: createId('cat'),
                name: newName.trim(),
                defaultAmount: newAmount,
                archived: false,
              },
            ]);
            setNewName('');
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-amber-600"
        >
          <Plus className="h-3.5 w-3.5" />
          {translate(lang, 'add')}
        </button>
      </div>

      <ModalShell
        isOpen={Boolean(previewAttachment)}
        title={previewAttachment?.name ?? ''}
        onClose={() => setPreviewAttachment(null)}
        closeLabel={translate(lang, 'close')}
        maxWidthClass="max-w-md"
      >
        {previewAttachment && (
          <div className="space-y-3">
            {previewAttachment.url.startsWith('data:image/') ? (
              <img
                src={previewAttachment.url}
                alt={previewAttachment.name}
                className="max-h-72 w-full rounded object-contain"
              />
            ) : (
              <a
                href={previewAttachment.url}
                download={previewAttachment.name}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2C5D] px-3 py-2 text-xs font-semibold text-white"
              >
                <Download className="h-3.5 w-3.5" />
                {translate(lang, 'downloadAttachedFile')}
              </a>
            )}
          </div>
        )}
      </ModalShell>
    </section>
  );
}

export const AdaSettingsView: React.FC<AdaSettingsViewProps> = ({
  settings,
  onSaveSettings,
  onBuildBackup,
  onRestoreBackup,
  onResetDemoData,
  onPushAllToSupabase,
  onPullFromSupabase,
}) => {
  const lang = settings.language;
  const [form, setForm] = useState<AdaSettings>(settings);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [newRoleInput, setNewRoleInput] = useState('');
  const [newMemberRoleInput, setNewMemberRoleInput] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [showSyncKey, setShowSyncKey] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const activeMemberRoles =
    form.memberRoles && form.memberRoles.length > 0
      ? form.memberRoles
      : [...DEFAULT_MEMBER_ROLES];

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const {dataUrl} = await compressImageToDataUrl(file, 720, 0.88, true);
    const updated = {...form, logoDataUrl: dataUrl};
    setForm(updated);
    await onSaveSettings(updated);
    showNotice(translate(updated.language, 'settingsSavedNotice'));
    e.target.value = '';
  };

  const handleResetLogo = async () => {
    const updated = {...form, logoDataUrl: undefined};
    setForm(updated);
    await onSaveSettings(updated);
    showNotice(translate(updated.language, 'settingsSavedNotice'));
  };

  const handleStampUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const {dataUrl} = await compressImageToDataUrl(file, 700, 0.9, true);
    const updated = {...form, officialStampDataUrl: dataUrl};
    setForm(updated);
    await onSaveSettings(updated);
    showNotice(translate(updated.language, 'settingsSavedNotice'));
    e.target.value = '';
  };

  const handleClearStamp = async () => {
    const updated = {...form, officialStampDataUrl: undefined};
    setForm(updated);
    await onSaveSettings(updated);
    showNotice(translate(updated.language, 'settingsSavedNotice'));
  };

  const handleChairmanSigUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const {dataUrl} = await compressImageToDataUrl(file, 700, 0.9, true);
    const updated = {...form, chairmanSignatureDataUrl: dataUrl};
    setForm(updated);
    await onSaveSettings(updated);
    showNotice(translate(updated.language, 'settingsSavedNotice'));
    e.target.value = '';
  };

  const handleClearChairmanSig = async () => {
    const updated = {...form, chairmanSignatureDataUrl: undefined};
    setForm(updated);
    await onSaveSettings(updated);
    showNotice(translate(updated.language, 'settingsSavedNotice'));
  };

  const handleAddMemberRole = async () => {
    const clean = newMemberRoleInput.trim();
    if (!clean) return;
    const exists = activeMemberRoles.some(
      (r) => r.toLowerCase() === clean.toLowerCase()
    );
    if (!exists) {
      const nextPortalFull =
        Array.isArray(form.portalFullAccessRoles) && clean.toLowerCase() !== 'member'
          ? [
              ...form.portalFullAccessRoles.filter(
                (r) => r.toLowerCase() !== clean.toLowerCase()
              ),
              clean,
            ]
          : form.portalFullAccessRoles;
      const updated = {
        ...form,
        memberRoles: [...activeMemberRoles, clean],
        portalFullAccessRoles: nextPortalFull,
      };
      setForm(updated);
      await onSaveSettings(updated);
      showNotice(translate(updated.language, 'settingsSavedNotice'));
    }
    setNewMemberRoleInput('');
  };

  const handleRemoveMemberRole = async (roleToRemove: string) => {
    if (roleToRemove === 'Member') return;
    const nextRoles = activeMemberRoles.filter((r) => r !== roleToRemove);
    const nextPortalFull = Array.isArray(form.portalFullAccessRoles)
      ? form.portalFullAccessRoles.filter((r) => r !== roleToRemove)
      : form.portalFullAccessRoles;
    const updated = {
      ...form,
      memberRoles: nextRoles.length > 0 ? nextRoles : ['Member'],
      portalFullAccessRoles: nextPortalFull,
    };
    setForm(updated);
    await onSaveSettings(updated);
  };

  const handleLanguageChange = async (nextLang: LanguageCode) => {
    const updated = {...form, language: nextLang};
    setForm(updated);
    await onSaveSettings(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings(form);
    showNotice(translate(form.language, 'settingsSavedNotice'));
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || '')) as AdaFullBackup;
        if (!parsed || !Array.isArray(parsed.members)) {
          showNotice(translate(lang, 'backupInvalidNotice'));
          return;
        }
        await onRestoreBackup(parsed);
        showNotice(translate(lang, 'backupRestoredNotice'));
      } catch {
        showNotice(translate(lang, 'backupFailedNotice'));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {translate(lang, 'settings')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {translate(lang, 'settingsSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => showNotice(translate(lang, 'updateOnlineNotice'))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {translate(lang, 'updateOnlineBtn')}
          </button>
          <button
            type="button"
            onClick={() =>
              onSaveSettings({
                ...form,
                theme: form.theme === 'dark' ? 'light' : 'dark',
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {form.theme === 'dark' ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
            {form.theme === 'dark' ? translate(lang, 'lightModeBtn') : translate(lang, 'darkModeBtn')}
          </button>
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Core Profile & Language */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="ada-surface rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {translate(lang, 'secProfileLanguage')}
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(lang, 'associationNameLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={form.associationName}
                  onChange={(e) => setForm({...form, associationName: e.target.value})}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(lang, 'currentUserLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={form.currentUserName}
                  onChange={(e) => setForm({...form, currentUserName: e.target.value})}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <Languages className="h-3.5 w-3.5 text-slate-500" />
                  {translate(lang, 'languageLabel')}
                </label>
                <select
                  value={form.language}
                  onChange={(e) => handleLanguageChange(e.target.value as LanguageCode)}
                  aria-label={translate(lang, 'languageLabel')}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  {LANGUAGE_OPTIONS.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label} ({l.nativeLabel})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {translate(lang, 'languageInstantHint')}
                </p>
              </div>

              <div className="sm:col-span-2 flex flex-wrap gap-1.5">
                {LANGUAGE_OPTIONS.map((l) => {
                  const selected = form.language === l.code;
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => handleLanguageChange(l.code)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        selected
                          ? 'border-[#0B2C5D] bg-[#0B2C5D] text-white dark:border-[#034EA2] dark:bg-[#034EA2]'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {l.nativeLabel}
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(lang, 'currencyLabel')}
                </label>
                <input
                  type="text"
                  readOnly
                  value={translate(lang, 'currencyReadOnlyValue')}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(lang, 'memberIdFormatLabel')}
                </label>
                <input
                  type="text"
                  readOnly
                  value={translate(lang, 'memberIdFormatValue')}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
                />
              </div>

              {/* Association Logo Upload */}
              <div className="sm:col-span-2 border-t border-slate-200 pt-3 dark:border-slate-800 space-y-2.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(lang, 'associationLogoLabel')}
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-[#034EA2] bg-white shadow-xs dark:border-sky-400">
                    <img
                      src={form.logoDataUrl || ASSOCIATION_LOGO_PATH}
                      alt={form.associationName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#0B2C5D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#034EA2] dark:bg-[#034EA2] dark:hover:bg-sky-600">
                      <Upload className="h-3.5 w-3.5 text-amber-300" />
                      {translate(lang, 'uploadLogoBtn')}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                    {form.logoDataUrl && (
                      <button
                        type="button"
                        onClick={handleResetLogo}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {translate(lang, 'resetDefaultLogoBtn')}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {translate(lang, 'logoSettingsHint')}
                </p>
              </div>

              {/* Member Roles Manager */}
              <div className="sm:col-span-2 border-t border-slate-200 pt-3 dark:border-slate-800 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {translate(lang, 'memberRolesLabel')}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {translate(lang, 'memberRolesHint')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeMemberRoles.map((roleName) => (
                    <span
                      key={roleName}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {translateRole(lang, roleName)}
                      {roleName !== 'Member' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMemberRole(roleName)}
                          aria-label={`${translate(lang, 'delete')} ${roleName}`}
                          className="text-slate-400 hover:text-red-600"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newMemberRoleInput}
                    onChange={(e) => setNewMemberRoleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddMemberRole();
                      }
                    }}
                    placeholder={translate(lang, 'addMemberRolePlaceholder')}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddMemberRole}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                  >
                    {translate(lang, 'addRoleBtn')}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Monthly Due Rules & Payment Approvals */}
          <section className="ada-surface rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {translate(lang, 'secDueRulesApproval')}
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(lang, 'monthlyAmountEtbLabel')}
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.monthlyDueAmount}
                  onChange={(e) =>
                    setForm({...form, monthlyDueAmount: Number(e.target.value) || 0})
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(lang, 'dueDayMonthLabel')}
                </label>
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={form.monthlyDueDay}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      monthlyDueDay: Math.max(1, Math.min(28, Number(e.target.value) || 5)),
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(lang, 'dailyLateChargeEtbLabel')}
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.dailyLateCharge}
                  onChange={(e) =>
                    setForm({...form, dailyLateCharge: Number(e.target.value) || 0})
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(lang, 'monthlyTargetEtbLabel')}
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.monthlyDuesTarget}
                  onChange={(e) =>
                    setForm({...form, monthlyDuesTarget: Number(e.target.value) || 0})
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 dark:border-slate-800 space-y-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.requirePaymentApproval}
                  onChange={(e) =>
                    setForm({...form, requirePaymentApproval: e.target.checked})
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                {translate(lang, 'requireApprovalCheckbox')}
              </label>

              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(lang, 'reviewerRolesLabel')}
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {form.reviewerRoles.map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {role}
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            reviewerRoles: form.reviewerRoles.filter((r) => r !== role),
                          })
                        }
                        className="text-slate-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={newRoleInput}
                    onChange={(e) => setNewRoleInput(e.target.value)}
                    placeholder={translate(lang, 'addReviewerRolePlaceholder')}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newRoleInput.trim()) return;
                      if (!form.reviewerRoles.includes(newRoleInput.trim())) {
                        setForm({
                          ...form,
                          reviewerRoles: [...form.reviewerRoles, newRoleInput.trim()],
                        });
                      }
                      setNewRoleInput('');
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                  >
                    {translate(lang, 'addRoleBtn')}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Official Stamp, Chairman Signature, Calendar & Office Login Security */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="ada-surface rounded-xl p-5 space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Stamp className="h-4 w-4 text-[#034EA2] dark:text-sky-400" />
              {translate(lang, 'stampAndChairmanTitle')}
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Official Stamp Upload */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60 space-y-2">
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(lang, 'officialStampLabel')}
                </span>
                <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                  {form.officialStampDataUrl ? (
                    <img
                      src={form.officialStampDataUrl}
                      alt={translate(lang, 'officialStampLabel')}
                      className="max-h-16 max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      {translate(lang, 'officialStampBoxLabel')}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-[#0B2C5D] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#034EA2] dark:bg-[#034EA2]">
                    <Upload className="h-3 w-3 text-amber-300" />
                    {translate(lang, 'uploadStampBtn')}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleStampUpload}
                      className="hidden"
                    />
                  </label>
                  {form.officialStampDataUrl && (
                    <button
                      type="button"
                      onClick={handleClearStamp}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:border-slate-700 dark:bg-slate-800 dark:text-red-400"
                    >
                      {translate(lang, 'clearBtn')}
                    </button>
                  )}
                </div>
              </div>

              {/* Chairman / Authority Signature Upload */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60 space-y-2">
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(lang, 'chairmanSignatureLabel')}
                </span>
                <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                  {form.chairmanSignatureDataUrl ? (
                    <img
                      src={form.chairmanSignatureDataUrl}
                      alt={translate(lang, 'chairmanSignatureLabel')}
                      className="max-h-16 max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      {translate(lang, 'signatureLineLabel')}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-[#0B2C5D] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#034EA2] dark:bg-[#034EA2]">
                    <Upload className="h-3 w-3 text-amber-300" />
                    {translate(lang, 'uploadSignatureBtn')}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleChairmanSigUpload}
                      className="hidden"
                    />
                  </label>
                  {form.chairmanSignatureDataUrl && (
                    <button
                      type="button"
                      onClick={handleClearChairmanSig}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:border-slate-700 dark:bg-slate-800 dark:text-red-400"
                    >
                      {translate(lang, 'clearBtn')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-3 dark:border-slate-800 sm:grid-cols-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.showEthiopianCalendar !== false}
                  onChange={(e) =>
                    setForm({...form, showEthiopianCalendar: e.target.checked})
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                <Calendar className="h-3.5 w-3.5 text-[#034EA2] dark:text-sky-400" />
                <span>{translate(lang, 'showEthiopianCalCheckbox')}</span>
              </label>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <Globe className="h-3.5 w-3.5 text-slate-500" />
                  {translate(lang, 'defaultPrintLanguageLabel')}
                </label>
                <select
                  value={form.defaultPrintLanguage ?? form.language}
                  onChange={(e) =>
                    setForm({...form, defaultPrintLanguage: e.target.value as LanguageCode})
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  {LANGUAGE_OPTIONS.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.nativeLabel} ({l.label})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Office Login Credentials & Screen Lock */}
          <section className="ada-surface rounded-xl p-5 space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Lock className="h-4 w-4 text-[#034EA2] dark:text-sky-400" />
              {translate(lang, 'officeSecurityTitle')}
            </h2>

            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.requireLogin !== false}
                onChange={(e) => setForm({...form, requireLogin: e.target.checked})}
                className="h-4 w-4 rounded border-slate-300"
              />
              {translate(lang, 'requireLoginCheckbox')}
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(lang, 'loginUsernameLabel')}
                </label>
                <input
                  type="text"
                  required={form.requireLogin !== false}
                  value={form.loginUsername ?? 'admin'}
                  onChange={(e) => setForm({...form, loginUsername: e.target.value})}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(lang, 'loginPasswordLabel')}
                </label>
                <div className="relative mt-1">
                  <input
                    type={showLoginPass ? 'text' : 'password'}
                    required={form.requireLogin !== false}
                    value={form.loginPassword ?? 'ada2026'}
                    onChange={(e) => setForm({...form, loginPassword: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPass((prev) => !prev)}
                    aria-label="Toggle password visibility"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {showLoginPass ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Category & Penalty Preset Managers */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <CategoryManager
            lang={lang}
            title={translate(lang, 'incomingCatsTitle')}
            subtitle={translate(lang, 'incomingCatsSub')}
            items={form.incomingCategories}
            currency={form.currency}
            onChange={(next) => setForm({...form, incomingCategories: next})}
          />
          <CategoryManager
            lang={lang}
            title={translate(lang, 'outgoingCatsTitle')}
            subtitle={translate(lang, 'outgoingCatsSub')}
            items={form.outgoingCategories}
            currency={form.currency}
            onChange={(next) => setForm({...form, outgoingCategories: next})}
          />
          <CategoryManager
            lang={lang}
            title={translate(lang, 'penaltyPresetsTitle')}
            subtitle={translate(lang, 'penaltyPresetsSub')}
            items={form.penaltyPresets}
            currency={form.currency}
            onChange={(next) => setForm({...form, penaltyPresets: next})}
          />
        </div>

        {/* Supabase Cloud Sync & Cloudflare Member Portal */}
        <section className="ada-surface rounded-xl p-5 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <ShieldCheck className="h-4 w-4 text-[#034EA2] dark:text-sky-400" />
                Supabase Cloud Sync &amp; Cloudflare Member Portal
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Works 100% offline in IndexedDB and uploads changes to Supabase whenever online so members &amp; office role holders can sign in via the Cloudflare portal.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Supabase Project URL
              </label>
              <input
                type="url"
                value={form.supabaseUrl ?? ''}
                onChange={(e) => setForm({...form, supabaseUrl: e.target.value})}
                placeholder="https://your-project.supabase.co"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Supabase Anon Public Key
              </label>
              <input
                type="text"
                value={form.supabaseAnonKey ?? ''}
                onChange={(e) => setForm({...form, supabaseAnonKey: e.target.value})}
                placeholder="eyJhbGciOi..."
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Office Sync Secret (6+ chars)
              </label>
              <div className="relative mt-1">
                <input
                  type={showSyncKey ? 'text' : 'password'}
                  value={form.supabaseSyncKey ?? ''}
                  onChange={(e) => setForm({...form, supabaseSyncKey: e.target.value})}
                  placeholder="Choose a secret passphrase"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowSyncKey((prev) => !prev)}
                  aria-label="Toggle sync secret visibility"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {showSyncKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 dark:border-slate-800 space-y-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.autoSyncOnline !== false}
                onChange={(e) => setForm({...form, autoSyncOnline: e.target.checked})}
                className="h-4 w-4 rounded border-slate-300"
              />
              Automatically upload offline changes to Supabase whenever internet is available
            </label>

            <div>
              <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Roles with Full Office Access on Cloudflare Portal
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Members with checked roles log in with their Member ID (default PIN 0000) and see the full association office app. Unchecked roles (like Member) only see their own profile, ID card, payments, and trips.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {activeMemberRoles
                  .filter((r) => r.trim().toLowerCase() !== 'member')
                  .map((roleName) => {
                    const fullRoles = getDefaultFullAccessRoles(form);
                    const checked = fullRoles.some(
                      (r) => r.toLowerCase() === roleName.toLowerCase()
                    );
                    return (
                      <label
                        key={roleName}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const current = getDefaultFullAccessRoles(form);
                            const next = e.target.checked
                              ? [...current.filter((r) => r !== roleName), roleName]
                              : current.filter((r) => r.toLowerCase() !== roleName.toLowerCase());
                            setForm({...form, portalFullAccessRoles: next});
                          }}
                          className="h-3.5 w-3.5 rounded border-slate-300"
                        />
                        {translateRole(lang, roleName)}
                      </label>
                    );
                  })}
              </div>
            </div>
          </div>

          {syncError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {syncError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {onPushAllToSupabase && (
              <button
                type="button"
                disabled={isSyncing}
                onClick={async () => {
                  setSyncError(null);
                  setIsSyncing(true);
                  try {
                    await onSaveSettings(form);
                    const res = await onPushAllToSupabase(form);
                    showNotice(
                      `Uploaded ${res.syncedCount} records to Supabase. New members can sign in with Member ID + PIN 0000.`
                    );
                  } catch (err) {
                    setSyncError(err instanceof Error ? err.message : 'Sync push failed.');
                  } finally {
                    setIsSyncing(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2C5D] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#034EA2] disabled:opacity-60 dark:bg-[#034EA2]"
              >
                <CloudUpload className="h-3.5 w-3.5 text-amber-300" />
                {isSyncing ? 'Syncing...' : 'Upload All Offline Data to Supabase'}
              </button>
            )}
            {onPullFromSupabase && (
              <button
                type="button"
                disabled={isSyncing || !isSupabaseSyncConfigured(form)}
                onClick={async () => {
                  setSyncError(null);
                  setIsSyncing(true);
                  try {
                    await onSaveSettings(form);
                    await onPullFromSupabase(form);
                    showNotice('Pulled latest records from Supabase into offline storage.');
                  } catch (err) {
                    setSyncError(err instanceof Error ? err.message : 'Sync pull failed.');
                  } finally {
                    setIsSyncing(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <CloudDownload className="h-3.5 w-3.5" />
                Pull Latest From Supabase
              </button>
            )}
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-[#0B2C5D] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[#034EA2] dark:bg-[#034EA2] dark:hover:bg-sky-600"
          >
            {translate(lang, 'saveAllSettingsBtn')}
          </button>
        </div>
      </form>

      {/* Demo Data & Portable Backup Controls */}
      <section className="ada-surface rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {translate(lang, 'backupControlsTitle')}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              downloadJson(`ada-system-backup-${todayIsoDate()}.json`, onBuildBackup());
              showNotice(translate(lang, 'backupExportedNotice'));
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2C5D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#034EA2] dark:bg-[#034EA2] dark:hover:bg-sky-600"
          >
            <Download className="h-3.5 w-3.5 text-amber-300" />
            {translate(lang, 'exportAllJsonBtn')}
          </button>

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Upload className="h-3.5 w-3.5" />
            {translate(lang, 'importBackupJsonBtn')}
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {translate(lang, 'resetDemoBtn')}
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs dark:border-red-900/50 dark:bg-red-950/30">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
              <span className="text-red-800 dark:text-red-300">
                {translate(lang, 'resetDemoConfirmPrompt')}
              </span>
              <button
                type="button"
                onClick={async () => {
                  await onResetDemoData();
                  setConfirmReset(false);
                  showNotice(translate(lang, 'demoResetNotice'));
                }}
                className="rounded bg-red-600 px-2.5 py-1 font-semibold text-white"
              >
                {translate(lang, 'confirm')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-700"
              >
                {translate(lang, 'cancel')}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
