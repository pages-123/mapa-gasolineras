// Este código es obligatorio para que el navegador reconozca la web como PWA instalable
self.addEventListener('install', (e) => {
    console.log('[Service Worker] Instalado');
});

self.addEventListener('fetch', (e) => {
    // No hacemos nada complejo, solo cumplimos el requisito del navegador
});
