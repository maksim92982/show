/* eslint-disable no-alert */

const STORAGE_KEY = 'bakery.site.content.v1';
const VIEWER_PREFS_KEY = 'bakery.viewer.prefs.v1';
const PUBLISHED_URL = './content.json';

/**
 * @typedef {'left'|'center'|'right'} TAlign
 * @typedef {'solid'|'gradient'|'image'} TBgType
 * @typedef {'text'|'image'|'video'|'mixed'|'grid'|'map'|'booking'|'button'|'contacts'|'divider'|'spacer'} TBlockType
 */

/**
 * @typedef {{
 *  type: TBgType,
 *  solid: string,
 *  gradient: { from: string, to: string, angle: number },
 *  imageDataUrl: string | null
 * }} IBackground
 */

/**
 * @typedef {{
 *  bold: boolean,
 *  italic: boolean,
 *  underline: boolean
 * }} ITextStyle
 */

/**
 * @typedef {{
 *  id: string,
 *  type: TBlockType,
 *  align: TAlign,
 *  background: IBackground,
 *  text: { value: string, style: ITextStyle } | null,
 *  image: { src: string, alt: string } | null,
 *  video: { src: string, alt: string } | null,
 *  grid: { cols: number, rows: number, cells: Array<IBlock | null> } | null,
 *  map: { lat: number, lon: number, zoom: number } | null,
 *  booking: { title: string, slotMinutes: number, days: Array<{ dow: number, start: string, end: string }> } | null,
 *  button: { label: string, url: string } | null,
 *  spacer: { height: number } | null,
 *  contacts: { title: string, phone: string, address: string, instagram: string } | null
 * }} IBlock
 */

/**
 * @typedef {{
 *  version: 1,
 *  site: { title: string, subtitle: string, background: IBackground },
 *  blocks: IBlock[]
 * }} IContent
 */

const $ = sel => {
  const el = document.querySelector(sel);
  if (!el) {
    throw new Error(`Element not found: ${sel}`);
  }
  return el;
};

const uid = () => {
  const rand = Math.random().toString(16).slice(2);
  return `b_${Date.now().toString(16)}_${rand}`;
};

/** @returns {IBackground} */
const defaultBackground = () => ({
  type: 'solid',
  solid: '#11111a',
  gradient: { from: '#11111a', to: '#1d1633', angle: 20 },
  imageDataUrl: null,
});

/** @returns {ITextStyle} */
const defaultTextStyle = () => ({
  bold: false,
  italic: false,
  underline: false,
});

/** @returns {IContent} */
const defaultContent = () => ({
  version: 1,
  site: {
    title: 'Булочки & Тортики',
    subtitle: 'Домашняя выпечка на заказ',
    background: {
      type: 'gradient',
      solid: '#0b0b10',
      gradient: { from: '#0b0b10', to: '#1b1330', angle: 25 },
      imageDataUrl: null,
    },
  },
  blocks: [],
});

/** @param {IBackground} bg */
const backgroundToCss = bg => {
  switch (bg.type) {
    case 'solid':
      return bg.solid;
    case 'gradient':
      return `linear-gradient(${bg.gradient.angle}deg, ${bg.gradient.from}, ${bg.gradient.to})`;
    case 'image':
      if (!bg.imageDataUrl) return bg.solid;
      return `url("${bg.imageDataUrl}") center / cover no-repeat`;
  }
};

/** @param {unknown} value */
const isObject = value => Boolean(value) && typeof value === 'object';

/**
 * Minimal runtime validation + normalization.
 * @param {unknown} raw
 * @returns {IContent}
 */
const normalizeContent = raw => {
  const base = defaultContent();
  if (!isObject(raw)) return base;
  /** @type {any} */ const r = raw;

  const site = isObject(r.site) ? r.site : {};
  const title = typeof site.title === 'string' ? site.title : base.site.title;
  const subtitle = typeof site.subtitle === 'string' ? site.subtitle : base.site.subtitle;
  const bg = normalizeBackground(site.background, base.site.background);

  const blocks = Array.isArray(r.blocks) ? r.blocks.map(normalizeBlock).filter(Boolean) : [];
  return { version: 1, site: { title, subtitle, background: bg }, blocks };
};

/** @param {unknown} rawBg @param {IBackground} fallback */
const normalizeBackground = (rawBg, fallback) => {
  if (!isObject(rawBg)) return fallback;
  /** @type {any} */ const b = rawBg;
  const type = b.type === 'solid' || b.type === 'gradient' || b.type === 'image' ? b.type : fallback.type;

  const solid = typeof b.solid === 'string' ? b.solid : fallback.solid;
  const gradientRaw = isObject(b.gradient) ? b.gradient : {};
  const from = typeof gradientRaw.from === 'string' ? gradientRaw.from : fallback.gradient.from;
  const to = typeof gradientRaw.to === 'string' ? gradientRaw.to : fallback.gradient.to;
  const angle = Number.isFinite(Number(gradientRaw.angle)) ? Number(gradientRaw.angle) : fallback.gradient.angle;

  const imageDataUrl = typeof b.imageDataUrl === 'string' ? b.imageDataUrl : null;

  return {
    type,
    solid,
    gradient: { from, to, angle },
    imageDataUrl,
  };
};

/** @param {unknown} raw */
const normalizeBlock = raw => {
  if (!isObject(raw)) return null;
  /** @type {any} */ const b = raw;
  const type =
    b.type === 'text' ||
    b.type === 'image' ||
    b.type === 'mixed' ||
    b.type === 'grid' ||
    b.type === 'map' ||
    b.type === 'booking' ||
    b.type === 'button' ||
    b.type === 'contacts' ||
    b.type === 'divider' ||
    b.type === 'spacer'
      ? b.type
      : 'text';
  const id = typeof b.id === 'string' ? b.id : uid();
  const align = b.align === 'left' || b.align === 'center' || b.align === 'right' ? b.align : 'left';
  const background = normalizeBackground(b.background, defaultBackground());

  const text = isObject(b.text)
    ? {
        value: typeof b.text.value === 'string' ? b.text.value : '',
        style: {
          bold: Boolean(b.text.style?.bold),
          italic: Boolean(b.text.style?.italic),
          underline: Boolean(b.text.style?.underline),
        },
      }
    : null;

  const image =
    isObject(b.image) && typeof b.image.src === 'string'
      ? { src: b.image.src, alt: typeof b.image.alt === 'string' ? b.image.alt : '' }
      : null;

  const grid = isObject(b.grid) ? normalizeGrid(b.grid) : null;

  const map =
    isObject(b.map) &&
    Number.isFinite(Number(b.map.lat)) &&
    Number.isFinite(Number(b.map.lon)) &&
    Number.isFinite(Number(b.map.zoom))
      ? { lat: Number(b.map.lat), lon: Number(b.map.lon), zoom: Math.max(1, Math.min(18, Number(b.map.zoom))) }
      : null;

  const booking =
    isObject(b.booking) && typeof b.booking.title === 'string'
      ? {
          title: b.booking.title,
          slotMinutes: Number.isFinite(Number(b.booking.slotMinutes)) ? Math.max(10, Number(b.booking.slotMinutes)) : 60,
          days: Array.isArray(b.booking.days)
            ? b.booking.days
                .filter(d => isObject(d) && Number.isFinite(Number(d.dow)) && typeof d.start === 'string' && typeof d.end === 'string')
                .map(d => ({ dow: Math.max(1, Math.min(7, Number(d.dow))), start: String(d.start), end: String(d.end) }))
            : [
                { dow: 1, start: '10:00', end: '18:00' },
                { dow: 2, start: '10:00', end: '18:00' },
                { dow: 3, start: '10:00', end: '18:00' },
                { dow: 4, start: '10:00', end: '18:00' },
                { dow: 5, start: '10:00', end: '18:00' },
              ],
        }
      : null;

  const button =
    isObject(b.button) && typeof b.button.label === 'string' && typeof b.button.url === 'string'
      ? { label: b.button.label, url: b.button.url }
      : null;

  const spacer = isObject(b.spacer) && Number.isFinite(Number(b.spacer.height)) ? { height: Math.max(0, Number(b.spacer.height)) } : null;

  const contacts =
    isObject(b.contacts)
      ? {
          title: typeof b.contacts.title === 'string' ? b.contacts.title : 'Контакты',
          phone: typeof b.contacts.phone === 'string' ? b.contacts.phone : '',
          address: typeof b.contacts.address === 'string' ? b.contacts.address : '',
          instagram: typeof b.contacts.instagram === 'string' ? b.contacts.instagram : '',
        }
      : null;

  return { id, type, align, background, text, image, grid, map, booking, button, spacer, contacts };
};

/** @param {any} g */
const normalizeGrid = g => {
  const cols = Number.isFinite(Number(g.cols)) ? Math.max(1, Number(g.cols)) : 2;
  const rows = Number.isFinite(Number(g.rows)) ? Math.max(1, Number(g.rows)) : 2;
  const cellsRaw = Array.isArray(g.cells) ? g.cells : [];
  const cells = cellsRaw.map(c => (c ? normalizeBlock(c) : null));
  const needed = cols * rows;
  if (cells.length < needed) {
    for (let i = cells.length; i < needed; i += 1) cells.push(null);
  }
  if (cells.length > needed) cells.length = needed;
  return { cols, rows, cells };
};

const state = {
  /** @type {IContent} */
  content: defaultContent(),
  isAdmin: false,
  selectedIds: new Set(),
  addInsertIndex: 0,
  addImageDataUrl: null,
  viewerPrefs: {
    /** @type {string | null} */
    bgColor: null,
  },
};

const els = {
  siteBackground: /** @type {HTMLDivElement} */ ($('#siteBackground')),
  siteTitle: /** @type {HTMLDivElement} */ ($('#siteTitle')),
  siteSubtitle: /** @type {HTMLDivElement} */ ($('#siteSubtitle')),
  blocksRoot: /** @type {HTMLDivElement} */ ($('#blocksRoot')),

  closeAdminBtn: /** @type {HTMLButtonElement} */ ($('#closeAdminBtn')),
  adminPanel: /** @type {HTMLElement} */ ($('#adminPanel')),
  adminResizeHandle: /** @type {HTMLElement} */ ($('#adminResizeHandle')),
  openLoginBtn: /** @type {HTMLButtonElement} */ ($('#openLoginBtn')),
  modeSwitch: /** @type {HTMLInputElement} */ ($('#modeSwitch')),
  modeLabel: /** @type {HTMLSpanElement} */ ($('#modeLabel')),

  adminSiteTitle: /** @type {HTMLInputElement} */ ($('#adminSiteTitle')),
  adminSiteSubtitle: /** @type {HTMLInputElement} */ ($('#adminSiteSubtitle')),

  exportBtn: /** @type {HTMLButtonElement} */ ($('#exportBtn')),
  publishBtn: /** @type {HTMLButtonElement} */ ($('#publishBtn')),
  publishStatus: /** @type {HTMLDivElement} */ ($('#publishStatus')),
  githubMeta: /** @type {HTMLDivElement} */ ($('#githubMeta')),
  githubTestBtn: /** @type {HTMLButtonElement} */ ($('#githubTestBtn')),
  importInput: /** @type {HTMLInputElement} */ ($('#importInput')),
  resetBtn: /** @type {HTMLButtonElement} */ ($('#resetBtn')),

  siteBgMode: /** @type {HTMLSelectElement} */ ($('#siteBgMode')),
  siteBgSolidRow: /** @type {HTMLDivElement} */ ($('#siteBgSolidRow')),
  siteBgGradientRow: /** @type {HTMLDivElement} */ ($('#siteBgGradientRow')),
  siteBgImageRow: /** @type {HTMLDivElement} */ ($('#siteBgImageRow')),
  siteBgColor: /** @type {HTMLInputElement} */ ($('#siteBgColor')),
  siteBgGradFrom: /** @type {HTMLInputElement} */ ($('#siteBgGradFrom')),
  siteBgGradTo: /** @type {HTMLInputElement} */ ($('#siteBgGradTo')),
  siteBgGradAngle: /** @type {HTMLInputElement} */ ($('#siteBgGradAngle')),
  siteBgGradAngleLabel: /** @type {HTMLSpanElement} */ ($('#siteBgGradAngleLabel')),
  siteBgPreview: /** @type {HTMLDivElement} */ ($('#siteBgPreview')),
  siteBgImageInput: /** @type {HTMLInputElement} */ ($('#siteBgImageInput')),

  mergeBtn: /** @type {HTMLButtonElement} */ ($('#mergeBtn')),

  addModal: /** @type {HTMLElement} */ ($('#addModal')),
  addModalBackdrop: /** @type {HTMLElement} */ ($('#addModalBackdrop')),
  addForm: /** @type {HTMLFormElement} */ ($('#addForm')),
  addType: /** @type {HTMLSelectElement} */ ($('#addType')),
  addTextRow: /** @type {HTMLDivElement} */ ($('#addTextRow')),
  addText: /** @type {HTMLTextAreaElement} */ ($('#addText')),
  addImageRow: /** @type {HTMLDivElement} */ ($('#addImageRow')),
  addImage: /** @type {HTMLInputElement} */ ($('#addImage')),
  addImageName: /** @type {HTMLSpanElement} */ ($('#addImageName')),
  addMapRow: /** @type {HTMLDivElement} */ ($('#addMapRow')),
  addMapLat: /** @type {HTMLInputElement} */ ($('#addMapLat')),
  addMapLon: /** @type {HTMLInputElement} */ ($('#addMapLon')),
  addMapZoom: /** @type {HTMLInputElement} */ ($('#addMapZoom')),
  addBookingRow: /** @type {HTMLDivElement} */ ($('#addBookingRow')),
  addBookingTitle: /** @type {HTMLInputElement} */ ($('#addBookingTitle')),
  addButtonRow: /** @type {HTMLDivElement} */ ($('#addButtonRow')),
  addButtonLabel: /** @type {HTMLInputElement} */ ($('#addButtonLabel')),
  addButtonUrl: /** @type {HTMLInputElement} */ ($('#addButtonUrl')),
  addContactsRow: /** @type {HTMLDivElement} */ ($('#addContactsRow')),
  addContactsTitle: /** @type {HTMLInputElement} */ ($('#addContactsTitle')),
  addContactsPhone: /** @type {HTMLInputElement} */ ($('#addContactsPhone')),
  addContactsAddress: /** @type {HTMLInputElement} */ ($('#addContactsAddress')),
  addContactsInstagram: /** @type {HTMLInputElement} */ ($('#addContactsInstagram')),
  addSpacerRow: /** @type {HTMLDivElement} */ ($('#addSpacerRow')),
  addSpacerHeight: /** @type {HTMLInputElement} */ ($('#addSpacerHeight')),

  mergeModal: /** @type {HTMLDialogElement} */ ($('#mergeModal')),
  mergeCols: /** @type {HTMLInputElement} */ ($('#mergeCols')),
  mergeRows: /** @type {HTMLInputElement} */ ($('#mergeRows')),
};

const loadLocal = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return normalizeContent(JSON.parse(raw));
  } catch {
    return null;
  }
};

/** @param {IContent} content */
const saveLocal = content => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
};

const clearLocal = () => {
  localStorage.removeItem(STORAGE_KEY);
};

const downloadJson = (filename, obj) => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/** @param {string} text */
const setPublishStatus = text => {
  els.publishStatus.textContent = text;
};

/**
 * Publish current content via Vercel serverless API.
 * Requires /api/publish and env vars on Vercel.
 */
const publishToGitHubAsync = async () => {
  els.publishBtn.disabled = true;
  setPublishStatus('Публикация...');
  try {
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: state.content }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = typeof json?.error === 'string' ? json.error : `HTTP ${res.status}`;
      setPublishStatus(`Ошибка: ${msg}`);
      return;
    }
    setPublishStatus(`Опубликовано: ${json.commitUrl ?? 'OK'}`);
  } catch (e) {
    setPublishStatus('Ошибка публикации (нет связи или блокировка запроса).');
  } finally {
    els.publishBtn.disabled = false;
  }
};

const refreshGitHubMetaAsync = async () => {
  try {
    const res = await fetch('/api/github-status', { cache: 'no-cache' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      els.githubMeta.textContent = `owner/repo@branch: — (${data?.error ?? 'нет данных'})`;
      return;
    }
    els.githubMeta.textContent = `owner/repo@branch: ${data.owner}/${data.repo}@${data.branch}`;
  } catch {
    els.githubMeta.textContent = 'owner/repo@branch: — (ошибка запроса)';
  }
};

const testGitHubConnectionAsync = async () => {
  els.githubTestBtn.disabled = true;
  setPublishStatus('Проверяем подключение к GitHub...');
  try {
    const res = await fetch('/api/github-status', { cache: 'no-cache' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPublishStatus(`GitHub: ошибка — ${data?.error ?? 'HTTP ' + res.status}`);
      return;
    }
    setPublishStatus(`GitHub: OK — ${data.owner}/${data.repo} (${data.defaultBranch})`);
  } catch {
    setPublishStatus('GitHub: ошибка запроса');
  } finally {
    els.githubTestBtn.disabled = false;
  }
};

/** @param {File} file */
const readFileAsDataUrlAsync = file =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });

/** @param {File} file */
const readFileAsTextAsync = file =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsText(file);
  });

const applySite = () => {
  els.siteTitle.textContent = state.content.site.title;
  els.siteSubtitle.textContent = state.content.site.subtitle;
  if (state.viewerPrefs.bgColor) {
    els.siteBackground.style.background = state.viewerPrefs.bgColor;
  } else {
    els.siteBackground.style.background = backgroundToCss(state.content.site.background);
  }
};

/** @param {HTMLElement} el @param {IBackground} bg */
const applyBlockBackground = (el, bg) => {
  el.style.setProperty('--block-bg', backgroundToCss(bg));
  el.style.setProperty('--block-bg-type', bg.type);
  // Use inline style for pseudo element via CSS var:
  el.style.setProperty('--block-bg-css', backgroundToCss(bg));
};

const makeAddSlot = index => {
  console.log('makeAddSlot called', index);
  const wrap = document.createElement('div');
  wrap.className = 'addSlot';
  const btn = document.createElement('button');
  btn.className = 'plusBtn';
  btn.type = 'button';
  btn.textContent = '+';
  btn.title = 'Добавить блок';
  btn.addEventListener('click', () => {
    console.log('plusBtn clicked', index);
    openAddModal(index);
  });
  wrap.appendChild(btn);
  return wrap;
};

const openAddModal = index => {
  console.log('openAddModal called', index, state.isAdmin);
  console.log('setting addInsertIndex to', index);
  if (!state.isAdmin) return;
  state.addInsertIndex = index;
  state.addImageDataUrl = null;
  els.addType.value = 'text';
  els.addText.value = '';
  els.addImage.value = '';
  els.addImageName.textContent = 'файл не выбран';
  els.addMapLat.value = '';
  els.addMapLon.value = '';
  els.addMapZoom.value = '16';
  els.addBookingTitle.value = 'Запись на приём';
  els.addButtonLabel.value = '';
  els.addButtonUrl.value = '';
  els.addContactsTitle.value = 'Контакты';
  els.addContactsPhone.value = '';
  els.addContactsAddress.value = '';
  els.addContactsInstagram.value = '';
  els.addSpacerHeight.value = '24';
  syncAddModalUi();
  els.addModal.style.display = 'flex';
  els.addModalBackdrop.style.display = 'block';
};

const syncAddModalUi = () => {
  const t = els.addType.value;
  console.log('syncAddModalUi called', t);
  const showText = t === 'text' || t === 'mixed';
  const showMedia = t === 'image' || t === 'video' || t === 'mixed';
  els.addTextRow.hidden = !showText;
  els.addImageRow.hidden = !showMedia;
  els.addImage.accept = t === 'video' ? 'video/*' : 'image/*';
  els.addMapRow.hidden = t !== 'map';
  els.addBookingRow.hidden = t !== 'booking';
  els.addButtonRow.hidden = t !== 'button';
  els.addContactsRow.hidden = t !== 'contacts';
  els.addSpacerRow.hidden = t !== 'spacer';
};

const insertBlock = block => {
  console.log('insertBlock called', block);
  console.log('inserting at index', state.addInsertIndex, 'current blocks length', state.content.blocks.length);
  state.content.blocks.splice(state.addInsertIndex, 0, block);
  console.log('after splice, blocks length', state.content.blocks.length);
  saveLocal(state.content);
  render();
};

/** @param {TAlign} align */
const alignClass = align => {
  switch (align) {
    case 'left':
      return 'align-left';
    case 'center':
      return 'align-center';
    case 'right':
      return 'align-right';
  }
};

/** @param {string} url */
const normalizeUrl = url => {
  const u = url.trim();
  if (!u) return '';
  // allow special schemes
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  // if user pasted without scheme, assume https
  return `https://${u.replace(/^\/+/, '')}`;
};

const makeOsmEmbedUrl = (lat, lon, zoom) => {
  const z = Math.max(1, Math.min(18, zoom));
  // bbox span heuristic for embed: smaller span at higher zoom
  const span = 0.02 * Math.pow(2, 12 - z);
  const left = lon - span;
  const right = lon + span;
  const top = lat + span;
  const bottom = lat - span;
  const bbox = `${left},${bottom},${right},${top}`;
  const marker = `${lat},${lon}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(marker)}`;
};

const pad2 = n => String(n).padStart(2, '0');

const formatDateISO = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const parseTimeToMinutes = s => {
  const m = String(s).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
};

const minutesToTime = mins => `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;

/** dow 1..7 (Mon..Sun) */
const jsDowToIso = jsDow => ((jsDow + 6) % 7) + 1;

/** @param {{ slotMinutes: number, days: Array<{ dow: number, start: string, end: string }> }} cfg */
const buildSlotsForDate = (date, cfg) => {
  const dow = jsDowToIso(date.getDay());
  const day = cfg.days.find(d => d.dow === dow);
  if (!day) return [];
  const start = parseTimeToMinutes(day.start);
  const end = parseTimeToMinutes(day.end);
  if (start == null || end == null || end <= start) return [];
  const step = Math.max(10, Number(cfg.slotMinutes) || 60);
  /** @type {string[]} */
  const out = [];
  for (let t = start; t + step <= end; t += step) {
    out.push(minutesToTime(t));
  }
  return out;
};

const postJsonAsync = async (url, body) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof json?.error === 'string' ? json.error : `HTTP ${res.status}`);
  }
  return json;
};

/** @param {ITextStyle} style */
const textStyleClasses = style => {
  const out = [];
  if (style.bold) out.push('text--bold');
  if (style.italic) out.push('text--italic');
  if (style.underline) out.push('text--underline');
  return out.join(' ');
};

/** @param {IBlock} block */
const makeBlockToolbar = block => {
  if (!state.isAdmin) {
    return null;
  }
  const bar = document.createElement('div');
  bar.className = 'block__toolbar';

  if (state.isAdmin) {
    const sel = document.createElement('label');
    sel.className = 'checkbox';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = state.selectedIds.has(block.id);
    cb.addEventListener('change', () => {
      if (cb.checked) state.selectedIds.add(block.id);
      else state.selectedIds.delete(block.id);
    });
    const cap = document.createElement('span');
    cap.className = 'miniText';
    cap.textContent = 'выделить';
    sel.append(cb, cap);
    bar.appendChild(sel);
  }

  const alignSel = document.createElement('select');
  alignSel.className = 'select';
  alignSel.innerHTML = `
    <option value="left">лево</option>
    <option value="center">центр</option>
    <option value="right">право</option>
  `;
  alignSel.value = block.align;
  alignSel.addEventListener('change', () => {
    block.align = /** @type {TAlign} */ (alignSel.value);
    saveLocal(state.content);
    render();
  });
  bar.appendChild(alignSel);

  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn--danger';
  delBtn.type = 'button';
  delBtn.textContent = 'Удалить';
  delBtn.addEventListener('click', () => {
    if (!confirm('Удалить блок?')) return;
    state.content.blocks = state.content.blocks.filter(b => b.id !== block.id);
    state.selectedIds.delete(block.id);
    saveLocal(state.content);
    render();
  });
  bar.appendChild(delBtn);

  return bar;
};

/** @param {IBlock} block */
const makeBlockContent = block => {
  const root = document.createElement('div');
  root.className = `block ${alignClass(block.align)}`;
  // Use inline background for ::before via style attribute in CSS:
  root.style.setProperty('--block-bg-css', backgroundToCss(block.background));
  root.style.setProperty('--block-bg-image', block.background.imageDataUrl ? `url("${block.background.imageDataUrl}")` : '');

  // Override the default ::before background with CSS variable
  root.style.setProperty('--block-bg', backgroundToCss(block.background));

  const toolbar = makeBlockToolbar(block);
  if (toolbar) {
    root.appendChild(toolbar);
  }

  const content = document.createElement('div');
  content.className = 'block__content';

  if (block.type === 'grid' && block.grid) {
    content.appendChild(renderGrid(block.grid));
    root.appendChild(content);
    applyBlockBackground(root, block.background);
    return root;
  }

  if (block.type === 'divider') {
    const hr = document.createElement('hr');
    hr.className = 'divider';
    content.appendChild(hr);
    if (state.isAdmin) {
      content.appendChild(makeBackgroundEditor(block));
    }
    root.appendChild(content);
    applyBlockBackground(root, block.background);
    return root;
  }

  if (block.type === 'spacer') {
    const s = document.createElement('div');
    s.className = 'spacer';
    s.style.height = `${Math.max(0, block.spacer?.height ?? 24)}px`;
    content.appendChild(s);
    if (state.isAdmin) {
      content.appendChild(makeSpacerEditor(block));
      content.appendChild(makeBackgroundEditor(block));
    }
    root.appendChild(content);
    applyBlockBackground(root, block.background);
    return root;
  }

  if (block.type === 'map') {
    const m = block.map;
    if (m) {
      const iframe = document.createElement('iframe');
      iframe.className = 'mapFrame';
      iframe.src = makeOsmEmbedUrl(m.lat, m.lon, m.zoom);
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.title = 'Карта';
      content.appendChild(iframe);
    } else {
      const t = document.createElement('div');
      t.className = 'miniText';
      t.textContent = 'Карта не настроена.';
      content.appendChild(t);
    }
    if (state.isAdmin) {
      content.appendChild(makeMapEditor(block));
      content.appendChild(makeBackgroundEditor(block));
    }
    root.appendChild(content);
    applyBlockBackground(root, block.background);
    return root;
  }

  if (block.type === 'booking') {
    const cfg = block.booking;
    const title = document.createElement('div');
    title.className = 'contactsTitle';
    title.textContent = cfg?.title?.trim() ? cfg.title : 'Запись';
    content.appendChild(title);

    if (!cfg) {
      const t = document.createElement('div');
      t.className = 'miniText';
      t.textContent = 'Блок записи не настроен.';
      content.appendChild(t);
    } else {
      const form = document.createElement('form');
      form.className = 'bookingForm';

      const dates = document.createElement('select');
      dates.className = 'select';
      const now = new Date();
      for (let i = 0; i < 14; i += 1) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        const opt = document.createElement('option');
        opt.value = formatDateISO(d);
        opt.textContent = opt.value;
        dates.appendChild(opt);
      }

      const times = document.createElement('select');
      times.className = 'select';

      const refillTimes = () => {
        times.innerHTML = '';
        const [yy, mm, dd] = dates.value.split('-').map(Number);
        const d = new Date(yy, mm - 1, dd);
        const slots = buildSlotsForDate(d, cfg);
        if (slots.length === 0) {
          const o = document.createElement('option');
          o.value = '';
          o.textContent = 'Нет слотов в этот день';
          times.appendChild(o);
          times.disabled = true;
          return;
        }
        times.disabled = false;
        for (const s of slots) {
          const o = document.createElement('option');
          o.value = s;
          o.textContent = s;
          times.appendChild(o);
        }
      };
      dates.addEventListener('change', refillTimes);
      refillTimes();

      const contact = document.createElement('input');
      contact.className = 'input';
      contact.type = 'text';
      contact.placeholder = 'Телефон / email / Telegram (обязательно)';

      const name = document.createElement('input');
      name.className = 'input';
      name.type = 'text';
      name.placeholder = 'Имя (необязательно)';

      const comment = document.createElement('textarea');
      comment.className = 'textarea';
      comment.rows = 3;
      comment.placeholder = 'Комментарий (необязательно)';

      const submit = document.createElement('button');
      submit.className = 'btn';
      submit.type = 'submit';
      submit.textContent = 'Записаться';

      const status = document.createElement('div');
      status.className = 'miniText';

      const row = document.createElement('div');
      row.className = 'bookingRow';
      row.append(dates, times);

      form.append(row, contact, name, comment, submit, status);
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const c = contact.value.trim();
        if (!c) {
          status.textContent = 'Введите контакт (телефон/email/Telegram).';
          return;
        }
        const day = dates.value;
        const time = times.value;
        if (!time) {
          status.textContent = 'Выберите день со слотами.';
          return;
        }
        submit.disabled = true;
        status.textContent = 'Отправляем заявку...';
        try {
          await postJsonAsync('/api/booking-request', {
            blockId: block.id,
            title: cfg.title,
            day,
            time,
            contact: c,
            name: name.value.trim(),
            comment: comment.value.trim(),
            pageUrl: location.href,
          });
          status.textContent = 'Готово! Администратор свяжется с вами.';
          form.reset();
          refillTimes();
        } catch (err) {
          status.textContent = `Ошибка: ${err instanceof Error ? err.message : 'не удалось отправить'}`;
        } finally {
          submit.disabled = false;
        }
      });

      content.appendChild(form);
    }

    if (state.isAdmin) {
      content.appendChild(makeBookingEditor(block));
      content.appendChild(makeBackgroundEditor(block));
    }
    root.appendChild(content);
    applyBlockBackground(root, block.background);
    return root;
  }

  if (block.type === 'button') {
    const b = block.button;
    const a = document.createElement('a');
    a.className = 'ctaBtn';
    a.textContent = b?.label?.trim() ? b.label : 'Кнопка';
    const href = normalizeUrl(b?.url ?? '');
    a.href = href || '#';
    if (href) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    content.appendChild(a);
    if (state.isAdmin) {
      content.appendChild(makeButtonEditor(block));
      content.appendChild(makeBackgroundEditor(block));
    }
    root.appendChild(content);
    applyBlockBackground(root, block.background);
    return root;
  }

  if (block.type === 'contacts') {
    const c = block.contacts;
    const title = document.createElement('div');
    title.className = 'contactsTitle';
    title.textContent = c?.title?.trim() ? c.title : 'Контакты';
    content.appendChild(title);

    const list = document.createElement('div');
    list.className = 'contactsList';
    const addRow = (cap, val) => {
      if (!val || !val.trim()) return;
      const row = document.createElement('div');
      row.className = 'contactsRow';
      const k = document.createElement('div');
      k.className = 'contactsKey';
      k.textContent = cap;
      const v = document.createElement('div');
      v.className = 'contactsVal';
      v.textContent = val;
      row.append(k, v);
      list.appendChild(row);
    };
    addRow('Телефон', c?.phone ?? '');
    addRow('Адрес', c?.address ?? '');
    addRow('Instagram', c?.instagram ?? '');
    content.appendChild(list);

    if (state.isAdmin) {
      content.appendChild(makeContactsEditor(block));
      content.appendChild(makeBackgroundEditor(block));
    }
    root.appendChild(content);
    applyBlockBackground(root, block.background);
    return root;
  }

  if (block.text) {
    const t = document.createElement('div');
    t.className = `text ${textStyleClasses(block.text.style)}`;
    t.textContent = block.text.value;
    content.appendChild(t);

    if (state.isAdmin) {
      const editor = makeTextEditor(block);
      content.appendChild(editor);
    }
  }

  if (block.image) {
    const img = document.createElement('img');
    img.className = 'image';
    img.src = block.image.src;
    img.alt = block.image.alt || '';
    img.loading = 'lazy';
    content.appendChild(img);

    if (state.isAdmin) {
      const replace = document.createElement('label');
      replace.className = 'fileBtn';
      replace.textContent = 'Заменить фото';
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        const dataUrl = await readFileAsDataUrlAsync(file);
        block.image = { src: dataUrl, alt: file.name };
        saveLocal(state.content);
        render();
      });
      replace.appendChild(input);
      content.appendChild(replace);
    }
  }

  if (block.video) {
    const vid = document.createElement('video');
    vid.className = 'video';
    vid.src = block.video.src;
    vid.alt = block.video.alt || '';
    vid.controls = true;
    vid.preload = 'metadata';
    content.appendChild(vid);

    if (state.isAdmin) {
      const replace = document.createElement('label');
      replace.className = 'fileBtn';
      replace.textContent = 'Заменить видео';
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/*';
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        const dataUrl = await readFileAsDataUrlAsync(file);
        block.video = { src: dataUrl, alt: file.name };
        saveLocal(state.content);
        render();
      });
      replace.appendChild(input);
      content.appendChild(replace);
    }
  }

  if (state.isAdmin) {
    content.appendChild(makeBackgroundEditor(block));
  }

  root.appendChild(content);
  applyBlockBackground(root, block.background);
  return root;
};

/** @param {ITextStyle} style @param {keyof ITextStyle} key */
const toggleTextStyle = (style, key) => {
  style[key] = !style[key];
};

/** @param {IBlock} block */
const makeTextEditor = block => {
  const wrap = document.createElement('div');
  wrap.className = 'panelBlock';

  const title = document.createElement('div');
  title.className = 'panelBlock__title';
  title.textContent = 'Текст';
  wrap.appendChild(title);

  const ta = document.createElement('textarea');
  ta.className = 'textarea';
  ta.rows = 4;
  ta.value = block.text?.value ?? '';
  ta.addEventListener('input', () => {
    if (!block.text) {
      block.text = { value: '', style: defaultTextStyle() };
    }
    block.text.value = ta.value;
    saveLocal(state.content);
    render();
  });
  wrap.appendChild(ta);

  const row = document.createElement('div');
  row.className = 'panelRow';

  const mkStyleBtn = (label, key) => {
    const b = document.createElement('button');
    b.className = 'btn btn--ghost';
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', () => {
      if (!block.text) block.text = { value: '', style: defaultTextStyle() };
      toggleTextStyle(block.text.style, key);
      saveLocal(state.content);
      render();
    });
    return b;
  };

  row.appendChild(mkStyleBtn('Жирный', 'bold'));
  row.appendChild(mkStyleBtn('Курсив', 'italic'));
  row.appendChild(mkStyleBtn('Подчерк', 'underline'));
  wrap.appendChild(row);

  return wrap;
};

/** @param {IBlock} block */
const makeBackgroundEditor = block => {
  const wrap = document.createElement('div');
  wrap.className = 'panelBlock';

  const title = document.createElement('div');
  title.className = 'panelBlock__title';
  title.textContent = 'Фон блока (z-index: между фоном сайта и контентом)';
  wrap.appendChild(title);

  const row1 = document.createElement('div');
  row1.className = 'panelRow';
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = 'Режим';
  const mode = document.createElement('select');
  mode.className = 'select';
  mode.innerHTML = `
    <option value="solid">Цвет</option>
    <option value="gradient">Градиент</option>
    <option value="image">Картинка</option>
  `;
  mode.value = block.background.type;
  mode.addEventListener('change', () => {
    block.background.type = /** @type {TBgType} */ (mode.value);
    saveLocal(state.content);
    render();
  });
  row1.append(label, mode);
  wrap.appendChild(row1);

  const solidRow = document.createElement('div');
  solidRow.className = 'panelRow';
  solidRow.hidden = block.background.type !== 'solid';
  const solidLabel = document.createElement('div');
  solidLabel.className = 'label';
  solidLabel.textContent = 'Цвет';
  const solid = document.createElement('input');
  solid.type = 'color';
  solid.value = block.background.solid;
  solid.addEventListener('input', () => {
    block.background.solid = solid.value;
    saveLocal(state.content);
    render();
  });
  solidRow.append(solidLabel, solid);
  wrap.appendChild(solidRow);

  const gradWrap = document.createElement('div');
  gradWrap.className = 'panelRow panelRow--col';
  gradWrap.hidden = block.background.type !== 'gradient';
  const g1 = document.createElement('div');
  g1.className = 'panelRow';
  const g1l = document.createElement('div');
  g1l.className = 'label';
  g1l.textContent = 'От';
  const gFrom = document.createElement('input');
  gFrom.type = 'color';
  gFrom.value = block.background.gradient.from;
  gFrom.addEventListener('input', () => {
    block.background.gradient.from = gFrom.value;
    saveLocal(state.content);
    render();
  });
  g1.append(g1l, gFrom);
  const g2 = document.createElement('div');
  g2.className = 'panelRow';
  const g2l = document.createElement('div');
  g2l.className = 'label';
  g2l.textContent = 'До';
  const gTo = document.createElement('input');
  gTo.type = 'color';
  gTo.value = block.background.gradient.to;
  gTo.addEventListener('input', () => {
    block.background.gradient.to = gTo.value;
    saveLocal(state.content);
    render();
  });
  g2.append(g2l, gTo);
  const g3 = document.createElement('div');
  g3.className = 'panelRow';
  const g3l = document.createElement('div');
  g3l.className = 'label';
  g3l.textContent = 'Угол';
  const angle = document.createElement('input');
  angle.type = 'range';
  angle.min = '0';
  angle.max = '360';
  angle.step = '1';
  angle.value = String(block.background.gradient.angle);
  const angleLabel = document.createElement('span');
  angleLabel.className = 'miniText';
  angleLabel.textContent = `${block.background.gradient.angle}°`;
  angle.addEventListener('input', () => {
    block.background.gradient.angle = Number(angle.value);
    angleLabel.textContent = `${block.background.gradient.angle}°`;
    saveLocal(state.content);
    render();
  });
  g3.append(g3l, angle, angleLabel);

  const preview = document.createElement('div');
  preview.className = 'bgPreview';
  preview.style.background = backgroundToCss({ ...block.background, type: 'gradient' });

  gradWrap.append(g1, g2, g3, preview);
  wrap.appendChild(gradWrap);

  const imgRow = document.createElement('div');
  imgRow.className = 'panelRow';
  imgRow.hidden = block.background.type !== 'image';
  const imgLabel = document.createElement('label');
  imgLabel.className = 'fileBtn';
  imgLabel.textContent = 'Выбрать картинку фона блока';
  const imgInput = document.createElement('input');
  imgInput.type = 'file';
  imgInput.accept = 'image/*';
  imgInput.addEventListener('change', async () => {
    const file = imgInput.files?.[0];
    if (!file) return;
    block.background.imageDataUrl = await readFileAsDataUrlAsync(file);
    block.background.type = 'image';
    saveLocal(state.content);
    render();
  });
  imgLabel.appendChild(imgInput);
  imgRow.appendChild(imgLabel);
  wrap.appendChild(imgRow);

  return wrap;
};

/** @param {IBlock} block */
const makeButtonEditor = block => {
  const wrap = document.createElement('div');
  wrap.className = 'panelBlock';
  const title = document.createElement('div');
  title.className = 'panelBlock__title';
  title.textContent = 'Кнопка / ссылка';
  wrap.appendChild(title);

  const row1 = document.createElement('div');
  row1.className = 'panelRow';
  const l1 = document.createElement('div');
  l1.className = 'label';
  l1.textContent = 'Текст';
  const label = document.createElement('input');
  label.className = 'input';
  label.type = 'text';
  label.value = block.button?.label ?? '';
  label.addEventListener('input', () => {
    if (!block.button) block.button = { label: '', url: '' };
    block.button.label = label.value;
    saveLocal(state.content);
    render();
  });
  row1.append(l1, label);
  wrap.appendChild(row1);

  const row2 = document.createElement('div');
  row2.className = 'panelRow';
  const l2 = document.createElement('div');
  l2.className = 'label';
  l2.textContent = 'Ссылка';
  const url = document.createElement('input');
  url.className = 'input';
  url.type = 'text';
  url.value = block.button?.url ?? '';
  url.addEventListener('input', () => {
    if (!block.button) block.button = { label: '', url: '' };
    block.button.url = url.value;
    saveLocal(state.content);
    render();
  });
  row2.append(l2, url);
  wrap.appendChild(row2);

  return wrap;
};

/** @param {IBlock} block */
const makeMapEditor = block => {
  const wrap = document.createElement('div');
  wrap.className = 'panelBlock';
  const title = document.createElement('div');
  title.className = 'panelBlock__title';
  title.textContent = 'Карта (OpenStreetMap)';
  wrap.appendChild(title);

  const mkNum = (cap, key, step = '0.000001') => {
    const row = document.createElement('div');
    row.className = 'panelRow';
    const l = document.createElement('div');
    l.className = 'label';
    l.textContent = cap;
    const input = document.createElement('input');
    input.className = 'input';
    input.type = 'number';
    input.step = step;
    input.value = String(block.map?.[key] ?? '');
    input.addEventListener('input', () => {
      if (!block.map) block.map = { lat: 0, lon: 0, zoom: 16 };
      block.map[key] = Number(input.value);
      saveLocal(state.content);
      render();
    });
    row.append(l, input);
    return row;
  };

  wrap.appendChild(mkNum('Широта', 'lat'));
  wrap.appendChild(mkNum('Долгота', 'lon'));
  wrap.appendChild(mkNum('Зум', 'zoom', '1'));

  return wrap;
};

/** @param {IBlock} block */
const makeSpacerEditor = block => {
  const wrap = document.createElement('div');
  wrap.className = 'panelBlock';
  const title = document.createElement('div');
  title.className = 'panelBlock__title';
  title.textContent = 'Отступ';
  wrap.appendChild(title);

  const row = document.createElement('div');
  row.className = 'panelRow';
  const l = document.createElement('div');
  l.className = 'label';
  l.textContent = 'Высота';
  const input = document.createElement('input');
  input.className = 'input';
  input.type = 'number';
  input.min = '0';
  input.step = '1';
  input.value = String(block.spacer?.height ?? 24);
  input.addEventListener('input', () => {
    if (!block.spacer) block.spacer = { height: 24 };
    block.spacer.height = Math.max(0, Number(input.value));
    saveLocal(state.content);
    render();
  });
  row.append(l, input);
  wrap.appendChild(row);
  return wrap;
};

/** @param {IBlock} block */
const makeContactsEditor = block => {
  const wrap = document.createElement('div');
  wrap.className = 'panelBlock';
  const title = document.createElement('div');
  title.className = 'panelBlock__title';
  title.textContent = 'Контакты';
  wrap.appendChild(title);

  const mk = (cap, key, placeholder = '') => {
    const row = document.createElement('div');
    row.className = 'panelRow';
    const l = document.createElement('div');
    l.className = 'label';
    l.textContent = cap;
    const input = document.createElement('input');
    input.className = 'input';
    input.type = 'text';
    input.placeholder = placeholder;
    input.value = block.contacts?.[key] ?? '';
    input.addEventListener('input', () => {
      if (!block.contacts) block.contacts = { title: 'Контакты', phone: '', address: '', instagram: '' };
      block.contacts[key] = input.value;
      saveLocal(state.content);
      render();
    });
    row.append(l, input);
    return row;
  };

  wrap.appendChild(mk('Заголовок', 'title', 'Контакты'));
  wrap.appendChild(mk('Телефон', 'phone', '+7...'));
  wrap.appendChild(mk('Адрес', 'address', 'Город, улица...'));
  wrap.appendChild(mk('Instagram', 'instagram', '@username или ссылка'));
  return wrap;
};

/** @param {IBlock} block */
const makeBookingEditor = block => {
  const wrap = document.createElement('div');
  wrap.className = 'panelBlock';
  const title = document.createElement('div');
  title.className = 'panelBlock__title';
  title.textContent = 'Запись / календарь';
  wrap.appendChild(title);

  const row1 = document.createElement('div');
  row1.className = 'panelRow';
  const l1 = document.createElement('div');
  l1.className = 'label';
  l1.textContent = 'Заголовок';
  const t = document.createElement('input');
  t.className = 'input';
  t.type = 'text';
  t.value = block.booking?.title ?? 'Запись на приём';
  t.addEventListener('input', () => {
    if (!block.booking) {
      block.booking = {
        title: 'Запись на приём',
        slotMinutes: 60,
        days: [
          { dow: 1, start: '10:00', end: '18:00' },
          { dow: 2, start: '10:00', end: '18:00' },
          { dow: 3, start: '10:00', end: '18:00' },
          { dow: 4, start: '10:00', end: '18:00' },
          { dow: 5, start: '10:00', end: '18:00' },
        ],
      };
    }
    block.booking.title = t.value;
    saveLocal(state.content);
    render();
  });
  row1.append(l1, t);
  wrap.appendChild(row1);

  const row2 = document.createElement('div');
  row2.className = 'panelRow';
  const l2 = document.createElement('div');
  l2.className = 'label';
  l2.textContent = 'Слот (мин)';
  const slot = document.createElement('input');
  slot.className = 'input';
  slot.type = 'number';
  slot.min = '10';
  slot.step = '5';
  slot.value = String(block.booking?.slotMinutes ?? 60);
  slot.addEventListener('input', () => {
    if (!block.booking) return;
    block.booking.slotMinutes = Math.max(10, Number(slot.value || '60'));
    saveLocal(state.content);
    render();
  });
  row2.append(l2, slot);
  wrap.appendChild(row2);

  const daysWrap = document.createElement('div');
  daysWrap.className = 'panelRow panelRow--col';
  const cap = document.createElement('div');
  cap.className = 'miniText';
  cap.textContent = 'Расписание по дням недели (пустые дни — выходные).';
  daysWrap.appendChild(cap);

  const dowNames = {
    1: 'Пн',
    2: 'Вт',
    3: 'Ср',
    4: 'Чт',
    5: 'Пт',
    6: 'Сб',
    7: 'Вс',
  };

  const ensureBooking = () => {
    if (!block.booking) {
      block.booking = { title: 'Запись на приём', slotMinutes: 60, days: [] };
    }
  };

  for (let dow = 1; dow <= 7; dow += 1) {
    const row = document.createElement('div');
    row.className = 'panelRow';
    const l = document.createElement('div');
    l.className = 'label';
    l.textContent = dowNames[dow];

    const start = document.createElement('input');
    start.className = 'input';
    start.type = 'text';
    start.placeholder = '10:00';
    const end = document.createElement('input');
    end.className = 'input';
    end.type = 'text';
    end.placeholder = '18:00';

    const existing = block.booking?.days?.find(d => d.dow === dow);
    start.value = existing?.start ?? '';
    end.value = existing?.end ?? '';

    const apply = () => {
      ensureBooking();
      const s = start.value.trim();
      const e = end.value.trim();
      block.booking.days = (block.booking.days || []).filter(d => d.dow !== dow);
      if (s && e) {
        block.booking.days.push({ dow, start: s, end: e });
        block.booking.days.sort((a, b) => a.dow - b.dow);
      }
      saveLocal(state.content);
      render();
    };

    start.addEventListener('change', apply);
    end.addEventListener('change', apply);
    row.append(l, start, end);
    daysWrap.appendChild(row);
  }

  wrap.appendChild(daysWrap);
  return wrap;
};

/** @param {{ cols: number, rows: number, cells: Array<IBlock | null> }} grid */
const renderGrid = grid => {
  const wrap = document.createElement('div');
  wrap.className = 'grid';
  wrap.style.gridTemplateColumns = `repeat(${grid.cols}, minmax(0, 1fr))`;

  for (let i = 0; i < grid.cols * grid.rows; i += 1) {
    const cell = document.createElement('div');
    cell.className = 'gridCell';
    const inner = document.createElement('div');
    inner.className = 'gridCell__inner';
    const b = grid.cells[i];
    if (b) {
      // Render nested block as "content only" to keep it compact.
      inner.appendChild(renderNestedBlock(b));
    } else {
      const empty = document.createElement('div');
      empty.className = 'miniText';
      empty.textContent = 'пусто';
      inner.appendChild(empty);
    }
    cell.appendChild(inner);
    wrap.appendChild(cell);
  }

  return wrap;
};

/** @param {IBlock} block */
const renderNestedBlock = block => {
  const box = document.createElement('div');
  box.className = `block ${alignClass(block.align)}`;
  box.style.borderRadius = '14px';
  box.style.boxShadow = 'none';
  box.style.border = '1px solid rgba(255,255,255,0.10)';
  box.style.setProperty('--block-bg', backgroundToCss(block.background));

  const content = document.createElement('div');
  content.className = 'block__content';
  content.style.padding = '12px';

  if (block.type === 'grid' && block.grid) {
    content.appendChild(renderGrid(block.grid));
  } else {
    if (block.type === 'divider') {
      const hr = document.createElement('hr');
      hr.className = 'divider';
      content.appendChild(hr);
    }
    if (block.type === 'spacer') {
      const s = document.createElement('div');
      s.className = 'spacer';
      s.style.height = `${Math.max(0, block.spacer?.height ?? 24)}px`;
      content.appendChild(s);
    }
    if (block.type === 'map' && block.map) {
      const iframe = document.createElement('iframe');
      iframe.className = 'mapFrame';
      iframe.src = makeOsmEmbedUrl(block.map.lat, block.map.lon, block.map.zoom);
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.title = 'Карта';
      content.appendChild(iframe);
    }
    if (block.type === 'booking' && block.booking) {
      const title = document.createElement('div');
      title.className = 'contactsTitle';
      title.textContent = block.booking.title || 'Запись';
      content.appendChild(title);
      const hint = document.createElement('div');
      hint.className = 'miniText';
      hint.textContent = 'Форма записи доступна на странице.';
      content.appendChild(hint);
    }
    if (block.type === 'button') {
      const a = document.createElement('a');
      a.className = 'ctaBtn';
      a.textContent = block.button?.label?.trim() ? block.button.label : 'Кнопка';
      const href = normalizeUrl(block.button?.url ?? '');
      a.href = href || '#';
      if (href) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      content.appendChild(a);
    }
    if (block.type === 'contacts') {
      const title = document.createElement('div');
      title.className = 'contactsTitle';
      title.textContent = block.contacts?.title?.trim() ? block.contacts.title : 'Контакты';
      content.appendChild(title);
      const list = document.createElement('div');
      list.className = 'contactsList';
      const addRow = (cap, val) => {
        if (!val || !val.trim()) return;
        const row = document.createElement('div');
        row.className = 'contactsRow';
        const k = document.createElement('div');
        k.className = 'contactsKey';
        k.textContent = cap;
        const v = document.createElement('div');
        v.className = 'contactsVal';
        v.textContent = val;
        row.append(k, v);
        list.appendChild(row);
      };
      addRow('Телефон', block.contacts?.phone ?? '');
      addRow('Адрес', block.contacts?.address ?? '');
      addRow('Instagram', block.contacts?.instagram ?? '');
      content.appendChild(list);
    }
    if (block.text) {
      const t = document.createElement('div');
      t.className = `text ${textStyleClasses(block.text.style)}`;
      t.textContent = block.text.value;
      content.appendChild(t);
    }
    if (block.image) {
      const img = document.createElement('img');
      img.className = 'image';
      img.src = block.image.src;
      img.alt = block.image.alt || '';
      img.loading = 'lazy';
      content.appendChild(img);
    }
  }

  box.appendChild(content);
  applyBlockBackground(box, block.background);
  return box;
};

const render = () => {
  console.log('render called, blocks count:', state.content.blocks.length);
  console.log('current blocks:', state.content.blocks.map(b => ({ id: b.id, type: b.type })));
  applySite();

  // Toggle visibility based on admin mode
  els.openLoginBtn.style.display = state.isAdmin ? 'block' : 'none';
  els.adminPanel.style.display = state.isAdmin ? 'block' : 'none';

  els.blocksRoot.innerHTML = '';
  const blocks = state.content.blocks;

  // Top add slot
  if (state.isAdmin) {
    els.blocksRoot.appendChild(makeAddSlot(0));
  } else if (blocks.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'miniText';
    hint.textContent = 'Сайт пока пустой. Включите админ-режим, чтобы добавить блоки.';
    els.blocksRoot.appendChild(hint);
  }

  blocks.forEach((b, idx) => {
    console.log('rendering block', idx, b.type, b.id);
    els.blocksRoot.appendChild(makeBlockContent(b));
    if (state.isAdmin) {
      els.blocksRoot.appendChild(makeAddSlot(idx + 1));
    }
  });

  // (header buttons removed)
};

const openAdmin = () => {
  els.adminPanel.dataset.open = 'true';
  els.adminSiteTitle.value = state.content.site.title;
  els.adminSiteSubtitle.value = state.content.site.subtitle;
  render();
};

const closeAdmin = () => {
  els.adminPanel.dataset.open = 'false';
  state.selectedIds.clear();
  render();
};

// Resizable admin panel
let isResizing = false;
let startX = 0;
let startWidth = 0;

const startResize = (e) => {
  isResizing = true;
  startX = e.clientX;
  startWidth = els.adminPanel.offsetWidth;
  document.addEventListener('mousemove', resize);
  document.addEventListener('mouseup', stopResize);
};

const resize = (e) => {
  if (!isResizing) return;
  const newWidth = startWidth - (e.clientX - startX);
  const clampedWidth = Math.max(200, Math.min(window.innerWidth * 0.9, newWidth));
  els.adminPanel.style.width = `${clampedWidth}px`;
};

const stopResize = () => {
  isResizing = false;
  document.removeEventListener('mousemove', resize);
  document.removeEventListener('mouseup', stopResize);
};

els.adminPanel.addEventListener('mousedown', (e) => {
  if (e.offsetX < 10) { // Left edge
    startResize(e);
  }
});

const loadViewerPrefs = () => {
  const raw = localStorage.getItem(VIEWER_PREFS_KEY);
  if (!raw) return;
  try {
    const p = JSON.parse(raw);
    if (p && typeof p.bgColor === 'string') {
      state.viewerPrefs.bgColor = p.bgColor;
    }
  } catch {
    // ignore
  }
};

const saveViewerPrefs = () => {
  localStorage.setItem(VIEWER_PREFS_KEY, JSON.stringify(state.viewerPrefs));
};

const syncSiteBgUi = () => {
  const bg = state.content.site.background;
  els.siteBgMode.value = bg.type;
  els.siteBgColor.value = bg.solid;
  els.siteBgGradFrom.value = bg.gradient.from;
  els.siteBgGradTo.value = bg.gradient.to;
  els.siteBgGradAngle.value = String(bg.gradient.angle);
  els.siteBgGradAngleLabel.textContent = `${bg.gradient.angle}°`;
  els.siteBgPreview.style.background = backgroundToCss({ ...bg, type: 'gradient' });

  els.siteBgSolidRow.hidden = bg.type !== 'solid';
  els.siteBgGradientRow.hidden = bg.type !== 'gradient';
  els.siteBgImageRow.hidden = bg.type !== 'image';
};

const applySiteBgFromUi = () => {
  const bg = state.content.site.background;
  bg.type = /** @type {TBgType} */ (els.siteBgMode.value);
  bg.solid = els.siteBgColor.value;
  bg.gradient.from = els.siteBgGradFrom.value;
  bg.gradient.to = els.siteBgGradTo.value;
  bg.gradient.angle = Number(els.siteBgGradAngle.value);
  els.siteBgGradAngleLabel.textContent = `${bg.gradient.angle}°`;
  els.siteBgPreview.style.background = backgroundToCss({ ...bg, type: 'gradient' });
  saveLocal(state.content);
  render();
  syncSiteBgUi();
};

const getSelectedBlockIndexes = () => {
  const ids = state.selectedIds;
  const idx = [];
  state.content.blocks.forEach((b, i) => {
    if (ids.has(b.id)) idx.push(i);
  });
  return idx;
};

const areConsecutive = indexes => {
  if (indexes.length === 0) return false;
  for (let i = 1; i < indexes.length; i += 1) {
    if (indexes[i] !== indexes[i - 1] + 1) return false;
  }
  return true;
};

const openMergeModal = () => {
  const indexes = getSelectedBlockIndexes();
  if (indexes.length < 2) {
    alert('Нужно выделить минимум 2 блока.');
    return;
  }
  indexes.sort((a, b) => a - b);
  if (!areConsecutive(indexes)) {
    alert('Можно объединять только соседние (подряд) блоки.');
    return;
  }
  els.mergeCols.value = '2';
  els.mergeRows.value = String(Math.ceil(indexes.length / 2));
  els.mergeModal.showModal();
};

const doMergeSelected = () => {
  const indexes = getSelectedBlockIndexes().sort((a, b) => a - b);
  if (indexes.length < 2 || !areConsecutive(indexes)) return;

  const cols = Math.max(1, Number(els.mergeCols.value));
  const rows = Math.max(1, Number(els.mergeRows.value));
  const count = indexes.length;

  if (!Number.isFinite(cols) || !Number.isFinite(rows)) {
    alert('Колонки/строки должны быть числами.');
    return;
  }

  if (cols * rows < count) {
    alert(`Ошибка: ${cols}×${rows} = ${cols * rows}, а нужно минимум ${count}.`);
    return;
  }

  const firstIndex = indexes[0];
  const selectedBlocks = indexes.map(i => state.content.blocks[i]);

  /** @type {Array<IBlock | null>} */
  const cells = [];
  for (let i = 0; i < cols * rows; i += 1) {
    cells.push(selectedBlocks[i] ?? null);
  }

  /** @type {IBlock} */
  const gridBlock = {
    id: uid(),
    type: 'grid',
    align: 'left',
    background: defaultBackground(),
    text: null,
    image: null,
    grid: { cols, rows, cells },
    map: null,
    booking: null,
    button: null,
    spacer: null,
    contacts: null,
  };

  // Remove from end to start
  for (let i = indexes.length - 1; i >= 0; i -= 1) {
    state.content.blocks.splice(indexes[i], 1);
  }
  state.content.blocks.splice(firstIndex, 0, gridBlock);

  state.selectedIds.clear();
  saveLocal(state.content);
  render();
};

const init = async () => {
  loadViewerPrefs();
  // Load published content first
  let published = defaultContent();
  try {
    const res = await fetch(PUBLISHED_URL, { cache: 'no-cache' });
    if (res.ok) published = normalizeContent(await res.json());
  } catch {
    // ignore
  }

  // If local exists, use it (admin edits persistence). Public users usually won't have it.
  state.content = loadLocal() ?? published;
  applySite();
  refreshGitHubMetaAsync();

  // Open admin panel if in admin mode
  els.openLoginBtn.addEventListener('click', () => {
    if (state.isAdmin) {
      openAdmin();
    }
  });

  els.closeAdminBtn.addEventListener('click', closeAdmin);

  // Mode switch
  els.modeSwitch.addEventListener('change', () => {
    state.isAdmin = els.modeSwitch.checked;
    els.modeLabel.textContent = state.isAdmin ? 'Режим администратора' : 'Режим пользователя';
    if (state.isAdmin) {
      openAdmin();
    } else {
      closeAdmin();
    }
    render();
  });

  // Site title/subtitle (admin)
  els.adminSiteTitle.addEventListener('input', () => {
    state.content.site.title = els.adminSiteTitle.value;
    saveLocal(state.content);
    render();
  });
  els.adminSiteSubtitle.addEventListener('input', () => {
    state.content.site.subtitle = els.adminSiteSubtitle.value;
    saveLocal(state.content);
    render();
  });

  els.exportBtn.addEventListener('click', () => {
    downloadJson('content.json', state.content);
  });

  els.publishBtn.addEventListener('click', () => {
    publishToGitHubAsync();
  });

  els.githubTestBtn.addEventListener('click', () => {
    testGitHubConnectionAsync();
  });

  els.importInput.addEventListener('change', async () => {
    const file = els.importInput.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsTextAsync(file);
      state.content = normalizeContent(JSON.parse(text));
      saveLocal(state.content);
      render();
    } catch {
      alert('Не удалось прочитать JSON. Проверьте файл.');
    } finally {
      els.importInput.value = '';
    }
  });

  els.resetBtn.addEventListener('click', () => {
    if (!confirm('Удалить локальные правки? Публикация не пострадает.')) return;
    clearLocal();
    location.reload();
  });

  // Add modal
  els.addType.addEventListener('change', syncAddModalUi);
  els.addImage.addEventListener('change', async () => {
    const file = els.addImage.files?.[0];
    if (!file) {
      state.addImageDataUrl = null;
      els.addImageName.textContent = 'файл не выбран';
      return;
    }
    els.addImageName.textContent = file.name;
    state.addImageDataUrl = await readFileAsDataUrlAsync(file);
  });

  els.addForm.addEventListener('submit', (e) => {
    console.log('addForm submit event fired');
    e.preventDefault();
    const submitter = /** @type {HTMLButtonElement} */ (e.submitter);
    console.log('addForm submit', submitter?.value);
    if (submitter && submitter.value !== 'ok') {
      console.log('submitter value not ok, closing modal');
      closeAddModal();
      return;
    }
    const type = /** @type {TBlockType} */ (els.addType.value);
    const textValue = els.addText.value.trim();
    const media = state.addImageDataUrl;

    if ((type === 'text' || type === 'mixed') && !textValue) {
      alert('Введите текст.');
      return;
    }
    if ((type === 'image' || type === 'video' || type === 'mixed') && !media) {
      alert('Выберите файл.');
      return;
    }
    if (type === 'map') {
      const lat = Number(els.addMapLat.value);
      const lon = Number(els.addMapLon.value);
      const zoom = Number(els.addMapZoom.value || '16');
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        alert('Введите корректные координаты (широта и долгота).');
        return;
      }
      if (!Number.isFinite(zoom) || zoom < 1 || zoom > 18) {
        alert('Зум должен быть от 1 до 18.');
        return;
      }
    }
    if (type === 'button') {
      const label = els.addButtonLabel.value.trim();
      const url = els.addButtonUrl.value.trim();
      if (!label) {
        alert('Введите текст кнопки.');
        return;
      }
      if (!url) {
        alert('Введите ссылку для кнопки.');
        return;
      }
    }
    if (type === 'spacer') {
      const h = Number(els.addSpacerHeight.value);
      if (!Number.isFinite(h) || h < 0) {
        alert('Введите высоту отступа (0+).');
        return;
      }
    }
    if (type === 'booking') {
      const title = els.addBookingTitle.value.trim();
      if (!title) {
        alert('Введите заголовок для блока записи.');
        return;
      }
    }

    /** @type {IBlock} */
    const block = {
      id: uid(),
      type,
      align: 'left',
      background: defaultBackground(),
      text: type === 'text' || type === 'mixed' ? { value: textValue, style: defaultTextStyle() } : null,
      image: type === 'image' || type === 'mixed' ? { src: media || '', alt: els.addImage.files?.[0]?.name ?? '' } : null,
      video: type === 'video' ? { src: media || '', alt: els.addImage.files?.[0]?.name ?? '' } : null,
      grid: null,
      map:
        type === 'map'
          ? { lat: Number(els.addMapLat.value), lon: Number(els.addMapLon.value), zoom: Number(els.addMapZoom.value || '16') }
          : null,
      booking:
        type === 'booking'
          ? {
              title: els.addBookingTitle.value.trim() || 'Запись на приём',
              slotMinutes: 60,
              days: [
                { dow: 1, start: '10:00', end: '18:00' },
                { dow: 2, start: '10:00', end: '18:00' },
                { dow: 3, start: '10:00', end: '18:00' },
                { dow: 4, start: '10:00', end: '18:00' },
                { dow: 5, start: '10:00', end: '18:00' },
              ],
            }
          : null,
      button:
        type === 'button'
          ? { label: els.addButtonLabel.value.trim(), url: els.addButtonUrl.value.trim() }
          : null,
      spacer: type === 'spacer' ? { height: Number(els.addSpacerHeight.value || '24') } : null,
      contacts:
        type === 'contacts'
          ? {
              title: els.addContactsTitle.value.trim() || 'Контакты',
              phone: els.addContactsPhone.value.trim(),
              address: els.addContactsAddress.value.trim(),
              instagram: els.addContactsInstagram.value.trim(),
            }
          : null,
    };
    console.log('About to call insertBlock with block:', block);
    insertBlock(block);
    console.log('insertBlock called, closing modal');
    closeAddModal();
  });

  const closeAddModal = () => {
    console.log('closeAddModal called');
    els.addModal.style.display = 'none';
    els.addModalBackdrop.style.display = 'none';
  };

  els.addModalBackdrop.addEventListener('click', closeAddModal);

  // Merge
  els.mergeBtn.addEventListener('click', openMergeModal);
  els.mergeModal.addEventListener('close', () => {
    if (els.mergeModal.returnValue !== 'ok') return;
    doMergeSelected();
  });

  // Site background UI
  els.siteBgMode.addEventListener('change', applySiteBgFromUi);
  els.siteBgColor.addEventListener('input', applySiteBgFromUi);
  els.siteBgGradFrom.addEventListener('input', applySiteBgFromUi);
  els.siteBgGradTo.addEventListener('input', applySiteBgFromUi);
  els.siteBgGradAngle.addEventListener('input', applySiteBgFromUi);
  els.siteBgImageInput.addEventListener('change', async () => {
    const file = els.siteBgImageInput.files?.[0];
    if (!file) return;
    state.content.site.background.imageDataUrl = await readFileAsDataUrlAsync(file);
    state.content.site.background.type = 'image';
    saveLocal(state.content);
    render();
    syncSiteBgUi();
    els.siteBgImageInput.value = '';
  });

  syncSiteBgUi();
  render();

  // Initialize mode switch
  els.modeSwitch.checked = state.isAdmin;
  els.modeLabel.textContent = state.isAdmin ? 'Режим администратора' : 'Режим пользователя';
};

init();
