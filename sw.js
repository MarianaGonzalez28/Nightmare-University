// sw.js - Service Worker con Precaché e Intercepción Fetch (estrategia Cache First)
//
// IMPORTANTE: cada vez que cambies cualquier archivo de la app,
// sube el número de la versión (v1 → v2). Así el navegador borra la caché
// vieja y descarga los archivos nuevos. Con Cache First, si no lo haces,
// seguirás viendo la versión guardada.
importScripts('https://cdn.jsdelivr.net/npm/idb@7.1.1/build/umd.js');

const CACHE_NAME = 'nightmare-university-shell-v3';

// Rutas relativas: así la app funciona en la raíz (localhost) o dentro de una carpeta
const STATIC_ASSETS = [
    './',
    'index.html',
    'css/style.css',
    'js/db.js',
    'js/app.js',
    'manifest.json',
    'images/logo192.png',
    'images/logo512.png',
    // La librería idb también se guarda, para que IndexedDB funcione sin conexión
    'https://cdn.jsdelivr.net/npm/idb@7.1.1/build/umd.js'
];

// FASE DE INSTALACIÓN (Precaché del App Shell)
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('SW: Guardando recursos estáticos en la caché...');
                // Uno por uno: si falta algún archivo (por ejemplo una imagen todavía no
                // copiada), los demás sí se guardan y el service worker se instala igual.
                return Promise.all(
                    STATIC_ASSETS.map(recurso =>
                        cache.add(recurso).catch(() => console.warn('SW: No se pudo guardar ->', recurso))
                    )
                );
            })
            .then(() => {
                console.log('SW: Archivos almacenados.');
                return self.skipWaiting();
            })
    );
});

// FASE DE ACTIVACIÓN (Toma de control y limpieza de cachés viejas)
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// FASE FETCH: Estrategia Cache First (Caché primero con respaldo en Red)
self.addEventListener('fetch', event => {
    // Ignora extensiones de Chrome y peticiones que no sean GET
    if (!event.request.url.startsWith('http') || event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then(responseInCache => {
                // 1. Si está en caché, lo entrega desde el disco
                if (responseInCache) {
                    return responseInCache;
                }

                // 2. Si no está en caché, lo busca en internet
                return fetch(event.request);
            })
            .catch(async error => {
                console.error('SW: Sin red y recurso no disponible en caché:', error);
                if (event.request.mode === 'navigate') {
                    return (await caches.match('index.html')) || (await caches.match('./'));
                }
                return Response.error();
            })
    );
    
});

// FASE BACKGROUND SYNC: Vaciar cola temporal al recuperar conexión
self.addEventListener('sync', event => {
    if (event.tag === 'sync-puntajes') {
        console.log('[SW] Evento Sync disparado: sincronizando cola sync-posts...');
        event.waitUntil(sincronizarPuntajesPendientes());
    }
});

async function sincronizarPuntajesPendientes() {
    const db = await idb.openDB('nightmare-university-db', 2);
    const pendientes = await db.getAll('sync-posts');

    if (!pendientes.length) {
        console.log('[SW] No hay registros pendientes en sync-posts.');
        return;
    }

    for (const item of pendientes) {
        console.log('[SW] Enviando registro sincronizado:', item);
        await db.delete('sync-posts', item.id);
    }

    console.log('[SW] Cola sync-posts vaciada con éxito.');
}
