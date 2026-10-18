const CENTRO_INICIAL = [5.0689, -75.5174]; // Si no se encuantra la ubicacion de la persona, el mapa arranca en Manizales. 

const mapa = L.map('mapa').setView(CENTRO_INICIAL, 15);// Crea el mapa dentro del cuadro llamado mapa y lo centra en Manizales con un zoom de 15

// Pone el dibujo de las calles de OpenStreetMap encima del mapa
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(mapa);

// Pone otro dibujo de calles, este es de Esri, encima del anterior
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: 'Tiles &copy; Esri'
}).addTo(mapa);


let marcadorUsuario = null;// Aqui se va a guardar el marcador que muestra donde esta la persona
let circuloPrecision = null;// Aqui se va a guardar el circulo que muestra que tan exacta es la ubicacion

// Muestra un mensaje en el cuadro de texto llamado info
function mostrarInfo(texto) {
  document.getElementById('info').textContent = texto;
}

// Busca donde esta la persona y la muestra en el mapa
function ubicarUsuario() {
  // Si el navegador no puede dar la ubicacion, avisa y no sigue
  if (!('geolocation' in navigator)) {
    mostrarInfo('Tu navegador no soporta geolocalizacion.');
    return;
  }
  mostrarInfo('Buscando tu ubicacion...');

  // Le pide al navegador la ubicacion actual
  navigator.geolocation.getCurrentPosition(
    // Esto pasa cuando si se encuentra la ubicacion
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const punto = [latitude, longitude];
      // Si ya habia un marcador o un circulo de antes, los quita
      if (marcadorUsuario) mapa.removeLayer(marcadorUsuario);
      if (circuloPrecision) mapa.removeLayer(circuloPrecision);
      
      // Pone el marcador con el mensaje "Estas aquí"
      marcadorUsuario = L.marker(punto).addTo(mapa).bindPopup('Estás aquí').openPopup();
      // Dibuja un circulo alrededor que muestra el margen de error
      circuloPrecision = L.circle(punto, { radius: accuracy, fillOpacity: 0.1 }).addTo(mapa);
      mapa.setView(punto, 17); // Mueve el mapa hacia la persona y le acerca mas
      mostrarInfo(`Ubicacion encontrada (precisión: ${Math.round(accuracy)} m). Haz clic para dibujar.`);
    },
    // Esto pasa cuando no se pudo encontrar la ubicacion
    (err) => {
      const mensajes = {
        // Mensajes segun el problema
        1: 'Permiso denegado. Activa la ubicacion en el navegador.',
        2: 'No se pudo determinar la ubicacion.',
        3: 'Se agoto el tiempo de espera.'
      };
      mostrarInfo(mensajes[err.code] || 'Error desconocido.');
    },
    // Pide la ubicacion lo mas exacta posible, espera maximo 10 segundos y no usa una ubicacion vieja
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// Cuando se presiona el boton (Ubicar), busca la ubicacion
document.getElementById('btnUbicar').addEventListener('click', ubicarUsuario);
// Busca la ubicacion apenas se abre la pagina
ubicarUsuario();

let puntos = []; // Lista con las coordenadas de los puntos que la persona va marcando
let vertices = []; // Lista con los circulitos que se dibujan en cada punto
let poligono = null;// Aqui se guarda el poligono cuando se cierre
const lineaGuia = L.polyline([], { color: '#e67e22', dashArray: '6 6' }).addTo(mapa);// Linea naranja punteada que une los puntos 

// Cada vez que se hace clic en el mapa se agrega un punto
mapa.on('click', (e) => {
  if (poligono) return; // Si el poligono ya esta cerrado, no deja agregar mas puntos

  // Toma la posicion donde se hizo clic y la guarda en la lista
  const { lat, lng } = e.latlng;
  puntos.push([lat, lng]);

  // Dibuja un circulito naranja en ese punto y lo guarda
  const v = L.circleMarker([lat, lng], { radius: 6, color: '#e67e22', fillOpacity: 1 }).addTo(mapa);
  vertices.push(v);

  // Actualiza la linea punteada con el nuevo punto
  lineaGuia.setLatLngs(puntos);
  actualizarBotones();
  mostrarInfo(`${puntos.length} vértice(s). Necesitas al menos 3 para cerrar.`);
});

// Prende o apaga los botones segun como va el dibujo
function actualizarBotones() {
  // (Cerrar) solo sirve si hay 3 puntos o mas y el poligono no esta cerrado
  document.getElementById('btnCerrar').disabled = puntos.length < 3 || poligono !== null;
  // (Deshacer) solo sirve si hay algun punto y el poligono no esta cerrado
  document.getElementById('btnDeshacer').disabled = puntos.length === 0 || poligono !== null;
  // (Exportar) solo sirve si el poligono esta cerrado
  document.getElementById('btnExportar').disabled = poligono === null;
  // RETO 7
  // solo sirve cuando el poligono ya esta cerrado
  document.getElementById('btnDentro').disabled = poligono === null;   
  // RETO 8
  // Geocerca solo sirve cuando el poligono ya esta cerrado
  document.getElementById('btnGeocerca').disabled = poligono === null; 
  // RETO 1
  // Vuelve a llenar la tabla con los puntos
  actualizarTabla();
  // RETO 5
  // Guarda el dibujo en el navegador para no perderlo
  guardarLocal();    
}

// Convierte los puntos al formato que usa la libreria turf para hacer los calculos
function aGeoJSON() {
  const anillo = puntos.map(([lat, lng]) => [lng, lat]);
  anillo.push(anillo[0]); // cerrar el anillo
  // RETO 3
  // Toma el nombre que escribio la persona, y si no escribio usa (Mi poligono)
  const nombrePoli = document.getElementById('nombrePoligono').value.trim() || 'Mi polígono';
  // Arma el poligono con su nombre y la fecha en que se creo
  return turf.polygon([anillo], { nombre: nombrePoli, creado: new Date().toISOString() });
}

// Calcula el area y el perimetro del poligono
function medir() {
  const geo = aGeoJSON();
  const area = turf.area(geo);// metros cuadrados
  const perimetro = turf.length(turf.polygonToLine(geo), { units: 'meters' });
  return { area, perimetro };
}

// Cierra la figura y la convierte en poligono
function cerrarPoligono() {
  // Dibuja el poligono verde con los puntos
  poligono = L.polygon(puntos, { color: '#27ae60', fillOpacity: 0.35 }).addTo(mapa);
  // Borra la linea punteada porque ya no se necesita
  lineaGuia.setLatLngs([]);
  // Acomoda el mapa para que se vea todo el poligono
  mapa.fitBounds(poligono.getBounds());

  // Calcula el area y el perimetro y los muestra en un globito sobre el poligono
  const { area, perimetro } = medir();
  poligono.bindPopup(`Área: ${area.toFixed(1)} m²<br>Perímetro: ${perimetro.toFixed(1)} m`).openPopup();
  // Muestra el area en metros cuadrados y tambien en hectareas
  mostrarInfo(`Polígono cerrado. Área: ${area.toFixed(1)} m² (${(area / 10000).toFixed(3)} ha).`);
  actualizarBotones();
}

// Cuando se presiona (Cerrar), se cierra el poligono
document.getElementById('btnCerrar').addEventListener('click', cerrarPoligono);
 
// Quita el ultimo punto que se marco y lo borra del mapa
function deshacerPunto() {
  // Saca el ultimo punto de la lista
  puntos.pop();
  // Borra el ultimo circulito del mapa
  mapa.removeLayer(vertices.pop());
  // Actualiza la linea punteada
  lineaGuia.setLatLngs(puntos);
  actualizarBotones();
  mostrarInfo(`${puntos.length} vértice(s).`);
}
 
// Borra todo lo dibujado para empezar de cero
function limpiar() {
  puntos = [];// Vacia la lista de puntos
  // Borra todos los circulitos del mapa y vacia su lista
  vertices.forEach((v) => mapa.removeLayer(v));
  vertices = [];
  lineaGuia.setLatLngs([]);
  // Si habia un poligono, lo borra
  if (poligono) {
    mapa.removeLayer(poligono);
    poligono = null;
  }
  actualizarBotones();
  mostrarInfo('Mapa limpio. Haz clic para empezar de nuevo.');
}
 
// Conecta los botones Deshacer y Limpiar con lo que hacen
document.getElementById('btnDeshacer').addEventListener('click', deshacerPunto);
document.getElementById('btnLimpiar').addEventListener('click', limpiar);
 
 
// Descarga el poligono como un archivo
function exportar() {
  // Convierte el poligono a texto ordenado
  const texto = JSON.stringify(aGeoJSON(), null, 2);
  // Crea el archivo con ese texto
  const blob = new Blob([texto], { type: 'application/geo+json' });
  // Crea un enlace invisible, le pone el nombre poligono.geojson y lo presiona para descargar
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = 'poligono.geojson';
  enlace.click();
  // Despues de un segundo borra el enlace porque ya no se necesita
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}
 
// Cuando se presiona Exportar, se descarga el archivo
document.getElementById('btnExportar').addEventListener('click', exportar);
 
 
// RETOS 4, 5 y 6 funcion que usan los tres
// Agrega un punto en el mapa como si la persona hubiera hecho clic ahi
function agregarVertice(lat, lng) {
  mapa.fire('click', { latlng: L.latLng(lat, lng) });
}
 
// RETO 1
// Llena la tabla con el numero, la latitud y la longitud de cada punto
function actualizarTabla() {
  const tabla = document.querySelector('#tablaVertices tbody');
  // Borra lo que tenia la tabla antes
  tabla.innerHTML = ''; 
 
  // Por cada punto crea una fila nueva
  puntos.forEach(([lat, lng], i) => {
    const fila = document.createElement('tr');
    // Crea una casilla con el numero
    [i + 1, lat.toFixed(6), lng.toFixed(6)].forEach((valor) => {
      const casilla = document.createElement('td');
      casilla.textContent = valor;
      fila.appendChild(casilla);
    });
    // Agrega la fila a la tabla
    tabla.appendChild(fila);
  });
}
 
// RETO 2
// Toma el selector de color de la pagina
const selectorColor = document.getElementById('colorPoligono');
 
// Cuando se cambia el color, el poligono se pinta de ese color y se guarda
selectorColor.addEventListener('input', () => {
  if (poligono) poligono.setStyle({ color: selectorColor.value });
  guardarLocal(); 
});
 
// RETO 3
// Cada vez que se escribe el nombre del poligono, se guarda
document.getElementById('nombrePoligono').addEventListener('input', guardarLocal);
 
// RETO 2 y RETO 9
// Lo que pasa justo despues de cerrar el poligono
function despuesDeCerrar() {
  // Pinta el poligono con el color que eligio la persona
  poligono.setStyle({ color: selectorColor.value });
  // Cuenta cuantas veces las lineas del poligono se cruzan entre si
  const numCruces = turf.kinks(aGeoJSON()).features.length;
  // Si se cruzan, avisa que el area puede estar mal
  if (numCruces > 0) {
    mostrarInfo(`el polígono se cruza consigo mismo (${numCruces} cruce(s)), el area puede salir mal.`);
  }
}
 
// Cuando se presiona Cerrar, también se hace lo de despuesDeCerrar
document.getElementById('btnCerrar').addEventListener('click', despuesDeCerrar);
 
// RETO 4
// Agrega un punto en el lugar donde esta la persona
function agregarVerticeConUbicacion() {
  // Si el poligono ya esta cerrado, avisa y no hace nada
  if (poligono) {
    mostrarInfo('El poligono ya esta cerrado.');
    return;
  }
  mostrarInfo('Buscando tu ubicacion para agregar el vertice');
  // Pide la ubicacion actual
  navigator.geolocation.getCurrentPosition(
    // Si la encuentra, pone un punto ahi y acerca el mapa
    (pos) => {
      const { latitude, longitude } = pos.coords;
      agregarVertice(latitude, longitude);
      mapa.setView([latitude, longitude], 18);
    },
    // Si no la encuentra, avisa
    (err) => mostrarInfo(`No se pudo obtener tu ubicación (error ${err.code}).`),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}
 
// Cuando se presiona el boton, agrega el punto con la ubicacion
document.getElementById('btnAgregarUbicacion').addEventListener('click', agregarVerticeConUbicacion);
 
// RETO 5
// Guarda el dibujo en el navegador para que no se pierda al recargar la pagina
function guardarLocal() {
  // Junta los puntos, si esta cerrado, el color y el nombre
  const guardado = {
    puntos: puntos,
    cerrado: poligono !== null,
    color: document.getElementById('colorPoligono').value,
    nombre: document.getElementById('nombrePoligono').value
  };
  // Lo guarda como texto con el nombre taller-poligono
  localStorage.setItem('taller-poligono', JSON.stringify(guardado));
}
 
// Recupera el dibujo que se habia guardado antes
function cargarLocal() {
  // Busca lo guardado y si no hay nada, no hace nada
  const textoGuardado = localStorage.getItem('taller-poligono');
  if (!textoGuardado) return;
 
  // Convierte el texto guardado otra vez en datos
  const guardado = JSON.parse(textoGuardado);
  // Vuelve a poner el color y el nombre que se habian guardado
  selectorColor.value = guardado.color || '#27ae60';
  document.getElementById('nombrePoligono').value = guardado.nombre || '';
  // Vuelve a poner todos los puntos en el mapa
  guardado.puntos.forEach(([lat, lng]) => agregarVertice(lat, lng));
 
  // Si el poligono estaba cerrado, lo vuelve a cerrar
  if (guardado.cerrado && puntos.length >= 3) {
    cerrarPoligono();
    despuesDeCerrar();
  }
  // Si hay puntos, acomoda el mapa para que se vean todos
  if (puntos.length > 0) {
    mapa.fitBounds(L.latLngBounds(puntos));
  }
}
 
// RETO 6
// Aqui se guarda lo que se dibuje desde un archivo cuando no es un poligono
let dibujoArchivo = null;
 
// Cuando la persona escoge un archivo lo lee
document.getElementById('archivoGeoJSON').addEventListener('change', (e) => {
  // Toma el archivo escogido y si no hay, no hace nada
  const arch = e.target.files[0];
  if (!arch) return;
 
  const leer = new FileReader();
  // Cuando termina de leer el archivo, intenta cargarlo en el mapa
  leer.onload = () => {
    try {
      importarGeoJSON(JSON.parse(leer.result));
    } catch {
      // Si el archivo esta mal, avisa
      mostrarInfo('El archivo no es un GeoJSON válido.');
    }
    // Deja el selector vacio para poder escoger el mismo archivo otra vez
    e.target.value = ''; 
  };
  // Lee el archivo como texto
  leer.readAsText(arch);
});
 
// Pone en el mapa lo que venia en el archivo
function importarGeoJSON(datos) {
  // Primero borra todo lo que habia
  limpiar();
  limpiarRetos();
 
  // Si el archivo trae varias figuras, toma solo la primera
  let figura = datos;
  if (datos.type === 'FeatureCollection') figura = datos.features[0];
  // Saca la forma de la figura
  const forma = figura.geometry || figura;
 
  // Si no es un poligono, solo lo dibuja en el mapa y termina
  if (forma.type !== 'Polygon') {
 
    dibujoArchivo = L.geoJSON(datos).addTo(mapa);
    mapa.fitBounds(dibujoArchivo.getBounds());
    return;
  }
 
  // Si el archivo trae un nombre, lo pone en la casilla del nombre
  if (figura.properties && figura.properties.nombre) {
    document.getElementById('nombrePoligono').value = figura.properties.nombre;
  }
 
  // Toma los puntos del poligono sin el ultimo porque es igual al primero
  const coords = forma.coordinates[0].slice(0, -1);
  // Pone cada punto en el mapa (cambiando el orden a latitud, longitud)
  coords.forEach(([lng, lat]) => agregarVertice(lat, lng));
  // Cierra el polígono
  cerrarPoligono();
  despuesDeCerrar();
}
 
// RETO 7
// Revisa si un punto queda adentro del polígono responde si o no
function estaDentro(lat, lng) {
  return turf.booleanPointInPolygon(turf.point([lng, lat]), aGeoJSON());
}
 
// Revisa si la persona esta dentro o fuera del poligono
function verificarDentro() {
  mostrarInfo('Revisando tu ubicación...');
  // Pide la ubicacion actual
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      // Dice si está dentro o fuera
      if (estaDentro(latitude, longitude)) {
        mostrarInfo('DENTRO del polígono.');
      } else {
        mostrarInfo('FUERA del polígono.');
      }
    },
    // Si no encuentra la ubicacion, avisa
    (err) => mostrarInfo(`No se pudo obtener tu ubicación (error ${err.code}).`),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}
 
// Cuando se presiona el boton, revisa si esta dentro
document.getElementById('btnDentro').addEventListener('click', verificarDentro);
 
 
// RETO 8
// Aqui se guarda el seguimiento de la ubicacion cuando esta prendido
let seguimiento = null; 
// Aqui se recuerda si la persona estaba dentro o fuera la vez anterior
let dentroAntes = null;  
 
// Empieza a vigilar todo el tiempo si la persona entra o sale del poligono
function iniciarGeocerca() {
  dentroAntes = null;
  mostrarInfo('Geocerca activa');
 
  // Pide la ubicacion una y otra vez mientras la persona se mueve
  seguimiento = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      // Revisa si en este momento esta dentro
      const estaAdentro = estaDentro(latitude, longitude);
 
      // Si antes estaba dentro y ahora esta fuera, avisa que salio y hace vibrar el celular
      if (dentroAntes === true && !estaAdentro) {
        mostrarInfo('Saliste del polígono');
        if (navigator.vibrate) navigator.vibrate(500); 
      // Si antes estaba fuera y ahora esta dentro, avisa que volvio a entrar
      } else if (dentroAntes === false && estaAdentro) {
        mostrarInfo('Volviste a entrar al polígono.');
      // Si es la primera vez que revisa, solo dice si esta dentro o fuera
      } else if (dentroAntes === null) {
        mostrarInfo(estaAdentro ? 'Geocerca activa, estás dentro.' : 'Geocerca activa: estás fuera.');
      }
      // Recuerda como estaba para la proxima vez
      dentroAntes = estaAdentro;
    },
    // Si no encuentra la ubicacion, avisa
    (err) => mostrarInfo(`No se pudo obtener tu ubicacion (error ${err.code}).`),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
  // Cambia el texto del boton para que ahora diga Detener
  document.getElementById('btnGeocerca').textContent = 'Detener geocerca';
}
 
// Deja de vigilar la ubicación
function detenerGeocerca() {
  // Si estaba vigilando, lo apaga
  if (seguimiento !== null) {
    navigator.geolocation.clearWatch(seguimiento);
    seguimiento = null;
  }
  // Cambia el texto del boton para que vuelva a decir iniciar
  document.getElementById('btnGeocerca').textContent = 'Iniciar geocerca';
}
 
// El mismo boton sirve para prender y apagar la geocerca
document.getElementById('btnGeocerca').addEventListener('click', () => {
  if (seguimiento === null) iniciarGeocerca();
  else detenerGeocerca();
});
 
// RETO 6 y RETO 8
// Limpia lo que agregaron los retos: apaga la geocerca y borra el dibujo del archivo
function limpiarRetos() {
  detenerGeocerca();
  if (dibujoArchivo) {
    mapa.removeLayer(dibujoArchivo);
    dibujoArchivo = null;
  }
}
 
// Cuando se presiona limpiar, tambien se limpian los retos
document.getElementById('btnLimpiar').addEventListener('click', limpiarRetos);
 
// RETO 5
// Al abrir la pagina, recupera el dibujo que estaba guardado
cargarLocal(); 












