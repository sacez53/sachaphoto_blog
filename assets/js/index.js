/* ============================================================
   index.js — Page d'accueil
   Charge articles.json et affiche :
   - les articles importants / mis en avant
   - les 3 articles les plus récents
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const articles = await fetchJSON('data/articles.json');

    // --- Articles mis en avant (important ou featured) ---
    const featured = articles.filter((a) => a.important || a.featured);
    const featuredList = document.getElementById('featured-list');
    if (featuredList && featured.length > 0) {
      featuredList.innerHTML = featured.map(renderFeaturedItem).join('');
    }

    // --- 3 articles les plus récents ---
    const recent = articles
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3);
    const recentList = document.getElementById('recent-list');
    if (recentList && recent.length > 0) {
      recentList.innerHTML = recent.map(renderArticleCard).join('');
    }
  } catch (err) {
    console.error('Erreur lors du chargement des articles :', err);
  }
});
