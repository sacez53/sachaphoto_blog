export function checkSite(store) {
  const issues = [];
  const add = (severity, title, detail, slug = '') => issues.push({ severity, title, detail, slug });
  let catalog;
  try { catalog = store.catalog(); }
  catch (error) { add('error', 'Catalogue illisible', error.message); return { issues, published: 0, drafts: 0, externalLinks: 0 }; }
  let all;
  try { all = store.listArticles(); }
  catch (error) { add('error', 'Articles illisibles', error.message); return { issues, published: catalog.length, drafts: 0, externalLinks: 0 }; }
  const published = all.filter(article => article.status === 'published');
  const slugs = new Set(catalog.map(article => article.slug));
  let externalLinks = 0;
  const image = (path, label, article, alt) => {
    if (!path) { add('warning', article.title, `${label} manquante.`, article.slug); return; }
    try { if (!store.bytes(path)) add('error', article.title, `${label} introuvable : ${path}`, article.slug); }
    catch { add('error', article.title, `${label} inaccessible : ${path}`, article.slug); }
    if (alt !== undefined && !String(alt || '').trim()) add('warning', article.title, `${label} : ajoutez une description pour les lecteurs d’écran.`, article.slug);
  };
  for (const entry of catalog) {
    if (!all.some(article => article.slug === entry.slug && article.status === 'published')) add('error', 'Article introuvable', `Le catalogue référence ${entry.slug}, mais son fichier est absent.`, entry.slug);
  }
  for (const entry of published) {
    const article = store.getArticle(entry.slug);
    if (!slugs.has(article.slug)) add('error', article.title, 'L’article ne figure pas dans le catalogue.', article.slug);
    if (!String(article.excerpt || '').trim()) add('warning', article.title, 'Ajoutez un résumé pour la liste des articles et le partage.', article.slug);
    image(article.image, 'Image de couverture', article);
    if (!Array.isArray(article.content) || !article.content.length) add('warning', article.title, 'L’article ne contient aucun bloc.', article.slug);
    for (const block of article.content || []) {
      if (block.type === 'image') image(block.src, 'Image', article, block.alt);
      if (block.type === 'gallery') {
        if (!Array.isArray(block.images) || !block.images.length) add('error', article.title, 'Une galerie ne contient aucune photo.', article.slug);
        for (const photo of block.images || []) image(photo.src, 'Photo de galerie', article, photo.alt);
      }
      const texts = [block.text, ...(Array.isArray(block.items) ? block.items : [])].filter(value => typeof value === 'string');
      for (const text of texts) {
        for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
          if (/^https?:\/\//i.test(match[1])) externalLinks++;
          else if (/^article\.html\?slug=/i.test(match[1])) {
            const slug = new URL(match[1], 'http://localhost/').searchParams.get('slug');
            if (!slugs.has(slug)) add('warning', article.title, `Lien vers un article absent : ${slug}`, article.slug);
          }
        }
      }
    }
  }
  return { issues, published: published.length, drafts: all.length - published.length, externalLinks };
}
