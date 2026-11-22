import React, {useEffect, useState} from 'react';
import {FileCheck2, KeyRound, Printer, Upload, X} from 'lucide-react';
import {getDefaultFullAccessRoles} from '../db/supabaseSync';
import {
  translate,
  translateGender,
  translateRole,
  translateSpouseLabel,
  translateStatus,
} from '../i18n/translations';
import {
  type AdaMember,
  type AdaSettings,
  type ChildDetails,
  DEFAULT_MEMBER_ROLES,
  type InsuranceType,
  type LanguageCode,
  type MemberGender,
  type MemberRole,
  type MemberStatus,
} from '../types/ada';
import {calculateAgeFromDob} from '../utils/adaCalculations';
import {
  compressImageToDataUrl,
  createId,
  nextSequentialCode,
  todayIsoDate,
} from '../utils/formatters';
import {
  type ComplianceFormDraft,
  MemberComplianceFormModal,
} from './MemberComplianceFormModal';
import {acquireModalPrintLock, releaseModalPrintLock} from './ModalShell';

interface AddMemberModalProps {
  isOpen: boolean;
  language: LanguageCode;
  settings: AdaSettings;
  existingMembers: AdaMember[];
  onClose: () => void;
  onSaveMember: (member: AdaMember, openComplianceAfter?: boolean) => Promise<void>;
}

function ImageUploadField({
  lang,
  label,
  value,
  onChange,
}: {
  lang: LanguageCode;
  label: string;
  value?: string;
  onChange: (dataUrl?: string) => void;
}) {
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const {dataUrl} = await compressImageToDataUrl(file, 900, 0.78);
    onChange(dataUrl);
  };

  return (
    <div>
      <span className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
        {label}
      </span>
      <div className="mt-1 flex items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <Upload className="h-3 w-3" />
          {value ? translate(lang, 'replace') : translate(lang, 'upload')}
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </label>
        {value && (
          <>
            <img
              src={value}
              alt={label}
              className="h-7 w-10 rounded border border-slate-200 object-cover dark:border-slate-700"
            />
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="text-[11px] text-red-600 hover:underline dark:text-red-400"
            >
              {translate(lang, 'clear')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function createEmptyChild(): ChildDetails {
  return {
    id: createId('ch'),
    name: '',
    gender: 'Male',
    dateOfBirth: '',
    age: '',
    occupationOrGrade: '',
  };
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  isOpen,
  language,
  settings,
  existingMembers,
  onClose,
  onSaveMember,
}) => {
  const autoMemberId = nextSequentialCode(
    'ADA-',
    existingMembers.map((m) => m.memberId),
    4
  );
  const [showCompliancePreview, setShowCompliancePreview] = useState(false);
  const [complianceAcknowledged, setComplianceAcknowledged] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<MemberGender>('Female');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [bloodType, setBloodType] = useState('O+');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);

  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleMakeModel, setVehicleMakeModel] = useState('');
  const [trailerPlateOrChassis, setTrailerPlateOrChassis] = useState('');
  const [boloExpiry, setBoloExpiry] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');
  const [insuranceType, setInsuranceType] = useState<InsuranceType>('Third-Party');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [medicalExpiry, setMedicalExpiry] = useState('');
  const [highwayClearanceExpiry, setHighwayClearanceExpiry] = useState('');
  const [insuranceImageDataUrl, setInsuranceImageDataUrl] = useState<string | undefined>(undefined);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | undefined>(undefined);
  const [role, setRole] = useState<MemberRole>('Member');
  const [employer, setEmployer] = useState('');
  const [location, setLocation] = useState('');
  const [joinDate, setJoinDate] = useState(todayIsoDate());
  const [status, setStatus] = useState<MemberStatus>('Active');

  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [licenseImageDataUrl, setLicenseImageDataUrl] = useState<string | undefined>(undefined);
  const [faydaFrontDataUrl, setFaydaFrontDataUrl] = useState<string | undefined>(undefined);
  const [faydaBackDataUrl, setFaydaBackDataUrl] = useState<string | undefined>(undefined);

  const [isMarried, setIsMarried] = useState(false);
  const [spouseName, setSpouseName] = useState('');
  const [spouseAge, setSpouseAge] = useState<number | ''>('');
  const [spouseOccupation, setSpouseOccupation] = useState('');
  const [spousePhone, setSpousePhone] = useState('');
  const [spousePhoto, setSpousePhoto] = useState<string | undefined>(undefined);
  const [spouseFaydaFront, setSpouseFaydaFront] = useState<string | undefined>(undefined);
  const [spouseFaydaBack, setSpouseFaydaBack] = useState<string | undefined>(undefined);

  const [children, setChildren] = useState<ChildDetails[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    acquireModalPrintLock();
    return () => {
      releaseModalPrintLock();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const availableRoles =
    settings.memberRoles && settings.memberRoles.length > 0
      ? settings.memberRoles
      : [...DEFAULT_MEMBER_ROLES];

  const spouseLabel = translateSpouseLabel(language, gender);

  const handleDobChange = (val: string) => {
    setDateOfBirth(val);
    setAge(calculateAgeFromDob(val));
  };

  const handleChildrenCountChange = (raw: number) => {
    const count = Math.max(0, Math.min(40, Number.isFinite(raw) ? raw : 0));
    setChildren((prev) => {
      if (count === prev.length) return prev;
      if (count < prev.length) return prev.slice(0, count);
      const next = [...prev];
      while (next.length < count) next.push(createEmptyChild());
      return next;
    });
  };

  const updateChild = (idx: number, patch: Partial<ChildDetails>) => {
    setChildren((prev) => prev.map((c, i) => (i === idx ? {...c, ...patch} : c)));
  };

  const saveMemberRecord = async (openComplianceAfter: boolean) => {
    if (!fullName.trim() || !phone.trim() || !gender) return;
    setIsSaving(true);
    try {
      const newMember: AdaMember = {
        id: createId('mem'),
        memberId: autoMemberId,
        photoDataUrl,
        fullName: fullName.trim(),
        phone: phone.trim(),
        gender,
        dateOfBirth,
        age,
        bloodType,
        vehiclePlate: vehiclePlate.trim().toUpperCase(),
        vehicleMakeModel: vehicleMakeModel.trim() || undefined,
        trailerPlateOrChassis: trailerPlateOrChassis.trim().toUpperCase() || undefined,
        boloExpiry: boloExpiry || undefined,
        insuranceProvider: insuranceProvider.trim() || undefined,
        insurancePolicyNumber: insurancePolicyNumber.trim().toUpperCase() || undefined,
        insuranceType: insuranceProvider.trim() || insurancePolicyNumber.trim() ? insuranceType : undefined,
        insuranceExpiry: insuranceExpiry || undefined,
        medicalExpiry: medicalExpiry || undefined,
        highwayClearanceExpiry: highwayClearanceExpiry || undefined,
        insuranceImageDataUrl,
        signatureDataUrl,
        role,
        employer: employer.trim(),
        location: location.trim(),
        joinDate,
        status,
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactPhone: emergencyContactPhone.trim(),
        licenseNumber: licenseNumber.trim(),
        licenseExpiry,
        licenseImageDataUrl,
        faydaFrontDataUrl,
        faydaBackDataUrl,
        isMarried,
        spouse: isMarried
          ? {
              name: spouseName.trim(),
              age: spouseAge,
              occupation: spouseOccupation.trim(),
              phone: spousePhone.trim(),
              photoDataUrl: spousePhoto,
              faydaFrontDataUrl: spouseFaydaFront,
              faydaBackDataUrl: spouseFaydaBack,
            }
          : undefined,
        children,
        createdAt: new Date().toISOString(),
      };
      await onSaveMember(newMember, openComplianceAfter);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveMemberRecord(false);
  };

  const liveDraftForCompliance: ComplianceFormDraft = {
    memberId: autoMemberId,
    fullName,
    phone,
    gender,
    dateOfBirth,
    vehiclePlate: vehiclePlate.trim().toUpperCase(),
    vehicleMakeModel,
    trailerPlateOrChassis: trailerPlateOrChassis.trim().toUpperCase(),
    role,
    location,
    licenseNumber,
    licenseExpiry,
    insuranceProvider,
    insurancePolicyNumber: insurancePolicyNumber.trim().toUpperCase(),
    emergencyContactName,
    emergencyContactPhone,
    joinDate,
    signatureDataUrl,
  };

  return (
    <>
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-xs ${
        showCompliancePreview ? 'no-print' : ''
      }`}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-dvh max-h-dvh w-full max-w-3xl flex-col overflow-hidden border-l border-slate-300 bg-[#F8FAFC] shadow-2xl dark:border-slate-700 dark:bg-[#0F172A]"
      >
        <div className="shrink-0">
          <div className="grid h-1 grid-cols-3">
            <div className="bg-[#078930]" />
            <div className="bg-[#FCDD09]" />
            <div className="bg-[#DA121A]" />
          </div>
          <div className="flex items-center justify-between border-b border-slate-200 bg-[#0B2C5D] px-6 py-4 text-white dark:border-slate-800 dark:bg-[#0B172B]">
            <div>
              <p className="font-mono text-xs text-amber-300">
                {translate(language, 'autoIdLabel', {id: autoMemberId})}
              </p>
              <h2 className="font-display text-lg font-bold text-white">
                {translate(language, 'addMemberTitle')}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={translate(language, 'close')}
              className="rounded-md p-1.5 text-sky-200 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Step 1: Member Compliance & Undertaking Form First */}
          <section className="rounded-xl border border-[#034EA2]/30 bg-gradient-to-r from-[#EBF4FF] to-[#F5F9FF] p-4 dark:border-sky-800/60 dark:from-sky-950/40 dark:to-slate-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 shrink-0 text-[#0B2C5D] dark:text-sky-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wide text-[#0B2C5D] dark:text-sky-300">
                    {translate(language, 'secComplianceFirst')}
                  </h3>
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {translate(language, 'complianceFirstDesc')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCompliancePreview(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0B2C5D] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#034EA2] dark:bg-[#034EA2] dark:hover:bg-sky-600"
              >
                <Printer className="h-3.5 w-3.5 text-amber-300" />
                {translate(language, 'openComplianceFormBtn')}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={complianceAcknowledged}
                  onChange={(e) => setComplianceAcknowledged(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {translate(language, 'complianceAckCheckbox')}
              </label>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  {translate(language, 'memberSignatureUploadLabel')}:
                </span>
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <Upload className="h-3 w-3" />
                  {signatureDataUrl ? translate(language, 'replace') : translate(language, 'uploadSignatureBtn')}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const {dataUrl} = await compressImageToDataUrl(file, 700, 0.9, true);
                      setSignatureDataUrl(dataUrl);
                    }}
                    className="hidden"
                  />
                </label>
                {signatureDataUrl && (
                  <>
                    <img
                      src={signatureDataUrl}
                      alt={translate(language, 'signatureLineLabel')}
                      className="h-7 w-16 rounded border border-slate-200 bg-white object-contain px-1 dark:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => setSignatureDataUrl(undefined)}
                      className="text-[11px] font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      {translate(language, 'clearBtn')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Basic Profile */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {translate(language, 'secBasicProfile')}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'fullName')}
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dawit Tadesse Gebre"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'phoneNumberRequired')}
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+251 91 ..."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'genderRequired')}
                </label>
                <select
                  required
                  value={gender}
                  onChange={(e) => setGender(e.target.value as MemberGender)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="Female">{translateGender(language, 'Female')}</option>
                  <option value="Male">{translateGender(language, 'Male')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'dob')}
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => handleDobChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {translate(language, 'ageAuto')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={age}
                    onChange={(e) =>
                      setAge(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {translate(language, 'bloodType')}
                  </label>
                  <select
                    value={bloodType}
                    onChange={(e) => setBloodType(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="sm:col-span-3">
                <ImageUploadField
                  lang={language}
                  label={translate(language, 'memberPhoto')}
                  value={photoDataUrl}
                  onChange={setPhotoDataUrl}
                />
              </div>
            </div>
          </section>

          {/* Membership & Vehicle */}
          <section className="border-t border-slate-200 pt-5 dark:border-slate-800 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {translate(language, 'secMembershipVehicle')}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'colVehiclePlate')}
                </label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="AA-3-B48219"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs uppercase text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'orgRole')}
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as MemberRole)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>
                      {translateRole(language, r)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'membershipStatus')}
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MemberStatus)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="Active">{translateStatus(language, 'Active')}</option>
                  <option value="Removed">{translateStatus(language, 'Removed')}</option>
                  <option value="Deceased">{translateStatus(language, 'Deceased')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'employer')}
                </label>
                <input
                  type="text"
                  value={employer}
                  onChange={(e) => setEmployer(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'locationPlace')}
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'colJoinDate')}
                </label>
                <input
                  type="date"
                  value={joinDate}
                  onChange={(e) => setJoinDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-sky-200 bg-sky-50/80 px-3.5 py-2.5 text-xs text-slate-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-slate-200 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#034EA2] dark:text-sky-400" />
                <div>
                  <p className="font-semibold text-[#0B2C5D] dark:text-sky-200">
                    Online Portal Login: <span className="font-mono">{autoMemberId}</span> · Default Password: <span className="font-mono">0000</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                    {getDefaultFullAccessRoles(settings).some(
                      (r) => r.toLowerCase() === (role || 'Member').toLowerCase()
                    )
                      ? 'Full Office Access: this role will be able to view and manage everything online just like the offline app.'
                      : 'Personal Portal Only: this member will see only their own profile, ID card, payments, dues, and trips.'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 2B. Truck Specs, Bolo Inspection & Insurance Policy */}
          <section className="border-t border-slate-200 pt-5 dark:border-slate-800 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#034EA2] dark:text-sky-400">
              {translate(language, 'secInsuranceBolo')}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'vehicleMakeModel')}
                </label>
                <input
                  type="text"
                  value={vehicleMakeModel}
                  onChange={(e) => setVehicleMakeModel(e.target.value)}
                  placeholder="e.g. Sinotruk HOWO 371"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'trailerPlateChassis')}
                </label>
                <input
                  type="text"
                  value={trailerPlateOrChassis}
                  onChange={(e) => setTrailerPlateOrChassis(e.target.value)}
                  placeholder="TR-3-10482"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs uppercase text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'boloExpiry')}
                </label>
                <input
                  type="date"
                  value={boloExpiry}
                  onChange={(e) => setBoloExpiry(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'insuranceProvider')}
                </label>
                <input
                  type="text"
                  value={insuranceProvider}
                  onChange={(e) => setInsuranceProvider(e.target.value)}
                  placeholder="e.g. Ethiopian Insurance Corp"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'insurancePolicyNo')}
                </label>
                <input
                  type="text"
                  value={insurancePolicyNumber}
                  onChange={(e) => setInsurancePolicyNumber(e.target.value)}
                  placeholder="EIC-MT-2026-..."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs uppercase text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'insuranceTypeLabel')}
                </label>
                <select
                  value={insuranceType}
                  onChange={(e) => setInsuranceType(e.target.value as InsuranceType)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="Third-Party">{translate(language, 'coverageThirdParty')}</option>
                  <option value="Comprehensive">{translate(language, 'coverageComprehensive')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'insuranceExpiry')}
                </label>
                <input
                  type="date"
                  value={insuranceExpiry}
                  onChange={(e) => setInsuranceExpiry(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'medicalExpiry')}
                </label>
                <input
                  type="date"
                  value={medicalExpiry}
                  onChange={(e) => setMedicalExpiry(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'highwayClearanceExpiry')}
                </label>
                <input
                  type="date"
                  value={highwayClearanceExpiry}
                  onChange={(e) => setHighwayClearanceExpiry(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div className="sm:col-span-3">
                <ImageUploadField
                  lang={language}
                  label={translate(language, 'insuranceCertImage')}
                  value={insuranceImageDataUrl}
                  onChange={setInsuranceImageDataUrl}
                />
              </div>
            </div>
          </section>

          {/* Emergency, Driver Licence & Fayda Documents */}
          <section className="border-t border-slate-200 pt-5 dark:border-slate-800 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {translate(language, 'secEmergencyDocs')}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'emergencyName')}
                </label>
                <input
                  type="text"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'emergencyPhone')}
                </label>
                <input
                  type="text"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'licenceNumber')}
                </label>
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'licenceExpiry')}
                </label>
                <input
                  type="date"
                  value={licenseExpiry}
                  onChange={(e) => setLicenseExpiry(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <ImageUploadField
                lang={language}
                label={translate(language, 'licenceImage')}
                value={licenseImageDataUrl}
                onChange={setLicenseImageDataUrl}
              />
              <ImageUploadField
                lang={language}
                label={translate(language, 'faydaFront')}
                value={faydaFrontDataUrl}
                onChange={setFaydaFrontDataUrl}
              />
              <ImageUploadField
                lang={language}
                label={translate(language, 'faydaBack')}
                value={faydaBackDataUrl}
                onChange={setFaydaBackDataUrl}
              />
            </div>
          </section>

          {/* Spouse Section */}
          <section className="border-t border-slate-200 pt-5 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {translate(language, 'secMaritalSpouse', {spouse: spouseLabel})}
              </h3>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={isMarried}
                  onChange={(e) => setIsMarried(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {translate(language, 'married')}
              </label>
            </div>

            {isMarried && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60 space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      {translate(language, 'spouseNameLabel', {spouse: spouseLabel})}
                    </label>
                    <input
                      type="text"
                      value={spouseName}
                      onChange={(e) => setSpouseName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      {translate(language, 'ageLabel')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={spouseAge}
                      onChange={(e) =>
                        setSpouseAge(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      {translate(language, 'phone')}
                    </label>
                    <input
                      type="text"
                      value={spousePhone}
                      onChange={(e) => setSpousePhone(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      {translate(language, 'occupationLabel')}
                    </label>
                    <input
                      type="text"
                      value={spouseOccupation}
                      onChange={(e) => setSpouseOccupation(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <ImageUploadField
                    lang={language}
                    label={translate(language, 'spousePhotoLabel', {spouse: spouseLabel})}
                    value={spousePhoto}
                    onChange={setSpousePhoto}
                  />
                  <ImageUploadField
                    lang={language}
                    label={translate(language, 'spouseFaydaFrontLabel', {spouse: spouseLabel})}
                    value={spouseFaydaFront}
                    onChange={setSpouseFaydaFront}
                  />
                  <ImageUploadField
                    lang={language}
                    label={translate(language, 'spouseFaydaBackLabel', {spouse: spouseLabel})}
                    value={spouseFaydaBack}
                    onChange={setSpouseFaydaBack}
                  />
                </div>
              </div>
            )}
          </section>

          {/* Children up to 40 */}
          <section className="border-t border-slate-200 pt-5 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {translate(language, 'secChildren')}
              </h3>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {translate(language, 'numChildren')}
                </label>
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={children.length}
                  onChange={(e) => handleChildrenCountChange(Number(e.target.value))}
                  className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            {children.map((child, idx) => (
              <div
                key={child.id}
                className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {translate(language, 'childNumber', {num: idx + 1})}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      {translate(language, 'childName')}
                    </label>
                    <input
                      type="text"
                      value={child.name}
                      onChange={(e) => updateChild(idx, {name: e.target.value})}
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      {translate(language, 'gender')}
                    </label>
                    <select
                      value={child.gender}
                      onChange={(e) =>
                        updateChild(idx, {gender: e.target.value as MemberGender})
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="Female">{translateGender(language, 'Female')}</option>
                      <option value="Male">{translateGender(language, 'Male')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      {translate(language, 'dob')}
                    </label>
                    <input
                      type="date"
                      value={child.dateOfBirth}
                      onChange={(e) =>
                        updateChild(idx, {
                          dateOfBirth: e.target.value,
                          age: calculateAgeFromDob(e.target.value),
                        })
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      {translate(language, 'ageAuto')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={child.age}
                      onChange={(e) =>
                        updateChild(idx, {
                          age: e.target.value === '' ? '' : Number(e.target.value),
                        })
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      {translate(language, 'childOccupationGrade')}
                    </label>
                    <input
                      type="text"
                      value={child.occupationOrGrade}
                      onChange={(e) => updateChild(idx, {occupationOrGrade: e.target.value})}
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <ImageUploadField
                    lang={language}
                    label={translate(language, 'childPhoto')}
                    value={child.photoDataUrl}
                    onChange={(url) => updateChild(idx, {photoDataUrl: url})}
                  />
                  <ImageUploadField
                    lang={language}
                    label={translate(language, 'childFaydaFront')}
                    value={child.faydaFrontDataUrl}
                    onChange={(url) => updateChild(idx, {faydaFrontDataUrl: url})}
                  />
                  <ImageUploadField
                    lang={language}
                    label={translate(language, 'childFaydaBack')}
                    value={child.faydaBackDataUrl}
                    onChange={(url) => updateChild(idx, {faydaBackDataUrl: url})}
                  />
                </div>
              </div>
            ))}
          </section>
          </div>

          <div className="shrink-0 flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 bg-white/95 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-900/95">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              {translate(language, 'cancel')}
            </button>
            <button
              type="button"
              disabled={isSaving || !fullName.trim() || !phone.trim()}
              onClick={() => saveMemberRecord(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#034EA2]/40 bg-[#EFF6FF] px-4 py-2 text-xs font-semibold text-[#0B2C5D] hover:bg-[#DBEAFE] disabled:opacity-50 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
            >
              <Printer className="h-3.5 w-3.5" />
              {translate(language, 'saveAndPrintComplianceBtn')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-[#0B2C5D] px-5 py-2 text-xs font-semibold text-white hover:bg-[#034EA2] disabled:opacity-60 dark:bg-[#034EA2] dark:hover:bg-sky-600"
            >
              {isSaving
                ? translate(language, 'savingLabel')
                : translate(language, 'saveMemberBtn', {id: autoMemberId})}
            </button>
          </div>
        </form>
      </div>
    </div>

    <MemberComplianceFormModal
      isOpen={showCompliancePreview}
      memberData={liveDraftForCompliance}
      settings={settings}
      onClose={() => setShowCompliancePreview(false)}
      onMemberSignatureChange={setSignatureDataUrl}
    />
    </>
  );
};
