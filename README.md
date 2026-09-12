# Friteries Bruxelles — PWA

PWA JavaScript qui affiche sur une carte les friteries renseignées dans OpenStreetMap pour les 19 communes de la Région de Bruxelles-Capitale.

➡️ **Application en ligne : https://pmeyssonnier.github.io/Friteries/**

## Fonctions

- Carte Leaflet / OpenStreetMap.
- Recherche des friteries via Overpass API au chargement.
- Filtre par les 19 communes bruxelloises.
- Recherche par nom ou adresse.
- Un clic directement sur un marqueur ouvre **Google Maps**.
- La liste latérale permet aussi d'afficher une fiche, puis **Google Maps** ou **Itinéraire**.
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

Le déploiement est **automatique** : le workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)
publie la racine du dépôt sur GitHub Pages à chaque push.

Si c'est le tout premier déploiement, vérifier une fois dans **Settings → Pages** que la
source est bien **GitHub Actions** (le workflow tente de l'activer automatiquement), puis
suivre l'exécution dans l'onglet **Actions**.

L'URL publiée est ensuite :

```text
https://pmeyssonnier.github.io/Friteries/
```

Sur Android/Chrome, utiliser **Installer l'application** ou **Ajouter à l'écran d'accueil**.

Le fichier `.nojekyll` à la racine désactive le traitement Jekyll, afin que tous les
fichiers statiques (dont le service worker et le manifeste) soient servis tels quels.

## Sources de données

- Carte : OpenStreetMap.
- Friteries : OpenStreetMap via Overpass API.
- Région de Bruxelles-Capitale : relation OpenStreetMap `54094`.
- Google Maps est ouvert via une URL standard ; aucune clé API Google n'est nécessaire.

## Limite importante

L'application ne prétend pas disposer d'un registre officiel exhaustif des friteries : elle affiche les établissements correspondant aux tags OpenStreetMap recherchés. Une friterie absente ou mal renseignée dans OSM peut ne pas apparaître.
