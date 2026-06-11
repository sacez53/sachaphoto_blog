/* ============================================================
   main.js — Utilitaires partagés
   ============================================================ */

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

/**
 * Formate une date ISO (ex : "2026-06-10") en format lisible français.
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Génère le HTML d'une carte d'article (aperçu).
 * @param {object} article - Objet article (depuis articles.json).
 * @returns {string} HTML
 */
function renderArticleCard(article) {
  return `
    <li class="article-card">
      <a href="article.html?slug=${article.slug}">
        <img src="${article.image}" alt="${article.title}" loading="lazy">
      </a>
      <div class="article-card-body">
        <h3><a href="article.html?slug=${article.slug}">${article.title}</a></h3>
        <p class="meta">${article.author} · ${formatDate(article.date)}</p>
        <p class="excerpt">${article.excerpt}</p>
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
  return `
    <li class="featured-item">
      <a href="article.html?slug=${article.slug}">
        <img src="${article.image}" alt="${article.title}" loading="lazy">
      </a>
      <h2><a href="article.html?slug=${article.slug}">${article.title}</a></h2>
      <p class="meta">${article.author} · ${formatDate(article.date)}</p>
      <p class="excerpt">${article.excerpt}</p>
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
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'paragraph':
          return `<p>${block.text}</p>`;

        case 'heading': {
          const level = block.level || 2;
          const tag = `h${Math.min(Math.max(level, 2), 4)}`;
          return `<${tag}>${block.text}</${tag}>`;
        }

        case 'image':
          return `<figure>
            <img src="${block.src}" alt="${block.alt || ''}" loading="lazy">
            ${block.caption ? `<figcaption>${block.caption}</figcaption>` : ''}
          </figure>`;

        case 'list': {
          const items = block.items.map((item) => `<li>${item}</li>`).join('');
          const tag = block.ordered ? 'ol' : 'ul';
          return `<${tag}>${items}</${tag}>`;
        }

        case 'quote':
          return `<blockquote>
            <p>${block.text}</p>
            ${block.author ? `<cite>— ${block.author}</cite>` : ''}
          </blockquote>`;

        default:
          return '';
      }
    })
    .join('\n');
}
