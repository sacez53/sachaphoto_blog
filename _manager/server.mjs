import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createStore, UserError } from './store.mjs';
import { projectRoot, publicPages, build, zipSite } from './build.mjs';
import { checkSite } from './check.mjs';

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.avif': 'image/avif', '.woff2': 'font/woff2' };
function body(request) {
  return new Promise((resolve, reject) => {
    let size = 0, tooLarge = false;
    const chunks = [];
    request.on('data', chunk => {
      size += chunk.length;
      if (size > 29 * 1024 * 1024) { tooLarge = true; return; }
      if (!tooLarge) chunks.push(chunk);
    });
    request.on('end', () => {
      if (tooLarge) return reject(new UserError('Fichier trop volumineux (20 Mo maximum par image).', 413));
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new UserError('Requête illisible.')); }
    });
    request.on('error', reject);
  });
}

export async function startServer({ root = projectRoot, port = 4899 } = {}) {
  const store = createStore(root);
  const token = randomBytes(32).toString('hex');
  const server = http.createServer(async (request, response) => {
    const send = (status, value) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(value));
    };
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader('X-Frame-Options', 'SAMEORIGIN');
    try {
      const expectedHost = `127.0.0.1:${server.address().port}`;
      if (request.headers.host !== expectedHost) throw new UserError('Ouvrez le gestionnaire avec son adresse 127.0.0.1.', 403);
      const origin = `http://${expectedHost}`;
      if ((request.headers.origin && request.headers.origin !== origin) || request.headers['sec-fetch-site'] === 'cross-site') throw new UserError('Origine de la requête refusée.', 403);
      const url = new URL(request.url, origin);
      if (url.pathname.startsWith('/api/')) {
        if (request.method === 'GET') {
          if (url.pathname === '/api/health') return send(200, { app: 'sachaphoto-manager-v2', root: store.root });
          if (url.pathname === '/api/session') return send(200, { token, root: store.root });
          if (url.pathname === '/api/articles') return send(200, store.listArticles());
          if (url.pathname.startsWith('/api/articles/')) return send(200, store.getArticle(decodeURIComponent(url.pathname.slice(14))));
          if (url.pathname === '/api/media') return send(200, store.listMedia());
          if (url.pathname === '/api/settings') return send(200, store.getSettings());
          if (url.pathname === '/api/history') return send(200, store.history());
          if (url.pathname === '/api/check') return send(200, checkSite(store));
          throw new UserError('Action introuvable.', 404);
        }
        if (!['POST', 'PUT', 'DELETE'].includes(request.method)) throw new UserError('Méthode refusée.', 405);
        if (request.headers['x-blog-token'] !== token || !request.headers['content-type']?.startsWith('application/json')) throw new UserError('Session expirée. Actualisez la page ; votre saisie est conservée.', 403);
        const input = await body(request);
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new UserError('Requête invalide.');
        if (url.pathname === '/api/articles' && request.method === 'POST') return send(201, store.saveArticle(input));
        if (url.pathname.startsWith('/api/articles/')) {
          const slug = decodeURIComponent(url.pathname.slice(14));
          if (request.method === 'PUT') return send(200, store.saveArticle(input, slug));
          if (request.method === 'DELETE') { store.deleteArticle(slug, input.revision); return send(200, { ok: true }); }
        }
        if (url.pathname === '/api/media') {
          if (request.method === 'POST') return send(201, store.uploadMedia(input));
          if (request.method === 'DELETE') { store.deleteMedia(input.path, input.revision); return send(200, { ok: true }); }
        }
        if (url.pathname === '/api/settings' && request.method === 'PUT') return send(200, store.saveSettings(input));
        if (url.pathname === '/api/restore' && request.method === 'POST') { store.restore(input.id); return send(200, { ok: true }); }
        if (url.pathname === '/api/export' && request.method === 'POST') {
          build(store.root);
          const archive = zipSite(store.root);
          response.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="sachaphoto-blog.zip"', 'Content-Length': archive.length });
          return response.end(archive);
        }
        if (url.pathname === '/api/stop' && request.method === 'POST') {
          send(200, { ok: true });
          server.close();
          server.closeIdleConnections();
          return;
        }
        throw new UserError('Action introuvable.', 404);
      }
      if (!['GET', 'HEAD'].includes(request.method)) throw new UserError('Méthode refusée.', 405);
      let relative = decodeURIComponent(url.pathname).slice(1);
      if (!relative) { response.writeHead(302, { Location: '/manager/' }); response.end(); return; }
      if (relative === 'manager' || relative === 'manager/') relative = '_manager/public/index.html';
      else if (/^manager\/(?:app\.js|style\.css)$/.test(relative)) relative = `_manager/public/${relative.slice(8)}`;
      else if (!publicPages.includes(relative) && !/^(?:assets\/(?:images|css|js)\/[^\\]+|components\/(?:header|footer)\.html|data\/(?:site\.json|articles\.json|articles\/[-a-z0-9]+\.json))$/i.test(relative)) throw new UserError('Fichier introuvable.', 404);
      const type = mime[path.extname(relative).toLowerCase()];
      if (!type) throw new UserError('Fichier introuvable.', 404);
      const value = store.bytes(relative);
      if (!value) throw new UserError('Fichier introuvable.', 404);
      if (relative.startsWith('_manager/')) response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self' about:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'");
      if (type === 'image/svg+xml') response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
      response.writeHead(200, { 'Content-Type': type, 'Content-Length': value.length });
      response.end(request.method === 'HEAD' ? undefined : value);
    } catch (error) {
      if (!error.status) console.error(error);
      if (!response.headersSent) send(error.status || 500, { error: error.status ? error.message : 'Le fichier n’a pas pu être enregistré. Vérifiez les droits du dossier et l’espace disque disponible.' });
      else response.end();
    }
  });
  server.requestTimeout = 60_000;
  server.headersTimeout = 15_000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return { server, store, url: `http://127.0.0.1:${server.address().port}/manager/` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.env.BLOG_MANAGER_PORT || 4899);
  const root = process.env.BLOG_MANAGER_ROOT || projectRoot;
  startServer({ root, port }).then(({ url }) => console.log(`Gestionnaire du blog : ${url}`)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
