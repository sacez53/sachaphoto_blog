export function isPublicationDue(article, now = Date.now()) {
  if (!article.publishAt) return true;
  const value = article.publishAt;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Date de publication invalide : ${article.slug || article.title || 'article'}`);
  }
  return Date.parse(value) <= Number(now);
}
