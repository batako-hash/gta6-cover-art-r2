// VICE NOIR — Midnight Cover Lab: wires the page.
// Pick photos, choose a layout and grade, crop each panel by dragging, write
// the caption, export a PNG. A `?shot=` query sets up a fixed scene instead.
import { drawCover, renderCoverToSize, layoutPanels, LAYOUTS, GRADES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const tagInput = document.getElementById('tag');
const heatInput = document.getElementById('heat');
const heatStars = document.getElementById('heat-stars');
const zoomInput = document.getElementById('zoom');
const shiftXInput = document.getElementById('shift-x');
const shiftYInput = document.getElementById('shift-y');

const SAMPLES = ['samples/boulevard.jpg', 'samples/pier.jpg', 'samples/boulevard.jpg'];

const state = {
  photos: [null, null, null],
  panelPhoto: [0, 1, 2],
  crops: [
    { zoom: 1.15, ox: 0, oy: 0 },
    { zoom: 1.15, ox: 0, oy: 0 },
    { zoom: 1.15, ox: 0, oy: 0 },
  ],
  layout: 'diagonal',
  grade: 'neon',
  title: 'MIDNIGHT RUN',
  subtitle: 'one last score after dark',
  tag: 'VICE CITY · 2 AM',
  heat: 4,
};
let selectedPanel = 0;

function redraw() {
  drawCover(canvas, state);
}

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load ' + url));
    img.src = url;
  });
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('could not read file'));
    reader.readAsDataURL(file);
  });
}

async function loadSamplePhotos() {
  for (let i = 0; i < 3; i++) {
    try {
      state.photos[i] = await loadImage(SAMPLES[i]);
    } catch {
      state.photos[i] = null;
    }
  }
  redraw();
}

function refreshPanelAssign() {
  const wrap = document.getElementById('panel-assign');
  const count = LAYOUTS[state.layout].panels;
  wrap.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const row = document.createElement('div');
    row.className = 'assign-row' + (i === selectedPanel ? ' selected' : '');
    const label = document.createElement('span');
    label.textContent = count === 1 ? 'Cover photo' : `Panel ${i + 1}`;
    const select = document.createElement('select');
    select.setAttribute('aria-label', label.textContent + ' photo');
    ['Photo A', 'Photo B', 'Photo C'].forEach((name, pi) => {
      const opt = document.createElement('option');
      opt.value = String(pi);
      opt.textContent = name;
      if (state.panelPhoto[i] === pi) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => {
      state.panelPhoto[i] = Number(select.value);
      selectedPanel = i;
      syncCropSliders();
      refreshPanelAssign();
      redraw();
    });
    row.appendChild(label);
    row.appendChild(select);
    row.addEventListener('click', (e) => {
      if (e.target === select) return;
      selectedPanel = i;
      syncCropSliders();
      refreshPanelAssign();
    });
    wrap.appendChild(row);
  }
}

function syncCropSliders() {
  const crop = state.crops[selectedPanel];
  zoomInput.value = String(crop.zoom);
  shiftXInput.value = String(crop.ox);
  shiftYInput.value = String(crop.oy);
}

function bindPhotoInput(id, slot, nameId) {
  document.getElementById(id).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await readFile(file);
      state.photos[slot] = await loadImage(url);
      document.getElementById(nameId).textContent = file.name;
      redraw();
      status.textContent = `Photo ${'ABC'[slot]} loaded: ${file.name}`;
    } catch {
      status.textContent = 'That file could not be read as a photo.';
    }
  });
}

bindPhotoInput('photo-a', 0, 'name-a');
bindPhotoInput('photo-b', 1, 'name-b');
bindPhotoInput('photo-c', 2, 'name-c');

document.getElementById('samples').addEventListener('click', async () => {
  await loadSamplePhotos();
  status.textContent = 'Sample photos loaded.';
});

function bindChoices(id, key, after) {
  document.getElementById(id).addEventListener('click', (e) => {
    const btn = e.target.closest('[data-' + key + ']');
    if (!btn) return;
    state[key] = btn.dataset[key];
    document.querySelectorAll('#' + id + ' .choice').forEach((c) => c.classList.toggle('active', c === btn));
    after();
    redraw();
  });
}
bindChoices('layouts', 'layout', () => { refreshPanelAssign(); syncCropSliders(); });
bindChoices('grades', 'grade', () => {});

titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
tagInput.addEventListener('input', () => { state.tag = tagInput.value; redraw(); });
heatInput.addEventListener('input', () => {
  state.heat = Number(heatInput.value);
  heatStars.textContent = '★'.repeat(state.heat) + '☆'.repeat(5 - state.heat);
  redraw();
});
zoomInput.addEventListener('input', () => { state.crops[selectedPanel].zoom = Number(zoomInput.value); redraw(); });
shiftXInput.addEventListener('input', () => { state.crops[selectedPanel].ox = Number(shiftXInput.value); redraw(); });
shiftYInput.addEventListener('input', () => { state.crops[selectedPanel].oy = Number(shiftYInput.value); redraw(); });
document.getElementById('reset-crop').addEventListener('click', () => {
  state.crops[selectedPanel] = { zoom: 1.15, ox: 0, oy: 0 };
  syncCropSliders();
  redraw();
  status.textContent = `Panel ${selectedPanel + 1} framing reset.`;
});

// Click a panel to select it; drag to reposition its photo; scroll to zoom it.
let dragging = null;
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
}
function panelAt(point) {
  const panels = layoutPanels(state.layout, canvas.width, canvas.height);
  for (let i = panels.length - 1; i >= 0; i--) {
    const [x, y, w, h] = panels[i].box;
    if (point.x * canvas.width >= x && point.x * canvas.width <= x + w &&
        point.y * canvas.height >= y && point.y * canvas.height <= y + h) return i;
  }
  return 0;
}
canvas.addEventListener('pointerdown', (e) => {
  const point = canvasPoint(e);
  selectedPanel = panelAt(point);
  dragging = { x: point.x, y: point.y, ox: state.crops[selectedPanel].ox, oy: state.crops[selectedPanel].oy };
  canvas.setPointerCapture(e.pointerId);
  syncCropSliders();
  refreshPanelAssign();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const point = canvasPoint(e);
  const rect = canvas.getBoundingClientRect();
  const aspect = canvas.width / canvas.height / (rect.width / rect.height);
  state.crops[selectedPanel].ox = Math.max(-0.5, Math.min(0.5, dragging.ox + (point.x - dragging.x) * aspect));
  state.crops[selectedPanel].oy = Math.max(-0.5, Math.min(0.5, dragging.oy + (point.y - dragging.y)));
  syncCropSliders();
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const crop = state.crops[selectedPanel];
  crop.zoom = Math.max(1, Math.min(2.6, crop.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  syncCropSliders();
  redraw();
}, { passive: false });

function exportPng(w, h, label) {
  const out = renderCoverToSize(state, w, h);
  out.toBlob((blob) => {
    if (!blob) { status.textContent = 'Export failed in this browser.'; return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-noir-${label}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    status.textContent = `Saved vice-noir-${label}.png (${w} x ${h})`;
  }, 'image/png');
}
document.getElementById('export-square').addEventListener('click', () => exportPng(1080, 1080, '1080x1080'));
document.getElementById('export-story').addEventListener('click', () => exportPng(1080, 1350, '1080x1350'));
document.getElementById('export-wide').addEventListener('click', () => exportPng(1920, 1080, '1920x1080'));

// Exposed for the screenshot scenes: load a sample and apply a preset.
export const shotApi = {
  state,
  loadSamplePhotos,
  async applyShot({ layout, grade, title, subtitle, tag, photo, heat }) {
    if (layout && LAYOUTS[layout]) state.layout = layout;
    if (grade && GRADES[grade]) state.grade = grade;
    if (title !== undefined) { state.title = title; titleInput.value = title; }
    if (subtitle !== undefined) { state.subtitle = subtitle; subtitleInput.value = subtitle; }
    if (tag !== undefined) { state.tag = tag; tagInput.value = tag; }
    if (heat !== undefined && heat >= 1 && heat <= 5) {
      state.heat = heat;
      heatInput.value = String(heat);
      heatStars.textContent = '★'.repeat(heat) + '☆'.repeat(5 - heat);
    }
    await loadSamplePhotos();
    if (photo === 'pier') {
      // Both sample photos carry their faces in the top third; push the
      // framing down (the engine clamps the shift so the panel stays covered).
      state.panelPhoto = [1, 0, 1];
      state.crops = [
        { zoom: 0.9, ox: 0, oy: 0.5 },
        { zoom: 0.75, ox: 0, oy: 0.5 },
        { zoom: 1.05, ox: -0.04, oy: 0.4 },
      ];
    } else if (photo === 'boulevard') {
      state.panelPhoto = [0, 1, 0];
      state.crops = [
        { zoom: 1.0, ox: 0, oy: 0.3 },
        { zoom: 1.0, ox: 0, oy: 0.35 },
        { zoom: 1.5, ox: -0.06, oy: 0.3 },
      ];
    }
    document.querySelectorAll('#layouts .choice').forEach((c) => c.classList.toggle('active', c.dataset.layout === state.layout));
    document.querySelectorAll('#grades .choice').forEach((c) => c.classList.toggle('active', c.dataset.grade === state.grade));
    refreshPanelAssign();
    redraw();
  },
};

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
refreshPanelAssign();
syncCropSliders();
if (shot) {
  runShot(shot, query, shotApi);
} else {
  loadSamplePhotos();
}
