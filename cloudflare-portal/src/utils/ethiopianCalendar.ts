import type {LanguageCode} from '../types/ada';

export interface EthiopianDateParts {
  year: number;
  month: number; // 1-13
  day: number; // 1-30
  monthNameEn: string;
  monthNameGez: string;
}

const EC_MONTHS_EN = [
  'Meskerem',
  'Tikimt',
  'Hidar',
  'Tahsas',
  'Tir',
  'Yekatit',
  'Megabit',
  'Miazia',
  'Ginbot',
  'Sene',
  'Hamle',
  'Nehase',
  'Pagume',
];

const EC_MONTHS_GEZ = [
  'መስከረም',
  'ጥቅምት',
  'ኅዳር',
  'ታኅሣሥ',
  'ጥር',
  'የካቲት',
  'መጋቢት',
  'ሚያዝያ',
  'ግንቦት',
  'ሰኔ',
  'ሐምሌ',
  'ነሐሴ',
  'ጳጉሜ',
];

function gregorianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/**
 * Converts a Gregorian YYYY-MM-DD date string into Ethiopian Calendar components.
 * Uses standard Ethiopian Era JDN epoch (1724220).
 */
export function toEthiopianDate(isoDate?: string): EthiopianDateParts | null {
  if (!isoDate) return null;
  const clean = isoDate.slice(0, 10);
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const gy = Number(match[1]);
  const gm = Number(match[2]);
  const gd = Number(match[3]);
  if (!gy || gm < 1 || gm > 12 || gd < 1 || gd > 31) return null;

  const jdn = gregorianToJdn(gy, gm, gd);
  const r = (jdn - 1723856) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const year =
    4 * Math.floor((jdn - 1723856) / 1461) +
    Math.floor(r / 365) -
    Math.floor(r / 1460);
  const month = Math.floor(n / 30) + 1;
  const day = (n % 30) + 1;

  const safeMonth = Math.max(1, Math.min(13, month));
  return {
    year,
    month: safeMonth,
    day,
    monthNameEn: EC_MONTHS_EN[safeMonth - 1] ?? '',
    monthNameGez: EC_MONTHS_GEZ[safeMonth - 1] ?? '',
  };
}

export function formatEthiopianDate(
  isoDate?: string,
  lang: LanguageCode = 'en'
): string {
  const ec = toEthiopianDate(isoDate);
  if (!ec) return '';
  if (lang === 'am' || lang === 'ti') {
    return `${ec.monthNameGez} ${ec.day}, ${ec.year} ዓ.ም`;
  }
  return `${ec.monthNameEn} ${ec.day}, ${ec.year} E.C.`;
}
