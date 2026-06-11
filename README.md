# Mon Blog Statique

Un blog statique minimaliste, sans backend ni framework, basé sur des fichiers HTML, CSS, JavaScript natif et des données au format JSON.

## Structure du projet

- **`index.html`** : Page d'accueil (affiche l'article à la une et les plus récents).
- **`articles.html`** : Liste chronologique de tous les articles.
- **`article.html`** : Gabarit de lecture d'un article (se remplit dynamiquement via l'URL).
- **`assets/`** : Contient le CSS (`style.css`), le JS (`main.js`, `index.js`, etc.) et les images.
- **`data/`** : Contient l'index global (`articles.json`) et les articles individuels dans le dossier `data/articles/`.

---

## 🛠 Utilitaire de gestion (CLI)

Un utilitaire PowerShell est inclus pour simplifier la gestion de votre blog.
Pour le lancer, **double-cliquez sur `new-article.bat`** ou exécutez `.\new-article.ps1` dans votre invite de commande.

Le menu vous propose 3 options :
1. **Créer un article** : Génère automatiquement le fichier JSON, ajoute la date et l'heure arrondies, gère le slug et met à jour l'index.
2. **Supprimer un article** : Supprime le JSON, l'image associée, met à jour l'index et promeut le plus récent si l'article supprimé était à la une.
3. **Synchroniser articles.json** : Option très utile ! Si vous modifiez manuellement le titre, l'auteur, la date ou le statut "à la une" directement dans le fichier JSON d'un article, lancez cette option pour mettre à jour l'index principal automatiquement.

---

## 📝 Comment écrire un article (Mise en forme JSON)

Les articles sont stockés sous forme de fichiers `.json` individuels (ex: `mon-article.json`).
Voici comment fonctionne la structure de l'article, et particulièrement la section `"content"` qui permet de mettre en page votre texte.

### Structure de base d'un fichier article
```json
{
  "slug": "titre-de-l-article",
  "title": "Le Titre de Mon Article",
  "author": "Votre Nom",
  "date": "2026-06-12T14:30",
  "featured": true,
  "important": true,
  "excerpt": "Le petit résumé affiché sur les cartes d'accueil.",
  "image": "assets/images/titre-de-l-article.png",
  "content": [
      // Les blocs de texte vont ici
  ]
}
```

### Les différents blocs de mise en forme (`content`)

Le contenu de votre article est une liste de **blocs**. Le moteur JavaScript interprète ces blocs et génère le HTML correspondant avec le bon design. Voici les types de blocs supportés :

#### 1. Paragraphe (`paragraph`)
C'est le bloc de texte standard, justifié proprement.
```json
{
    "type": "paragraph",
    "text": "Voici un paragraphe de texte normal. Vous pouvez écrire autant que vous le souhaitez ici."
}
```

#### 2. Titre intermédiaire (`heading`)
Pour structurer votre article en sous-parties. Le niveau (level) détermine la taille du titre (2 = grand, 3 = moyen, 4 = petit).
```json
{
    "type": "heading",
    "level": 2,
    "text": "Mon super sous-titre"
}
```

#### 3. Citation (`quote`)
Pour mettre en valeur une phrase ou citer quelqu'un. Le champ `author` est optionnel.
```json
{
    "type": "quote",
    "text": "La perfection est atteinte, non pas lorsqu'il n'y a plus rien à ajouter, mais lorsqu'il n'y a plus rien à retirer.",
    "author": "Antoine de Saint-Exupéry"
}
```

#### 4. Liste à puces ou numérotée (`list`)
Pour lister des éléments.
```json
{
    "type": "list",
    "ordered": false,
    "items": [
        "Premier élément de la liste",
        "Deuxième élément de la liste",
        "Troisième élément"
    ]
}
```
*(Mettez `"ordered": true` pour avoir une liste numérotée 1, 2, 3...)*

#### 5. Image avec légende (`image`)
Pour insérer une image au milieu du texte. Les champs `alt` (texte alternatif) et `caption` (légende sous l'image) sont optionnels.
```json
{
    "type": "image",
    "src": "assets/images/photo-vacances.jpg",
    "alt": "Une belle plage au coucher du soleil",
    "caption": "Coucher de soleil sur la plage de l'océan"
}
```

### Exemple de contenu complet
Voici à quoi ressemble un tableau `"content"` combinant ces éléments :

```json
"content": [
    {
        "type": "paragraph",
        "text": "Bonjour et bienvenue sur mon nouvel article."
    },
    {
        "type": "heading",
        "level": 2,
        "text": "Première partie"
    },
    {
        "type": "list",
        "ordered": false,
        "items": [
            "J'aime le code",
            "J'aime la nature"
        ]
    },
    {
        "type": "quote",
        "text": "C'est une belle journée !",
        "author": "Moi-même"
    }
]
```

## Pour tester localement
Pour voir le site sur votre ordinateur, les requêtes `fetch()` nécessitent un serveur local. 
- Si vous utilisez VS Code, installez l'extension **Live Server** et faites un clic droit sur `index.html` > *Open with Live Server*.
- Sinon, utilisez `python -m http.server 8080` ou `npx serve`.
