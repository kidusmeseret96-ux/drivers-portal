import type {AdaExpense, AdaMember, AdaPayment, AdaSettings, LanguageCode} from '../types/ada';
import {currentMonthIso, daysUntil, formatCurrency, formatDate} from './formatters';

export function calculateAgeFromDob(dob: string): number | '' {
  if (!dob) return '';
  const birth = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : '';
}

export interface OverdueAccountRow {
  member: AdaMember;
  monthlyDues: number;
  dueDate: string;
  daysLate: number;
  dailyCharge: number;
  lateCharges: number;
  totalDue: number;
}

export function calculateOverdueAccounts(
  members: AdaMember[],
  payments: AdaPayment[],
  settings: AdaSettings
): {
  rows: OverdueAccountRow[];
  totalLateCharges: number;
  totalOutstanding: number;
  currentDueDateStr: string;
} {
  const now = new Date();
  const currentMonth = currentMonthIso();
  const dueDay = Math.max(1, Math.min(28, settings.monthlyDueDay));
  const dueDateStr = `${currentMonth}-${String(dueDay).padStart(2, '0')}`;
  const todayDay = now.getDate();
  const daysLate = todayDay > dueDay ? todayDay - dueDay : 0;

  const activeMembers = members.filter((m) => !m.deletedAt && m.status === 'Active');

  const paidMonthlySet = new Set<string>();
  for (const p of payments) {
    if (
      p.status === 'Approved' &&
      p.date.startsWith(currentMonth) &&
      (p.categoryId === 'cat_in_monthly' || p.categoryName.toLowerCase() === 'monthly dues')
    ) {
      paidMonthlySet.add(p.memberId);
    }
  }

  const rows: OverdueAccountRow[] = [];

  if (daysLate > 0) {
    for (const member of activeMembers) {
      if (paidMonthlySet.has(member.id)) continue;
      const lateCharges = daysLate * settings.dailyLateCharge;
      const totalDue = settings.monthlyDueAmount + lateCharges;
      rows.push({
        member,
        monthlyDues: settings.monthlyDueAmount,
        dueDate: dueDateStr,
        daysLate,
        dailyCharge: settings.dailyLateCharge,
        lateCharges,
        totalDue,
      });
    }
  }

  const totalLateCharges = rows.reduce((s, r) => s + r.lateCharges, 0);
  const totalOutstanding = rows.reduce((s, r) => s + r.totalDue, 0);

  return {
    rows,
    totalLateCharges,
    totalOutstanding,
    currentDueDateStr: dueDateStr,
  };
}

export function getExpiringDriverLicences(
  members: AdaMember[],
  withinDays = 30
): {member: AdaMember; daysLeft: number}[] {
  const results: {member: AdaMember; daysLeft: number}[] = [];
  for (const m of members) {
    if (m.deletedAt || m.status !== 'Active' || !m.licenseExpiry) continue;
    const d = daysUntil(m.licenseExpiry);
    if (d !== null && d <= withinDays) {
      results.push({member: m, daysLeft: d});
    }
  }
  return results.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function getExpiringInsurance(
  members: AdaMember[],
  withinDays = 30
): {member: AdaMember; daysLeft: number}[] {
  const results: {member: AdaMember; daysLeft: number}[] = [];
  for (const m of members) {
    if (m.deletedAt || m.status !== 'Active' || !m.insuranceExpiry) continue;
    const d = daysUntil(m.insuranceExpiry);
    if (d !== null && d <= withinDays) {
      results.push({member: m, daysLeft: d});
    }
  }
  return results.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function getExpiringBolo(
  members: AdaMember[],
  withinDays = 30
): {member: AdaMember; daysLeft: number}[] {
  const results: {member: AdaMember; daysLeft: number}[] = [];
  for (const m of members) {
    if (m.deletedAt || m.status !== 'Active' || !m.boloExpiry) continue;
    const d = daysUntil(m.boloExpiry);
    if (d !== null && d <= withinDays) {
      results.push({member: m, daysLeft: d});
    }
  }
  return results.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function getExpiringMedical(
  members: AdaMember[],
  withinDays = 30
): {member: AdaMember; daysLeft: number}[] {
  const results: {member: AdaMember; daysLeft: number}[] = [];
  for (const m of members) {
    if (m.deletedAt || m.status !== 'Active' || !m.medicalExpiry) continue;
    const d = daysUntil(m.medicalExpiry);
    if (d !== null && d <= withinDays) {
      results.push({member: m, daysLeft: d});
    }
  }
  return results.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function getExpiringHighwayClearance(
  members: AdaMember[],
  withinDays = 30
): {member: AdaMember; daysLeft: number}[] {
  const results: {member: AdaMember; daysLeft: number}[] = [];
  for (const m of members) {
    if (m.deletedAt || m.status !== 'Active' || !m.highwayClearanceExpiry) continue;
    const d = daysUntil(m.highwayClearanceExpiry);
    if (d !== null && d <= withinDays) {
      results.push({member: m, daysLeft: d});
    }
  }
  return results.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function buildOverdueReminderText(
  row: OverdueAccountRow,
  settings: AdaSettings,
  lang: LanguageCode
): string {
  const assoc = settings.associationName;
  const totalStr = formatCurrency(row.totalDue, settings.currency);
  const baseStr = formatCurrency(row.monthlyDues, settings.currency);
  const lateStr = formatCurrency(row.lateCharges, settings.currency);
  const plateStr = row.member.vehiclePlate || '—';
  const dueStr = formatDate(row.dueDate);

  switch (lang) {
    case 'am':
      return `ሰላም ${row.member.fullName} (${row.member.memberId} / ሰሌዳ ${plateStr})፡ የ${assoc} ወርሃዊ መዋጮ (${dueStr}) በ${row.daysLate} ቀናት ዘግይቷል። መደበኛ: ${baseStr} + የዘገየ ቅጣት: ${lateStr} = ጠቅላላ ${totalStr}። እባክዎ በአፋጣኝ ይክፈሉ።`;
    case 'om':
      return `Akkam ${row.member.fullName} (${row.member.memberId} / Gabatee ${plateStr}): Kaffaltiin ji'aa ${assoc} (${dueStr}) guyyaa ${row.daysLate} dabarsee jira. Idilee: ${baseStr} + adabbii: ${lateStr} = Waliigala ${totalStr}. Maaloo dafaa kaffalaa.`;
    case 'ti':
      return `ሰላም ${row.member.fullName} (${row.member.memberId} / ሰሌዳ ${plateStr})፡ ወርሓዊ ክፍሊት ${assoc} (${dueStr}) ብ${row.daysLate} መዓልታት ደንጒዩ። ስሩዕ: ${baseStr} + መቕጻዕቲ: ${lateStr} = ጠቕላላ ${totalStr}። በጃኹም ብቕልጡፍ ክፈሉ።`;
    case 'so':
      return `Salaan ${row.member.fullName} (${row.member.memberId} / Taargo ${plateStr}): Qaaraanka bisha ee ${assoc} (${dueStr}) waxa uu dib u dhacay ${row.daysLate} maalmood. Asal: ${baseStr} + ganaax: ${lateStr} = Wadarta ${totalStr}. Fadlan si degdeg ah u bixi.`;
    case 'aa':
      return `Salaam ${row.member.fullName} (${row.member.memberId} / Targa ${plateStr}): ${assoc} alsak mekla (${dueStr}) ${row.daysLate} ayro raagte. Madqa: ${baseStr} + digala: ${lateStr} = Inkih ${totalStr}. Sissikuk mekla aba.`;
    default:
      return `Hello ${row.member.fullName} (${row.member.memberId}, Plate ${plateStr}): Your ${assoc} monthly dues (due ${dueStr}) are ${row.daysLate} days overdue. Base: ${baseStr} + Late charges: ${lateStr} = Total due: ${totalStr}. Please settle via Cash, Telebirr, or Bank transfer.`;
  }
}

export interface MonthlyTrendPoint {
  monthKey: string;
  label: string;
  income: number;
  monthlyDues: number;
  expenses: number;
}

export function buildMonthlySeries(
  payments: AdaPayment[],
  expenses: AdaExpense[],
  monthsBack = 6
): MonthlyTrendPoint[] {
  const now = new Date();
  const points: MonthlyTrendPoint[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const monthKey = `${y}-${m}`;
    const label = d.toLocaleDateString('en-US', {month: 'short', year: '2-digit'});

    const approvedInMonth = payments.filter(
      (p) => p.status === 'Approved' && p.date.startsWith(monthKey)
    );
    const income = approvedInMonth.reduce((sum, p) => sum + p.amount, 0);
    const monthlyDues = approvedInMonth
      .filter(
        (p) => p.categoryId === 'cat_in_monthly' || p.categoryName.toLowerCase() === 'monthly dues'
      )
      .reduce((sum, p) => sum + p.amount, 0);

    const monthExpenses = expenses
      .filter((e) => e.date.startsWith(monthKey))
      .reduce((sum, e) => sum + e.amount, 0);

    points.push({monthKey, label, income, monthlyDues, expenses: monthExpenses});
  }

  return points;
}

export function buildBarcodeBars(value: string): {x: number; width: number}[] {
  const bars: {x: number; width: number}[] = [];
  let cursor = 2;
  const seed = value || 'ADA-0000';
  bars.push({x: cursor, width: 2});
  cursor += 4;
  bars.push({x: cursor, width: 1});
  cursor += 3;

  for (let i = 0; i < seed.length; i++) {
    const code = seed.charCodeAt(i);
    const w1 = (code % 3) + 1;
    const g1 = ((code >> 2) % 2) + 1;
    const w2 = ((code >> 4) % 2) + 1;
    bars.push({x: cursor, width: w1});
    cursor += w1 + g1;
    bars.push({x: cursor, width: w2});
    cursor += w2 + 2;
  }

  bars.push({x: cursor, width: 1});
  cursor += 3;
  bars.push({x: cursor, width: 2});
  return bars;
}
