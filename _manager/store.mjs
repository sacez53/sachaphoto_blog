import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export class UserError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (message, status) => { throw new UserError(message, status); };
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const hash = (bytes) => bytes === null ? null : createHash('sha256').update(bytes).digest('hex');
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const aboutDefaults = {
  aboutTitle: 'À propos de moi', aboutSubtitle: 'Créateur de ce blog',
  aboutIntro: "Hello, moi c'est sacha GUITTER.\n\nIci vous êtes sur mon blog, je suis passionné par la photohraphie, le web, et la simplicité.\n\nJ'ai créé ce blog pour partager mes découvertes, mes projets, et mes réflexions sur le monde.",
  aboutJourneyTitle: 'Mon parcours',
  aboutJourney: "Je suis photographe amateur depuis plusieurs années, avec une passion particulière pour la photo animalière et la photo portraits\n\nJe suis aussi en 2eme année de BUT MMI (Métier du multimédia et de l'internet) à Laval en mayenne.",
  aboutContactTitle: 'Me contacter', aboutContact: "Vous pouvez me retrouver sur les réseaux sociaux ou m'envoyer un email pour échanger sur divers sujets.",
  siteUrl: 'https://sacez53.github.io/sachaphoto_blog/'
};
const mediaPattern = /^assets\/images\/(?:[\p{L}\p{N}_ .()-]+\/)*[\p{L}\p{N}_ .()-]+\.(?:jpe?g|png|gif|webp|svg|ico|avif)$/iu;
const text = (value, label, max = 20000, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(`${label} : valeur manquante ou trop longue (maximum ${max} caractères).`);
  return value;
};
export function slugify(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100).replace(/-$/, '');
}

export function createStore(root) {
  root = fs.realpathSync(root);
  const local = '.blog-manager';
  function file(relative) {
    if (typeof relative !== 'string' || relative.includes('\\') || relative.includes('\0') || relative.split('/').some(p => !p || p === '.' || p === '..' || p.includes(':'))) fail('Chemin de fichier interdit.');
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep)) fail('Chemin hors du blog.');
    let current = root;
    for (const part of relative.split('/')) {
      current = path.join(current, part);
      try { if (fs.lstatSync(current).isSymbolicLink()) fail('Les liens vers un autre dossier ne sont pas autorisés.'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    return target;
  }
  function bytes(relative) {
    try { return fs.readFileSync(file(relative)); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  function read(relative, fallback) {
    const value = bytes(relative);
    if (value === null) return fallback;
    try { return JSON.parse(value.toString('utf8').replace(/^\uFEFF/, '')); }
    catch { fail(`Le fichier ${relative} contient un JSON invalide. Il n'a pas été modifié.`, 422); }
  }
  function atomic(relative, value) {
    const target = file(relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (value === null) { fs.rmSync(target, { force: true }); return; }
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, value, { flag: 'wx' });
      fs.renameSync(temporary, target);
    } finally { fs.rmSync(temporary, { force: true }); }
  }
  function allowed(relative) {
    return /^data\/(?:articles\/[-a-z0-9]+\.json|articles\.json|site\.json)$/i.test(relative) ||
      /^\.blog-manager\/drafts\/[-a-z0-9]+\.json$/i.test(relative) || mediaPattern.test(relative);
  }
  const historyDirectory = file(`${local}/backups`);
  fs.mkdirSync(historyDirectory, { recursive: true });
  function manifests() {
    return fs.readdirSync(historyDirectory).filter(name => /^[\dT_Z.-]+-[a-f0-9-]+$/.test(name)).map(id => {
      const manifest = read(`${local}/backups/${id}/manifest.json`, null);
      return manifest ? { ...manifest, id } : null;
    }).filter(Boolean).sort((a, b) => b.id.localeCompare(a.id));
  }
  function rollback(manifest) {
    const previous = manifest.entries.map(entry => {
      if (!allowed(entry.path)) fail('Sauvegarde invalide.');
      const value = entry.before === null ? null : bytes(`${local}/backups/${manifest.id}/${entry.before}`);
      if (entry.before !== null && hash(value) !== entry.beforeHash) fail('Une sauvegarde est incomplète. Les fichiers actuels ont été conservés.', 422);
      return { entry, value };
    });
    for (const { entry, value } of previous.reverse()) {
      atomic(entry.path, value);
    }
  }
  for (const manifest of manifests().filter(m => m.state === 'pending')) {
    rollback(manifest);
    atomic(`${local}/backups/${manifest.id}/manifest.json`, json({ ...manifest, state: 'recovered' }));
  }
  function commit(label, changes) {
    const entries = [];
    const id = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`;
    for (const [relative, value] of changes) {
      if (!allowed(relative)) fail('Modification de fichier interdite.');
      const before = bytes(relative);
      if (hash(before) === hash(value)) continue;
      const beforeName = before === null ? null : `${entries.length}.bin`;
      if (beforeName) atomic(`${local}/backups/${id}/${beforeName}`, before);
      entries.push({ path: relative, before: beforeName, beforeHash: hash(before), afterHash: hash(value) });
    }
    if (!entries.length) return;
    const manifest = { id, label, date: new Date().toISOString(), state: 'pending', entries };
    atomic(`${local}/backups/${id}/manifest.json`, json(manifest));
    try {
      for (const entry of entries) atomic(entry.path, changes.get(entry.path));
      atomic(`${local}/backups/${id}/manifest.json`, json({ ...manifest, state: 'complete' }));
    } catch (error) {
      rollback(manifest);
      atomic(`${local}/backups/${id}/manifest.json`, json({ ...manifest, state: 'rolled-back' }));
      throw error;
    }
  }
  function catalog() {
    const list = read('data/articles.json', []);
    if (!Array.isArray(list)) fail('Le catalogue des articles est invalide.', 422);
    return list;
  }
  function articleFile(slug, status) {
    if (!slugPattern.test(slug) || slug.length > 100) fail('Adresse de l’article invalide.');
    return status === 'draft' ? `${local}/drafts/${slug}.json` : `data/articles/${slug}.json`;
  }
  function getArticle(slug) {
    const publishedFile = articleFile(slug, 'published');
    const draftFile = articleFile(slug, 'draft');
    const published = bytes(publishedFile);
    const draft = bytes(draftFile);
    if (published && draft) fail(`Deux versions existent pour ${slug}. Vérifiez les fichiers avant de continuer.`, 409);
    const raw = published || draft;
    if (!raw) fail('Article introuvable.', 404);
    return { ...read(published ? publishedFile : draftFile), slug, status: published ? 'published' : 'draft', revision: hash(raw) };
  }
  function articleNames() {
    const names = new Set();
    for (const folder of ['data/articles', `${local}/drafts`]) {
      if (!fs.existsSync(file(folder))) continue;
      for (const item of fs.readdirSync(file(folder))) if (/^[-a-z0-9]+\.json$/i.test(item)) names.add(item.slice(0, -5));
    }
    return [...names];
  }
  function listArticles() {
    return articleNames().map(slug => {
      const { content, ...article } = getArticle(slug);
      return { ...article, blocks: content?.length || 0 };
    }).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }
  function mediaPath(value, optional = true) {
    if (optional && value === '') return '';
    if (typeof value !== 'string' || !mediaPattern.test(value) || !bytes(value)) fail('Sélectionnez une image existante dans la médiathèque.');
    return value;
  }
  function validateArticle(input) {
    if (!input || !Array.isArray(input.content) || input.content.length > 500) fail('Le contenu doit comporter au maximum 500 blocs.');
    const article = {
      slug: text(input.slug, 'Adresse', 100, true),
      title: text(input.title, 'Titre', 250, true).trim(),
      author: text(input.author, 'Auteur', 150, true).trim(),
      date: text(input.date, 'Date', 30, true),
      excerpt: text(input.excerpt, 'Résumé', 1000),
      image: mediaPath(input.image),
      featured: input.featured === true,
      important: input.featured === true,
      category: text(input.category ?? '', 'Catégorie', 80).trim(),
      tags: (() => {
        if (!Array.isArray(input.tags ?? [] ) || (input.tags ?? []).length > 20) fail('Ajoutez au maximum 20 mots-clés.');
        return [...new Set((input.tags ?? []).map(tag => text(tag, 'Mot-clé', 60, true).trim()))];
      })(),
      content: input.content.map((block, i) => {
        const label = `Bloc ${i + 1}`;
        if (!block || typeof block !== 'object') fail(`${label} invalide.`);
        const format = block.format === 'markdown' ? 'markdown' : 'plain';
        switch (block.type) {
          case 'paragraph': return { type: block.type, text: text(block.text, label), format };
          case 'heading':
            if (![2, 3, 4].includes(block.level)) fail(`${label} : niveau de titre invalide.`);
            return { type: block.type, level: block.level, text: text(block.text, label, 500, true), format };
          case 'image': return { type: block.type, src: mediaPath(block.src, false), alt: text(block.alt, label, 1000), caption: text(block.caption, label, 2000) };
          case 'gallery':
            if (!Array.isArray(block.images) || block.images.length < 1 || block.images.length > 50) fail(`${label} : choisissez entre 1 et 50 images.`);
            return { type: block.type, images: block.images.map(image => {
              if (!image || typeof image !== 'object') fail(`${label} : image invalide.`);
              return { src: mediaPath(image.src, false), alt: text(image.alt, label, 1000), caption: text(image.caption, label, 2000) };
            }) };
          case 'quote': return { type: block.type, text: text(block.text, label), author: text(block.author, label, 200), format };
          case 'list':
            if (!Array.isArray(block.items) || block.items.length > 300) fail(`${label} : liste invalide.`);
            return { type: block.type, items: block.items.map(item => text(item, label)), ordered: block.ordered === true, format };
          default: fail(`${label} : type non pris en charge.`);
        }
      })
    };
    articleFile(article.slug, 'published');
    if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(article.date) || !Number.isFinite(Date.parse(article.date))) fail('Date invalide.');
    if (!['published', 'draft'].includes(input.status)) fail('État de l’article invalide.');
    return article;
  }
  function saveArticle(input, originalSlug = null) {
    const article = validateArticle(input);
    const names = articleNames();
    if (!originalSlug && names.some(name => name.toLowerCase() === article.slug.toLowerCase())) fail('Cette adresse est déjà utilisée. Choisissez-en une autre.', 409);
    if (originalSlug) {
      if (originalSlug !== article.slug) fail('L’adresse d’un article enregistré ne peut pas être changée.');
      const previous = getArticle(originalSlug);
      if (input.revision !== previous.revision) fail('Cet article a été modifié ailleurs. Votre saisie est conservée : rechargez la version enregistrée avant de recommencer.', 409);
    }
    const changes = new Map();
    const target = articleFile(article.slug, input.status);
    const other = articleFile(article.slug, input.status === 'draft' ? 'published' : 'draft');
    changes.set(target, json(article));
    if (bytes(other)) changes.set(other, null);
    let list = catalog().filter(item => item.slug !== article.slug);
    if (input.status === 'published') {
      if (article.featured) {
        for (const entry of list.filter(item => item.featured || item.important)) {
          const previous = getArticle(entry.slug);
          const { status, revision, ...publicArticle } = previous;
          publicArticle.featured = publicArticle.important = false;
          changes.set(articleFile(entry.slug, 'published'), json(publicArticle));
        }
        list = list.map(item => ({ ...item, featured: false, important: false }));
      }
      const { content, ...entry } = article;
      list.push(entry);
    }
    list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    changes.set('data/articles.json', json(list));
    commit(`${originalSlug ? 'Modification' : 'Création'} : ${article.title}`, changes);
    return getArticle(article.slug);
  }
  function deleteArticle(slug, revision) {
    const article = getArticle(slug);
    if (revision !== article.revision) fail('Cet article a changé depuis son ouverture. Actualisez la liste.', 409);
    commit(`Suppression : ${article.title}`, new Map([
      [articleFile(slug, article.status), null],
      ['data/articles.json', json(catalog().filter(item => item.slug !== slug))]
    ]));
  }
  function getSettings() {
    const raw = bytes('data/site.json');
    return { ...aboutDefaults, ...read('data/site.json', {}), revision: hash(raw) };
  }
  function saveSettings(input) {
    if (input.revision !== getSettings().revision) fail('Les réglages ont changé. Actualisez cette page.', 409);
    const settings = {};
    for (const key of ['title', 'description', 'author', 'role', 'bio', 'footer', 'email', 'instagram', 'github']) {
      settings[key] = text(input[key], key, key === 'bio' ? 3000 : 500, ['title', 'author'].includes(key)).trim();
    }
    for (const key of Object.keys(aboutDefaults)) settings[key] = text(input[key] ?? aboutDefaults[key], key, key === 'siteUrl' ? 500 : 10000).trim();
    try {
      const url = new URL(settings.siteUrl);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error();
      settings.siteUrl = url.href.endsWith('/') ? url.href : `${url.href}/`;
    } catch { fail('L’adresse du site doit être une URL HTTPS sans paramètres.'); }
    if (settings.email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(settings.email)) fail('Adresse email invalide.');
    for (const key of ['instagram', 'github']) {
      if (settings[key] && !/^https:\/\//i.test(settings[key])) fail('Les liens doivent commencer par https://.');
      if (settings[key]) { try { new URL(settings[key]); } catch { fail('Lien invalide.'); } }
    }
    settings.avatar = mediaPath(input.avatar, false);
    settings.favicon = mediaPath(input.favicon, false);
    commit('Réglages du blog', new Map([['data/site.json', json(settings)]]));
    return getSettings();
  }
  function references(media, articles = articleNames().map(getArticle), settings = getSettings()) {
    const result = [];
    for (const article of articles) {
      if (article.image === media || article.content?.some(block => block.src === media || block.images?.some(image => image.src === media))) result.push(`${article.title}${article.status === 'draft' ? ' (brouillon)' : ''}`);
    }
    if (settings.avatar === media) result.push('Portrait de l’auteur');
    if (settings.favicon === media) result.push('Icône du blog');
    // Les fichiers HTML gardent un visuel de secours avant le chargement des réglages.
    for (const name of ['index.html', 'article.html', 'articles.html', 'a-propos.html', 'components/header.html', 'components/footer.html']) {
      const source = bytes(name)?.toString('utf8');
      if (source?.includes(media) && !result.includes('Visuel de secours du site')) result.push('Visuel de secours du site');
    }
    return result;
  }
  function listMedia() {
    const result = [];
    const articles = articleNames().map(getArticle), settings = getSettings();
    function walk(folder) {
      if (!fs.existsSync(file(folder))) return;
      for (const entry of fs.readdirSync(file(folder), { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue;
        const relative = `${folder}/${entry.name}`;
        if (entry.isDirectory()) walk(relative);
        else if (mediaPattern.test(relative)) {
          const stat = fs.statSync(file(relative));
          result.push({ path: relative, name: entry.name, size: stat.size, modified: stat.mtime.toISOString(), revision: hash(bytes(relative)), usedBy: references(relative, articles, settings) });
        }
      }
    }
    walk('assets/images');
    return result.sort((a, b) => b.modified.localeCompare(a.modified));
  }
  function uploadMedia({ name, data, replace, revision }) {
    if (typeof name !== 'string' || typeof data !== 'string' || data.length > 28_000_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) fail('Image invalide ou trop volumineuse (20 Mo maximum).');
    const ext = path.extname(name).toLowerCase();
    const image = Buffer.from(data, 'base64');
    if (!image.length || image.length > 20 * 1024 * 1024) fail('Image vide ou trop volumineuse (20 Mo maximum).');
    const signature = image.subarray(0, 32);
    const valid = {
      '.png': signature.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      '.jpg': signature[0] === 255 && signature[1] === 216 && signature[2] === 255,
      '.jpeg': signature[0] === 255 && signature[1] === 216 && signature[2] === 255,
      '.gif': /^GIF8[79]a/.test(signature.toString()),
      '.webp': signature.toString('ascii', 0, 4) === 'RIFF' && signature.toString('ascii', 8, 12) === 'WEBP',
      '.ico': signature.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0])),
      '.avif': signature.toString('ascii', 4, 8) === 'ftyp' && /avif|avis/.test(signature.toString('ascii', 8)),
      '.svg': /^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(image.toString('utf8'))
    }[ext];
    if (!valid) fail('Format non reconnu. Utilisez JPG, PNG, WebP, GIF, AVIF, SVG ou ICO.');
    if (ext === '.svg' && /<\s*(?:script|foreignObject|iframe|object|embed|style|image|use)\b|\bon\w+\s*=|(?:href|src)\s*=|url\s*\(|<!|&(?:#|[a-z])/i.test(image.toString('utf8'))) fail('Ce SVG contient du contenu actif. Exportez une image PNG ou un SVG sans scripts ni liens.');
    const stem = slugify(path.basename(name, ext)) || 'image';
    let relative = `assets/images/${stem}${ext}`;
    if (replace) {
      mediaPath(replace, false);
      if (path.extname(replace).toLowerCase() !== ext) fail('Le remplacement doit conserver le même format de fichier.');
      if (hash(bytes(replace)) !== revision) fail('Cette image a changé. Actualisez la médiathèque.', 409);
      relative = replace;
    } else {
      let suffix = 2;
      while (bytes(relative)) relative = `assets/images/${stem}-${suffix++}${ext}`;
    }
    commit(`${replace ? 'Remplacement' : 'Import'} de l’image : ${path.basename(relative)}`, new Map([[relative, image]]));
    return { path: relative, name: path.basename(relative), size: image.length, modified: fs.statSync(file(relative)).mtime.toISOString(), revision: hash(image), usedBy: references(relative) };
  }
  function deleteMedia(relative, revision) {
    mediaPath(relative, false);
    if (hash(bytes(relative)) !== revision) fail('Cette image a changé. Actualisez la médiathèque.', 409);
    const usedBy = references(relative);
    if (usedBy.length) fail(`Cette image est utilisée : ${usedBy.join(', ')}. Remplacez-la ou retirez-la de ces contenus avant de la supprimer.`, 409);
    commit(`Suppression de l’image : ${path.basename(relative)}`, new Map([[relative, null]]));
  }
  function history() {
    return manifests().filter(m => m.state === 'complete').map(m => ({ id: m.id, label: m.label, date: m.date,
      files: m.entries.map(e => e.path), canRestore: m.entries.every(e => allowed(e.path) && hash(bytes(e.path)) === e.afterHash) }));
  }
  function restore(id) {
    const manifest = manifests().find(item => item.id === id && item.state === 'complete');
    if (!manifest) fail('Sauvegarde introuvable.', 404);
    if (!manifest.entries.every(e => allowed(e.path) && hash(bytes(e.path)) === e.afterHash)) fail('Des fichiers ont changé depuis cette opération. Annulez d’abord les opérations plus récentes qui les concernent.', 409);
    // Ne pas retirer une image qui a été réutilisée depuis son import.
    for (const entry of manifest.entries) {
      if (mediaPattern.test(entry.path) && entry.before === null && references(entry.path).length) fail('Cette image est maintenant utilisée. Retirez-la des articles ou des réglages avant d’annuler son import.', 409);
    }
    const changes = new Map(manifest.entries.map(e => [e.path, e.before === null ? null : bytes(`${local}/backups/${id}/${e.before}`)]));
    for (const entry of manifest.entries) {
      if (entry.before !== null && hash(changes.get(entry.path)) !== entry.beforeHash) fail('La sauvegarde est incomplète. Restauration annulée.', 422);
    }
    // Une ancienne version d’article doit retrouver ses images avant sa restauration.
    for (const [relative, value] of changes) {
      if (!value || !relative.endsWith('.json') || relative === 'data/articles.json') continue;
      const content = JSON.parse(value.toString('utf8'));
      const images = [content.image, content.avatar, content.favicon, ...(content.content || []).flatMap(b => [b.src, ...(b.images || []).map(image => image.src)])].filter(Boolean);
      for (const image of images) if (!(changes.has(image) ? changes.get(image) : bytes(image))) fail('Une image de cette sauvegarde manque. Restaurez d’abord l’image correspondante.', 409);
    }
    commit(`Restauration : ${manifest.label}`, changes);
  }
  return { root, file, bytes, catalog, getArticle, listArticles, saveArticle, deleteArticle, getSettings, saveSettings, listMedia, uploadMedia, deleteMedia, history, restore };
}
