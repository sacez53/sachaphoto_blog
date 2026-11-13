'use strict';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const esc = escapeHTML;
const state = { token: '', root: '', articles: [], media: [], settings: {}, editor: null, original: null,
  dirty: false, route: '', filter: 'all', search: '', mediaFilter: 'all', mediaSearch: '', picker: null, selectedMedia: null, saving: false };
const workspace = $('#workspace'), modal = $('#modal');
let dialogResolve = null, toastTimer, draftTimer, routeVersion = 0;
const formatSize = size => size >= 1048576 ? `${(size / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(size / 1024))} Ko`;
const localDate = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const slugify = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100).replace(/-$/, '');
const imageURL = value => '/' + value.split('/').map(encodeURIComponent).join('/');
const button = (action, label, extra = '', style = '') => `<button type="button" data-action="${action}" ${extra} class="${style}">${label}</button>`;

function toast(message, error = false) {
  clearTimeout(toastTimer);
  $('#notifications').innerHTML = `<div class="toast ${error ? 'error' : ''}"><span>${esc(message)}</span>${button('dismiss-toast', '×', 'aria-label="Fermer le message"')}</div>`;
  if (!error) toastTimer = setTimeout(() => { $('#notifications').innerHTML = ''; }, 6000);
}
async function api(endpoint, method = 'GET', data, retry = true) {
  let response;
  try {
    response = await new Promise((resolve, reject) => {
      let request, frame;
      try { request = new XMLHttpRequest(); }
      catch {
        frame = document.createElement('iframe');
        frame.hidden = true;
        frame.setAttribute('sandbox', 'allow-same-origin');
        document.body.appendChild(frame);
        request = new frame.contentWindow.XMLHttpRequest();
      }
      request.open(method, `/api/${endpoint}`, true);
      request.timeout = 60000;
      request.responseType = endpoint === 'export' ? 'blob' : 'json';
      if (method !== 'GET') {
        request.setRequestHeader('Content-Type', 'application/json');
        request.setRequestHeader('X-Blog-Token', state.token);
      }
      request.onload = () => { resolve({ status: request.status, response: request.response }); frame?.remove(); };
      request.onerror = request.ontimeout = request.onabort = () => { frame?.remove(); reject(new Error('Connexion interrompue')); };
      request.send(method === 'GET' ? null : JSON.stringify(data || {}));
    });
  } catch (error) {
    console.error('Connexion au gestionnaire impossible :', error);
    throw new Error('Le gestionnaire ne répond plus. Relancez gerer-blog.bat ; votre saisie reste dans ce navigateur.');
  }
  if (response.status === 403 && retry && method !== 'GET') {
    state.token = (await api('session')).token;
    return api(endpoint, method, data, false);
  }
  if (response.status < 200 || response.status >= 300) {
    let error = response.response || {};
    if (error instanceof Blob) { try { error = JSON.parse(await error.text()); } catch { error = {}; } }
    throw new Error(error.error || 'L’opération n’a pas pu aboutir.');
  }
  return response.response;
}
async function run(task) {
  try { return await task(); }
  catch (error) { toast(error.message, true); }
}
function openModal(html, className = '') {
  closeModal();
  modal.className = className;
  $('#modal-content').innerHTML = html;
  modal.showModal();
}
function closeModal(value = false) {
  modal.close();
  state.picker = null;
  if (dialogResolve) { const resolve = dialogResolve; dialogResolve = null; resolve(value); }
}
function ask(title, message, confirmLabel = 'Confirmer', danger = false) {
  openModal(`<div class="dialog-header"><h2 id="modal-title">${esc(title)}</h2></div><p class="dialog-copy">${esc(message)}</p><div class="dialog-footer">${button('cancel-dialog', 'Annuler')}${button('confirm-dialog', esc(confirmLabel), '', danger ? 'danger' : 'primary')}</div>`);
  return new Promise(resolve => { dialogResolve = resolve; });
}
modal.addEventListener('cancel', event => { event.preventDefault(); closeModal(); });
modal.addEventListener('click', event => { if (event.target === modal) { const r = modal.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeModal(); } });

function scratchKey(slug = state.original || 'new') { return `sachaphoto:${state.root}:article:${slug}`; }
function storeScratch() {
  clearTimeout(draftTimer);
  if (!state.editor || !state.dirty) return;
  try {
    localStorage.setItem(scratchKey(), JSON.stringify({ article: state.editor, at: new Date().toISOString() }));
    const label = $('#save-state');
    if (label) label.textContent = 'Saisie conservée dans ce navigateur · À enregistrer dans le blog';
  } catch {
    const label = $('#save-state');
    if (label) label.textContent = 'Saisie non sauvegardée · Enregistrez avant de fermer';
  }
}
function removeScratch(key) { try { localStorage.removeItem(key); } catch {} }
function markDirty() {
  state.dirty = true;
  const label = $('#save-state');
  if (label) label.textContent = 'Modifications non enregistrées';
  if (state.editor) { clearTimeout(draftTimer); draftTimer = setTimeout(storeScratch, 450); updateWordCount(); }
}
window.addEventListener('beforeunload', event => {
  if (state.dirty) { storeScratch(); event.preventDefault(); event.returnValue = ''; }
});
function pageHeading(eyebrow, title, description, actions = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div><div class="actions">${actions}</div></div>`;
}
function updateNav(route) {
  const group = route.startsWith('/edit') || route === '/new' ? 'articles' : route.split('/')[1];
  $$('[data-nav]').forEach(link => {
    if (link.dataset.nav === group) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  $('#article-count').textContent = state.articles.length;
}
async function route() {
  const next = location.hash.slice(1) || '/articles';
  if (next === state.route) return;
  if (state.dirty) {
    storeScratch();
    if (!await ask('Quitter cette page ?', state.editor ? 'Votre saisie est conservée dans ce navigateur. Elle n’est pas encore enregistrée dans les fichiers du blog.' : 'Les réglages modifiés n’ont pas été enregistrés.', 'Quitter')) {
      history.replaceState(null, '', `#${state.route}`); return;
    }
  }
  const version = ++routeVersion;
  state.route = next; state.dirty = false; state.editor = null; state.original = null;
  clearTimeout(draftTimer);
  workspace.innerHTML = '<div class="empty">Chargement…</div>';
  updateNav(next);
  try {
    if (next === '/articles') {
      state.articles = await api('articles'); if (version !== routeVersion) return;
      renderArticles();
    } else if (next === '/new' || next.startsWith('/edit/')) {
      state.settings = await api('settings');
      if (version !== routeVersion) return;
      state.original = next === '/new' ? null : decodeURIComponent(next.slice(6));
      state.editor = state.original ? await api(`articles/${encodeURIComponent(state.original)}`) : {
        slug: '', title: '', author: state.settings.author || 'Sacha G. Photographe', date: localDate(), excerpt: '', image: '',
        featured: false, status: 'draft', category: '', tags: [], content: [{ type: 'paragraph', text: '', format: 'markdown' }]
      };
      if (version !== routeVersion) return;
      let scratch;
      try { scratch = JSON.parse(localStorage.getItem(scratchKey())); } catch {}
      if (scratch?.article && await ask('Reprendre votre saisie ?', `Une saisie non enregistrée a été conservée le ${formatDate(scratch.at)}.`, 'Reprendre')) {
        state.editor = scratch.article; state.dirty = true;
      }
      renderEditor();
    } else if (next === '/media') {
      state.media = await api('media'); if (version !== routeVersion) return;
      renderMedia();
    } else if (next === '/settings') {
      state.settings = await api('settings'); if (version !== routeVersion) return;
      renderSettings();
    } else if (next === '/history') {
      const items = await api('history'); if (version !== routeVersion) return;
      renderHistory(items);
    } else { location.hash = '/articles'; return; }
    updateNav(next);
    window.scrollTo({ top: 0 });
  } catch (error) {
    workspace.innerHTML = `<div class="empty"><h2>Impossible d’ouvrir cette page</h2><p>${esc(error.message)}</p>${button('reload-page', 'Réessayer')}</div>`;
  }
}
window.addEventListener('hashchange', () => run(route));

function renderArticles() {
  const published = state.articles.filter(a => a.status === 'published').length;
  workspace.innerHTML = pageHeading('VOTRE JOURNAL', 'Les articles', 'Écrivez vos récits et retrouvez vos articles.',
    button('check-site', 'Vérifier le site') + button('export', 'Exporter le site') + button('new-article', '<span aria-hidden="true">＋</span> Nouvel article', '', 'primary')) +
    `<div class="stats"><div><strong>${published}</strong> article${published > 1 ? 's' : ''} dans le blog</div><div><strong>${state.articles.length - published}</strong> brouillon${state.articles.length - published > 1 ? 's' : ''}</div><span class="stats-note">Le contenu de votre blog, au même endroit.</span></div>
    <div class="filters"><div class="tabs" aria-label="Filtrer les articles">${[['all','Tous les articles'],['published','Dans le blog'],['draft','Brouillons']].map(([value,label]) => button('filter-articles', label, `data-value="${value}" aria-pressed="${state.filter === value}"`)).join('')}</div><label class="search"><span class="visually-hidden">Rechercher un article</span><input id="article-search" type="search" placeholder="Rechercher un article…" value="${esc(state.search)}"></label></div><div id="article-results"></div><p class="footnote">« Dans le blog » signifie que l’article est présent dans les fichiers du site. Les brouillons restent privés sur cet ordinateur.</p>`;
  renderArticleResults();
}
function renderArticleResults() {
  const articles = state.articles.filter(a => (state.filter === 'all' || a.status === state.filter) && `${a.title} ${a.excerpt} ${a.author}`.toLowerCase().includes(state.search.toLowerCase()));
  $('#article-results').innerHTML = articles.length ? `<div class="article-list">${articles.map(a => `<article class="article-row">
    ${a.image ? `<img class="article-thumbnail" src="${esc(imageURL(a.image))}" alt="" loading="lazy">` : '<div class="article-thumbnail no-image" aria-hidden="true">S.</div>'}
    <div><div class="actions"><span class="badge ${a.status === 'draft' ? 'draft' : ''}">${a.status === 'draft' ? 'Brouillon' : 'Dans le blog'}</span>${a.featured && a.status === 'published' ? '<span class="badge featured">À la une</span>' : ''}</div>
    <h2>${button('edit-article', esc(a.title), `data-slug="${esc(a.slug)}"`)}</h2><p>${esc(a.excerpt || 'Aucun résumé pour cet article.')}</p><div class="row-meta"><span>${esc(formatDate(a.date))}</span><span>·</span><span>${a.blocks} bloc${a.blocks > 1 ? 's' : ''}</span></div></div>
    <div class="row-actions"><div class="actions">${button('edit-article', 'Modifier', `data-slug="${esc(a.slug)}"`, 'small')}${button('duplicate-article', 'Dupliquer', `data-slug="${esc(a.slug)}"`, 'small')}</div>${button('delete-article', 'Supprimer', `data-slug="${esc(a.slug)}"`, 'text-button')}</div>
  </article>`).join('')}</div>` : `<div class="empty"><h2>${state.search || state.filter !== 'all' ? 'Aucun article ne correspond' : 'Votre prochain article commence ici'}</h2><p>${state.search || state.filter !== 'all' ? 'Essayez une autre recherche ou un autre filtre.' : 'Ajoutez un titre, puis construisez votre récit bloc par bloc.'}</p>${button('new-article', 'Créer un article', '', 'primary')}</div>`;
}
function newBlock(type) {
  if (type === 'heading') return { type, level: 2, text: '', format: 'markdown' };
  if (type === 'image') return { type, src: '', alt: '', caption: '' };
  if (type === 'gallery') return { type, images: [] };
  if (type === 'list') return { type, items: [''], ordered: false, format: 'markdown' };
  if (type === 'quote') return { type, text: '', author: '', format: 'markdown' };
  return { type: 'paragraph', text: '', format: 'markdown' };
}
function blockHTML(block, index) {
  const labels = { paragraph: 'Paragraphe', heading: 'Titre de section', image: 'Image', gallery: 'Galerie photo', list: 'Liste', quote: 'Citation' };
  const type = block.type;
  let body = '';
  if (type === 'image') {
    body = `${block.src ? `<img src="${esc(imageURL(block.src))}" alt="${esc(block.alt)}">` : ''}${button('block-image', block.src ? 'Changer l’image' : 'Choisir ou importer une image', `data-index="${index}"`, block.src ? 'small' : 'image-placeholder')}
      <label>Description de l’image<input data-block="${index}" data-prop="alt" value="${esc(block.alt)}" placeholder="Ce que montre la photo" maxlength="1000"></label><label>Légende <span class="muted">(facultatif)</span><input data-block="${index}" data-prop="caption" value="${esc(block.caption)}" maxlength="2000"></label>`;
  } else if (type === 'gallery') {
    body = `<p class="field-hint">Ajoutez jusqu’à 50 photos. Un clic sur une photo du blog l’ouvre en grand dans un nouvel onglet.</p><div class="gallery-editor">${(block.images || []).map((image, photo) => `<div class="gallery-entry"><img src="${esc(imageURL(image.src))}" alt=""><div><label>Description de la photo ${photo + 1}<input data-gallery="${index}" data-photo="${photo}" data-photo-field="alt" value="${esc(image.alt)}" maxlength="1000" placeholder="Ce que montre la photo"></label><label>Légende de la photo ${photo + 1}<input data-gallery="${index}" data-photo="${photo}" data-photo-field="caption" value="${esc(image.caption)}" maxlength="2000"></label><div class="actions">${button('gallery-up','↑',`data-index="${index}" data-photo="${photo}" aria-label="Monter la photo ${photo + 1}" ${photo === 0 ? 'disabled' : ''}`,'small')}${button('gallery-down','↓',`data-index="${index}" data-photo="${photo}" aria-label="Descendre la photo ${photo + 1}" ${photo === block.images.length - 1 ? 'disabled' : ''}`,'small')}${button('gallery-remove','Retirer',`data-index="${index}" data-photo="${photo}" aria-label="Retirer la photo ${photo + 1}"`,'small')}</div></div></div>`).join('')}</div>${button('gallery-add','＋ Ajouter une photo',`data-index="${index}"`, 'small')}`;
  } else {
    const value = type === 'list' ? block.items.join('\n') : block.text;
    body = `<div class="formatbar">${button('format-bold', '<b>G</b>', `data-index="${index}" aria-label="Mettre la sélection en gras"`)}${button('format-italic', '<i>I</i>', `data-index="${index}" aria-label="Mettre la sélection en italique"`)}${button('format-link', 'Lien', `data-index="${index}"`)}<span>Gras, italique et liens visibles dans l’aperçu</span></div>
      ${type === 'heading' ? `<label class="visually-hidden" for="level-${index}">Niveau du titre</label><select id="level-${index}" data-block="${index}" data-prop="level" class="field"><option value="2" ${block.level === 2 ? 'selected' : ''}>Titre de section (H2)</option><option value="3" ${block.level === 3 ? 'selected' : ''}>Sous-titre (H3)</option><option value="4" ${block.level === 4 ? 'selected' : ''}>Petit titre (H4)</option></select>` : ''}
      ${type === 'list' ? `<label class="check-label field"><input type="checkbox" data-block="${index}" data-prop="ordered" ${block.ordered ? 'checked' : ''}>Liste numérotée</label>` : ''}
      <label class="visually-hidden" for="block-text-${index}">${labels[type]} ${index + 1}</label><textarea id="block-text-${index}" data-block="${index}" data-prop="${type === 'list' ? 'items' : 'text'}" class="${type === 'heading' ? 'heading-text' : ''}" placeholder="${type === 'heading' ? 'Votre titre de section…' : type === 'list' ? 'Un élément par ligne…' : type === 'quote' ? 'Votre citation…' : 'Écrivez votre paragraphe…'}" maxlength="${type === 'heading' ? 500 : 20000}">${esc(value)}</textarea>
      ${type === 'quote' ? `<label>Auteur de la citation <span class="muted">(facultatif)</span><input data-block="${index}" data-prop="author" value="${esc(block.author)}" maxlength="200"></label>` : ''}`;
  }
  return `<section class="block" data-block-card="${index}" aria-label="${labels[type]} ${index + 1}"><div class="block-head"><div class="block-type"><span>${String(index + 1).padStart(2,'0')}</span><label class="visually-hidden" for="block-type-${index}">Type du bloc ${index + 1}</label><select id="block-type-${index}" data-block="${index}" data-prop="type">${Object.entries(labels).map(([value,label]) => `<option value="${value}" ${type === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div class="block-controls">${button('block-up', '↑', `data-index="${index}" aria-label="Monter le bloc ${index + 1}" ${index === 0 ? 'disabled' : ''}`)}${button('block-down', '↓', `data-index="${index}" aria-label="Descendre le bloc ${index + 1}" ${index === state.editor.content.length - 1 ? 'disabled' : ''}`)}${button('block-copy', '⧉', `data-index="${index}" aria-label="Dupliquer le bloc ${index + 1}"`)}${button('block-delete', '×', `data-index="${index}" aria-label="Supprimer le bloc ${index + 1}"`)}</div></div><div class="block-body">${body}</div></section>`;
}
function renderEditor() {
  const a = state.editor;
  workspace.innerHTML = `<a class="back-link" href="#/articles">← Tous les articles</a><div class="page-heading editor-heading"><div><h1>${state.original ? 'Modifier l’article' : 'Nouvel article'}</h1><div class="save-state" id="save-state">${state.dirty ? 'Saisie récupérée · Modifications non enregistrées' : state.original ? 'Toutes les modifications sont enregistrées' : 'Un espace pour votre prochain récit'}</div></div><div class="actions">${button('preview', 'Aperçu')}${button('save-article', 'Enregistrer', '', 'primary')}</div></div>
    <div class="editor-grid"><div><div class="panel"><label class="field">Titre de l’article<input class="title-input" id="article-title" data-field="title" value="${esc(a.title)}" placeholder="Donnez un titre à votre récit" maxlength="250" required></label><label class="field">Résumé<textarea data-field="excerpt" placeholder="Quelques lignes pour donner envie de lire l’article…" maxlength="1000">${esc(a.excerpt)}</textarea></label><p class="field-hint">Le résumé apparaît sur l’accueil et dans la liste des articles.</p></div>
    <div class="editor-content-title"><h2>Le contenu</h2><span>Construisez votre article par blocs</span></div><div id="blocks"></div><div class="add-block"><span>AJOUTER À VOTRE RÉCIT</span><div class="actions">${[['paragraph','＋ Paragraphe'],['heading','Titre de section'],['image','Image'],['gallery','Galerie photo'],['list','Liste'],['quote','Citation']].map(([value,label]) => button('add-block', label, `data-type="${value}"`)).join('')}</div></div><div id="word-count" class="word-count"></div></div>
    <aside class="editor-aside"><div class="panel"><h2>Enregistrement</h2><label class="field">Présence sur le site<select data-field="status"><option value="draft" ${a.status === 'draft' ? 'selected' : ''}>Brouillon privé</option><option value="published" ${a.status === 'published' ? 'selected' : ''}>Dans le blog</option></select></label><label class="field">Date de l’article<input type="datetime-local" data-field="date" value="${esc(a.date.slice(0,16).length === 10 ? a.date + 'T12:00' : a.date.slice(0,16))}" required></label><label class="field">Auteur<input data-field="author" value="${esc(a.author)}" maxlength="150" required></label><label class="check-label"><input type="checkbox" data-field="featured" ${a.featured ? 'checked' : ''}>Mettre à la une</label><p class="field-hint">Un seul article à la une. Le précédent restera dans la liste des articles.</p></div>
    <div class="panel"><h2>Image de couverture</h2><div id="cover-preview">${coverHTML(a.image)}</div><div class="actions">${button('choose-cover', 'Choisir une image', '', 'small')}${button('remove-cover', 'Retirer', `id="remove-cover" ${!a.image ? 'disabled' : ''}`, 'small')}</div><p class="field-hint">Choisissez une photo de la médiathèque ou importez-la depuis votre ordinateur.</p></div>
    <div class="panel"><h2>Classement et partage</h2><label class="field">Catégorie<input data-field="category" value="${esc(a.category || '')}" maxlength="80" placeholder="Photographie animalière"></label><label class="field">Mots-clés<input data-field="tags" value="${esc((a.tags || []).join(', '))}" placeholder="nature, forêt, photographie"></label><p class="field-hint">Séparez les mots-clés par une virgule.</p>${button('share-preview','Aperçu du partage','','small')}</div>
    <div class="panel"><label>Adresse de l’article<input id="article-slug" data-field="slug" value="${esc(a.slug)}" pattern="[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*" ${state.original ? 'readonly' : ''} maxlength="100" placeholder="mon-article"></label><p class="field-hint">${state.original ? 'Cette adresse reste fixe pour conserver les liens vers votre article.' : 'Générée à partir du titre. Vous pouvez la modifier avant le premier enregistrement.'}</p>${button('discard-editor', 'Abandonner les modifications', '', 'text-button')}</div>
    <p class="tip"><strong>Un titre au milieu du texte ?</strong><br>Ajoutez un bloc « Titre de section ». Utilisez les flèches pour le placer avant le paragraphe concerné.</p></aside></div>`;
  renderBlocks(); updateWordCount();
}
function coverHTML(value) { return value ? `<img class="cover" src="${esc(imageURL(value))}" alt="Image de couverture">` : '<div class="cover cover-placeholder">Votre image de couverture</div>'; }
function renderBlocks(focusIndex = null) {
  $('#blocks').innerHTML = state.editor.content.map(blockHTML).join('');
  $$('#blocks textarea').forEach(autosize);
  if (focusIndex !== null) {
    const block = $(`[data-block-card="${focusIndex}"]`);
    block?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    $('textarea, input, .image-placeholder', block)?.focus({ preventScroll: true });
  }
}
function autosize(element) { if (element.tagName === 'TEXTAREA' && element.dataset.block) { element.style.height = 'auto'; element.style.height = Math.min(700, Math.max(45, element.scrollHeight)) + 'px'; } }
function updateWordCount() {
  if (!state.editor || !$('#word-count')) return;
  const words = state.editor.content.map(b => b.text || (b.items || []).join(' ')).join(' ').trim().split(/\s+/).filter(Boolean).length;
  $('#word-count').textContent = `${words} mot${words > 1 ? 's' : ''} · Environ ${Math.max(1,Math.ceil(words/220))} min de lecture`;
}
async function saveArticle() {
  if (state.saving) return;
  if (!state.editor.title.trim()) { $('#article-title').focus(); throw new Error('Donnez un titre à votre article.'); }
  if (!state.editor.slug.trim()) { $('#article-slug').focus(); throw new Error('Renseignez l’adresse de votre article.'); }
  const invalid = $$('input, select, textarea', workspace).find(element => !element.checkValidity());
  if (invalid) { invalid.reportValidity(); invalid.focus(); return; }
  state.saving = true; workspace.inert = true;
  const key = scratchKey();
  try {
    const article = await api(state.original ? `articles/${encodeURIComponent(state.original)}` : 'articles', state.original ? 'PUT' : 'POST', state.editor);
    removeScratch(key); state.editor = article; state.original = article.slug; state.dirty = false;
    state.route = `/edit/${article.slug}`;
    history.replaceState(null, '', `#${state.route}`);
    state.articles = await api('articles');
    renderEditor(); updateNav(state.route);
    toast(article.status === 'draft' ? 'Brouillon enregistré sur cet ordinateur.' : 'Article enregistré dans les fichiers du blog.');
  } finally { state.saving = false; workspace.inert = false; }
}
function preview() {
  const a = state.editor;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><base href="${location.origin}/"><link rel="stylesheet" href="assets/css/style.css"><style>body{padding:32px 0}.article-header p{text-align:left}.preview-label{font:11px system-ui;color:#68716b;letter-spacing:2px;margin-bottom:30px}</style></head><body><main class="container"><div class="preview-label">APERÇU · ${esc(state.settings.title)}</div>${a.image ? `<div class="article-hero"><img src="${esc(a.image)}" alt=""></div>` : ''}<header class="article-header"><h1>${esc(a.title || 'Votre titre')}</h1><p class="meta">${esc(a.author)} · ${renderDate(a.date)}</p></header><article class="article-content">${renderContentBlocks(a.content)}</article></main></body></html>`;
  $('#preview-frame').srcdoc = html;
  $('#preview-dialog').showModal();
}

function renderMedia() {
  workspace.innerHTML = pageHeading('VOTRE COLLECTION', 'La médiathèque', 'Les images de vos articles et les visuels de votre blog.', button('upload', '＋ Importer des images', '', 'primary')) +
    `<div class="dropzone" id="media-drop"><div><strong>Glissez vos images ici</strong><p>JPG, PNG, WebP, GIF, AVIF, SVG ou ICO · 20 Mo par fichier<br>Les images sont copiées dans le dossier du blog.</p></div>${button('upload', 'Choisir des fichiers')}</div><div class="filters"><div class="tabs">${[['all','Toutes les images'],['used','Utilisées'],['unused','Non utilisées']].map(([value,label]) => button('filter-media',label,`data-value="${value}" aria-pressed="${state.mediaFilter === value}"`)).join('')}</div><label class="search"><span class="visually-hidden">Rechercher une image</span><input id="media-search" type="search" placeholder="Rechercher une image…" value="${esc(state.mediaSearch)}"></label></div><div id="media-results"></div><p class="footnote">Remplacer une image conserve son adresse et actualise tous les endroits qui l’utilisent.</p>`;
  renderMediaResults();
}
function mediaCards(items, picker = false) {
  return items.map(item => `<article class="media-card"><button class="media-thumb-button" data-action="${picker ? 'pick-image' : 'media-detail'}" data-path="${esc(item.path)}" aria-label="${picker ? 'Choisir' : 'Gérer'} ${esc(item.name)}"><img loading="lazy" src="${esc(imageURL(item.path))}?v=${item.revision.slice(0,10)}" alt="${esc(item.name)}"></button><div class="media-info"><h3 title="${esc(item.name)}">${esc(item.name)}</h3><p><span>${formatSize(item.size)}</span><span class="${item.usedBy.length ? 'used' : ''}">${item.usedBy.length ? 'Utilisée' : 'Non utilisée'}</span></p></div></article>`).join('');
}
function renderMediaResults() {
  const items = state.media.filter(m => m.name.toLowerCase().includes(state.mediaSearch.toLowerCase()) && (state.mediaFilter === 'all' || (state.mediaFilter === 'used' ? m.usedBy.length : !m.usedBy.length)));
  $('#media-results').innerHTML = items.length ? `<div class="media-grid">${mediaCards(items)}</div>` : '<div class="empty"><h2>Aucune image dans cette sélection</h2><p>Importez une image ou changez les filtres.</p></div>';
}
async function chooseImage(callback) {
  state.media = await api('media');
  openModal(`<div class="dialog-header"><h2 id="modal-title">Choisir une image</h2>${button('cancel-dialog', 'Fermer')}</div><div class="filters"><label class="search"><span class="visually-hidden">Rechercher dans la médiathèque</span><input id="picker-search" type="search" placeholder="Rechercher une image…"></label>${button('upload', 'Importer une image', '', 'primary')}</div><div id="picker-results" class="media-grid picker-grid"></div><p class="field-hint">Cliquez sur une image pour l’insérer.</p>`);
  state.picker = callback;
  renderPicker();
}
function renderPicker() {
  const query = $('#picker-search')?.value.toLowerCase() || '';
  const items = state.media.filter(m => m.name.toLowerCase().includes(query));
  $('#picker-results').innerHTML = items.length ? mediaCards(items,true) : '<p class="muted">Aucune image. Vous pouvez en importer une.</p>';
}
function mediaDetail(relative) {
  const item = state.media.find(m => m.path === relative);
  if (!item) return;
  state.selectedMedia = item;
  openModal(`<div class="dialog-header"><h2 id="modal-title">${esc(item.name)}</h2>${button('cancel-dialog', 'Fermer')}</div><img class="media-detail-image" src="${esc(imageURL(item.path))}?v=${item.revision}" alt="${esc(item.name)}"><div class="media-details"><p>${formatSize(item.size)} · ${esc(item.path)}</p><h3>Utilisation</h3>${item.usedBy.length ? `<ul>${item.usedBy.map(name => `<li>${esc(name)}</li>`).join('')}</ul>` : '<p>Cette image n’est utilisée dans aucun article ni réglage.</p>'}</div><div class="dialog-footer">${button('delete-image', 'Supprimer', item.usedBy.length ? 'disabled title="Cette image est utilisée"' : '', 'danger')}${button('copy-path', 'Copier le chemin')}${button('replace-image', 'Remplacer l’image', '', 'primary')}</div><p class="field-hint">Le remplacement conserve le nom et le format du fichier. L’ancienne image reste dans les sauvegardes.</p>`);
}
async function uploadFiles(files, replace = null) {
  if (!files.length) return;
  const results = [], errors = [];
  const uploadButtons = $$('[data-action="upload"], [data-action="replace-image"]');
  uploadButtons.forEach(b => { b.disabled = true; });
  try {
    for (const [index, file] of [...files].entries()) {
      try {
        if (file.size > 20 * 1024 * 1024) throw new Error('20 Mo maximum par fichier.');
        toast(`Import de ${file.name} (${index + 1}/${files.length})…`);
        const data = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = () => reject(new Error('Lecture impossible.')); reader.readAsDataURL(file); });
        results.push(await api('media', 'POST', { name: file.name, data, ...(replace ? { replace: replace.path, revision: replace.revision } : {}) }));
      } catch (error) { errors.push(`${file.name} : ${error.message}`); }
    }
    state.media = await api('media');
    if (state.picker) renderPicker();
    else if (state.route === '/media') { renderMedia(); if (replace && results.length) mediaDetail(replace.path); }
    if (errors.length) toast(`${results.length ? `${results.length} image(s) importée(s). ` : ''}${errors.join(' ')}`, true);
    else toast(replace ? 'Image remplacée. Les articles utilisent maintenant la nouvelle version.' : `${results.length} image${results.length > 1 ? 's' : ''} ajoutée${results.length > 1 ? 's' : ''} à la médiathèque.`);
  } finally { uploadButtons.forEach(b => { b.disabled = false; }); }
}

function renderSettings() {
  const s = state.settings;
  const field = (key,label,limit=500,type='text') => `<label class="field">${label}<input type="${type}" data-setting="${key}" value="${esc(s[key])}" maxlength="${limit}" ${['title','author'].includes(key) ? 'required' : ''}></label>`;
  workspace.innerHTML = pageHeading('L’IDENTITÉ DU SITE', 'Le blog', 'Vos textes de présentation et les visuels qui signent votre blog.', button('save-settings','Enregistrer les réglages','','primary')) +
    `<div class="settings-grid"><div><section class="panel"><h2>Identité et présentation</h2>${field('title','Nom du blog')}<label class="field">Description du blog<textarea data-setting="description" maxlength="500">${esc(s.description)}</textarea></label><div class="form-grid">${field('author','Nom de l’auteur')}${field('role','Rôle ou activité')}</div><label class="field">Présentation dans la fiche auteur<textarea data-setting="bio" maxlength="3000">${esc(s.bio)}</textarea></label>${field('footer','Texte du pied de page')}${field('siteUrl','Adresse publique du blog',500,'url')}<p class="field-hint">Cette adresse est utilisée pour les liens de partage. Elle doit commencer par https://.</p></section><section class="panel"><h2>Page À propos</h2>${field('aboutTitle','Titre de la page')}${field('aboutSubtitle','Sous-titre')}<label class="field">Présentation<textarea data-setting="aboutIntro" maxlength="10000">${esc(s.aboutIntro)}</textarea></label>${field('aboutJourneyTitle','Titre du parcours')}<label class="field">Parcours<textarea data-setting="aboutJourney" maxlength="10000">${esc(s.aboutJourney)}</textarea></label>${field('aboutContactTitle','Titre du contact')}<label class="field">Texte de contact<textarea data-setting="aboutContact" maxlength="10000">${esc(s.aboutContact)}</textarea></label><p class="field-hint">Séparez les paragraphes par une ligne vide. Le portrait et les liens se règlent sur cette page.</p><a class="button small" href="/a-propos.html" target="_blank" rel="noopener">Voir la page enregistrée ↗</a></section><section class="panel"><h2>Liens de contact</h2>${field('email','Adresse email',500,'email')}${field('instagram','Lien Instagram',500,'url')}${field('github','Lien des projets',500,'url')}<p class="field-hint">Ces liens sont affichés sur la page À propos. Laissez un champ vide pour masquer le lien correspondant.</p></section></div>
    <div><section class="panel"><h2>Les visuels du blog</h2><div class="settings-images"><div><label>Portrait de l’auteur</label><img id="setting-avatar-preview" src="${esc(imageURL(s.avatar))}" alt="Portrait actuel">${button('setting-image','Changer le portrait','data-key="avatar"')}</div><div><label>Icône du navigateur</label><img id="setting-favicon-preview" src="${esc(imageURL(s.favicon))}" alt="Icône actuelle">${button('setting-image','Changer l’icône','data-key="favicon"')}</div></div><p class="field-hint">Le portrait est utilisé dans la fiche auteur et sur la page À propos. Pour l’icône, choisissez une image carrée.</p></section><section class="panel"><h2>Préparer la mise en ligne</h2><p class="field-hint">Téléchargez les fichiers publics du blog dans une archive ZIP. Les brouillons, le gestionnaire et les sauvegardes restent sur cet ordinateur.</p><div class="actions" style="margin-top:18px">${button('export','Exporter le site')}</div><div class="about-preview">Enregistrer met à jour les fichiers locaux. L’archive peut ensuite être envoyée à votre hébergeur.</div></section></div></div>`;
}
function renderHistory(items) {
  workspace.innerHTML = pageHeading('VOS VERSIONS PRÉCÉDENTES', 'Les sauvegardes', 'Chaque enregistrement conserve les fichiers avant leur modification.', button('reload-page','Actualiser')) +
    (items.length ? `<div class="history-list">${items.map(item => `<article class="history-row"><div><h3>${esc(item.label)}</h3><p>${esc(formatDate(item.date))} · ${item.files.length} fichier${item.files.length > 1 ? 's' : ''}</p><details><summary>Voir les fichiers concernés</summary><ul>${item.files.map(file => `<li>${esc(file)}</li>`).join('')}</ul></details></div><div class="actions">${item.canRestore ? button('restore','Annuler cette opération',`data-id="${esc(item.id)}"`,'small') : '<span class="history-hint">Des fichiers ont été modifiés depuis cette opération.</span>'}</div></article>`).join('')}</div>` : '<div class="empty"><h2>Votre historique commencera au premier enregistrement</h2><p>Les versions précédentes des articles et des images seront conservées ici.</p></div>') +
    '<p class="footnote">Une restauration crée elle aussi une sauvegarde. Pour revenir plus loin, annulez d’abord les opérations récentes sur les mêmes fichiers.</p>';
}

async function showSiteCheck(forExport = false) {
  const report = await api('check');
  const errors = report.issues.filter(issue => issue.severity === 'error').length;
  const warnings = report.issues.length - errors;
  const list = report.issues.length ? report.issues.map(issue => `<div class="check-item ${issue.severity === 'error' ? 'error' : ''}"><strong>${issue.severity === 'error' ? 'À corriger' : 'À vérifier'} · ${esc(issue.title)}</strong><span>${esc(issue.detail)}</span>${issue.slug && state.articles.some(a => a.slug === issue.slug) ? ` ${button('check-edit','Ouvrir l’article',`data-slug="${esc(issue.slug)}"`,'small')}` : ''}</div>`).join('') : '<p>Aucun problème détecté dans les points vérifiés.</p>';
  openModal(`<div class="dialog-header"><h2 id="modal-title">Vérification du site</h2>${button('cancel-dialog','Fermer')}</div><p class="dialog-copy">${report.published} article(s) dans le blog · ${report.drafts} brouillon(s) · ${errors} erreur(s) · ${warnings} point(s) à vérifier</p><div class="check-results">${list}</div><p class="field-hint">Contrôle des articles enregistrés, des images locales et des descriptions. Les liens externes ne sont pas vérifiés (${report.externalLinks} repéré(s)). Les brouillons ne sont pas exportés.</p>${forExport ? `<div class="dialog-footer">${button('cancel-dialog','Revenir')}${button('export-confirmed',report.issues.length ? 'Exporter quand même' : 'Exporter le site','','primary')}</div>` : ''}`);
}

document.addEventListener('input', event => {
  const target = event.target;
  if (target.id === 'article-search') { state.search = target.value; renderArticleResults(); }
  if (target.id === 'media-search') { state.mediaSearch = target.value; renderMediaResults(); }
  if (target.id === 'picker-search') renderPicker();
  if (target.dataset.field && state.editor) {
    const key = target.dataset.field;
    const oldSlug = slugify(state.editor.title);
    state.editor[key] = key === 'tags' ? target.value.split(',').map(value => value.trim()).filter(Boolean) : target.type === 'checkbox' ? target.checked : target.value;
    if (key === 'title' && !state.original && (!state.editor.slug || state.editor.slug === oldSlug)) {
      state.editor.slug = slugify(target.value); $('#article-slug').value = state.editor.slug;
    }
    markDirty();
  }
  if (target.dataset.block !== undefined && state.editor && target.dataset.prop !== 'type') {
    const block = state.editor.content[Number(target.dataset.block)], key = target.dataset.prop;
    block[key] = key === 'items' ? target.value.split('\n') : key === 'level' ? Number(target.value) : target.type === 'checkbox' ? target.checked : target.value;
    autosize(target); markDirty();
  }
  if (target.dataset.gallery !== undefined && state.editor) {
    state.editor.content[Number(target.dataset.gallery)].images[Number(target.dataset.photo)][target.dataset.photoField] = target.value;
    markDirty();
  }
  if (target.dataset.setting) { state.settings[target.dataset.setting] = target.value; markDirty(); }
});
document.addEventListener('change', event => {
  const target = event.target;
  if (target.dataset.prop === 'type' && state.editor) {
    const index = Number(target.dataset.block), previous = state.editor.content[index];
    if (previous.type === 'gallery' && previous.images.length) { target.value = 'gallery'; toast('Retirez les photos avant de changer le type de ce bloc.', true); return; }
    const next = newBlock(target.value);
    const text = previous.text || previous.items?.join('\n') || previous.caption || '';
    if ('text' in next) next.text = text;
    if (next.type === 'list') next.items = text.split('\n');
    if (next.type === 'image') next.caption = text;
    if (next.type === 'gallery' && previous.type === 'image' && previous.src) next.images.push({src:previous.src,alt:previous.alt,caption:previous.caption});
    state.editor.content[index] = next;
    markDirty(); renderBlocks(index);
  }
  if (target.id === 'upload-input') { run(() => uploadFiles([...target.files])); target.value = ''; }
  if (target.id === 'replace-input') { const files = [...target.files]; target.value = ''; run(() => uploadFiles(files, state.selectedMedia)); }
});
document.addEventListener('dragover', event => {
  if (event.target.closest('#media-drop')) { event.preventDefault(); $('#media-drop').classList.add('dragover'); }
});
document.addEventListener('dragleave', event => { if (event.target.id === 'media-drop') event.target.classList.remove('dragover'); });
document.addEventListener('drop', event => {
  if (state.route === '/media') { event.preventDefault(); $('#media-drop')?.classList.remove('dragover'); run(() => uploadFiles([...event.dataTransfer.files])); }
});
document.addEventListener('mousedown', event => { if (event.target.closest('[data-action^="format-"]')) event.preventDefault(); });

document.addEventListener('click', event => {
  const control = event.target.closest('[data-action]');
  if (!control || control.disabled || control.dataset.pending) return;
  event.preventDefault();
  const { action, index, slug, value } = control.dataset;
  run(async () => {
    control.dataset.pending = 'true';
    try {
      if (action === 'dismiss-toast') { $('#notifications').innerHTML = ''; return; }
      if (action === 'cancel-dialog') { closeModal(); return; }
      if (action === 'confirm-dialog') { closeModal(true); return; }
      if (action === 'new-article') { location.hash = '/new'; return; }
      if (action === 'edit-article') { location.hash = `/edit/${slug}`; return; }
      if (action === 'reload-page') { state.route = ''; await route(); return; }
      if (action === 'filter-articles') { state.filter = value; renderArticles(); return; }
      if (action === 'filter-media') { state.mediaFilter = value; renderMedia(); return; }
      if (action === 'save-article') { await saveArticle(); return; }
      if (action === 'preview') { preview(); return; }
      if (action === 'share-preview') {
        const a = state.editor;
        const base = state.settings.siteUrl || 'https://sacez53.github.io/sachaphoto_blog/';
        const shareURL = `${base.endsWith('/') ? base : base + '/'}partage/${encodeURIComponent(a.slug || 'adresse-de-l-article')}/`;
        openModal(`<div class="dialog-header"><h2 id="modal-title">Aperçu du partage</h2>${button('cancel-dialog','Fermer')}</div><p class="dialog-copy">Voici un aperçu indicatif. La présentation varie selon le réseau social.</p><div class="share-card">${a.image ? `<img src="${esc(imageURL(a.image))}" alt="">` : '<div class="share-placeholder">Ajoutez une image de couverture</div>'}<div class="share-copy"><span>${esc(base)}</span><h3>${esc(a.title || 'Titre de votre article')}</h3><p>${esc(a.excerpt || 'Ajoutez un résumé pour présenter votre article.')}</p></div></div><p class="field-hint">Lien à partager après la mise en ligne : <span class="share-url">${esc(shareURL)}</span></p><p class="field-hint">L’export du site crée une page de partage pour chaque article publié. Les brouillons restent privés.</p><div class="dialog-footer">${button('copy-share','Copier le lien','','primary')}</div>`);
        state.shareURL = shareURL; return;
      }
      if (action === 'copy-share') { await navigator.clipboard.writeText(state.shareURL); toast('Lien de partage copié.'); return; }
      if (action === 'close-preview') { $('#preview-dialog').close(); return; }
      if (action === 'preview-mobile') { const mobile = $('#preview-frame').classList.toggle('mobile'); control.textContent = mobile ? 'Vue ordinateur' : 'Vue mobile'; return; }
      if (action === 'add-block') {
        if (state.editor.content.length >= 500) throw new Error('La limite de 500 blocs est atteinte.');
        state.editor.content.push(newBlock(control.dataset.type)); markDirty(); renderBlocks(state.editor.content.length - 1); return;
      }
      if (action.startsWith('gallery-')) {
        const i = Number(index), photos = state.editor.content[i].images, photo = Number(control.dataset.photo);
        if (action === 'gallery-add') {
          if (photos.length >= 50) throw new Error('Une galerie peut contenir 50 photos au maximum.');
          await chooseImage(path => { photos.push({src:path, alt:'', caption:''}); markDirty(); renderBlocks(); }); return;
        }
        if (action === 'gallery-remove') photos.splice(photo,1);
        if (action === 'gallery-up' && photo > 0) [photos[photo-1],photos[photo]] = [photos[photo],photos[photo-1]];
        if (action === 'gallery-down' && photo < photos.length-1) [photos[photo+1],photos[photo]] = [photos[photo],photos[photo+1]];
        markDirty(); renderBlocks(); return;
      }
      if (action.startsWith('block-')) {
        const i = Number(index), blocks = state.editor.content;
        if (action === 'block-image') { await chooseImage(path => { blocks[i].src = path; markDirty(); renderBlocks(); }); return; }
        if (action === 'block-delete') {
          const block = blocks[i];
          if ((block.text || block.src || block.items?.join('') || block.images?.length) && !await ask('Supprimer ce bloc ?', 'Le bloc sera retiré de votre saisie. La dernière version enregistrée reste dans les sauvegardes.', 'Supprimer', true)) return;
          blocks.splice(i, 1);
        }
        if (action === 'block-copy') blocks.splice(i+1,0,structuredClone(blocks[i]));
        if (action === 'block-up' && i > 0) [blocks[i-1],blocks[i]] = [blocks[i],blocks[i-1]];
        if (action === 'block-down' && i < blocks.length-1) [blocks[i+1],blocks[i]] = [blocks[i],blocks[i+1]];
        markDirty(); renderBlocks(); return;
      }
      if (action.startsWith('format-')) {
        const textarea = $(`#block-text-${index}`), start = textarea.selectionStart, end = textarea.selectionEnd;
        const selected = textarea.value.slice(start,end) || (action === 'format-link' ? 'texte du lien' : 'texte');
        let replacement = action === 'format-bold' ? `**${selected}**` : `*${selected}*`;
        if (action === 'format-link') {
          openModal(`<div class="dialog-header"><h2 id="modal-title">Ajouter un lien</h2></div><label>Adresse du lien<input id="link-url" type="url" placeholder="https://…"></label><div class="dialog-footer">${button('cancel-dialog','Annuler')}${button('confirm-dialog','Insérer le lien','','primary')}</div>`);
          const input = $('#link-url'); input.focus();
          const accepted = await new Promise(resolve => { dialogResolve = resolve; });
          if (!accepted) return;
          const url = input.value.trim();
          if (!/^https?:\/\/[^\s<>]+$/.test(url)) throw new Error('Le lien doit commencer par https:// ou http://.');
          replacement = `[${selected}](${url})`;
        }
        textarea.setRangeText(replacement,start,end,'select');
        state.editor.content[Number(index)].format = 'markdown';
        textarea.dispatchEvent(new Event('input', { bubbles:true })); textarea.focus(); return;
      }
      if (action === 'choose-cover') { await chooseImage(path => { state.editor.image = path; markDirty(); $('#cover-preview').innerHTML = coverHTML(path); $('#remove-cover').disabled = false; }); return; }
      if (action === 'remove-cover') { state.editor.image = ''; markDirty(); $('#cover-preview').innerHTML = coverHTML(''); control.disabled = true; return; }
      if (action === 'discard-editor') {
        if (!await ask('Abandonner les modifications ?', 'La saisie non enregistrée de cet article sera effacée. La version enregistrée sera conservée.', 'Abandonner', true)) return;
        removeScratch(scratchKey()); state.dirty = false; state.route = ''; await route(); return;
      }
      if (action === 'delete-article') {
        const article = state.articles.find(a => a.slug === slug);
        if (!await ask('Supprimer cet article ?', `« ${article.title} » sera retiré du blog. Une sauvegarde permettra de le récupérer. Ses images resteront dans la médiathèque.`, 'Supprimer', true)) return;
        await api(`articles/${encodeURIComponent(slug)}`, 'DELETE', { revision: article.revision });
        removeScratch(scratchKey(slug)); state.articles = await api('articles'); renderArticles(); updateNav(state.route); toast('Article supprimé. Vous pouvez le récupérer dans les sauvegardes.'); return;
      }
      if (action === 'duplicate-article') {
        const article = await api(`articles/${encodeURIComponent(slug)}`);
        const stem = slug.slice(0,85); let next = `${stem}-copie`, n = 2;
        while (state.articles.some(a => a.slug === next)) next = `${stem}-copie-${n++}`;
        const copy = await api('articles','POST',{ ...article, slug:next, title:`${article.title.slice(0,240)} (copie)`, status:'draft', featured:false, date:localDate() });
        state.articles.push({ ...copy, blocks: copy.content.length });
        location.hash = `/edit/${copy.slug}`; toast('Une copie a été créée dans les brouillons.'); return;
      }
      if (action === 'upload') { $('#upload-input').click(); return; }
      if (action === 'media-detail') { mediaDetail(control.dataset.path); return; }
      if (action === 'pick-image') { const callback = state.picker, path = control.dataset.path; closeModal(); callback?.(path); return; }
      if (action === 'replace-image') { $('#replace-input').click(); return; }
      if (action === 'copy-path') { await navigator.clipboard.writeText(state.selectedMedia.path); toast('Chemin copié.'); return; }
      if (action === 'delete-image') {
        const item = state.selectedMedia;
        if (!await ask('Supprimer cette image ?', `« ${item.name} » sera retirée de la médiathèque. Une sauvegarde sera conservée.`, 'Supprimer', true)) return;
        await api('media','DELETE',{ path:item.path, revision:item.revision }); state.media = await api('media'); renderMedia(); toast('Image supprimée.'); return;
      }
      if (action === 'setting-image') {
        const key = control.dataset.key;
        await chooseImage(path => { state.settings[key] = path; $(`#setting-${key}-preview`).src = imageURL(path); markDirty(); }); return;
      }
      if (action === 'save-settings') {
        const invalid = $$('input, textarea', workspace).find(element => !element.checkValidity());
        if (invalid) { invalid.reportValidity(); return; }
        workspace.inert = true;
        try { state.settings = await api('settings','PUT',state.settings); state.dirty = false; toast('Réglages enregistrés. Ouvrez le blog pour voir le résultat.'); }
        finally { workspace.inert = false; }
        return;
      }
      if (action === 'restore') {
        if (!await ask('Annuler cette opération ?', 'Les fichiers concernés retrouveront leur version précédente. Une sauvegarde de leur état actuel sera aussi conservée.', 'Restaurer')) return;
        await api('restore','POST',{ id:control.dataset.id }); renderHistory(await api('history')); state.articles = await api('articles'); updateNav(state.route); toast('La version précédente a été restaurée.'); return;
      }
      if (action === 'check-edit') { const target = control.dataset.slug; closeModal(); location.hash = `/edit/${target}`; return; }
      if (action === 'check-site' || action === 'export') {
        if (state.dirty && !await ask('Vérifier la version enregistrée ?', 'Vos dernières modifications ne sont pas enregistrées. La vérification et l’export porteront sur la version enregistrée.', 'Continuer')) return;
        await showSiteCheck(action === 'export'); return;
      }
      if (action === 'export-confirmed') {
        control.disabled = true;
        try {
          const blob = await api('export','POST',{}), url = URL.createObjectURL(blob), link = document.createElement('a');
          link.href = url; link.download = 'sachaphoto-blog.zip'; link.click(); setTimeout(() => URL.revokeObjectURL(url),60000);
          closeModal();
          toast('Archive téléchargée. Une copie des fichiers publics est aussi disponible dans le dossier dist.');
        } finally { control.disabled = false; }
        return;
      }
      if (action === 'stop') {
        storeScratch();
        if (!await ask('Arrêter le gestionnaire ?', state.dirty && !state.editor ? 'Les réglages modifiés n’ont pas été enregistrés. Ils seront perdus si vous arrêtez le gestionnaire.' : 'Relancez gerer-blog.bat pour revenir dans votre atelier. Une saisie d’article en cours reste conservée dans ce navigateur.', 'Arrêter')) return;
        await api('stop','POST',{}); state.dirty = false;
        workspace.innerHTML = '<div class="empty"><h1>À bientôt dans l’atelier</h1><p>Le gestionnaire est arrêté. Vous pouvez fermer cet onglet.<br>Pour le rouvrir, double-cliquez sur gerer-blog.bat.</p></div>'; return;
      }
    } finally { delete control.dataset.pending; }
  });
});
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && !modal.open && !$('#preview-dialog').open) {
    event.preventDefault();
    if (state.editor) run(saveArticle); else if (state.route === '/settings') $('[data-action="save-settings"]')?.click();
  }
});

async function start() {
  try {
    const session = await api('session'); state.token = session.token; state.root = session.root;
    state.articles = await api('articles');
    await route();
  } catch (error) {
    workspace.innerHTML = `<div class="empty"><h1>Le gestionnaire est indisponible</h1><p>${esc(error.message)}</p><p>Double-cliquez sur gerer-blog.bat puis actualisez cette page.</p></div>`;
  }
}
setInterval(async () => {
  try {
    await api('health'); document.body.classList.remove('offline'); $('#connection').textContent = 'Sur cet ordinateur';
  } catch { document.body.classList.add('offline'); $('#connection').textContent = 'Relancez gerer-blog.bat'; }
}, 15000);
start();
