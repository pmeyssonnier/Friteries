/* Friteries Bruxelles PWA
 * Carte: Leaflet + OpenStreetMap
 * Données: OpenStreetMap via Overpass API
 * Navigation: Google Maps (sans clé API)
 */

const BRUSSELS_RELATION_ID = 54094;
const BRUSSELS_CENTER = [50.8466, 4.3528];
const DEFAULT_ZOOM = 12;
const LABEL_MIN_ZOOM = 14;
const LABEL_MAX_LABELS = 40;
const UNNAMED = 'Friterie sans nom';

/* « frit » couvre frite, frites, friture, friterie et frituur ; « friet » couvre
 * frietjes et frietkot. Les motifs sont appliqués sans tenir compte de la casse. */
const CUISINE_PATTERN = '(frit|friet|fries)';
const NAME_PATTERN = '(frit|friet|fries|Maison Antoine)';

/* Un même établissement est parfois cartographié à la fois comme point et comme
 * contour de bâtiment : deux objets OSM distincts, donc deux marqueurs. */
const DUPLICATE_RADIUS_M = 60;

const communes = [
  { id: 'all', label: 'Toute la Région de Bruxelles-Capitale', relationId: 54094 },
  { id: 'anderlecht', label: 'Anderlecht', relationId: 58254 },
  { id: 'auderghem', label: 'Auderghem / Oudergem', relationId: 58263 },
  { id: 'berchem', label: 'Berchem-Sainte-Agathe / Sint-Agatha-Berchem', relationId: 60140 },
  { id: 'bruxelles', label: 'Bruxelles-Ville / Brussel-Stad', relationId: 58274 },
  { id: 'etterbeek', label: 'Etterbeek', relationId: 58252 },
  { id: 'evere', label: 'Evere', relationId: 60144 },
  { id: 'forest', label: 'Forest / Vorst', relationId: 58249 },
  { id: 'ganshoren', label: 'Ganshoren', relationId: 58257 },
  { id: 'ixelles', label: 'Ixelles / Elsene', relationId: 58250 },
  { id: 'jette', label: 'Jette', relationId: 58258 },
  { id: 'koekelberg', label: 'Koekelberg', relationId: 58256 },
  { id: 'molenbeek', label: 'Molenbeek-Saint-Jean / Sint-Jans-Molenbeek', relationId: 58255 },
  { id: 'saint-gilles', label: 'Saint-Gilles / Sint-Gillis', relationId: 58248 },
  { id: 'saint-josse', label: 'Saint-Josse-ten-Noode / Sint-Joost-ten-Node', relationId: 58262 },
  { id: 'schaerbeek', label: 'Schaerbeek / Schaarbeek', relationId: 58260 },
  { id: 'uccle', label: 'Uccle / Ukkel', relationId: 58253 },
  { id: 'watermael', label: 'Watermael-Boitsfort / Watermaal-Bosvoorde', relationId: 58264 },
  { id: 'woluwe-lambert', label: 'Woluwe-Saint-Lambert / Sint-Lambrechts-Woluwe', relationId: 60167 },
  { id: 'woluwe-pierre', label: 'Woluwe-Saint-Pierre / Sint-Pieters-Woluwe', relationId: 60168 }
];

const overpassEndpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

const map = L.map('map', { zoomControl: true }).setView(BRUSSELS_CENTER, DEFAULT_ZOOM);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributeurs'
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
map.on('zoomend', updateMarkerLabels);
const detailPopup = L.popup({ maxWidth: 320 });
let userMarker = null;
let places = [];
let visiblePlaces = [];
let deferredInstallPrompt = null;
let requestToken = 0;

const els = {
  communeSelect: document.querySelector('#communeSelect'),
  searchInput: document.querySelector('#searchInput'),
  reloadBtn: document.querySelector('#reloadBtn'),
  locateBtn: document.querySelector('#locateBtn'),
  fitBtn: document.querySelector('#fitBtn'),
  status: document.querySelector('#status'),
  results: document.querySelector('#results'),
  countLabel: document.querySelector('#countLabel'),
  scopeLabel: document.querySelector('#scopeLabel'),
  resultTemplate: document.querySelector('#resultTemplate'),
  installBtn: document.querySelector('#installBtn')
};

function initCommuneSelect() {
  for (const commune of communes) {
    const option = document.createElement('option');
    option.value = commune.id;
    option.textContent = commune.label;
    els.communeSelect.appendChild(option);
  }
}

function setStatus(message, type = '', autoHide = false) {
  els.status.textContent = message;
  els.status.className = `status ${type}`.trim();
  if (autoHide) {
    window.setTimeout(() => els.status.classList.add('fade'), 2200);
  }
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[ch]));
}

function buildAreaSelector(commune) {
  return `relation(${commune.relationId})->.boundary;\n.boundary map_to_area -> .searchArea;`;
}

function buildOverpassQuery(commune) {
  return `[out:json][timeout:60];
${buildAreaSelector(commune)}
(
  nwr(area.searchArea)["cuisine"~"${CUISINE_PATTERN}",i];
  nwr(area.searchArea)["amenity"]["name"~"${NAME_PATTERN}",i];
  nwr(area.searchArea)["shop"]["name"~"${NAME_PATTERN}",i];
  nwr(area.searchArea)["amenity"="fast_food"]["cuisine"~"belgian",i];
);
out center;`;
}

async function fetchOverpass(query, signal) {
  let lastError;
  for (const endpoint of overpassEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: `data=${encodeURIComponent(query)}`,
        signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      lastError = error;
    }
  }
  throw lastError || new Error('Aucun serveur Overpass disponible');
}

function elementCoordinates(element) {
  if (Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
    return { lat: element.lat, lon: element.lon };
  }
  if (element.center && Number.isFinite(element.center.lat) && Number.isFinite(element.center.lon)) {
    return { lat: element.center.lat, lon: element.center.lon };
  }
  return null;
}

function formatAddress(tags = {}) {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const city = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
  return [street, city].filter(Boolean).join(', ') || tags['addr:full'] || 'Adresse non renseignée dans OpenStreetMap';
}

function normalizeElement(element) {
  const coords = elementCoordinates(element);
  if (!coords) return null;
  const tags = element.tags || {};
  const name = tags.name || tags['name:fr'] || tags['name:nl'] || tags.operator || tags.brand || UNNAMED;
  return {
    id: `${element.type}-${element.id}`,
    osmId: element.id,
    osmType: element.type,
    name,
    lat: coords.lat,
    lon: coords.lon,
    address: formatAddress(tags),
    openingHours: tags.opening_hours || '',
    phone: tags.phone || tags['contact:phone'] || '',
    website: tags.website || tags['contact:website'] || '',
    cuisine: tags.cuisine || '',
    takeaway: tags.takeaway || '',
    tags
  };
}

function distanceMeters(a, b) {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const meanLat = ((a.lat + b.lat) / 2) * toRad;
  const x = dLon * Math.cos(meanLat);
  return 6371000 * Math.hypot(dLat, x);
}

/* Fusionne les objets OSM qui décrivent visiblement le même établissement.
 * Les friteries sans nom sont exclues : deux baraques voisines et anonymes
 * ne doivent pas être confondues. */
function mergeDuplicates(list) {
  const kept = [];
  for (const place of list) {
    const isDuplicate = place.name !== UNNAMED && kept.some(other =>
      other.name === place.name && distanceMeters(other, place) < DUPLICATE_RADIUS_M);
    if (!isDuplicate) kept.push(place);
  }
  return kept;
}

function googleMapsUrl(place) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.lat},${place.lon}`)}`;
}

function googleDirectionsUrl(place) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${place.lat},${place.lon}`)}`;
}

function osmUrl(place) {
  return `https://www.openstreetmap.org/${place.osmType}/${place.osmId}`;
}

function popupHtml(place) {
  const phone = place.phone ? `<p>☎ ${escapeHtml(place.phone)}</p>` : '';
  const hours = place.openingHours ? `<p>🕒 ${escapeHtml(place.openingHours)}</p>` : '';
  return `<div class="popup">
    <h3>🍟 ${escapeHtml(place.name)}</h3>
    <p>${escapeHtml(place.address)}</p>
    ${hours}${phone}
    <div class="popup-actions">
      <a class="primary" href="${googleMapsUrl(place)}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a>
      <a href="${googleDirectionsUrl(place)}" target="_blank" rel="noopener noreferrer">Itinéraire</a>
      <a href="${osmUrl(place)}" target="_blank" rel="noopener noreferrer">OSM</a>
    </div>
  </div>`;
}

function markerIcon(place) {
  return L.divIcon({
    className: 'fries-marker',
    html: `<div class="fries-pin"><span>🍟</span></div><div class="fries-label">${escapeHtml(place.name)}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 31],
    popupAnchor: [0, -28]
  });
}

/* Les étiquettes sont masquées quand la carte est trop dense pour rester lisible. */
function updateMarkerLabels() {
  const readable = map.getZoom() >= LABEL_MIN_ZOOM || visiblePlaces.length <= LABEL_MAX_LABELS;
  map.getContainer().classList.toggle('show-labels', readable);
  return readable;
}

function renderMapMarkers() {
  markerLayer.clearLayers();
  for (const place of visiblePlaces) {
    const marker = L.marker([place.lat, place.lon], { icon: markerIcon(place), title: `${place.name} — ouvrir dans Google Maps` });
    marker.bindTooltip(place.name, { direction: 'top', offset: [0, -24] });
    marker.on('click', () => {
      window.open(googleMapsUrl(place), '_blank', 'noopener,noreferrer');
    });
    marker.placeId = place.id;
    markerLayer.addLayer(marker);
  }
  updateMarkerLabels();
}

function renderResults() {
  els.results.innerHTML = '';
  els.countLabel.textContent = `${visiblePlaces.length} ${visiblePlaces.length > 1 ? 'friteries' : 'friterie'}`;

  if (!visiblePlaces.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Aucune friterie trouvée avec ce filtre.';
    els.results.appendChild(empty);
    return;
  }

  for (const place of visiblePlaces) {
    const fragment = els.resultTemplate.content.cloneNode(true);
    const card = fragment.querySelector('.result-card');
    fragment.querySelector('.result-name').textContent = place.name;
    fragment.querySelector('.result-address').textContent = place.address;

    const meta = [];
    if (place.openingHours) meta.push(`🕒 ${place.openingHours}`);
    if (place.cuisine) meta.push(place.cuisine.replaceAll(';', ' · '));
    fragment.querySelector('.result-meta').textContent = meta.join(' — ');

    const link = fragment.querySelector('.maps-link');
    link.href = googleMapsUrl(place);

    const openPlace = () => {
      map.setView([place.lat, place.lon], Math.max(map.getZoom(), 16), { animate: true });
      detailPopup.setLatLng([place.lat, place.lon]).setContent(popupHtml(place)).openOn(map);
    };
    card.addEventListener('click', event => {
      if (event.target.closest('a')) return;
      openPlace();
    });
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPlace();
      }
    });

    els.results.appendChild(fragment);
  }
}

function applySearch() {
  const q = els.searchInput.value.trim().toLocaleLowerCase('fr');
  visiblePlaces = !q ? [...places] : places.filter(place => {
    const haystack = `${place.name} ${place.address} ${place.cuisine}`.toLocaleLowerCase('fr');
    return haystack.includes(q);
  });
  visiblePlaces.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
  renderMapMarkers();
  renderResults();
}

function fitResults() {
  if (!visiblePlaces.length) return;
  if (visiblePlaces.length === 1) {
    map.setView([visiblePlaces[0].lat, visiblePlaces[0].lon], 16);
    return;
  }
  const bounds = L.latLngBounds(visiblePlaces.map(p => [p.lat, p.lon]));
  map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
}

let currentAbortController = null;
async function loadFriteries({ fit = true } = {}) {
  requestToken += 1;
  const token = requestToken;
  if (currentAbortController) currentAbortController.abort();
  currentAbortController = new AbortController();

  const commune = communes.find(c => c.id === els.communeSelect.value) || communes[0];
  els.scopeLabel.textContent = commune.label;
  setStatus(`Recherche des friteries — ${commune.label}…`);
  els.reloadBtn.disabled = true;

  try {
    const data = await fetchOverpass(buildOverpassQuery(commune), currentAbortController.signal);
    if (token !== requestToken) return;

    const dedupe = new Map();
    for (const element of data.elements || []) {
      const place = normalizeElement(element);
      if (place) dedupe.set(place.id, place);
    }
    places = mergeDuplicates([...dedupe.values()]);
    applySearch();
    if (fit) fitResults();

    const plural = places.length > 1 ? 's' : '';
    const hint = updateMarkerLabels() ? '' : ' Zoomez pour afficher les noms sur la carte.';
    setStatus(`${places.length} friterie${plural} trouvée${plural}.${hint}`, 'success', true);
  } catch (error) {
    if (error.name === 'AbortError') return;
    console.error(error);
    places = [];
    visiblePlaces = [];
    renderMapMarkers();
    renderResults();
    setStatus('Impossible de charger les données. Vérifiez la connexion puis réessayez.', 'error');
  } finally {
    if (token === requestToken) els.reloadBtn.disabled = false;
  }
}

function locateUser() {
  if (!navigator.geolocation) {
    setStatus('La géolocalisation n’est pas disponible sur cet appareil.', 'error', true);
    return;
  }
  setStatus('Recherche de votre position…');
  navigator.geolocation.getCurrentPosition(position => {
    const latlng = [position.coords.latitude, position.coords.longitude];
    if (userMarker) map.removeLayer(userMarker);
    const icon = L.divIcon({ className: '', html: '<div class="user-marker"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
    userMarker = L.marker(latlng, { icon, title: 'Votre position' }).addTo(map).bindPopup('Votre position');
    map.setView(latlng, 15);
    setStatus('Position trouvée.', 'success', true);
  }, error => {
    const message = error.code === 1 ? 'Autorisation de localisation refusée.' : 'Position impossible à déterminer.';
    setStatus(message, 'error', true);
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}

function registerPwa() {
  if ('serviceWorker' in navigator) {
    // Sans ce rechargement, une version déjà installée continue de servir l'ancien
    // app.js pendant toute la visite où la mise à jour s'installe.
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(console.error);
    });
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installBtn.classList.remove('hidden');
  });
  els.installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installBtn.classList.add('hidden');
  });
  window.addEventListener('appinstalled', () => {
    els.installBtn.classList.add('hidden');
    setStatus('Application installée.', 'success', true);
  });
}

initCommuneSelect();
registerPwa();

els.communeSelect.addEventListener('change', () => loadFriteries({ fit: true }));
els.reloadBtn.addEventListener('click', () => loadFriteries({ fit: false }));
els.searchInput.addEventListener('input', applySearch);
els.fitBtn.addEventListener('click', fitResults);
els.locateBtn.addEventListener('click', locateUser);

loadFriteries({ fit: true });
