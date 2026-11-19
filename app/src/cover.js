// Neon Coast Cover Studio — the cover engine.
// Draws GTA-poster-style cover art on a 2D canvas: multi-panel layouts, per-panel
// crop/zoom/pan, gradient-map sunset/neon grades, bold condensed title lettering
// with a neon subtitle, grain, vignette and halftone. No network, no library:
// every pixel is drawn here from the user's own photos.

export const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
  wide: { w: 1920, h: 1080, label: '1920 x 1080' },
};

export const LAYOUTS = {
  hero: { label: 'Hero + 3', panels: 4 },
  grid4: { label: 'Four Panel', panels: 4 },
  grid9: { label: 'Nine Panel', panels: 9 },
  fullbleed: { label: 'Full Bleed', panels: 1 },
  tilted: { label: 'Snapshots', panels: 3 },
  duo: { label: 'Split Duo', panels: 2 },
};

export const GRADES = {
  vice: {
    label: 'Vice Sunset', sat: 1.45, con: 1.12, bri: 1.02,
    top: 'rgba(255, 94, 120, 0.38)', bottom: 'rgba(255, 140, 40, 0.52)',
    shadow: 'rgba(20, 8, 60, 0.34)', glow: 'rgba(255, 190, 90, 0.24)',
  },
  neon: {
    label: 'Neon Night', sat: 1.5, con: 1.18, bri: 0.98,
    top: 'rgba(255, 45, 150, 0.40)', bottom: 'rgba(0, 220, 220, 0.36)',
    shadow: 'rgba(8, 4, 40, 0.42)', glow: 'rgba(0, 240, 255, 0.20)',
  },
  gold: {
    label: 'Palm Gold', sat: 1.25, con: 1.06, bri: 1.06,
    top: 'rgba(255, 200, 90, 0.30)', bottom: 'rgba(255, 120, 30, 0.34)',
    shadow: 'rgba(60, 30, 0, 0.26)', glow: 'rgba(255, 220, 130, 0.22)',
  },
  teal: {
    label: 'Teal Noir', sat: 0.9, con: 1.14, bri: 0.96,
    top: 'rgba(0, 180, 190, 0.26)', bottom: 'rgba(10, 40, 70, 0.40)',
    shadow: 'rgba(0, 10, 20, 0.36)', glow: 'rgba(120, 220, 210, 0.12)',
  },
  heat: {
    label: 'Mono Heat', sat: 0.25, con: 1.16, bri: 1.04,
    top: 'rgba(255, 110, 60, 0.34)', bottom: 'rgba(255, 60, 20, 0.30)',
    shadow: 'rgba(40, 8, 0, 0.34)', glow: 'rgba(255, 170, 90, 0.18)',
  },
};

/** Default panel photo-slot assignment for each layout (slots 0..3). */
export const LAYOUT_SLOTS = {
  hero: [0, 1, 0, 1],
  grid4: [0, 1, 1, 0],
  grid9: [0, 1, 0, 1, 0, 1, 0, 1, 0],
  fullbleed: [0],
  tilted: [0, 1, 0],
  duo: [0, 1],
};

/** Panel rectangles for a layout, in cover pixels. Title band occupies the bottom. */
export function layoutPanels(layout, w, h) {
  const g = Math.max(6, Math.round(w * 0.008)); // gutter
  const artH = Math.round(h * 0.8);
  const rects = [];
  if (layout === 'hero') {
    const heroW = Math.round(w * 0.64);
    const colX = heroW + g;
    const colW = w - colX;
    const ph = Math.floor((artH - 2 * g) / 3);
    rects.push({ x: 0, y: 0, w: heroW, h: artH });
    for (let i = 0; i < 3; i++) rects.push({ x: colX, y: i * (ph + g), w: colW, h: ph });
  } else if (layout === 'grid4') {
    const cw = Math.floor((w - g) / 2);
    const ch = Math.floor((artH - g) / 2);
    rects.push({ x: 0, y: 0, w: cw, h: ch }, { x: cw + g, y: 0, w: w - cw - g, h: ch },
      { x: 0, y: ch + g, w: cw, h: artH - ch - g }, { x: cw + g, y: ch + g, w: w - cw - g, h: artH - ch - g });
  } else if (layout === 'grid9') {
    const cw = Math.floor((w - 2 * g) / 3);
    const ch = Math.floor((artH - 2 * g) / 3);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      rects.push({
        x: c * (cw + g), y: r * (ch + g),
        w: c === 2 ? w - 2 * (cw + g) : cw,
        h: r === 2 ? artH - 2 * (ch + g) : ch,
      });
    }
  } else if (layout === 'fullbleed') {
    rects.push({ x: 0, y: 0, w, h: artH });
  } else if (layout === 'tilted') {
    const heroW = Math.round(w * 0.6);
    rects.push(
      { x: 0, y: 0, w: heroW, h: artH },
      { x: heroW + g, y: Math.round(artH * 0.04), w: w - heroW - g, h: Math.round(artH * 0.44), tilt: -0.05 },
      { x: heroW + g, y: Math.round(artH * 0.52), w: w - heroW - g, h: Math.round(artH * 0.44), tilt: 0.045 },
    );
  } else { // duo
    const cw = Math.floor((w - g) / 2);
    rects.push({ x: 0, y: 0, w: cw, h: artH }, { x: cw + g, y: 0, w: w - cw - g, h: artH });
  }
  return rects;
}

/** A fresh default state for a cover. Panels get varied framing so the same
 * photo never repeats with the same crop. */
export function defaultState() {
  const slots = LAYOUT_SLOTS.hero;
  const frame = [
    { zoom: 1, ox: 0, oy: 0 }, { zoom: 1.2, ox: -0.3, oy: 0.05 }, { zoom: 1.3, ox: 0.3, oy: -0.1 },
    { zoom: 1.15, ox: 0.2, oy: 0.15 }, { zoom: 1.1, ox: -0.2, oy: 0 }, { zoom: 1.25, ox: 0.25, oy: -0.05 },
    { zoom: 1.2, ox: 0, oy: 0.1 }, { zoom: 1.1, ox: -0.25, oy: -0.1 }, { zoom: 1.3, ox: 0.3, oy: 0.1 },
  ];
  const panels = [];
  for (let i = 0; i < 9; i++) panels.push({ slot: slots[i % slots.length], ...frame[i] });
  return {
    layout: 'hero', grade: 'vice', size: 'square',
    title: 'Sunset Heist', subtitle: 'Neon Coast',
    grain: true, vignette: true, halftone: false,
    panels,
  };
}

/** Photo slot a panel shows, from the layout's default assignment. */
export function panelSlot(state, i) {
  const slots = LAYOUT_SLOTS[state.layout] ?? [0];
  return state.panels[i]?.slot ?? slots[i % slots.length];
}

let noiseCanvas = null;
/** A reusable film-grain tile, generated once. */
function grainTile() {
  if (noiseCanvas) return noiseCanvas;
  noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = 128;
  noiseCanvas.height = 128;
  const nctx = noiseCanvas.getContext('2d');
  const img = nctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 96 + Math.floor(Math.random() * 96);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
  return noiseCanvas;
}

/** Draws one photo into a panel rect, cover-fit with the panel's zoom and pan. */
function drawPanelPhoto(ctx, photo, rect, panel, grade) {
  const iw = photo.naturalWidth;
  const ih = photo.naturalHeight;
  const base = Math.max(rect.w / iw, rect.h / ih) * (panel.zoom || 1);
  const pw = iw * base;
  const ph = ih * base;
  const dx = rect.x + (rect.w - pw) / 2 + (panel.ox || 0) * rect.w * 0.4;
  const dy = rect.y + (rect.h - ph) / 2 + (panel.oy || 0) * rect.h * 0.4;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.filter = `saturate(${grade.sat}) contrast(${grade.con}) brightness(${grade.bri})`;
  ctx.drawImage(photo, dx, dy, pw, ph);
  ctx.filter = 'none';
  // Gradient-map wash: warm top, hot bottom, cool shadow.
  const wash = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  wash.addColorStop(0, grade.top);
  wash.addColorStop(1, grade.bottom);
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = grade.glow;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'multiply';
  const sh = ctx.createLinearGradient(rect.x, rect.y + rect.h * 0.55, rect.x, rect.y + rect.h);
  sh.addColorStop(0, 'rgba(0,0,0,0)');
  sh.addColorStop(1, grade.shadow);
  ctx.fillStyle = sh;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** Inked poster frame around a panel: white keyline + dark outer edge. */
function framePanel(ctx, rect, w) {
  ctx.save();
  ctx.lineWidth = Math.max(2, w * 0.004);
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
  ctx.lineWidth = Math.max(1, w * 0.002);
  ctx.strokeStyle = 'rgba(10,5,20,0.55)';
  ctx.strokeRect(rect.x + Math.max(3, w * 0.006), rect.y + Math.max(3, w * 0.006),
    rect.w - 2 * Math.max(3, w * 0.006), rect.h - 2 * Math.max(3, w * 0.006));
  ctx.restore();
}

/** Fits a one-line title: shrinks the condensed-black font until it fits. */
function fitTitleFont(ctx, text, maxWidth, startSize) {
  let size = startSize;
  const set = (s) => { ctx.font = `900 ${s}px "Noto Sans Condensed", "Arial Narrow", "Arial Black", sans-serif`; };
  set(size);
  while (size > 18 && ctx.measureText(text).width > maxWidth) { size -= 4; set(size); }
  return size;
}

/** The title band: gradient backing, sunset-gradient title, neon subtitle. */
function drawTitleBand(ctx, state, w, h) {
  const bandY = Math.round(h * 0.8);
  const bandH = h - bandY;
  const grad = ctx.createLinearGradient(0, bandY, 0, h);
  grad.addColorStop(0, 'rgba(16,6,28,0)');
  grad.addColorStop(0.25, 'rgba(16,6,28,0.88)');
  grad.addColorStop(1, 'rgba(16,6,28,0.97)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, bandY, w, bandH);
  // Halftone dots across the band when enabled.
  if (state.halftone) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    const step = Math.max(12, Math.round(w * 0.014));
    for (let y = bandY + step; y < h - 4; y += step) {
      for (let x = step; x < w; x += step) {
        const r = 1 + ((x + y) % (step * 2)) / step;
        ctx.beginPath(); ctx.arc(x, y, Math.min(2.6, r), 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  const pad = Math.round(w * 0.045);
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim();
  // Subtitle first, in neon script glow above the title.
  let titleTop = bandY + bandH * 0.28;
  if (subtitle) {
    const subSize = Math.max(16, Math.round(h * 0.032));
    ctx.font = `italic 700 ${subSize}px "Noto Sans", "DejaVu Sans", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = '#ff2d96';
    ctx.shadowBlur = subSize * 0.55;
    ctx.fillStyle = '#ffd7ef';
    ctx.fillText(subtitle, pad, bandY + bandH * 0.30);
    ctx.shadowBlur = 0;
    titleTop = bandY + bandH * 0.36;
  }
  if (title) {
    // Capped at 72% of the width: the right column stays clear for the
    // star meter and badge ribbon, so long titles never collide with them.
    const size = fitTitleFont(ctx, title, w * 0.72, Math.round(h * 0.105));
    const tg = ctx.createLinearGradient(0, titleTop, 0, titleTop + size);
    tg.addColorStop(0, '#ffffff');
    tg.addColorStop(0.55, '#ffd76a');
    tg.addColorStop(1, '#ff5e8a');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.07);
    ctx.strokeStyle = 'rgba(20,4,30,0.85)';
    ctx.strokeText(title, pad, titleTop + size);
    ctx.fillStyle = tg;
    ctx.fillText(title, pad, titleTop + size);
  }
  // Heat meter + badge ribbon, top-right of the band.
  const stars = '★★★★★';
  ctx.font = `700 ${Math.max(14, Math.round(h * 0.024))}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffd76a';
  ctx.fillText(stars, w - pad, bandY + bandH * 0.30);
  ctx.font = `700 ${Math.max(11, Math.round(h * 0.016))}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('NEON COAST • EST. 2026', w - pad, bandY + bandH * 0.88);
}

/** Draws the whole cover onto `canvas` (sized to the chosen export size). */
export function drawCover(canvas, photos, state) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  const grade = GRADES[state.grade] ?? GRADES.vice;
  ctx.fillStyle = '#160a1e';
  ctx.fillRect(0, 0, w, h);
  const rects = layoutPanels(state.layout, w, h);
  rects.forEach((rect, i) => {
    const slot = panelSlot(state, i);
    const photo = photos[slot];
    const panel = state.panels[i] ?? { slot, zoom: 1, ox: 0, oy: 0 };
    ctx.save();
    if (rect.tilt) {
      // Snapshot panels: white polaroid border, slight tilt.
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(rect.tilt);
      ctx.translate(-cx, -cy);
      const bw = Math.max(4, Math.round(w * 0.008));
      ctx.fillStyle = '#fdf8ef';
      ctx.fillRect(rect.x - bw, rect.y - bw, rect.w + bw * 2, rect.h + bw * 2);
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = Math.round(w * 0.02);
      ctx.shadowOffsetY = Math.round(w * 0.006);
    }
    if (photo) drawPanelPhoto(ctx, photo, rect, panel, grade);
    else {
      ctx.fillStyle = '#2b1838';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = `700 ${Math.max(14, Math.round(h * 0.022))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
    }
    ctx.restore();
    if (!rect.tilt) framePanel(ctx, rect, w);
  });
  drawTitleBand(ctx, state, w, h);
  if (state.vignette) {
    const v = ctx.createRadialGradient(w / 2, h * 0.42, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(8,2,16,0.38)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat');
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
