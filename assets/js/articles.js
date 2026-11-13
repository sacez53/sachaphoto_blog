/* ============================================================
   articles.js — Page liste des articles
   Charge articles.json et affiche tous les articles,
   du plus récent au plus ancien.
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  const list = document.getElementById('all-articles-list');

  try {
    const articles = await fetchArticles();

    // Tri du plus récent au plus ancien
    articles.sort((a, b) => articleTimestamp(b) - articleTimestamp(a));

    const category = document.getElementById('filter-category');
    const tag = document.getElementById('filter-tag');
    const choices = (values) => [...new Set(values.filter(value => typeof value === 'string' && value.trim()))].sort((a,b) => a.localeCompare(b, 'fr'));
    if (category) category.innerHTML += choices(articles.map(article => article.category)).map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join('');
    if (tag) tag.innerHTML += choices(articles.flatMap(article => Array.isArray(article.tags) ? article.tags : [])).map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join('');
    function render() {
      const visible = articles.filter(article => (!category?.value || article.category === category.value) && (!tag?.value || (Array.isArray(article.tags) && article.tags.includes(tag.value))));
      if (list) {
        list.innerHTML = visible.length ? visible.map(renderArticleCard).join('') : `<li>${articles.length ? 'Aucun article ne correspond à ces filtres.' : 'Aucun article publié pour le moment.'}</li>`;
        list.removeAttribute('aria-busy');
      }
    }
    category?.addEventListener('change', render);
    tag?.addEventListener('change', render);
    render();
  } catch (err) {
    console.error('Erreur lors du chargement des articles :', err);
    if (list) {
      list.innerHTML = '<li>Impossible de charger les articles.</li>';
      list.removeAttribute('aria-busy');
    }
  }
});
