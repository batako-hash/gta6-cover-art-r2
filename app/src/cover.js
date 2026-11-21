// VICE NOIR — Midnight Cover Lab: the cover render engine.
// Draws diagonal comic-strip panels, a neon-noir grade, halftone, grain and a
// big Anton title block onto any canvas, at any size. No network, no libraries.

export const LAYOUTS = {
  diagonal: { name: 'Diagonal Cut', panels: 3 },
  strip: { name: 'Comic Strip', panels: 3 },
  'hero-duo': { name: 'Hero + Duo', panels: 3 },
  bleed: { name: 'Full Bleed', panels: 1 },
};

export const GRADES = {
  neon: {
    name: 'Neon Noir',
    filter: 'contrast(1.18) saturate(1.35)',
    wash: ['rgba(255,46,126,0.30)', 'rgba(0,229,255,0.28)'],
    glow: '#ff2e7e', accent: '#00e5ff', sub: '#ff7ab8',
  },
  violet: {
    name: 'Vice Violet',
    filter: 'contrast(1.12) saturate(1.25) hue-rotate(-16deg)',
    wash: ['rgba(139,92,246,0.34)', 'rgba(255,46,126,0.26)'],
    glow: '#a855f7', accent: '#ff2e7e', sub: '#c4b5fd',
  },
  teal: {
    name: 'Midnight Teal',
    filter: 'contrast(1.15) saturate(1.15) hue-rotate(16deg)',
    wash: ['rgba(0,229,255,0.30)', 'rgba(20,120,160,0.30)'],
    glow: '#00e5ff', accent: '#5eead4', sub: '#99f6e4',
  },
  ink: {
    name: 'Mono Ink',
    filter: 'grayscale(1) contrast(1.28)',
    wash: ['rgba(255,255,255,0.10)', 'rgba(0,0,0,0.22)'],
    glow: '#ffffff', accent: '#ff2e7e', sub: '#e5e5e5',
  },
};

const TITLE_BAND = 0.2; // fraction of the height the title band takes
const GUTTER = 0.012; // fraction of the width, black separator thickness

/** Panel polygons for a layout, as fractions of (W, H). Each panel: { pts: [[fx, fy], ...], box: [x, y, w, h] }. */
export function layoutPanels(layout, W, H) {
  const artH = H * (1 - TITLE_BAND);
  const panels = [];
  const boxOf = (pts) => {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    return [x0 * W, y0 * H, (x1 - x0) * W, (y1 - y0) * H];
  };
  if (layout === 'diagonal') {
    panels.push({ pts: [[0, 0], [0.7, 0], [0.6, artH / H], [0, artH / H]] });
    panels.push({ pts: [[0.7, 0], [1, 0], [1, 0.4 * (artH / H)], [0.65, 0.4 * (artH / H)]] });
    panels.push({ pts: [[0.65, 0.4 * (artH / H)], [1, 0.4 * (artH / H)], [1, artH / H], [0.6, artH / H]] });
  } else if (layout === 'strip') {
    const s = 0.012; // slant, fraction of height
    panels.push({ pts: [[0, s], [1, 0], [1, 0.27 * (artH / H) - s], [0, 0.27 * (artH / H) + s]] });
    panels.push({ pts: [[0, 0.27 * (artH / H) + s], [1, 0.27 * (artH / H) - s], [1, 0.54 * (artH / H) + s], [0, 0.54 * (artH / H) - s]] });
    panels.push({ pts: [[0, 0.54 * (artH / H) - s], [1, 0.54 * (artH / H) + s], [1, artH / H], [0, artH / H]] });
  } else if (layout === 'hero-duo') {
    panels.push({ pts: [[0, 0], [1, 0], [1, 0.58 * (artH / H)], [0, 0.58 * (artH / H)]] });
    panels.push({ pts: [[0, 0.58 * (artH / H)], [0.5, 0.58 * (artH / H)], [0.5, artH / H], [0, artH / H]] });
    panels.push({ pts: [[0.5, 0.58 * (artH / H)], [1, 0.58 * (artH / H)], [1, artH / H], [0.5, artH / H]] });
  } else { // bleed
    panels.push({ pts: [[0, 0], [1, 0], [1, 1], [0, 1]] });
  }
  return panels.map((p) => ({ ...p, box: boxOf(p.pts) }));
}

/** Cover-fits `img` into `box` with a crop ({ zoom, ox, oy }); ox/oy shift by a fraction of the box.
 * The shift is clamped so the photo always covers the whole box — no black gaps. */
function drawPhotoInto(ctx, img, box, crop) {
  const [x, y, w, h] = box;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * (crop?.zoom ?? 1);
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  let dx = x + (w - pw) / 2 + (crop?.ox ?? 0) * w;
  let dy = y + (h - ph) / 2 + (crop?.oy ?? 0) * h;
  if (pw >= w) dx = Math.max(x + w - pw, Math.min(x, dx));
  else dx = x + (w - pw) / 2;
  if (ph >= h) dy = Math.max(y + h - ph, Math.min(y, dy));
  else dy = y + (h - ph) / 2;
  ctx.drawImage(img, dx, dy, pw, ph);
}

function clipPolygon(ctx, pts, W, H) {
  ctx.beginPath();
  pts.forEach(([fx, fy], i) => {
    const px = fx * W, py = fy * H;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.clip();
}

let grainTile = null;
function getGrainTile() {
  if (grainTile) return grainTile;
  const t = document.createElement('canvas');
  t.width = 160; t.height = 160;
  const c = t.getContext('2d');
  const data = c.createImageData(160, 160);
  let seed = 20261121;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    data.data[i] = v; data.data[i + 1] = v; data.data[i + 2] = v; data.data[i + 3] = 255;
  }
  c.putImageData(data, 0, 0);
  grainTile = t;
  return t;
}

function fitFont(ctx, text, maxWidth, startSize, family, weight = '') {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

/**
 * Draws the whole cover onto `canvas` (its own pixel size) from `state`:
 * { photos: [img|null, ...], panelPhoto: [0|1|2, ...], crops: [{zoom,ox,oy}...],
 *   layout, grade, title, subtitle, tag, heat }.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const grade = GRADES[state.grade] ?? GRADES.neon;
  const panels = layoutPanels(state.layout, W, H);
  const gutter = Math.max(4, W * GUTTER);

  ctx.fillStyle = '#07060d';
  ctx.fillRect(0, 0, W, H);

  // Photos, one per panel, clipped to the panel polygon.
  ctx.save();
  ctx.filter = grade.filter;
  panels.forEach((panel, i) => {
    const img = state.photos[state.panelPhoto[i] ?? 0] ?? state.photos[0];
    ctx.save();
    clipPolygon(ctx, panel.pts, W, H);
    if (img) {
      drawPhotoInto(ctx, img, panel.box, state.crops[i]);
    } else {
      ctx.fillStyle = '#1a1426';
      ctx.fillRect(panel.box[0], panel.box[1], panel.box[2], panel.box[3]);
    }
    ctx.restore();
  });
  ctx.restore();

  // Neon wash: magenta from the top-left, cyan from the bottom-right.
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  const wash = ctx.createLinearGradient(0, 0, W, H);
  wash.addColorStop(0, grade.wash[0]);
  wash.addColorStop(0.55, 'rgba(0,0,0,0)');
  wash.addColorStop(1, grade.wash[1]);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H * (1 - TITLE_BAND));
  ctx.restore();

  // Black gutters along every panel edge, then the outer frame.
  ctx.strokeStyle = '#07060d';
  ctx.lineWidth = gutter;
  ctx.lineJoin = 'miter';
  panels.forEach((panel) => {
    ctx.beginPath();
    panel.pts.forEach(([fx, fy], i) => {
      const px = fx * W, py = fy * H;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();
  });
  ctx.strokeStyle = grade.glow;
  ctx.lineWidth = Math.max(3, W * 0.004);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);

  // Halftone dots creeping in from the right edge of the art area.
  const artH = H * (1 - TITLE_BAND);
  ctx.save();
  ctx.fillStyle = grade.accent;
  const dotGap = Math.max(10, W * 0.014);
  for (let yy = dotGap / 2; yy < artH; yy += dotGap) {
    for (let xx = W - dotGap / 2; xx > W * 0.82; xx -= dotGap) {
      const depth = (W - xx) / (W * 0.18);
      const r = dotGap * 0.16 + depth * dotGap * 0.22;
      ctx.globalAlpha = 0.12 + depth * 0.5;
      ctx.beginPath();
      ctx.arc(xx, yy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Title band (solid for panel layouts; a scrim over the photo for Full Bleed).
  const bandY = H * (1 - TITLE_BAND);
  if (state.layout === 'bleed') {
    const scrim = ctx.createLinearGradient(0, H * 0.55, 0, H);
    scrim.addColorStop(0, 'rgba(7,6,13,0)');
    scrim.addColorStop(1, 'rgba(7,6,13,0.92)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, H * 0.55, W, H * 0.45);
  } else {
    ctx.fillStyle = '#0a0714';
    ctx.fillRect(0, bandY, W, H * TITLE_BAND);
    ctx.fillStyle = grade.glow;
    ctx.fillRect(0, bandY, W, Math.max(3, H * 0.006));
    ctx.fillStyle = grade.accent;
    ctx.fillRect(0, H - Math.max(3, H * 0.006), W, Math.max(3, H * 0.006));
  }

  // Badge ribbon, top-left, tilted.
  const badgeW = W * 0.2, badgeH = H * 0.042;
  ctx.save();
  ctx.translate(W * 0.03, H * 0.045);
  ctx.rotate(-0.06);
  ctx.fillStyle = '#07060d';
  ctx.fillRect(0, 0, badgeW, badgeH);
  ctx.strokeStyle = grade.glow;
  ctx.lineWidth = Math.max(2, W * 0.002);
  ctx.strokeRect(0, 0, badgeW, badgeH);
  ctx.fillStyle = '#fff';
  ctx.font = `${Math.round(badgeH * 0.52)}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VICE NOIR', badgeW / 2, badgeH / 2 + 1);
  ctx.restore();

  // Title: neon offset shadows, then white on top. Kept inside 88% of the
  // width so it never touches the tag / heat row above it.
  const title = (state.title ?? '').trim().toUpperCase() || 'MIDNIGHT RUN';
  const cx = W / 2;
  const titleSize = fitFont(ctx, title, W * 0.88, H * 0.105, 'Anton, sans-serif');
  const titleY = bandY + H * TITLE_BAND * 0.56;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const off = Math.max(2, H * 0.006);
  ctx.fillStyle = grade.glow;
  ctx.fillText(title, cx + off, titleY + off);
  ctx.fillStyle = grade.accent;
  ctx.fillText(title, cx - off, titleY - off);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = grade.glow;
  ctx.shadowBlur = H * 0.02;
  ctx.fillText(title, cx, titleY);
  ctx.shadowBlur = 0;

  // Subtitle in script, tag + heat stars flanking it above the title.
  const sub = (state.subtitle ?? '').trim();
  if (sub) {
    const subSize = fitFont(ctx, sub, W * 0.7, H * 0.036, 'Pacifico, cursive');
    ctx.fillStyle = grade.sub;
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.fillText(sub, cx, bandY + H * TITLE_BAND * 0.86);
  }
  const metaY = bandY + H * TITLE_BAND * 0.13;
  ctx.font = `700 ${Math.round(H * 0.02)}px system-ui, sans-serif`;
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = Math.max(2, H * 0.004);
  ctx.fillStyle = grade.accent;
  ctx.textAlign = 'left';
  ctx.fillText((state.tag ?? '').trim().toUpperCase(), W * 0.04, metaY);
  ctx.textAlign = 'right';
  ctx.fillStyle = grade.glow;
  const stars = '★'.repeat(state.heat ?? 4) + '☆'.repeat(5 - (state.heat ?? 4));
  ctx.fillText(stars, W * 0.96, metaY);
  ctx.shadowBlur = 0;

  // Grain + vignette over everything.
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.globalCompositeOperation = 'overlay';
  const tile = getGrainTile();
  ctx.fillStyle = ctx.createPattern(tile, 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

/** Renders the cover at an export size and returns the offscreen canvas. */
export function renderCoverToSize(state, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  drawCover(c, state);
  return c;
}
