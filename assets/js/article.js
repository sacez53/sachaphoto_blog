/* ============================================================
   article.js — Page de lecture d'un article
   Lit le paramètre ?slug=… dans l'URL, charge le fichier
   data/articles/<slug>.json et génère le contenu HTML.
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  const articleEl = document.getElementById('article-content');

  // Pas de slug dans l'URL → erreur
  if (!slug) {
    showError(articleEl, 'Aucun article spécifié.');
    return;
  }

  try {
    const article = await fetchJSON(`data/articles/${slug}.json`);

    // Mettre à jour le titre de la page
    document.title = `${article.title} — Blog`;

    // Image hero
    const heroEl = document.getElementById('article-hero');
    if (heroEl && article.image) {
      heroEl.innerHTML = `<img src="${article.image}" alt="${article.title}">`;
    }

    // En-tête : titre + méta
    const headerEl = document.getElementById('article-header');
    if (headerEl) {
      headerEl.innerHTML = `
        <h1>${article.title}</h1>
        <p class="meta">${article.author} · ${formatDate(article.date)}</p>
      `;
    }

    // Contenu de l'article
    if (articleEl && article.content) {
      articleEl.innerHTML = renderContentBlocks(article.content);
    }
  } catch (err) {
    console.error('Erreur lors du chargement de l\'article :', err);
    showError(articleEl, 'Article introuvable. Vérifiez l\'URL ou revenez à l\'accueil.');
  }
});

/**
 * Affiche un message d'erreur dans la zone de contenu.
 */
function showError(container, message) {
  if (!container) return;
  container.innerHTML = `
    <div class="error-message">
      <h2>Oups !</h2>
      <p>${message}</p>
      <p><a href="index.html">← Retour à l'accueil</a></p>
    </div>
  `;
}
