# Nightmare University (PWA)

PWA con la historia del juego y el ranking general de jugadores. Paleta: morados intensos, negro y azul frío.
Sirve en computadora y se adapta a móvil (el menú pasa a la parte de abajo).

## Estructura

```
Nightmare-University/
├── css/style.css      → estilos y paleta de colores
├── images/            → logo.png, tulipan192.png, tulipan512.png y las que agregues
├── js/
│   ├── db.js          → datos: puntajes, cuentas y sesión (IndexedDB con la librería idb)
│   └── app.js         → pantallas, navegación, formularios y conexión con el juego
├── index.html         → todas las pantallas en un solo archivo
├── manifest.json      → datos para instalar la app (nombre, colores, íconos)
├── sw.js              → service worker (precaché + Cache First, modo sin conexión)
└── README.md
```

## Base: el ejemplo del maestro (DevConnect)

Se conservaron las piezas del ejemplo y se cambió lo demás:

| Pieza | Igual que el ejemplo | Lo que cambió |
| --- | --- | --- |
| `sw.js` | Precaché del App Shell, limpieza de cachés viejas y estrategia Cache First | Rutas relativas (funciona en cualquier carpeta), no falla si falta un archivo y abre `index.html` si no hay red |
| `db.js` | Librería `idb` y funciones `guardarEnIndexedDB`, `obtenerDeIndexedDB`, `borrarDeIndexedDB` | En vez de posts, guarda puntajes y cuentas |
| `manifest.json` | Nombre, íconos 192 y 512, `display: standalone` | Nombre y colores del juego |
| `app.js` | Registro del service worker y render dinámico desde IndexedDB | Pantallas del juego (inicio, historia, ranking, perfil, login) |
| `style.css` | Área segura para iPhone (`env(safe-area-inset-*)`) | CSS propio con la paleta oscura, sin Tailwind |

## Cómo funciona el puntaje

- El puntaje es **general**: la suma de los dos niveles. No hay ranking por nivel.
- Jugar **no requiere cuenta**. Al terminar los dos niveles se pide **solo el nombre** y se registra el puntaje.
- El **login y el registro son aparte**: sirven para la cuenta (pantalla Perfil), pero los puntajes no dependen de ella.
- Cada partida terminada es una fila del ranking; el mismo nombre puede aparecer varias veces.
- "Tu posición" muestra el último puntaje registrado desde ese equipo.

## Cómo probarla

Una PWA necesita abrirse desde un servidor (no con doble clic al archivo). Cualquiera de estas opciones:

- **VS Code:** instala la extensión *Live Server* → clic derecho en `index.html` → *Open with Live Server*.
- **Node:** `npx serve` dentro de la carpeta.
- **Python:** `python -m http.server 8080` y abre `http://localhost:8080`.

`localhost` cuenta como sitio seguro, así que el service worker y el registro de cuentas funcionan.

## Conectar el juego

En `js/app.js` hay dos funciones para el juego:

1. `iniciarJuego()` es la que se llama al pulsar **Jugar**. Ahí se abre tu juego (nivel 1 y luego nivel 2).
2. `terminarJuego(puntosTotal)` se llama **una sola vez**, al terminar el nivel 2, con la suma de ambos niveles. Abre una ventana que pide el nombre, registra el puntaje y lleva al ranking.

```js
terminarJuego(2450);   // ejemplo: prueba la ventana del nombre desde la consola, sin el juego
```

Si prefieres guardar el puntaje sin la ventana, puedes llamar directo a `await DB.guardarPuntaje('Ana', 2450)`.

## Qué hay que personalizar

| Qué | Dónde |
| --- | --- |
| Textos de la historia y resúmenes de nivel | `NIVELES` al inicio de `js/app.js` |
| Imágenes de cada nivel | poner el archivo en `images/` y escribir su ruta en `imagen` dentro de `NIVELES` |
| Ilustración de la portada | `index.html`, dentro de `.portada-arte` |
| Frase de la portada | `index.html`, dentro de `.portada-texto` |
| Colores | variables al inicio de `css/style.css` |
| Logo | `images/logo.png` (se usa en `index.html`: encabezado, ícono de la pestaña y `apple-touch-icon`) |
| Ícono de la app instalada | `manifest.json` (necesita una imagen cuadrada de 192×192 y otra de 512×512) |

## Puntajes de ejemplo

La primera vez se crean 8 puntajes de ejemplo para que el ranking no se vea vacío. Para quitarlos, abre la consola del navegador y escribe:

```js
await DB.borrarDemo()
```

## Notas importantes

- **Los datos se guardan en el navegador de cada persona** (IndexedDB). Otro jugador en otra computadora no verá estos puntajes. Para un ranking compartido hará falta un servidor; `db.js` está separado para que solo cambies ese archivo.
- Como el nombre es lo único que se pide, cualquiera puede escribir cualquier nombre. Si luego quieres evitar trampas o nombres repetidos, habrá que validarlo en un servidor.
- Las contraseñas se guardan con huella SHA-256 y sal, pero al estar todo en el navegador esto es una demostración, no seguridad real.
- **Cuando cambies archivos, sube la versión en `CACHE_NAME` de `sw.js`** (`v1` → `v2`). Si no, el navegador seguirá mostrando la versión guardada. En desarrollo también ayuda marcar *Update on reload* en DevTools → Application → Service Workers.
- Para borrar todo y empezar de cero: DevTools → Application → Storage → *Clear site data*.
