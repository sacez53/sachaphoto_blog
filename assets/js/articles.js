/* ============================================================
   articles.js — Page liste des articles
   Charge articles.json et affiche tous les articles,
   du plus récent au plus ancien.
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  const list = document.getElementById('all-articles-list');

  try {
    const articles = await fetchJSON('data/articles.json');

    // Tri du plus récent au plus ancien
    articles.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (list) {
      if (articles.length > 0) {
        list.innerHTML = articles.map(renderArticleCard).join('');
      } else {
        list.innerHTML = '<li>Aucun article publié pour le moment.</li>';
      }
      list.removeAttribute('aria-busy');
    }
  } catch (err) {
    console.error('Erreur lors du chargement des articles :', err);
    if (list) {
      list.innerHTML = '<li>Impossible de charger les articles.</li>';
      list.removeAttribute('aria-busy');
    }
  }
});
