# Friteries Bruxelles — PWA

PWA JavaScript qui affiche sur une carte les friteries renseignées dans OpenStreetMap pour les 19 communes de la Région de Bruxelles-Capitale.

➡️ **Application en ligne : https://pmeyssonnier.github.io/Friteries/**

## Fonctions

- Carte Leaflet / OpenStreetMap.
- Recherche des friteries via Overpass API au chargement.
- Filtre par les 19 communes bruxelloises.
- Recherche par nom ou adresse.
- Le **nom de chaque friterie est affiché sous son marqueur** sur la carte. Les étiquettes
  sont masquées quand la carte est trop dense (plus de 40 résultats sous le zoom 14) et
  réapparaissent en zoomant ou en filtrant par commune.
- Un clic sur un marqueur ouvre la **fiche complète** de la friterie : adresse, horaires,
  type de cuisine, vente à emporter, téléphone cliquable, site web, puis **Google Maps**,
  **Itinéraire** et **OSM**. Seules les informations réellement présentes dans
  OpenStreetMap sont affichées.
- La liste latérale ouvre la même fiche.
- Quand OSM ne porte aucun tag `addr:*`, la fiche demande l'adresse la plus proche à
  **Nominatim** et l'affiche marquée « approximative ». Uniquement à l'ouverture d'une
  fiche, mise en cache, et espacée d'au moins une seconde : la politique d'usage de
  Nominatim interdit le traitement en masse.
- Géolocalisation facultative de l'utilisateur.
- PWA installable sur Android, Windows, macOS et certains navigateurs desktop.
- Interface responsive téléphone / tablette / ordinateur.

## Lancer en local

Une PWA doit être servie via HTTP/HTTPS (pas simplement ouverte avec `file://`).

Avec Python :

```bash
python -m http.server 8080
```

Puis ouvrir :

```text
http://localhost:8080
```

## Déploiement sur GitHub Pages

### Étape manuelle à faire une seule fois

GitHub n'autorise pas un workflow à créer lui-même le site Pages. Il faut donc l'activer
une fois à la main :

1. Ouvrir **Settings → Pages** du dépôt.
2. Dans **Build and deployment → Source**, choisir **GitHub Actions**.

### Ensuite, c'est automatique

Le workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)
publie la racine du dépôt sur GitHub Pages à chaque push.

Pour publier immédiatement après l'activation, relancer le workflow depuis l'onglet
**Actions → Deploy PWA to GitHub Pages → Run workflow**.

L'URL publiée est :

```text
https://pmeyssonnier.github.io/Friteries/
```

Sur Android/Chrome, utiliser **Installer l'application** ou **Ajouter à l'écran d'accueil**.

### Mise à jour d'une application déjà installée

Le service worker sert les fichiers depuis son cache. À chaque déploiement qui modifie
`app.js` ou `styles.css`, **incrémenter `CACHE_NAME` dans `service-worker.js`** : sans cela
le navigateur ne détecte aucune mise à jour et continue de servir l'ancienne version.
L'application se recharge ensuite une fois d'elle-même pour appliquer la nouvelle version.

Le fichier `.nojekyll` à la racine désactive le traitement Jekyll, afin que tous les
fichiers statiques (dont le service worker et le manifeste) soient servis tels quels.

## Sources de données

- Carte : OpenStreetMap.
- Friteries : OpenStreetMap via Overpass API.
- Région de Bruxelles-Capitale : relation OpenStreetMap `54094`.
- Google Maps est ouvert via une URL standard ; aucune clé API Google n'est nécessaire.

### Critère de sélection

Un établissement est retenu s'il remplit **l'une** de ces conditions (`buildOverpassQuery`
dans `app.js`) :

| Branche | Ce qu'elle attrape |
|---|---|
| `cuisine` ~ `frit\|friet\|fries` | `friture`, `frituur`, `friterie`, `frites`, `fries`, y compris les valeurs multiples type `fries;burger` |
| `amenity` présent + nom évocateur | une friterie taggée `cafe`, `bar`… et pas seulement `fast_food` |
| `shop` présent + nom évocateur | une friterie cartographiée comme commerce plutôt que comme `amenity` |
| `amenity=fast_food` + `cuisine=belgian` | la friterie dont ni le nom ni la cuisine ne mentionnent la frite |

`frit` couvre frite, frites, friture, friterie et frituur ; `friet` couvre frietjes et
frietkot. Les motifs ignorent la casse.

Un même établissement est parfois cartographié deux fois (un point **et** le contour du
bâtiment). Les objets de même nom situés à moins de 60 m sont fusionnés ; les friteries
sans nom en sont exclues, pour ne pas confondre deux baraques voisines et anonymes.

## Limite importante

L'application ne prétend pas disposer d'un registre officiel exhaustif des friteries : elle affiche les établissements correspondant aux tags OpenStreetMap recherchés. Une friterie absente ou mal renseignée dans OSM peut ne pas apparaître.
