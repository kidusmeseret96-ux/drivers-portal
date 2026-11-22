import type {
  AdaExpense,
  AdaFullBackup,
  AdaIncidentAdvance,
  AdaMember,
  AdaMutualAidPayout,
  AdaPayment,
  AdaPenalty,
  AdaSettings,
  AdaSyncQueueItem,
  AdaTrip,
  SyncQueueEntity,
} from '../types/ada';
import {
  DEFAULT_ADA_SETTINGS,
  SEED_ADA_EXPENSES,
  SEED_ADA_INCIDENTS,
  SEED_ADA_MEMBERS,
  SEED_ADA_MUTUAL_AID,
  SEED_ADA_PAYMENTS,
  SEED_ADA_PENALTIES,
  SEED_ADA_TRIPS,
} from './adaSeed';

const DB_NAME = 'ADAOfficeDB';
const DB_VERSION = 4;
const SYNC_QUEUE_STORE = 'syncQueue';

export type AdaStoreName =
  | 'members'
  | 'payments'
  | 'penalties'
  | 'expenses'
  | 'trips'
  | 'mutualAid'
  | 'incidents'
  | 'settings';
const ALL_STORES: AdaStoreName[] = [
  'members',
  'payments',
  'penalties',
  'expenses',
  'trips',
  'mutualAid',
  'incidents',
  'settings',
];

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of ALL_STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, {keyPath: 'id'});
        }
      }
      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        db.createObjectStore(SYNC_QUEUE_STORE, {keyPath: 'key'});
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open ADAOfficeDB'));
  });
}

function reqPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function txComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export async function getAllAda<T>(storeName: AdaStoreName): Promise<T[]> {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readonly');
  const data = await reqPromise(tx.objectStore(storeName).getAll());
  await txComplete(tx);
  db.close();
  return data as T[];
}

export async function putAda<T extends {id: string}>(
  storeName: AdaStoreName,
  record: T
): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(record);
  await txComplete(tx);
  db.close();
}

export async function bulkPutAda<T extends {id: string}>(
  storeName: AdaStoreName,
  records: T[]
): Promise<void> {
  if (records.length === 0) return;
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  for (const r of records) store.put(r);
  await txComplete(tx);
  db.close();
}

export async function enqueueSyncItem(
  entity: SyncQueueEntity,
  recordId: string,
  payload: unknown
): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
  const item: AdaSyncQueueItem = {
    key: `${entity}:${recordId}`,
    entity,
    recordId,
    payload,
    queuedAt: new Date().toISOString(),
  };
  tx.objectStore(SYNC_QUEUE_STORE).put(item);
  await txComplete(tx);
  db.close();
}

export async function enqueueBulkSyncItems<T extends {id: string}>(
  entity: SyncQueueEntity,
  records: T[]
): Promise<void> {
  if (records.length === 0) return;
  const db = await openDatabase();
  const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
  const store = tx.objectStore(SYNC_QUEUE_STORE);
  const now = new Date().toISOString();
  for (const record of records) {
    const item: AdaSyncQueueItem = {
      key: `${entity}:${record.id}`,
      entity,
      recordId: record.id,
      payload: record,
      queuedAt: now,
    };
    store.put(item);
  }
  await txComplete(tx);
  db.close();
}

export async function getAllSyncQueue(): Promise<AdaSyncQueueItem[]> {
  const db = await openDatabase();
  const tx = db.transaction(SYNC_QUEUE_STORE, 'readonly');
  const data = await reqPromise(tx.objectStore(SYNC_QUEUE_STORE).getAll());
  await txComplete(tx);
  db.close();
  return data as AdaSyncQueueItem[];
}

export async function removeSyncQueueKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const db = await openDatabase();
  const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
  const store = tx.objectStore(SYNC_QUEUE_STORE);
  for (const k of keys) store.delete(k);
  await txComplete(tx);
  db.close();
}

export interface LoadedAdaState {
  settings: AdaSettings;
  members: AdaMember[];
  payments: AdaPayment[];
  penalties: AdaPenalty[];
  expenses: AdaExpense[];
  trips: AdaTrip[];
  mutualAid: AdaMutualAidPayout[];
  incidents: AdaIncidentAdvance[];
}

export async function initAndLoadAdaDb(): Promise<LoadedAdaState> {
  const settingsRows = await getAllAda<AdaSettings>('settings');
  const existing = settingsRows.find((s) => s.id === 'primary');

  if (!existing) {
    const db = await openDatabase();
    const tx = db.transaction(ALL_STORES, 'readwrite');
    tx.objectStore('settings').put(DEFAULT_ADA_SETTINGS);
    for (const m of SEED_ADA_MEMBERS) tx.objectStore('members').put(m);
    for (const p of SEED_ADA_PAYMENTS) tx.objectStore('payments').put(p);
    for (const l of SEED_ADA_PENALTIES) tx.objectStore('penalties').put(l);
    for (const e of SEED_ADA_EXPENSES) tx.objectStore('expenses').put(e);
    for (const t of SEED_ADA_TRIPS) tx.objectStore('trips').put(t);
    for (const a of SEED_ADA_MUTUAL_AID) tx.objectStore('mutualAid').put(a);
    for (const inc of SEED_ADA_INCIDENTS) tx.objectStore('incidents').put(inc);
    await txComplete(tx);
    db.close();

    return {
      settings: DEFAULT_ADA_SETTINGS,
      members: SEED_ADA_MEMBERS,
      payments: SEED_ADA_PAYMENTS,
      penalties: SEED_ADA_PENALTIES,
      expenses: SEED_ADA_EXPENSES,
      trips: SEED_ADA_TRIPS,
      mutualAid: SEED_ADA_MUTUAL_AID,
      incidents: SEED_ADA_INCIDENTS,
    };
  }

  const [members, payments, penalties, expenses, tripsRaw, mutualAidRaw, incidentsRaw] =
    await Promise.all([
      getAllAda<AdaMember>('members'),
      getAllAda<AdaPayment>('payments'),
      getAllAda<AdaPenalty>('penalties'),
      getAllAda<AdaExpense>('expenses'),
      getAllAda<AdaTrip>('trips'),
      getAllAda<AdaMutualAidPayout>('mutualAid'),
      getAllAda<AdaIncidentAdvance>('incidents'),
    ]);

  let trips = tripsRaw;
  let mutualAid = mutualAidRaw;
  let incidents = incidentsRaw;

  // Backfill v2/v3 object stores safely if upgrading from older DB versions
  if (trips.length === 0 && members.length > 0) {
    trips = SEED_ADA_TRIPS;
    await bulkPutAda('trips', trips);
  }
  if (mutualAid.length === 0 && members.length > 0) {
    mutualAid = SEED_ADA_MUTUAL_AID;
    await bulkPutAda('mutualAid', mutualAid);
  }
  if (incidents.length === 0 && members.length > 0) {
    incidents = SEED_ADA_INCIDENTS;
    await bulkPutAda('incidents', incidents);
  }

  // Normalize any legacy member roles / gender & backfill missing insurance on seed IDs
  const legacyRoleMap: Record<string, AdaMember['role']> = {
    Driver: 'Member',
    'Owner-Driver': 'Member',
    Coordinator: 'Vice manager',
    Committee: 'Chairperson',
    Dispatcher: 'Member',
  };
  const seedMemberMap = new Map(SEED_ADA_MEMBERS.map((sm) => [sm.id, sm]));
  const migratedMembers: AdaMember[] = [];
  const normalizedMembers = members.map((m) => {
    const rawRole = m.role as string;
    const rawGender = m.gender as string;
    const nextRole = legacyRoleMap[rawRole] ?? m.role;
    const nextGender: AdaMember['gender'] =
      rawGender === 'Female' || rawGender === 'Male' ? rawGender : 'Male';
    const seedMatch = seedMemberMap.get(m.id);
    const needsInsuranceBackfill = Boolean(
      seedMatch && (!m.insurancePolicyNumber || !m.medicalExpiry || !m.highwayClearanceExpiry)
    );

    if (nextRole !== m.role || nextGender !== m.gender || needsInsuranceBackfill) {
      const updated: AdaMember = {
        ...m,
        role: nextRole,
        gender: nextGender,
        vehicleMakeModel: m.vehicleMakeModel ?? seedMatch?.vehicleMakeModel,
        trailerPlateOrChassis: m.trailerPlateOrChassis ?? seedMatch?.trailerPlateOrChassis,
        boloExpiry: m.boloExpiry ?? seedMatch?.boloExpiry,
        insuranceProvider: m.insuranceProvider ?? seedMatch?.insuranceProvider,
        insurancePolicyNumber: m.insurancePolicyNumber ?? seedMatch?.insurancePolicyNumber,
        insuranceType: m.insuranceType ?? seedMatch?.insuranceType,
        insuranceExpiry: m.insuranceExpiry ?? seedMatch?.insuranceExpiry,
        medicalExpiry: m.medicalExpiry ?? seedMatch?.medicalExpiry,
        highwayClearanceExpiry:
          m.highwayClearanceExpiry ?? seedMatch?.highwayClearanceExpiry,
      };
      migratedMembers.push(updated);
      return updated;
    }
    return m;
  });
  if (migratedMembers.length > 0) {
    await bulkPutAda('members', migratedMembers);
  }

  let normalizedSettings = existing;
  const trimmedName = (existing.associationName || '').trim();
  const isLegacyDefaultName =
    !trimmedName ||
    (/drivers|association|\bada\b|edir/i.test(trimmedName) &&
      trimmedName !== DEFAULT_ADA_SETTINGS.associationName);
  const needsMemberRolesBackfill =
    !Array.isArray(existing.memberRoles) || existing.memberRoles.length === 0;
  const needsRolesV2Seed = !existing.rolesSeededV2;
  const needsAuthOrCalBackfill =
    existing.requireLogin === undefined ||
    !existing.loginUsername ||
    !existing.loginPassword ||
    existing.showEthiopianCalendar === undefined;
  const needsSettingsUpdate =
    (existing.language as string) === 'tig' ||
    isLegacyDefaultName ||
    needsMemberRolesBackfill ||
    needsRolesV2Seed ||
    needsAuthOrCalBackfill;

  if (needsSettingsUpdate) {
    const baseRoles = needsMemberRolesBackfill
      ? [...(DEFAULT_ADA_SETTINGS.memberRoles ?? [])]
      : [...(existing.memberRoles ?? [])];
    const extraDefaultRoles = ['Chairman', 'Vice Chairman', 'Assistant', 'Secretary', 'Committee'];
    const mergedMemberRoles = needsRolesV2Seed
      ? [
          ...baseRoles,
          ...extraDefaultRoles.filter(
            (r) => !baseRoles.some((b) => b.toLowerCase() === r.toLowerCase())
          ),
        ]
      : baseRoles;

    let mergedFullAccessRoles = existing.portalFullAccessRoles;
    if (needsRolesV2Seed && Array.isArray(existing.portalFullAccessRoles)) {
      const existingFull = [...existing.portalFullAccessRoles];
      mergedFullAccessRoles = [
        ...existingFull,
        ...extraDefaultRoles.filter(
          (r) => !existingFull.some((b) => b.toLowerCase() === r.toLowerCase())
        ),
      ];
    }

    normalizedSettings = {
      ...existing,
      language: (existing.language as string) === 'tig' ? 'ti' : existing.language,
      associationName: isLegacyDefaultName
        ? DEFAULT_ADA_SETTINGS.associationName
        : existing.associationName,
      memberRoles: mergedMemberRoles,
      portalFullAccessRoles: mergedFullAccessRoles,
      rolesSeededV2: true,
      showEthiopianCalendar:
        existing.showEthiopianCalendar ?? DEFAULT_ADA_SETTINGS.showEthiopianCalendar,
      requireLogin: existing.requireLogin ?? DEFAULT_ADA_SETTINGS.requireLogin,
      loginUsername: existing.loginUsername || DEFAULT_ADA_SETTINGS.loginUsername,
      loginPassword: existing.loginPassword || DEFAULT_ADA_SETTINGS.loginPassword,
    };
    await putAda('settings', normalizedSettings);
  }

  return {
    settings: normalizedSettings,
    members: normalizedMembers,
    payments,
    penalties,
    expenses,
    trips,
    mutualAid,
    incidents,
  };
}

export async function resetAdaToDemo(): Promise<LoadedAdaState> {
  const db = await openDatabase();
  const tx = db.transaction(ALL_STORES, 'readwrite');
  for (const s of ALL_STORES) tx.objectStore(s).clear();
  tx.objectStore('settings').put(DEFAULT_ADA_SETTINGS);
  for (const m of SEED_ADA_MEMBERS) tx.objectStore('members').put(m);
  for (const p of SEED_ADA_PAYMENTS) tx.objectStore('payments').put(p);
  for (const l of SEED_ADA_PENALTIES) tx.objectStore('penalties').put(l);
  for (const e of SEED_ADA_EXPENSES) tx.objectStore('expenses').put(e);
  for (const t of SEED_ADA_TRIPS) tx.objectStore('trips').put(t);
  for (const a of SEED_ADA_MUTUAL_AID) tx.objectStore('mutualAid').put(a);
  for (const inc of SEED_ADA_INCIDENTS) tx.objectStore('incidents').put(inc);
  await txComplete(tx);
  db.close();

  return {
    settings: DEFAULT_ADA_SETTINGS,
    members: SEED_ADA_MEMBERS,
    payments: SEED_ADA_PAYMENTS,
    penalties: SEED_ADA_PENALTIES,
    expenses: SEED_ADA_EXPENSES,
    trips: SEED_ADA_TRIPS,
    mutualAid: SEED_ADA_MUTUAL_AID,
    incidents: SEED_ADA_INCIDENTS,
  };
}

export async function importAdaBackup(backup: AdaFullBackup): Promise<LoadedAdaState> {
  const existingSettingsRows = await getAllAda<AdaSettings>('settings');
  const existingPrimarySettings = existingSettingsRows.find((s) => s.id === 'primary');

  const shouldKeepExistingSettings =
    backup.preserveSettings === true ||
    !backup.settings ||
    typeof backup.settings !== 'object' ||
    Object.keys(backup.settings).length === 0;

  const settingsToStore: AdaSettings = shouldKeepExistingSettings
    ? (existingPrimarySettings ?? DEFAULT_ADA_SETTINGS)
    : {
        ...DEFAULT_ADA_SETTINGS,
        ...backup.settings,
        id: 'primary',
      };

  const db = await openDatabase();
  const tx = db.transaction([...ALL_STORES, SYNC_QUEUE_STORE], 'readwrite');
  for (const s of ALL_STORES) tx.objectStore(s).clear();
  tx.objectStore(SYNC_QUEUE_STORE).clear();
  tx.objectStore('settings').put({...settingsToStore, id: 'primary'});
  for (const m of backup.members ?? []) tx.objectStore('members').put(m);
  for (const p of backup.payments ?? []) tx.objectStore('payments').put(p);
  for (const l of backup.penalties ?? []) tx.objectStore('penalties').put(l);
  for (const e of backup.expenses ?? []) tx.objectStore('expenses').put(e);
  for (const t of backup.trips ?? []) tx.objectStore('trips').put(t);
  for (const a of backup.mutualAid ?? []) tx.objectStore('mutualAid').put(a);
  for (const inc of backup.incidents ?? []) tx.objectStore('incidents').put(inc);
  await txComplete(tx);
  db.close();
  return initAndLoadAdaDb();
}

export async function applyCloudSnapshotToLocal(
  snapshot: Partial<LoadedAdaState>,
  localSettings: AdaSettings
): Promise<LoadedAdaState> {
  const db = await openDatabase();
  const tx = db.transaction(ALL_STORES, 'readwrite');
  for (const s of ALL_STORES) tx.objectStore(s).clear();
  const mergedSettings: AdaSettings = {
    ...(snapshot.settings ?? localSettings),
    id: 'primary',
    loginUsername: localSettings.loginUsername,
    loginPassword: localSettings.loginPassword,
    supabaseUrl: localSettings.supabaseUrl,
    supabaseAnonKey: localSettings.supabaseAnonKey,
    supabaseSyncKey: localSettings.supabaseSyncKey,
    autoSyncOnline: localSettings.autoSyncOnline,
    lastSyncedAt: new Date().toISOString(),
  };
  tx.objectStore('settings').put(mergedSettings);
  for (const m of snapshot.members ?? []) tx.objectStore('members').put(m);
  for (const p of snapshot.payments ?? []) tx.objectStore('payments').put(p);
  for (const l of snapshot.penalties ?? []) tx.objectStore('penalties').put(l);
  for (const e of snapshot.expenses ?? []) tx.objectStore('expenses').put(e);
  for (const t of snapshot.trips ?? []) tx.objectStore('trips').put(t);
  for (const a of snapshot.mutualAid ?? []) tx.objectStore('mutualAid').put(a);
  for (const inc of snapshot.incidents ?? []) tx.objectStore('incidents').put(inc);
  await txComplete(tx);
  db.close();
  return initAndLoadAdaDb();
}
