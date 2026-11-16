const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../_manager/public/app.js'), 'utf8');
const start = source.indexOf('function storyLines(');
const end = source.indexOf('\nasync function drawStory()', start);
assert.ok(start >= 0 && end > start, 'Le découpage des titres doit être disponible.');
const storyLines = vm.runInNewContext(`(${source.slice(start, end)})`);
const context = { measureText: value => ({width: Array.from(value).length}) };

test('les titres longs sont découpés sans dépasser la largeur disponible', () => {
  const title = 'Photographier les oiseaux au bord de la rivière';
  const lines = Array.from(storyLines(context, title, 16));
  assert.equal(lines.join(' '), title);
  assert.ok(lines.every(line => Array.from(line).length <= 16));
});

test('les mots très longs et les caractères accentués ne sont pas perdus', () => {
  const title = 'Éléphant' + 'x'.repeat(35) + ' forêt';
  const lines = Array.from(storyLines(context, title, 12));
  assert.equal(lines.join('').replace(/\s/g,''), title.replace(/\s/g,''));
  assert.ok(lines.every(line => Array.from(line).length <= 12));
});

test('les retours à la ligne et les titres vides ont un rendu défini', () => {
  assert.deepEqual(Array.from(storyLines(context, 'Premier\n\nSecond', 30)), ['Premier','','Second']);
  assert.deepEqual(Array.from(storyLines(context, '', 30)), ['Titre de votre article']);
});
