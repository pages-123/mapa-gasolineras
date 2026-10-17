const btnMapa = document.getElementById('btn-mapa');
const btnLista = document.getElementById('btn-lista');
const btnGps = document.getElementById('btn-gps');
const btnFavoritos = document.getElementById('btn-favoritos');
const btnTema = document.getElementById('btn-tema');

if (localStorage.getItem('temaOscuro') === 'activo') {
    document.body.classList.add('dark-mode');
    btnTema.textContent = '☀️ Modo Claro';
}

btnTema.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('temaOscuro', 'activo');
        btnTema.textContent = '☀️ Modo Claro';
    } else {
        localStorage.setItem('temaOscuro', 'inactivo');
        btnTema.textContent = '🌓 Modo Oscuro';
    }
});

const vistaMapa = document.getElementById('vista-mapa');
const vistaLista = document.getElementById('vista-lista');
const vistaFavoritos = document.getElementById('vista-favoritos');

function cambiarVista(btnActivo, vistaActiva) {
    [btnMapa, btnLista, btnFavoritos].forEach(btn => btn.classList.remove('activo'));
    [vistaMapa, vistaLista, vistaFavoritos].forEach(vista => vista.classList.remove('activa'));
    btnActivo.classList.add('activo');
    vistaActiva.classList.add('activa');
}

btnLista.addEventListener('click', () => cambiarVista(btnLista, vistaLista));
btnFavoritos.addEventListener('click', () => { cambiarVista(btnFavoritos, vistaFavoritos); renderizarFavoritos(); });
btnMapa.addEventListener('click', () => { cambiarVista(btnMapa, vistaMapa); setTimeout(() => { map.invalidateSize(); }, 100); });

const map = L.map('miMapa').setView([41.9794, 2.8214], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

let todasLasGasolineras = []; 
let ubicacionUsuario = null; 
let marcadorUsuario = null;
let misFavoritos = JSON.parse(localStorage.getItem('gasolinerasFavoritas')) || [];

const capaMarcadores = L.layerGroup().addTo(map);
const selectCombustible = document.getElementById('select-combustible');
const selectProvincia = document.getElementById('select-provincia');
const selectMunicipio = document.getElementById('select-municipio');
const selectOrden = document.getElementById('select-orden');
const inputLitros = document.getElementById('input-litros');
const inputConsumo = document.getElementById('input-consumo');
const buscador = document.getElementById('buscador');

btnGps.addEventListener('click', () => {
    if (!navigator.geolocation) { alert("Tu navegador no soporta GPS."); return; }
    btnGps.textContent = "Buscando...";
    const opcionesGPS = { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 };

    navigator.geolocation.getCurrentPosition(
        (posicion) => {
            ubicacionUsuario = L.latLng(posicion.coords.latitude, posicion.coords.longitude);
            selectOrden.value = 'distancia';
            if (marcadorUsuario) map.removeLayer(marcadorUsuario);
            marcadorUsuario = L.circleMarker(ubicacionUsuario, { radius: 8, color: 'red', fillColor: '#f03', fillOpacity: 1 }).addTo(map).bindPopup("<b>¡Estás aquí!</b>").openPopup();
            map.flyTo(ubicacionUsuario, 13);
            btnMapa.click();
            btnGps.textContent = "📍 Cerca de mí";
            aplicarFiltros();
        }, 
        (error) => {
            alert("No pudimos leer el GPS.");
            btnGps.textContent = "📍 Cerca de mí";
        }, opcionesGPS
    );
});

async function cargarProvincias() {
    try {
        const res = await fetch('https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/Listados/Provincias/');
        const provincias = await res.json();
        selectProvincia.innerHTML = '';
        provincias.forEach(prov => {
            const option = document.createElement('option');
            option.value = prov.IDPovincia;
            option.textContent = prov.Provincia;
            if (prov.IDPovincia === "17") option.selected = true; 
            selectProvincia.appendChild(option);
        });
        cargarGasolineras(selectProvincia.value);
    } catch (error) { console.error(error); }
}

async function cargarGasolineras(idProvincia) {
    try {
        const respuesta = await fetch(`https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroProvincia/${idProvincia}`);
        const datos = await respuesta.json();
        todasLasGasolineras = datos.ListaEESSPrecio.filter(est => !isNaN(parseFloat(est.Latitud.replace(',', '.'))));
        const municipiosUnicos = [...new Set(todasLasGasolineras.map(est => est.Municipio))].sort();
        selectMunicipio.innerHTML = '<option value="">Todos los municipios</option>';
        municipiosUnicos.forEach(mun => {
            const option = document.createElement('option');
            option.value = mun;
            option.textContent = mun;
            selectMunicipio.appendChild(option);
        });
        aplicarFiltros();
    } catch (error) { console.error(error); }
}

function aplicarFiltros() {
    const combustible = selectCombustible.value;
    let resultados = todasLasGasolineras.filter(est => est[combustible] && est[combustible] !== "");
    if (selectMunicipio.value !== "") resultados = resultados.filter(est => est.Municipio === selectMunicipio.value);
    if (buscador.value !== "") resultados = resultados.filter(est => est['Rótulo'].toLowerCase().includes(buscador.value.toLowerCase()));

    const orden = selectOrden.value;
    resultados.sort((a, b) => {
        if (orden === 'distancia' && ubicacionUsuario) {
            const latA = parseFloat(a.Latitud.replace(',', '.'));
            const lonA = parseFloat(a['Longitud (WGS84)'].replace(',', '.'));
            const latB = parseFloat(b.Latitud.replace(',', '.'));
            const lonB = parseFloat(b['Longitud (WGS84)'].replace(',', '.'));
            return map.distance(ubicacionUsuario, [latA, lonA]) - map.distance(ubicacionUsuario, [latB, lonB]);
        } else {
            const precioA = parseFloat(a[combustible].replace(',', '.'));
            const precioB = parseFloat(b[combustible].replace(',', '.'));
            return orden === 'barato' ? precioA - precioB : precioB - precioA;
        }
    });
    actualizarPantalla(resultados, combustible);
}

function alternarFavorito(estacion, evento) {
    if (evento) evento.stopPropagation();
    const idUnico = estacion.Latitud + estacion['Longitud (WGS84)'];
    const index = misFavoritos.findIndex(fav => (fav.Latitud + fav['Longitud (WGS84)']) === idUnico);
    if (index === -1) misFavoritos.push(estacion);
    else misFavoritos.splice(index, 1);
    localStorage.setItem('gasolinerasFavoritas', JSON.stringify(misFavoritos));
    aplicarFiltros();
    if (vistaFavoritos.classList.contains('activa')) renderizarFavoritos();
}

function crearTarjeta(est, tipoCombustible, contenedor) {
    const lat = parseFloat(est.Latitud.replace(',', '.'));
    const lon = parseFloat(est['Longitud (WGS84)'].replace(',', '.'));
    const precio = est[tipoCombustible]; 
    if (!precio) return; 

    const precioNum = parseFloat(precio.replace(',', '.'));
    const litrosDeposito = parseFloat(inputLitros.value) || 60;
    const consumoVehiculo = parseFloat(inputConsumo.value) || 5.5;
    const costeLlenado = (precioNum * litrosDeposito).toFixed(2);
    const linkRuta = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    
    let infoDesvio = '';
    if (ubicacionUsuario) {
        const distKm = map.distance(ubicacionUsuario, [lat, lon]) / 1000;
        const costeTrayectoIdaVuelta = ((distKm * 2) / 100) * consumoVehiculo * precioNum;
        const totalReal = (parseFloat(costeLlenado) + costeTrayectoIdaVuelta).toFixed(2);
        
        infoDesvio = `
            <div style="background: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; margin-top: 4px; display: inline-block;">🚗 Gasto en ir y volver: +${costeTrayectoIdaVuelta.toFixed(2)} €</div>
            <div style="color: #4338ca; font-size: 14px; font-weight: bold; margin-top: 4px;">Total (Llenado + Viaje): ${totalReal} €</div>
        `;
    }

    const idUnico = est.Latitud + est['Longitud (WGS84)'];
    const esFavorito = misFavoritos.some(fav => (fav.Latitud + fav['Longitud (WGS84)']) === idUnico);
    const claseBtn = esFavorito ? 'btn-guardar guardado' : 'btn-guardar';
    const textoBtn = esFavorito ? '⭐ Guardado' : '☆ Guardar';

    const tarjeta = document.createElement('div');
    tarjeta.className = 'tarjeta-lista';
    const nombreCombustible = selectCombustible.options[selectCombustible.selectedIndex].text;
    tarjeta.innerHTML = `
        <div class="tarjeta-header">
            <div>
                <div class="etiqueta-combustible">${nombreCombustible}</div>
                <div style="font-weight: 800; color: #1e3a8a; font-size: 18px;">${est['Rótulo']}</div>
            </div>
            <button class="${claseBtn}">${textoBtn}</button>
        </div>
        <div class="texto-direccion">📍 ${est['Municipio']} - ${est['Dirección']}</div>
        <div class="caja-precio">
            <div>
                <div class="label-precio">Precio por litro</div>
                <div class="precio-gigante">${precio} <span class="simbolo-euro">€</span></div>
                <div class="info-llenado">⛽ Llenar (${litrosDeposito}L): ${costeLlenado} €</div>
                ${infoDesvio}
            </div>
            <a href="${linkRuta}" target="_blank" class="btn-ruta">🗺️ Ruta</a>
        </div>
    `;
    
    tarjeta.querySelector('button').addEventListener('click', (e) => alternarFavorito(est, e));
    tarjeta.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') { map.flyTo([lat, lon], 15); btnMapa.click(); }
    });
    contenedor.appendChild(tarjeta);
}

function actualizarPantalla(gasolineras, tipoCombustible) {
    capaMarcadores.clearLayers();
    const contenedor = document.getElementById('contenedor-tarjetas');
    contenedor.innerHTML = '';
    const nombreCombustible = selectCombustible.options[selectCombustible.selectedIndex].text;

    gasolineras.forEach(est => {
        const lat = parseFloat(est.Latitud.replace(',', '.'));
        const lon = parseFloat(est['Longitud (WGS84)'].replace(',', '.'));
        const marcador = L.marker([lat, lon]);
        marcador.bindPopup(`<b>${est['Rótulo']}</b><br><b style="color: #d9534f;">${nombreCombustible}: ${est[tipoCombustible]} €/L</b>`);
        capaMarcadores.addLayer(marcador);
        crearTarjeta(est, tipoCombustible, contenedor);
    });
}

function renderizarFavoritos() {
    const contenedor = document.getElementById('contenedor-favoritos');
    contenedor.innerHTML = '';
    const tipoCombustible = selectCombustible.value;
    if (misFavoritos.length === 0) {
        contenedor.innerHTML = '<p style="text-align: center; color: #777;">Aún no tienes gasolineras guardadas.</p>';
        return;
    }
    misFavoritos.forEach(est => crearTarjeta(est, tipoCombustible, contenedor));
}

selectProvincia.addEventListener('change', (evento) => cargarGasolineras(evento.target.value));
selectCombustible.addEventListener('change', () => { aplicarFiltros(); if(vistaFavoritos.classList.contains('activa')) renderizarFavoritos(); });
selectMunicipio.addEventListener('change', aplicarFiltros);
selectOrden.addEventListener('change', aplicarFiltros);
inputLitros.addEventListener('input', () => { aplicarFiltros(); if(vistaFavoritos.classList.contains('activa')) renderizarFavoritos(); });
inputConsumo.addEventListener('input', () => { aplicarFiltros(); if(vistaFavoritos.classList.contains('activa')) renderizarFavoritos(); });
buscador.addEventListener('input', aplicarFiltros);

cargarProvincias();
