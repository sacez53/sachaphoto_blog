// Remplace les images de dist/ par des versions web. Les originaux du projet ne sont pas modifiés.
// Les noms de fichiers restent identiques : aucune adresse d'image ne change.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MAX_PHOTO = 2048;
const MAX_AVATAR = 640;
const encoders = {
  '.jpg': image => image.jpeg({ quality: 82, mozjpeg: true }),
  '.jpeg': image => image.jpeg({ quality: 82, mozjpeg: true }),
  '.png': image => image.png({ palette: true, quality: 90, effort: 10 }),
  '.webp': image => image.webp({ quality: 82 }),
  '.avif': image => image.avif({ quality: 60 }),
};

export async function optimizeImages(directory, sharp) {
  const settings = JSON.parse(fs.readFileSync(path.join(directory, 'data/site.json'), 'utf8').replace(/^﻿/, ''));
  const avatar = path.basename(settings.avatar || 'author-avatar.jpg');
  const images = path.join(directory, 'assets/images');
  const result = { files: 0, before: 0, after: 0 };
  for (const name of fs.readdirSync(images)) {
    const encode = encoders[path.extname(name).toLowerCase()];
    if (!encode) continue;
    const file = path.join(images, name);
    const input = fs.readFileSync(file);
    const limit = name === avatar ? MAX_AVATAR : MAX_PHOTO;
    const { width, height } = await sharp(input, { failOn: 'none' }).metadata();
    // rotate() applique l'orientation EXIF avant le retrait des métadonnées.
    const resized = sharp(input, { failOn: 'none' }).rotate().resize({ width: limit, height: limit, fit: 'inside', withoutEnlargement: true });
    const output = await encode(resized).toBuffer();
    const mustShrink = Math.max(width, height) > limit;
    const kept = mustShrink || output.length < input.length ? output : input;
    if (kept !== input) fs.writeFileSync(file, kept);
    result.files++; result.before += input.length; result.after += kept.length;
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { default: sharp } = await import('sharp');
  const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  const { files, before, after } = await optimizeImages(directory, sharp);
  const mb = value => (value / 1024 / 1024).toFixed(1);
  console.log(`${files} images optimisées : ${mb(before)} Mo → ${mb(after)} Mo`);
}
