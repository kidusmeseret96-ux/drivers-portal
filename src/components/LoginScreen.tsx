import React, {useState} from 'react';
import {AlertCircle, Eye, EyeOff, Lock, ShieldCheck, User} from 'lucide-react';
import {translate} from '../i18n/translations';
import type {AdaSettings} from '../types/ada';
import {ASSOCIATION_AMHARIC_TITLE, ASSOCIATION_LOGO_PATH} from '../utils/idCardExport';

interface LoginScreenProps {
  settings: AdaSettings;
  onUnlock: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({settings, onUnlock}) => {
  const lang = settings.language;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);

  const assocUpper = (
    settings.associationName || 'ADAMA HEAVY TRUCK DRIVERS EDIR'
  ).toUpperCase();
  const expectedUser = (settings.loginUsername || 'admin').trim();
  const expectedPass = settings.loginPassword || 'ada2026';
  const showDefaultHint = expectedUser === 'admin' && expectedPass === 'ada2026';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      username.trim().toLowerCase() === expectedUser.toLowerCase() &&
      password === expectedPass
    ) {
      setError(false);
      onUnlock();
    } else {
      setError(true);
    }
  };

  return (
    <div className="ada-canvas-bg flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#0F172A]">
        {/* Ethiopian Tri-Color Top Stripe */}
        <div className="grid h-1.5 grid-cols-3">
          <div className="bg-[#078930]" />
          <div className="bg-[#FCDD09]" />
          <div className="bg-[#DA121A]" />
        </div>

        {/* Association Letterhead */}
        <div className="bg-[#0B2C5D] px-6 py-6 text-center text-white dark:bg-[#0B172B]">
          <div className="mx-auto mb-3 h-16 w-16 overflow-hidden rounded-full border-2 border-amber-300 bg-white shadow-md">
            <img
              src={settings.logoDataUrl || ASSOCIATION_LOGO_PATH}
              alt={assocUpper}
              className="h-full w-full object-cover"
            />
          </div>
          <p className="text-[11px] font-bold text-amber-300">{ASSOCIATION_AMHARIC_TITLE}</p>
          <h1 className="mt-0.5 font-display text-sm font-extrabold tracking-wide text-white">
            {assocUpper}
          </h1>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-sky-100">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-300" />
            <span>{translate(lang, 'loginTitle')}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{translate(lang, 'loginErrorMsg')}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              {translate(lang, 'loginUsernameLabel')}
            </label>
            <div className="relative mt-1">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError(false);
                }}
                placeholder={expectedUser}
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-xs text-slate-900 focus:border-[#034EA2] focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              {translate(lang, 'loginPasswordLabel')}
            </label>
            <div className="relative mt-1">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(false);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-9 text-xs text-slate-900 focus:border-[#034EA2] focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label="Toggle password visibility"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {showDefaultHint && (
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200">
              Default office sign-in: <strong className="font-mono">admin</strong> /{' '}
              <strong className="font-mono">ada2026</strong> (editable in Settings)
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-[#0B2C5D] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#034EA2] dark:bg-[#034EA2] dark:hover:bg-sky-600"
          >
            {translate(lang, 'loginBtn')}
          </button>
        </form>
      </div>
    </div>
  );
};
