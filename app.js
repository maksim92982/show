/* eslint-disable no-alert */

const STORAGE_KEY = 'bakery.site.content.v1';
const VIEWER_PREFS_KEY = 'bakery.viewer.prefs.v1';
const PUBLISHED_URL = './content.json';
const ADMIN_LOGIN = 'admin12345';
const ADMIN_PASSWORD = '&U)q!j&98+';
const SAVED_CREDS_KEY = 'bakery.admin.creds.v1';

/**
 * @typedef {'left'|'center'|'right'} TAlign
 * @typedef {'solid'|'gradient'|'image'} TBgType
 * @typedef {'text'|'image'|'mixed'|'grid'} TBlockType
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
 *  grid: { cols: number, rows: number, cells: Array<IBlock | null> } | null
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
    b.type === 'text' || b.type === 'image' || b.type === 'mixed' || b.type === 'grid' ? b.type : 'text';
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

  return { id, type, align, background, text, image, grid };
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
  openLoginBtn: /** @type {HTMLButtonElement} */ ($('#openLoginBtn')),
  loginModal: /** @type {HTMLDialogElement} */ ($('#loginModal')),
  viewerColor: /** @type {HTMLInputElement} */ ($('#viewerColor')),
  viewerColorResetBtn: /** @type {HTMLButtonElement} */ ($('#viewerColorResetBtn')),
  loginUser: /** @type {HTMLInputElement} */ ($('#loginUser')),
  loginPass: /** @type {HTMLInputElement} */ ($('#loginPass')),
  saveCredsBtn: /** @type {HTMLButtonElement} */ ($('#saveCredsBtn')),
  loginHint: /** @type {HTMLDivElement} */ ($('#loginHint')),

  adminSiteTitle: /** @type {HTMLInputElement} */ ($('#adminSiteTitle')),
  adminSiteSubtitle: /** @type {HTMLInputElement} */ ($('#adminSiteSubtitle')),

  exportBtn: /** @type {HTMLButtonElement} */ ($('#exportBtn')),
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

  addModal: /** @type {HTMLDialogElement} */ ($('#addModal')),
  addType: /** @type {HTMLSelectElement} */ ($('#addType')),
  addTextRow: /** @type {HTMLDivElement} */ ($('#addTextRow')),
  addText: /** @type {HTMLTextAreaElement} */ ($('#addText')),
  addImageRow: /** @type {HTMLDivElement} */ ($('#addImageRow')),
  addImage: /** @type {HTMLInputElement} */ ($('#addImage')),
  addImageName: /** @type {HTMLSpanElement} */ ($('#addImageName')),

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
  const wrap = document.createElement('div');
  wrap.className = 'addSlot';
  const btn = document.createElement('button');
  btn.className = 'plusBtn';
  btn.type = 'button';
  btn.textContent = '+';
  btn.title = 'Добавить блок';
  btn.addEventListener('click', () => openAddModal(index));
  wrap.appendChild(btn);
  return wrap;
};

const openAddModal = index => {
  if (!state.isAdmin) return;
  state.addInsertIndex = index;
  state.addImageDataUrl = null;
  els.addType.value = 'text';
  els.addText.value = '';
  els.addImage.value = '';
  els.addImageName.textContent = 'файл не выбран';
  syncAddModalUi();
  els.addModal.showModal();
};

const syncAddModalUi = () => {
  const t = els.addType.value;
  const showText = t === 'text' || t === 'mixed';
  const showImage = t === 'image' || t === 'mixed';
  els.addTextRow.hidden = !showText;
  els.addImageRow.hidden = !showImage;
};

const insertBlock = block => {
  state.content.blocks.splice(state.addInsertIndex, 0, block);
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
  applySite();

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
    els.blocksRoot.appendChild(makeBlockContent(b));
    if (state.isAdmin) {
      els.blocksRoot.appendChild(makeAddSlot(idx + 1));
    }
  });

  // (header buttons removed)
};

const openAdmin = () => {
  state.isAdmin = true;
  els.adminPanel.dataset.open = 'true';
  els.adminSiteTitle.value = state.content.site.title;
  els.adminSiteSubtitle.value = state.content.site.subtitle;
  render();
};

const closeAdmin = () => {
  state.isAdmin = false;
  els.adminPanel.dataset.open = 'false';
  state.selectedIds.clear();
  render();
};

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

const loadSavedCreds = () => {
  const raw = localStorage.getItem(SAVED_CREDS_KEY);
  if (!raw) return;
  try {
    const c = JSON.parse(raw);
    if (c && typeof c.user === 'string') els.loginUser.value = c.user;
    if (c && typeof c.pass === 'string') els.loginPass.value = c.pass;
  } catch {
    // ignore
  }
};

const saveCreds = () => {
  localStorage.setItem(SAVED_CREDS_KEY, JSON.stringify({ user: els.loginUser.value, pass: els.loginPass.value }));
  els.loginHint.textContent = 'Данные сохранены в этом браузере.';
};

const tryLogin = () => {
  const u = els.loginUser.value;
  const p = els.loginPass.value;
  if (u === ADMIN_LOGIN && p === ADMIN_PASSWORD) {
    els.loginHint.textContent = '';
    openAdmin();
    return true;
  }
  els.loginHint.textContent = 'Неверный логин или пароль.';
  return false;
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

  // Viewer settings + admin login modal
  els.openLoginBtn.addEventListener('click', () => {
    els.loginHint.textContent = '';
    els.viewerColor.value = state.viewerPrefs.bgColor ?? '#0b0b10';
    loadSavedCreds();
    els.loginModal.showModal();
  });
  els.viewerColor.addEventListener('input', () => {
    state.viewerPrefs.bgColor = els.viewerColor.value;
    saveViewerPrefs();
    render();
  });
  els.viewerColorResetBtn.addEventListener('click', () => {
    state.viewerPrefs.bgColor = null;
    saveViewerPrefs();
    render();
  });
  els.saveCredsBtn.addEventListener('click', saveCreds);
  els.loginModal.addEventListener('close', () => {
    if (els.loginModal.returnValue !== 'ok') return;
    const ok = tryLogin();
    if (!ok) {
      els.loginModal.showModal();
    }
  });

  els.closeAdminBtn.addEventListener('click', closeAdmin);

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

  els.addModal.addEventListener('close', () => {
    if (els.addModal.returnValue !== 'ok') return;
    const type = /** @type {TBlockType} */ (els.addType.value);
    const textValue = els.addText.value.trim();
    const img = state.addImageDataUrl;

    if ((type === 'text' || type === 'mixed') && !textValue) {
      alert('Введите текст.');
      return;
    }
    if ((type === 'image' || type === 'mixed') && !img) {
      alert('Выберите фото.');
      return;
    }

    /** @type {IBlock} */
    const block = {
      id: uid(),
      type,
      align: 'left',
      background: defaultBackground(),
      text: type === 'image' ? null : { value: textValue, style: defaultTextStyle() },
      image: type === 'text' ? null : { src: img || '', alt: els.addImage.files?.[0]?.name ?? '' },
      grid: null,
    };
    insertBlock(block);
  });

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
};

init();


