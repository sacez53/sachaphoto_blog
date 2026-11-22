// Passage planifié : déployer seulement si le catalogue public attendu diffère du site en ligne.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectRoot, publishedCatalog } from './build.mjs';

export function catalogChanged(expected, live) {
  return JSON.stringify(expected) !== JSON.stringify(live);
}

export async function needsDeploy(root, event, fetcher = fetch, now = Date.now()) {
  if (event !== 'schedule') return { deploy: true, reason: `événement ${event}` };
  const settings = JSON.parse(fs.readFileSync(path.join(root, 'data/site.json'), 'utf8').replace(/^﻿/, ''));
  const siteUrl = settings.siteUrl || 'https://sacez53.github.io/sachaphoto_blog/';
  const base = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
  const expected = publishedCatalog(root, now);
  try {
    const response = await fetcher(new URL('data/articles.json', base), { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) return { deploy: true, reason: `site en ligne : erreur ${response.status}` };
    return catalogChanged(expected, await response.json())
      ? { deploy: true, reason: 'catalogue modifié' }
      : { deploy: false, reason: 'site déjà à jour' };
  } catch (error) {
    // En cas de doute, publier : un déploiement en trop vaut mieux qu'un article manqué.
    return { deploy: true, reason: `site en ligne illisible : ${error.message}` };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { deploy, reason } = await needsDeploy(projectRoot, process.env.GITHUB_EVENT_NAME || 'manual');
  console.log(`Déploiement ${deploy ? 'nécessaire' : 'inutile'} : ${reason}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `deploy=${deploy}\n`);
}
