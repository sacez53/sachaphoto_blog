import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const publicPages = ['index.html', 'articles.html', 'article.html', 'a-propos.html'];

export function publicFiles(root) {
  const files = [...publicPages, 'data/articles.json', 'data/site.json'];
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/articles.json'), 'utf8').replace(/^\uFEFF/, ''));
  for (const article of catalog) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(article.slug)) throw new Error('Adresse invalide dans le catalogue.');
    files.push(`data/articles/${article.slug}.json`);
  }
  function walk(relative) {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Un lien vers un autre dossier ne peut pas être exporté.');
      if (entry.isDirectory()) walk(`${relative}/${entry.name}`);
      else if (!entry.name.endsWith('.tmp')) files.push(`${relative}/${entry.name}`);
    }
  }
  walk('assets');
  walk('components');
  return [...new Set(files)];
}

const html = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function siteFiles(root) {
  const files = publicFiles(root).map(relative => [relative, fs.readFileSync(path.join(root, relative))]);
  const template = fs.readFileSync(path.join(root, 'article.html'), 'utf8');
  if (!/<head(?:\s[^>]*)?>/i.test(template)) throw new Error('La page article.html ne contient pas de balise head.');
  const settings = JSON.parse(fs.readFileSync(path.join(root, 'data/site.json'), 'utf8').replace(/^\uFEFF/, ''));
  let base;
  try {
    base = new URL(settings.siteUrl || 'https://sacez53.github.io/sachaphoto_blog/');
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error();
  } catch { throw new Error('Adresse publique du blog invalide dans les réglages.'); }
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/articles.json'), 'utf8').replace(/^\uFEFF/, ''));
  for (const article of catalog) {
    const share = new URL(`partage/${encodeURIComponent(article.slug)}/`, base).href;
    const destination = new URL(`article.html?slug=${encodeURIComponent(article.slug)}`, base).href;
    const image = typeof article.image === 'string' && /^assets\/images\/[^?#]+$/i.test(article.image) ? new URL(article.image, base).href : '';
    const title = html(article.title), description = html(article.excerpt), target = html(destination);
    const metadata = `<base href="../../"><meta property="og:type" content="article"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${html(share)}">${image ? `<meta property="og:image" content="${html(image)}">` : ''}<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}">${image ? `<meta name="twitter:image" content="${html(image)}">` : ''}<link rel="canonical" href="${target}">`;
    const page = template.replace(/<head(?:\s[^>]*)?>/i, match => `${match}\n${metadata}`).replace(/<title>[^<]*<\/title>/i, `<title>${title} — Blog</title>`).replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta name="description" content="${description}">`);
    files.push([`partage/${article.slug}/index.html`, Buffer.from(page)]);
  }
  return files;
}

export function build(root = projectRoot) {
  const output = path.resolve(root, 'dist');
  if (path.dirname(output) !== path.resolve(root) || (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink())) throw new Error('Dossier d’export invalide.');
  const files = siteFiles(root);
  // Vérifier les sources avant de remplacer le précédent export.
  const sources = files;
  fs.rmSync(output, { recursive: true, force: true });
  for (const [relative, value] of sources) {
    const destination = path.join(output, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, value);
  }
  fs.writeFileSync(path.join(output, '.nojekyll'), '');
  return { directory: output, files: sources.length + 1 };
}

// ZIP sans compression : les photos sont déjà compressées.
export function zipSite(root) {
  const chunks = [], directory = [];
  let offset = 0;
  const table = Array.from({ length: 256 }, (_, n) => {
    for (let i = 0; i < 8; i++) n = (n & 1) ? (0xedb88320 ^ (n >>> 1)) : n >>> 1;
    return n >>> 0;
  });
  for (const [relative, data] of [...siteFiles(root), ['.nojekyll', Buffer.alloc(0)]]) {
    const name = Buffer.from(relative);
    let crc = 0xffffffff;
    for (const byte of data) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(33, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8); central.writeUInt16LE(33, 14); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    chunks.push(local, name, data); directory.push(central, name); offset += local.length + name.length + data.length;
  }
  const central = Buffer.concat(directory), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(directory.length / 2, 8); end.writeUInt16LE(directory.length / 2, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, central, end]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = build();
  console.log(`${result.files} fichiers exportés dans ${result.directory}`);
}
