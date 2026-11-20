// sw.js - Service Worker con Precaché e Intercepción Fetch (estrategia Cache First)
//
// IMPORTANTE: cada vez que cambies cualquier archivo de la app,
// sube el número de la versión (v1 → v2). Así el navegador borra la caché
// vieja y descarga los archivos nuevos. Con Cache First, si no lo haces,
// seguirás viendo la versión guardada.

const CACHE_NAME = 'nightmare-university-shell-v1';

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
            .catch(error => {
                console.error('SW: Sin red y recurso no disponible en caché:', error);
                // Si era una página, mostramos la principal en vez de un error
                if (event.request.mode === 'navigate') {
                    return caches.match('index.html');
                }
                return Response.error();
            })
    );
});
