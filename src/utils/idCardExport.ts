import {
  translate,
  translateGender,
  translateRole,
  translateStatus,
} from '../i18n/translations';
import type {AdaMember, AdaSettings, LanguageCode} from '../types/ada';
import {buildBarcodeBars} from './adaCalculations';
import {formatEthiopianDate} from './ethiopianCalendar';
import {formatDate} from './formatters';

export const ASSOCIATION_LOGO_PATH = '/assets/aistudio/apple-touch-icon_e3bb6b8a.png';
export const ASSOCIATION_AMHARIC_TITLE = 'አዳማ የከባድ መኪና ሹፌሮች መረዳጃ ዕድር';
export const ASSOCIATION_ENGLISH_TITLE = 'ADAMA HEAVY TRUCK DRIVERS EDIR';

function loadImage(src: string): Promise<HTMLImageElement | null> {
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

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  const clean = (text || '—').trim() || '—';
  if (ctx.measureText(clean).width <= maxWidth) return clean;
  let trimmed = clean;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
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

function drawCardShell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  // Card base gradient
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, 28);
  ctx.clip();

  const bgGrad = ctx.createLinearGradient(x, y, x + w, y + h);
  bgGrad.addColorStop(0, '#FFFFFF');
  bgGrad.addColorStop(0.55, '#F4F9FF');
  bgGrad.addColorStop(1, '#E6F1FC');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(x, y, w, h);

  // Subtle geometric highway / security arcs watermark
  ctx.strokeStyle = 'rgba(3, 78, 162, 0.06)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(x + w - 90, y + h - 40, 140 + i * 38, Math.PI, Math.PI * 1.65);
    ctx.stroke();
  }
  ctx.restore();

  // Crisp outer card border
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, 28);
  ctx.strokeStyle = '#0F3D7A';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function drawFrontCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  member: AdaMember,
  settings: AdaSettings,
  logoImg: HTMLImageElement | null,
  photoImg: HTMLImageElement | null,
  lang: LanguageCode
) {
  const fontStack =
    '"Plus Jakarta Sans", "Noto Sans Ethiopic", system-ui, -apple-system, sans-serif';
  const monoStack = '"JetBrains Mono", ui-monospace, monospace';

  drawCardShell(ctx, x, y, w, h);

  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, 28);
  ctx.clip();

  // Top Header Band featuring the official association logo & bilingual name banner (785x116)
  const headerH = 152;
  const headerGrad = ctx.createLinearGradient(x, y, x + w, y + headerH);
  headerGrad.addColorStop(0, '#EBF7FF');
  headerGrad.addColorStop(1, '#D7EEFF');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(x, y, w, headerH);

  const assocUpper = (settings.associationName || ASSOCIATION_ENGLISH_TITLE).toUpperCase();

  let textStartX = x + 36;
  if (logoImg) {
    const emblemR = 52;
    const cx = x + 36 + emblemR;
    const cy = y + headerH / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, emblemR, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.clip();
    drawCoverImage(ctx, logoImg, cx - emblemR, cy - emblemR, emblemR * 2, emblemR * 2);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, emblemR, 0, Math.PI * 2);
    ctx.strokeStyle = '#034EA2';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    textStartX = cx + emblemR + 24;
  }
  ctx.fillStyle = '#034EA2';
  ctx.font = `800 26px ${fontStack}`;
  ctx.fillText(ASSOCIATION_AMHARIC_TITLE, textStartX, y + 66);
  ctx.fillStyle = '#0B2C5D';
  ctx.font = `800 22px ${fontStack}`;
  ctx.fillText(fitText(ctx, assocUpper, x + w - textStartX - 24), textStartX, y + 106);

  // Subtle circular logo watermark behind right content area
  if (logoImg) {
    ctx.save();
    ctx.globalAlpha = 0.065;
    ctx.beginPath();
    ctx.arc(x + w - 155, y + 380, 145, 0, Math.PI * 2);
    ctx.clip();
    drawCoverImage(ctx, logoImg, x + w - 300, y + 235, 290, 290);
    ctx.restore();
  }

  // Ethiopian tri-color security accent strip beneath header
  const stripeY = y + headerH;
  const thirdW = w / 3;
  ctx.fillStyle = '#078930';
  ctx.fillRect(x, stripeY, thirdW, 5);
  ctx.fillStyle = '#FCDD09';
  ctx.fillRect(x + thirdW, stripeY, thirdW, 5);
  ctx.fillStyle = '#DA121A';
  ctx.fillRect(x + thirdW * 2, stripeY, w - thirdW * 2, 5);

  // Left Column: Portrait + Member ID + Status
  const photoX = x + 38;
  const photoY = y + 186;
  const photoW = 216;
  const photoH = 266;

  ctx.save();
  drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 16);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.clip();
  if (photoImg) {
    drawCoverImage(ctx, photoImg, photoX, photoY, photoW, photoH);
  } else {
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(photoX, photoY, photoW, photoH);
    const initials = member.fullName
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    ctx.fillStyle = '#0F3D7A';
    ctx.font = `800 62px ${fontStack}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials || 'AD', photoX + photoW / 2, photoY + photoH / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();

  ctx.save();
  drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 16);
  ctx.strokeStyle = '#034EA2';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.restore();

  // Member ID Badge below portrait
  const idBadgeY = photoY + photoH + 16;
  ctx.save();
  drawRoundedRect(ctx, photoX, idBadgeY, photoW, 46, 10);
  ctx.fillStyle = '#0B2C5D';
  ctx.fill();
  ctx.fillStyle = '#FACC15';
  ctx.font = `700 22px ${monoStack}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(member.memberId, photoX + photoW / 2, idBadgeY + 24);
  ctx.restore();

  // Status line below ID badge
  const statusDotColor =
    member.status === 'Active'
      ? '#059669'
      : member.status === 'Deceased'
        ? '#64748B'
        : '#DC2626';
  ctx.save();
  ctx.fillStyle = statusDotColor;
  ctx.beginPath();
  ctx.arc(photoX + 16, idBadgeY + 68, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.font = `700 18px ${fontStack}`;
  ctx.fillText(
    `${translate(lang, 'status').toUpperCase()}: ${translateStatus(lang, member.status).toUpperCase()}`,
    photoX + 30,
    idBadgeY + 74
  );
  ctx.restore();

  // Right Column: Member Data Grid
  const rx = photoX + photoW + 36;
  const rw = x + w - rx - 38;

  // Full Name
  ctx.fillStyle = '#475569';
  ctx.font = `700 15px ${fontStack}`;
  ctx.fillText(translate(lang, 'fullName').replace(' *', '').toUpperCase(), rx, y + 206);

  ctx.fillStyle = '#0B2C5D';
  ctx.font = `800 32px ${fontStack}`;
  ctx.fillText(fitText(ctx, member.fullName, rw), rx, y + 244);

  // Thin divider
  ctx.fillStyle = 'rgba(3, 78, 162, 0.16)';
  ctx.fillRect(rx, y + 260, rw, 2);

  // Row 1: Role + Gender
  const col2X = rx + Math.round(rw * 0.54);
  ctx.fillStyle = '#475569';
  ctx.font = `700 14px ${fontStack}`;
  ctx.fillText(translate(lang, 'role').toUpperCase(), rx, y + 290);
  ctx.fillText(translate(lang, 'gender').toUpperCase(), col2X, y + 290);

  ctx.fillStyle = '#0F172A';
  ctx.font = `700 22px ${fontStack}`;
  ctx.fillText(
    fitText(ctx, translateRole(lang, member.role), col2X - rx - 16),
    rx,
    y + 320
  );
  ctx.fillText(
    fitText(ctx, translateGender(lang, member.gender), x + w - col2X - 38),
    col2X,
    y + 320
  );

  // Row 2: Vehicle Plate (highlighted badge) + Phone
  ctx.fillStyle = '#475569';
  ctx.font = `700 14px ${fontStack}`;
  ctx.fillText(translate(lang, 'colVehiclePlate').toUpperCase(), rx, y + 362);
  ctx.fillText(translate(lang, 'phone').toUpperCase(), col2X, y + 362);

  // Plate Pill
  ctx.save();
  drawRoundedRect(ctx, rx, y + 372, col2X - rx - 22, 42, 8);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#034EA2';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#034EA2';
  ctx.font = `800 22px ${monoStack}`;
  ctx.fillText(fitText(ctx, member.vehiclePlate || '—', col2X - rx - 42), rx + 12, y + 400);
  ctx.restore();

  ctx.fillStyle = '#0F172A';
  ctx.font = `700 20px ${monoStack}`;
  ctx.fillText(fitText(ctx, member.phone || '—', x + w - col2X - 38), col2X, y + 400);

  // Row 3: Employer + Location
  ctx.fillStyle = '#475569';
  ctx.font = `700 14px ${fontStack}`;
  ctx.fillText(translate(lang, 'employer').toUpperCase(), rx, y + 450);
  ctx.fillText(translate(lang, 'locationPlace').toUpperCase(), col2X, y + 450);

  ctx.fillStyle = '#1E293B';
  ctx.font = `600 19px ${fontStack}`;
  ctx.fillText(fitText(ctx, member.employer || '—', col2X - rx - 16), rx, y + 480);
  ctx.fillText(fitText(ctx, member.location || '—', x + w - col2X - 38), col2X, y + 480);

  // Join date line
  ctx.fillStyle = '#475569';
  ctx.font = `700 14px ${fontStack}`;
  ctx.fillText(
    `${translate(lang, 'colJoinDate').toUpperCase()}: ${formatDate(member.joinDate)}`,
    rx,
    y + 528
  );

  // Bottom Navy Footer Strip
  const footerH = 48;
  const footerY = y + h - footerH;
  ctx.fillStyle = '#0B2C5D';
  ctx.fillRect(x, footerY, w, footerH);

  ctx.fillStyle = '#FACC15';
  ctx.font = `700 16px ${fontStack}`;
  ctx.fillText('OFFICIAL DRIVER MEMBERSHIP CARD', x + 38, footerY + 30);

  ctx.fillStyle = '#E2E8F0';
  ctx.font = `600 15px ${monoStack}`;
  ctx.textAlign = 'right';
  ctx.fillText(`ID: ${member.memberId}`, x + w - 38, footerY + 30);
  ctx.textAlign = 'left';

  ctx.restore();
}

function drawBackCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  member: AdaMember,
  settings: AdaSettings,
  logoImg: HTMLImageElement | null,
  lang: LanguageCode,
  stampImg: HTMLImageElement | null,
  chairmanSigImg: HTMLImageElement | null
) {
  const fontStack =
    '"Plus Jakarta Sans", "Noto Sans Ethiopic", system-ui, -apple-system, sans-serif';
  const monoStack = '"JetBrains Mono", ui-monospace, monospace';

  drawCardShell(ctx, x, y, w, h);

  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, 28);
  ctx.clip();

  // Top Header Strip
  const headerH = 92;
  const headerGrad = ctx.createLinearGradient(x, y, x + w, y + headerH);
  headerGrad.addColorStop(0, '#0B2C5D');
  headerGrad.addColorStop(1, '#034EA2');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(x, y, w, headerH);

  const assocUpper = (settings.associationName || ASSOCIATION_ENGLISH_TITLE).toUpperCase();

  // Circular emblem in card back header
  if (logoImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + 64, y + headerH / 2, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    drawCoverImage(ctx, logoImg, x + 34, y + headerH / 2 - 30, 60, 60);
    ctx.restore();
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 20px ${fontStack}`;
  ctx.fillText(ASSOCIATION_AMHARIC_TITLE, x + 110, y + 39);
  ctx.fillStyle = '#BAE6FD';
  ctx.font = `700 15px ${fontStack}`;
  ctx.fillText(fitText(ctx, assocUpper, w - 260), x + 110, y + 67);

  ctx.fillStyle = '#FACC15';
  ctx.font = `700 16px ${monoStack}`;
  ctx.textAlign = 'right';
  ctx.fillText(member.memberId, x + w - 36, y + 52);
  ctx.textAlign = 'left';

  // Tri-color hairline accent
  const stripeY = y + headerH;
  const thirdW = w / 3;
  ctx.fillStyle = '#078930';
  ctx.fillRect(x, stripeY, thirdW, 4);
  ctx.fillStyle = '#FCDD09';
  ctx.fillRect(x + thirdW, stripeY, thirdW, 4);
  ctx.fillStyle = '#DA121A';
  ctx.fillRect(x + thirdW * 2, stripeY, w - thirdW * 2, 4);

  // Back Body: Verification Grid
  const bx = x + 40;
  const col2X = x + 520;
  const colW = 450;

  // Row 1: Licence Number + Licence Expiry
  ctx.fillStyle = '#475569';
  ctx.font = `700 14px ${fontStack}`;
  ctx.fillText(translate(lang, 'licenceNumber').toUpperCase(), bx, y + 144);
  ctx.fillText(translate(lang, 'licenceExpiry').toUpperCase(), col2X, y + 144);

  ctx.fillStyle = '#0F172A';
  ctx.font = `700 22px ${monoStack}`;
  ctx.fillText(fitText(ctx, member.licenseNumber || '—', colW), bx, y + 176);
  ctx.fillText(fitText(ctx, formatDate(member.licenseExpiry), colW), col2X, y + 176);

  // Row 2: Blood Type + Date of Birth
  ctx.fillStyle = '#475569';
  ctx.font = `700 14px ${fontStack}`;
  ctx.fillText(translate(lang, 'bloodType').toUpperCase(), bx, y + 224);
  ctx.fillText(translate(lang, 'dob').toUpperCase(), col2X, y + 224);

  // Blood type medical badge
  ctx.save();
  drawRoundedRect(ctx, bx, y + 234, 96, 38, 8);
  ctx.fillStyle = '#FEF2F2';
  ctx.fill();
  ctx.strokeStyle = '#DC2626';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#B91C1C';
  ctx.font = `800 22px ${monoStack}`;
  ctx.textAlign = 'center';
  ctx.fillText(member.bloodType || '—', bx + 48, y + 261);
  ctx.restore();

  ctx.fillStyle = '#0F172A';
  ctx.font = `700 21px ${monoStack}`;
  ctx.fillText(fitText(ctx, formatDate(member.dateOfBirth), colW), col2X, y + 258);

  // Row 3: Emergency Contact + Authorized Seal Box
  ctx.fillStyle = '#475569';
  ctx.font = `700 14px ${fontStack}`;
  ctx.fillText(translate(lang, 'emergencyName').toUpperCase(), bx, y + 312);

  ctx.fillStyle = '#0F172A';
  ctx.font = `700 21px ${fontStack}`;
  ctx.fillText(fitText(ctx, member.emergencyContactName || '—', 440), bx, y + 344);
  ctx.fillStyle = '#034EA2';
  ctx.font = `700 19px ${monoStack}`;
  ctx.fillText(fitText(ctx, member.emergencyContactPhone || '—', 440), bx, y + 374);

  // Seal & Official Notice Box on right
  const sealX = col2X;
  const sealY = y + 300;
  const sealW = x + w - col2X - 40;
  const sealH = 148;
  ctx.save();
  drawRoundedRect(ctx, sealX, sealY, sealW, sealH, 12);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.fill();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (stampImg) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.drawImage(stampImg, sealX + sealW - 96, sealY + 42, 74, 74);
    ctx.restore();
  } else if (logoImg) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.arc(sealX + sealW - 56, sealY + 74, 42, 0, Math.PI * 2);
    ctx.clip();
    drawCoverImage(ctx, logoImg, sealX + sealW - 98, sealY + 32, 84, 84);
    ctx.restore();
  }

  ctx.fillStyle = '#0B2C5D';
  ctx.font = `700 14px ${fontStack}`;
  ctx.fillText('AUTHORIZED ASSOCIATION CARD', sealX + 16, sealY + 28);
  ctx.fillStyle = '#475569';
  ctx.font = `600 13px ${fontStack}`;
  ctx.fillText('Property of ADAMA HEAVY TRUCK', sealX + 16, sealY + 54);
  ctx.fillText('DRIVERS EDIR.', sealX + 16, sealY + 74);
  ctx.fillText('If found, return to office.', sealX + 16, sealY + 94);

  if (chairmanSigImg) {
    const scale = Math.min(160 / chairmanSigImg.width, 32 / chairmanSigImg.height);
    const sw = chairmanSigImg.width * scale;
    const sh = chairmanSigImg.height * scale;
    ctx.drawImage(chairmanSigImg, sealX + 18, sealY + 122 - sh, sw, sh);
  }

  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sealX + 16, sealY + 124);
  ctx.lineTo(sealX + 210, sealY + 124);
  ctx.stroke();
  ctx.fillStyle = '#64748B';
  ctx.font = `600 12px ${fontStack}`;
  ctx.fillText('CHAIRPERSON / MANAGER SEAL', sealX + 16, sealY + 140);
  ctx.restore();

  // Bottom Barcode Band
  const bandH = 116;
  const bandY = y + h - bandH;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x, bandY, w, bandH);
  ctx.fillStyle = '#CBD5E1';
  ctx.fillRect(x, bandY, w, 2);

  const bars = buildBarcodeBars(member.memberId);
  const lastBar = bars[bars.length - 1];
  const rawBarcodeW = lastBar ? lastBar.x + lastBar.width + 2 : 120;
  const targetBarcodeW = 460;
  const scaleX = targetBarcodeW / rawBarcodeW;

  ctx.fillStyle = '#0F172A';
  for (const bar of bars) {
    ctx.fillRect(
      bx + bar.x * scaleX,
      bandY + 18,
      Math.max(1.5, bar.width * scaleX),
      64
    );
  }

  ctx.fillStyle = '#0B2C5D';
  ctx.font = `800 22px ${monoStack}`;
  ctx.textAlign = 'right';
  ctx.fillText(member.memberId, x + w - 40, bandY + 42);
  ctx.fillStyle = '#475569';
  ctx.font = `600 14px ${fontStack}`;
  ctx.fillText(assocUpper, x + w - 40, bandY + 66);
  const joinEc =
    settings.showEthiopianCalendar !== false && member.joinDate
      ? formatEthiopianDate(member.joinDate, lang)
      : '';
  ctx.fillStyle = '#034EA2';
  ctx.font = `700 13px ${fontStack}`;
  ctx.fillText(
    joinEc ? `${ASSOCIATION_AMHARIC_TITLE} · ${joinEc}` : ASSOCIATION_AMHARIC_TITLE,
    x + w - 40,
    bandY + 90
  );
  ctx.textAlign = 'left';

  ctx.restore();
}

async function exportIdCardImage(
  member: AdaMember,
  settings: AdaSettings,
  inverted: boolean,
  langOverride?: LanguageCode
): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const effectiveLang = langOverride ?? settings.defaultPrintLanguage ?? settings.language;

  const [logoImg, photoImg, stampImg, chairmanSigImg] = await Promise.all([
    loadImage(settings.logoDataUrl || ASSOCIATION_LOGO_PATH),
    member.photoDataUrl ? loadImage(member.photoDataUrl) : Promise.resolve(null),
    settings.officialStampDataUrl ? loadImage(settings.officialStampDataUrl) : Promise.resolve(null),
    settings.chairmanSignatureDataUrl
      ? loadImage(settings.chairmanSignatureDataUrl)
      : Promise.resolve(null),
  ]);

  // 300 DPI CR80 card size (1012 x 638 px each) placed side by side
  const cardW = 1012;
  const cardH = 638;
  const paddingX = 64;
  const paddingY = 64;
  const gap = 48;

  const canvasW = paddingX * 2 + cardW * 2 + gap; // 2200 px
  const canvasH = paddingY * 2 + cardH; // 766 px

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Crisp pure white print sheet background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.save();
  if (inverted) {
    // Horizontally invert (mirror) the entire side-by-side print layout so it prints correctly
    ctx.translate(canvasW, 0);
    ctx.scale(-1, 1);
  }

  const frontX = paddingX;
  const backX = paddingX + cardW + gap;

  drawFrontCard(
    ctx,
    frontX,
    paddingY,
    cardW,
    cardH,
    member,
    settings,
    logoImg,
    photoImg,
    effectiveLang
  );
  drawBackCard(
    ctx,
    backX,
    paddingY,
    cardW,
    cardH,
    member,
    settings,
    logoImg,
    effectiveLang,
    stampImg,
    chairmanSigImg
  );

  // Subtle dashed trim divider between Front & Back cards
  ctx.save();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(paddingX + cardW + gap / 2, paddingY - 18);
  ctx.lineTo(paddingX + cardW + gap / 2, paddingY + cardH + 18);
  ctx.stroke();
  ctx.restore();

  ctx.restore();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png', 1.0)
  );
  if (!blob) return;

  const safeName = member.fullName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const modeSuffix = inverted ? 'id-print-inverted' : 'id-card';
  const filename = `${member.memberId}-${safeName || 'member'}-${modeSuffix}-${effectiveLang}.png`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadInvertedIdCardImage(
  member: AdaMember,
  settings: AdaSettings,
  printLang?: LanguageCode
): Promise<void> {
  return exportIdCardImage(member, settings, true, printLang);
}

export function downloadNormalIdCardImage(
  member: AdaMember,
  settings: AdaSettings,
  printLang?: LanguageCode
): Promise<void> {
  return exportIdCardImage(member, settings, false, printLang);
}

const PNG_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32Bytes(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = PNG_CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

async function injectPngDpi300(blob: Blob): Promise<Blob> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  // PNG signature (8 bytes) + IHDR chunk (25 bytes) = 33 bytes
  if (buf.length < 33) return blob;
  const ppu = 11811; // 300 DPI = 11811 pixels per meter
  const phys = new Uint8Array(21);
  const view = new DataView(phys.buffer);
  view.setUint32(0, 9); // chunk data length
  phys[4] = 0x70; // 'p'
  phys[5] = 0x48; // 'H'
  phys[6] = 0x59; // 'Y'
  phys[7] = 0x73; // 's'
  view.setUint32(8, ppu);
  view.setUint32(12, ppu);
  phys[16] = 1; // unit = meter
  view.setUint32(17, crc32Bytes(phys.subarray(4, 17)));

  const out = new Uint8Array(buf.length + phys.length);
  out.set(buf.subarray(0, 33), 0);
  out.set(phys, 33);
  out.set(buf.subarray(33), 33 + phys.length);
  return new Blob([out], {type: 'image/png'});
}

async function renderBatchIdCardsSheetCanvas(
  members: AdaMember[],
  settings: AdaSettings,
  inverted: boolean,
  langOverride?: LanguageCode
): Promise<HTMLCanvasElement | null> {
  const batch = members.slice(0, 5);
  if (batch.length === 0) return null;

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const effectiveLang = langOverride ?? settings.defaultPrintLanguage ?? settings.language;

  const [logoImg, stampImg, chairmanSigImg, ...photoImgs] = await Promise.all([
    loadImage(settings.logoDataUrl || ASSOCIATION_LOGO_PATH),
    settings.officialStampDataUrl ? loadImage(settings.officialStampDataUrl) : Promise.resolve(null),
    settings.chairmanSignatureDataUrl
      ? loadImage(settings.chairmanSignatureDataUrl)
      : Promise.resolve(null),
    ...batch.map((m) => (m.photoDataUrl ? loadImage(m.photoDataUrl) : Promise.resolve(null))),
  ]);

  // Exact A4 portrait at 300 DPI (2480 x 3508 px, 210mm x 297mm) matching the 5-up Fayda sheet geometry
  const baseCardW = 1012;
  const baseCardH = 638;
  const cardW = 1054;
  const cardH = 662;
  const gapX = 68;
  const paddingX = 152; // 152 + 1054 + 68 + 1054 + 152 = 2480 px
  const rowGap = 33;
  const paddingY = 25; // rows start at y = 25, 720, 1415, 2110, 2805 (height 662 each)

  const canvasW = paddingX * 2 + cardW * 2 + gapX; // 2480 px
  const canvasH = 3508; // exact A4 300 DPI height (bottom margin 41 px)

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.save();
  if (inverted) {
    // Mirror the full A4 sheet horizontally so printing & lamination comes out right-side up
    ctx.translate(canvasW, 0);
    ctx.scale(-1, 1);
  }

  const frontX = paddingX;
  const backX = paddingX + cardW + gapX;
  const scaleX = cardW / baseCardW;
  const scaleY = cardH / baseCardH;

  for (let i = 0; i < batch.length; i += 1) {
    const member = batch[i];
    const rowY = paddingY + i * (cardH + rowGap);

    ctx.save();
    ctx.translate(frontX, rowY);
    ctx.scale(scaleX, scaleY);
    drawFrontCard(
      ctx,
      0,
      0,
      baseCardW,
      baseCardH,
      member,
      settings,
      logoImg,
      photoImgs[i] ?? null,
      effectiveLang
    );
    ctx.restore();

    ctx.save();
    ctx.translate(backX, rowY);
    ctx.scale(scaleX, scaleY);
    drawBackCard(
      ctx,
      0,
      0,
      baseCardW,
      baseCardH,
      member,
      settings,
      logoImg,
      effectiveLang,
      stampImg,
      chairmanSigImg
    );
    ctx.restore();
  }

  ctx.restore();
  return canvas;
}

export async function generateBatchIdSheetPreviewDataUrl(
  members: AdaMember[],
  settings: AdaSettings,
  inverted: boolean,
  langOverride?: LanguageCode
): Promise<string | null> {
  const fullCanvas = await renderBatchIdCardsSheetCanvas(members, settings, inverted, langOverride);
  if (!fullCanvas) return null;

  const previewW = 930;
  const previewH = Math.round((fullCanvas.height / fullCanvas.width) * previewW);
  const scaled = document.createElement('canvas');
  scaled.width = previewW;
  scaled.height = previewH;
  const sctx = scaled.getContext('2d');
  if (!sctx) return fullCanvas.toDataURL('image/png');
  sctx.fillStyle = '#FFFFFF';
  sctx.fillRect(0, 0, previewW, previewH);
  sctx.drawImage(fullCanvas, 0, 0, previewW, previewH);
  return scaled.toDataURL('image/png');
}

async function exportBatchIdCardsSheetImage(
  members: AdaMember[],
  settings: AdaSettings,
  inverted: boolean,
  langOverride?: LanguageCode
): Promise<void> {
  const canvas = await renderBatchIdCardsSheetCanvas(members, settings, inverted, langOverride);
  if (!canvas) return;

  const rawBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png', 1.0)
  );
  if (!rawBlob) return;

  const blob = await injectPngDpi300(rawBlob);

  const effectiveLang = langOverride ?? settings.defaultPrintLanguage ?? settings.language;
  const count = Math.min(members.length, 5);
  const modeSuffix = inverted ? 'inverted' : 'normal';
  const filename = `ada-print-ids-${count}-sheet-${modeSuffix}-${effectiveLang}.png`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadInvertedBatchIdCardsSheet(
  members: AdaMember[],
  settings: AdaSettings,
  printLang?: LanguageCode
): Promise<void> {
  return exportBatchIdCardsSheetImage(members, settings, true, printLang);
}

export function downloadNormalBatchIdCardsSheet(
  members: AdaMember[],
  settings: AdaSettings,
  printLang?: LanguageCode
): Promise<void> {
  return exportBatchIdCardsSheetImage(members, settings, false, printLang);
}
