import { createStore } from './store.mjs';
import { checkSite } from './check.mjs';
import { projectRoot } from './build.mjs';

const report = checkSite(createStore(projectRoot));
for (const issue of report.issues) console.log(`${issue.severity === 'error' ? 'ERREUR' : 'À VÉRIFIER'} — ${issue.title} : ${issue.detail}`);
console.log(`${report.published} article(s) contrôlé(s). ${report.externalLinks} lien(s) externe(s) non vérifié(s).`);
if (report.issues.some(issue => issue.severity === 'error')) process.exitCode = 1;
