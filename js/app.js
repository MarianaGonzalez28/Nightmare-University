'use strict';

/* ==========================================================
   app.js: navegación entre pantallas y pintado de datos.
   Los datos vienen de db.js (objeto DB).
   ========================================================== */

/* ---------- 1. CONTENIDO DEL JUEGO (edítalo aquí) ----------
   - imagen: ruta de una imagen dentro de /images, por ejemplo 'images/nivel1.png'.
     Si es null se muestra el recuadro azul de relleno de los mockups. */
const NIVELES = [
  {
    id: 1,
    titulo: 'Título del nivel 1',
    resumen: 'Resumen corto del nivel',
    imagen: null,
    texto: [
      'Aquí va el primer párrafo de la historia del nivel 1. Reemplázalo con la narrativa de tu juego.',
      'Aquí va el segundo párrafo. Puedes agregar o quitar párrafos en esta lista.',
    ],
  },
  {
    id: 2,
    titulo: 'Título del nivel 2',
    resumen: 'Resumen corto del nivel',
    imagen: null,
    texto: [
      'Aquí va el primer párrafo de la historia del nivel 2.',
      'Aquí va el segundo párrafo del nivel 2.',
    ],
  },
];

/* ---------- 2. Utilidades ---------- */
const $ = (selector, raiz = document) => raiz.querySelector(selector);
const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)];

// Crea un elemento. Usamos textContent (nunca innerHTML) para que un
// nombre raro no pueda meter código en la página.
function crear(etiqueta, clase, texto) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

const formatoFecha = (ts) =>
  new Date(ts).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
const formatoPuntos = (n) => String(n).padStart(4, '0'); // 50 → "0050", como en los mockups

let temporizadorAviso;
function aviso(mensaje) {
  const caja = $('#aviso');
  caja.textContent = mensaje;
  caja.classList.add('visible');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => caja.classList.remove('visible'), 3500);
}

/* ---------- 3. Estado ---------- */
let usuario = null;          // cuenta con sesión abierta (o null). No tiene que ver con los puntajes.
let nivelHistoria = 1;       // nivel que se está leyendo en Historia
let promptInstalacion = null;

/* ---------- 4. Piezas de interfaz reutilizables ---------- */
function escenaDeNivel(nivel) {
  const escena = crear('div', 'escena');
  if (nivel.imagen) {
    const img = crear('img');
    img.src = nivel.imagen;
    img.alt = `Escena del nivel ${nivel.id}`;
    escena.append(img);
  } else {
    escena.textContent = `Escena del nivel ${nivel.id}`;
  }
  return escena;
}

function celda(texto, clase) {
  return crear('td', clase, texto);
}

function filaVacia(columnas, mensaje) {
  const fila = crear('tr');
  const td = crear('td', 'vacio', mensaje);
  td.colSpan = columnas;
  fila.append(td);
  return fila;
}

/* ---------- 5. Pantallas ---------- */
async function pintarInicio() {
  const niveles = $('#inicio-niveles');
  niveles.replaceChildren();
  for (const n of NIVELES) {
    const tarjeta = crear('article', 'tarjeta nivel-card');
    const fila = crear('div', 'fila');
    fila.append(crear('b', null, `Nivel ${n.id}`));
    tarjeta.append(escenaDeNivel(n), fila, crear('span', 'resumen', n.resumen));
    niveles.append(tarjeta);
  }

  const top3 = $('#inicio-top3');
  top3.replaceChildren();
  const filas = (await DB.ranking()).slice(0, 3);
  if (!filas.length) top3.append(crear('li', 'top3-vacio', 'Aún no hay puntajes.'));
  for (const f of filas) {
    const li = crear('li', 'fila-top');
    li.append(
      crear('b', 'pos', String(f.posicion)),
      crear('span', 'avatar', f.nombre[0]),
      crear('span', 'nombre', f.nombre),
      crear('b', 'puntos', formatoPuntos(f.puntos)),
    );
    top3.append(li);
  }
}

function pintarHistoria() {
  const nivel = NIVELES.find((n) => n.id === nivelHistoria);

  // Lista de niveles (columna izquierda)
  const lista = $('#historia-lista');
  lista.replaceChildren();
  for (const n of NIVELES) {
    const boton = crear('button', 'nivel-btn', `Nivel ${n.id}`);
    boton.type = 'button';
    if (n.id === nivelHistoria) boton.setAttribute('aria-current', 'true');
    boton.addEventListener('click', () => { nivelHistoria = n.id; pintarHistoria(); });
    lista.append(boton);
  }

  // Detalle del nivel
  $('#historia-escena').replaceChildren(...escenaDeNivel(nivel).childNodes);
  $('#historia-titulo').textContent = nivel.titulo;
  $('#historia-texto').replaceChildren(...nivel.texto.map((p) => crear('p', null, p)));

  $('#historia-anterior').disabled = nivelHistoria === 1;
  $('#historia-siguiente').disabled = nivelHistoria === NIVELES.length;

  // El juego se juega completo (los dos niveles seguidos), por eso solo dice "Jugar"
  const jugarBtn = $('#historia-jugar');
  jugarBtn.textContent = 'Jugar';
  jugarBtn.dataset.jugar = '';
}

async function pintarRanking() {
  const filas = await DB.ranking();
  const mio = await DB.miUltimoPuntaje();

  const cuerpo = $('#ranking-filas');
  cuerpo.replaceChildren();
  if (!filas.length) cuerpo.append(filaVacia(5, 'Aún no hay puntajes.'));

  for (const f of filas.slice(0, 15)) {
    const tr = crear('tr');
    if (mio && f.id === mio.id) tr.className = 'yo';

    const tdAccion = crear('td', 'der');
    const btnEliminar = crear('button', 'btn btn-azul', 'Eliminar');
    btnEliminar.type = 'button';
    btnEliminar.style.padding = '0.3rem 0.6rem';
    btnEliminar.style.fontSize = '0.8rem';
    btnEliminar.addEventListener('click', async () => {
      await DB.eliminarPuntaje(f.id);
      aviso(`Puntaje de ${f.nombre} eliminado.`);
      await pintarRanking();
    });
    tdAccion.append(btnEliminar);

    tr.append(
      celda(String(f.posicion)),
      celda(f.nombre),
      celda(formatoPuntos(f.puntos)),
      celda(formatoFecha(f.fecha), 'der'),
      tdAccion
    );
    cuerpo.append(tr);
  }

  // Tarjeta "Tu posición": el último puntaje que se registró desde este equipo
  $('#ranking-pos').textContent = mio ? `#${mio.posicion}` : '—';
  $('#ranking-pts').textContent = mio
    ? `${mio.nombre} · ${formatoPuntos(mio.puntos)} puntos`
    : 'Termina el juego para entrar al ranking';
}

function pintarPerfil() {
  $('#perfil-avatar').textContent = usuario.usuario[0];
  $('#perfil-nombre').textContent = usuario.usuario;
  $('#perfil-correo').textContent = usuario.correo;
  $('#perfil-desde').textContent = `Miembro desde ${formatoFecha(usuario.creado)}`;
}

/* ---------- 6. Router (navegación por #/ruta) ---------- */
const RUTAS = {
  inicio: pintarInicio,
  historia: pintarHistoria,
  ranking: pintarRanking,
  perfil: pintarPerfil,
  login: null,
  registro: null,
};
const PRIVADAS = ['perfil'];

function irA(ruta) {
  if (location.hash === `#/${ruta}`) navegar();
  else location.hash = `#/${ruta}`;
}

async function navegar() {
  let ruta = location.hash.replace('#/', '') || 'inicio';
  if (!Object.hasOwn(RUTAS, ruta)) ruta = 'inicio';

  usuario = await DB.usuarioActual();
  if (PRIVADAS.includes(ruta) && !usuario) { irA('login'); return; }
  if ((ruta === 'login' || ruta === 'registro') && usuario) { irA('perfil'); return; }

  $$('.vista').forEach((v) => { v.hidden = v.id !== `vista-${ruta}`; });
  document.body.classList.toggle('auth', ruta === 'login' || ruta === 'registro');
  $$('.menu a').forEach((a) => {
    if (a.dataset.ruta === ruta) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  const pintar = RUTAS[ruta];
  if (pintar) await pintar();

  document.title = `${$(`#vista-${ruta}`).dataset.titulo} · Nightmare University`;
  window.scrollTo(0, 0);
  $('#contenido').focus({ preventScroll: true });
}

/* ---------- 7. JUEGO: aquí se conecta ---------- */

// Los botones "Jugar" llaman a esta función. No hace falta tener cuenta para jugar.
function jugar() {
  iniciarJuego();
}

// >>> AQUÍ CONECTAS TU JUEGO <<<
// Debe correr el nivel 1 y luego el nivel 2. Al terminar el nivel 2,
// llama a  terminarJuego(puntosTotal)  con la suma de ambos niveles.
function iniciarJuego() {
  aviso('Aquí se abrirá el juego (nivel 1 y nivel 2).');
}

// Se llama UNA vez, cuando el jugador termina los dos niveles.
// Abre una ventana que pide solo el nombre y registra el puntaje.
// Para probarla sin el juego, escribe en la consola:  terminarJuego(2450)
function terminarJuego(puntosTotal) {
  const dialogo = $('#dialogo-nombre');
  $('#dialogo-puntos').textContent = formatoPuntos(puntosTotal);
  $('#nombre-error').textContent = '';
  $('#form-nombre').reset();
  dialogo.dataset.puntos = String(puntosTotal);
  dialogo.showModal();
  $('#form-nombre input').focus();
}

function configurarDialogoNombre() {
  const dialogo = $('#dialogo-nombre');

  $('#form-nombre').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = new FormData(e.target).get('nombre');
    try {
      await DB.guardarPuntaje(nombre, Number(dialogo.dataset.puntos));
      dialogo.close();
      aviso('¡Puntaje registrado!');
      irA('ranking');
    } catch (ex) {
      $('#nombre-error').textContent = ex.message;
    }
  });

  $('#nombre-cancelar').addEventListener('click', () => dialogo.close());
}

/* ---------- 8. Eventos ---------- */
function configurarEventos() {
  // Botones con data-jugar y data-instalar (se usan en varias pantallas)
  document.addEventListener('click', async (e) => {
    if (e.target.closest('[data-jugar]')) { jugar(); return; }

    if (e.target.closest('[data-instalar]')) {
      if (promptInstalacion) {
        promptInstalacion.prompt();
        await promptInstalacion.userChoice;
        promptInstalacion = null;
      } else {
        aviso('Usa la opción "Instalar" del menú de tu navegador (o "Agregar a pantalla de inicio" en el móvil).');
      }
    }
  });

  // Historia: anterior / siguiente
  $('#historia-anterior').addEventListener('click', () => { nivelHistoria = Math.max(1, nivelHistoria - 1); pintarHistoria(); });
  $('#historia-siguiente').addEventListener('click', () => { nivelHistoria = Math.min(NIVELES.length, nivelHistoria + 1); pintarHistoria(); });

  // Cerrar sesión
  $('#btn-salir').addEventListener('click', () => { DB.cerrarSesion(); aviso('Sesión cerrada.'); irA('inicio'); });

  // Olvidé mi contraseña (sin servidor no hay a dónde mandar un correo)
  $('#btn-olvido').addEventListener('click', () => aviso('Recuperar la contraseña requiere un servidor; aún no está disponible.'));

  // Formulario de inicio de sesión
  $('#form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const error = $('#login-error');
    error.textContent = '';
    const datos = Object.fromEntries(new FormData(e.target));
    if (!datos.correo.trim() || !datos.clave) {
      error.textContent = 'Escribe tu correo y tu contraseña.';
      return;
    }
    try {
      const u = await DB.iniciarSesion(datos.correo, datos.clave);
      e.target.reset();
      aviso(`Hola de nuevo, ${u.usuario}.`);
      irA('inicio');
    } catch (ex) {
      error.textContent = ex.message;
    }
  });

  // Formulario de registro
  $('#form-registro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const error = $('#registro-error');
    error.textContent = '';
    const d = Object.fromEntries(new FormData(e.target));
    const nombre = d.usuario.trim();
    const correo = d.correo.trim().toLowerCase();

    if (nombre.length < 3) { error.textContent = 'El nombre de usuario necesita al menos 3 caracteres.'; return; }
    if (!/^\S+@\S+\.\S+$/.test(correo)) { error.textContent = 'Escribe un correo válido.'; return; }
    if (d.clave.length < 6) { error.textContent = 'La contraseña necesita al menos 6 caracteres.'; return; }
    if (d.clave !== d.clave2) { error.textContent = 'Las contraseñas no coinciden.'; return; }

    try {
      await DB.registrarUsuario({ usuario: nombre, correo, clave: d.clave });
      await DB.iniciarSesion(correo, d.clave);
      e.target.reset();
      aviso(`Bienvenido, ${nombre}.`);
      irA('inicio');
    } catch (ex) {
      error.textContent = ex.message;
    }
  });

  // Formulario manual para agregar puntajes (Semana 8 Offline)
  $('#form-puntaje-manual').addEventListener('submit', async (e) => {
    e.preventDefault();
    const error = $('#puntaje-manual-error');
    error.textContent = '';
    const datos = Object.fromEntries(new FormData(e.target));

    try {
      await DB.guardarPuntaje(datos.nombre, Number(datos.puntos));
      e.target.reset();
      aviso('Puntaje guardado en IndexedDB.');
      await pintarRanking();
    } catch (ex) {
      error.textContent = ex.message;
    }
  });

  configurarDialogoNombre();
}

/* ---------- 9. Instalación de la PWA ---------- */
function configurarInstalacion() {
  // El navegador avisa que la app se puede instalar; guardamos el aviso para usarlo en el botón
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    promptInstalacion = e;
  });
  window.addEventListener('appinstalled', () => {
    promptInstalacion = null;
    ocultarInstalar();
    aviso('App instalada.');
  });
  if (window.matchMedia('(display-mode: standalone)').matches) ocultarInstalar();
}

// Si ya se está usando como app instalada, no tiene sentido mostrar "Instalar"
function ocultarInstalar() {
  $$('[data-instalar]').forEach((b) => { b.hidden = true; });
  $('#tarjeta-instalar').hidden = true;
}

/* ---------- 10. Arranque ---------- */
async function arrancar() {
  await DB.iniciar();
  configurarEventos();
  configurarInstalacion();
  window.addEventListener('hashchange', navegar);
  await navegar();

  // Service worker: permite que la app funcione sin conexión
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('sw.js');
    } catch (err) {
      console.warn('No se pudo registrar el service worker:', err);
    }
  }
}

arrancar();
