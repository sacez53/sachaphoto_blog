# Blog de Sacha G. Photographe

## Ouvrir le gestionnaire

Double-cliquez sur **gerer-blog.bat**. Le navigateur ouvre l’atelier du blog. Node.js 22 ou une version plus récente doit être installé ; aucune installation de paquet n’est nécessaire. Le fichier `new-article.bat` ouvre aussi le nouveau gestionnaire, pour conserver les anciens raccourcis.

Le programme reste actif quand la fenêtre de lancement se ferme. Un second double-clic ouvre le même gestionnaire. Utilisez « Arrêter le gestionnaire » pour le fermer. Si le port habituel est occupé, le lanceur en choisit un autre entre 4899 et 4910.

## Écrire un article

Dans « Articles », choisissez « Nouvel article » ou « Modifier ». Renseignez le titre et le résumé, puis ajoutez des blocs dans le contenu :

- **Titre de section** : H2 pour une section, H3 pour un sous-titre, H4 pour un niveau supplémentaire.
- Paragraphe : texte, gras, italique et liens depuis la barre du bloc.
- Image : choix dans la médiathèque, description et légende.
- Liste à puces ou numérotée, avec un élément par ligne.
- Citation avec un nom d’auteur facultatif.

Les flèches déplacent les blocs. Vous pouvez aussi les dupliquer ou les supprimer. « Aperçu » montre le résultat avec le style du blog, sur ordinateur ou mobile. Les marques de gras, d’italique et de lien restent visibles pendant la saisie ; elles sont mises en forme dans l’aperçu et dans l’article.

« Enregistrer » ou Ctrl+S écrit les fichiers. Un article « Dans le blog » apparaît dans le site local et le prochain export. Un « Brouillon privé » reste dans `.blog-manager/drafts/` et n’est pas exporté. Passer un article existant en brouillon le retire du catalogue et de la prochaine version publique. La date est affichée sur l’article ; elle ne programme pas sa mise en ligne.

La saisie d’un article est également conservée dans ce navigateur. Après une fermeture ou une coupure, rouvrez le même article pour la reprendre. Cette copie n’est pas un enregistrement dans le blog. Les réglages du site doivent être enregistrés avant de quitter leur page.

## Gérer les images et le blog

« Médiathèque » permet d’importer plusieurs images ou de les glisser dans la page. Formats acceptés : JPG, PNG, WebP, GIF, AVIF, SVG sans contenu actif et ICO, jusqu’à 20 Mo par fichier. Un nom déjà utilisé reçoit un suffixe ; aucun fichier n’est écrasé lors d’un import.

Cliquez sur une image pour voir ses utilisations, la remplacer ou la supprimer. Le remplacement garde son adresse et son format. La suppression est refusée tant que l’image est utilisée par un article, un brouillon ou les réglages. Les visuels de secours présents dans les pages HTML sont également protégés.

« Le blog » permet de changer le portrait et l’icône du navigateur, le nom du site, sa description, la fiche auteur, les liens de contact et le texte du pied de page.

Dans « Le blog », la section « Page À propos » permet aussi de modifier le titre, la présentation, le parcours et le texte de contact. Séparez les paragraphes par une ligne vide, puis enregistrez les réglages.

Dans chaque article, renseignez une catégorie et des mots-clés séparés par des virgules. Les visiteurs peuvent filtrer la page des articles avec ces champs. Les articles existants restent visibles même sans classement.

« Aperçu du partage » montre le titre, le résumé et l’image de couverture. Copiez le lien proposé et partagez-le après avoir mis en ligne un nouvel export. Les réseaux sociaux peuvent conserver leur ancienne vignette en cache. L’adresse publique du blog se règle dans « Le blog » ; vérifiez-la si votre hébergement change.

## Récupérer une version précédente

Chaque opération conserve les fichiers précédents dans `.blog-manager/backups/`. L’écran « Sauvegardes » permet d’annuler une opération. Si ses fichiers ont changé depuis, annulez d’abord les opérations plus récentes qui les concernent. Une restauration est elle-même sauvegardée. Ne supprimez pas ce dossier si vous souhaitez garder cet historique.

Les modifications effectuées depuis plusieurs onglets sont vérifiées avant chaque enregistrement pour éviter d’écraser une version plus récente. En cas de coupure pendant une écriture, le prochain lancement rétablit l’état précédent.

## Mettre le blog en ligne

Le gestionnaire modifie ce dossier sur votre ordinateur. Il n’envoie rien automatiquement sur Internet.

« Exporter le site » télécharge une archive `sachaphoto-blog.zip` et prépare le dossier `dist/`. L’export contient les pages publiques, les articles présents dans le blog et les assets. Il exclut le gestionnaire, les brouillons et les sauvegardes. Vous pouvez envoyer les fichiers de l’archive à votre hébergeur.

Le workflow GitHub Pages exécute les tests et prépare `dist/` avant le déploiement, lors d’un push sur `main`. Les images de la médiathèque font partie des assets exportés, même si elles ne sont pas utilisées dans un article.

## Commandes de maintenance

```text
npm start       # ouvrir le gestionnaire
npm run serve   # démarrer le serveur au premier plan
npm test        # vérifier les articles et le gestionnaire
npm run build   # préparer le dossier public dist
```

Le serveur écoute uniquement sur `127.0.0.1`. Il n’a pas de mot de passe et n’est pas destiné à être installé sur un serveur public. En cas d’échec du lancement, consultez `.blog-manager/server.log`.

L’ancien outil PowerShell/WPF et ses scripts de diagnostic ont été retirés. Les deux fichiers `.bat` ouvrent le même gestionnaire.
