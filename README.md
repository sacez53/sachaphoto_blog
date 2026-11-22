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
- Galerie photo : ajoutez des images de la médiathèque, puis réglez leur ordre, leur description et leur légende. Un clic sur une photo ouvre le fichier en grand.

Les flèches déplacent les blocs. Vous pouvez aussi les dupliquer ou les supprimer. « Aperçu » montre le résultat avec le style du blog, sur ordinateur ou mobile. Les marques de gras, d’italique et de lien restent visibles pendant la saisie ; elles sont mises en forme dans l’aperçu et dans l’article.

« Enregistrer » ou Ctrl+S écrit les fichiers. Un article « Dans le blog » apparaît dans le site local et le prochain export dès que sa date de publication est atteinte. Un « Brouillon privé » reste dans `.blog-manager/drafts/` et n’est pas exporté. Passer un article existant en brouillon le retire du catalogue et de la prochaine version publique. « Date de l’article » règle la date affichée dans le texte.

« Publication à partir du » règle la date et l’heure de mise en ligne. Le fuseau de votre ordinateur est indiqué sous le champ ; l’heure est enregistrée avec son fuseau pour que GitHub et les visiteurs utilisent le même instant. Laissez le champ vide pour publier au prochain déploiement. Pour programmer, choisissez « Dans le blog », renseignez la date puis enregistrez. Le filtre « Programmés » retrouve les articles en attente.

Avant l’échéance, l’export exclut l’article du catalogue public et ne contient ni son fichier JSON ni sa page de partage. Les brouillons restent exclus même après leur date. Les photos de la médiathèque restent incluses dans l’export. Dans un dépôt GitHub public, les fichiers sources restent consultables dans le dépôt.

La saisie d’un article est également conservée dans ce navigateur. Après une fermeture ou une coupure, rouvrez le même article pour la reprendre. Cette copie n’est pas un enregistrement dans le blog. Les réglages du site doivent être enregistrés avant de quitter leur page.

## Gérer les images et le blog

« Médiathèque » permet d’importer plusieurs images ou de les glisser dans la page. Formats acceptés : JPG, PNG, WebP, GIF, AVIF, SVG sans contenu actif et ICO, jusqu’à 20 Mo par fichier. Un nom déjà utilisé reçoit un suffixe ; aucun fichier n’est écrasé lors d’un import.

Cliquez sur une image pour voir ses utilisations, la remplacer ou la supprimer. Le remplacement garde son adresse et son format. La suppression est refusée tant que l’image est utilisée par un article, un brouillon ou les réglages. Les visuels de secours présents dans les pages HTML sont également protégés.

La médiathèque et le sélecteur de photos affichent les images par lots de 48. « Afficher plus d’images » charge le lot suivant. La recherche porte sur toute la collection ; « Sélectionner les résultats » concerne tous les résultats, même ceux qui ne sont pas encore affichés.

Le gestionnaire garde en mémoire les empreintes des photos inchangées et vérifie les fichiers à chaque actualisation. Les photos remplacées sont recalculées. Le navigateur réutilise aussi les fichiers locaux inchangés après vérification auprès du serveur. Les aperçus de carrousel attendent une courte pause dans la saisie avant leur recalcul.

Dans « Médiathèque », « Nouvel album » crée un classement par reportage ou projet. Vous pouvez sélectionner des photos puis les ajouter à un album. Une photo peut appartenir à plusieurs albums sans être copiée. Le filtre « Sans album » retrouve les images à classer. Les recherches et les filtres d’utilisation fonctionnent aussi dans un album.

Lorsque vous ouvrez un album, les nouvelles images importées y sont ajoutées. « Retirer de cet album » conserve le fichier dans la médiathèque. Renommer ou supprimer un album ne change pas les images des articles. Le classement est enregistré sur cet ordinateur et peut être restauré depuis « Sauvegardes ».

Dans un bloc « Galerie photo », « Ajouter des photos / un album » permet de filtrer par album puis de sélectionner plusieurs images. Elles sont insérées dans l’ordre de la sélection, avec une limite de 50 photos par galerie. Les albums sont aussi disponibles pour choisir une couverture ou une image de story.

« Le blog » permet de changer le portrait et l’icône du navigateur, le nom du site, sa description, la fiche auteur, les liens de contact et le texte du pied de page.

Dans « Le blog », la section « Page À propos » permet aussi de modifier le titre, la présentation, le parcours et le texte de contact. Séparez les paragraphes par une ligne vide, puis enregistrez les réglages.

Dans chaque article, renseignez une catégorie et des mots-clés séparés par des virgules. Les visiteurs peuvent filtrer la page des articles avec ces champs. Les articles existants restent visibles même sans classement.

La page d’un article propose jusqu’à trois articles liés, choisis parmi les articles publiés qui partagent sa catégorie ou ses mots-clés. Si aucun article ne correspond, la section reste masquée.

« Vérifier le site » contrôle les articles enregistrés avant la mise en ligne. Le rapport signale les fichiers d’image manquants, les descriptions et résumés absents, ainsi que les liens internes vers des articles absents. Les liens externes sont comptés mais ne sont pas vérifiés. La même vérification s’affiche avant l’export ; les brouillons ne sont pas inclus dans le contrôle des articles publiés.

Lors d’un déploiement GitHub Pages, les erreurs de fichiers manquants empêchent le déploiement. Les points à vérifier, comme un résumé manquant, restent des avertissements.

« Aperçu du partage » montre le titre, le résumé et l’image de couverture. Copiez le lien proposé et partagez-le après avoir mis en ligne un nouvel export. Les réseaux sociaux peuvent conserver leur ancienne vignette en cache. L’adresse publique du blog se règle dans « Le blog » ; vérifiez-la si votre hébergement change.

Dans l’éditeur d’un article, « Créer une story » prépare une image PNG verticale de 1080 × 1920 pixels. La photo est encadrée au-dessus du titre, comme sur le blog. Vous pouvez changer la photo, son cadrage, les textes et le style, puis télécharger le visuel. Cette création ne modifie pas l’article. Le lien copié devient utilisable une fois l’article et le nouvel export mis en ligne. Pour un lien cliquable dans la story, ajoutez le sticker « Lien » dans Instagram.

Les stories et les carrousels reprennent la typographie du blog, avec ses liens bleus et ses séparateurs gris. Ils utilisent la même police Inter, incluse dans les fichiers du projet pour les exports hors connexion. Le style clair est sélectionné par défaut ; une variante sombre est disponible. Les anciennes préparations de carrousels adoptent ce style à leur prochaine ouverture en conservant leurs pages et leurs textes.

Dans le carrousel, « Dégradé du fond » propose quatre palettes : bleu et lavande, sauge et bleu, pêche et rose, lilas et rose. Les teintes s’adaptent au style clair ou sombre et s’appliquent à toutes les pages, y compris dans les PNG téléchargés. Le choix reste enregistré avec la préparation. « Sans dégradé » permet de retrouver le fond uni.

« Créer un carrousel » prépare une proposition à partir du titre et du contenu de l’article. Choisissez un format portrait de 1080 × 1350 pixels ou carré de 1080 × 1080 pixels. Chaque page peut contenir une couverture, une photo avec sa légende ou un extrait de texte. Modifiez son contenu, choisissez son cadrage et déplacez-la avec les flèches. « Ajouter des photos » permet de sélectionner des images dans un album. L’outil accepte de 2 à 20 pages par carrousel.

« Préparer la publication Instagram » propose une légende à partir du titre et du résumé, avec le lien vers le blog. Modifiez-la avant de la copier. Chaque page a aussi un champ « Texte alternatif » : décrivez sa photo et les informations utiles pour un lecteur d’écran. Les descriptions des photos de l’article sont reprises quand elles existent. Ces textes ne sont pas imprimés sur les images.

« Télécharger le carrousel ZIP » regroupe les images PNG numérotées et le fichier `publication-instagram.txt`, avec la légende et le texte alternatif de chaque page. « Télécharger les textes » récupère ce fichier seul. Extrayez l’archive, puis sélectionnez les images dans cet ordre dans Instagram. Un texte visible qui dépasse une page bloque le téléchargement jusqu’à sa correction. La préparation reste dans le même navigateur, pour cet article ; « Repartir de l’article » crée de nouvelles pages. Le carrousel ne modifie pas l’article et n’est pas publié automatiquement sur Instagram.

## Récupérer une version précédente

Chaque opération conserve les fichiers précédents dans `.blog-manager/backups/`. L’écran « Sauvegardes » permet d’annuler une opération. Si ses fichiers ont changé depuis, annulez d’abord les opérations plus récentes qui les concernent. Une restauration est elle-même sauvegardée. Ne supprimez pas ce dossier si vous souhaitez garder cet historique.

Les modifications effectuées depuis plusieurs onglets sont vérifiées avant chaque enregistrement pour éviter d’écraser une version plus récente. En cas de coupure pendant une écriture, le prochain lancement rétablit l’état précédent.

## Mettre le blog en ligne

Le gestionnaire modifie ce dossier sur votre ordinateur. Il n’envoie rien automatiquement sur Internet.

« Exporter le site » télécharge une archive `sachaphoto-blog.zip` et prépare le dossier `dist/`. L’export contient les pages publiques, les articles présents dans le blog et les assets. Il exclut le gestionnaire, les brouillons et les sauvegardes. Vous pouvez envoyer les fichiers de l’archive à votre hébergeur.

Le workflow GitHub Pages exécute les tests et prépare `dist/` avant le déploiement, lors d’un push sur `main`. Il demande aussi un passage planifié toutes les 15 minutes et ne déploie que si un article est arrivé à échéance. Le fichier du workflow et les articles programmés doivent avoir été envoyés sur la branche par défaut de GitHub. L’ordinateur n’a ensuite pas besoin de rester allumé.

Sur GitHub Pages, les images sont réduites à 2048 pixels (640 pour le portrait) et leurs métadonnées sont retirées. Les originaux du dossier `assets/images/` ne sont pas modifiés, mais restent téléchargeables dans un dépôt public. L’archive ZIP du gestionnaire contient aussi les originaux.

GitHub Actions retarde souvent les passages planifiés, parfois de plusieurs heures : prévoyez une marge pour une publication à heure précise, ou lancez le workflow à la main depuis l’onglet Actions. Dans un dépôt public, GitHub désactive les tâches planifiées après 60 jours sans activité ; réactivez alors le workflow dans l’onglet Actions. Un export téléchargé puis déposé manuellement chez un hébergeur ne se reconstruit pas seul : il faut le refaire après l’échéance. Les images de la médiathèque font partie des assets exportés, même si elles ne sont pas utilisées dans un article.

## Commandes de maintenance

```text
npm start       # ouvrir le gestionnaire
npm run serve   # démarrer le serveur au premier plan
npm test        # vérifier les articles et le gestionnaire
npm run check-site # contrôler le contenu publié
npm run build   # préparer le dossier public dist
```

Le serveur écoute uniquement sur `127.0.0.1`. Il n’a pas de mot de passe et n’est pas destiné à être installé sur un serveur public. En cas d’échec du lancement, consultez `.blog-manager/server.log`.

L’ancien outil PowerShell/WPF et ses scripts de diagnostic ont été retirés. Les deux fichiers `.bat` ouvrent le même gestionnaire.
