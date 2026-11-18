import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { createStore } from '../_manager/store.mjs';
import { startServer } from '../_manager/server.mjs';
import { build, publicFiles, zipSite, projectRoot } from '../_manager/build.mjs';
import { checkSite } from '../_manager/check.mjs';
import { isPublicationDue } from '../_manager/publication.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/2uoAAAAASUVORK5CYII=', 'base64');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sachaphoto-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (name, value) => { fs.mkdirSync(path.dirname(path.join(root,name)), { recursive:true }); fs.writeFileSync(path.join(root,name),value); };
  for (const page of ['index.html','article.html','articles.html','a-propos.html']) write(page,'<!doctype html><html lang="fr"><title>Test</title></html>');
  write('article.html','<!doctype html><html lang="fr"><head><title>Test</title><meta name="description" content="Test"></head><body>Article</body></html>');
  write('components/header.html','<header>Test</header>'); write('components/footer.html','<footer>Test</footer>');
  write('assets/css/style.css','body { color: black; }');
  write('assets/images/test.png',png);
  write('data/articles.json','[]');
  write('data/site.json',JSON.stringify({ title:'Blog', description:'Description', author:'Auteur', role:'Photographe', bio:'Texte', avatar:'assets/images/test.png', favicon:'assets/images/test.png', footer:'Texte', email:'',instagram:'',github:'' }));
  write('_manager/public/index.html','<!doctype html><title>Gestionnaire</title>');
  return { root, store:createStore(root), write };
}
const article = (overrides = {}) => ({ slug:'un-article', title:'Un article', author:'Sacha', date:'2026-11-13T12:00', excerpt:'Un résumé', image:'assets/images/test.png', featured:false, status:'draft', content:[
  { type:'heading',level:2,text:'Titre de section' }, { type:'paragraph',text:'Texte avec **gras**.',format:'markdown' },
  { type:'heading',level:3,text:'Sous-titre' }, { type:'image',src:'assets/images/test.png',alt:'Image de test',caption:'Légende' },
  { type:'list',items:['Premier','Second'],ordered:true }, { type:'quote',text:'Une citation',author:'Auteur' }
], ...overrides });

test('la médiathèque ne relit pas les photos inchangées et actualise leurs utilisations', t => {
  const { root, store, write } = fixture(t);
  write('assets/images/autre.png', png);
  const readFile = fs.readFileSync;
  let photoReads = 0, htmlReads = 0;
  t.mock.method(fs, 'readFileSync', function (file, ...args) {
    const name = String(file);
    if (name.startsWith(root) && /\.(?:png|html)$/.test(name)) {
      if (name.endsWith('.png')) photoReads++; else htmlReads++;
    }
    return readFile.call(this, file, ...args);
  });
  const initial = store.listMedia();
  assert.equal(photoReads, 2); assert.ok(htmlReads <= 6);
  photoReads = 0; htmlReads = 0;
  assert.deepEqual(store.listMedia(), initial);
  assert.equal(photoReads, 0); assert.ok(htmlReads <= 6);
  const saved = store.saveArticle(article());
  assert.ok(store.listMedia().find(item => item.name === 'test.png').usedBy.includes('Un article (brouillon)'));
  store.deleteArticle(saved.slug, saved.revision);
  assert.deepEqual(store.listMedia().find(item => item.name === 'test.png').usedBy, ['Portrait de l’auteur', 'Icône du blog']);
});

test('le cache des photos détecte les modifications externes et les remplacements', t => {
  const { root, store, write } = fixture(t);
  const relative = 'assets/images/libre.png';
  write(relative, png);
  const initial = store.listMedia().find(item => item.path === relative);
  const changed = Buffer.from(png); changed[changed.length - 1] ^= 1;
  write(relative, changed);
  fs.utimesSync(path.join(root, relative), new Date(), new Date('2020-01-01'));
  const external = store.listMedia().find(item => item.path === relative);
  assert.notEqual(external.revision, initial.revision);
  assert.throws(() => store.deleteMedia(relative, initial.revision), /changé/);
  const replaced = store.uploadMedia({ name: 'libre.png', replace: relative, revision: external.revision, data: png.toString('base64') });
  assert.equal(store.listMedia().find(item => item.path === relative).revision, replaced.revision);
  store.deleteMedia(relative, replaced.revision);
  assert.ok(!store.listMedia().some(item => item.path === relative));
});

test('les fichiers locaux inchangés sont revalidés sans être renvoyés', async t => {
  const { root, write } = fixture(t), { server, url } = await startServer({ root, port: 0 });
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = new URL(url).origin, asset = `${base}/assets/css/style.css`;
  const first = await fetch(asset), etag = first.headers.get('etag');
  assert.equal(first.status, 200); assert.ok(etag); await first.text();
  const cached = await fetch(asset, { headers: { 'If-None-Match': etag } });
  assert.equal(cached.status, 304); assert.equal(await cached.text(), '');
  write('assets/css/style.css', 'body { color: blue; }');
  const updated = await fetch(asset, { headers: { 'If-None-Match': etag } });
  assert.equal(updated.status, 200); assert.notEqual(updated.headers.get('etag'), etag);
  assert.match(await updated.text(), /blue/);
  const data = await fetch(`${base}/api/media`, { headers: { 'If-None-Match': '*' } });
  assert.equal(data.status, 200); assert.equal(data.headers.get('cache-control'), 'no-store');
  assert.equal((await fetch(`${base}/.git/config`, { headers: { 'If-None-Match': '*' } })).status, 404);
});

test('un brouillon conserve les titres et reste hors du site public', t => {
  const { store,root } = fixture(t), saved = store.saveArticle(article());
  assert.equal(saved.status,'draft'); assert.equal(saved.content[0].level,2); assert.equal(saved.content[2].level,3);
  assert.deepEqual(store.catalog(),[]);
  assert.equal(fs.existsSync(path.join(root,'data/articles/un-article.json')),false);
  assert.equal(store.listArticles()[0].blocks,6);
  assert.ok(saved.revision);
});
test('publication, modification et retour au brouillon synchronisent les fichiers', t => {
  const { store,root } = fixture(t);
  const saved = store.saveArticle(article());
  const published = store.saveArticle({ ...saved,status:'published' },saved.slug);
  assert.equal(store.catalog()[0].slug,saved.slug);
  assert.equal(fs.existsSync(path.join(root,'.blog-manager/drafts/un-article.json')),false);
  const edited = store.saveArticle({ ...published,title:'Nouveau titre' },published.slug);
  assert.equal(store.catalog()[0].title,'Nouveau titre');
  store.saveArticle({ ...edited,status:'draft' },edited.slug);
  assert.deepEqual(store.catalog(),[]);
  assert.equal(fs.existsSync(path.join(root,'data/articles/un-article.json')),false);
});
test('mettre à la une un article retire le précédent de la une sans le supprimer', t => {
  const { store } = fixture(t);
  store.saveArticle(article({ status:'published',featured:true }));
  store.saveArticle(article({ slug:'second',status:'published',featured:true }));
  assert.equal(store.getArticle('un-article').featured,false);
  assert.equal(store.getArticle('second').featured,true);
  assert.equal(store.catalog().filter(a => a.important).length,1);
  assert.equal(store.catalog().length,2);
});
test('une édition périmée ou une adresse déjà utilisée ne remplace aucun article', t => {
  const { store } = fixture(t);
  const saved = store.saveArticle(article());
  store.saveArticle({ ...saved,title:'Version récente' },saved.slug);
  assert.throws(() => store.saveArticle({ ...saved,title:'Version ancienne' },saved.slug), /modifié ailleurs/);
  assert.throws(() => store.saveArticle(article({ slug:'UN-ARTICLE' })), /déjà utilisée/);
  assert.equal(store.getArticle(saved.slug).title,'Version récente');
});
test('les entrées invalides ne créent pas de fichiers', t => {
  const { store } = fixture(t);
  for (const bad of [{ slug:'../secret' },{title:''},{date:'hier'},{status:'unknown'}, { image:'https://example.org/a.png' },
    { content:[{type:'heading',level:1,text:'Titre'}] }, { content:[{type:'script',text:'alert(1)'}] }, { content:[{type:'image',src:'assets/images/missing.png',alt:'',caption:''}] }]) {
    assert.throws(() => store.saveArticle(article(bad)));
  }
  assert.equal(store.listArticles().length,0);
});
test('la suppression puis la restauration récupèrent un article et son catalogue', t => {
  const { store } = fixture(t);
  const saved = store.saveArticle(article({status:'published'}));
  store.deleteArticle(saved.slug,saved.revision);
  assert.equal(store.catalog().length,0);
  assert.throws(() => store.getArticle(saved.slug), /introuvable/);
  const operation = store.history().find(item => item.label.startsWith('Suppression'));
  store.restore(operation.id);
  assert.equal(store.getArticle(saved.slug).title,saved.title);
  assert.equal(store.catalog().length,1);
  assert.ok(store.history().some(item => item.label.startsWith('Restauration')));
});
test('une restauration ancienne ne peut pas écraser une édition récente', t => {
  const { store } = fixture(t);
  const saved = store.saveArticle(article({status:'published'})), creation = store.history()[0];
  store.saveArticle({...saved,title:'Version récente'},saved.slug);
  assert.equal(store.history().find(item => item.id === creation.id).canRestore,false);
  assert.throws(() => store.restore(creation.id), /fichiers ont changé/);
});
test('les imports homonymes reçoivent des noms distincts et le remplacement est récupérable', t => {
  const { store } = fixture(t);
  const first = store.uploadMedia({name:'Ma photo.png',data:png.toString('base64')});
  const second = store.uploadMedia({name:'Ma photo.png',data:png.toString('base64')});
  assert.equal(first.path,'assets/images/ma-photo.png'); assert.equal(second.path,'assets/images/ma-photo-2.png');
  const changed = Buffer.concat([png,Buffer.from('test')]);
  store.uploadMedia({name:'autre.png',data:changed.toString('base64'),replace:first.path,revision:first.revision});
  assert.deepEqual(store.bytes(first.path),changed);
  const backup = store.history().find(item => item.label.startsWith('Remplacement'));
  store.restore(backup.id);
  assert.deepEqual(store.bytes(first.path),png);
});
test('les images utilisées par un brouillon et les visuels du blog ne peuvent pas être supprimés', t => {
  const { store } = fixture(t);
  const imported = store.uploadMedia({name:'brouillon.png',data:png.toString('base64')});
  store.saveArticle(article({image:imported.path}));
  assert.throws(() => store.deleteMedia(imported.path,imported.revision), /utilisée/);
  const icon = store.listMedia().find(m => m.path.endsWith('test.png'));
  assert.throws(() => store.deleteMedia(icon.path,icon.revision), /utilisée/);
  assert.ok(store.listMedia().find(m => m.path === imported.path).usedBy.includes('Un article (brouillon)'));
});
test('une image désormais utilisée ne peut pas être retirée en annulant son import', t => {
  const { store } = fixture(t);
  const imported = store.uploadMedia({name:'nouvelle.png',data:png.toString('base64')}), backup = store.history()[0];
  store.saveArticle(article({image:imported.path}));
  assert.throws(() => store.restore(backup.id), /maintenant utilisée/);
});
test('suppression et récupération d’une image inutilisée', t => {
  const { store } = fixture(t);
  const imported = store.uploadMedia({name:'inutile.png',data:png.toString('base64')});
  store.deleteMedia(imported.path,imported.revision);
  assert.equal(store.bytes(imported.path),null);
  store.restore(store.history().find(m => m.label.startsWith('Suppression')).id);
  assert.deepEqual(store.bytes(imported.path),png);
});
test('les faux fichiers image et les SVG actifs sont refusés', t => {
  const { store } = fixture(t);
  for (const [name,source] of [['image.png','<script>bad</script>'], ['image.svg','<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    ['image.svg','<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'], ['image.html','<svg></svg>']]) {
    assert.throws(() => store.uploadMedia({name,data:Buffer.from(source).toString('base64')}));
  }
  const safe = store.uploadMedia({name:'icone.svg',data:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>').toString('base64')});
  assert.ok(safe.path.endsWith('.svg'));
});
test('les réglages conservent les images choisies et détectent les éditions concurrentes', t => {
  const { store } = fixture(t), settings = store.getSettings();
  store.saveSettings({...settings,title:'Autre nom'});
  assert.equal(store.getSettings().title,'Autre nom');
  assert.throws(() => store.saveSettings(settings), /réglages ont changé/);
  assert.throws(() => store.saveSettings({...store.getSettings(),github:'javascript:alert(1)'}), /https/);
});
test('les sorties de dossier et les liens de fichiers sont refusés', t => {
  const { store,root } = fixture(t);
  for (const value of ['../package.json','assets/../data/site.json','C:/Windows/win.ini','assets\\images\\test.png']) assert.throws(() => store.file(value));
  try {
    fs.symlinkSync(path.join(root,'data'),path.join(root,'assets/images/linked'),'junction');
    assert.throws(() => store.file('assets/images/linked/site.json'), /liens/);
  } catch (error) { if (error.code !== 'EPERM') throw error; }
});
test('une erreur pendant l’écriture rétablit le catalogue et les articles', t => {
  const { store } = fixture(t);
  const saved = store.saveArticle(article({status:'published'}));
  const before = store.bytes('data/articles/un-article.json'), catalog = store.bytes('data/articles.json');
  const original = fs.renameSync;
  let injected = false;
  fs.renameSync = (source,target) => {
    if (!injected && target.endsWith(path.join('data','articles.json'))) { injected = true; throw new Error('Disque indisponible'); }
    return original(source,target);
  };
  try { assert.throws(() => store.saveArticle({...saved,title:'Modification interrompue'},saved.slug),/Disque/); }
  finally { fs.renameSync = original; }
  assert.deepEqual(store.bytes('data/articles/un-article.json'),before);
  assert.deepEqual(store.bytes('data/articles.json'),catalog);
});
test('une opération interrompue est récupérée au prochain lancement', t => {
  const { store,root,write } = fixture(t);
  const before = store.bytes('data/site.json'), id = '2026-11-13T12-00-00.000Z-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  write(`.blog-manager/backups/${id}/0.bin`,before);
  write(`.blog-manager/backups/${id}/manifest.json`,JSON.stringify({id,label:'Test',state:'pending',entries:[{path:'data/site.json',before:'0.bin',beforeHash:createHash('sha256').update(before).digest('hex'),afterHash:'incomplete'}]}));
  write('data/site.json','{"title":"Incomplet"}');
  const recovered = createStore(root);
  assert.equal(recovered.getSettings().title,'Blog');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,`.blog-manager/backups/${id}/manifest.json`))).state,'recovered');
});
test('export et archive contiennent seulement les fichiers publics, sans brouillons ni utilitaire', t => {
  const { store,root } = fixture(t);
  store.saveArticle(article({slug:'public',status:'published'}));
  store.saveArticle(article({slug:'secret'}));
  const result = build(root);
  assert.ok(result.files > 0);
  assert.ok(fs.existsSync(path.join(root,'dist/data/articles/public.json')));
  assert.equal(fs.existsSync(path.join(root,'dist/data/articles/secret.json')),false);
  assert.equal(fs.existsSync(path.join(root,'dist/_manager')),false);
  const zip = zipSite(root), names = [];
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const length = zip.readUInt32LE(offset+18), nameLength = zip.readUInt16LE(offset+26), extra = zip.readUInt16LE(offset+28);
    names.push(zip.toString('utf8',offset+30,offset+30+nameLength));
    offset += 30+nameLength+extra+length;
  }
  assert.deepEqual(names,[...publicFiles(root),'partage/public/index.html','.nojekyll']);
  const share = fs.readFileSync(path.join(root,'dist/partage/public/index.html'),'utf8');
  assert.match(share, /property="og:title" content="Un article"/);
  assert.match(share, /property="og:image" content="https:\/\/sacez53\.github\.io\/sachaphoto_blog\/assets\/images\/test\.png"/);
  assert.match(share, /<base href="\.\.\/\.\.\/">/);
  assert.doesNotMatch(share, /http-equiv="refresh"/);
  assert.ok(!names.some(name => name.includes('secret') || name.includes('_manager') || name.includes('backups')));
});
test('un article programmé reste hors du catalogue, des pages et du ZIP avant son échéance', t => {
  const { store, root } = fixture(t);
  const publishAt = '2035-06-12T12:00:00+02:00', due = Date.parse(publishAt);
  store.saveArticle(article({ slug: 'maintenant', status: 'published', featured: true }));
  const future = store.saveArticle(article({ slug: 'demain', status: 'published', publishAt, featured: true }));
  assert.equal(future.publishAt, publishAt);
  assert.equal(store.catalog().find(item => item.slug === 'maintenant').featured, true);
  assert.equal(isPublicationDue(future, due - 1), false); assert.equal(isPublicationDue(future, due), true);
  build(root, due - 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'dist/data/articles.json'))).map(item => item.slug), ['maintenant']);
  assert.equal(fs.existsSync(path.join(root, 'dist/data/articles/demain.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'dist/partage/demain/index.html')), false);
  const zip = zipSite(root, due - 1);
  assert.equal(zip.includes(Buffer.from('data/articles/demain.json')), false);
  assert.equal(zip.includes(Buffer.from('partage/demain/index.html')), false);
  build(root, due);
  assert.ok(fs.existsSync(path.join(root, 'dist/data/articles/demain.json')));
  assert.ok(fs.existsSync(path.join(root, 'dist/partage/demain/index.html')));
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'dist/data/articles.json')));
  assert.equal(catalog.filter(item => item.featured).length, 1);
  assert.equal(catalog.find(item => item.featured).slug, 'demain');
  build(root, due - 1);
  assert.equal(fs.existsSync(path.join(root, 'dist/data/articles/demain.json')), false);
});

test('la programmation exige un fuseau horaire et un brouillon reste privé après son échéance', t => {
  const { store, root } = fixture(t);
  assert.throws(() => store.saveArticle(article({publishAt:'2035-06-12T12:00'})), /publication invalide/);
  assert.throws(() => store.saveArticle(article({publishAt:'invalide'})), /publication invalide/);
  store.saveArticle(article({publishAt:'2020-01-01T00:00:00Z'}));
  assert.ok(!publicFiles(root).some(name => name.includes('un-article')));
  assert.equal(isPublicationDue({publishAt:'2035-12-12T12:00:00+01:00'}, Date.parse('2035-12-12T11:00:00Z')), true);
});

test('les catégories et mots-clés restent dans l’article et le catalogue', t => {
  const {store} = fixture(t);
  const saved = store.saveArticle(article({status:'published',category:'Nature',tags:['forêt','oiseaux']}));
  assert.equal(saved.category,'Nature');
  assert.deepEqual(store.catalog()[0].tags,['forêt','oiseaux']);
  assert.throws(() => store.saveArticle(article({slug:'autre',tags:Array(21).fill('mot')})),/20 mots-clés/);
});
test('une galerie est enregistrée, protège ses images et reste récupérable', t => {
  const {store} = fixture(t);
  const image = store.uploadMedia({name:'galerie.png',data:png.toString('base64')});
  const saved = store.saveArticle(article({status:'published',content:[{type:'gallery',images:[{src:image.path,alt:'Un oiseau',caption:'Au matin'}]}]}));
  assert.deepEqual(store.getArticle(saved.slug).content[0].images,[{src:image.path,alt:'Un oiseau',caption:'Au matin'}]);
  assert.throws(() => store.deleteMedia(image.path,image.revision),/utilisée/);
  assert.throws(() => store.saveArticle(article({slug:'vide',content:[{type:'gallery',images:[]}]})), /entre 1 et 50/);
  store.deleteArticle(saved.slug,saved.revision);
  store.restore(store.history().find(item => item.label.startsWith('Suppression :')).id);
  assert.equal(store.getArticle(saved.slug).content[0].images[0].caption,'Au matin');
});
test('la vérification signale les descriptions manquantes et exclut les brouillons', t => {
  const {store} = fixture(t);
  store.saveArticle(article({status:'published',excerpt:'',image:'',content:[{type:'gallery',images:[{src:'assets/images/test.png',alt:'',caption:''}]},{type:'paragraph',text:'[site](https://example.org)',format:'markdown'}]}));
  store.saveArticle(article({slug:'brouillon',excerpt:'',image:''}));
  const report = checkSite(store);
  assert.equal(report.published,1); assert.equal(report.drafts,1); assert.equal(report.externalLinks,1);
  assert.ok(report.issues.some(issue => issue.detail.includes('résumé')));
  assert.ok(report.issues.some(issue => issue.detail.includes('couverture')));
  assert.ok(report.issues.some(issue => issue.detail.includes('lecteurs d’écran')));
  assert.ok(report.issues.every(issue => issue.slug !== 'brouillon'));
});
test('la page À propos conserve ses valeurs après la modification des réglages', t => {
  const {store} = fixture(t);
  const settings = store.getSettings();
  const saved = store.saveSettings({...settings,aboutTitle:'Mon histoire',aboutIntro:'Premier paragraphe.\n\nDeuxième paragraphe.'});
  assert.equal(saved.aboutTitle,'Mon histoire');
  assert.equal(saved.aboutIntro,'Premier paragraphe.\n\nDeuxième paragraphe.');
  assert.throws(() => store.saveSettings({...saved,siteUrl:'javascript:alert(1)'}),/HTTPS/);
});
test('le serveur exige une session locale et masque ses fichiers privés', async t => {
  const { root } = fixture(t), {server,url} = await startServer({root,port:0});
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = new URL(url).origin;
  const session = await (await fetch(`${base}/api/session`)).json();
  assert.ok(session.token);
  const call = (route,headers={},method='POST',data={}) => fetch(`${base}${route}`,{method,headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
  assert.equal((await call('/api/articles',{},'POST',article())).status,403);
  assert.equal((await call('/api/articles',{'X-Blog-Token':session.token,Origin:'https://evil.invalid'},'POST',article())).status,403);
  assert.equal((await call('/api/articles',{'X-Blog-Token':session.token},'POST',article())).status,201);
  assert.equal((await fetch(`${base}/data/articles/un-article.json`)).status,404);
  for (const route of ['/.git/config','/.blog-manager/drafts/un-article.json','/_manager/server.mjs','/package.json','/assets/images/..%2f..%2f..%2fpackage.json']) assert.ok((await fetch(`${base}${route}`)).status >= 400);
  assert.equal((await fetch(`${base}/manager/`)).status,200);
  const wrongHost = await new Promise((resolve,reject) => {
    const request = http.request(`${base}/api/session`,{headers:{Host:'attacker.invalid'}},response => { resolve(response.statusCode); response.resume(); });
    request.on('error',reject); request.end();
  });
  assert.equal(wrongHost,403);
});
test('un catalogue illisible ne peut pas être remplacé par une liste vide', t => {
  const {store,write} = fixture(t);
  write('data/articles.json','{broken');
  assert.throws(() => store.saveArticle(article({status:'published'})), /JSON invalide/);
  assert.equal(store.bytes('data/articles/un-article.json'),null);
});

test('les albums persistent, partagent les photos et restent hors de l’export public', t => {
  const { store, root } = fixture(t), initial = store.getAlbums();
  assert.deepEqual(initial, { albums: [], revision: null });
  const saved = store.saveAlbums({ ...initial, albums: [
    { id: 'sortie', name: 'Sortie photo', images: ['assets/images/test.png', 'assets/images/test.png'] },
    { id: 'selection', name: 'Sélection', images: ['assets/images/test.png'] }
  ] });
  assert.equal(saved.albums[0].images.length, 1);
  assert.deepEqual(createStore(root).getAlbums(), saved);
  const renamed = store.saveAlbums({ ...saved, albums: saved.albums.map(album => ({ ...album, name: album.name + ' 2026' })) });
  store.saveAlbums({ ...renamed, albums: [renamed.albums[1]] });
  assert.ok(store.bytes('assets/images/test.png'));
  assert.ok(publicFiles(root).every(name => !name.includes('albums.json')));
  assert.ok(!zipSite(root).includes(Buffer.from('.blog-manager/albums.json')));
});

test('les albums refusent les éditions périmées et les références invalides', t => {
  const { store } = fixture(t), initial = store.getAlbums();
  store.saveAlbums({ ...initial, albums: [{ id: 'sortie', name: 'Sortie', images: [] }] });
  assert.throws(() => store.saveAlbums({ ...initial, albums: [] }), /albums ont changé/);
  const current = store.getAlbums();
  for (const albums of [
    [{ id: '../bad', name: 'Sortie', images: [] }], [{ id: 'sortie', name: ' ', images: [] }],
    [{ id: 'sortie', name: 'Sortie', images: ['assets/images/absente.png'] }],
    [{ id: 'sortie', name: 'Sortie', images: ['../secret.png'] }],
    [{ id: 'a', name: 'Sortie', images: [] }, { id: 'b', name: 'SORTIE', images: [] }],
    [{ id: 'a', name: 'A', images: [] }, { id: 'a', name: 'B', images: [] }]
  ]) assert.throws(() => store.saveAlbums({ ...current, albums }));
  assert.deepEqual(store.getAlbums(), current);
});

test('l’import dans un album est atomique et peut être annulé', t => {
  const { store } = fixture(t);
  store.saveAlbums({ ...store.getAlbums(), albums: [{ id: 'sortie', name: 'Sortie', images: [] }] });
  const imported = store.uploadMedia({ name: 'photo.png', data: png.toString('base64'), albumId: 'sortie' });
  assert.deepEqual(store.getAlbums().albums[0].images, [imported.path]);
  store.restore(store.history().find(item => item.label.startsWith('Import')).id);
  assert.deepEqual(store.getAlbums().albums[0].images, []);
  assert.equal(store.bytes(imported.path), null);
  assert.throws(() => store.uploadMedia({ name: 'absent.png', data: png.toString('base64'), albumId: 'absent' }), /n’existe plus/);
  assert.equal(store.bytes('assets/images/absent.png'), null);
});

test('supprimer et restaurer une photo restaure aussi ses appartenances aux albums', t => {
  const { store } = fixture(t), imported = store.uploadMedia({ name: 'photo.png', data: png.toString('base64') });
  store.saveAlbums({ ...store.getAlbums(), albums: [{ id: 'sortie', name: 'Sortie', images: [imported.path] }] });
  store.deleteMedia(imported.path, imported.revision);
  assert.deepEqual(store.getAlbums().albums[0].images, []);
  store.restore(store.history().find(item => item.label.startsWith('Suppression')).id);
  assert.deepEqual(store.getAlbums().albums[0].images, [imported.path]);
  assert.deepEqual(store.bytes(imported.path), png);
});

test('la restauration ne laisse pas un album avec une image supprimée', t => {
  const { store } = fixture(t), imported = store.uploadMedia({ name: 'photo.png', data: png.toString('base64') });
  const upload = store.history().find(item => item.label.startsWith('Import'));
  store.saveAlbums({ ...store.getAlbums(), albums: [{ id: 'sortie', name: 'Sortie', images: [imported.path] }] });
  assert.throws(() => store.restore(upload.id), /appartient maintenant à un album/);
  assert.ok(store.bytes(imported.path));
});

test('un fichier d’albums corrompu est conservé sans écrasement', t => {
  const { store, write } = fixture(t);
  for (const value of ['{broken', '{}', '[{"id":"a","name":"A","images":null}]']) {
    write('.blog-manager/albums.json', value);
    assert.throws(() => store.saveAlbums({ revision: null, albums: [] }));
    assert.equal(store.bytes('.blog-manager/albums.json').toString(), value);
  }
});

test('le serveur expose les albums avec protection de session et sert le créateur de carrousels', async t => {
  const { root, write } = fixture(t);
  write('_manager/public/carousel.js', fs.readFileSync(path.join(projectRoot, '_manager/public/carousel.js')));
  const { server, url } = await startServer({ root, port: 0 });
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = new URL(url).origin, { token } = await (await fetch(`${base}/api/session`)).json();
  const initial = await (await fetch(`${base}/api/albums`)).json();
  const body = JSON.stringify({ ...initial, albums: [{ id: 'sortie', name: 'Sortie', images: [] }] });
  assert.equal((await fetch(`${base}/api/albums`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body })).status, 403);
  const response = await fetch(`${base}/api/albums`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Blog-Token': token }, body });
  assert.equal(response.status, 200); assert.equal((await response.json()).albums[0].name, 'Sortie');
  assert.equal((await fetch(`${base}/.blog-manager/albums.json`)).status, 404);
  const script = await fetch(`${base}/manager/carousel.js`);
  assert.equal(script.status, 200); assert.match(script.headers.get('content-type'), /javascript/);
});
