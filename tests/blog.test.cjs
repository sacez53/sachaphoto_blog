const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function setup(elements = {}, fetch = async () => { throw new Error('offline'); }) {
  const events = {};
  const document = {
    title: '',
    addEventListener: (name, callback) => (events[name] ??= []).push(callback),
    getElementById: (id) => elements[id] || null,
    querySelector: (selector) => elements[selector] || null,
    querySelectorAll: () => [],
  };
  const context = vm.createContext({ document, fetch, URLSearchParams,
    window: { location: { pathname: '/sachaphoto_blog/', search: '' } },
    console: { error() {} } });
  function run(file) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js', file), 'utf8'), context);
  }
  run('main.js');
  return { context, events, document, run };
}
function element() {
  return { innerHTML: '', busy: true, removeAttribute() { this.busy = false; } };
}

test('les dates de publication filtrent les articles sans dépendre du fuseau du visiteur', () => {
  const {context:c} = setup();
  const article = {publishAt:'2035-06-12T12:00:00+02:00'};
  assert.equal(c.isArticlePublished(article, Date.parse('2035-06-12T09:59:59Z')), false);
  assert.equal(c.isArticlePublished(article, Date.parse('2035-06-12T10:00:00Z')), true);
  assert.equal(c.isArticlePublished({publishAt:'invalide'}), false);
  assert.equal(c.isArticlePublished({}), true);
});

test('les textes et les attributs échappent le HTML', () => {
  const { context: c } = setup();
  assert.equal(c.escapeHTML('<img onerror="x"> & \'test\''), '&lt;img onerror=&quot;x&quot;&gt; &amp; &#39;test&#39;');
  assert.ok(!c.renderDate('<img src=x onerror=x>').includes('<img'));
});

test('les dates sans heure conservent le jour dans tous les fuseaux', () => {
  const { context: c } = setup();
  assert.equal(c.formatDate('2026-06-12'), '12 juin 2026');
  assert.equal(c.formatDate(null), '');
});

test('les blocs incomplets ne bloquent pas les autres blocs et leur texte reste inerte', () => {
  const { context: c } = setup();
  const html = c.renderContentBlocks([null, { type: 'list' },
    { type: 'paragraph', text: '<script>alert(1)</script>' },
    { type: 'heading', level: 'bad', text: 'Titre' },
    { type: 'list', items: ['<img src=x onerror=x>'] },
    { type: 'quote', text: '<iframe>test</iframe>' }]);
  assert.ok(html.includes('<h2>Titre</h2>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!/<script|<img|<iframe|hNaN/.test(html));
});

test('le catalogue écarte les entrées illisibles', async () => {
  const { context: c } = setup({}, async () => ({ ok: true, json: async () => [null,
    { slug: '../bad', title: 'Bad' }, { slug: 'ok', title: 'Titre' }] }));
  assert.equal((await c.fetchArticles()).length, 1);
});

test('un catalogue non-tableau est signalé', async () => {
  const { context: c } = setup({}, async () => ({ ok: true, json: async () => ({}) }));
  await assert.rejects(c.fetchArticles(), /Catalogue/);
});

test('une panne de l’en-tête ne bloque pas le pied de page', async () => {
  const header = element(), footer = element();
  const { context: c } = setup({ '.site-header': header, '.site-footer': footer }, async (url) => {
    if (url.includes('header')) throw new Error('offline');
    return { ok: true, text: async () => '<p>Pied de page chargé</p>' };
  });
  await c.loadComponents();
  assert.ok(header.innerHTML.includes('articles.html'));
  assert.ok(footer.innerHTML.includes('Pied de page chargé'));
});

test('les composants sont demandés en parallèle', async () => {
  let releaseHeader;
  const headerWait = new Promise(resolve => { releaseHeader = resolve; });
  const calls = [];
  const { context: c } = setup({ '.site-header': element(), '.site-footer': element() }, async (url) => {
    calls.push(url);
    if (url.includes('header')) await headerWait;
    return { ok: true, text: async () => '' };
  });
  const pending = c.loadComponents();
  assert.equal(calls.length, 2);
  releaseHeader();
  await pending;
});

test('la fiche auteur se ferme avec Échap et rend le focus', () => {
  const card = { hidden: false };
  const toggle = { setAttribute(name, value) { this[name] = value; }, focus() { this.focused = true; } };
  const { events } = setup({ 'author-id-card': card, '.author-widget-toggle': toggle });
  let prevented = false;
  events.keydown[0]({ key: 'Escape', preventDefault() { prevented = true; } });
  assert.equal(card.hidden, true);
  assert.equal(toggle['aria-expanded'], 'false');
  assert.equal(toggle.focused, true);
  assert.equal(prevented, true);
});

test('la fiche auteur s’ouvre au bouton et se ferme quand le focus sort', () => {
  const close = { focus() { this.focused = true; } };
  const card = { hidden: true, querySelector: () => close };
  const toggle = { setAttribute(name, value) { this[name] = value; } };
  const { events } = setup({ 'author-id-card': card, '.author-widget-toggle': toggle });
  events.click[0]({ target: { closest: selector => selector === '.author-widget-toggle' ? toggle : null } });
  assert.equal(card.hidden, false);
  assert.equal(close.focused, true);
  events.focusin[0]({ target: { closest: () => null } });
  assert.equal(card.hidden, true);
});

test('un article à la une seul ne fait pas annoncer un blog vide', async () => {
  const featured = element(), recent = element();
  const { events, run } = setup({ 'featured-list': featured, 'recent-list': recent }, async () => ({
    ok: true, json: async () => [{ slug: 'premier', title: 'Titre', featured: true, date: '2026-06-12' }]
  }));
  run('index.js');
  await events.DOMContentLoaded[1]();
  assert.ok(featured.innerHTML.includes('Titre'));
  assert.ok(recent.innerHTML.includes('Aucun autre article'));
  assert.equal(recent.busy, false);
});

test('une panne du catalogue termine les états de chargement', async () => {
  const list = element();
  const { events, run } = setup({ 'all-articles-list': list });
  run('articles.js');
  await events.DOMContentLoaded[1]();
  assert.ok(list.innerHTML.includes('Impossible de charger'));
  assert.equal(list.busy, false);
});

test('les slugs absents et invalides ne déclenchent aucune requête', async () => {
  for (const search of ['', '?slug=../secret']) {
    const main = element(), article = element();
    let requests = 0;
    const { context: c, events, run } = setup({ 'main-content': main, 'article-content': article }, async () => { requests++; });
    c.window.location.search = search;
    run('article.js');
    await events.DOMContentLoaded[1]();
    assert.equal(requests, 0);
    assert.ok(article.innerHTML.includes('role="alert"'));
    assert.equal(main.busy, false);
  }
});

test('un article chargé affiche ses paragraphes sans dépendre du contenu du blog', async () => {
  const data = { slug: 'article-de-test', title: 'Article de test', author: 'Auteur', date: '2026-11-13',
    excerpt: 'Résumé', image: 'assets/images/test.png', content: Array.from({ length: 9 }, (_, i) => ({ type: 'paragraph', text: `Paragraphe ${i + 1}` })) };
  const main = element(), article = element(), header = element(), hero = element();
  const { context: c, events, document, run } = setup({ 'main-content': main, 'article-content': article,
    'article-header': header, 'article-hero': hero }, async () => ({ ok: true, json: async () => data }));
  c.window.location.search = '?slug=article-de-test';
  run('article.js');
  await events.DOMContentLoaded[1]();
  assert.equal((article.innerHTML.match(/<p>/g) || []).length, 9);
  assert.ok(document.title.includes(data.title));
  assert.equal(main.busy, false);
});

test('les titres H2, H3 et H4 et la mise en forme de l’éditeur apparaissent dans le blog', () => {
  const { context: c } = setup();
  const html = c.renderContentBlocks([
    { type: 'heading', level: 2, text: 'Section' },
    { type: 'heading', level: 3, text: 'Sous-section' },
    { type: 'heading', level: 4, text: 'Détail' },
    { type: 'paragraph', text: '**Gras** et *italique*\n[lien](https://example.org)', format: 'markdown' }
  ]);
  assert.ok(html.includes('<h2>Section</h2>'));
  assert.ok(html.includes('<h3>Sous-section</h3>'));
  assert.ok(html.includes('<h4>Détail</h4>'));
  assert.ok(html.includes('<strong>Gras</strong>'));
  assert.ok(html.includes('<em>italique</em><br>'));
  assert.ok(html.includes('href="https://example.org"'));
});
test('la mise en forme ne permet pas le HTML ni les liens actifs dangereux', () => {
  const { context: c } = setup();
  const html = c.renderBlockText('<script>alert(1)</script> [test](javascript:alert(1)) [x](https://a.test/"onmouseover="alert(1))', 'markdown');
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes('&quot;'));
  assert.equal(c.renderBlockText('**Ancien texte**', 'plain'), '**Ancien texte**');
});

test('un article sans couverture n’affiche pas d’image cassée', () => {
  const { context: c } = setup();
  const article = {slug:'test',title:'Sans image',author:'Auteur',date:'2026-11-13',image:'',excerpt:''};
  assert.ok(!c.renderArticleCard(article).includes('<img'));
  assert.ok(!c.renderFeaturedItem(article).includes('<img'));
});
test('une page de partage charge l’article associé sans paramètre', async () => {
  const main = element(), article = element(), header = element(), hero = element();
  let requested;
  const data = { title:'Mon article', author:'Auteur', date:'2026-11-13', content:[{type:'paragraph',text:'Texte'}] };
  const { context:c, events, run } = setup({ 'main-content':main,'article-content':article,'article-header':header,'article-hero':hero }, async url => {
    requested = url; return {ok:true,json:async () => data};
  });
  c.window.location.pathname = '/sachaphoto_blog/partage/mon-article/';
  run('article.js'); await events.DOMContentLoaded[1]();
  assert.equal(requested,'data/articles/mon-article.json');
  assert.ok(article.innerHTML.includes('Texte'));
});
test('les galeries affichent les images et échappent les descriptions', () => {
  const {context:c} = setup();
  const html = c.renderContentBlocks([{type:'gallery',images:[{src:'assets/images/photo.jpg',alt:'<test>',caption:'Matin & brume'}]}]);
  assert.ok(html.includes('class="photo-gallery"'));
  assert.ok(html.includes('href="assets/images/photo.jpg"'));
  assert.ok(html.includes('alt="&lt;test&gt;"'));
  assert.ok(html.includes('Matin &amp; brume'));
});
test('les articles liés sont classés par pertinence et excluent les autres sujets', () => {
  const {context:c} = setup();
  const article = {slug:'courant',category:'Nature',tags:['Forêt']};
  const related = c.selectRelatedArticles(article,[article,{slug:'cat',category:'nature',date:'2026-01-01'},{slug:'tag',tags:['forêt'],date:'2026-02-01'},{slug:'autre',category:'Portrait'}]);
  assert.deepEqual(Array.from(related, x => x.slug),['cat','tag']);
});
