import type {OfficialInvoiceData} from '../components/PaymentReceiptModal';
import type {ComplianceFormDraft} from '../components/MemberComplianceFormModal';
import {
  translate,
  translateGender,
  translateMethod,
  translateRole,
  translateStatus,
} from '../i18n/translations';
import type {AdaMember, AdaSettings, LanguageCode} from '../types/ada';
import type {OverdueAccountRow} from './adaCalculations';
import {formatEthiopianDate} from './ethiopianCalendar';
import {formatCurrency, formatDate, todayIsoDate} from './formatters';
import {
  ASSOCIATION_AMHARIC_TITLE,
  ASSOCIATION_ENGLISH_TITLE,
  ASSOCIATION_LOGO_PATH,
} from './idCardExport';

function loadImage(src?: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const imgRatio = img.width / img.height;
  const boxRatio = dw / dh;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (imgRatio > boxRatio) {
    sw = img.height * boxRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / boxRatio;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function drawContainImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const scale = Math.min(dw / img.width, dh / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = dx + (dw - w) / 2;
  const y = dy + (dh - h) / 2;
  ctx.drawImage(img, x, y, w, h);
}

function fitSingleLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const clean = (text || '—').trim() || '—';
  if (ctx.measureText(clean).width <= maxWidth) return clean;
  let trimmed = clean;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = (text || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function drawEmblemCircle(
  ctx: CanvasRenderingContext2D,
  logoImg: HTMLImageElement | null,
  isCustomLogo: boolean,
  cx: number,
  cy: number,
  radius: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.clip();
  if (logoImg) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    drawCoverImage(ctx, logoImg, cx - radius, cy - radius, radius * 2, radius * 2);
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#0B2C5D';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

export async function downloadOfficialInvoicePng(
  doc: OfficialInvoiceData,
  settings: AdaSettings,
  printLang: LanguageCode
): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const [logoImg, stampImg, chairmanSigImg] = await Promise.all([
    loadImage(settings.logoDataUrl || ASSOCIATION_LOGO_PATH),
    loadImage(settings.officialStampDataUrl),
    loadImage(settings.chairmanSignatureDataUrl),
  ]);

  const W = 1200;
  const H = 960;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const fontStack =
    '"Plus Jakarta Sans", "Noto Sans Ethiopic", "Ebrima", system-ui, sans-serif';
  const monoStack = '"JetBrains Mono", ui-monospace, monospace';
  const assocUpper = (settings.associationName || ASSOCIATION_ENGLISH_TITLE).toUpperCase();
  const isCustomLogo = Boolean(settings.logoDataUrl);

  // Outer white sheet
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Card border
  const pad = 28;
  const cardW = W - pad * 2;
  const cardH = H - pad * 2;
  ctx.save();
  drawRoundedRect(ctx, pad, pad, cardW, cardH, 20);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#0B2C5D';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.clip();

  // Ethiopian tri-color accent stripe
  const thirdW = cardW / 3;
  ctx.fillStyle = '#078930';
  ctx.fillRect(pad, pad, thirdW, 10);
  ctx.fillStyle = '#FCDD09';
  ctx.fillRect(pad + thirdW, pad, thirdW, 10);
  ctx.fillStyle = '#DA121A';
  ctx.fillRect(pad + thirdW * 2, pad, cardW - thirdW * 2, 10);

  // Header band
  const headerY = pad + 10;
  const headerH = 158;
  const headerGrad = ctx.createLinearGradient(pad, headerY, pad + cardW, headerY + headerH);
  headerGrad.addColorStop(0, '#EBF5FF');
  headerGrad.addColorStop(1, '#F8FBFF');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(pad, headerY, cardW, headerH);

  drawEmblemCircle(ctx, logoImg, isCustomLogo, pad + 82, headerY + 68, 44);

  ctx.fillStyle = '#034EA2';
  ctx.font = `700 22px ${fontStack}`;
  ctx.fillText(ASSOCIATION_AMHARIC_TITLE, pad + 146, headerY + 56);

  ctx.fillStyle = '#0B2C5D';
  ctx.font = `800 28px ${fontStack}`;
  ctx.fillText(fitSingleLine(ctx, assocUpper, cardW - 180), pad + 146, headerY + 94);

  // Sub-strip inside header
  ctx.fillStyle = '#CBD5E1';
  ctx.fillRect(pad + 36, headerY + 116, cardW - 72, 1.5);

  ctx.fillStyle = '#0B2C5D';
  ctx.font = `800 18px ${fontStack}`;
  ctx.fillText(
    translate(printLang, 'officialReceiptTitle').toUpperCase(),
    pad + 38,
    headerY + 144
  );

  ctx.fillStyle = '#034EA2';
  ctx.font = `700 20px ${monoStack}`;
  ctx.textAlign = 'right';
  ctx.fillText(doc.invoiceNo, pad + cardW - 38, headerY + 144);
  ctx.textAlign = 'left';

  // Header divider
  ctx.fillStyle = '#CBD5E1';
  ctx.fillRect(pad, headerY + headerH, cardW, 2);

  // Amount highlight box
  const bodyX = pad + 42;
  const bodyW = cardW - 84;
  const amtY = headerY + headerH + 34;
  const amtH = 128;

  ctx.save();
  drawRoundedRect(ctx, bodyX, amtY, bodyW, amtH, 14);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#64748B';
  ctx.font = `700 17px ${fontStack}`;
  ctx.fillText(translate(printLang, 'amount').toUpperCase(), bodyX + 26, amtY + 38);

  ctx.fillStyle = '#0B2C5D';
  ctx.font = `800 44px ${monoStack}`;
  ctx.fillText(formatCurrency(doc.amount, settings.currency), bodyX + 26, amtY + 94);

  // Status pill & Date on right of Amount box
  const isSuccess = doc.status === 'Approved' || doc.status === 'Paid';
  const isDanger = doc.status === 'Rejected' || doc.status === 'Unpaid';
  const badgeLabel = translateStatus(printLang, doc.status).toUpperCase();
  ctx.font = `800 17px ${fontStack}`;
  const badgeW = Math.max(130, ctx.measureText(badgeLabel).width + 36);
  const badgeX = bodyX + bodyW - badgeW - 26;
  const badgeY = amtY + 22;

  ctx.save();
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, 38, 8);
  ctx.fillStyle = isSuccess ? '#DCFCE7' : isDanger ? '#FEE2E2' : '#FEF3C7';
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = isSuccess ? '#166534' : isDanger ? '#991B1B' : '#92400E';
  ctx.textAlign = 'center';
  ctx.fillText(badgeLabel, badgeX + badgeW / 2, badgeY + 25);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#334155';
  ctx.font = `700 18px ${monoStack}`;
  ctx.fillText(formatDate(doc.date), bodyX + bodyW - 26, amtY + 86);
  if (settings.showEthiopianCalendar !== false) {
    const ecStr = formatEthiopianDate(doc.date, printLang);
    if (ecStr) {
      ctx.fillStyle = '#034EA2';
      ctx.font = `600 15px ${fontStack}`;
      ctx.fillText(ecStr, bodyX + bodyW - 26, amtY + 112);
    }
  }
  ctx.textAlign = 'left';

  // Details 2-column Grid
  const gridY = amtY + amtH + 40;
  const col2X = bodyX + bodyW / 2 + 16;
  const colW = bodyW / 2 - 24;

  const drawField = (label: string, val: string, sub: string | undefined, fx: number, fy: number) => {
    ctx.fillStyle = '#64748B';
    ctx.font = `700 15px ${fontStack}`;
    ctx.fillText(label.toUpperCase(), fx, fy);

    ctx.fillStyle = '#0F172A';
    ctx.font = `700 22px ${fontStack}`;
    ctx.fillText(fitSingleLine(ctx, val, colW), fx, fy + 30);

    if (sub) {
      ctx.fillStyle = '#475569';
      ctx.font = `600 16px ${monoStack}`;
      ctx.fillText(fitSingleLine(ctx, sub, colW), fx, fy + 56);
    }
  };

  drawField(
    doc.partyRole === 'vendor'
      ? translate(printLang, 'paidToVendorLabel')
      : translate(printLang, 'receivedFromLabel'),
    doc.partyName,
    doc.partySub,
    bodyX,
    gridY
  );
  drawField(
    translate(printLang, 'paymentForLabel'),
    doc.categoryName,
    translateMethod(printLang, doc.method),
    col2X,
    gridY
  );

  const row2Y = gridY + 98;
  drawField(translate(printLang, 'recordedByLabel'), doc.recordedBy, undefined, bodyX, row2Y);
  if (doc.reviewerRole) {
    drawField(
      translate(printLang, 'reviewerRoleLabel'),
      translateRole(printLang, doc.reviewerRole),
      undefined,
      col2X,
      row2Y
    );
  }

  // Notes / SMS ref
  const notesY = row2Y + 72;
  if (doc.confirmationMessage || doc.note) {
    ctx.fillStyle = '#475569';
    ctx.font = `600 16px ${fontStack}`;
    const noteLine = [
      doc.confirmationMessage ? `Ref/SMS: ${doc.confirmationMessage}` : '',
      doc.note ? `${translate(printLang, 'note')}: ${doc.note}` : '',
    ]
      .filter(Boolean)
      .join('   ·   ');
    ctx.fillText(fitSingleLine(ctx, noteLine, bodyW), bodyX, notesY);
  }

  // Dashed divider above signatures
  const sigSecY = H - pad - 245;
  ctx.save();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(bodyX, sigSecY);
  ctx.lineTo(bodyX + bodyW, sigSecY);
  ctx.stroke();
  ctx.restore();

  // Signature 1: Payer / Member
  const sigBoxW = (bodyW - 210) / 2;
  const sigLineY = sigSecY + 116;

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bodyX, sigLineY);
  ctx.lineTo(bodyX + sigBoxW, sigLineY);
  ctx.stroke();
  ctx.fillStyle = '#334155';
  ctx.font = `700 15px ${fontStack}`;
  ctx.fillText(translate(printLang, 'payerSignatureLabel'), bodyX, sigLineY + 26);

  // Signature 2: Treasurer / Authorized + Chairman signature image
  const sig2X = bodyX + sigBoxW + 34;
  if (chairmanSigImg) {
    drawContainImage(ctx, chairmanSigImg, sig2X + 12, sigLineY - 78, sigBoxW - 24, 72);
  }
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sig2X, sigLineY);
  ctx.lineTo(sig2X + sigBoxW, sigLineY);
  ctx.stroke();
  ctx.fillStyle = '#334155';
  ctx.font = `700 15px ${fontStack}`;
  ctx.fillText(translate(printLang, 'authorizedSignLabel'), sig2X, sigLineY + 26);

  // Official Edir Stamp Box on far right
  const stampX = bodyX + bodyW - 146;
  const stampY = sigSecY + 22;
  ctx.save();
  drawRoundedRect(ctx, stampX, stampY, 146, 122, 10);
  ctx.strokeStyle = '#94A3B8';
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  if (stampImg) {
    drawContainImage(ctx, stampImg, stampX + 8, stampY + 8, 130, 106);
  } else {
    ctx.fillStyle = '#64748B';
    ctx.font = `700 12px ${fontStack}`;
    ctx.textAlign = 'center';
    ctx.fillText(
      fitSingleLine(ctx, translate(printLang, 'officialStampBoxLabel'), 130),
      stampX + 73,
      stampY + 66
    );
    ctx.textAlign = 'left';
  }

  // Footer
  const footerY = H - pad - 30;
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(bodyX, footerY - 30, bodyW, 1.5);
  ctx.fillStyle = '#64748B';
  ctx.font = `600 14px ${monoStack}`;
  ctx.fillText(assocUpper, bodyX, footerY);
  ctx.textAlign = 'right';
  ctx.fillText(translate(printLang, 'officeCopyLabel'), bodyX + bodyW, footerY);
  ctx.textAlign = 'left';

  ctx.restore();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png', 1.0)
  );
  if (!blob) return;

  const safeRef = (doc.invoiceNo || 'invoice').replace(/[^a-zA-Z0-9_-]+/g, '-');
  triggerBlobDownload(blob, `${safeRef}-${printLang}.png`);
}

export async function downloadComplianceFormPng(
  memberData: AdaMember | ComplianceFormDraft,
  settings: AdaSettings,
  printLang: LanguageCode
): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const memberSignatureUrl =
    'signatureDataUrl' in memberData ? memberData.signatureDataUrl : undefined;

  const [logoImg, memberSigImg, chairmanSigImg, stampImg] = await Promise.all([
    loadImage(settings.logoDataUrl || ASSOCIATION_LOGO_PATH),
    loadImage(memberSignatureUrl),
    loadImage(settings.chairmanSignatureDataUrl),
    loadImage(settings.officialStampDataUrl),
  ]);

  const W = 1240;
  const H = 1754; // A4 crisp resolution
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const fontStack =
    '"Plus Jakarta Sans", "Noto Sans Ethiopic", "Ebrima", system-ui, sans-serif';
  const monoStack = '"JetBrains Mono", ui-monospace, monospace';
  const assocUpper = (settings.associationName || ASSOCIATION_ENGLISH_TITLE).toUpperCase();
  const isCustomLogo = Boolean(settings.logoDataUrl);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  const pad = 36;
  const cardW = W - pad * 2;
  const cardH = H - pad * 2;
  ctx.save();
  drawRoundedRect(ctx, pad, pad, cardW, cardH, 18);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#0B2C5D';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.clip();

  // Ethiopian tri-color stripe
  const thirdW = cardW / 3;
  ctx.fillStyle = '#078930';
  ctx.fillRect(pad, pad, thirdW, 12);
  ctx.fillStyle = '#FCDD09';
  ctx.fillRect(pad + thirdW, pad, thirdW, 12);
  ctx.fillStyle = '#DA121A';
  ctx.fillRect(pad + thirdW * 2, pad, cardW - thirdW * 2, 12);

  // Header
  const headerY = pad + 12;
  const headerH = 160;
  const hGrad = ctx.createLinearGradient(pad, headerY, pad + cardW, headerY + headerH);
  hGrad.addColorStop(0, '#EBF5FF');
  hGrad.addColorStop(0.5, '#F7FAFF');
  hGrad.addColorStop(1, '#EBF5FF');
  ctx.fillStyle = hGrad;
  ctx.fillRect(pad, headerY, cardW, headerH);

  drawEmblemCircle(ctx, logoImg, isCustomLogo, pad + 88, headerY + 80, 48);

  ctx.fillStyle = '#034EA2';
  ctx.font = `700 22px ${fontStack}`;
  ctx.fillText(ASSOCIATION_AMHARIC_TITLE, pad + 158, headerY + 52);

  ctx.fillStyle = '#0B2C5D';
  ctx.font = `800 30px ${fontStack}`;
  ctx.fillText(fitSingleLine(ctx, assocUpper, cardW - 410), pad + 158, headerY + 92);

  ctx.fillStyle = '#475569';
  ctx.font = `700 16px ${fontStack}`;
  ctx.fillText(
    fitSingleLine(
      ctx,
      `${translate(printLang, 'complianceFormTitle').toUpperCase()} · ${translate(
        printLang,
        'complianceFormSubtitle'
      ).toUpperCase()}`,
      cardW - 410
    ),
    pad + 158,
    headerY + 126
  );

  // Member ID Box in top-right
  const idBoxW = 205;
  const idBoxX = pad + cardW - idBoxW - 30;
  const idBoxY = headerY + 42;
  ctx.save();
  drawRoundedRect(ctx, idBoxX, idBoxY, idBoxW, 74, 10);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#93C5FD';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#64748B';
  ctx.font = `700 13px ${fontStack}`;
  ctx.textAlign = 'right';
  ctx.fillText(translate(printLang, 'colMemberId').toUpperCase(), idBoxX + idBoxW - 16, idBoxY + 26);
  ctx.fillStyle = '#0B2C5D';
  ctx.font = `800 22px ${monoStack}`;
  ctx.fillText(
    memberData.memberId || translate(printLang, 'complianceToBeAssigned'),
    idBoxX + idBoxW - 16,
    idBoxY + 56
  );
  ctx.textAlign = 'left';

  ctx.fillStyle = '#CBD5E1';
  ctx.fillRect(pad, headerY + headerH, cardW, 2);

  // Member & Truck Particulars Box
  const bodyX = pad + 44;
  const bodyW = cardW - 88;
  const infoY = headerY + headerH + 34;
  const infoH = 292;

  ctx.save();
  drawRoundedRect(ctx, bodyX, infoY, bodyW, infoH, 14);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const halfW = bodyW / 2 - 34;
  const col2X = bodyX + bodyW / 2 + 12;

  const drawParticular = (label: string, val: string | undefined, fx: number, fy: number, mono = false) => {
    ctx.fillStyle = '#64748B';
    ctx.font = `700 14px ${fontStack}`;
    ctx.fillText(fitSingleLine(ctx, label.toUpperCase(), halfW), fx, fy);

    const clean = val?.trim();
    if (clean) {
      ctx.fillStyle = '#0F172A';
      ctx.font = `700 19px ${mono ? monoStack : fontStack}`;
      ctx.fillText(fitSingleLine(ctx, clean, halfW), fx, fy + 28);
    } else {
      ctx.save();
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(fx, fy + 30);
      ctx.lineTo(fx + Math.min(280, halfW), fy + 30);
      ctx.stroke();
      ctx.restore();
    }
  };

  const joinIso = memberData.joinDate || todayIsoDate();
  const joinDual =
    settings.showEthiopianCalendar !== false
      ? `${formatDate(joinIso)} (${formatEthiopianDate(joinIso, printLang)})`
      : formatDate(joinIso);

  drawParticular(
    translate(printLang, 'fullName').replace(' *', ''),
    memberData.fullName,
    bodyX + 24,
    infoY + 40
  );
  drawParticular(
    `${translate(printLang, 'phone')} / ${translate(printLang, 'gender')}`,
    [
      memberData.phone,
      memberData.gender ? translateGender(printLang, memberData.gender) : '',
    ]
      .filter(Boolean)
      .join(' · '),
    col2X,
    infoY + 40,
    true
  );

  drawParticular(
    `${translate(printLang, 'colVehiclePlate')} & ${translate(printLang, 'vehicleMakeModel')}`,
    [memberData.vehiclePlate, memberData.vehicleMakeModel].filter(Boolean).join(' · '),
    bodyX + 24,
    infoY + 130,
    true
  );
  drawParticular(
    `${translate(printLang, 'licenceNumber')} / ${translate(printLang, 'insurancePolicyNo')}`,
    [
      memberData.licenseNumber,
      memberData.insuranceProvider
        ? `${memberData.insuranceProvider}${
            memberData.insurancePolicyNumber ? ` (${memberData.insurancePolicyNumber})` : ''
          }`
        : memberData.insurancePolicyNumber,
    ]
      .filter(Boolean)
      .join(' · '),
    col2X,
    infoY + 130,
    true
  );

  drawParticular(
    `${translate(printLang, 'locationPlace')} / ${translate(printLang, 'role')}`,
    [memberData.location, memberData.role ? translateRole(printLang, memberData.role) : '']
      .filter(Boolean)
      .join(' · '),
    bodyX + 24,
    infoY + 220
  );
  drawParticular(
    `${translate(printLang, 'emergencyName')} / ${translate(printLang, 'colJoinDate')}`,
    [memberData.emergencyContactName, memberData.emergencyContactPhone, joinDual]
      .filter(Boolean)
      .join(' · '),
    col2X,
    infoY + 220
  );

  // Bylaws Clauses Container
  const clausesY = infoY + infoH + 34;
  const formattedMonthly = formatCurrency(settings.monthlyDueAmount, settings.currency);
  const clauses = [
    translate(printLang, 'complianceClause1'),
    translate(printLang, 'complianceClause2', {
      amount: formattedMonthly,
      day: settings.monthlyDueDay,
    }),
    translate(printLang, 'complianceClause3'),
    translate(printLang, 'complianceClause4'),
    translate(printLang, 'complianceClause5'),
  ];

  // Measure height for clauses box dynamically
  const textMaxW = bodyW - 56;
  ctx.font = `700 20px ${fontStack}`;
  const introLines = wrapLines(ctx, translate(printLang, 'complianceIntroText'), textMaxW);
  ctx.font = `500 18px ${fontStack}`;
  const clauseBlocks = clauses.map((c) => wrapLines(ctx, c, textMaxW));

  let cursorY = clausesY + 42 + introLines.length * 30 + 18;
  for (const lines of clauseBlocks) {
    cursorY += lines.length * 28 + 14;
  }
  const clausesH = Math.max(430, cursorY - clausesY + 20);

  ctx.save();
  drawRoundedRect(ctx, bodyX, clausesY, bodyW, clausesH, 14);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  let drawY = clausesY + 42;
  ctx.fillStyle = '#0F172A';
  ctx.font = `700 20px ${fontStack}`;
  for (const l of introLines) {
    ctx.fillText(l, bodyX + 28, drawY);
    drawY += 30;
  }
  drawY += 16;

  ctx.fillStyle = '#334155';
  ctx.font = `500 18px ${fontStack}`;
  for (const lines of clauseBlocks) {
    for (const l of lines) {
      ctx.fillText(l, bodyX + 28, drawY);
      drawY += 28;
    }
    drawY += 14;
  }

  // Dual Signature Boxes near bottom
  const sigY = Math.max(clausesY + clausesH + 38, H - pad - 360);
  const sigH = 264;
  const boxW = (bodyW - 32) / 2;

  // Box 1: New Member Signature
  ctx.save();
  drawRoundedRect(ctx, bodyX, sigY, boxW, sigH, 14);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#0B2C5D';
  ctx.font = `800 17px ${fontStack}`;
  ctx.fillText(
    fitSingleLine(ctx, translate(printLang, 'complianceMemberSigTitle').toUpperCase(), boxW - 44),
    bodyX + 22,
    sigY + 34
  );

  ctx.fillStyle = '#475569';
  ctx.font = `600 16px ${fontStack}`;
  ctx.fillText(
    `${translate(printLang, 'fullName').replace(' *', '')}: ${memberData.fullName?.trim() || '__________________________'}`,
    bodyX + 22,
    sigY + 68
  );

  if (memberSigImg) {
    drawContainImage(ctx, memberSigImg, bodyX + 24, sigY + 92, boxW - 48, 92);
  }
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bodyX + 22, sigY + 196);
  ctx.lineTo(bodyX + boxW - 22, sigY + 196);
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = `600 14px ${fontStack}`;
  ctx.fillText(translate(printLang, 'signatureLineLabel'), bodyX + 22, sigY + 224);
  ctx.textAlign = 'right';
  ctx.fillText(`${translate(printLang, 'date')}: ____ / ____ / ________`, bodyX + boxW - 22, sigY + 224);
  ctx.textAlign = 'left';

  // Box 2: Association Authority Signature + Official Stamp
  const authX = bodyX + boxW + 32;
  ctx.save();
  drawRoundedRect(ctx, authX, sigY, boxW, sigH, 14);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#0B2C5D';
  ctx.font = `800 17px ${fontStack}`;
  ctx.fillText(
    fitSingleLine(ctx, translate(printLang, 'complianceAuthoritySigTitle').toUpperCase(), boxW - 44),
    authX + 22,
    sigY + 34
  );

  ctx.fillStyle = '#475569';
  ctx.font = `600 16px ${fontStack}`;
  ctx.fillText(
    fitSingleLine(
      ctx,
      `${translate(printLang, 'complianceAuthorityRoleLabel')}: ${settings.currentUserName}`,
      boxW - 44
    ),
    authX + 22,
    sigY + 68
  );

  const authSigW = boxW - 196;
  if (chairmanSigImg) {
    drawContainImage(ctx, chairmanSigImg, authX + 22, sigY + 92, authSigW, 92);
  }
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(authX + 22, sigY + 196);
  ctx.lineTo(authX + 22 + authSigW, sigY + 196);
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = `600 14px ${fontStack}`;
  ctx.fillText(translate(printLang, 'signatureLineLabel'), authX + 22, sigY + 224);

  // Official Edir Stamp Box inside Box 2
  const stX = authX + boxW - 156;
  const stY = sigY + 88;
  ctx.save();
  drawRoundedRect(ctx, stX, stY, 134, 134, 10);
  ctx.strokeStyle = '#94A3B8';
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  if (stampImg) {
    drawContainImage(ctx, stampImg, stX + 6, stY + 6, 122, 122);
  } else {
    ctx.fillStyle = '#64748B';
    ctx.font = `700 13px ${fontStack}`;
    ctx.textAlign = 'center';
    ctx.fillText(
      fitSingleLine(ctx, translate(printLang, 'officialStampBoxLabel'), 120),
      stX + 67,
      stY + 72
    );
    ctx.textAlign = 'left';
  }

  // Footer
  const footerY = H - pad - 28;
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(bodyX, footerY - 30, bodyW, 1.5);
  ctx.fillStyle = '#64748B';
  ctx.font = `600 15px ${monoStack}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${assocUpper}  ·  ${ASSOCIATION_AMHARIC_TITLE}`, W / 2, footerY);
  ctx.textAlign = 'left';

  ctx.restore();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png', 1.0)
  );
  if (!blob) return;

  const safeId = (memberData.memberId || 'new-member').replace(/[^a-zA-Z0-9_-]+/g, '-');
  triggerBlobDownload(blob, `compliance-form-${safeId}-${printLang}.png`);
}

export interface ExpiringComplianceItem {
  member: AdaMember;
  docTypeLabel: string;
  expiryDate: string;
  daysLeft: number;
}

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function downloadBatchNoticeSheetHtml(
  overdueRows: OverdueAccountRow[],
  expiringItems: ExpiringComplianceItem[],
  settings: AdaSettings,
  printLang: LanguageCode
): void {
  const assocUpper = (settings.associationName || ASSOCIATION_ENGLISH_TITLE).toUpperCase();
  const today = todayIsoDate();
  const ecToday = formatEthiopianDate(today, printLang);
  const logoSrc = settings.logoDataUrl || ASSOCIATION_LOGO_PATH;

  const overdueHtml =
    overdueRows.length === 0
      ? `<p class="empty">${escapeHtml(translate(printLang, 'noOverdueMembers'))}</p>`
      : `<table>
          <thead>
            <tr>
              <th>${escapeHtml(translate(printLang, 'colMemberId'))}</th>
              <th>${escapeHtml(translate(printLang, 'colVehiclePlate'))}</th>
              <th>${escapeHtml(translate(printLang, 'phone'))}</th>
              <th>${escapeHtml(translate(printLang, 'colDaysLate'))}</th>
              <th style="text-align:right">${escapeHtml(translate(printLang, 'colTotalDue'))}</th>
            </tr>
          </thead>
          <tbody>
            ${overdueRows
              .map(
                (r) => `<tr>
                  <td><strong>${escapeHtml(r.member.fullName)}</strong><br><span class="mono">${escapeHtml(r.member.memberId)}</span></td>
                  <td class="mono">${escapeHtml(r.member.vehiclePlate || '—')}</td>
                  <td class="mono">${escapeHtml(r.member.phone || '—')}</td>
                  <td class="mono">${r.daysLate} ${escapeHtml(translate(printLang, 'days'))}</td>
                  <td class="mono" style="text-align:right;font-weight:700">${escapeHtml(
                    formatCurrency(r.totalDue, settings.currency)
                  )}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>`;

  const expiringHtml =
    expiringItems.length === 0
      ? `<p class="empty">—</p>`
      : `<table>
          <thead>
            <tr>
              <th>${escapeHtml(translate(printLang, 'colMemberId'))}</th>
              <th>${escapeHtml(translate(printLang, 'colVehiclePlate'))}</th>
              <th>Document</th>
              <th>Expiry Date</th>
              <th style="text-align:right">Status</th>
            </tr>
          </thead>
          <tbody>
            ${expiringItems
              .map(
                (item) => `<tr>
                  <td><strong>${escapeHtml(item.member.fullName)}</strong><br><span class="mono">${escapeHtml(item.member.memberId)}</span></td>
                  <td class="mono">${escapeHtml(item.member.vehiclePlate || '—')}</td>
                  <td>${escapeHtml(item.docTypeLabel)}</td>
                  <td class="mono">${escapeHtml(formatDate(item.expiryDate))}</td>
                  <td style="text-align:right;font-weight:700;color:${
                    item.daysLeft < 0 ? '#b91c1c' : '#b45309'
                  }">${
                    item.daysLeft < 0
                      ? escapeHtml(translate(printLang, 'expiredLabel'))
                      : escapeHtml(translate(printLang, 'daysLeftLabel', {days: item.daysLeft}))
                  }</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>`;

  const html = `<!doctype html>
<html lang="${escapeHtml(printLang)}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(assocUpper)} - ${escapeHtml(translate(printLang, 'noticeSheetTitle'))}</title>
<style>
  body { font-family: system-ui, -apple-system, 'Noto Sans Ethiopic', sans-serif; margin: 28px; color: #0f172a; background: #fff; }
  .sheet { max-width: 960px; margin: 0 auto; border: 2px solid #0B2C5D; border-radius: 12px; overflow: hidden; }
  .stripe { display: grid; grid-template-columns: repeat(3, 1fr); height: 6px; }
  .header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 24px; background: #eff6ff; border-bottom: 1px solid #cbd5e1; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand img { width: 54px; height: 54px; border-radius: 999px; border: 2px solid #0B2C5D; object-fit: cover; object-position: left; background: #fff; }
  h1 { margin: 0; font-size: 18px; color: #0B2C5D; letter-spacing: 0.02em; }
  .am { margin: 0 0 2px; font-size: 12px; font-weight: 700; color: #034EA2; }
  .sub { margin: 2px 0 0; font-size: 12px; color: #475569; }
  .meta { text-align: right; font-size: 12px; }
  .content { padding: 20px 24px; }
  h2 { margin: 18px 0 10px; font-size: 14px; color: #0B2C5D; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
  th { background: #ebf2fa; text-align: left; padding: 8px 10px; border-bottom: 1px solid #cbd5e1; color: #334155; }
  td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  .mono { font-family: ui-monospace, monospace; }
  .empty { font-size: 12px; color: #64748b; padding: 10px 0; }
  .actions { text-align: right; margin-bottom: 12px; }
  .btn { background: #0B2C5D; color: #fff; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; }
  @media print { .actions { display: none; } body { margin: 0; } .sheet { border: 1px solid #94a3b8; } }
</style>
</head>
<body>
  <div class="actions"><button class="btn" onclick="window.print()">${escapeHtml(translate(printLang, 'printSavePdf'))}</button></div>
  <div class="sheet">
    <div class="stripe"><div style="background:#078930"></div><div style="background:#FCDD09"></div><div style="background:#DA121A"></div></div>
    <div class="header">
      <div class="brand">
        <img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(assocUpper)}" />
        <div>
          <p class="am">${escapeHtml(ASSOCIATION_AMHARIC_TITLE)}</p>
          <h1>${escapeHtml(assocUpper)}</h1>
          <p class="sub">${escapeHtml(translate(printLang, 'noticeSheetTitle'))}</p>
        </div>
      </div>
      <div class="meta">
        <div class="mono"><strong>${escapeHtml(formatDate(today))}</strong></div>
        ${ecToday ? `<div>${escapeHtml(ecToday)}</div>` : ''}
      </div>
    </div>
    <div class="content">
      <h2>${escapeHtml(translate(printLang, 'overdueDues'))} (${overdueRows.length})</h2>
      ${overdueHtml}
      <h2>${escapeHtml(translate(printLang, 'fleetInsurance'))} · Expiring / Expired (${expiringItems.length})</h2>
      ${expiringHtml}
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], {type: 'text/html;charset=utf-8'});
  triggerBlobDownload(blob, `ada-notice-sheet-${today}-${printLang}.html`);
}
