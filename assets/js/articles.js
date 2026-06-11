/* ============================================================
   articles.js — Page liste des articles
   Charge articles.json et affiche tous les articles,
   du plus récent au plus ancien.
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const articles = await fetchJSON('data/articles.json');

    // Tri du plus récent au plus ancien
    articles.sort((a, b) => new Date(b.date) - new Date(a.date));

    const list = document.getElementById('all-articles-list');
    if (list) {
      list.innerHTML = articles.map(renderArticleCard).join('');
    }
  } catch (err) {
    console.error('Erreur lors du chargement des articles :', err);
  }
});
