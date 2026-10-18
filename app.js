const CENTRO_INICIAL = [5.0689, -75.5174]; // Manizales, por si falla la ubicacion 

const mapa = L.map('mapa').setView(CENTRO_INICIAL, 15);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(mapa);

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: 'Tiles &copy; Esri'
}).addTo(mapa);


let marcadorUsuario = null;
let circuloPrecision = null;

function mostrarInfo(texto) {
  document.getElementById('info').textContent = texto;
}

function ubicarUsuario() {
  if (!('geolocation' in navigator)) {
    mostrarInfo('Tu navegador no soporta geolocalización.');
    return;
  }
  mostrarInfo('Buscando tu ubicación...');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const punto = [latitude, longitude];

      if (marcadorUsuario) mapa.removeLayer(marcadorUsuario);
      if (circuloPrecision) mapa.removeLayer(circuloPrecision);

      marcadorUsuario = L.marker(punto).addTo(mapa).bindPopup('Estás aquí').openPopup();
      circuloPrecision = L.circle(punto, { radius: accuracy, fillOpacity: 0.1 }).addTo(mapa);
      mapa.setView(punto, 17);
      mostrarInfo(`Ubicación encontrada (precisión: ${Math.round(accuracy)} m). Haz clic para dibujar.`);
    },
    (err) => {
      const mensajes = {
        1: 'Permiso denegado. Activa la ubicación en el navegador.',
        2: 'No se pudo determinar la ubicación.',
        3: 'Se agotó el tiempo de espera.'
      };
      mostrarInfo(mensajes[err.code] || 'Error desconocido.');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}
document.getElementById('btnUbicar').addEventListener('click', ubicarUsuario);
ubicarUsuario();

let puntos = [];   // array de [lat, lng]
let vertices = []; // marcadores visibles de cada vértice
let poligono = null;
const lineaGuia = L.polyline([], { color: '#e67e22', dashArray: '6 6' }).addTo(mapa);

mapa.on('click', (e) => {
  if (poligono) return; // si ya está cerrado, no se agregan más puntos

  const { lat, lng } = e.latlng;
  puntos.push([lat, lng]);

  const v = L.circleMarker([lat, lng], { radius: 6, color: '#e67e22', fillOpacity: 1 }).addTo(mapa);
  vertices.push(v);

  lineaGuia.setLatLngs(puntos);
  actualizarBotones();
  mostrarInfo(`${puntos.length} vértice(s). Necesitas al menos 3 para cerrar.`);
});

function actualizarBotones() {
  document.getElementById('btnCerrar').disabled = puntos.length < 3 || poligono !== null;
  document.getElementById('btnDeshacer').disabled = puntos.length === 0 || poligono !== null;
  document.getElementById('btnExportar').disabled = poligono === null;
  // RETO 7
  document.getElementById('btnDentro').disabled = poligono === null;   
  // RETO 8
  document.getElementById('btnGeocerca').disabled = poligono === null; 
  // RETO 1
  actualizarTabla();
  // RETO 5
  guardarLocal();    
}


function aGeoJSON() {
  const anillo = puntos.map(([lat, lng]) => [lng, lat]);
  anillo.push(anillo[0]); // cerrar el anillo
  // RETO 3
  const nombrePoli = document.getElementById('nombrePoligono').value.trim() || 'Mi polígono';
  return turf.polygon([anillo], { nombre: nombrePoli, creado: new Date().toISOString() });
}

function medir() {
  const geo = aGeoJSON();
  const area = turf.area(geo); // metros cuadrados
  const perimetro = turf.length(turf.polygonToLine(geo), { units: 'meters' });
  return { area, perimetro };
}

function cerrarPoligono() {
  poligono = L.polygon(puntos, { color: '#27ae60', fillOpacity: 0.35 }).addTo(mapa);
  lineaGuia.setLatLngs([]);
  mapa.fitBounds(poligono.getBounds());

  const { area, perimetro } = medir();
  poligono.bindPopup(`Área: ${area.toFixed(1)} m²<br>Perímetro: ${perimetro.toFixed(1)} m`).openPopup();
  mostrarInfo(`Polígono cerrado. Área: ${area.toFixed(1)} m² (${(area / 10000).toFixed(3)} ha).`);
  actualizarBotones();
}

document.getElementById('btnCerrar').addEventListener('click', cerrarPoligono);

function deshacerPunto() {
  puntos.pop();
  mapa.removeLayer(vertices.pop());
  lineaGuia.setLatLngs(puntos);
  actualizarBotones();
  mostrarInfo(`${puntos.length} vértice(s).`);
}

function limpiar() {
  puntos = [];
  vertices.forEach((v) => mapa.removeLayer(v));
  vertices = [];
  lineaGuia.setLatLngs([]);
  if (poligono) {
    mapa.removeLayer(poligono);
    poligono = null;
  }
  actualizarBotones();
  mostrarInfo('Mapa limpio. Haz clic para empezar de nuevo.');
}

document.getElementById('btnDeshacer').addEventListener('click', deshacerPunto);
document.getElementById('btnLimpiar').addEventListener('click', limpiar);


function exportar() {
  const texto = JSON.stringify(aGeoJSON(), null, 2);
  const blob = new Blob([texto], { type: 'application/geo+json' });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = 'poligono.geojson';
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}

document.getElementById('btnExportar').addEventListener('click', exportar);


// RETOS 4, 5 y 6 (función que usan los tres)
function agregarVertice(lat, lng) {
  mapa.fire('click', { latlng: L.latLng(lat, lng) });
}

// RETO 1
function actualizarTabla() {
  const tabla = document.querySelector('#tablaVertices tbody');
  tabla.innerHTML = ''; 

  puntos.forEach(([lat, lng], i) => {
    const fila = document.createElement('tr');
    [i + 1, lat.toFixed(6), lng.toFixed(6)].forEach((valor) => {
      const casilla = document.createElement('td');
      casilla.textContent = valor;
      fila.appendChild(casilla);
    });
    tabla.appendChild(fila);
  });
}

// RETO 2
const selectorColor = document.getElementById('colorPoligono');

selectorColor.addEventListener('input', () => {
  if (poligono) poligono.setStyle({ color: selectorColor.value });
  guardarLocal(); 
});

// RETO 3
document.getElementById('nombrePoligono').addEventListener('input', guardarLocal);

// RETO 2 y RETO 9
function despuesDeCerrar() {
  poligono.setStyle({ color: selectorColor.value });
  const numCruces = turf.kinks(aGeoJSON()).features.length;
  if (numCruces > 0) {
    mostrarInfo(`el polígono se cruza consigo mismo (${numCruces} cruce(s)), el area puede salir mal.`);
  }
}

document.getElementById('btnCerrar').addEventListener('click', despuesDeCerrar);

// RETO 4
function agregarVerticeConUbicacion() {
  if (poligono) {
    mostrarInfo('El polígono ya está cerrado.');
    return;
  }
  mostrarInfo('Buscando tu ubicación para agregar el vértice');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      agregarVertice(latitude, longitude);
      mapa.setView([latitude, longitude], 18);
    },
    (err) => mostrarInfo(`No se pudo obtener tu ubicación (error ${err.code}).`),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

document.getElementById('btnAgregarUbicacion').addEventListener('click', agregarVerticeConUbicacion);

// RETO 5
function guardarLocal() {
  const guardado = {
    puntos: puntos,
    cerrado: poligono !== null,
    color: document.getElementById('colorPoligono').value,
    nombre: document.getElementById('nombrePoligono').value
  };
  localStorage.setItem('taller-poligono', JSON.stringify(guardado));
}

function cargarLocal() {
  const textoGuardado = localStorage.getItem('taller-poligono');
  if (!textoGuardado) return;

  const guardado = JSON.parse(textoGuardado);
  selectorColor.value = guardado.color || '#27ae60';
  document.getElementById('nombrePoligono').value = guardado.nombre || '';
  guardado.puntos.forEach(([lat, lng]) => agregarVertice(lat, lng));

  if (guardado.cerrado && puntos.length >= 3) {
    cerrarPoligono();
    despuesDeCerrar();
  }
  if (puntos.length > 0) {
    mapa.fitBounds(L.latLngBounds(puntos));
  }
}

// RETO 6
let dibujoArchivo = null;

document.getElementById('archivoGeoJSON').addEventListener('change', (e) => {
  const arch = e.target.files[0];
  if (!arch) return;

  const leer = new FileReader();
  leer.onload = () => {
    try {
      importarGeoJSON(JSON.parse(leer.result));
    } catch {
      mostrarInfo('El archivo no es un GeoJSON válido.');
    }
    e.target.value = ''; 
  };
  leer.readAsText(arch);
});

function importarGeoJSON(datos) {
  limpiar();
  limpiarRetos();

  let figura = datos;
  if (datos.type === 'FeatureCollection') figura = datos.features[0];
  const forma = figura.geometry || figura;

  if (forma.type !== 'Polygon') {

    dibujoArchivo = L.geoJSON(datos).addTo(mapa);
    mapa.fitBounds(dibujoArchivo.getBounds());
    return;
  }

  if (figura.properties && figura.properties.nombre) {
    document.getElementById('nombrePoligono').value = figura.properties.nombre;
  }

  const coords = forma.coordinates[0].slice(0, -1);
  coords.forEach(([lng, lat]) => agregarVertice(lat, lng));
  cerrarPoligono();
  despuesDeCerrar();
}

// RETO 7
function estaDentro(lat, lng) {
  return turf.booleanPointInPolygon(turf.point([lng, lat]), aGeoJSON());
}

function verificarDentro() {
  mostrarInfo('Revisando tu ubicación...');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      if (estaDentro(latitude, longitude)) {
        mostrarInfo('DENTRO del polígono.');
      } else {
        mostrarInfo('FUERA del polígono.');
      }
    },
    (err) => mostrarInfo(`No se pudo obtener tu ubicación (error ${err.code}).`),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

document.getElementById('btnDentro').addEventListener('click', verificarDentro);


// RETO 8
let seguimiento = null; 
let dentroAntes = null;  

function iniciarGeocerca() {
  dentroAntes = null;
  mostrarInfo('Geocerca activa');

  seguimiento = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      const estaAdentro = estaDentro(latitude, longitude);

      if (dentroAntes === true && !estaAdentro) {
        mostrarInfo('Saliste del polígono');
        if (navigator.vibrate) navigator.vibrate(500); 
      } else if (dentroAntes === false && estaAdentro) {
        mostrarInfo('Volviste a entrar al polígono.');
      } else if (dentroAntes === null) {
        mostrarInfo(estaAdentro ? 'Geocerca activa: estás dentro.' : 'Geocerca activa: estás fuera.');
      }
      dentroAntes = estaAdentro;
    },
    (err) => mostrarInfo(`No se pudo obtener tu ubicación (error ${err.code}).`),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
  document.getElementById('btnGeocerca').textContent = 'Detener geocerca';
}

function detenerGeocerca() {
  if (seguimiento !== null) {
    navigator.geolocation.clearWatch(seguimiento);
    seguimiento = null;
  }
  document.getElementById('btnGeocerca').textContent = 'Iniciar geocerca';
}

document.getElementById('btnGeocerca').addEventListener('click', () => {
  if (seguimiento === null) iniciarGeocerca();
  else detenerGeocerca();
});

// RETO 6 y RETO 8
function limpiarRetos() {
  detenerGeocerca();
  if (dibujoArchivo) {
    mapa.removeLayer(dibujoArchivo);
    dibujoArchivo = null;
  }
}

document.getElementById('btnLimpiar').addEventListener('click', limpiarRetos);

// RETO 5
cargarLocal();