/* ============================================================
   index.js — Page d'accueil
   Charge articles.json et affiche :
   - les articles importants / mis en avant
   - les 3 articles les plus récents
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  const featuredList = document.getElementById('featured-list');
  const recentList = document.getElementById('recent-list');

  try {
    const articles = await fetchJSON('data/articles.json');

    // --- 1 seul article mis en avant (le plus important ou le premier featured) ---
    const featured = articles
      .filter((a) => a.important || a.featured)
      .sort((a, b) => (b.important ? 1 : 0) - (a.important ? 1 : 0));
    if (featuredList) {
      if (featured.length > 0) {
        featuredList.innerHTML = renderFeaturedItem(featured[0]);
      } else {
        featuredList.innerHTML = '<li>Aucun article mis en avant pour le moment.</li>';
      }
      featuredList.removeAttribute('aria-busy');
    }

    // --- 3 articles les plus récents (hors article à la une) ---
    const featuredSlug = featured.length > 0 ? featured[0].slug : null;
    const recent = [...articles]
      .filter((a) => a.slug !== featuredSlug)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3);
    if (recentList) {
      if (recent.length > 0) {
        recentList.innerHTML = recent.map(renderArticleCard).join('');
      } else {
        recentList.innerHTML = '<li>Aucun article publié pour le moment.</li>';
      }
      recentList.removeAttribute('aria-busy');
    }
  } catch (err) {
    console.error('Erreur lors du chargement des articles :', err);
    // Retirer l'indicateur de chargement et signaler l'erreur
    if (featuredList) {
      featuredList.innerHTML = '<li>Impossible de charger les articles.</li>';
      featuredList.removeAttribute('aria-busy');
    }
    if (recentList) {
      recentList.innerHTML = '<li>Impossible de charger les articles.</li>';
      recentList.removeAttribute('aria-busy');
    }
  }
});
