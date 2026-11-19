// Neon Coast Cover Studio — wires the editor: photo slots, layouts, grades,
// caption editing, per-panel crop/position, undo/redo and PNG export.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).
import { drawCover, defaultState, layoutPanels, panelSlot, SIZES, LAYOUTS, GRADES, LAYOUT_SLOTS } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const state = defaultState();
const photos = [null, null, null, null]; // four photo slots
let selectedPanel = 0;
let undoStack = [];
let redoStack = [];

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function snapshot() {
  return JSON.stringify({ ...state, panels: state.panels.map((p) => ({ ...p })) });
}

function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 40) undoStack.shift();
  redoStack = [];
}

function restore(json) {
  const s = JSON.parse(json);
  Object.assign(state, s);
  state.panels = s.panels;
  syncControls();
  render();
}

function render() {
  const size = SIZES[state.size] ?? SIZES.square;
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  drawCover(canvas, photos, state);
  updatePanelReadout();
}

function setStatus(text) { statusEl.textContent = text; }

/** Builds the layout / grade / size buttons from the engine's tables. */
function buildOptionButtons() {
  const layoutBox = document.getElementById('layouts');
  Object.entries(LAYOUTS).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt';
    b.textContent = def.label;
    b.dataset.value = key;
    b.addEventListener('click', () => {
      pushHistory();
      state.layout = key;
      selectedPanel = 0;
      const slots = LAYOUT_SLOTS[key] ?? [0];
      state.panels.forEach((p, i) => { p.slot = slots[i % slots.length]; });
      syncControls();
      render();
    });
    layoutBox.appendChild(b);
  });
  const gradeBox = document.getElementById('grades');
  Object.entries(GRADES).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt grade';
    b.textContent = def.label;
    b.dataset.value = key;
    b.addEventListener('click', () => { pushHistory(); state.grade = key; syncControls(); render(); });
    gradeBox.appendChild(b);
  });
  const sizeBox = document.getElementById('sizes');
  Object.entries(SIZES).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt';
    b.textContent = def.label;
    b.dataset.value = key;
    b.addEventListener('click', () => { pushHistory(); state.size = key; syncControls(); render(); });
    sizeBox.appendChild(b);
  });
}

function syncControls() {
  document.querySelectorAll('#layouts .opt').forEach((b) => b.classList.toggle('on', b.dataset.value === state.layout));
  document.querySelectorAll('#grades .opt').forEach((b) => b.classList.toggle('on', b.dataset.value === state.grade));
  document.querySelectorAll('#sizes .opt').forEach((b) => b.classList.toggle('on', b.dataset.value === state.size));
  document.getElementById('title').value = state.title;
  document.getElementById('subtitle').value = state.subtitle;
  document.getElementById('grain').checked = state.grain;
  document.getElementById('vignette').checked = state.vignette;
  document.getElementById('halftone').checked = state.halftone;
  document.querySelectorAll('.slot').forEach((slotEl, i) => {
    slotEl.classList.toggle('filled', !!photos[i]);
    slotEl.querySelector('.slot-name').textContent = photos[i] ? `Photo ${i + 1} loaded` : `Photo ${i + 1} — empty`;
  });
  updatePanelReadout();
}

function updatePanelReadout() {
  const rects = layoutPanels(state.layout, canvas.width, canvas.height);
  const panel = state.panels[selectedPanel] ?? { zoom: 1, ox: 0, oy: 0 };
  document.getElementById('panel-label').textContent =
    `Panel ${selectedPanel + 1} of ${rects.length} — photo slot ${panelSlot(state, selectedPanel) + 1}`;
  document.getElementById('zoom').value = panel.zoom;
  document.getElementById('panx').value = panel.ox;
  document.getElementById('pany').value = panel.oy;
}

/** Photo slots: file upload or a bundled sample photo. */
function buildPhotoSlots() {
  const box = document.getElementById('photos');
  for (let i = 0; i < 4; i++) {
    const row = document.createElement('div');
    row.className = 'slot';
    row.innerHTML = `<span class="slot-name">Photo ${i + 1} — empty</span>
      <input type="file" accept="image/*" aria-label="Upload photo ${i + 1}">
      <button type="button" class="mini">Sample</button>`;
    const input = row.querySelector('input');
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      photos[i] = await loadImage(URL.createObjectURL(file));
      pushHistory();
      syncControls();
      render();
      setStatus(`Photo ${i + 1} loaded — ${file.name}`);
    });
    row.querySelector('.mini').addEventListener('click', async () => {
      photos[i] = await loadImage(`samples/${i % 2 === 0 ? 'boulevard' : 'pier'}.jpg`);
      pushHistory();
      syncControls();
      render();
      setStatus(`Photo ${i + 1} set to a sample photo`);
    });
    row.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
        document.querySelectorAll('.slot').forEach((el) => el.classList.remove('picked'));
        row.classList.add('picked');
      }
    });
    box.appendChild(row);
  }
}

/** Drag on the preview pans the clicked panel's photo; wheel zooms it. */
function wireCanvasPointer() {
  let drag = null;
  const rectsFor = () => layoutPanels(state.layout, canvas.width, canvas.height);
  const pickPanel = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * canvas.width;
    const y = (e.clientY - r.top) / r.height * canvas.height;
    const rects = rectsFor();
    for (let i = rects.length - 1; i >= 0; i--) {
      const p = rects[i];
      if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return i;
    }
    return 0;
  };
  canvas.addEventListener('pointerdown', (e) => {
    selectedPanel = pickPanel(e);
    const panel = state.panels[selectedPanel];
    drag = { x: e.clientX, y: e.clientY, ox: panel.ox, oy: panel.oy };
    canvas.setPointerCapture(e.pointerId);
    pushHistory();
    updatePanelReadout();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = canvas.getBoundingClientRect();
    const panel = state.panels[selectedPanel];
    panel.ox = Math.max(-1, Math.min(1, drag.ox + (e.clientX - drag.x) / r.width * 1.6));
    panel.oy = Math.max(-1, Math.min(1, drag.oy + (e.clientY - drag.y) / r.height * 1.6));
    render();
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    selectedPanel = pickPanel(e);
    const panel = state.panels[selectedPanel];
    pushHistory();
    panel.zoom = Math.max(0.5, Math.min(3, panel.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
    render();
  }, { passive: false });
}

function wireControls() {
  document.getElementById('title').addEventListener('input', (e) => { state.title = e.target.value; render(); });
  document.getElementById('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; render(); });
  document.getElementById('grain').addEventListener('change', (e) => { pushHistory(); state.grain = e.target.checked; render(); });
  document.getElementById('vignette').addEventListener('change', (e) => { pushHistory(); state.vignette = e.target.checked; render(); });
  document.getElementById('halftone').addEventListener('change', (e) => { pushHistory(); state.halftone = e.target.checked; render(); });
  document.getElementById('zoom').addEventListener('input', (e) => { state.panels[selectedPanel].zoom = Number(e.target.value); render(); });
  document.getElementById('panx').addEventListener('input', (e) => { state.panels[selectedPanel].ox = Number(e.target.value); render(); });
  document.getElementById('pany').addEventListener('input', (e) => { state.panels[selectedPanel].oy = Number(e.target.value); render(); });
  document.getElementById('undo').addEventListener('click', () => {
    const prev = undoStack.pop();
    if (!prev) return;
    redoStack.push(snapshot());
    restore(prev);
    setStatus('Undone');
  });
  document.getElementById('redo').addEventListener('click', () => {
    const next = redoStack.pop();
    if (!next) return;
    undoStack.push(snapshot());
    restore(next);
    setStatus('Redone');
  });
  document.getElementById('shuffle').addEventListener('click', () => {
    pushHistory();
    const layouts = Object.keys(LAYOUTS);
    const grades = Object.keys(GRADES);
    state.layout = layouts[Math.floor(Math.random() * layouts.length)];
    state.grade = grades[Math.floor(Math.random() * grades.length)];
    selectedPanel = 0;
    syncControls();
    render();
    setStatus(`Shuffled: ${LAYOUTS[state.layout].label} + ${GRADES[state.grade].label}`);
  });
  document.getElementById('export').addEventListener('click', () => exportCover(state.size));
  document.getElementById('export-all').addEventListener('click', async () => {
    for (const key of Object.keys(SIZES)) {
      await exportCover(key);
    }
    setStatus('Saved all three sizes');
  });
}

/** Renders the cover at an export size and downloads it as a PNG. */
function exportCover(sizeKey) {
  return new Promise((resolve) => {
    const size = SIZES[sizeKey];
    const off = document.createElement('canvas');
    off.width = size.w;
    off.height = size.h;
    const savedSize = state.size;
    state.size = sizeKey;
    drawCover(off, photos, state);
    state.size = savedSize;
    off.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `neon-coast-${size.w}x${size.h}.png`;
      a.click();
      setStatus(`Saved neon-coast-${size.w}x${size.h}.png`);
      resolve();
    }, 'image/png');
  });
}

buildOptionButtons();
buildPhotoSlots();
wireControls();
wireCanvasPointer();
syncControls();

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, state, photos, loadImage, render, syncControls);
} else {
  // First visit: preload the two sample photos so the cover is alive at once.
  Promise.all([loadImage('samples/boulevard.jpg'), loadImage('samples/pier.jpg')])
    .then(([a, b]) => { photos[0] = a; photos[1] = b; syncControls(); render(); })
    .catch(() => render());
  render();
}
