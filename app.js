const btnMapa = document.getElementById('btn-mapa');
const btnLista = document.getElementById('btn-lista');
const btnGps = document.getElementById('btn-gps');
const vistaMapa = document.getElementById('vista-mapa');
const vistaLista = document.getElementById('vista-lista');

btnLista.addEventListener('click', () => {
    btnMapa.classList.remove('activo');
    btnLista.classList.add('activo');
    vistaMapa.classList.remove('activa');
    vistaLista.classList.add('activa');
});

btnMapa.addEventListener('click', () => {
    btnLista.classList.remove('activo');
    btnMapa.classList.add('activo');
    vistaLista.classList.remove('activa');
    vistaMapa.classList.add('activa');
    setTimeout(() => { map.invalidateSize(); }, 100);
});

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

const capaMarcadores = L.layerGroup().addTo(map);
const selectCombustible = document.getElementById('select-combustible');
const selectProvincia = document.getElementById('select-provincia');
const selectMunicipio = document.getElementById('select-municipio');
const selectOrden = document.getElementById('select-orden');
const inputLitros = document.getElementById('input-litros');
const buscador = document.getElementById('buscador');

// --- GEOLOCALIZACIÓN ---
btnGps.addEventListener('click', () => {
    if (!navigator.geolocation) {
        alert("Tu navegador no soporta GPS.");
        return;
    }
    
    btnGps.textContent = "Buscando...";
    
    navigator.geolocation.getCurrentPosition((posicion) => {
        const lat = posicion.coords.latitude;
        const lon = posicion.coords.longitude;
        ubicacionUsuario = L.latLng(lat, lon);

        // Cambiar automáticamente a "Más cercanas"
        selectOrden.value = 'distancia';

        // Poner marcador de usuario (círculo rojo)
        if (marcadorUsuario) map.removeLayer(marcadorUsuario);
        marcadorUsuario = L.circleMarker(ubicacionUsuario, { radius: 8, color: 'red', fillColor: '#f03', fillOpacity: 1 }).addTo(map).bindPopup("<b>¡Estás aquí!</b>").openPopup();

        // Volar al usuario y cambiar a la vista de mapa
        map.flyTo(ubicacionUsuario, 13);
        btnMapa.click();
        
        btnGps.textContent = "📍 Cerca de mí";
        aplicarFiltros();
        
    }, () => {
        alert("Acepta los permisos de ubicación en tu navegador para usar esta función.");
        btnGps.textContent = "📍 Cerca de mí";
    });
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
    const url = `https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroProvincia/${idProvincia}`;
    try {
        const respuesta = await fetch(url);
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

function actualizarPantalla(gasolineras, tipoCombustible) {
    capaMarcadores.clearLayers();
    document.getElementById('contenedor-tarjetas').innerHTML = '';
    const litrosDeposito = parseFloat(inputLitros.value) || 50;
    const nombreCombustible = selectCombustible.options[selectCombustible.selectedIndex].text;

    gasolineras.forEach(est => {
        const lat = parseFloat(est.Latitud.replace(',', '.'));
        const lon = parseFloat(est['Longitud (WGS84)'].replace(',', '.'));
        const precio = est[tipoCombustible]; 
        const costeLlenado = (parseFloat(precio.replace(',', '.')) * litrosDeposito).toFixed(2);
        const linkRuta = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
        
        let infoDistancia = "";
        if (ubicacionUsuario && selectOrden.value === 'distancia') {
            const distKm = (map.distance(ubicacionUsuario, [lat, lon]) / 1000).toFixed(1);
            infoDistancia = `<div style="color: #666; font-size: 13px;">A ${distKm} km de ti</div>`;
        }

        const marcador = L.marker([lat, lon]);
        marcador.bindPopup(`<b>${est['Rótulo']}</b><br><b style="color: #d9534f;">${nombreCombustible}: ${precio} €/L</b><br><a href="${linkRuta}" target="_blank" style="color: #007bff; text-decoration: none;">📍 Ir</a>`);
        capaMarcadores.addLayer(marcador);

        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta-lista';
        tarjeta.innerHTML = `
            <div style="font-weight: bold; color: #0056b3; font-size: 18px;">${est['Rótulo']}</div>
            <div style="font-size: 14px; color: #555; margin-bottom: 8px;">${est['Dirección']}</div>
            ${infoDistancia}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px;">
                <div>
                    <div style="color: #d9534f; font-weight: bold; font-size: 20px;">${precio} €/L</div>
                    <div style="color: #28a745; font-size: 14px; font-weight: bold;">Llenar: ${costeLlenado} €</div>
                </div>
                <a href="${linkRuta}" target="_blank" style="background: #007bff; color: white; padding: 8px 12px; border-radius: 4px; text-decoration: none; font-size: 14px;">📍 Ruta</a>
            </div>
        `;
        document.getElementById('contenedor-tarjetas').appendChild(tarjeta);
    });
}

selectProvincia.addEventListener('change', (evento) => cargarGasolineras(evento.target.value));
selectCombustible.addEventListener('change', aplicarFiltros);
selectMunicipio.addEventListener('change', aplicarFiltros);
selectOrden.addEventListener('change', aplicarFiltros);
inputLitros.addEventListener('input', aplicarFiltros);
buscador.addEventListener('input', aplicarFiltros);

cargarProvincias();