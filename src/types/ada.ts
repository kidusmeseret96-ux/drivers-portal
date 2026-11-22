export type AdaView =
  | 'overview'
  | 'members'
  | 'fleet'
  | 'trips'
  | 'incidents'
  | 'mutual-aid'
  | 'deleted-members'
  | 'payments'
  | 'overdue'
  | 'penalties'
  | 'ledger'
  | 'reports'
  | 'how-to-use'
  | 'settings';

export type LanguageCode = 'en' | 'am' | 'om' | 'ti' | 'so' | 'aa';

export type MemberGender = 'Female' | 'Male';
export type MemberStatus = 'Active' | 'Removed' | 'Deceased';
export const DEFAULT_MEMBER_ROLES = [
  'Member',
  'Chairman',
  'Vice Chairman',
  'Chairperson',
  'Assistant',
  'Manager',
  'Vice manager',
  'Accountant',
  'Treasurer',
  'Secretary',
  'Committee',
] as const;
export type MemberRole = string;

export type InsuranceType = 'Third-Party' | 'Comprehensive';

export interface SpouseDetails {
  name: string;
  age: number | '';
  occupation: string;
  phone: string;
  photoDataUrl?: string;
  faydaFrontDataUrl?: string;
  faydaBackDataUrl?: string;
}

export interface ChildDetails {
  id: string;
  name: string;
  gender: MemberGender;
  dateOfBirth: string;
  age: number | '';
  occupationOrGrade: string;
  photoDataUrl?: string;
  faydaFrontDataUrl?: string;
  faydaBackDataUrl?: string;
}

export interface AdaMember {
  id: string;
  memberId: string; // ADA-0000 format
  photoDataUrl?: string;
  fullName: string;
  phone: string;
  gender: MemberGender;
  dateOfBirth: string;
  age: number | '';
  bloodType: string;
  vehiclePlate: string;
  vehicleMakeModel?: string;
  trailerPlateOrChassis?: string;
  boloExpiry?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceType?: InsuranceType;
  insuranceExpiry?: string;
  insuranceImageDataUrl?: string;
  medicalExpiry?: string;
  highwayClearanceExpiry?: string;
  signatureDataUrl?: string;
  role: MemberRole;
  employer: string;
  location: string;
  joinDate: string;
  status: MemberStatus;
  emergencyContactName: string;
  emergencyContactPhone: string;
  licenseNumber: string;
  licenseExpiry: string;
  licenseImageDataUrl?: string;
  faydaFrontDataUrl?: string;
  faydaBackDataUrl?: string;
  isMarried: boolean;
  spouse?: SpouseDetails;
  children: ChildDetails[];
  deletedAt?: string;
  statusBeforeDelete?: MemberStatus;
  previousMemberId?: string;
  createdAt: string;
}

export type PaymentMethod =
  | 'Cash'
  | 'Telebirr'
  | 'CBE Birr'
  | 'E-Birr'
  | 'Abyssinia Bank'
  | 'Awash Bank'
  | 'Dashen Bank'
  | 'Sinqee Bank'
  | 'Cooperative Bank of Oromia';

export type PaymentApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export interface AdaPayment {
  id: string;
  reference: string;
  memberId: string; // references AdaMember.id
  categoryId: string;
  categoryName: string;
  customReason?: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  reviewerRole: string;
  status: PaymentApprovalStatus;
  confirmationMessage?: string;
  proofImageDataUrl?: string;
  note?: string;
  recordedBy: string;
  createdAt: string;
}

export type PenaltyStatus = 'Unpaid' | 'Paid';

export interface AdaPenalty {
  id: string;
  memberId: string;
  reason: string;
  isCustom: boolean;
  amount: number;
  date: string;
  status: PenaltyStatus;
  paidDate?: string;
  recordedBy: string;
  note?: string;
  createdAt: string;
}

export interface AdaExpense {
  id: string;
  categoryId: string;
  categoryName: string;
  customReason?: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  description: string;
  recordedBy: string;
  createdAt: string;
}

export type TripStatus = 'Dispatched' | 'Completed' | 'Cancelled';

export interface AdaTrip {
  id: string;
  waybillRef: string;
  memberId: string;
  vehiclePlate: string;
  routeCorridor: string;
  cargoDescription: string;
  tonnage: number;
  dispatchDate: string;
  completedDate?: string;
  status: TripStatus;
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export type MutualAidType = 'Bereavement' | 'Road Accident' | 'Medical Support' | 'Family Support';
export type MutualAidStatus = 'Pending' | 'Paid';

export interface AdaMutualAidPayout {
  id: string;
  voucherRef: string;
  memberId: string;
  aidType: MutualAidType;
  beneficiaryName: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  status: MutualAidStatus;
  paidDate?: string;
  description: string;
  recordedBy: string;
  createdAt: string;
}

export type IncidentAdvanceKind =
  | 'Breakdown'
  | 'Cargo Incident'
  | 'Fuel Advance'
  | 'Toll Advance'
  | 'Roadside Repair';
export type IncidentAdvanceStatus = 'Open' | 'Settled';

export interface AdaIncidentAdvance {
  id: string;
  refCode: string;
  memberId: string;
  vehiclePlate: string;
  kind: IncidentAdvanceKind;
  amount: number;
  date: string;
  locationOrCorridor: string;
  description: string;
  status: IncidentAdvanceStatus;
  settledDate?: string;
  recordedBy: string;
  createdAt: string;
}

export interface CategoryConfig {
  id: string;
  name: string;
  defaultAmount: number;
  archived: boolean;
  attachmentDataUrl?: string;
  attachmentName?: string;
}

export interface AdaSettings {
  id: 'primary';
  associationName: string;
  logoDataUrl?: string;
  officialStampDataUrl?: string;
  chairmanSignatureDataUrl?: string;
  currentUserName: string;
  currency: 'ETB';
  language: LanguageCode;
  defaultPrintLanguage?: LanguageCode;
  showEthiopianCalendar?: boolean;
  requireLogin?: boolean;
  loginUsername?: string;
  loginPassword?: string;
  monthlyDueAmount: number;
  monthlyDueDay: number;
  dailyLateCharge: number;
  monthlyDuesTarget: number;
  requirePaymentApproval: boolean;
  reviewerRoles: string[];
  memberRoles?: string[];
  portalFullAccessRoles?: string[];
  rolesSeededV2?: boolean;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseSyncKey?: string;
  autoSyncOnline?: boolean;
  lastSyncedAt?: string;
  incomingCategories: CategoryConfig[];
  outgoingCategories: CategoryConfig[];
  penaltyPresets: CategoryConfig[];
  theme: 'light' | 'dark';
}

export type SyncQueueEntity =
  | 'members'
  | 'payments'
  | 'penalties'
  | 'expenses'
  | 'trips'
  | 'mutualAid'
  | 'incidents'
  | 'settings'
  | 'resetPin';

export interface AdaSyncQueueItem {
  key: string; // `${entity}:${recordId}`
  entity: SyncQueueEntity;
  recordId: string;
  payload: unknown;
  queuedAt: string;
}

export interface AdaFullBackup {
  schemaVersion: number;
  exportedAt: string;
  app: 'ADA-System';
  preserveSettings?: boolean;
  settings?: AdaSettings;
  members: AdaMember[];
  payments: AdaPayment[];
  penalties: AdaPenalty[];
  expenses: AdaExpense[];
  trips?: AdaTrip[];
  mutualAid?: AdaMutualAidPayout[];
  incidents?: AdaIncidentAdvance[];
}
