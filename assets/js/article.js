/* ============================================================
   article.js — Page de lecture d'un article
   Lit le paramètre ?slug=… dans l'URL, charge le fichier
   data/articles/<slug>.json et génère le contenu HTML.
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const sharePath = window.location.pathname.match(/\/partage\/([a-zA-Z0-9-]+)\/?(?:index\.html)?$/);
  const slug = params.get('slug') || (sharePath && sharePath[1]);

  const mainEl = document.getElementById('main-content');
  const articleEl = document.getElementById('article-content');

  // Pas de slug dans l'URL → erreur
  if (!slug) {
    showError(articleEl, 'Aucun article spécifié.');
    if (mainEl) mainEl.removeAttribute('aria-busy');

    return;
  }

  // Validation du slug : lettres, chiffres, tirets uniquement
  if (!/^[a-zA-Z0-9\-]+$/.test(slug)) {
    showError(articleEl, 'L\'identifiant de l\'article est invalide.');
    if (mainEl) mainEl.removeAttribute('aria-busy');
    return;
  }

  try {
    const article = await fetchJSON(`data/articles/${encodeURIComponent(slug)}.json`);

    if (!article || typeof article.title !== 'string' || !article.title.trim()) {
      throw new Error('Article invalide.');
    }
    if (!isArticlePublished(article)) throw new Error('Cet article n’est pas encore publié.');

    // Mettre à jour le titre de la page
    document.title = `${article.title} — Blog`;

    // Mettre à jour la meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && article.excerpt) {
      metaDesc.setAttribute('content', article.excerpt);
    }

    // Image hero
    const heroEl = document.getElementById('article-hero');
    if (heroEl && article.image) {
      heroEl.innerHTML = `<img src="${escapeHTML(article.image)}" alt="${escapeHTML(article.title)}">`;
    }

    // En-tête : titre + méta
    const headerEl = document.getElementById('article-header');
    if (headerEl) {
      headerEl.innerHTML = `
        <h1>${escapeHTML(article.title)}</h1>
        <p class="meta">${escapeHTML(article.author)} · ${renderDate(article.date)}</p>
      `;
    }

    // Contenu de l'article
    if (articleEl && Array.isArray(article.content) && article.content.length > 0) {
      articleEl.innerHTML = renderContentBlocks(article.content);
    } else if (articleEl) {
      articleEl.innerHTML = '<p>Cet article ne contient pas de contenu.</p>';
    }

    // Signaler la fin du chargement aux technologies d'assistance
    if (mainEl) mainEl.removeAttribute('aria-busy');

    const relatedSection = document.getElementById('related-articles');
    const relatedList = document.getElementById('related-list');
    if (relatedSection && relatedList) {
      try {
        const related = selectRelatedArticles(article, await fetchArticles());
        if (related.length) { relatedList.innerHTML = related.map(renderArticleCard).join(''); relatedSection.hidden = false; }
      } catch (error) { console.error('Articles liés indisponibles :', error); }
    }

  } catch (err) {
    console.error('Erreur lors du chargement de l\'article :', err);
    showError(articleEl, 'Article introuvable. Vérifiez l\'URL ou revenez à l\'accueil.');
    if (mainEl) mainEl.removeAttribute('aria-busy');
  }
});

/**
 * Affiche un message d'erreur dans la zone de contenu.
 * Utilise role="alert" pour annoncer immédiatement l'erreur aux lecteurs d'écran.
 */
function showError(container, message) {
  if (!container) return;
  document.title = 'Erreur — Blog';
  container.innerHTML = `
    <div class="error-message" role="alert">
      <h2>Oups !</h2>
      <p>${escapeHTML(message)}</p>
      <p><a href="index.html">← Retour à l'accueil</a></p>
    </div>
  `;
}
