export function formatCurrency(amount: number, currency = 'ETB'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${currency} ${safe.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatEtb(amount: number): string {
  return formatCurrency(amount, 'ETB');
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function currentMonthIso(offsetMonths = 0): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  if (!y || !m) return yyyyMm;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-US', {month: 'short', year: 'numeric'});
}

export function calculateAgeFromDob(dob?: string): number | '' {
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

export function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function nextSequentialCode(
  prefix: string,
  existingCodes: string[],
  padLength = 4
): string {
  let maxNum = 0;
  const normalizedPrefix = prefix.toUpperCase();
  for (const code of existingCodes) {
    if (!code) continue;
    const upper = code.toUpperCase();
    if (upper.startsWith(normalizedPrefix)) {
      const rest = upper.slice(normalizedPrefix.length);
      const match = rest.match(/^(\d+)/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val > maxNum) maxNum = val;
      }
    }
  }
  return `${prefix}${String(maxNum + 1).padStart(padLength, '0')}`;
}

export function nextAdaMemberId(existingIds: string[]): string {
  return nextSequentialCode('ADA-', existingIds, 4);
}

export function nextPaymentReference(existingRefs: string[]): string {
  const year = new Date().getFullYear();
  return nextSequentialCode(`PAY-${year}-`, existingRefs, 4);
}

export function compressImageToDataUrl(
  file: File,
  maxDimension = 1100,
  quality = 0.78,
  preserveTransparency = false
): Promise<{dataUrl: string; sizeBytes: number}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      if (!file.type.startsWith('image/')) {
        resolve({dataUrl: result, sizeBytes: file.size});
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({dataUrl: result, sizeBytes: file.size});
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const keepPng =
          preserveTransparency &&
          (file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/svg+xml');
        const compressed = keepPng
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', quality);
        const approxBytes = Math.round((compressed.length * 3) / 4);
        resolve({dataUrl: compressed, sizeBytes: approxBytes});
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

export function parseCsvText(csvText: string): {headers: string[]; rows: string[][]} {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return {headers: [], rows: []};

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some((cell) => cell !== '')) rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }
  currentRow.push(currentField.trim());
  if (currentRow.some((cell) => cell !== '')) rows.push(currentRow);
  if (rows.length === 0) return {headers: [], rows: []};
  const [headers, ...dataRows] = rows;
  return {headers, rows: dataRows};
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | undefined)[][]
): void {
  const escapeCell = (val: string | number | undefined): string => {
    const str = val === undefined || val === null ? '' : String(val);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], {type: 'text/plain;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
