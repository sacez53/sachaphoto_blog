(function (root) {
  'use strict';
  const MAX_SLIDES = 20;
  const plainText = value => String(value || '').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*|__|[*`]/g, '').trim();
  const slide = (type, values = {}) => ({ type, title: '', text: '', image: '', x: 50, y: 50, fit: 'cover', ...values });
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
          seen.add(photo.src); result.push(slide('photo', { image: photo.src, text: plainText(photo.caption).slice(0, 800) }));
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
  function textBox(context, value, { x, y, width, height, max = 64, min = 28, weight = 400, color = '#fff' }) {
    if (!value.trim()) return true;
    let lines, size;
    for (size = max; size >= min; size -= 2) {
      context.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`;
      lines = wrapText(context, value, width);
      if (lines.length * size * 1.3 <= height) break;
    }
    if (size < min) return false;
    context.fillStyle = color; context.textBaseline = 'top';
    lines.forEach((line, index) => context.fillText(line, x, y + index * size * 1.3));
    return true;
  }
  function drawPhoto(context, image, page, x, y, width, height) {
    const scale = Math[page.fit === 'contain' ? 'min' : 'max'](width / image.naturalWidth, height / image.naturalHeight);
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
    context.save(); context.beginPath(); context.rect(x, y, width, height); context.clip();
    context.drawImage(image.source || image, x + (width - w) * page.x / 100, y + (height - h) * page.y / 100, w, h); context.restore();
  }
  async function render(canvas, page, options, loadImage) {
    canvas.width = 1080; canvas.height = options.format === 'square' ? 1080 : 1350;
    const ctx = canvas.getContext('2d'), h = canvas.height, light = options.theme === 'light';
    const foreground = light ? '#213e2d' : '#f7f5ec', background = light ? '#f6f3ea' : '#172c22', accent = light ? '#526d44' : '#b7d1a2';
    ctx.fillStyle = background; ctx.fillRect(0, 0, 1080, h);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const photo = page.image && page.type !== 'text' ? await loadImage(page.image) : null;
    let fits = true;
    if (page.type === 'cover') {
      if (photo) {
        drawPhoto(ctx, photo, page, 0, 0, 1080, h);
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, light ? 'rgba(246,243,234,.68)' : 'rgba(15,30,22,.65)');
        gradient.addColorStop(.35, light ? 'rgba(246,243,234,.24)' : 'rgba(15,30,22,.15)');
        gradient.addColorStop(.65, light ? 'rgba(246,243,234,.92)' : 'rgba(15,30,22,.92)');
        gradient.addColorStop(1, background); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, h);
      }
      ctx.fillStyle = accent; ctx.fillRect(72, h * .44 - 32, 72, 5);
      fits = textBox(ctx, page.title, { x: 72, y: h * .44, width: 936, height: h * .31, max: 86, min: 34, weight: 600, color: foreground });
      fits = textBox(ctx, page.text, { x: 72, y: h * .79, width: 936, height: h * .12, max: 36, min: 26, color: foreground }) && fits;
    } else if (page.type === 'photo') {
      const captionHeight = page.text || page.title ? 250 : 0, photoHeight = h - 250 - captionHeight;
      if (photo) drawPhoto(ctx, photo, page, 60, 140, 960, photoHeight);
      else { ctx.fillStyle = light ? '#e4e9de' : '#294435'; ctx.fillRect(60, 140, 960, photoHeight); }
      fits = textBox(ctx, [page.title, page.text].filter(Boolean).join('\n'), { x: 72, y: 162 + photoHeight, width: 936, height: captionHeight - 10, max: 36, min: 26, color: foreground });
    } else {
      ctx.fillStyle = accent; ctx.fillRect(72, 160, 72, 5);
      const hasTitle = !!page.title.trim();
      if (hasTitle) fits = textBox(ctx, page.title, { x: 72, y: 205, width: 936, height: 255, max: 66, min: 32, weight: 600, color: foreground });
      fits = textBox(ctx, page.text, { x: 72, y: hasTitle ? 490 : 220, width: 936, height: h - (hasTitle ? 640 : 370), max: 52, min: 28, color: foreground }) && fits;
    }
    textBox(ctx, options.brand, { x: 72, y: 60, width: 936, height: 56, max: 26, min: 18, weight: 600, color: foreground });
    ctx.fillStyle = accent; ctx.fillRect(72, h - 91, 936, 1);
    ctx.font = '22px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = foreground; ctx.textBaseline = 'top';
    ctx.fillText(`${String(options.index + 1).padStart(2, '0')} / ${String(options.total).padStart(2, '0')}`, 72, h - 65);
    ctx.textAlign = 'right'; ctx.fillText(options.index + 1 === options.total ? 'À lire sur le blog' : 'Faites défiler', 1008, h - 65); ctx.textAlign = 'left';
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
  const api = { MAX_SLIDES, slide, plainText, splitText, createSlides, wrapText, render, buildZip };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BlogCarousel = api;
})(globalThis);
