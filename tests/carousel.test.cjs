const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSlides, splitText, wrapText, buildZip, render, slide, MAX_SLIDES } = require('../_manager/public/carousel.js');
const { createCaption, alternativeText, instagramText } = require('../_manager/public/carousel.js');

test('la préparation Instagram conserve les descriptions et produit un texte lisible à exporter', async () => {
  const article = {title:'Un **oiseau**',excerpt:'Au bord de la rivière.',content:[{type:'image',src:'assets/images/a.jpg',alt:'Un merle sur une branche.',caption:'Le matin'}]};
  const pages = createSlides(article);
  const photo = pages.find(page => page.type === 'photo');
  assert.equal(photo.altText, 'Un merle sur une branche.');
  const caption = createCaption(article, 'https://example.org/article');
  assert.match(caption, /Un oiseau\n\nAu bord/);
  assert.match(caption, /https:\/\/example.org\/article/);
  assert.ok(createCaption({title:'x'.repeat(3000)}).length <= 2200);
  photo.altText = 'Description personnalisée 📷';
  assert.equal(alternativeText(photo), 'Description personnalisée 📷');
  const text = instagramText(pages, caption);
  assert.match(text, /Page 3\nDescription personnalisée 📷/);
  const zip = Buffer.from(await buildZip([{name:'publication-instagram.txt',data:new TextEncoder().encode(text)}]).arrayBuffer());
  assert.ok(zip.includes(Buffer.from(text)));
});

test('la proposition conserve les extraits et déduplique les photos sans modifier l’article', () => {
  const article = { title: 'Un **reportage**', category: 'Photo', excerpt: 'Au bord de la rivière.', image: 'assets/images/a.jpg', content: [
    { type: 'gallery', images: [{ src: 'assets/images/a.jpg' }, { src: 'assets/images/b.jpg', caption: 'Au matin' }] },
    { type: 'paragraph', text: 'Un [récit](https://example.org) en images.' }
  ] };
  const original = structuredClone(article), pages = createSlides(article);
  assert.deepEqual(article, original);
  assert.equal(pages[0].type, 'cover'); assert.equal(pages[0].title, 'Un reportage');
  assert.equal(pages.filter(page => page.image === 'assets/images/a.jpg').length, 1);
  assert.ok(pages.some(page => page.image === 'assets/images/b.jpg' && page.text === 'Au matin'));
  assert.ok(pages.some(page => page.text === 'Un récit en images.'));
});

test('les textes sont répartis sans perdre les caractères et les propositions respectent la limite de pages', () => {
  const text = 'Photographie à la rivière. '.repeat(100), parts = splitText(text);
  assert.equal(parts.join(' '), text.trim()); assert.ok(parts.every(part => part.length <= 650));
  const unicode = 'a'.repeat(649) + '📷' + 'b'.repeat(650);
  assert.equal(splitText(unicode).join(''), unicode);
  assert.ok(splitText(unicode).every(part => !/[\uD800-\uDBFF]$/.test(part)));
  const pages = createSlides({ title: '', content: [{ type: 'gallery', images: Array.from({ length: 50 }, (_, i) => ({ src: `assets/images/${i}.jpg` })) }] });
  assert.equal(pages.length, MAX_SLIDES); assert.equal(createSlides({}).length, 2);
});

test('le texte tient dans la largeur même avec de longs mots et des retours à la ligne', () => {
  const context = { measureText: value => ({ width: Array.from(value).length }) };
  const text = 'Un mottrèslongsansespace\n\nEt une photo 📷.';
  const lines = wrapText(context, text, 10);
  assert.ok(lines.every(line => Array.from(line).length <= 10));
  assert.equal(lines.join('').replace(/\s/g, ''), text.replace(/\s/g, ''));
  assert.ok(lines.includes(''));
});

test('l’archive ZIP conserve les noms ordonnés, les contenus et les sommes de contrôle', async () => {
  const entries = [{ name: '01-couverture.png', data: Buffer.from('abc') }, { name: '02-photo.png', data: Buffer.from([0, 255, 42]) }];
  const blob = buildZip(entries), zip = Buffer.from(await blob.arrayBuffer());
  assert.equal(blob.type, 'application/zip');
  let offset = 0;
  for (const [index, entry] of entries.entries()) {
    assert.equal(zip.readUInt32LE(offset), 0x04034b50);
    assert.equal(zip.readUInt16LE(offset + 8), 0);
    if (!index) assert.equal(zip.readUInt32LE(offset + 14), 0x352441c2);
    const size = zip.readUInt32LE(offset + 18), nameLength = zip.readUInt16LE(offset + 26);
    assert.equal(zip.subarray(offset + 30, offset + 30 + nameLength).toString(), entry.name);
    assert.deepEqual(zip.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size), entry.data);
    offset += 30 + nameLength + size;
  }
  const centralStart = offset;
  for (const entry of entries) {
    assert.equal(zip.readUInt32LE(offset), 0x02014b50);
    assert.equal(zip.subarray(offset + 46, offset + 46 + zip.readUInt16LE(offset + 28)).toString(), entry.name);
    offset += 46 + zip.readUInt16LE(offset + 28);
  }
  assert.equal(zip.readUInt32LE(offset), 0x06054b50);
  assert.equal(zip.readUInt16LE(offset + 10), 2); assert.equal(zip.readUInt32LE(offset + 16), centralStart);
});

test('le rendu refuse un texte trop long et respecte les formats portrait et carré', async () => {
  const calls = [], context = { fillRect() {}, fillText(text, x, y) { calls.push({ text, x, y }); }, measureText(text) { return { width: Array.from(text).length * parseFloat(this.font.match(/(\d+)px/)[1]) * .55 }; } };
  const canvas = { getContext: () => context };
  assert.equal(await render(canvas, slide('text', { text: 'Une photographie.' }), { format: 'portrait', brand: 'Sacha', index: 0, total: 2 }, () => {}), true);
  assert.equal(canvas.width, 1080); assert.equal(canvas.height, 1350);
  assert.ok(calls.some(call => call.text === '01 / 02'));
  assert.equal(await render(canvas, slide('text', { title: 'Titre', text: 'Texte très long. '.repeat(200) }), { format: 'square', brand: '', index: 1, total: 2 }, () => {}), false);
  assert.equal(canvas.height, 1080);
});
