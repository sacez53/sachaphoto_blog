(function (root) {
  'use strict';
  const MAX_SLIDES = 20;
  const GRADIENTS = {
    blue: { light: ['#d9ecfa', '#f3f4ff', '#e8def6'], dark: ['#142e45', '#24243d', '#34233f'] },
    sage: { light: ['#dceee6', '#eff4e8', '#d4e6ed'], dark: ['#18392f', '#27392a', '#183442'] },
    sunset: { light: ['#fbe1cf', '#fae8df', '#f3dce8'], dark: ['#42291e', '#3d2632', '#30243f'] },
    lilac: { light: ['#e3dcfa', '#f5e6f0', '#dae9fa'], dark: ['#2e2345', '#40263b', '#1c3348'] }
  };
  const FONT = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  function visualStyle(theme = 'light') {
    const css = typeof document === 'undefined' ? null : getComputedStyle(document.documentElement);
    const dark = ['dark', 'sombre'].includes(theme), prefix = dark ? '--blog-dark-' : '--blog-';
    const defaults = dark ? { background: '#1a1a1a', text: '#fdfdfd', secondary: '#ddd', muted: '#b8b8b8', line: '#444', surface: '#252525', accent: '#a6cbe3' } :
      { background: '#fdfdfd', text: '#1a1a1a', secondary: '#444', muted: '#666', line: '#ddd', surface: '#f5f5f5', accent: '#1a5276' };
    return { font: css?.getPropertyValue('--blog-font').trim() || FONT,
      ...Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, css?.getPropertyValue(prefix + key).trim() || fallback])) };
  }
  let fontsReady;
  function prepareFonts() {
    if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
    fontsReady ||= Promise.all([400, 600, 700].map(weight => document.fonts.load(`${weight} 32px "Inter"`, 'Été, cœur et photographie')))
      .then(faces => { if (faces.some(face => !face.length)) throw new Error('Police absente.'); })
      .catch(() => { fontsReady = null; throw new Error('La police du blog ne peut pas être chargée. Rechargez le gestionnaire avant de télécharger.'); });
    return fontsReady;
  }
  const plainText = value => String(value || '').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*|__|[*`]/g, '').trim();
  const slide = (type, values = {}) => ({ type, title: '', text: '', image: '', altText: '', x: 50, y: 50, fit: 'cover', ...values });
  function createCaption(article, url = '') {
    return [plainText(article.title), plainText(article.excerpt), url ? `À lire sur le blog : ${url}` : ''].filter(Boolean).join('\n\n').slice(0, 2200);
  }
  function alternativeText(page) {
    return page.altText?.trim() || [page.title, page.text].filter(Boolean).join('. ');
  }
  function instagramText(slides, caption) {
    return `LÉGENDE INSTAGRAM\n\n${caption || ''}\n\nTEXTES ALTERNATIFS\n\n` +
      slides.map((page, index) => `Page ${index + 1}\n${alternativeText(page) || 'Description de la photo à renseigner.'}`).join('\n\n');
  }
  function splitText(value, limit = 650) {
    const parts = []; let remaining = plainText(value);
    while (remaining) {
      let end = remaining.length;
      if (end > limit) { end = remaining.lastIndexOf(' ', limit); if (end < limit / 2) end = limit; }
      // Ne pas couper un caractère Unicode entre ses deux unités UTF-16.
      if (end < remaining.length && /[\uD800-\uDBFF]/.test(remaining[end - 1])) end--;
      parts.push(remaining.slice(0, end).trim()); remaining = remaining.slice(end).trim();
    }
    return parts;
  }
  function createSlides(article) {
    const result = [slide('cover', { title: plainText(article.title) || 'Votre titre', text: plainText(article.category), image: article.image || '' })];
    const seen = new Set(article.image ? [article.image] : []);
    const addText = value => { for (const text of splitText(value)) { if (result.length >= MAX_SLIDES) break; result.push(slide('text', { text })); } };
    if (article.excerpt) addText(article.excerpt);
    for (const block of article.content || []) {
      if (result.length >= MAX_SLIDES) break;
      if (block.type === 'image' || block.type === 'gallery') {
        for (const photo of block.type === 'gallery' ? block.images || [] : [block]) {
          if (!photo.src || seen.has(photo.src) || result.length >= MAX_SLIDES) continue;
          seen.add(photo.src); result.push(slide('photo', { image: photo.src, text: plainText(photo.caption).slice(0, 800), altText: plainText(photo.alt).slice(0, 2000) }));
        }
      } else if (['paragraph', 'quote'].includes(block.type) && result.length < 6) addText(block.text);
    }
    if (result.length === 1) result.push(slide('text', { title: 'À découvrir sur le blog', text: 'Ajoutez ici un extrait de votre article.' }));
    return result;
  }
  function wrapText(context, value, width) {
    const lines = [];
    for (const paragraph of String(value).split('\n')) {
      if (!paragraph.trim()) { lines.push(''); continue; }
      let line = '';
      for (const word of paragraph.trim().split(/\s+/)) {
        if (line && context.measureText(`${line} ${word}`).width <= width) { line += ` ${word}`; continue; }
        if (line) { lines.push(line); line = ''; }
        for (const character of word) {
          if (line && context.measureText(line + character).width > width) { lines.push(line); line = ''; }
          line += character;
        }
      }
      if (line) lines.push(line);
    }
    return lines;
  }
  function textBox(context, value, { x, y, width, height, max = 64, min = 28, weight = 400, color = '#1a1a1a', font = FONT, lineHeight = 1.3 }) {
    if (!value.trim()) return true;
    let lines, size;
    for (size = max; size >= min; size -= 2) {
      context.font = `${weight} ${size}px ${font}`;
      lines = wrapText(context, value, width);
      if (lines.length * size * lineHeight <= height) break;
    }
    if (size < min) return false;
    context.fillStyle = color; context.textBaseline = 'top';
    lines.forEach((line, index) => context.fillText(line, x, y + index * size * lineHeight));
    return true;
  }
  function drawPhoto(context, image, page, x, y, width, height) {
    const scale = Math[page.fit === 'contain' ? 'min' : 'max'](width / image.naturalWidth, height / image.naturalHeight);
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
    context.save(); context.beginPath(); context.rect(x, y, width, height); context.clip();
    context.drawImage(image.source || image, x + (width - w) * page.x / 100, y + (height - h) * page.y / 100, w, h); context.restore();
  }
  async function render(canvas, page, options, loadImage) {
    await prepareFonts();
    canvas.width = 1080; canvas.height = options.format === 'square' ? 1080 : 1350;
    const ctx = canvas.getContext('2d'), h = canvas.height, style = visualStyle(options.theme);
    const box = (value, settings) => textBox(ctx, value, { x: 72, width: 936, color: style.text, font: style.font, ...settings });
    const palette = GRADIENTS[options.gradient];
    if (palette) {
      style.muted = options.theme === 'dark' ? '#c8c8c8' : '#555';
      const gradient = ctx.createLinearGradient(0, 0, 1080, h);
      palette[options.theme === 'dark' ? 'dark' : 'light'].forEach((color, index) => gradient.addColorStop(index / 2, color));
      ctx.fillStyle = gradient;
    } else ctx.fillStyle = style.background;
    ctx.fillRect(0, 0, 1080, h);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const photo = page.image && page.type !== 'text' ? await loadImage(page.image) : null;
    let fits = true;
    if (page.type === 'cover') {
      let titleY = 285, categoryY = 190;
      if (photo) {
        const photoHeight = Math.round(h * .39);
        ctx.fillStyle = style.surface; ctx.fillRect(72, 166, 936, photoHeight);
        drawPhoto(ctx, photo, page, 72, 166, 936, photoHeight);
        categoryY = 166 + photoHeight + 42; titleY = categoryY + 84;
      }
      fits = box(page.text || 'Sur le blog', { y: categoryY, height: 66, max: 26, min: 20, weight: 600, color: style.muted });
      fits = box(page.title, { y: titleY, height: h - titleY - 146, max: photo ? 86 : 96, min: 32, weight: 700, lineHeight: 1.2 }) && fits;
    } else if (page.type === 'photo') {
      const caption = [page.title, page.text].filter(value => value.trim()).join('\n');
      const captionHeight = caption ? 250 : 0, photoHeight = h - 320 - captionHeight;
      ctx.fillStyle = style.surface; ctx.fillRect(72, 166, 936, photoHeight);
      if (photo) drawPhoto(ctx, photo, page, 72, 166, 936, photoHeight);
      fits = box(caption, { y: 198 + photoHeight, height: captionHeight, max: 36, min: 26, color: style.secondary });
    } else {
      box('EXTRAIT DE L’ARTICLE', { y: 190, height: 42, max: 24, min: 24, weight: 600, color: style.muted });
      const hasTitle = !!page.title.trim();
      if (hasTitle) fits = box(page.title, { y: 280, height: 220, max: 66, min: 32, weight: 700, lineHeight: 1.2 });
      const textY = hasTitle ? 540 : 280;
      fits = box(page.text, { y: textY, height: h - textY - 160, max: 48, min: 28, color: style.secondary, lineHeight: 1.5 }) && fits;
    }
    fits = box(options.brand || '', { y: 60, height: 48, max: 30, min: 18, weight: 700 }) && fits;
    ctx.fillStyle = style.line; ctx.fillRect(72, 122, 936, 1); ctx.fillRect(72, h - 106, 936, 1);
    ctx.font = `400 22px ${style.font}`; ctx.fillStyle = style.muted; ctx.textBaseline = 'top';
    ctx.fillText(`${String(options.index + 1).padStart(2, '0')} / ${String(options.total).padStart(2, '0')}`, 72, h - 65);
    ctx.fillStyle = style.accent; ctx.textAlign = 'right';
    ctx.fillText(options.index + 1 === options.total ? 'À lire sur le blog' : 'Faites défiler', 1008, h - 65); ctx.textAlign = 'left';
    return fits;
  }
  // Archive ZIP sans compression, pour conserver les PNG tels quels.
  function buildZip(entries) {
    const chunks = [], directory = []; let offset = 0;
    const encoder = new TextEncoder();
    const table = Array.from({ length: 256 }, (_, n) => { for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
    for (const entry of entries) {
      const name = encoder.encode(entry.name), data = entry.data;
      let crc = 0xffffffff; for (const byte of data) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8); crc = (crc ^ 0xffffffff) >>> 0;
      const local = new Uint8Array(30), l = new DataView(local.buffer);
      l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x800, true); l.setUint16(12, 33, true);
      l.setUint32(14, crc, true); l.setUint32(18, data.length, true); l.setUint32(22, data.length, true); l.setUint16(26, name.length, true);
      const central = new Uint8Array(46), c = new DataView(central.buffer);
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint16(14, 33, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      chunks.push(local, name, data); directory.push(central, name); offset += local.length + name.length + data.length;
    }
    const end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true);
    e.setUint32(12, directory.reduce((sum, part) => sum + part.length, 0), true); e.setUint32(16, offset, true);
    return new Blob([...chunks, ...directory, end], { type: 'application/zip' });
  }
  const api = { MAX_SLIDES, slide, plainText, splitText, createSlides, createCaption, alternativeText, instagramText, wrapText, visualStyle, prepareFonts, textBox, drawPhoto, render, buildZip };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BlogCarousel = api;
})(globalThis);
