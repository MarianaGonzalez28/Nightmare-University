'use strict';

/* ==========================================================
   db.js: todo lo que guarda y lee datos en IndexedDB,
   usando la librería idb (cargada en index.html antes que este archivo).
   Se usa desde app.js así:  await DB.ranking()
   ----------------------------------------------------------
   Hay DOS cosas separadas:
   1) PUNTAJES: se registran solo con un nombre (sin cuenta).
      Cada partida completa (los dos niveles) es una fila.
   2) CUENTAS: registro e inicio de sesión, aparte de los puntajes.

   OJO: los datos viven en el navegador de cada persona.
   Para un ranking compartido entre jugadores necesitarás
   un servidor; solo tendrías que cambiar este archivo.
   ========================================================== */
const DB = (() => {
  const NOMBRE_DB = 'nightmare-university-db';
  const VERSION_DB = 1;
  const TABLA_PUNTAJES = 'puntajes';
  const TABLA_USUARIOS = 'usuarios';

  const CLAVE_SESION = 'sesion-correo';      // localStorage: quién tiene la sesión abierta
  const CLAVE_ULTIMO = 'ultimo-puntaje-id';  // localStorage: último puntaje registrado en este equipo
  const CLAVE_DEMO = 'demo-sembrado';        // localStorage: ya se crearon los puntajes de ejemplo
  const MAX_NOMBRE = 20;

  /* ---------- Inicialización de la base de datos ---------- */
  // upgrade() solo corre la primera vez (o al subir VERSION_DB): aquí se crean las "tablas"
  const dbPromise = idb.openDB(NOMBRE_DB, VERSION_DB, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(TABLA_USUARIOS)) {
        const usuarios = db.createObjectStore(TABLA_USUARIOS, { keyPath: 'correo' });
        usuarios.createIndex('usuario', 'usuarioMin', { unique: true });
      }
      if (!db.objectStoreNames.contains(TABLA_PUNTAJES)) {
        db.createObjectStore(TABLA_PUNTAJES, { keyPath: 'id', autoIncrement: true });
      }
    },
  });

  /* ---------- Funciones genéricas (como en el ejemplo del maestro) ---------- */

  // Insertar o actualizar un registro. Devuelve su llave (el id).
  async function guardarEnIndexedDB(tabla, objeto) {
    const db = await dbPromise;
    return db.put(tabla, objeto);
  }

  // Obtener todos los registros de una tabla
  async function obtenerDeIndexedDB(tabla) {
    const db = await dbPromise;
    return db.getAll(tabla);
  }

  // Borrar un registro por su llave
  async function borrarDeIndexedDB(tabla, llave) {
    const db = await dbPromise;
    return db.delete(tabla, llave);
  }

  /* ---------- Utilidades de cuentas ---------- */

  // Nunca guardamos la contraseña tal cual: se guarda su huella SHA-256 con una sal
  async function huella(clave, sal) {
    const datos = new TextEncoder().encode(sal + clave);
    const buffer = await crypto.subtle.digest('SHA-256', datos);
    return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Lo que sí puede ver el resto de la app (sin contraseña ni sal)
  const publico = (u) => ({ correo: u.correo, usuario: u.usuario, creado: u.creado });

  /* ---------- PUNTAJES (sin cuenta, solo nombre) ---------- */

  // ESTA es la función que debe llamar tu juego al terminar los dos niveles:
  //   await DB.guardarPuntaje('Ana', 2450);   // nombre y puntaje total (nivel 1 + nivel 2)
  async function guardarPuntaje(nombre, puntos) {
    nombre = String(nombre ?? '').trim().replace(/\s+/g, ' ');
    puntos = Number(puntos);
    if (!nombre || nombre.length > MAX_NOMBRE) {
      throw new Error(`Escribe tu nombre (máximo ${MAX_NOMBRE} caracteres).`);
    }
    if (!Number.isFinite(puntos) || puntos < 0) {
      throw new Error('El puntaje no es válido.');
    }
    const registro = { nombre, puntos: Math.round(puntos), fecha: Date.now() };
    registro.id = await guardarEnIndexedDB(TABLA_PUNTAJES, registro);
    localStorage.setItem(CLAVE_ULTIMO, String(registro.id));
    return registro;
  }

  // Lista general ordenada: { id, posicion, nombre, puntos, fecha }
  // Si hay empate, queda arriba quien lo logró primero.
  async function ranking() {
    const filas = (await obtenerDeIndexedDB(TABLA_PUNTAJES))
      .sort((a, b) => b.puntos - a.puntos || a.fecha - b.fecha);
    filas.forEach((f, i) => { f.posicion = i + 1; });
    return filas;
  }

  // El último puntaje registrado desde este equipo (para "Tu posición"), o null
  async function miUltimoPuntaje() {
    const id = Number(localStorage.getItem(CLAVE_ULTIMO));
    if (!id) return null;
    return (await ranking()).find((f) => f.id === id) || null;
  }

  // Eliminar un puntaje específico por su id (keyPath)
  async function eliminarPuntaje(id) {
    await borrarDeIndexedDB(TABLA_PUNTAJES, Number(id));
    if (Number(localStorage.getItem(CLAVE_ULTIMO)) === Number(id)) {
      localStorage.removeItem(CLAVE_ULTIMO);
    }
  }

  /* ---------- CUENTAS (login aparte) ---------- */

  async function registrarUsuario({ usuario, correo, clave }) {
    const db = await dbPromise;
    correo = correo.trim().toLowerCase();
    usuario = usuario.trim();

    if (await db.get(TABLA_USUARIOS, correo)) {
      throw new Error('Ya existe una cuenta con ese correo.');
    }
    if (await db.getFromIndex(TABLA_USUARIOS, 'usuario', usuario.toLowerCase())) {
      throw new Error('Ese nombre de usuario ya está ocupado.');
    }

    const sal = crypto.randomUUID();
    const registro = {
      correo,
      usuario,
      usuarioMin: usuario.toLowerCase(),
      sal,
      clave: await huella(clave, sal),
      creado: Date.now(),
    };
    await db.add(TABLA_USUARIOS, registro);
    return publico(registro);
  }

  async function iniciarSesion(correo, clave) {
    const db = await dbPromise;
    correo = correo.trim().toLowerCase();
    const u = await db.get(TABLA_USUARIOS, correo);
    // El mismo mensaje para "no existe" y "clave mala": no revela qué correos existen
    if (!u || (await huella(clave, u.sal)) !== u.clave) {
      throw new Error('Correo o contraseña incorrectos.');
    }
    localStorage.setItem(CLAVE_SESION, correo);
    return publico(u);
  }

  function cerrarSesion() {
    localStorage.removeItem(CLAVE_SESION);
  }

  async function usuarioActual() {
    const correo = localStorage.getItem(CLAVE_SESION);
    if (!correo) return null;
    const db = await dbPromise;
    const u = await db.get(TABLA_USUARIOS, correo);
    if (!u) { cerrarSesion(); return null; }
    return publico(u);
  }

  /* ---------- Puntajes de ejemplo ---------- */
  // Para que el ranking no se vea vacío mientras desarrollas. Se crean una sola vez.
  // Para quitarlos, abre la consola y escribe:  await DB.borrarDemo()

  const DEMO = [
    ['Luna', 2690], ['Orion', 2490], ['Nyx', 2275], ['Helios', 2130],
    ['Vega', 1905], ['Altair', 1780], ['Selene', 1530], ['Draco', 1350],
  ];
  const DIA = 24 * 60 * 60 * 1000;

  async function sembrarDemo() {
    if (localStorage.getItem(CLAVE_DEMO)) return;
    const db = await dbPromise;
    if ((await db.count(TABLA_PUNTAJES)) === 0) {
      for (const [i, [nombre, puntos]] of DEMO.entries()) {
        await guardarEnIndexedDB(TABLA_PUNTAJES, {
          nombre, puntos, fecha: Date.now() - (i + 1) * DIA, demo: true,
        });
      }
    }
    localStorage.setItem(CLAVE_DEMO, '1');
  }

  async function borrarDemo() {
    const todos = await obtenerDeIndexedDB(TABLA_PUNTAJES);
    for (const p of todos.filter((x) => x.demo)) {
      await borrarDeIndexedDB(TABLA_PUNTAJES, p.id);
    }
  }

  // Se llama una vez al arrancar la app
  async function iniciar() {
    await dbPromise;
    await sembrarDemo();
  }

  return {
    iniciar, guardarPuntaje, ranking, miUltimoPuntaje, borrarDemo,
    registrarUsuario, iniciarSesion, cerrarSesion, usuarioActual, eliminarPuntaje,
  };
})();

