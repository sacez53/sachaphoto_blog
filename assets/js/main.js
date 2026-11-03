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
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erreur ${response.status} : ${url}`);
  return response.json();
}

/** Valide le catalogue avant son affichage. */
async function fetchArticles() {
  const articles = await fetchJSON('data/articles.json');
  if (!Array.isArray(articles)) throw new Error('Catalogue des articles invalide.');
  return articles.filter((article) => article &&
    typeof article.slug === 'string' && /^[a-zA-Z0-9-]+$/.test(article.slug) &&
    typeof article.title === 'string' && article.title.trim());
}

function articleTimestamp(article) {
  return Date.parse(article.date) || 0;
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
      <a href="article.html?slug=${slug}" aria-hidden="true" tabindex="-1">
        <img src="${image}" alt="" loading="lazy">
      </a>
      <div class="article-card-body">
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
      <a href="article.html?slug=${slug}" aria-hidden="true" tabindex="-1">
        <img src="${image}" alt="" loading="lazy">
      </a>
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
          return `<p>${escapeHTML(block.text)}</p>`;

        case 'heading': {
          const level = Number.isInteger(block.level) ? block.level : 2;
          const tag = `h${Math.min(Math.max(level, 2), 4)}`;
          return `<${tag}>${escapeHTML(block.text)}</${tag}>`;
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

        case 'list': {
          const items = (Array.isArray(block.items) ? block.items : [])
            .map((item) => `<li>${escapeHTML(item)}</li>`).join('');
          const tag = block.ordered ? 'ol' : 'ul';
          return `<${tag}>${items}</${tag}>`;
        }

        case 'quote': {
          const cite = block.author
            ? `<cite>— ${escapeHTML(block.author)}</cite>`
            : '';
          return `<blockquote>
            <p>${escapeHTML(block.text)}</p>
            ${cite}
          </blockquote>`;
        }

        default:
          return '';
      }
    })
    .join('\n');
}

/**
 * Charge dynamiquement les composants partagés (header, footer)
 */
async function loadComponents() {
  async function load(selector, url, fallback) {
    const element = document.querySelector(selector);
    if (!element) return;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Erreur ${response.status} : ${url}`);
      element.innerHTML = await response.text();
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
