import React, {useState} from 'react';
import {AlertCircle, CheckCircle2, KeyRound} from 'lucide-react';
import {translatePortal} from '../i18n/portalCopy';
import {portalChangePassword} from '../lib/supabasePortal';
import type {LanguageCode} from '../types/ada';
import {ModalShell} from './ModalShell';

interface ChangePasswordModalProps {
  isOpen: boolean;
  token: string;
  memberId: string;
  language: LanguageCode;
  forceDefaultNotice?: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  token,
  memberId,
  language,
  forceDefaultNotice = false,
  onClose,
  onChanged,
}) => {
  const [currentPassword, setCurrentPassword] = useState(forceDefaultNotice ? '0000' : '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 4) {
      setError(translatePortal(language, 'passwordTooShort'));
      return;
    }
    if (newPassword === '0000') {
      setError(translatePortal(language, 'passwordCannotBeDefault'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(translatePortal(language, 'passwordMismatch'));
      return;
    }

    setSaving(true);
    try {
      await portalChangePassword(token, currentPassword, newPassword);
      setSuccess(true);
      onChanged();
      setTimeout(() => {
        setSuccess(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onClose();
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : translatePortal(language, 'unableToChangePassword')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      title={translatePortal(language, 'changePasswordTitle', {memberId})}
      onClose={onClose}
      closeLabel={translatePortal(language, 'closeBtn')}
      maxWidthClass="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {forceDefaultNotice && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            {translatePortal(language, 'changePasswordNotice')}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{translatePortal(language, 'passwordUpdated')}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            {translatePortal(language, 'currentPasswordLabel')}
          </label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={translatePortal(language, 'currentPasswordPlaceholder')}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            {translatePortal(language, 'newPasswordLabel')}
          </label>
          <input
            type="password"
            required
            minLength={4}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            {translatePortal(language, 'confirmPasswordLabel')}
          </label>
          <input
            type="password"
            required
            minLength={4}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {forceDefaultNotice
              ? translatePortal(language, 'laterBtn')
              : translatePortal(language, 'cancelBtn')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2C5D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#034EA2] disabled:opacity-60 dark:bg-[#034EA2]"
          >
            <KeyRound className="h-3.5 w-3.5 text-amber-300" />
            {saving
              ? translatePortal(language, 'updatingBtn')
              : translatePortal(language, 'saveNewPasswordBtn')}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
