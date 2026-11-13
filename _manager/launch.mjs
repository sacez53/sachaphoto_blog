import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { projectRoot } from './build.mjs';

const root = fs.realpathSync(projectRoot);
const major = Number(process.versions.node.split('.')[0]);
if (major < 22) { console.error('Installez Node.js 22 ou plus récent depuis https://nodejs.org.'); process.exit(1); }
const runtime = path.join(root, '.blog-manager');
fs.mkdirSync(runtime, { recursive: true });
const stateFile = path.join(runtime, 'server.json');
async function probe(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(600) });
    if (!response.ok) return false;
    const data = await response.json();
    return data.app === 'sachaphoto-manager-v2' && data.root.toLowerCase() === root.toLowerCase();
  } catch { return false; }
}
async function openBrowser(url) {
  if (process.argv.includes('--no-open')) return true;
  let child;
  if (process.platform === 'win32') {
    child = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { stdio: 'ignore', windowsHide: true });
  } else child = spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' });
  return await new Promise(resolve => {
    const timer = setTimeout(() => { child.unref(); resolve(true); }, 5000);
    child.once('error', () => { clearTimeout(timer); resolve(false); });
    child.once('exit', code => { clearTimeout(timer); resolve(code === 0); });
  });
}
let previous;
try { previous = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch {}
let selected = previous?.port && await probe(previous.port) ? previous.port : null;
if (!selected) {
  for (let port = 4899; port <= 4910; port++) {
    if (await probe(port)) { selected = port; break; }
    const log = fs.openSync(path.join(runtime, 'server.log'), 'a');
    const child = spawn(process.execPath, [fileURLToPath(new URL('./server.mjs', import.meta.url))], {
      cwd: root, env: { ...process.env, BLOG_MANAGER_PORT: String(port), BLOG_MANAGER_ROOT: root },
      detached: true, windowsHide: true, stdio: ['ignore', log, log]
    });
    fs.closeSync(log);
    let exited = false;
    child.on('exit', () => { exited = true; });
    child.on('error', () => { exited = true; });
    child.unref();
    for (let i = 0; i < 30 && !exited; i++) {
      await new Promise(resolve => setTimeout(resolve, 150));
      if (await probe(port)) { selected = port; break; }
    }
    if (!selected && await probe(port)) selected = port;
    if (selected) break;
  }
}
if (!selected) {
  console.error('Démarrage impossible. Consultez .blog-manager/server.log dans le dossier du blog.');
  process.exitCode = 1;
} else {
  fs.writeFileSync(stateFile, JSON.stringify({ port: selected }));
  const url = `http://127.0.0.1:${selected}/manager/`;
  console.log(`Le gestionnaire est prêt : ${url}`);
  if (!await openBrowser(url)) {
    console.error(`Le navigateur ne s'est pas ouvert. Copiez cette adresse dans votre navigateur : ${url}`);
    process.exitCode = 1;
  }
}
