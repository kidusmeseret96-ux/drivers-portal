import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {DEFAULT_ADA_SETTINGS} from '../db/adaSeed';
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
  type LanguageCode,
} from '../types/ada';

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export function isPortalConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!isPortalConfigured()) {
    throw new Error(
      'Supabase environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are not configured.'
    );
  }
  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return cachedClient;
}

export interface PortalBranding {
  associationName: string;
  logoDataUrl?: string;
  language: LanguageCode;
}

export interface PortalSession {
  token: string;
  mustChangePassword: boolean;
  memberPk: string;
  memberId: string;
  fullName: string;
  role: string;
  isFullAccess: boolean;
}

export interface PortalWorkspace {
  isFullAccess: boolean;
  mustChangePassword: boolean;
  currentMember: AdaMember;
  settings: AdaSettings;
  members: AdaMember[];
  payments: AdaPayment[];
  penalties: AdaPenalty[];
  expenses: AdaExpense[];
  trips: AdaTrip[];
  mutualAid: AdaMutualAidPayout[];
  incidents: AdaIncidentAdvance[];
}

export function getPortalFullAccessRoles(settings: AdaSettings): string[] {
  if (Array.isArray(settings.portalFullAccessRoles)) {
    return settings.portalFullAccessRoles;
  }
  const roles =
    settings.memberRoles && settings.memberRoles.length > 0
      ? settings.memberRoles
      : [...DEFAULT_MEMBER_ROLES];
  return roles.filter((r) => r.trim().toLowerCase() !== 'member');
}

export async function fetchPortalBranding(): Promise<PortalBranding> {
  if (!isPortalConfigured()) {
    return {
      associationName: DEFAULT_ADA_SETTINGS.associationName,
      language: 'en',
    };
  }
  const {data, error} = await getClient().rpc('portal_public_branding');
  if (error || !data) {
    return {
      associationName: DEFAULT_ADA_SETTINGS.associationName,
      language: 'en',
    };
  }
  const d = data as Partial<PortalBranding>;
  return {
    associationName: d.associationName || DEFAULT_ADA_SETTINGS.associationName,
    logoDataUrl: d.logoDataUrl ?? undefined,
    language: (d.language as LanguageCode) || 'en',
  };
}

export async function portalLogin(
  memberId: string,
  password: string
): Promise<PortalSession> {
  const {data, error} = await getClient().rpc('portal_login', {
    p_member_id: memberId.trim(),
    p_password: password,
  });
  if (error || !data) {
    throw new Error(error?.message || 'Invalid Member ID or password.');
  }
  return data as PortalSession;
}

export async function portalChangePassword(
  token: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const {error} = await getClient().rpc('portal_change_password', {
    p_token: token,
    p_current_password: currentPassword,
    p_new_password: newPassword,
  });
  if (error) {
    throw new Error(error.message || 'Failed to update password.');
  }
}

export async function portalLogout(token: string): Promise<void> {
  if (!isPortalConfigured() || !token) return;
  await getClient().rpc('portal_logout', {p_token: token});
}

export async function portalGetWorkspace(token: string): Promise<PortalWorkspace> {
  const {data, error} = await getClient().rpc('portal_get_workspace', {
    p_token: token,
  });
  if (error || !data) {
    throw new Error(error?.message || 'Unable to load portal data.');
  }
  const raw = data as Partial<PortalWorkspace>;
  return {
    isFullAccess: Boolean(raw.isFullAccess),
    mustChangePassword: Boolean(raw.mustChangePassword),
    currentMember: raw.currentMember as AdaMember,
    settings: {
      ...DEFAULT_ADA_SETTINGS,
      ...(raw.settings ?? {}),
      id: 'primary',
    },
    members: Array.isArray(raw.members) ? raw.members : [],
    payments: Array.isArray(raw.payments) ? raw.payments : [],
    penalties: Array.isArray(raw.penalties) ? raw.penalties : [],
    expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
    trips: Array.isArray(raw.trips) ? raw.trips : [],
    mutualAid: Array.isArray(raw.mutualAid) ? raw.mutualAid : [],
    incidents: Array.isArray(raw.incidents) ? raw.incidents : [],
  };
}

export type PortalEntity =
  | 'members'
  | 'payments'
  | 'penalties'
  | 'expenses'
  | 'trips'
  | 'mutualAid'
  | 'incidents'
  | 'settings';

export async function portalAdminMutate(
  token: string,
  entity: PortalEntity,
  record: unknown
): Promise<void> {
  const {error} = await getClient().rpc('portal_admin_mutate', {
    p_token: token,
    p_entity: entity,
    p_record: record,
  });
  if (error) {
    throw new Error(error.message || `Failed to save ${entity}.`);
  }
}

export async function portalAdminResetMemberPassword(
  token: string,
  targetMemberPk: string
): Promise<void> {
  const {error} = await getClient().rpc('portal_admin_reset_member_password', {
    p_token: token,
    p_target_member_pk: targetMemberPk,
  });
  if (error) {
    throw new Error(error.message || 'Failed to reset member password.');
  }
}
