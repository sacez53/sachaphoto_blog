/* ============================================================
   main.js — Utilitaires partagés
   ============================================================ */

/**
 * Échappe les caractères HTML spéciaux pour éviter les injections XSS.
 * @param {string} str - Chaîne à échapper.
 * @returns {string}
 */
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

/**
 * Charge un fichier JSON et renvoie les données.
 * @param {string} url - Chemin relatif vers le fichier JSON.
 * @returns {Promise<any>}
 */
async function fetchJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Erreur ${response.status} : ${url}`);
    return await response.json();
  } catch (error) {
    if (!document.createElement || !document.body) throw error;
    const frame = document.createElement('iframe');
    frame.hidden = true;
    frame.setAttribute('sandbox', 'allow-same-origin');
    document.body.appendChild(frame);
    try {
      return await new Promise((resolve, reject) => {
        const request = new frame.contentWindow.XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'json';
        request.timeout = 15000;
        request.onload = () => request.status >= 200 && request.status < 300 ? resolve(request.response) : reject(new Error(`Erreur ${request.status} : ${url}`));
        request.onerror = request.ontimeout = () => reject(error);
        request.send();
      });
    } finally { frame.remove(); }
  }
}

async function fetchText(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Erreur ${response.status} : ${url}`);
    return await response.text();
  } catch (error) {
    if (!document.createElement || !document.body) throw error;
    const frame = document.createElement('iframe');
    frame.hidden = true;
    frame.setAttribute('sandbox', 'allow-same-origin');
    document.body.appendChild(frame);
    try {
      return await new Promise((resolve, reject) => {
        const request = new frame.contentWindow.XMLHttpRequest();
        request.open('GET', url, true);
        request.timeout = 15000;
        request.onload = () => request.status >= 200 && request.status < 300 ? resolve(request.responseText) : reject(error);
        request.onerror = request.ontimeout = () => reject(error);
        request.send();
      });
    } finally { frame.remove(); }
  }
}

/** Valide le catalogue avant son affichage. */
function isArticlePublished(article, now = Date.now()) {
  return !article.publishAt || (Number.isFinite(Date.parse(article.publishAt)) && Date.parse(article.publishAt) <= Number(now));
}

async function fetchArticles() {
  const articles = await fetchJSON('data/articles.json');
  if (!Array.isArray(articles)) throw new Error('Catalogue des articles invalide.');
  return articles.filter((article) => article &&
    typeof article.slug === 'string' && /^[a-zA-Z0-9-]+$/.test(article.slug) &&
    typeof article.title === 'string' && article.title.trim() && isArticlePublished(article));
}

function articleTimestamp(article) {
  return Date.parse(article.date) || 0;
}

function selectRelatedArticles(article, articles, limit = 3) {
  const normalize = value => typeof value === 'string' ? value.trim().toLocaleLowerCase('fr') : '';
  const category = normalize(article.category);
  const tags = new Set((Array.isArray(article.tags) ? article.tags : []).map(normalize).filter(Boolean));
  return (Array.isArray(articles) ? articles : []).filter(item => item && item.slug !== article.slug).map(item => {
    const otherTags = new Set((Array.isArray(item.tags) ? item.tags : []).map(normalize).filter(Boolean));
    const score = (category && category === normalize(item.category) ? 2 : 0) + [...tags].filter(tag => otherTags.has(tag)).length;
    return { item, score };
  }).filter(result => result.score > 0).sort((a,b) => b.score - a.score || articleTimestamp(b.item) - articleTimestamp(a.item) || String(a.item.slug).localeCompare(String(b.item.slug))).slice(0,limit).map(result => result.item);
}

/**
 * Formate une date ISO en format lisible français.
 * Supporte les dates simples ("2026-06-10") et avec heure ("2026-06-10T14:30").
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  if (typeof dateStr !== 'string') return '';
  // Une date sans heure représente un jour local, pas minuit UTC.
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? `${dateStr}T00:00:00` : dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const options = { day: 'numeric', month: 'long', year: 'numeric' };

  // Si la date contient une heure, l'afficher aussi
  if (dateStr.includes('T')) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }

  return d.toLocaleDateString('fr-FR', options);
}

/**
 * Génère un élément <time> HTML sémantique à partir d'une date ISO.
 * @param {string} dateStr - Date ISO (ex : "2026-06-10" ou "2026-06-10T14:30").
 * @returns {string} HTML avec balise <time>.
 */
function renderDate(dateStr) {
  return `<time datetime="${escapeHTML(dateStr)}">${escapeHTML(formatDate(dateStr))}</time>`;
}

/**
 * Génère le HTML d'une carte d'article (aperçu).
 * L'image dans le lien a un alt vide car le titre adjacent décrit déjà l'article.
 * @param {object} article - Objet article (depuis articles.json).
 * @returns {string} HTML
 */
function renderArticleCard(article) {
  const title = escapeHTML(article.title);
  const author = escapeHTML(article.author);
  const excerpt = escapeHTML(article.excerpt);
  const image = escapeHTML(article.image);
  const slug = encodeURIComponent(article.slug);

  return `
    <li class="article-card" role="listitem">
      ${article.image ? `<a href="article.html?slug=${slug}" aria-hidden="true" tabindex="-1">
        <img src="${image}" alt="" loading="lazy">
      </a>` : ''}
      <div class="article-card-body">
        ${article.category ? `<p class="article-category">${escapeHTML(article.category)}</p>` : ''}
        <h3><a href="article.html?slug=${slug}">${title}</a></h3>
        <p class="meta">${author} · ${renderDate(article.date)}</p>
        <p class="excerpt">${excerpt}</p>
      </div>
    </li>
  `;
}

/**
 * Génère le HTML d'un article mis en avant (featured).
 * @param {object} article
 * @returns {string} HTML
 */
function renderFeaturedItem(article) {
  const title = escapeHTML(article.title);
  const author = escapeHTML(article.author);
  const excerpt = escapeHTML(article.excerpt);
  const image = escapeHTML(article.image);
  const slug = encodeURIComponent(article.slug);

  return `
    <li class="featured-item" role="listitem">
      ${article.image ? `<a href="article.html?slug=${slug}" aria-hidden="true" tabindex="-1">
        <img src="${image}" alt="" loading="lazy">
      </a>` : ''}
      <h2><a href="article.html?slug=${slug}">${title}</a></h2>
      <p class="meta">${author} · ${renderDate(article.date)}</p>
      <p class="excerpt">${excerpt}</p>
    </li>
  `;
}

/**
 * Transforme un tableau de blocs de contenu JSON en HTML.
 * Types supportés : paragraph, heading, image, list, quote.
 * @param {Array} blocks - Tableau de blocs typés.
 * @returns {string} HTML
 */
function renderContentBlocks(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';

  return blocks
    .map((block) => {
      if (!block || typeof block !== 'object') return '';
      switch (block.type) {
        case 'paragraph':
          return `<p>${renderBlockText(block.text, block.format)}</p>`;

        case 'heading': {
          const level = Number.isInteger(block.level) ? block.level : 2;
          const tag = `h${Math.min(Math.max(level, 2), 4)}`;
          return `<${tag}>${renderBlockText(block.text, block.format)}</${tag}>`;
        }

        case 'image': {
          const alt = escapeHTML(block.alt || '');
          const src = escapeHTML(block.src || '');
          const caption = block.caption ? `<figcaption>${escapeHTML(block.caption)}</figcaption>` : '';
          return `<figure>
            <img src="${src}" alt="${alt}" loading="lazy">
            ${caption}
          </figure>`;
        }

        case 'gallery': {
          const images = Array.isArray(block.images) ? block.images : [];
          return `<div class="photo-gallery">${images.filter(image => image && typeof image.src === 'string' && image.src).map(image => {
            const src = escapeHTML(image.src), alt = escapeHTML(image.alt || '');
            const caption = image.caption ? `<figcaption>${escapeHTML(image.caption)}</figcaption>` : '';
            return `<figure><a href="${src}" target="_blank" rel="noopener noreferrer" aria-label="${alt ? `Agrandir : ${alt}` : 'Agrandir la photo'}"><img src="${src}" alt="${alt}" loading="lazy"></a>${caption}</figure>`;
          }).join('')}</div>`;
        }

        case 'list': {
          const items = (Array.isArray(block.items) ? block.items : [])
            .map((item) => `<li>${renderBlockText(item, block.format)}</li>`).join('');
          const tag = block.ordered ? 'ol' : 'ul';
          return `<${tag}>${items}</${tag}>`;
        }

        case 'quote': {
          const cite = block.author
            ? `<cite>— ${escapeHTML(block.author)}</cite>`
            : '';
          return `<blockquote>
            <p>${renderBlockText(block.text, block.format)}</p>
            ${cite}
          </blockquote>`;
        }

        default:
          return '';
      }
    })
    .join('\n');
}

/** Mise en forme limitée aux marques produites par l’éditeur. Le HTML reste inerte. */
function renderBlockText(value, format) {
  if (format !== 'markdown' || typeof value !== 'string') return escapeHTML(value);
  const tokens = /\[([^\]\n]+)\]\((https?:\/\/[^\s<>]+?)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;
  let result = '', cursor = 0;
  for (const match of value.matchAll(tokens)) {
    result += escapeHTML(value.slice(cursor, match.index));
    if (match[1]) result += `<a href="${escapeHTML(match[2])}" target="_blank" rel="noopener noreferrer">${escapeHTML(match[1])}</a>`;
    else if (match[3]) result += `<strong>${escapeHTML(match[3])}</strong>`;
    else result += `<em>${escapeHTML(match[4])}</em>`;
    cursor = match.index + match[0].length;
  }
  return (result + escapeHTML(value.slice(cursor))).replace(/\r?\n/g, '<br>');
}

/** Applique les réglages locaux aux pages publiques, en conservant leur contenu de secours. */
async function applySiteSettings() {
  try {
    const settings = await fetchJSON('data/site.json');
    const setText = (selector, value) => {
      if (typeof value === 'string') document.querySelectorAll(selector).forEach(element => { element.textContent = value; });
    };
    setText('.site-title a', settings.title);
    setText('.id-card-title strong, [data-site-author]', settings.author);
    setText('.id-card-title span', settings.role);
    setText('.id-card-body > p', settings.bio);
    setText('[data-site-footer]', settings.footer);
    for (const [key, selector] of [['aboutTitle','[data-about-title]'], ['aboutSubtitle','[data-about-subtitle]'], ['aboutJourneyTitle','[data-about-journey-title]'], ['aboutContactTitle','[data-about-contact-title]'], ['aboutContact','[data-about-contact]']]) setText(selector, settings[key]);
    for (const [key, selector] of [['aboutIntro','[data-about-intro]'], ['aboutJourney','[data-about-journey]']]) {
      const element = document.querySelector(selector);
      if (element && typeof settings[key] === 'string') element.innerHTML = settings[key].split(/\n\s*\n/).filter(Boolean).map(paragraph => `<p>${escapeHTML(paragraph).replace(/\n/g, '<br>')}</p>`).join('');
    }
    if (typeof settings.avatar === 'string' && settings.avatar.startsWith('assets/images/')) {
      document.querySelectorAll('.id-card-avatar, .profile-pic').forEach(image => { image.src = settings.avatar; });
    }
    if (typeof settings.favicon === 'string' && settings.favicon.startsWith('assets/images/')) {
      const icon = document.querySelector('link[rel="icon"]');
      if (icon) { icon.href = settings.favicon; icon.removeAttribute('type'); }
    }
    if (!document.getElementById('article-content') && typeof settings.description === 'string') {
      document.querySelector('meta[name="description"]')?.setAttribute('content', settings.description);
      const page = window.location.pathname.split('/').pop();
      document.title = `${settings.title} — ${page === 'articles.html' ? 'Articles' : page === 'a-propos.html' ? 'À propos' : 'Accueil'}`;
    }
    for (const key of ['email', 'instagram', 'github']) {
      const link = document.querySelector(`[data-site-link="${key}"]`);
      if (!link) continue;
      const value = settings[key];
      link.hidden = !value;
      if (typeof value === 'string' && value && (key === 'email' ? /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value) : /^https:\/\//.test(value))) {
        link.href = key === 'email' ? `mailto:${value}` : value;
      }
    }
  } catch (error) { console.error('Réglages du blog indisponibles :', error); }
}

/**
 * Charge dynamiquement les composants partagés (header, footer)
 */
async function loadComponents() {
  async function load(selector, url, fallback) {
    const element = document.querySelector(selector);
    if (!element) return;
    try {
      element.innerHTML = await fetchText(url);
    } catch (error) {
      console.error('Erreur lors du chargement des composants :', error);
      element.innerHTML = fallback;
    }
  }

  // Chaque composant reste disponible même si l'autre requête échoue.
  await Promise.all([
    load('.site-header', 'components/header.html',
      '<div class="container"><span class="site-title"><a href="index.html">Sacha G. Photographe</a></span><nav class="site-nav" aria-label="Navigation principale"><a href="index.html">Accueil</a><a href="articles.html">Articles</a></nav></div>'),
    load('.site-footer', 'components/footer.html',
      '<div class="container footer-content"><p>&copy; 2026 <b>Sacha G. Photographe</b>. Tous droits réservés.</p></div>')
  ]);

  const currentFile = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-header .site-nav a').forEach((link) => {
    if (link.getAttribute('href') === currentFile) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  if (document.querySelector('.site-header') && document.querySelector('link[rel="icon"]')) await applySiteSettings();
}

document.addEventListener('DOMContentLoaded', loadComponents);

function closeAuthorCard(restoreFocus = false) {
  const card = document.getElementById('author-id-card');
  const toggle = document.querySelector('.author-widget-toggle');
  if (!card || card.hidden) return;
  card.hidden = true;
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) toggle.focus();
  }
}

// Délégation : fonctionne aussi pour le pied de page chargé après la page.
document.addEventListener('click', (event) => {
  const toggle = event.target.closest('.author-widget-toggle');
  if (toggle) {
    const card = document.getElementById('author-id-card');
    if (!card) return;
    if (card.hidden) {
      card.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      card.querySelector('.author-card-close')?.focus();
    } else {
      closeAuthorCard();
    }
    return;
  }
  if (event.target.closest('.author-card-close')) {
    closeAuthorCard(true);
  } else if (!event.target.closest('.author-widget')) {
    closeAuthorCard();
  }
});

document.addEventListener('keydown', (event) => {
  const card = document.getElementById('author-id-card');
  if (event.key === 'Escape' && card && !card.hidden) {
    event.preventDefault();
    closeAuthorCard(true);
  }
});

document.addEventListener('focusin', (event) => {
  if (!event.target.closest('.author-widget')) closeAuthorCard();
});
