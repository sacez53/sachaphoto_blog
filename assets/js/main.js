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
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
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

/**
 * Formate une date ISO en format lisible français.
 * Supporte les dates simples ("2026-06-10") et avec heure ("2026-06-10T14:30").
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr; // Date invalide → retourne la chaîne brute

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
  return `<time datetime="${escapeHTML(dateStr)}">${formatDate(dateStr)}</time>`;
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
      switch (block.type) {
        case 'paragraph':
          return `<p>${block.text}</p>`;

        case 'heading': {
          const level = block.level || 2;
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
          const items = block.items.map((item) => `<li>${item}</li>`).join('');
          const tag = block.ordered ? 'ol' : 'ul';
          return `<${tag}>${items}</${tag}>`;
        }

        case 'quote': {
          const cite = block.author
            ? `<cite>— ${escapeHTML(block.author)}</cite>`
            : '';
          return `<blockquote>
            <p>${block.text}</p>
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
  try {
    // Charger le header
    const headerEl = document.querySelector('.site-header');
    if (headerEl) {
      const headerRes = await fetch('components/header.html');
      if (headerRes.ok) {
        headerEl.innerHTML = await headerRes.text();
        
        // Gérer le lien actif
        const currentPath = window.location.pathname;
        const currentFile = currentPath.split('/').pop() || 'index.html';
        const navLinks = headerEl.querySelectorAll('.site-nav a');
        navLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href === currentFile || (currentFile === '' && href === 'index.html')) {
            link.setAttribute('aria-current', 'page');
          } else {
            link.removeAttribute('aria-current');
          }
        });
      }
    }

    // Charger le footer
    const footerEl = document.querySelector('.site-footer');
    if (footerEl) {
      const footerRes = await fetch('components/footer.html');
      if (footerRes.ok) {
        footerEl.innerHTML = await footerRes.text();
      }
    }
  } catch (error) {
    console.error('Erreur lors du chargement des composants:', error);
  }
}

document.addEventListener('DOMContentLoaded', loadComponents);

// --- Gestionnaire d'événements global (délégation) ---
document.addEventListener('click', (e) => {
  // Bascule du widget auteur
  const toggleBtn = e.target.closest('.author-widget-toggle');
  if (toggleBtn) {
    const card = document.getElementById('author-id-card');
    if (card) {
      const isHidden = card.hasAttribute('hidden');
      if (isHidden) {
        card.removeAttribute('hidden');
        toggleBtn.setAttribute('aria-expanded', 'true');
      } else {
        card.setAttribute('hidden', '');
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    }
    return;
  }
  
  // Fermeture via la croix
  const closeBtn = e.target.closest('.author-card-close');
  if (closeBtn) {
    const card = document.getElementById('author-id-card');
    const toggle = document.querySelector('.author-widget-toggle');
    if (card) {
      card.setAttribute('hidden', '');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
    return;
  }
  
  // Fermeture au clic en dehors du widget
  const widget = e.target.closest('.author-widget');
  if (!widget) {
    const card = document.getElementById('author-id-card');
    const toggle = document.querySelector('.author-widget-toggle');
    if (card && !card.hasAttribute('hidden')) {
      card.setAttribute('hidden', '');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
  }
});
