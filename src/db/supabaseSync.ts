import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {
  DEFAULT_MEMBER_ROLES,
  type AdaExpense,
  type AdaIncidentAdvance,
  type AdaMember,
  type AdaMutualAidPayout,
  type AdaPayment,
  type AdaPenalty,
  type AdaSettings,
  type AdaTrip,
} from '../types/ada';
import {
  getAllSyncQueue,
  removeSyncQueueKeys,
  type LoadedAdaState,
} from './adaDb';

export interface SupabaseSyncConfig {
  url: string;
  anonKey: string;
  syncKey: string;
}

export function resolveSupabaseConfig(settings: AdaSettings): SupabaseSyncConfig {
  const envUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL
      ? String(import.meta.env.VITE_SUPABASE_URL)
      : '';
  const envAnon =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY
      ? String(import.meta.env.VITE_SUPABASE_ANON_KEY)
      : '';
  return {
    url: (settings.supabaseUrl || envUrl).trim().replace(/\/+$/, ''),
    anonKey: (settings.supabaseAnonKey || envAnon).trim(),
    syncKey: (settings.supabaseSyncKey || '').trim(),
  };
}

export function isSupabaseSyncConfigured(settings: AdaSettings): boolean {
  const cfg = resolveSupabaseConfig(settings);
  return Boolean(cfg.url && cfg.anonKey && cfg.syncKey.length >= 6);
}

export function getDefaultFullAccessRoles(settings: AdaSettings): string[] {
  if (Array.isArray(settings.portalFullAccessRoles)) {
    return settings.portalFullAccessRoles;
  }
  const allRoles =
    settings.memberRoles && settings.memberRoles.length > 0
      ? settings.memberRoles
      : [...DEFAULT_MEMBER_ROLES];
  return allRoles.filter((r) => r.trim().toLowerCase() !== 'member');
}

function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function sanitizeSettingsForCloud(settings: AdaSettings): AdaSettings {
  const portalFullAccessRoles = getDefaultFullAccessRoles(settings);
  const {
    loginPassword: _lp,
    loginUsername: _lu,
    supabaseUrl: _su,
    supabaseAnonKey: _sak,
    supabaseSyncKey: _ssk,
    ...rest
  } = settings;
  return {
    ...rest,
    portalFullAccessRoles,
  };
}

export async function flushSyncQueueToSupabase(
  settings: AdaSettings
): Promise<{syncedCount: number; syncedAt: string} | null> {
  if (!isSupabaseSyncConfigured(settings)) return null;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;

  const queue = await getAllSyncQueue();
  if (queue.length === 0) return null;

  const cfg = resolveSupabaseConfig(settings);
  const client = createSupabaseClient(cfg.url, cfg.anonKey);

  const payload: Record<string, unknown> = {};
  const members: AdaMember[] = [];
  const payments: AdaPayment[] = [];
  const penalties: AdaPenalty[] = [];
  const expenses: AdaExpense[] = [];
  const trips: AdaTrip[] = [];
  const mutualAid: AdaMutualAidPayout[] = [];
  const incidents: AdaIncidentAdvance[] = [];
  const resetPasswordMemberIds: string[] = [];

  for (const item of queue) {
    switch (item.entity) {
      case 'settings':
        payload.settings = sanitizeSettingsForCloud(item.payload as AdaSettings);
        break;
      case 'members':
        members.push(item.payload as AdaMember);
        break;
      case 'payments':
        payments.push(item.payload as AdaPayment);
        break;
      case 'penalties':
        penalties.push(item.payload as AdaPenalty);
        break;
      case 'expenses':
        expenses.push(item.payload as AdaExpense);
        break;
      case 'trips':
        trips.push(item.payload as AdaTrip);
        break;
      case 'mutualAid':
        mutualAid.push(item.payload as AdaMutualAidPayout);
        break;
      case 'incidents':
        incidents.push(item.payload as AdaIncidentAdvance);
        break;
      case 'resetPin':
        resetPasswordMemberIds.push(item.recordId);
        break;
    }
  }

  if (members.length > 0) payload.members = members;
  if (payments.length > 0) payload.payments = payments;
  if (penalties.length > 0) payload.penalties = penalties;
  if (expenses.length > 0) payload.expenses = expenses;
  if (trips.length > 0) payload.trips = trips;
  if (mutualAid.length > 0) payload.mutualAid = mutualAid;
  if (incidents.length > 0) payload.incidents = incidents;
  if (resetPasswordMemberIds.length > 0) {
    payload.resetPasswordMemberIds = resetPasswordMemberIds;
  }

  const {data, error} = await client.rpc('office_sync_push', {
    p_sync_key: cfg.syncKey,
    p_payload: payload,
  });

  if (error) {
    throw new Error(error.message || 'Failed to upload offline queue to Supabase.');
  }

  await removeSyncQueueKeys(queue.map((q) => q.key));
  const result = data as {syncedCount?: number; syncedAt?: string} | null;
  return {
    syncedCount: result?.syncedCount ?? queue.length,
    syncedAt: result?.syncedAt ?? new Date().toISOString(),
  };
}

export async function pushFullSnapshotToSupabase(
  state: LoadedAdaState
): Promise<{syncedCount: number; syncedAt: string}> {
  if (!isSupabaseSyncConfigured(state.settings)) {
    throw new Error(
      'Enter your Supabase Project URL, Anon Key, and an Office Sync Secret (6+ chars) first.'
    );
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Cannot sync while offline. Changes remain queued locally.');
  }

  const cfg = resolveSupabaseConfig(state.settings);
  const client = createSupabaseClient(cfg.url, cfg.anonKey);
  const queue = await getAllSyncQueue();
  const resetPasswordMemberIds = queue
    .filter((q) => q.entity === 'resetPin')
    .map((q) => q.recordId);

  const payload = {
    settings: sanitizeSettingsForCloud(state.settings),
    members: state.members,
    payments: state.payments,
    penalties: state.penalties,
    expenses: state.expenses,
    trips: state.trips,
    mutualAid: state.mutualAid,
    incidents: state.incidents,
    resetPasswordMemberIds,
  };

  const {data, error} = await client.rpc('office_sync_push', {
    p_sync_key: cfg.syncKey,
    p_payload: payload,
  });

  if (error) {
    throw new Error(error.message || 'Supabase sync push failed.');
  }

  await removeSyncQueueKeys(queue.map((q) => q.key));
  const result = data as {syncedCount?: number; syncedAt?: string} | null;
  return {
    syncedCount: result?.syncedCount ?? state.members.length,
    syncedAt: result?.syncedAt ?? new Date().toISOString(),
  };
}

export async function pullSnapshotFromSupabase(
  settings: AdaSettings
): Promise<Partial<LoadedAdaState>> {
  if (!isSupabaseSyncConfigured(settings)) {
    throw new Error(
      'Enter your Supabase Project URL, Anon Key, and Office Sync Secret first.'
    );
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Cannot pull from Supabase while offline.');
  }

  const cfg = resolveSupabaseConfig(settings);
  const client = createSupabaseClient(cfg.url, cfg.anonKey);

  const {data, error} = await client.rpc('office_sync_pull', {
    p_sync_key: cfg.syncKey,
  });

  if (error) {
    throw new Error(error.message || 'Failed to pull records from Supabase.');
  }

  const snap = (data ?? {}) as Partial<LoadedAdaState>;
  return {
    settings: snap.settings,
    members: Array.isArray(snap.members) ? snap.members : [],
    payments: Array.isArray(snap.payments) ? snap.payments : [],
    penalties: Array.isArray(snap.penalties) ? snap.penalties : [],
    expenses: Array.isArray(snap.expenses) ? snap.expenses : [],
    trips: Array.isArray(snap.trips) ? snap.trips : [],
    mutualAid: Array.isArray(snap.mutualAid) ? snap.mutualAid : [],
    incidents: Array.isArray(snap.incidents) ? snap.incidents : [],
  };
}
