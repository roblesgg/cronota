const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, dialog, nativeTheme, Notification, desktopCapturer, net } = require('electron');
const path = require('path');
const fs = require('fs');

// Modo pruebas (para los desarrollos del roadmap):
//   npx electron . --pruebas                 (o doble clic en tools\modo-pruebas.vbs)
// Sus datos viven en %TEMP%\cronota-pruebas y se conservan entre pruebas; la primera vez (o con
// --datos-nuevos) se copian los tuyos. Nada de lo que hagas ahí toca tus horas reales.
const MODO_PRUEBAS = process.argv.includes('--pruebas');
if (MODO_PRUEBAS) {
  const caja = path.join(require('os').tmpdir(), 'cronota-pruebas');
  try {
    const copiar = process.argv.includes('--datos-nuevos') || !fs.existsSync(path.join(caja, 'imputa-tasks.json'));
    fs.mkdirSync(caja, { recursive: true });
    const real = path.join(app.getPath('appData'), 'imputa-me');
    if (copiar) ['imputa-tasks.json', 'imputa-settings.json'].forEach((f) => {
      try { fs.copyFileSync(path.join(real, f), path.join(caja, f)); } catch {}
    });
  } catch {}
  app.setPath('userData', caja);
}

// Instancia única: sin esto, cada vez que se relanzaba la app (acceso directo, inicio con
// Windows, doble clic...) mientras ya había una corriendo, se abría un PROCESO NUEVO entero
// -con su propio icono de bandeja y su propio panel- en vez de traer al frente el que ya
// estaba abierto. De ahí que a veces aparecieran dos paneles a la vez.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}
app.on('second-instance', () => {
  // Alguien ha vuelto a lanzar la app mientras ya estaba corriendo: solo la traemos al
  // frente (por donde se quedó), no dejamos que se abra un proceso duplicado.
  openLastView();
});

// 2.9.4: a veces, justo al arrancar con Windows, una ventana (o un iframe del panel) recibe su
// .html como texto plano y enseña el código en pantalla en vez de la interfaz: la barra
// lateral, que ocupa toda la pantalla, la llenaba de texto. Cerrar y abrir lo arreglaba. Aquí
// se comprueba cada carga y, si ha llegado como texto, se recarga (como mucho 3 veces).
app.on('web-contents-created', (_e, wc) => {
  const intentos = new Map();
  const revisar = async (frame) => {
    try {
      if (!frame || !/^file:/i.test(frame.url || '')) return;
      const tipo = await frame.executeJavaScript('document.contentType');
      if (tipo === 'text/html') return;
      const n = intentos.get(frame.url) || 0;
      if (n >= 3) return;
      intentos.set(frame.url, n + 1);
      setTimeout(() => { try { frame.reload(); } catch {} }, 300 * (n + 1));
    } catch {}
  };
  wc.on('did-finish-load', () => revisar(wc.mainFrame));
  wc.on('did-frame-finish-load', (_ev, esPrincipal, procesoId, frameId) => {
    if (esPrincipal) return;
    try { revisar(require('electron').webFrameMain.fromId(procesoId, frameId)); } catch {}
  });
});

const APP_ICON_PATH = path.join(__dirname, 'assets', 'icon.png');
// Para las ventanas, el .ico (16-256 px): el PNG es de 2000×2000 y se decodificaba
// entero (~16 MB) cada vez que se creaba una ventana, como el recordatorio.
const WINDOW_ICON_PATH = path.join(__dirname, 'assets', 'icon.ico');
// 2.15: más colores en la rueda automática (se repetían enseguida con ocho).
const TASK_COLORS = ['#6366f1','#f472b6','#34d399','#fbbf24','#60a5fa','#f87171','#a78bfa','#2dd4bf','#fb923c','#a3e635','#38bdf8','#e879f9','#facc15','#14b8a6','#f43f5e','#8b5cf6'];
// ── Temas de color ───────────────────────────────────────────────────────────
// Los temas, los acentos y la paleta resuelta viven en themes.js (también los usan las
// herramientas de captura de tools/).
const { THEMES, DEFAULT_THEME, ACCENTS, themeVars: resolverTema } = require('./themes');
const { vigilarCapturas } = require('./capturas-windows');
// Versión de la Microsoft Store (paquete MSIX): la actualiza la Store, no nuestro actualizador, y
// el arranque con Windows lo gestiona Windows (Configuración → Aplicaciones → Inicio).
const IS_STORE = !!process.windowsStore;
// 2.9.2: paso de la versión del instalador a la de la Store y copias diarias en Documentos\Cronota.
const copias = require('./copias');
const nube = require('./nube');   // 2.14: sincronizar con OneDrive o Google Drive   // 2.13: copias diarias y arranque con Windows (antes en migracion-store.js)
const outlookIcs = require('./outlook-ics');     // 2.12: reuniones de Outlook por enlace ICS
const enLlamada = require('./en-llamada');
const { recortarSolapes } = require('./recortar-solapes');   // 2.12: la reunión manda       // 2.12: ¿micrófono en uso? → avisos en silencio
const { GROUP_PALETTES, colorFromGroupPalette } = require('./palettes');
// Versión de la interfaz: la 3 es el rediseño de la 2.8 (Noche cálida). Al pasar a ella se
// estrena el tema nuevo una vez; después cada cual elige el que quiera en Ajustes.
const UI_VERSION = 5;

// Recorrido de novedades que se muestra UNA vez al actualizar. Solo para quien va por el
// canal estable: en el de prueba las versiones se suceden a diario y sería un incordio.
// Un mismo recorrido puede valer para varias versiones (2.2.1 solo arreglaba que este
// no llegara a salir), y por eso se comparte el objeto: así se detecta que ya se ha
// visto y no se repite palabra por palabra en la siguiente actualización.
const NOVEDADES_2_2 = {
  title: 'Novedades de Cronota 2.2',
  steps: [
    { icon:'cursor', title:'Se acabó el parpadeo del cursor',
      text:'Al pasar el ratón por botones, campos y agarradores el cursor se quedaba parpadeando entre la flecha y la mano. Ya no: ahora se mantiene estable mientras mueves el ratón.' },
    { icon:'calendar', title:'Las tareas ya no se pisan',
      text:'Al estirar una tarea por sus extremos en el calendario, ahora hace tope justo donde llega la de al lado. Si la arrastras a fondo, una acaba exactamente cuando empieza la otra.' },
    { icon:'calendar', title:'Horas legibles en cada tarea',
      text:'La duración baja a su propia línea, así que la hora de inicio y la de fin se leen enteras sin cortarse.' },
    { icon:'screen', title:'Mejor con varios monitores',
      text:'Al esconder el panel flotante ya no asoma un instante en la pantalla de al lado: ahora entra y sale con un desvanecido sin salir nunca de su monitor.' },
    { icon:'spark', title:'Se esconde a tu ritmo',
      text:'Si usas "esconder cuando el ratón sale", puedes ajustar el retardo en medios segundos, e incluso ponerlo a cero para que se esconda al instante.' },
    { icon:'bell', title:'Actualizaciones sin sorpresas',
      text:'Cuando haya una versión nueva te avisa sola con una notificación, pero no se descarga ni se instala nada sin que tú lo decidas.' },
    { icon:'spark', title:'Esto que estás viendo',
      text:'A partir de ahora, cada versión estable te recibe con un recorrido como este. Puedes repasarlo cuando quieras desde Ajustes → Ver novedades.' },
  ],
};

const NOVEDADES_2_3 = {
  title: 'Novedades de Cronota 2.3',
  steps: [
    { icon:'bar', title:'La barra flotante ya no se pierde',
      text:'Se quedaba sin aparecer al encender el ordenador, y con varios monitores podía acabar plantada en medio de la pantalla. Ahora se recoloca sola al arrancar, cuando conectas o desconectas pantallas, y vuelve siempre a su sitio al cerrar el panel.' },
    { icon:'cursor', title:'Se enciende cuando estás al lado',
      text:'Antes se iluminaba desde bastante lejos. Ahora reacciona con el ratón ya pegado, y en Ajustes → Barra flotante puedes decidir a qué distancia exacta se enciende.' },
    { icon:'spark', title:'Se mueve con suavidad',
      text:'El panel iba a trompicones al abrirse y al cambiar de pestaña porque se le animaba el tamaño paso a paso. Ahora entra y sale con un desvanecido limpio.' },
    { icon:'screen', title:'Arrastrar ya no se queda pegado',
      text:'Si al agrandar el panel soltabas el ratón fuera de la ventana, se quedaba enganchado como si siguieras pulsando hasta hacer clic en otro sitio. Arreglado, también al mover la barrita.' },
    { icon:'guide', title:'El tutorial te lleva de la mano',
      text:'Ahora es un recorrido guiado: empieza en el Panel y te lleva solo al Calendario, a Guardadas y a Ajustes. Tú solo le das a Siguiente. Además arranca en el momento de pulsarlo, y en las páginas largas se desplaza sola hasta lo que te está explicando.' },
    { icon:'pencil', title:'Renombrar con un clic',
      text:'Cada tarea del Panel y cada sección de Guardadas tiene su lápiz al lado del botón de borrar. Ya no hay que adivinar que era doble clic (que sigue funcionando).' },
    { icon:'folder', title:'Ordena tus secciones',
      text:'En Guardadas hay un botón nuevo para ordenar las secciones: alfabéticamente, por orden de creación, o a tu manera arrastrándolas por su asa. Tu orden se guarda.' },
  ],
};

const NOVEDADES_2_4 = {
  title: 'Novedades de Cronota 2.4',
  steps: [
    { icon:'lista', title:'Subtareas',
      text:'Dentro de una tarea puedes crear subtareas: en "Cocina", el horno y el frigorífico. La flechita de cada tarea del Panel las despliega, cada una lleva su propio tiempo y su play, y todo lo que hagas dentro suma en la tarea. Sus notas van como siempre, una por sesión.' },
    { icon:'spark', title:'El Panel, reorganizado',
      text:'Lo que estás haciendo ahora ocupa el sitio de honor: una tarjeta grande con su cronómetro, su nota y el botón de pausar. El total del día baja a una línea fina y la lista de abajo ya no repite la tarea que está arriba.' },
    { icon:'guide', title:'Accesos rápidos',
      text:'Bajo la lista de tareas tienes cuatro botones: Calendario, Guardadas, Ajustes, y uno que vuelve a poner en marcha la última tarea que estuviste haciendo, con su nombre puesto.' },
    { icon:'enlace', title:'Botón para imputar',
      text:'En Ajustes → Enlace para imputar pega la dirección del sitio donde metes las horas de verdad. Aparecerá un botón "Imputar" en el Panel y en el Calendario que te lleva ahí de un clic.' },
    { icon:'reloj', title:'Hora de salida',
      text:'Dile a qué hora terminas y, si a esa hora sigue habiendo una tarea en marcha, te aviso. La misma hora toda la semana o una distinta cada día, con los que no trabajes cancelados. Y si quieres, que te la pare yo sola.' },
    { icon:'ojo', title:'Descansa la vista',
      text:'La regla 20-20-20 que recomiendan los oftalmólogos: cada 20 minutos, mira 20 segundos a algo que esté a unos 6 metros. Salen unos ojos flotantes con la cuenta atrás; eliges cada cuánto, cuánto duran, dónde y de qué tamaño, y un clic los quita hasta la próxima.' },
    { icon:'calendar', title:'Tu semana y tu mes',
      text:'En el calendario, debajo de las tareas del día están ahora las de la semana y las del mes, cada bloque con el tiempo de cada tarea y su total. Y en cada rato puedes elegir a qué subtarea fue.' },
    { icon:'screen', title:'La barra y tus monitores',
      text:'Si desconectas la pantalla donde tenías la barra flotante, se pasa sola a la que quede, y al volver a conectarla se va otra vez a ella. La reconoce por sus medidas, porque Windows le cambia el identificador al reconectarla.' },
  ],
};

// La 2.4 contaba las novedades y ya: un resumen leído, sin enseñar dónde estaba nada.
// Este es corto a propósito, porque lo que explica de verdad viene después: el
// recorrido guiado, que va señalando cada cosa en su sitio.
const NOVEDADES_2_4_1 = {
  title: 'Novedades de Cronota 2.4',
  steps: [
    { icon:'guide', title:'Ahora te lo enseño, no te lo cuento',
      text:'Hasta ahora las novedades eran una presentación que leías y cerrabas, y luego tocaba buscarse la vida. A partir de aquí, el recorrido va por la app señalando cada cosa nueva en el sitio donde está.' },
    { icon:'lista', title:'Lo que trae la 2.4',
      text:'Subtareas dentro de cada tarea, el Panel reorganizado con lo que estás haciendo en grande, accesos rápidos, hora de salida, la regla 20-20-20 para descansar la vista, un botón para imputar y los totales de semana y mes en el calendario.' },
    { icon:'spark', title:'Tú solo dale a Siguiente',
      text:'El recorrido empieza en el Panel y te lleva solo al Calendario, a Guardadas y a Ajustes. Solo verás lo que sea nuevo para ti, y puedes dejarlo a medias cuando quieras: lo visto queda visto. Lo tienes siempre en Ajustes → Ver tutorial.' },
  ],
};

const NOVEDADES_2_5 = {
  title: 'Novedades de Cronota 2.5',
  steps: [
    { icon:'guide', title:'Te lo enseño donde está',
      text:'Como en la 2.4: cuando acabes de leer esto, el recorrido te lleva por la app señalando cada cosa nueva en su sitio. Solo verás lo que no hayas visto ya, y con darle a Siguiente basta.' },
    { icon:'bell', title:'No molestar',
      text:'Silencia de golpe todo lo que sale por encima: el recordatorio de las horas, los ojos del 20-20-20 y las notificaciones. Los minutos u horas que quieras, y los cronómetros siguen contando igual.' },
    { icon:'bar', title:'La barra, con su menú',
      text:'Clic derecho sobre la barra flotante: esconderla un rato, cambiarla de pantalla o de borde, pausar la tarea, o pasarte al modo clásico de ventanas. Y ya no se queda detrás de lo que pongas a pantalla completa.' },
    { icon:'folder', title:'Guardadas, como un esquema',
      text:'Cada tarea guardada despliega sus subtareas con el tiempo que llevan, y pulsando una retomas la tarea justo en ella. Con botones para abrirlo y cerrarlo todo, y ordenado ascendente o descendente.' },
    { icon:'calendar', title:'Los días que trabajas',
      text:'Quita el sábado y el domingo del calendario y las columnas se reparten el hueco. Y si una semana suelta sí trabajas un sábado, lo metes solo en esa semana desde el botón "Días".' },
    { icon:'pencil', title:'Clic derecho en el calendario',
      text:'Sobre cualquier rato del calendario: guardar la tarea en una sección, retomarla desde ahora o alargar ese rato hasta ahora — conservando su subtarea y su nota — y editarlo o eliminarlo.' },
    { icon:'lista', title:'"Guardadas" ahora es "Tareas"',
      text:'Y ya no es solo el archivo: están todas tus tareas, con las que no tienen sección agrupadas al principio. Cada una con su play, su papelera y su color, y la que esté corriendo resaltada con su punto latiendo. Borrar una la manda a la papelera y NO toca el calendario: lo que registraste sigue ahí.' },
    { icon:'guide', title:'El Panel, solo lo reciente',
      text:'Como todas viven en Tareas, el Panel enseña únicamente las que has usado hace poco, la última arriba, con un "ver todas" al lado cuando hay más.' },
    { icon:'spark', title:'Y por debajo',
      text:'24 colores de tarea en vez de 8, animaciones bastante más fluidas, el panel flotante se adapta de tamaño con animación al cambiar de pestaña, los ojos avisan cuando toca de verdad, y el instalador ya no te pide cerrar la app a mano al actualizar.' },
  ],
};

const NOVEDADES_2_8 = {
  title: 'Novedades de Cronota 2.8',
  steps: [
    { icon:'guide', title:'Te lo enseño en su sitio',
      text:'Cuando acabes de leer esto, el recorrido te lleva por el calendario, Tareas y Ajustes señalando cada cosa nueva donde está. Solo verás lo que no hayas visto ya.' },
    { icon:'spark', title:'Cara nueva',
      text:'Toda la app rediseñada con estilo Mac: el tema Noche cálida (y Luz, el claro), letra nueva, cápsulas en vez de cajas y animaciones con muelle. Al cambiar de pestaña ya no quedan trozos en blanco.' },
    { icon:'calendar', title:'El calendario, a mano',
      text:'Un clic selecciona un rato (ya no lo abre); doble clic o Intro abre sus detalles. Ctrl+C lo copia, haces clic donde quieras y Ctrl+V lo pega ahí, viendo antes dónde va a quedar. Ctrl+D lo duplica y Supr lo borra.' },
    { icon:'pencil', title:'Menú circular',
      text:'Clic derecho sobre un rato: detalles, pausar o seguir, alargar hasta ahora, copiar, duplicar, color, sección y eliminar, en una rueda de cristal. Basta con mover el ratón hacia la opción. En un hueco: entrada nueva, pegar o empezar una tarea.' },
    { icon:'guide', title:'Bocadillos de cristal',
      text:'"Nueva entrada" y los detalles de un rato salen al lado del bloque, apuntándole, con cristal líquido que dobla lo que hay detrás. Si lo prefieres esmerilado, se apaga en Ajustes → Apariencia.' },
    { icon:'folder', title:'Colores por sección',
      text:'En Tareas, el botón de paleta de cada sección le da unos tonos (azules, verdes, naranjas…): cada tarea nueva de esa sección coge uno al azar. Con "Repintar" se los das también a las que ya tiene.' },
  ],
};

const NOVEDADES_2_8_3 = {
  title: 'Novedades de Cronota 2.8.3',
  steps: [
    { icon:'spark', title:'Ajustes, de un vistazo',
      text:'Cada opción con su icono y una línea, no un párrafo. Arriba, tu app en pequeño cambia de color según tocas; la barra flotante y el descanso visual se ven en una pantallita.' },
    { icon:'guide', title:'Siete temas nuevos y más acentos',
      text:'Aurora, Medianoche, Atardecer y Musgo (oscuros), Lavanda, Menta y Arena (claros), todos con sus brillos. Y el doble de colores de acento.' },
    { icon:'bell', title:'El recordatorio, de cristal',
      text:'El aviso de la esquina brota del borde de la pantalla como una gota, se abre en su sitio y, al irse, vuelve a meterse por donde vino.' },
    { icon:'bar', title:'Panel lateral de cristal',
      text:'Sube "Transparencia del panel" en Ajustes y el panel lateral pasa a ser de cristal líquido. Con "Difuminar el fondo" eliges si va esmerilado o claro.' },
    { icon:'pencil', title:'Ctrl+Z y Ctrl+Y',
      text:'Deshaz y rehaz cualquier cambio en tareas, ratos del calendario o secciones. Y en el calendario: arrastrar un rato lo vuelve de cristal, clic en "pegar aquí" pega, y clic derecho en una tarea de la izquierda la inicia.' },
    { icon:'lista', title:'Tareas, como el Panel',
      text:'Cada tarea es una píldora: el lápiz y la papelera asoman al pasar el ratón, y la que está en marcha se resalta igual que en el Panel.' },
    { icon:'calendar', title:'Detalles pulidos',
      text:'Las listas se desvanecen por los bordes al hacer scroll en vez de cortarse en seco, la tarea en marcha del calendario va en una píldora, y en modo ventana ya no se duplica el texto al bajar por Ajustes.' },
  ],
};

const NOVEDADES_2_9 = {
  title: 'Novedades de Cronota 2.9',
  steps: [
    { icon:'spark', title:'Un lavado de cara',
      text:'Letra nueva, más aire y menos texto pequeño en todas las pantallas. Los desplegables ya no son los de Windows: se abren con una animación y se manejan también con el teclado.' },
    { icon:'bar', title:'La tarea en marcha, más clara',
      text:'Se tiñe del color de la propia tarea, con el contador grande a la izquierda y la pausa a mano a la derecha. Abajo, Imputar y Añadir tarea juntos.' },
    { icon:'guide', title:'Ajustes por categorías',
      text:'Apariencia, Avisos, Calendario, Barra y General: ves una cada vez en lugar de una lista larguísima, y se acuerda de la última que abriste.' },
    { icon:'pencil', title:'Nueva tarea, sin agobios',
      text:'Lo justo a la vista: nombre, sección, tipo y nota. La nota fija y el tiempo que ya llevas, en «Más opciones».' },
    { icon:'calendar', title:'Calendario y Tareas',
      text:'Los nombres de la izquierda ya no se cortan, la sugerencia de pegar desaparece al pegar, y en Tareas la flecha de cada sección mira a la derecha cerrada y hacia abajo abierta.' },
    { icon:'bell', title:'Actualizaciones sin pelearse',
      text:'Se instalan solas, sin la ventana de Windows, y la app vuelve a abrirse. Si algún fichero sigue ocupado, el instalador espera en vez de dar error. Y el panel lateral ya no bloquea lo que hay detrás.' },
  ],
};

const WHATS_NEW = {
  '2.17.0': { title: 'Novedades de Cronota 2.17', steps: [
    { icon:'bell', title:'Avisos nuevos',
      text:'Todos los avisos bajan desde el borde de arriba, de cristal. Los que te piden algo (recordatorios, citas) se quedan, con un toque naranja; los demás se van solos. La rueda del ratón elige cuánto posponer. En Ajustes → Avisos: pantalla, tamaño y estilo (arriba o abajo).' },
    { icon:'calendar', title:'Avisarme en el calendario',
      text:'Clic derecho en una cita tuya o en una reunión de Outlook → Avisarme: a la hora, 5, 10, 15 o 30 min antes, 1 h o 1 día. Y el recordatorio de la tarea en marcha enseña el tiempo corriendo.' },
    { icon:'pencil', title:'Notas más cómodas',
      text:'Escribir una nota es ahora un editor grande. Las notas largas se pliegan con «Ver más», las hechas se ven aparte sin taparse, «Ordenar» coloca las notas del modo en que estés y Notas recuerda su propio tamaño.' },
  ] },
  '2.16.0': { title: 'Novedades de Cronota 2.16', steps: [
    { icon:'spark', title:'Notas, a la vista',
      text:'Una pestaña nueva, Notas: tus notas sueltas en un mapa, o en cuadrícula, filas, por sección, urgencia o fecha. Clic derecho para todo: urgencia, recordatorio, vencimiento, sección, color… Y se escriben con Markdown.' },
    { icon:'folder', title:'Archivos en las notas',
      text:'Suelta un PDF, una imagen o lo que quieras en una nota (o en su ventana): se ve la vista previa, se abre sin salir de Cronota y una nota puede tener texto y varios archivos.' },
    { icon:'folder', title:'Caja fuerte',
      text:'Otra pizarra igual que la de Notas, pero que solo se abre con tu PIN o contraseña. Manda cualquier nota con el menú redondo («A la caja fuerte»). Va cifrada y se cierra sola a los 5 minutos. Si olvidas el PIN no se puede recuperar.' },
  ] },
  '2.15.0': { title: 'Novedades de Cronota 2.15', steps: [
    { icon:'spark', title:'Paletas a tu gusto para cada cliente',
      text:'En Tareas, el botón de colores de cada sección tiene «+ Paleta personalizada»: elige sus colores y cada tarea nueva de ese cliente coge uno. Hay más paletas de serie y más colores para las tareas.' },
    { icon:'reloj', title:'Más cómodo al crear',
      text:'Puedes crear una tarea sin empezarla, y en el calendario «+ Nueva tarea» está abajo a la izquierda y usa lo que escribiste en el buscador.' },
  ] },
  '2.14.0': { title: 'Novedades de Cronota 2.14', steps: [
    { icon:'folder', title:'Tus horas en OneDrive o Google Drive',
      text:'En Ajustes → General → Sincronizar eliges uno con un clic, sin cuentas en Cronota: tus horas y tus ajustes se guardan en tu nube y en otro PC eliges lo mismo para tenerlos allí.' },
    { icon:'reloj', title:'No cuenta mientras no estás',
      text:'Si apagas el PC, se cierra de golpe o el portátil se queda dormido más de media hora con una tarea en marcha, Cronota la para en ese momento y te avisa.' },
    { icon:'spark', title:'Más temas y Ajustes al momento',
      text:'Temas nuevos con brillo y clásicos, más colores de acento, y en Ajustes todo se guarda solo, sin botón de Aplicar. El iconito de Outlook abre ese día en tu calendario.' },
  ] },
  '2.13.0': { title: 'Novedades de Cronota 2.13', steps: [
    { icon:'calendar', title:'Lleva tus horas a Outlook',
      text:'Haz clic en una entrada del calendario y pulsa «Crear en Outlook»: se abre un evento ya relleno con sus horas y su nota, y solo tienes que guardarlo.' },
    { icon:'enlace', title:'Conectar Outlook, más fácil',
      text:'En Ajustes → Calendario, «Sacar el vínculo en Outlook» te lleva directo a donde se publica el calendario. Y el botón «Añadir» de las reuniones ahora es más discreto.' },
  ] },
  '2.12.0': { title: 'Novedades de Cronota 2.12', steps: [
    { icon:'calendar', title:'Tus reuniones de Outlook, en el calendario',
      text:'Publica tu calendario en Outlook y pega el vínculo ICS en Ajustes → Calendario. Tus reuniones salen como sugerencias: un clic las añade a tus horas y lo que se solape se recorta solo.' },
    { icon:'bell', title:'Sin avisos en llamadas',
      text:'Si Teams, Meet o Zoom están usando el micrófono, Cronota no te interrumpe con avisos. Se puede apagar en Ajustes → Avisos.' },
  ] },
  '2.11.0': { title: 'Novedades de Cronota 2.11', steps: [
    { icon:'bar', title:'Lleva la barra a otra pantalla',
      text:'Mantén pulsada la barrita del borde y arrástrala a otra pantalla: se muda contigo y se queda allí, también el panel.' },
    { icon:'spark', title:'Todo se mueve con más suavidad',
      text:'Las tareas se deslizan a su sitio al reordenarse, las secciones se abren y se pliegan, la semana del calendario y las categorías de Ajustes entran deslizándose.' },
  ] },
  '2.9.5': { title: 'Novedades de Cronota 2.9.5', steps: [
    { icon:'folder', title:'La copia de seguridad lo lleva todo',
      text:'Ajustes → Exportar copia guarda ahora tus tareas con todo su historial y también todos tus ajustes. Al restaurarla puedes elegir si recuperar los ajustes; si dices que sí, Cronota se reinicia con ellos.' },
  ] },
  '2.9.1': { title: 'imputa.me ahora se llama Cronota', steps: [
    { icon:'spark', title:'Nuevo nombre, la misma app',
      text:'imputa.me pasa a llamarse Cronota: cronómetro y nota, que es lo que hace. Tus tareas, tus horas y tus ajustes siguen exactamente igual.' },
  ] },
  '2.9.0': NOVEDADES_2_9,
  '2.8.4': { ...NOVEDADES_2_8_3, title: 'Novedades de Cronota 2.8.4' },
  '2.8.3': NOVEDADES_2_8_3,
  '2.8.0': NOVEDADES_2_8,
  '2.8.1': NOVEDADES_2_8,
  '2.8.2': NOVEDADES_2_8,
  '2.2.0': NOVEDADES_2_2,
  '2.2.1': NOVEDADES_2_2,
  '2.3.0': NOVEDADES_2_3,
  '2.4.0': NOVEDADES_2_4,
  '2.4.1': NOVEDADES_2_4_1,
  '2.5.0': NOVEDADES_2_5,
  // Mismas novedades para toda la serie 2.5: sin esto, quien viniera de la 2.4 y cayera
  // directamente en una 2.5.x posterior no veía nada. El guardarraíl de repetición vive
  // en otro sitio (lastSeenWhatsNew compara de qué hablaba lo último que se enseñó).
  '2.5.1': NOVEDADES_2_5,
  '2.5.2': NOVEDADES_2_5,
  '2.5.3': NOVEDADES_2_5,
  '2.5.4': NOVEDADES_2_5,
  '2.5.5': NOVEDADES_2_5,
  '2.5.6': NOVEDADES_2_5,
};
// 2.12.1 es un arreglo pequeño: mismas novedades (el mismo objeto), así quien ya vio las de la
// 2.12 no las vuelve a ver y quien venga de la 2.11 sí.
WHATS_NEW['2.12.1'] = WHATS_NEW['2.12.0'];

const TRASH_RETENTION_DAYS = 30;   // cuánto tiempo se puede restaurar una tarea desde la papelera
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

// ¿Está esta tarea ahora mismo en la papelera? (borrada, no eliminada del todo y aún
// dentro del plazo de restauración).
function isInTrash(t) {
  return t.deleted && !t.purged && t.deletedAt && (Date.now() - t.deletedAt < TRASH_RETENTION_MS);
}

// ── Archivador ────────────────────────────────────────────────────────────────
// Última vez que se usó la tarea: la entrada más reciente (start o end), o si nunca
// se ha usado, el momento en que se creó (el id ES esa marca de tiempo: Date.now()
// al crearla, igual que en el resto de la app).
function lastUsedMs(t) {
  let max = Number(t.id) || 0;
  (t.entries || []).forEach(e => {
    if (e.start > max) max = e.start;
    if (e.end && e.end > max) max = e.end;
  });
  return max;
}

// ¿Lleva esta tarea sin tocarse más de lo que marcan los ajustes? La que está en
// marcha ahora mismo nunca cuenta, y con archiveDays a 0 el archivador queda apagado.
function isInactiveTask(t) {
  if (t.deleted) return false;
  if (state.activeTaskId === t.id) return false;
  const days = Number(settings.archiveDays) || 0;
  if (days <= 0) return false;
  return (Date.now() - lastUsedMs(t)) > days * 24 * 60 * 60 * 1000;
}

let DATA_FILE;
let SETTINGS_FILE;

let tray = null;
let widgetWin = null;
let calendarWin = null;
let mainWin = null;
let settingsWin = null;
let groupsWin = null;
let notasWin = null;   // 2.16: Notas en ventana suelta (sin la barra flotante)
let splashWin = null;
let reminderTimer = null;
let leaveTimer = null;
let eyeCareWin = null;
let eyeCareTimer = null;
let eyeCareNextAt = 0;       // momento del próximo aviso de la regla 20-20-20
let eyeCareHideTimer = null;
let leaveNotifiedOn = null;   // 'YYYY-MM-DD' del último aviso, para no repetirlo
let tickTimer = null;
let whatsNewWin = null;
let dockWin = null;              // ventana transparente de la BARRITA (click-through)
let dockPanelWin = null;         // ventana del PANEL: sin transparencia y con acrílico
let dockExpanded = false;
// Recorrido guiado en marcha: encadena Panel → Calendario → Guardadas → Ajustes.
let tourActive = false;
const TOUR_ORDER = ['main', 'calendar', 'groups', 'settings'];
let dockHitRects = [];           // zonas "clicables" del dock, en coords de su ventana
let dockOutsideSince = 0;        // desde cuándo el cursor está fuera del panel desplegado
let lastBarRaiseAt = 0;          // para no reordenar ventanas en cada evento (ver 'set-dock-config')
let dockBarRect = null;          // rectángulo de la barrita, para saber si el ratón se acerca
let dockBarNear = null;
let dockHitTimer = null;
let dockIgnoring = null;
let saliendo = false;            // la app se está cerrando (salir, o instalar una actualización)

// ── Estado ──────────────────────────────────────────────────────────────────
let state = {
  tasks: [],           // { id, name, color, subtasks: [{id,name}], entries: [{start, end, subId, note}], archived, groupId, taskType, memo }
  groups: [],          // { id, name }
  activeTaskId: null,
  activeSubId: null,   // subtarea en marcha dentro de la tarea activa (null = la tarea a secas)
};

let settings = {
  reminderMinutes: 10,
  // Enlace a donde imputas de verdad las horas (el portal de tu empresa, una hoja...).
  // Si está puesto, aparece un botón "Imputar" en el Panel y en el Calendario.
  imputeUrl: '',      // se conserva por compatibilidad; al arrancar se vuelca a imputeUrls
  imputeUrls: [],     // quien imputa en varios sitios puede tener todos los que quiera
  // ── Hora de salida ──────────────────────────────────────────────────────────
  // Aviso al terminar la jornada para que no se quede una tarea corriendo toda la
  // noche. Viene apagado: la hora de salida es cosa de cada uno, no hay defecto que
  // valga para todos. Los días van por getDay(): 0 = domingo ... 6 = sábado, y null
  // significa "ese día no me avises".
  leaveEnabled: false,
  leaveSameEveryDay: true,      // una sola hora para toda la semana
  leaveTime: '18:00',
  leaveDays: { 1:'18:00', 2:'18:00', 3:'18:00', 4:'18:00', 5:'18:00', 6:null, 0:null },
  leaveAutoStop: false,   // además de avisar, parar sola la tarea que siga en marcha
  // ── Regla 20-20-20 ──────────────────────────────────────────────────────────
  // Cada 20 minutos, mirar 20 segundos a algo que esté a unos 6 metros. Apagada por
  // defecto: es un aviso que interrumpe, y eso se pide, no se impone.
  eyeCareEnabled: false,
  eyeCareEvery: 20,      // minutos entre avisos
  eyeCareRest: 20,       // segundos que dura la cuenta atrás
  eyeCarePos: 'top',     // topLeft | top | topRight | bottomLeft | bottom | bottomRight
  eyeCareSize: 150,      // ancho de la burbuja en px (el alto va en proporción)
  widgetAutoHide: true,
  widgetAutoHideSeconds: 10,
  widgetScale: 100,         // 2.8.3: tamaño del recordatorio de la esquina (en %)
  colorMode: 'auto', // 'auto' | 'manual'
  bgOpacity: 85,       // 100 = mate; por debajo, el panel lateral es de cristal (2.8.3: de serie, un toque)
  liquidGlass: true,   // estilo: cristal líquido (true) o plano (false), en Ajustes → Apariencia
  tutorialSeenSteps: [], // ids de pasos del tutorial guiado ya vistos u omitidos (ver TUTORIAL_STEPS en shared.js)
  groupSort: 'created',  // orden de las secciones en Guardadas: 'created' | 'alpha' | 'custom'
  groupSortDir: 'asc',   // y en qué sentido: 'asc' | 'desc'
  // Días que se ven en el calendario, por getDay() (0 = domingo ... 6 = sábado). Por
  // defecto la semana entera; quien no trabaje el fin de semana puede quitarlo y las
  // columnas se reparten el hueco.
  weekDays: [1, 2, 3, 4, 5, 6, 0],
  // Excepciones para UNA semana concreta: { 'AAAA-MM-DD del lunes': [días visibles] }.
  // Sirve para el sábado suelto que sí se trabaja sin cambiar el ajuste general.
  weekOverrides: {},
  dockMode: true,      // modo barra flotante lateral: es el modo por defecto (instalación nueva)
  dockDisplayId: null, // en qué pantalla se ancla el dock (null = la de referencia)
  dockDisplayKey: null, // huella de esa pantalla: al reconectarla Windows puede darle otro id
  dockHiddenUntil: 0,   // 0 = visible; -1 = escondida a mano; si no, marca de tiempo en la que vuelve
  dndUntil: 0,          // No molestar: 0 = apagado; -1 = hasta apagarlo; si no, cuándo se apaga solo
  theme: DEFAULT_THEME, // fondo/paleta base de toda la app (ver THEMES)
  accent: null,         // color de acento; null = el que trae el tema (ver ACCENTS)
  dockAnchor: 'right', // borde al que se pega la barrita: left | right | top | bottom
  dockBarWidth: 7,     // grosor de la barrita (px)
  dockBarLength: 110,  // largo de la barrita (px)
  dockBarPos: 50,      // posición a lo largo del borde, en % (0 = arriba/izq, 100 = abajo/der)
  dockBarOffset: 4,    // cuánto se despega del borde hacia el centro (px)
  dockNearDistance: 45, // a cuántos px del ratón se enciende la barrita (antes 110, fijo)
  dockBarOpacity: 30,  // opacidad de la barrita EN REPOSO (al acercar el ratón va al máximo)
  dockBarColor: '#ffffff',
  dockPanelWidth: 460,  // ancho del panel en las vistas normales (anclajes laterales)
  dockPanelHeight: 620, // alto del panel cuando se ancla arriba/abajo (más generoso: hay ancho de sobra)
  dockCloseMode: 'button',  // 'button' | 'clickOutside' | 'mouseLeave'
  dockCloseSeconds: 3,      // con 'mouseLeave', segundos fuera antes de esconderse (admite decimales y 0)
  blurEnabled: true,        // difuminado del fondo (acrílico de Windows) sí/no
  lastSeenVersion: null,    // última versión cuyas novedades ya se han visto
  lastSeenWhatsNew: null,   // y de qué hablaban, para no repetir el mismo recorrido
  dockCalendarWidth: 1180, // el calendario se abre bastante más ancho (y se puede estirar)
  dockNotasWidth: 1000,    // 2.16: Notas también tiene su propio ancho (una pizarra necesita sitio)
  lastView: 'panel',    // última vista abierta: la app vuelve a abrirse por donde la dejaste
  archiveDays: 30,      // días sin usar una tarea antes de que pase al Archivador (0 = nunca)
  uiVersion: 0,         // versión de la interfaz ya estrenada (ver UI_VERSION)
  outlookIcsUrl: '',   // 2.12: enlace ICS de «Publicar un calendario» de Outlook ('' = sin conectar)
  paletasPropias: {},  // 2.15: paletas hechas por el usuario { id: { name, colors } }
  silenciarEnLlamada: true,   // 2.12: sin avisos mientras alguna app use el micrófono (una llamada)
  nube: '',              // 2.14: 'onedrive' | 'gdrive' | '' (sin sincronizar). Ver nube.js
  nubeVersion: 0,        // marca del último archivo de la nube que este PC conoce
  nubePendiente: false,  // hay cambios de aquí sin subir todavía
  ultimoLatido: 0,       // 2.13: última vez que la app estaba viva (ver repararCierreDeGolpe)
};

function nextAutoColor() {
  return TASK_COLORS[state.tasks.length % TASK_COLORS.length];
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) state = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    // Fichero corrupto (p. ej. un apagado a mitad de escritura con el guardado de antes).
    // Antes se seguía con el estado vacío y el siguiente guardado machacaba TODO el
    // historial. Ahora se aparta una copia intacta y se prueba con el .tmp, que es una
    // escritura completa que no llegó a renombrarse.
    try { fs.copyFileSync(DATA_FILE, `${DATA_FILE}.corrupt-${Date.now()}`); } catch {}
    try { state = JSON.parse(fs.readFileSync(DATA_FILE + '.tmp', 'utf8')); } catch {}
  }
  // 2.13: un fichero que se lee pero no trae tareas (p. ej. «null») tumbaba el arranque. Se
  // aparta igual que uno roto y se prueba con el .tmp.
  if (!state || !Array.isArray(state.tasks)) {
    try { fs.copyFileSync(DATA_FILE, `${DATA_FILE}.corrupt-${Date.now()}`); } catch {}
    try { const t = JSON.parse(fs.readFileSync(DATA_FILE + '.tmp', 'utf8')); if (t && Array.isArray(t.tasks)) state = t; } catch {}
    if (!state || !Array.isArray(state.tasks)) state = { tasks: [], groups: [], activeTaskId: null, activeSubId: null };
  }
  if (!Array.isArray(state.groups)) state.groups = [];
  state.tasks.forEach(t => {
    if (t.archived === undefined) t.archived = false;
    if (t.groupId === undefined) t.groupId = null;
    if (t.deleted === undefined) t.deleted = false;
    // Migración: las entradas de antes de esto no tenían "foto" del nombre de la
    // tarea en ese momento (el calendario leía el nombre actual, en vivo). Se les
    // pone el nombre que tiene ahora mismo como punto de partida; a partir de aquí
    // cada entrada nueva guarda el suyo propio y ya no cambia si renombras la tarea.
    t.entries.forEach(e => { if (e.nameAtTime === undefined) e.nameAtTime = t.name; });
    if (!Array.isArray(t.subtasks)) t.subtasks = [];
    // v2.7.1: tipo (en curso vs puntual) y memo persistente (p. ej. id ERP). Aditivo; Dynamics365 puede enriquecer memo/erpId.
    if (t.taskType !== 'ongoing' && t.taskType !== 'oneShot') t.taskType = 'ongoing';
    if (typeof t.memo !== 'string') t.memo = (t.memo == null ? '' : String(t.memo));
    t.memo = String(t.memo).trim().slice(0, 200);
  });
  try {
    if (fs.existsSync(SETTINGS_FILE)) settings = { ...settings, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) };
  } catch {
    // 2.13: roto (un apagado a mitad de guardar): se aparta y se prueba con el .tmp, como las tareas.
    try { fs.copyFileSync(SETTINGS_FILE, `${SETTINGS_FILE}.corrupt-${Date.now()}`); } catch {}
    try { settings = { ...settings, ...JSON.parse(fs.readFileSync(SETTINGS_FILE + '.tmp', 'utf8')) }; } catch {}
  }
  // 2.8: estreno del rediseño. Una sola vez, el tema pasa a Noche cálida con su acento; a
  // partir de ahí cada cual elige el que quiera en Ajustes y no se vuelve a tocar.
  const uiVista = Number(settings.uiVersion) || 0;
  if (uiVista < 3) { settings.theme = DEFAULT_THEME; settings.accent = null; }
  // 4 (2.8.3): el deslizador de translucidez ya mueve el panel lateral (y por encima de
  // mate es de cristal). Todos empiezan en mate, como lo venían viendo; el valor viejo
  // venía de cuando el deslizador apenas hacía nada.
  if (uiVista < 4) settings.bgOpacity = 100;
  // 2.8.3: de serie, el panel con un poco de cristal, esmerilado, y cristal líquido en los bocadillos.
  if (uiVista < 5) { settings.bgOpacity = 85; settings.blurEnabled = true; settings.liquidGlass = true; settings.colorMode = 'auto'; }
  if (uiVista < UI_VERSION) { settings.uiVersion = UI_VERSION; saveSettings(); }
  if (!THEMES[settings.theme]) settings.theme = DEFAULT_THEME;
}

// Escritura atómica: primero a un .tmp y luego se renombra encima. Si el PC se apaga a
// mitad, el fichero bueno sigue entero. Sin sangría: es un 30-40 % más pequeño y se
// escribe en cada acción.
function saveDataRaw() {
  const json = JSON.stringify(state);
  const tmp = DATA_FILE + '.tmp';
  try {
    fs.writeFileSync(tmp, json);
    fs.renameSync(tmp, DATA_FILE);
  } catch {
    // El antivirus o el indexador a veces bloquean el renombrado (EPERM/EBUSY): mejor
    // guardar directamente que no guardar.
    try { fs.writeFileSync(DATA_FILE, json); } catch {}
  }
}
function saveData() {
  if (usandoCaja && cajaClave && Array.isArray(cajaNotasMem) && state.cajaFuerte) state.cajaFuerte = { ...state.cajaFuerte, ...cajaCifrar(cajaClave, cajaNotasMem) };
  saveDataRaw();
  if (nubeSync) nubeSync.cambioLocal();   // 2.14: a la carpeta de OneDrive / Google Drive
}

// 2.14.1: ajustes que viajan con la sincronización. Los de cada pantalla o PC (barra, tamaños,
// monitor, modo dock, versión vista, tutorial, la propia nube) se quedan en cada equipo.
const AJUSTES_QUE_SE_SINCRONIZAN = ['reminderMinutes', 'imputeUrl', 'imputeUrls', 'leaveEnabled', 'leaveSameEveryDay', 'leaveTime', 'leaveDays', 'leaveAutoStop',
  'eyeCareEnabled', 'eyeCareEvery', 'eyeCareRest', 'eyeCarePos', 'eyeCareSize', 'eyeCareSoloOjos', 'widgetAutoHide', 'widgetAutoHideSeconds',
  'colorMode', 'bgOpacity', 'liquidGlass', 'blurEnabled', 'theme', 'accent', 'groupSort', 'groupSortDir', 'weekDays', 'weekOverrides',
  'dockBarColor', 'dockBarGlass', 'dockBarOpacity', 'dockBarWidth', 'dockBarLength', 'dockNearDistance', 'dockCloseMode', 'dockCloseSeconds',
  'archiveDays', 'outlookIcsUrl', 'silenciarEnLlamada', 'paletasPropias'];
function ajustesQueViajan() {
  const r = {};
  AJUSTES_QUE_SE_SINCRONIZAN.forEach(k => { if (settings[k] !== undefined) r[k] = settings[k]; });
  return r;
}
let firmaAjustesNube = null;   // lo último que se subió o se trajo; si cambia, hay que subir
function vigilarAjustesNube() {
  const firma = JSON.stringify(ajustesQueViajan());
  if (firmaAjustesNube === null) { firmaAjustesNube = firma; return; }
  if (firma !== firmaAjustesNube) { firmaAjustesNube = firma; if (nubeSync) nubeSync.cambioLocal(); }
}

function saveSettings() {
  vigilarAjustesNube();
  // 2.13: escritura atómica, como las tareas: si se va la luz a mitad, el bueno sigue entero.
  const json = JSON.stringify(settings, null, 2);
  const tmp = SETTINGS_FILE + '.tmp';
  try { fs.writeFileSync(tmp, json); fs.renameSync(tmp, SETTINGS_FILE); }
  catch { try { fs.writeFileSync(SETTINGS_FILE, json); } catch {} }
}

// 2.13: el arranque con Windows lo pone la Store (tarea de inicio del paquete) y se cambia en
// Configuración de Windows → Aplicaciones → Inicio. Lo del registro era de la versión del instalador.

// ── Utilidades de tiempo ─────────────────────────────────────────────────────
function totalSecondsForTask(task) {
  let total = 0;
  for (const entry of task.entries) {
    total += ((entry.end || Date.now()) - entry.start);
  }
  return Math.floor(total / 1000);
}

function todaySecondsForTask(task) {
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  let total = 0;
  for (const entry of task.entries) {
    const entryEnd = entry.end || Date.now();
    if (entryEnd < startOfDay.getTime()) continue;
    const from = Math.max(entry.start, startOfDay.getTime());
    total += Math.max(0, entryEnd - from);
  }
  return Math.floor(total / 1000);
}

// Segundos de UNA subtarea (o de la tarea "a secas", con subId null): mismo cálculo
// que el de la tarea, filtrando por la subtarea a la que se apuntó cada entrada.
function secondsForSub(task, subId, desde) {
  let total = 0;
  for (const entry of task.entries) {
    if ((entry.subId || null) !== (subId || null)) continue;
    const fin = entry.end || Date.now();
    if (desde != null && fin < desde) continue;
    total += Math.max(0, fin - (desde != null ? Math.max(entry.start, desde) : entry.start));
  }
  return Math.floor(total / 1000);
}

function totalTodaySeconds() {
  return state.tasks.reduce((sum, t) => sum + todaySecondsForTask(t), 0);
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m`;
  return `${m}m ${String(s).padStart(2,'0')}s`;
}

function getActiveTask() {
  return state.tasks.find(t => t.id === state.activeTaskId) || null;
}
// 2.14.6: la entrada que está corriendo es la que no tiene fin, que NO tiene por qué ser la última:
// si detrás se añade otra (una reunión de Outlook para más tarde, una pegada o duplicada), la que
// corre queda en medio. Antes se miraba solo la última y la tarea no se podía parar.
function entradaEnCurso(task) {
  if (!task || !Array.isArray(task.entries)) return null;
  for (let i = task.entries.length - 1; i >= 0; i--) if (task.entries[i] && task.entries[i].end == null) return task.entries[i];
  return null;
}

// ── Tray ─────────────────────────────────────────────────────────────────────
// Solo el tooltip, y solo si cambia. El menú ya no se reconstruye aquí: con una tarea
// en marcha esto se llamaba dos veces por segundo y cada vez se creaba y tiraba un
// menú nativo entero. Ahora se monta al hacer clic derecho (ver whenReady), con los
// tiempos al día.
// Una vez por minuto se reescribe aunque no cambie: si el Explorador se reinicia, Windows
// recrea el icono sin tooltip.
let lastTrayTip = null, lastTrayTipAt = 0;
function updateTrayTitle() {
  if (!tray) return;
  const active = getActiveTask();
  const tip = `${MODO_PRUEBAS ? 'PRUEBAS · ' : ''}Cronota · ${formatDuration(totalTodaySeconds())}${active ? ' · ' + active.name : ''}`;
  const now = Date.now();
  if (tip !== lastTrayTip || now - lastTrayTipAt > 60000) {
    lastTrayTip = tip; lastTrayTipAt = now; tray.setToolTip(tip);
  }
}

function buildTrayMenu() {
  const active = getActiveTask();
  const taskItems = state.tasks.filter(t => !t.archived && !t.deleted && !isInactiveTask(t)).map(t => ({
    label: `${t.id === state.activeTaskId ? '▶ ' : '    '}${t.name}  (${formatDuration(todaySecondsForTask(t))})`,
    click: () => switchTask(t.id),
  }));
  return Menu.buildFromTemplate([
    { label: 'Cronota', enabled: false },
    { label: `Hoy: ${formatDuration(totalTodaySeconds())}`, enabled: false },
    { type: 'separator' },
    ...taskItems,
    { type: 'separator' },
    { label: 'Panel', click: () => openMain() },
    { label: 'Calendario', click: () => openCalendar() },
    { label: 'Tareas', click: () => openGroups() },
    { label: 'Notas', click: () => openNotas() },
    { label: 'Ajustes', click: () => openSettings() },
    { label: 'Pausar', click: () => pauseActive(), enabled: !!active },
    { label: 'No molestar', type: 'checkbox', checked: dndActive(), click: () => setDnd(dndActive() ? null : 0) },
    { type: 'separator' },
    // Interruptor de escape: permite salir del modo dock desde la bandeja aunque su
    // interfaz no se viera bien, sin depender de abrir Ajustes dentro del propio dock.
    { label: 'Modo barra flotante (dock)', type: 'checkbox', checked: !!settings.dockMode, click: () => toggleDockMode() },
    // Si la barra se escondió desde su menú, esta es la forma de recuperarla.
    { label: 'Mostrar la barra ahora', click: () => hideDockFor(null), visible: !!settings.dockMode && dockIsHidden() },
    { label: `Cerrar y actualizar a la ${versionNueva}`, click: () => cerrarYActualizar(), visible: !!versionNueva },
    { label: 'Buscar actualizaciones…', click: () => checkForUpdates(true) },
    { label: 'Salir', click: () => { saveData(); app.quit(); } },
  ]);
}

function toggleDockMode() {
  const wasDock = !!settings.dockMode;
  settings.dockMode = !wasDock;
  saveSettings();
  applyDockMode(wasDock);
  updateTrayTitle();
}

// ── Acciones ─────────────────────────────────────────────────────────────────
function startTask(taskId, backMinutes, subId, note) {
  pauseActive();
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  const sub = subId ? (task.subtasks || []).find(x => x.id === subId) : null;
  state.activeTaskId = taskId;
  state.activeSubId = sub ? sub.id : null;
  const start = backMinutes ? Date.now() - backMinutes * 60000 : Date.now();
  // nameAtTime: "foto" del nombre de la tarea al crear la entrada. El calendario es
  // un registro de lo que pasó, así que si luego renombras la tarea esta entrada no
  // cambia con ella (solo las que se creen después, con el nombre nuevo). La subtarea
  // guarda el suyo por lo mismo: borrarla no debe reescribir el historial.
  const entry = { start, end: null, nameAtTime: task.name };
  if (sub) { entry.subId = sub.id; entry.subNameAtTime = sub.name; }
  // Al continuar desde una entrada anterior se hereda su nota: sigues en lo mismo.
  const n = (note || '').trim().slice(0, 500);
  if (n) entry.note = n;
  task.entries.push(entry);
  saveData(); broadcastState(); resetReminderTimer();
}

function pauseActive() {
  const task = getActiveTask();
  const ahora = Date.now();
  // 2.14.6: ninguna entrada se queda abierta al pausar, sea la última o no, y aunque se hubiera
  // quedado colgada en otra tarea (se veía «en curso» en el calendario y no había forma de pararla).
  state.tasks.forEach(t => (t.entries || []).forEach(e => { if (e && e.end == null && t !== task) e.end = Math.max(e.start, ahora); }));
  if (task) {
    const last = entradaEnCurso(task);
    if (last && !last.end) {
      last.end = Math.max(last.start, ahora);
      // La nota se QUEDA con la entrada: es parte del registro de lo que hiciste en esa
      // sesión (se ve en el calendario). Al retomar la tarea se crea una entrada nueva
      // sin nota, así que el campo del panel vuelve a estar en blanco solo, sin tener
      // que borrar la de antes (que antes se perdía al pausar).
    }
  }
  state.activeTaskId = null;
  state.activeSubId = null;
  saveData(); broadcastState();
}

// Nota rápida sobre la tarea que está corriendo AHORA MISMO (desde el panel principal),
// para poder anotar sin querer que "formación" de hoy es en concreto un vídeo de sales.
// Se guarda en la propia entrada en curso, así que ya se ve reflejada en el calendario.
function setActiveEntryNote(note) {
  const task = getActiveTask();
  if (!task) return;
  const last = entradaEnCurso(task);
  if (!last || last.end) return;
  const n = (note || '').trim().slice(0, 500);
  if (n) last.note = n; else delete last.note;
  saveData(); broadcastState();
}

function switchTask(taskId, backMinutes, subId, note) {
  // Pulsar el play de lo que ya está corriendo lo pausa; si es otra tarea u otra
  // subtarea de la misma tarea, se cambia a ella.
  const mismaSub = (state.activeSubId || null) === (subId || null);
  if (state.activeTaskId === taskId && mismaSub) pauseActive();
  else startTask(taskId, backMinutes, subId, note);
}

// ── Subtareas ────────────────────────────────────────────────────────────────
// Viven dentro de la tarea ("Cocina" → horno, frigorífico...) y no son tareas aparte:
// cada entrada del calendario apunta a la suya, así que el tiempo de la tarea sigue
// siendo la suma de todo lo que se ha hecho dentro, sin cambiar nada de lo de antes.
function addSubtask(taskId, name) {
  const task = state.tasks.find(t => t.id === taskId);
  const n = (name || '').trim();
  if (!task || !n) return;
  if (!Array.isArray(task.subtasks)) task.subtasks = [];
  task.subtasks.push({ id: `${Date.now()}-${task.subtasks.length}`, name: n.slice(0, 120) });
  saveData(); broadcastState();
}

function renameSubtask(taskId, subId, name) {
  const task = state.tasks.find(t => t.id === taskId);
  const sub = task && (task.subtasks || []).find(x => x.id === subId);
  const n = (name || '').trim();
  if (!sub || !n) return;
  sub.name = n.slice(0, 120);   // las entradas ya hechas conservan su subNameAtTime
  saveData(); broadcastState();
}

// Quitarla de la lista NO borra su historial: las entradas guardan el nombre que tenía
// y se siguen viendo en el calendario, igual que al eliminar una tarea.
function deleteSubtask(taskId, subId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.subtasks = (task.subtasks || []).filter(x => x.id !== subId);
  if (state.activeTaskId === taskId && state.activeSubId === subId) pauseActive();
  saveData(); broadcastState();
}

// Cierra la sesión en curso de la tarea activa (como al pausar) y arranca ENSEGUIDA
// una nueva entrada para esa misma tarea, con una nota distinta. Sirve para partir
// el tiempo en dos cuando cambias de lo que estás haciendo dentro de la misma tarea,
// sin tener que pausar y volver a darle a play a mano.
function restartActiveTaskWithNote(note) {
  const task = getActiveTask();
  if (!task) return;
  const last = entradaEnCurso(task);
  if (last && !last.end) { last.end = Date.now(); }   // la nota de esa sesión se conserva en su entrada
  // Reiniciar con otra nota se queda en la misma subtarea: sigues en lo mismo.
  const entry = { start: Date.now(), end: null, nameAtTime: task.name };
  const sub = state.activeSubId ? (task.subtasks || []).find(x => x.id === state.activeSubId) : null;
  if (sub) { entry.subId = sub.id; entry.subNameAtTime = sub.name; }
  const n = (note || '').trim().slice(0, 500);
  if (n) entry.note = n;
  task.entries.push(entry);
  saveData(); broadcastState(); resetReminderTimer();
}

// Reabre una entrada ya cerrada (le quita la hora de fin) para que siga sumando hasta
// ahora, como si nunca se hubiera parado. Antes cierra lo que estuviera activo (si era
// otra tarea), para que solo haya una entrada "en curso" a la vez.
function resumeEntry(taskId, entryIndex) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !task.entries[entryIndex]) return;
  const entry = task.entries[entryIndex];
  if (entry.end == null) return;   // ya está en curso
  pauseActive();
  entry.end = null;
  // El resto de la app (el propio pauseActive, la nota rápida del panel principal...)
  // da por hecho que la entrada "en curso" es SIEMPRE la última del array. Si se
  // reanuda una que no lo era, hay que moverla al final para no romper eso: si no,
  // el panel mostraba/editaba la nota de otra entrada distinta (parecía que se borraba).
  task.entries.splice(entryIndex, 1);
  task.entries.push(entry);
  state.activeTaskId = taskId;
  // La entrada se reanuda entera: vuelve con su subtarea y con su nota. Sin esta línea
  // el panel se quedaba creyendo que no había subtarea en marcha.
  state.activeSubId = entry.subId || null;
  saveData(); broadcastState(); resetReminderTimer();
}

// Color de una tarea nueva: el elegido a mano si el modo es manual; si no, uno al azar de la
// paleta de su sección (si la tiene) o el siguiente de la rueda de siempre.
function colorForNewTask(groupId, manualColor) {
  if (settings.colorMode === 'manual' && manualColor) return manualColor;
  const g = groupId && state.groups.find(x => x.id === groupId);
  if (g && g.palette) {
    const enUso = state.tasks.filter(t => t.groupId === g.id && !t.deleted).map(t => t.color);
    const c = colorFromGroupPalette(g.palette, enUso, Math.random, todasLasPaletas());
    if (c) return c;
  }
  return nextAutoColor();
}

function createTask(name, color, opts) {
  const id = Date.now().toString();
  const o = opts || {};
  const finalColor = colorForNewTask(o.groupId, color);
  const taskType = o.taskType === 'oneShot' ? 'oneShot' : 'ongoing';
  const memo = (o.memo || '').trim().slice(0, 200);
  const task = { id, name, color: finalColor, entries: [], archived: false, groupId: null, taskType, memo };
  if (o.erpId) task.erpId = String(o.erpId).trim().slice(0, 120);
  state.tasks.push(task);
  saveData(); broadcastState();
  return id;
}

// Memo persistente + tipo: no tocan las entradas. El memo se muestra cada vez que
// usas la tarea (id Dynamics, recordatorio fijo...); la nota de sesión sigue en entry.note.
function updateTaskMeta(taskId, patch) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !patch) return;
  if (patch.taskType === 'ongoing' || patch.taskType === 'oneShot') task.taskType = patch.taskType;
  if (patch.memo !== undefined) {
    task.memo = (patch.memo || '').trim().slice(0, 200);
  }
  if (patch.erpId !== undefined) {
    const e = (patch.erpId || '').trim().slice(0, 120);
    if (e) task.erpId = e; else delete task.erpId;
  }
  if (patch.name !== undefined) {
    const n = (patch.name || '').trim();
    if (n) task.name = n.slice(0, 120);
  }
  saveData(); broadcastState();
}
// Nota fija (memo) de la tarea: sobrevive entre sesiones. Local-only — sync.js no
// la sube ni la baja; sirve p. ej. para el id de Dynamics/ERP. Max 200 chars.
function setTaskMemo(taskId, memo) {
  updateTaskMeta(taskId, { memo: memo == null ? '' : memo });
}

// Borrado "suave": la tarea desaparece del panel, de Guardadas y de los selectores,
// pero sus entradas SIGUEN en el calendario (con su nombre, nota y horas de siempre),
// porque el calendario es un registro de lo que de verdad ha pasado, no una vista en
// vivo de las tareas actuales.
function deleteTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (state.activeTaskId === taskId) pauseActive();
  task.deleted = true;
  task.deletedAt = Date.now();   // para la papelera (se puede restaurar durante TRASH_RETENTION_DAYS)
  task.purged = false;
  saveData(); broadcastState();
}

// Devuelve la tarea a la vida: reaparece en el panel principal (sin sección). Vale
// tanto desde la papelera como desde el calendario (aunque ya haya caducado en la
// papelera), porque sus entradas nunca se han ido.
// Saca una tarea de Guardadas y la devuelve al panel principal. No toca su historial:
// las entradas del calendario se quedan exactamente como estaban.
function unarchiveTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !task.archived) return;
  task.archived = false;
  task.groupId = null;
  saveData(); broadcastState();
}

function restoreTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.deleted = false;
  task.archived = false;
  task.groupId = null;
  delete task.deletedAt;
  delete task.purged;
  saveData(); broadcastState();
}

// "Eliminar definitivamente" desde la papelera: la saca de la lista de la papelera,
// pero sus entradas SIGUEN en el calendario (el calendario es un registro permanente),
// así que todavía se puede restaurar desde allí si hiciera falta.
function purgeTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.purged = true;
  saveData(); broadcastState();
}

// Borrar desde el Archivador: mismo camino que "Eliminar tarea" (papelera, 30 días
// para arrepentirse, el calendario no se toca), pero de una tirada para "Vaciar todo"
// o para una selección concreta. Sin ids, se vacían TODAS las que sigan inactivas en
// este momento (por si algo cambió entre que se abrió el archivador y se pulsó vaciar).
function archivePurge(ids) {
  const objetivo = Array.isArray(ids) && ids.length
    ? state.tasks.filter(t => ids.includes(t.id) && isInactiveTask(t))
    : state.tasks.filter(t => isInactiveTask(t));
  if (!objetivo.length) return;
  objetivo.forEach(t => {
    if (state.activeTaskId === t.id) pauseActive();
    t.deleted = true;
    t.deletedAt = Date.now();
    t.purged = false;
  });
  saveData(); broadcastState();
}

function editTaskColor(taskId, color) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !color) return;
  task.color = color;
  saveData(); broadcastState();
}

// Solo cambia el nombre "en vivo" de la tarea: las entradas ya creadas guardan su
// propio nameAtTime y no se tocan (el calendario es un registro fijo). Afecta a las
// entradas que se creen A PARTIR DE AHORA. Para corregir una entrada ya existente,
// se edita su nombre desde el propio popup del calendario (solo cambia esa).
function renameTask(taskId, name) {
  const task = state.tasks.find(t => t.id === taskId);
  const n = (name || '').trim();
  if (!task || !n) return;
  task.name = n.slice(0, 120);
  saveData(); broadcastState();
}

// ── Grupos guardados ─────────────────────────────────────────────────────────
function archiveTask(taskId, groupId, groupName) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  let gid = groupId;
  if (!gid && groupName) {
    const name = groupName.trim();
    if (!name) return;
    let group = state.groups.find(g => g.name.toLowerCase() === name.toLowerCase());
    if (!group) { group = { id: Date.now().toString(), name, order: nextGroupOrder() }; state.groups.push(group); }
    gid = group.id;
  }
  if (!gid || !state.groups.some(g => g.id === gid)) return;
  if (state.activeTaskId === taskId) pauseActive();
  task.archived = true;
  task.groupId = gid;
  saveData(); broadcastState();
}

function nextGroupOrder() {
  return state.groups.reduce((max, g) => Math.max(max, Number(g.order) || 0), 0) + 1;
}

// Las secciones se sirven ya ordenadas para que Guardadas solo tenga que pintarlas.
// 'created' usa el id, que es la marca de tiempo de cuando se creó.
function sortedGroups() {
  const gs = [...state.groups];
  const byCreation = (a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  if (settings.groupSort === 'alpha') {
    gs.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }));
  } else if (settings.groupSort === 'custom') {
    gs.sort((a, b) => {
      const ao = Number(a.order), bo = Number(b.order);
      if (Number.isFinite(ao) && Number.isFinite(bo) && ao !== bo) return ao - bo;
      return byCreation(a, b);   // las que nunca se han arrastrado, por antigüedad
    });
  } else {
    gs.sort(byCreation);
  }
  // El sentido se aplica al final, así vale para los tres criterios por igual.
  return settings.groupSortDir === 'desc' ? gs.reverse() : gs;
}

// Guarda el orden manual que deja el usuario al arrastrar secciones.
function reorderGroups(ids) {
  if (!Array.isArray(ids)) return;
  if (settings.groupSortDir === 'desc') ids = [...ids].reverse();
  ids.forEach((id, i) => {
    const g = state.groups.find(x => x.id === id);
    if (g) g.order = i + 1;
  });
  settings.groupSort = 'custom';   // arrastrar implica que manda el orden manual
  saveSettings(); saveData(); broadcastState();
}

function createGroup(name) {
  const n = (name || '').trim();
  if (!n) return null;
  let group = state.groups.find(g => g.name.toLowerCase() === n.toLowerCase());
  if (!group) { group = { id: Date.now().toString(), name: n.slice(0, 60), order: nextGroupOrder() }; state.groups.push(group); }
  saveData(); broadcastState();
  return group.id;
}

// Paleta de la sección (ver palettes.js). Sin paleta, sus tareas nuevas siguen la rueda de
// colores de siempre.
// 2.15: las de serie más las personalizadas (settings.paletasPropias), marcadas con propia.
function todasLasPaletas() {
  const r = { ...GROUP_PALETTES };
  const p = settings.paletasPropias && typeof settings.paletasPropias === 'object' ? settings.paletasPropias : {};
  Object.entries(p).forEach(([k, v]) => {
    if (v && typeof v.name === 'string' && Array.isArray(v.colors) && v.colors.length) r[k] = { name: v.name, colors: v.colors.slice(0, 12), propia: true };
  });
  return r;
}
const esColorHex = (c) => /^#[0-9a-fA-F]{6}$/.test(String(c || ''));
function guardarPaletaPropia(p) {
  if (!p) return;
  const nombre = String(p.name || '').trim().slice(0, 30);
  const colores = [...new Set((Array.isArray(p.colors) ? p.colors : []).filter(esColorHex).map(c => c.toLowerCase()))].slice(0, 12);
  if (!nombre || !colores.length) return;
  const propias = { ...(settings.paletasPropias || {}) };
  const id = p.id && propias[p.id] ? p.id : 'p' + Date.now().toString(36);
  propias[id] = { name: nombre, colors: colores };
  settings.paletasPropias = propias;
  saveSettings();
  // Recién hecha para una sección: se le pone ya.
  const g = p.groupId && state.groups.find(x => x.id === p.groupId);
  if (g) { g.palette = id; saveData(); }
  broadcastState();
}
function borrarPaletaPropia(id) {
  const propias = { ...(settings.paletasPropias || {}) };
  if (!id || !propias[id]) return;
  delete propias[id];
  settings.paletasPropias = propias;
  saveSettings();
  // Las secciones que la usaban se quedan sin paleta (sus tareas conservan sus colores).
  let cambia = false;
  state.groups.forEach(g => { if (g.palette === id) { delete g.palette; cambia = true; } });
  if (cambia) saveData();
  broadcastState();
}

function setGroupPalette(groupId, palette) {
  const g = state.groups.find(x => x.id === groupId);
  if (!g) return;
  if (palette && todasLasPaletas()[palette]) g.palette = palette;
  else delete g.palette;
  saveData(); broadcastState();
}

// Repinta las tareas que ya tiene la sección con tonos de su paleta, todos distintos
// mientras alcancen.
function recolorGroupTasks(groupId) {
  const g = state.groups.find(x => x.id === groupId);
  if (!g || !g.palette) return;
  const usados = [];
  state.tasks.filter(t => t.groupId === g.id && !t.deleted).forEach(t => {
    t.color = colorFromGroupPalette(g.palette, usados, Math.random, todasLasPaletas()) || t.color;
    usados.push(t.color);
  });
  saveData(); broadcastState();
}

function renameGroup(groupId, name) {
  const g = state.groups.find(x => x.id === groupId);
  const n = (name || '').trim();
  if (!g || !n) return;
  g.name = n.slice(0, 60);
  saveData(); broadcastState();
}

function deleteGroup(groupId) {
  if (!state.groups.some(g => g.id === groupId)) return;
  // Las tareas de la sección vuelven al panel principal (no se pierden).
  state.tasks.forEach(t => { if (t.groupId === groupId) { t.archived = false; t.groupId = null; } });
  state.groups = state.groups.filter(g => g.id !== groupId);
  saveData(); broadcastState();
}

// Mueve una tarea (ya guardada) de una sección a otra sin sacarla de "Guardadas".
// Cambia la sección de una tarea. Ya no la archiva: en la pestaña Tareas la sección es
// una etiqueta, y "archivada" solo decide si sigue apareciendo en el Panel.
function moveTaskToGroup(taskId, groupId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !state.groups.some(g => g.id === groupId)) return;
  if (state.activeTaskId === taskId) pauseActive();
  task.groupId = groupId;
  task.archived = true;
  saveData(); broadcastState();
}

function restoreAndStartTask(taskId, backMinutes, subId, note) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.archived = false;
  startTask(taskId, backMinutes, subId, note);   // se puede retomar directamente en una subtarea
  openMain();
}

function editEntry(taskId, entryIndex, startMs, endMs, note, name, subId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !task.entries[entryIndex]) return;
  const e = task.entries[entryIndex];
  // Solo se aplica lo que llega. Al redimensionar se envía ÚNICAMENTE el borde que se
  // arrastra: si se mandaban los dos, el borde no tocado se pisaba con un valor viejo
  // (el calendario no se reconstruye con el ratón encima) y "se movía solo". Igual con
  // la nota: es propia de ESTA entrada, así que no toca el resto de veces que se ha
  // hecho la misma tarea. El nombre (nameAtTime) también es solo de esta entrada: no
  // renombra la tarea ni cambia otras entradas (para eso, doble clic en el panel).
  if (startMs !== undefined && startMs !== null) e.start = startMs;
  if (endMs !== undefined) e.end = endMs;
  if (note !== undefined) {
    const n = (note || '').trim().slice(0, 500);
    if (n) e.note = n; else delete e.note;
  }
  if (name !== undefined) {
    const nm = (name || '').trim().slice(0, 120);
    if (nm) e.nameAtTime = nm;
  }
  // La subtarea de ESTA entrada: para corregir a qué parte de la tarea fue este rato.
  // '' (o null) la deja sin subtarea, apuntada a la tarea a secas.
  if (subId !== undefined) {
    const sub = subId ? (task.subtasks || []).find(x => x.id === subId) : null;
    if (sub) { e.subId = sub.id; e.subNameAtTime = sub.name; }
    else { delete e.subId; delete e.subNameAtTime; }
    // Si se le quita la subtarea a la entrada en curso, el panel tiene que enterarse.
    if (state.activeTaskId === taskId && entryIndex === task.entries.length - 1 && !e.end) {
      state.activeSubId = sub ? sub.id : null;
    }
  }
  saveData(); broadcastState();
}

function deleteEntry(taskId, entryIndex) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !task.entries[entryIndex]) return;
  task.entries.splice(entryIndex, 1);
  if (state.activeTaskId === taskId && !task.entries.some(e => !e.end)) state.activeTaskId = null;
  saveData(); broadcastState();
}

function addCalendarEntry(taskId, newTaskName, newTaskColor, startMs, endMs, note, subId, newTaskGroupId) {
  let task = state.tasks.find(t => t.id === taskId);
  if (!task && newTaskName) {
    const id = Date.now().toString();
    const finalColor = colorForNewTask(newTaskGroupId, newTaskColor);
    task = { id, name: newTaskName, color: finalColor, entries: [], archived: false, groupId: null, taskType: 'ongoing', memo: '' };
    // La sección es solo su etiqueta (igual que al crear desde "Empezar una tarea
    // ahora"): se le pone y la tarea sigue sin archivar, así que nace ya dentro de su
    // sección en Tareas y a la vez a mano en el Panel.
    if (newTaskGroupId && state.groups.some(g => g.id === newTaskGroupId)) task.groupId = newTaskGroupId;
    state.tasks.push(task);
  }
  if (!task || startMs == null) return;
  const entry = { start: startMs, end: endMs || null, nameAtTime: task.name };
  const n = (note || '').trim().slice(0, 500);
  if (n) entry.note = n;
  if (subId) {
    const sub = (task.subtasks || []).find(x => x.id === subId);
    if (sub) { entry.subId = sub.id; entry.subNameAtTime = sub.name; }
  }
  task.entries.push(entry);
  saveData(); broadcastState();
}

// 2.12: añadir una reunión de Outlook (decidido con Álvaro el 18-11-2026):
//   - futura: se apunta ya con sus horas; cuando llegue, si hay otra tarea en marcha se corta
//     al empezar la reunión y vuelve a ponerse en marcha al acabar (vigilarReunionesPlaneadas);
//   - ya añadida (misma reunión, entry.outlookId): no se repite;
//   - la reunión manda: lo que otras entradas tengan en ese rato se recorta (recortar-solapes.js);
//   - si está pasando ahora, la tarea en marcha se corta al empezar la reunión y la de la
//     reunión se pone en marcha desde esa hora.
function anadirReunion(p) {
  const ahora = Date.now();
  const startMs = Number(p.startMs), endMs = p.endMs == null ? null : Number(p.endMs);
  if (!startMs) return;
  if (state.tasks.some(t => !t.deleted && t.entries.some(e => e.outlookId === p.reunionId))) return;
  let task = state.tasks.find(t => t.id === p.taskId);
  if (!task && p.newTaskName) {
    addCalendarEntry(null, p.newTaskName, p.newTaskColor, startMs, startMs + 1, '', null, p.newTaskGroupId);   // crea la tarea
    task = state.tasks[state.tasks.length - 1];
    task.entries = [];
  }
  if (!task) return;
  const futura = startMs > ahora;
  const enCurso = !futura && (endMs == null || endMs > ahora);
  if (futura && !(endMs > startMs)) return;
  const { paroLaActiva } = recortarSolapes(state.tasks, startMs, enCurso ? null : endMs, ahora);
  if (paroLaActiva) { state.activeTaskId = null; state.activeSubId = null; }
  const entry = { start: startMs, end: enCurso ? null : endMs, nameAtTime: task.name, outlookId: String(p.reunionId).slice(0, 300) };
  const n = (p.note || '').trim().slice(0, 500);
  if (n) entry.note = n;
  const sub = p.subId ? (task.subtasks || []).find(x => x.id === p.subId) : null;
  if (sub) { entry.subId = sub.id; entry.subNameAtTime = sub.name; }
  if (enCurso) {
    // Si quedaba otra en marcha (no se solapaba), se para ahora: solo puede haber una.
    if (state.activeTaskId) pauseActive();
    task.entries.push(entry);
    state.activeTaskId = task.id;
    state.activeSubId = sub ? sub.id : null;
  } else {
    task.entries.push(entry);
  }
  saveData(); broadcastState(); resetReminderTimer();
}

// ── Reminder widget ───────────────────────────────────────────────────────────
function getReminderMs() {
  return (settings.reminderMinutes || 10) * 60000;
}

function resetReminderTimer() {
  if (reminderTimer) clearTimeout(reminderTimer);
  if (state.activeTaskId) reminderTimer = setTimeout(showReminder, getReminderMs());
}

function showReminder() {
  if (!state.activeTaskId) return;
  if (silenciado()) { reminderTimer = setTimeout(showReminder, getReminderMs()); return; }
  if (settings.estiloAvisos === 'abajo') {   // la tarjeta de abajo de siempre
    if (widgetWin && !widgetWin.isDestroyed()) { sendStateToWindow(widgetWin); widgetWin.showInactive(); scheduleWidgetAutoHide(); }
    else createWidgetWindow();
  } else avisarTarea();                       // 2.17: por defecto, como los demás avisos (arriba, en isla)
  reminderTimer = setTimeout(showReminder, getReminderMs());
}

// ── No molestar ──────────────────────────────────────────────────────────────
// Mientras está puesto no sale NINGÚN aviso por encima de lo que estés haciendo: ni
// el recordatorio de las horas, ni los ojos del 20-20-20, ni las notificaciones de
// hora de salida o de actualización. Lo que sí sigue funcionando es lo que no
// interrumpe: los cronómetros cuentan igual y, si lo pediste, la tarea se para sola
// a tu hora aunque no te lo diga.
function dndActive() {
  const d = Number(settings.dndUntil) || 0;
  if (d === -1) return true;
  if (d > Date.now()) return true;
  if (d !== 0) { settings.dndUntil = 0; saveSettings(); broadcastState(); }   // ya venció
  return false;
}

// 2.12: además de No molestar, en una llamada (alguna app con el micrófono abierto) tampoco
// sale ningún aviso encima.
let appsEnLlamada = [];
function silenciado() {
  return dndActive() || (settings.silenciarEnLlamada !== false && appsEnLlamada.length > 0);
}

// minutos = 0 lo deja puesto hasta que se quite; null lo quita.
function setDnd(minutos) {
  if (minutos === null) settings.dndUntil = 0;
  else if (!minutos) settings.dndUntil = -1;
  else settings.dndUntil = Date.now() + minutos * 60000;
  saveSettings();
  if (dndActive()) {
    // Lo que ya estuviera asomando se retira en el acto.
    hideEyeCare();
    hideWidget();
  }
  broadcastState(); updateTrayTitle();
}

// ── Aviso de hora de salida ──────────────────────────────────────────────────

// Devuelve la hora de salida de hoy ('HH:MM') o null si hoy no toca avisar.
// Hora de salida de un dia concreto ('HH:MM'), o null si ese dia no toca avisar.
function leaveTimeForDate(d) {
  if (!settings.leaveEnabled) return null;
  if (settings.leaveSameEveryDay) return settings.leaveTime || null;
  const dias = settings.leaveDays || {};
  return dias[d.getDay()] || null;
}

// Primera hora de salida que ya ha pasado desde que empezo el rato en curso. Se recorre
// dia a dia desde que arranco, no solo hoy: si el ordenador se suspende (o se apaga) a
// las tres de la tarde y no se vuelve a tocar hasta mañana, la hora de salida de AYER
// tambien cuenta. Antes solo se miraba la de hoy y ademas se descartaba pasada una hora,
// asi que en el caso para el que existe esto -te vas y dejas el equipo- no hacia nada.
function primeraSalidaPasada(desdeMs) {
  const ahora = Date.now();
  const dia = new Date(desdeMs); dia.setHours(0, 0, 0, 0);
  for (let i = 0; i < 40; i++) {          // tope de seguridad, no un limite real
    if (dia.getTime() > ahora) break;
    const hhmm = leaveTimeForDate(dia);
    if (hhmm) {
      const [h, m] = String(hhmm).split(':').map(Number);
      if (Number.isFinite(h) && Number.isFinite(m)) {
        const corte = new Date(dia); corte.setHours(h, m, 0, 0);
        const t = corte.getTime();
        if (t > desdeMs && t <= ahora) return t;
      }
    }
    dia.setDate(dia.getDate() + 1);
  }
  return null;
}

function checkLeaveTime() {
  if (!settings.leaveEnabled || !state.activeTaskId) return;   // sin nada corriendo, nada que parar
  const task = getActiveTask();
  const last = entradaEnCurso(task);
  if (!last || last.end) return;

  const corte = primeraSalidaPasada(last.start);
  if (corte == null) return;
  if (leaveNotifiedOn === corte) return;   // ya atendido (la marca es el corte, no el dia)

  // Con No molestar puesto no se avisa, pero si se para: parar no interrumpe nada, y es
  // justo lo que se ha pedido que pase. Sin parada automatica, se deja sin marcar para
  // que el aviso llegue en cuanto se quite el silencio.
  if (silenciado() && !settings.leaveAutoStop) return;
  leaveNotifiedOn = corte;

  if (settings.leaveAutoStop) {
    // El rato se cierra A LA HORA DE SALIDA, no en el momento en que la app se entera:
    // si el equipo estuvo suspendido, apuntar la hora de encenderlo seria contar horas
    // que nadie ha trabajado.
    last.end = Math.max(last.start, corte);
    state.activeTaskId = null;
    state.activeSubId = null;
    saveData(); broadcastState(); updateTrayTitle(); resetReminderTimer();
    if (!silenciado()) notifyLeaveTime(task, true, corte);
    return;
  }

  // Solo aviso: aqui si tiene sentido rendirse si ya es tarde. Un recordatorio de que
  // pares la tarea saltando a las tres de la madrugada no le sirve a nadie.
  if (Date.now() - corte > 60 * 60000) return;
  if (!silenciado()) notifyLeaveTime(task, false, corte);
}

function notifyLeaveTime(task, parada, corte) {
  const nombre = task ? task.name : 'una tarea';
  const llevas = task ? fmtDuration(todaySecondsForTask(task)) : '';
  const hora = corte ? `${String(new Date(corte).getHours()).padStart(2, '0')}:${String(new Date(corte).getMinutes()).padStart(2, '0')}` : '';
  avisar({
    que: 'Hora de salida', icono: 'salida', duracion: parada ? 15000 : 0, programado: !parada,   // te pide pararla: se queda
    titulo: parada ? `He parado «${nombre}»${hora ? ` a las ${hora}` : ''}` : `Sigues con «${nombre}»`,
    sub: parada ? 'Hasta mañana' : `${llevas ? llevas + ' hoy · ' : ''}¿La paras antes de irte?`,
    clic: 'abrir', acciones: [],
    al: { abrir: () => openMain() },   // el panel, con el play/pausa a mano
  });
}

function fmtDuration(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function startLeaveWatcher() {
  if (leaveTimer) clearInterval(leaveTimer);
  leaveTimer = setInterval(checkLeaveTime, 30000);
  checkLeaveTime();
}

// ── Menú del clic derecho sobre la barra ─────────────────────────────────────
// Menú nativo a propósito: se pinta por encima de todo, se coloca solo y se cierra
// como el usuario espera, sin tener que resolver nada de eso dentro de la ventana
// transparente y click-through de la barra.
function showDockContextMenu() {
  if (!dockWin || dockWin.isDestroyed()) return;
  const activa = getActiveTask();
  const displays = screen.getAllDisplays();
  const actual = dockDisplay();

  const esconder = (min, etiqueta) => ({ label: etiqueta, click: () => hideDockFor(min) });

  const plantilla = [
    { label: 'Cronota', enabled: false },
    { label: `Hoy: ${formatDuration(totalTodaySeconds())}`, enabled: false },
    { type: 'separator' },
    activa
      ? { label: `Pausar «${activa.name}»`, click: () => pauseActive() }
      : { label: 'No hay ninguna tarea en marcha', enabled: false },
    { type: 'separator' },
    dndActive()
      ? { label: 'Quitar el modo no molestar', click: () => setDnd(null) }
      : {
          label: 'No molestar',
          submenu: [15, 30, 60, 120, 480].map(m => ({
            label: m < 60 ? `${m} minutos` : `${m / 60} hora${m > 60 ? 's' : ''}`,
            click: () => setDnd(m),
          })).concat([{ type: 'separator' }, { label: 'Hasta que lo quite', click: () => setDnd(0) }]),
        },
    {
      label: 'Esconder la barra',
      submenu: [
        esconder(15, '15 minutos'),
        esconder(30, '30 minutos'),
        esconder(60, '1 hora'),
        esconder(120, '2 horas'),
        esconder(480, '8 horas'),
        { type: 'separator' },
        esconder(0, 'Hasta que la muestre yo'),
      ],
    },
    {
      label: 'Cambiar de pantalla',
      enabled: displays.length > 1,
      submenu: displays.map((d, i) => ({
        label: `Pantalla ${i + 1}${d.bounds.x === 0 && d.bounds.y === 0 ? ' (principal)' : ''} · ${d.size.width}×${d.size.height}`,
        type: 'radio',
        checked: d.id === actual.id,
        click: () => {
          settings.dockDisplayId = d.id;
          settings.dockDisplayKey = displayKey(d);
          saveSettings(); positionDock(); syncDockBounds(); ensureDockBarVisible();
        },
      })),
    },
    {
      label: 'Cambiar de borde',
      submenu: [['left', 'Izquierda'], ['right', 'Derecha'], ['top', 'Arriba'], ['bottom', 'Abajo']].map(([v, etiqueta]) => ({
        label: etiqueta,
        type: 'radio',
        checked: (settings.dockAnchor || 'right') === v,
        click: () => { settings.dockAnchor = v; saveSettings(); positionDock(); syncDockBounds(); },
      })),
    },
    { type: 'separator' },
    { label: 'Calendario', click: () => openCalendar() },
    { label: 'Tareas', click: () => openGroups() },
    { label: 'Notas', click: () => openNotas() },
    { label: 'Ajustes', click: () => openSettings() },
  ];

  if (imputeUrls().length) {
    plantilla.push({ label: 'Imputar…', click: () => openImputeUrl() });
  }

  plantilla.push(
    { type: 'separator' },
    // Modo clásico = ventanas sueltas de siempre, sin barra flotante.
    { label: 'Cambiar a modo clásico (ventanas)', click: () => toggleDockMode() },
    { label: 'Salir de Cronota', click: () => { saveData(); app.quit(); } },
  );

  try { Menu.buildFromTemplate(plantilla).popup({ window: dockWin }); } catch {}
}

// ── Días visibles del calendario ─────────────────────────────────────────────
const DIAS_SEMANA = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'],
                     [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']];

function defaultWeekDays() {
  const d = Array.isArray(settings.weekDays) ? settings.weekDays : [];
  return d.length ? d : [1, 2, 3, 4, 5, 6, 0];
}

function weekDaysFor(clave) {
  const ov = settings.weekOverrides && settings.weekOverrides[clave];
  return Array.isArray(ov) ? ov : defaultWeekDays();
}

// Las excepciones son de usar y tirar: pasado un año no le importan a nadie y solo
// engordarían el fichero de ajustes.
function pruneWeekOverrides() {
  const ovs = settings.weekOverrides;
  if (!ovs) return;
  const limite = Date.now() - 365 * 86400000;
  Object.keys(ovs).forEach(k => {
    const t = Date.parse(k + 'T00:00:00');
    if (Number.isFinite(t) && t < limite) delete ovs[k];
  });
}

// ── Enlace para imputar ──────────────────────────────────────────────────────
// Se acepta lo que el usuario pegue: si no trae esquema, se le pone https://. Solo
// http y https, para que un enlace guardado no pueda acabar abriendo otra cosa.
function normalizeUrl(url) {
  if (!url) return '';
  const conEsquema = /^[a-zA-Z][\w+.-]*:\/\//.test(url) ? url : `https://${url}`;
  try {
    const u = new URL(conEsquema);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.toString();
  } catch { return ''; }
}

function imputeUrls() {
  return (settings.imputeUrls || []).map(normalizeUrl).filter(Boolean);
}

// Sin argumentos abre el único que haya; con uno concreto, ese; con todos:true, los
// abre en orden y separados unas décimas para que el navegador no se atragante y se
// coma alguna pestaña.
function openImputeUrl(cual) {
  const lista = imputeUrls();
  if (!lista.length) return;
  const shell = require('electron').shell;
  if (cual && cual.all) {
    lista.forEach((u, i) => setTimeout(() => { try { shell.openExternal(u); } catch {} }, i * 250));
    return;
  }
  const url = cual && cual.url ? normalizeUrl(cual.url) : lista[0];
  if (url && lista.includes(url)) { try { shell.openExternal(url); } catch {} }
}

// ── Regla 20-20-20 ───────────────────────────────────────────────────────────
const EYE_RATIO = 0.78;   // alto respecto al ancho de la burbuja

// La ventana mide exactamente lo que la burbuja: sin sombra no hay nada que se salga
// del redondeo, así que no hace falta reservarle hueco (y el tamaño de Ajustes vuelve
// a ser el de lo que se ve).
function eyeCareBounds() {
  const work = pantallaAvisos().workArea;
  const w = Math.max(80, Math.min(420, Number(settings.eyeCareSize) || 150));
  const h = Math.round(w * EYE_RATIO);
  const m = 18;   // separación del borde
  const pos = settings.eyeCarePos || 'top';
  const izq = work.x + m;
  const centro = work.x + Math.round((work.width - w) / 2);
  const der = work.x + work.width - w - m;
  const arriba = work.y + m;
  const abajo = work.y + work.height - h - m;
  const x = pos.includes('Left') ? izq : pos.includes('Right') ? der : centro;
  const y = pos.startsWith('bottom') ? abajo : arriba;
  return { x, y, width: w, height: h };
}

function createEyeCareWindow() {
  if (eyeCareWin && !eyeCareWin.isDestroyed()) return eyeCareWin;
  const b = eyeCareBounds();
  eyeCareWin = new BrowserWindow({
    ...b,
    // backgroundColor transparente EXPLÍCITO: sin él, una ventana transparent:true en
    // Windows se pinta con fondo opaco (negro) y ese fondo asoma por fuera del redondeo
    // de la burbuja. Es lo que dejaba las esquinas cuadradas negras. Las otras ventanas
    // transparentes (la barra y el botón de ocultar) ya lo llevaban; a esta se me pasó.
    // roundedCorners:false porque el redondeo lo pone el CSS de la burbuja; dejando
    // que Windows redondee además la ventana solo se añaden recortes raros encima.
    frame: false, transparent: true, hasShadow: false, backgroundColor: '#00000000',
    resizable: false, roundedCorners: false,
    // focusable:false para no sacar al usuario de lo que esté haciendo; el clic para
    // quitarla de en medio sigue llegando igual.
    skipTaskbar: true, alwaysOnTop: true, focusable: false, show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  // 'screen-saver' la pone por encima incluso de aplicaciones a pantalla completa,
  // que es justo cuando más falta hace acordarse de mirar a lo lejos.
  try { eyeCareWin.setAlwaysOnTop(true, 'screen-saver'); } catch {}
  eyeCareWin.loadFile(path.join(__dirname, 'src', 'eyecare.html'));
  eyeCareWin.on('closed', () => { eyeCareWin = null; });
  return eyeCareWin;
}

function showEyeCare(segundos, forzar) {
  // forzar = la vista previa de Ajustes, que la pide el usuario a propósito.
  if (silenciado() && !forzar) return;
  const win = createEyeCareWindow();
  if (!win || win.isDestroyed()) return;
  const secs = Math.max(1, Number(segundos) || Number(settings.eyeCareRest) || 20);
  try { win.setBounds(eyeCareBounds()); } catch {}
  const lanzar = () => {
    if (!win || win.isDestroyed()) return;
    try { win.showInactive(); win.webContents.send('eye-start', secs, { soloOjos: !!settings.eyeCareSoloOjos }); } catch {}
  };
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', lanzar);
  else lanzar();

  // Red de seguridad: si el renderer se atasca, la burbuja no se queda ahí clavada.
  if (eyeCareHideTimer) clearTimeout(eyeCareHideTimer);
  eyeCareHideTimer = setTimeout(hideEyeCare, (secs + 4) * 1000);
}

function hideEyeCare() {
  if (eyeCareHideTimer) { clearTimeout(eyeCareHideTimer); eyeCareHideTimer = null; }
  try { if (eyeCareWin && !eyeCareWin.isDestroyed()) eyeCareWin.hide(); } catch {}
}

function eyeCareEveryMin() {
  return Math.max(1, Math.min(180, Number(settings.eyeCareEvery) || 20));
}

// Se lleva la HORA del próximo aviso en vez de un setInterval largo. Dos motivos:
//   - startEyeCareTimer() se llamaba en cada cambio de Ajustes, y Ajustes lo manda en
//     cada movimiento de deslizador, así que toquetear el tamaño o la posición
//     reiniciaba la cuenta y el aviso se iba retrasando indefinidamente.
//   - un setInterval de 20 minutos no corre mientras el ordenador está suspendido, así
//     que al despertar la cuenta iba desfasada.
// Con una hora objetivo y un latido corto, ninguna de las dos cosas afecta.
function reprogramEyeCare(desdeCero) {
  if (!settings.eyeCareEnabled) { eyeCareNextAt = 0; return; }
  if (desdeCero || !eyeCareNextAt) eyeCareNextAt = Date.now() + eyeCareEveryMin() * 60000;
}

function startEyeCareTimer(desdeCero) {
  if (eyeCareTimer) { clearInterval(eyeCareTimer); eyeCareTimer = null; }
  if (!settings.eyeCareEnabled) { hideEyeCare(); eyeCareNextAt = 0; return; }
  reprogramEyeCare(desdeCero);
  eyeCareTimer = setInterval(tickEyeCare, 15000);
}

function tickEyeCare() {
  if (!settings.eyeCareEnabled || !eyeCareNextAt) return;
  if (Date.now() < eyeCareNextAt) return;
  eyeCareNextAt = Date.now() + eyeCareEveryMin() * 60000;
  showEyeCare();
}

let widgetHideTimer = null;
function scheduleWidgetAutoHide() {
  if (widgetHideTimer) clearTimeout(widgetHideTimer);
  widgetHideTimer = null;
  if (!settings.widgetAutoHide) return;
  const ms = (settings.widgetAutoHideSeconds || 10) * 1000;
  widgetHideTimer = setTimeout(() => { widgetHideTimer = null; hideWidget(); }, ms);
}

function applyTranslucency(win) {
  if (!win || win.isDestroyed()) return;
  try { win.setOpacity(1); } catch {}
  try { win.setBackgroundColor('#00000000'); } catch {}   // deja ver el material de debajo
  // 'acrylic' = difuminado del sistema; 'none' = sin difuminar (solo el tinte).
  try { win.setBackgroundMaterial(settings.blurEnabled === false ? 'none' : 'acrylic'); } catch {}
}

// El acrílico lo pinta Windows y toma su tinte del modo claro/oscuro DEL SISTEMA: con
// Windows en claro salía blanquecino aunque el tema de la app fuese oscuro. Forzando el
// themeSource a juego con el tema elegido, el difuminado sale del color correcto.
function applySystemThemeSource() {
  const t = THEMES[settings.theme] || THEMES[DEFAULT_THEME];
  try { nativeTheme.themeSource = t.scheme === 'light' ? 'light' : 'dark'; } catch {}
}

function applyTranslucencyAll() {
  applySystemThemeSource();
  // Ni la barrita ni (desde la 2.8) el panel del dock ni (2.8.3) el recordatorio llevan
  // material: son transparentes a propósito, y applyTranslucency les haría setOpacity.
  [mainWin, calendarWin, groupsWin, notasWin, settingsWin]
    .forEach(w => applyTranslucency(w));
  broadcastTheme();
}

// Paleta actual, ya resuelta (ver themes.js).
function themeVars() {
  return resolverTema(settings);
}

function broadcastTheme() {
  const vars = themeVars();
  [mainWin, calendarWin, groupsWin, notasWin, settingsWin, widgetWin, dockWin, splashWin]
    .forEach(w => sendToAllFrames(w, 'theme', vars));
  sendToAllFrames(dockPanelWin, 'theme', vars);
}

// Guardado diferido de ajustes: los deslizadores de la barra flotante disparan cambios
// decenas de veces por segundo y no hace falta escribir el archivo en cada uno.
const saveSettingsSoon = (() => {
  let t = null;
  return () => { clearTimeout(t); t = setTimeout(saveSettings, 400); };
})();

function debounce(fn, ms) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// La pantalla "de referencia" para abrir/posicionar ventanas nuevas: la que tenga el
// panel principal en ese momento (si no existe todavía, la principal del sistema).
function getReferenceDisplay() {
  // En modo dock las ventanas sueltas están escondidas y sus límites pueden apuntar a
  // un monitor que ya no existe: ahí la referencia buena es la principal.
  if (!settings.dockMode && mainWin && !mainWin.isDestroyed() && mainWin.isVisible()) {
    try { return screen.getDisplayMatching(mainWin.getBounds()); } catch {}
  }
  return screen.getPrimaryDisplay();
}

// Recalcula los límites min/max de una ventana según la pantalla en la que esté AHORA
// (guardados como "medidas de diseño" en win.__sizeSpec, sin recortar), y si con el
// nuevo límite ya no cabe, la encoge para que quede dentro del área de trabajo.
function adaptWindowToItsDisplay(win) {
  if (!win || win.isDestroyed() || !win.__sizeSpec) return;
  const { minWidth, minHeight, maxWidth, maxHeight } = win.__sizeSpec;
  let disp;
  try { disp = screen.getDisplayMatching(win.getBounds()); } catch { return; }
  const work = disp.workArea;
  const cappedMaxW = Math.max(minWidth, Math.min(maxWidth, work.width));
  const cappedMaxH = Math.max(minHeight, Math.min(maxHeight, work.height));
  try { win.setMaximumSize(cappedMaxW, cappedMaxH); } catch {}
  try { win.setMinimumSize(Math.min(minWidth, cappedMaxW), Math.min(minHeight, cappedMaxH)); } catch {}
  const b = win.getBounds();
  const newW = Math.min(b.width, cappedMaxW);
  const newH = Math.min(b.height, cappedMaxH);
  if (newW !== b.width || newH !== b.height) {
    const x = Math.min(Math.max(b.x, work.x), work.x + work.width - newW);
    const y = Math.min(Math.max(b.y, work.y), work.y + work.height - newH);
    try { win.setBounds({ x, y, width: newW, height: newH }); } catch {}
  }
}

// w/h son el tamaño "ideal" de arranque; minWidth/minHeight/maxWidth/maxHeight en opts
// son las medidas DE DISEÑO (sin recortar a ninguna pantalla en concreto): makeWindow las
// ajusta ya a la pantalla de referencia al crearla, y las reajusta sola si la ventana se
// mueve a otra pantalla (ver adaptWindowToItsDisplay, enganchado al evento 'move').
function makeWindow(file, w, h, opts = {}) {   // 2.16: plugins = visor de PDF en Notas
  const { minWidth, minHeight, maxWidth, maxHeight, x, y, center, ...restOpts } = opts;
  const disp = getReferenceDisplay();
  const work = disp.workArea;

  const designMinW = minWidth || 0;
  const designMinH = minHeight || 0;
  const designMaxW = maxWidth || 100000;
  const designMaxH = maxHeight || 100000;
  const cappedMaxW = Math.max(designMinW, Math.min(designMaxW, work.width));
  const cappedMaxH = Math.max(designMinH, Math.min(designMaxH, work.height));
  const initW = Math.max(Math.min(designMinW, cappedMaxW), Math.min(w, cappedMaxW));
  const initH = Math.max(Math.min(designMinH, cappedMaxH), Math.min(h, cappedMaxH));

  let posX = x, posY = y;
  if (posX == null && posY == null && center !== false) {
    posX = work.x + Math.round((work.width - initW) / 2);
    posY = work.y + Math.round((work.height - initH) / 2);
  }

  const win = new BrowserWindow({
    width: initW, height: initH,
    x: posX, y: posY,
    minWidth: Math.min(designMinW, cappedMaxW), minHeight: Math.min(designMinH, cappedMaxH),
    maxWidth: cappedMaxW, maxHeight: cappedMaxH,
    // OJO: en Windows, backgroundMaterial (el acrílico que da el desenfoque) se ignora
    // si la ventana es transparent:true. Estaba así, de modo que el "blur" nunca existió
    // y solo se veía el tinte con alfa. Con transparent:false + backgroundColor
    // transparente + backgroundMaterial, el sistema sí difumina lo que hay detrás, y las
    // esquinas las redondea el propio Windows (roundedCorners).
    frame: false, transparent: false, hasShadow: false,
    backgroundColor: '#00000000',
    backgroundMaterial: settings.blurEnabled === false ? 'none' : 'acrylic',
    resizable: true, roundedCorners: true,
    icon: WINDOW_ICON_PATH,
    ...restOpts,
    // Con el frenado de Chromium por defecto: una ventana visible sin foco sigue animando
    // igual; solo deja de pintar la que está oculta, minimizada o tapada del todo. Con
    // backgroundThrottling:false las ventanas escondidas (panel plegado, recordatorio)
    // seguían dibujando frames todo el día y el proceso de GPU no paraba.
    webPreferences: { nodeIntegration: true, contextIsolation: false, plugins: true },
  });
  win.__sizeSpec = { minWidth: designMinW, minHeight: designMinH, maxWidth: designMaxW, maxHeight: designMaxH };
  win.on('show', () => sendStateToWindow(win));      // escondida no recibe el tic de cada segundo
  win.on('move', debounce(() => adaptWindowToItsDisplay(win), 200));
  win.loadFile(path.join(__dirname, 'src', file));
  applyTranslucency(win);
  return win;
}

// 2.8.3: el recordatorio es una tarjeta de cristal líquido dentro de una ventana
// transparente, con aire alrededor para su sombra y para la gota con la que entra y sale
// por el borde de la pantalla (ver widget.html). La tarjeta va abajo a la derecha de la
// ventana, a 20 px del borde; lo transparente deja pasar los clics (widget-raton).
function widgetEscala() { return Math.max(80, Math.min(150, Number(settings.widgetScale) || 100)) / 100; }
// La ventana tiene siempre el tamaño del recordatorio más grande (150 %): así el tamaño se
// cambia en vivo solo con CSS, sin redimensionar una ventana transparente (parpadea).
function widgetVentana() { return { w: Math.round(330 * 1.5) + 44 + 20, h: Math.round(200 * 1.5) + 44 + 20 }; }
function createWidgetWindow() {
  // 2.16: en la pantalla de los avisos (Ajustes → Avisos). Si lo moviste dentro de esa pantalla,
  // vuelve donde lo dejaste; si no, a su esquina de abajo a la derecha.
  const work = pantallaAvisos().workArea;
  const wb = widgetBounds;
  const ok = !!wb && wb.x >= work.x && wb.y >= work.y && wb.x < work.x + work.width && wb.y < work.y + work.height;
  const { w: W, h: H } = widgetVentana();
  const w = widgetWin = new BrowserWindow({
    width: W, height: H,
    x: ok ? wb.x : work.x + work.width - W, y: ok ? wb.y : work.y + work.height - H,
    frame: false, transparent: true, hasShadow: false, backgroundColor: '#00000000',
    resizable: false, roundedCorners: false, alwaysOnTop: true, skipTaskbar: true,
    show: false,          // no mostrar al crear: mostramos sin activar (ver showInactive)
    icon: WINDOW_ICON_PATH,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  // 2.16: por encima de todo (también de la barra y los paneles de Cronota, que van en un nivel más alto).
  try { w.setAlwaysOnTop(true, 'screen-saver'); } catch {}
  w.loadFile(path.join(__dirname, 'src', 'widget.html'), { search: 'k=' + widgetEscala() });
  try { w.setIgnoreMouseEvents(true, { forward: true }); } catch {}
  // showInactive: aparece encima pero SIN robar el foco, para no sacarte de lo que
  // estuvieras escribiendo en otra aplicación.
  w.once('ready-to-show', () => {
    if (w.isDestroyed()) return;   // se retiró (No molestar, cerrar) antes de cargar
    w.showInactive(); sendStateToWindow(w); scheduleWidgetAutoHide();
  });
  // Se compara la instancia: si ya se creó otro recordatorio, no hay que perderlo.
  w.on('closed', () => { if (widgetWin === w) widgetWin = null; });
}

// El recordatorio se ve unos segundos cada X minutos: se destruye al retirarlo en vez
// de esconderlo. Escondido seguía vivo todo el día (un proceso de ~115 MB recibiendo
// el estado cada segundo); recrearlo cuesta menos de un segundo de CPU por aviso.
// Su posición se guarda en memoria para recrearlo en el mismo sitio. Antes de
// destruirlo se le deja irse con su animación (unos 560 ms).
let widgetBounds = null;
function hideWidget() {
  if (widgetHideTimer) { clearTimeout(widgetHideTimer); widgetHideTimer = null; }
  const w = widgetWin;
  widgetWin = null;
  if (!w || w.isDestroyed()) return;
  try {
    if (w.isVisible()) widgetBounds = w.getBounds();
    w.webContents.send('widget-salir');
  } catch {}
  setTimeout(() => { try { if (!w.isDestroyed()) w.destroy(); } catch {} }, 680);
}

// ── Modo dock (barra flotante lateral) ────────────────────────────────────────
// La ventana tiene tamaño FIJO (el del panel desplegado) y NO se redimensiona: el
// plegar/desplegar es puramente CSS dentro del renderer (fluido), y la parte transparente
// deja pasar los clics al escritorio con setIgnoreMouseEvents (el renderer decide cuándo,
// según si el ratón está sobre algo interactivo). Sin material acrílico: acrílico rellena
// toda la ventana de gris aunque el DOM sea transparente (era el "recuadro gris raro").
// La ventana del dock cubre TODA el área de trabajo de la pantalla elegida y es
// transparente + click-through: así la posición de la barra (cualquiera de los 4 bordes
// o de las 4 esquinas), el tamaño del panel y las animaciones son puro CSS, sin tener
// que recalcular ni redimensionar la ventana (que era lo que iba a tirones).
const DOCK_ANCHORS = ['left','right','top','bottom'];

// Huella de una pantalla, para reconocerla aunque vuelva con otro id (Windows los
// reasigna al desconectar y volver a conectar un monitor).
function displayKey(d) {
  if (!d) return null;
  return `${d.bounds.width}x${d.bounds.height}@${d.bounds.x},${d.bounds.y}:${d.scaleFactor}`;
}

// La pantalla donde vive la barra flotante. Si la elegida no está conectada ahora
// mismo, se usa la que haya, PERO no se toca el ajuste: en cuanto vuelva a aparecer,
// la barra se va sola otra vez a ella.
function dockDisplay() {
  const displays = screen.getAllDisplays();
  if (settings.dockDisplayId != null) {
    const porId = displays.find(x => x.id === settings.dockDisplayId);
    if (porId) return porId;
    if (settings.dockDisplayKey) {
      const porHuella = displays.find(x => displayKey(x) === settings.dockDisplayKey);
      if (porHuella) return porHuella;
    }
  }
  return getReferenceDisplay();
}

// Config visual del dock que se envía al renderer (anclaje, colores, tamaños...).
function dockConfig() {
  const anchor = DOCK_ANCHORS.includes(settings.dockAnchor) ? settings.dockAnchor : 'right';
  return {
    anchor,
    barWidth: Math.max(3, Math.min(24, Number(settings.dockBarWidth) || 7)),
    barLength: Math.max(30, Math.min(600, Number(settings.dockBarLength) || 110)),
    barPos: Math.max(0, Math.min(100, settings.dockBarPos == null ? 50 : Number(settings.dockBarPos))),
    barOffset: Math.max(0, Math.min(120, settings.dockBarOffset == null ? 4 : Number(settings.dockBarOffset))),
    barOpacity: Math.max(5, Math.min(100, Number(settings.dockBarOpacity) || 30)),
    barColor: settings.dockBarColor || '#ffffff',
    barGlass: settings.dockBarGlass !== false && settings.liquidGlass !== false,   // 2.8.3: de cristal (por defecto); con el estilo plano, lisa
    panelWidth: Math.max(320, Math.min(1600, Number(settings.dockPanelWidth) || 460)),
    panelHeight: Math.max(260, Math.min(1400, Number(settings.dockPanelHeight) || 620)),
    calendarWidth: Math.max(760, Math.min(1900, Number(settings.dockCalendarWidth) || 1180)),
    notasWidth: Math.max(420, Math.min(1900, Number(settings.dockNotasWidth) || 1000)),
    closeMode: ['button','clickOutside','mouseLeave'].includes(settings.dockCloseMode) ? settings.dockCloseMode : 'button',
    closeSeconds: Math.max(0, Math.min(30, Number(settings.dockCloseSeconds) ?? 3)),
  };
}

// Toda el área de trabajo de la pantalla elegida (ventana de la barrita).
function computeDockBounds() {
  const work = dockDisplay().workArea;
  return { x: work.x, y: work.y, width: work.width, height: work.height };
}

// Dónde va el panel: pegado a su borde, ocupando todo el largo de ese borde.
// Lo que mide la tarjeta del panel en una vista: el ancho con la barra a un lado (el
// calendario es más ancho) o el alto con la barra arriba/abajo.
function tamPanelVista(view) {
  const c = dockConfig();
  if (c.anchor === 'left' || c.anchor === 'right') return view === 'calendar' ? c.calendarWidth : view === 'notas' ? c.notasWidth : c.panelWidth;
  return c.panelHeight;
}
// Rectángulo en pantalla de una tarjeta de ese tamaño, pegada a su borde.
function rectPanel(size) {
  const work = dockDisplay().workArea;
  const c = dockConfig();
  if (c.anchor === 'left' || c.anchor === 'right') {
    const width = Math.max(1, Math.min(Math.round(size), work.width));
    return { x: c.anchor === 'left' ? work.x : work.x + work.width - width, y: work.y, width, height: work.height };
  }
  const height = Math.max(1, Math.min(Math.round(size), work.height));
  return { x: work.x, y: c.anchor === 'top' ? work.y : work.y + work.height - height, width: work.width, height };
}
function computePanelBounds(view) { return rectPanel(tamPanelVista(view)); }

// ── Ventana del panel (rehecha en la 2.8.3) ─────────────────────────────────────
// La ventana cubre SIEMPRE el área de trabajo de su pantalla, igual que la de la barrita,
// y NO se mueve ni cambia de tamaño mientras se ve: redimensionar una ventana transparente
// visible en Windows pinta un fotograma viejo desplazado (el "parpadeo"). Todo lo que se
// ve (entrar, cambiar de pestaña y de ancho, redimensionar a mano) lo anima la página, que
// es la única dueña del tamaño de la tarjeta y lo comunica con 'dock-panel-rect'. Aquí solo
// se recorta la ventana a la tarjeta (setShape: lo de fuera deja pasar los clics) y se
// coloca el botón de esconder.
let dockPanelRect = null;   // dónde está la tarjeta (en pantalla), según la página

function formaRedondeada(x, y, w, h, radios) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (!(w > 0 && h > 0)) return [{ x: 0, y: 0, width: 1, height: 1 }];   // nada visible
  const max = Math.floor(Math.min(w, h) / 2);
  const [tl, tr, br, bl] = (radios || [0, 0, 0, 0]).map(r => Math.max(0, Math.min(Math.round(Number(r) || 0), max)));
  const entra = (r, i) => (i < r ? Math.ceil(r - Math.sqrt(Math.max(0, r * r - (r - i - 0.5) * (r - i - 0.5)))) : 0);
  const arriba = Math.max(tl, tr), abajo = Math.max(bl, br);
  const filas = [];
  for (let i = 0; i < arriba; i++) { const a = entra(tl, i), b = entra(tr, i); filas.push({ x: x + a, y: y + i, width: w - a - b, height: 1 }); }
  filas.push({ x, y: y + arriba, width: w, height: h - arriba - abajo });
  for (let i = abajo - 1; i >= 0; i--) { const a = entra(bl, i), b = entra(br, i); filas.push({ x: x + a, y: y + h - 1 - i, width: w - a - b, height: 1 }); }
  // Filas seguidas con el mismo ancho se juntan en un solo rectángulo.
  const juntas = [];
  for (const r of filas) {
    if (!(r.width > 0 && r.height > 0)) continue;
    const u = juntas[juntas.length - 1];
    if (u && u.x === r.x && u.width === r.width && u.y + u.height === r.y) u.height += r.height;
    else juntas.push({ ...r });
  }
  return juntas.length ? juntas : [{ x: 0, y: 0, width: 1, height: 1 }];
}
function ajustarVentanaPanel() {
  const w = dockPanelWin;
  if (!w || w.isDestroyed()) return false;
  const want = computeDockBounds();
  let cur;
  try { cur = w.getBounds(); } catch { return false; }
  if (cur.x === want.x && cur.y === want.y && cur.width === want.width && cur.height === want.height) return false;
  try { w.setBounds(want); } catch {}
  w.__forma = null;   // la forma va relativa a la ventana: hay que volver a ponerla
  return true;
}
function aplicarFormaPanel(size) {
  const w = dockPanelWin;
  if (!w || w.isDestroyed() || !(size > 0)) return;
  const r = rectPanel(size), b = computeDockBounds();   // b: los límites que tiene (o va a tener) la ventana
  const forma = { x: r.x - b.x, y: r.y - b.y, width: r.width, height: r.height };
  w.__rectForma = r;   // en pantalla: la zona que pide los clics (ver protegerClicsPanel)
  const clave = JSON.stringify(forma);
  if (clave === w.__forma) return;   // sin cambios: ni se toca (cada setShape repinta)
  w.__forma = clave;
  try { w.setShape([forma]); } catch {}
}

let dockPanelView = 'panel';
let dockPanelShownAt = 0;   // cuándo se mostró el panel (ver el blur de clic-fuera)

function createDockPanel() {
  if (dockPanelWin && !dockPanelWin.isDestroyed()) return;
  dockPanelWin = new BrowserWindow({
    ...computeDockBounds(),
    show: false,
    frame: false, hasShadow: false,
    // 2.8: TRANSPARENTE y sin acrílico. Con el acrílico Windows solo deja esquinas de 8 px
    // (y se veían dos esquinas: la de la ventana y la del panel), y para desvanecerla había
    // que usar setOpacity, que en Windows la convierte en ventana "en capas" para siempre:
    // a partir de ahí dejaba de pintar las animaciones (por eso las pestañas no se
    // animaban). Ahora el panel es una tarjeta de la página, con las esquinas que quiera, y
    // todas sus animaciones (entrar, salir, cambiar de ancho) las hace la propia página.
    transparent: true, backgroundColor: '#00000000',
    resizable: false, movable: false, skipTaskbar: true, alwaysOnTop: true, roundedCorners: false,
    icon: WINDOW_ICON_PATH,
    // Sin backgroundThrottling:false: plegado está oculto y no debe pintar (ver makeWindow).
    // plugins: el visor de PDF, para ver los archivos de las notas (2.16).
    webPreferences: { nodeIntegration: true, contextIsolation: false, nodeIntegrationInSubFrames: true, plugins: true },
  });
  try { dockPanelWin.setAlwaysOnTop(true, 'screen-saver'); } catch {}   // igual que la barra
  dockPanelWin.loadFile(path.join(__dirname, 'src', 'dock-panel.html'));
  const push = () => {
    try { dockPanelWin.webContents.send('dock-config', dockConfig()); } catch {}
    sendStateToWindow(dockPanelWin);
  };
  if (dockPanelWin.webContents.isLoading()) dockPanelWin.webContents.once('did-finish-load', push);
  else push();
  // Clic fuera = el panel pierde el foco. Con dos salvaguardas, porque si no el panel se
  // cerraba justo al abrirse: (1) un margen desde que se muestra, porque al aparecer aún
  // no tiene el foco asentado y salta un blur; y (2) si el foco ha ido a otra ventana de
  // la propia app (Ajustes, el aviso de actualización...), eso no es "clicar fuera".
  dockPanelWin.on('blur', () => {
    if (settings.dockCloseMode !== 'clickOutside' || !dockExpanded) return;
    if (Date.now() - dockPanelShownAt < 700) return;
    setTimeout(() => {
      if (settings.dockCloseMode !== 'clickOutside' || !dockExpanded) return;
      const f = BrowserWindow.getFocusedWindow();
      if (f && !f.isDestroyed()) return;   // el foco sigue dentro de la app
      collapseDockPanel();
    }, 140);
  });
  dockPanelWin.on('closed', () => { dockPanelWin = null; dockPanelRect = null; });
  aplicarFormaPanel(tamPanelVista(dockPanelView));
  dockPanelWin.webContents.on('render-process-gone', () => {
    try { if (dockPanelWin && !dockPanelWin.isDestroyed()) dockPanelWin.destroy(); } catch {}
    dockPanelWin = null; dockExpanded = false; hideDockHide(); ensureDockBarVisible();
  });
}

// El botón de esconder ya no tiene ventana propia: se pinta dentro de la de la barra
// (ver .hide-btn en dock.html), que es la que ya tenía un sistema de zonas clicables que
// funciona. Aquí solo queda su tamaño, para calcular dónde va su centro.
const HIDE_BTN = 34;

// Le dice a la ventana de la barra dónde pintar el botón: el CENTRO del círculo, en
// coordenadas de esa ventana (cubre toda el área de trabajo, así que basta con restarle
// su origen). El destino se recibe como parámetro y NO se relee con getBounds(): justo
// después de un setBounds, Windows devuelve a veces los límites anteriores, y ese era el
// motivo de que el botón acabara colocado respecto a un panel que ya no existía.
function positionDockHide(panelBounds) {
  if (!dockWin || dockWin.isDestroyed() || !panelBounds) return;
  const b = panelBounds;
  let origen;
  try { origen = dockWin.getBounds(); } catch { return; }
  const gap = 12, r = HIDE_BTN / 2;
  const anchor = dockConfig().anchor;
  let cx, cy;
  if (anchor === 'right')       { cx = b.x - gap - r;            cy = b.y + b.height / 2; }
  else if (anchor === 'left')   { cx = b.x + b.width + gap + r;  cy = b.y + b.height / 2; }
  else if (anchor === 'top')    { cy = b.y + b.height + gap + r; cx = b.x + b.width / 2; }
  else                          { cy = b.y - gap - r;            cx = b.x + b.width / 2; }
  try {
    dockWin.webContents.send('dock-hide-btn', {
      visible: true,
      x: Math.round(cx - origen.x),
      y: Math.round(cy - origen.y),
    });
  } catch {}
}

function showDockHide(panelBounds) {
  positionDockHide(panelBounds);   // se pasa el destino conocido, NO se relee con getBounds()
}
function hideDockHide() {
  if (!dockWin || dockWin.isDestroyed()) return;
  try { dockWin.webContents.send('dock-hide-btn', { visible: false }); } catch {}
}

// La barrita tiene que estar SIEMPRE visible y con las medidas del área de trabajo. Si la
// ventana se creó cuando el escritorio aún se montaba (arranque con Windows) o cambian los
// monitores, sus medidas se quedan viejas: entonces su "borde derecho" cae en mitad de la
// pantalla física (la barrita aparece flotando en medio) o directamente fuera (desaparece).
// ¿Está la barra escondida a propósito ahora mismo? -1 es "hasta que yo la muestre";
// un número mayor que cero es el momento en el que vuelve sola.
function dockIsHidden() {
  const h = Number(settings.dockHiddenUntil) || 0;
  if (h === -1) return true;
  if (h > Date.now()) return true;
  if (h !== 0) { settings.dockHiddenUntil = 0; saveSettings(); }   // ya venció
  return false;
}

// minutos = 0 la esconde hasta que se pida mostrarla; null la vuelve a mostrar.
function hideDockFor(minutos) {
  if (minutos === null) settings.dockHiddenUntil = 0;
  else if (!minutos) settings.dockHiddenUntil = -1;
  else settings.dockHiddenUntil = Date.now() + minutos * 60000;
  saveSettings();
  if (dockIsHidden()) {
    collapseDockPanel();
    try { if (dockWin && !dockWin.isDestroyed()) dockWin.hide(); } catch {}
  } else {
    ensureDockBarVisible();
  }
  updateTrayTitle();
}

// Las tres ventanas del dock viven en el mismo nivel ('screen-saver'), asi que quien
// se reafirma el ultimo queda arriba. Reafirmar el de la barra cada pocos segundos
// (lo que la mantiene por encima de lo que va a pantalla completa) la ponia por encima
// del panel y de su boton de esconder, y el boton dejaba de recibir los clics. Aqui se
// vuelve a dejar el orden que toca: barra, luego panel, luego boton.
function restackDock() {
  // CON EL PANEL ABIERTO NO SE TOCA EL ORDEN DE VENTANAS. Reafirmar el nivel vuelve a
  // subir la ventana, y la lista de un <select> abierto es una ventana aparte del
  // sistema: al resubir las nuestras, la lista se queda debajo y parece que el
  // desplegable se cierra solo en cuanto pasas el ratón por las opciones.
  //
  // Esta reafirmación existe para que la barrita no se quede detrás de lo que va a
  // pantalla completa, y ese caso es justo el contrario: ahí el panel está cerrado. Así
  // que con el panel abierto no hace falta y sobra.
  if (dockExpanded) return;
  try { if (dockWin && !dockWin.isDestroyed()) dockWin.setAlwaysOnTop(true, 'screen-saver'); } catch {}
}

function ensureDockBarVisible() {
  if (!settings.dockMode) return;
  createDock();
  if (!dockWin || dockWin.isDestroyed()) return;
  // Escondida a propósito: el vigilante no debe sacarla otra vez.
  if (dockIsHidden()) { try { if (dockWin.isVisible()) dockWin.hide(); } catch {} return; }
  try { if (!dockWin.isVisible()) dockWin.showInactive(); } catch {}
  restackDock();
  syncDockBounds();
}

function syncDockBounds() {
  if (!dockWin || dockWin.isDestroyed()) return;
  let cur, want;
  try { cur = dockWin.getBounds(); want = computeDockBounds(); } catch { return; }
  if (cur.x !== want.x || cur.y !== want.y || cur.width !== want.width || cur.height !== want.height) {
    try { dockWin.setBounds(want); } catch {}
  }
  // El panel solo se recoloca si cambió la pantalla bajo sus pies (su ventana mide siempre
  // el área de trabajo). La página lo nota (resize) y vuelve a decir dónde está su tarjeta.
  ajustarVentanaPanel();
}

// 2.8: la ventana (transparente) se coloca y se enseña ya en su sitio, y es la página la
// que hace entrar el panel deslizándolo desde el borde (ver dock-panel.html). Mientras
// estaba escondido el panel se quedó fuera de la vista, así que al enseñar la ventana no
// se ve nada hasta que entra.
function showDockPanel() {
  createDockPanel();
  if (!dockPanelWin || dockPanelWin.isDestroyed()) return;
  ajustarVentanaPanel();
  if (!dockPanelRect) aplicarFormaPanel(tamPanelVista(dockPanelView));   // la página la afina al entrar
  const wasVisible = dockPanelWin.isVisible();
  // Plegado no recibe el tic de cada segundo: se pone al día antes de verse. 2.8.5: ya solo la
  // vista que se va a ver; las otras tres cuando el panel ha terminado de entrar (las cuatro
  // vistas comparten hilo, y rehacerlas todas a la vez se comía la animación de entrada).
  if (!wasVisible) {
    sendStateToActiveDockFrame();
    clearTimeout(dockPanelWin.__restoAlDia);
    dockPanelWin.__restoAlDia = setTimeout(() => {
      if (!dockPanelWin || dockPanelWin.isDestroyed() || !dockPanelWin.isVisible()) return;
      const fichero = DOCK_VIEW_FILE[dockPanelView] || 'main.html';
      const resto = allDockFrames().filter(f => { try { return !String(f.url || '').includes(fichero); } catch { return false; } });
      if (!resto.length) return;
      const s = getSerializableState();
      resto.forEach(f => { try { f.send('state', s); } catch {} });
    }, 900);
  }
  dockPanelWin.__salida = (dockPanelWin.__salida || 0) + 1;   // anula una salida a medias
  try {
    dockPanelWin.showInactive(); dockPanelWin.moveTop(); dockPanelWin.focus();
  } catch {}
  dockExpanded = true; dockOutsideSince = 0; dockPanelShownAt = Date.now();
  // 2.8.3: el botón de esconder sale cuando el panel empieza a entrar (con cristal, la página
  // espera a tener la foto de detrás), no antes. Por si no avisa, a los 450 ms.
  const turno = dockPanelWin.__salida;
  dockPanelWin.__botonPendiente = () => {
    if (!dockPanelWin || dockPanelWin.isDestroyed() || dockPanelWin.__salida !== turno || !dockExpanded) return;
    dockPanelWin.__botonPendiente = null;
    // Por si la página no llegó a destaparla (ver el recorte en collapseDockPanel).
    if (!dockPanelWin.__forma) aplicarFormaPanel(tamPanelVista(dockPanelView));
    showDockHide(dockPanelRect || computePanelBounds(dockPanelView));
  };
  setTimeout(() => { if (dockPanelWin && dockPanelWin.__botonPendiente) dockPanelWin.__botonPendiente(); }, 450);
  try { dockPanelWin.webContents.send('panel-entrar'); } catch {}
  sendToAllFrames(dockPanelWin, 'dock-expanded');
}

// La página saca el panel deslizándolo hacia el borde y avisa ('dock-panel-salido');
// entonces se esconde la ventana. Si vuelve a abrirse a medio camino, no se esconde.
function collapseDockPanel() {
  dockExpanded = false; dockOutsideSince = 0;
  if (dockWin && !dockWin.isDestroyed()) { try { dockWin.webContents.send('dock-collapse'); } catch {} }
  if (!dockPanelWin || dockPanelWin.isDestroyed() || !dockPanelWin.isVisible()) { hideDockHide(); return; }
  hideDockHide();
  const token = (dockPanelWin.__salida = (dockPanelWin.__salida || 0) + 1);
  const esconder = () => {
    if (!dockPanelWin || dockPanelWin.isDestroyed() || dockPanelWin.__salida !== token || dockExpanded) return;
    dockPanelWin.__alSalir = null;
    // 2.8.5: antes de esconderla se recorta a nada. Windows enseña el último fotograma de una
    // ventana al volver a mostrarla, y si se escondió con la tarjeta aún a medio salir, al
    // abrir otra vez asomaba un instante (el "aparece y parpadea"). La página la destapa en
    // cuanto ha pintado la tarjeta fuera (entrar() en dock-panel.html).
    try { dockPanelWin.setShape([{ x: 0, y: 0, width: 1, height: 1 }]); } catch {}
    dockPanelWin.__forma = null; dockPanelWin.__rectForma = null;
    try { dockPanelWin.hide(); } catch {}
    ensureDockBarVisible();   // al cerrarse el panel, la barrita tiene que estar ahí
  };
  dockPanelWin.__alSalir = esconder;
  try { dockPanelWin.webContents.send('panel-salir'); } catch {}
  setTimeout(esconder, 420);   // por si la página no llega a avisar
}

// Empuja la config visual al renderer del dock (al crearlo y al cambiar Ajustes).
function sendDockConfig() {
  const cfg = dockConfig();
  [dockWin, dockPanelWin].forEach(w => {
    if (!w || w.isDestroyed()) return;
    const send = () => { try { w.webContents.send('dock-config', cfg); } catch {} };
    if (w.webContents.isLoading()) w.webContents.once('did-finish-load', send);
    else send();
  });
  ajustarVentanaPanel();   // por si cambió de pantalla
}

// Decide si el dock captura el ratón o deja pasar los clics al escritorio, mirando dónde
// está el cursor de verdad. Se hace desde el proceso principal (y no con mousemove en la
// página) porque el ratón sobre un iframe NO genera eventos en el documento que lo
// contiene: al entrar directo sobre el calendario, la ventana se quedaba en modo "dejar
// pasar los clics" y no se podía pulsar nada.
function setDockIgnore(ignore) {
  if (ignore === dockIgnoring) return;
  dockIgnoring = ignore;
  if (dockWin && !dockWin.isDestroyed()) {
    try { dockWin.setIgnoreMouseEvents(ignore); } catch {}
  }
}

// Segunda protección del panel: su ventana cubre toda el área de trabajo y lo único que
// dejaba pasar los clics a lo de detrás era el recorte (setShape). Si ese recorte no llega a
// aplicarse en algún equipo, la ventana invisible se tragaba todos los clics con el panel
// abierto. Aquí, además, la ventana solo pide el ratón mientras el cursor está sobre la zona
// visible (la tarjeta; la ventana entera mientras se redimensiona a mano).
function protegerClicsPanel(p) {
  const w = dockPanelWin;
  if (!w || w.isDestroyed() || !w.isVisible()) return;
  const r = w.__rectForma === null ? null : (w.__rectForma || dockPanelRect || computePanelBounds(dockPanelView));
  const dentro = !!r && p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
  if (w.__ignora === !dentro) return;
  w.__ignora = !dentro;
  try { w.setIgnoreMouseEvents(!dentro); } catch {}
}

let ultimoPuntoDock = null;
function updateDockHitTest() {
  if (!dockWin || dockWin.isDestroyed()) return;
  // 2.14: con la barra escondida no hay nada que mirar.
  if (!dockExpanded && dockIsHidden()) { setDockIgnore(true); return; }
  let p, b;
  try { p = screen.getCursorScreenPoint(); b = dockWin.getBounds(); } catch { return; }
  // 2.14: con el panel cerrado y el ratón quieto, nada cambia: no se recalcula.
  const clave = p.x + ',' + p.y + ',' + b.x + ',' + b.y + ',' + dockHitRects.length;
  if (!dockExpanded && clave === ultimoPuntoDock) return;
  ultimoPuntoDock = clave;
  protegerClicsPanel(p);
  const x = p.x - b.x, y = p.y - b.y;
  const inside = dockHitRects.some(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  setDockIgnore(!inside);

  // Revelado de la barrita al acercarse: se calcula aquí porque la ventana ya no recibe
  // los movimientos del ratón (ese reenvío era lo que hacía parpadear el cursor).
  const radio = Math.max(10, Math.min(200, Number(settings.dockNearDistance) || 45));
  const near = !dockExpanded && !!dockBarRect &&
    Math.hypot(Math.max(dockBarRect.x - x, 0, x - (dockBarRect.x + dockBarRect.w)),
               Math.max(dockBarRect.y - y, 0, y - (dockBarRect.y + dockBarRect.h))) < radio;
  if (near !== dockBarNear) {
    dockBarNear = near;
    try { dockWin.webContents.send('dock-bar-near', near); } catch {}
  }

  // Auto-esconder cuando el cursor lleva un rato fuera del panel abierto. El panel es
  // ahora otra ventana, así que "dentro" incluye también sus límites (si no, contaría
  // como fuera en cuanto el ratón entrase en el propio panel).
  if (dockExpanded && settings.dockCloseMode === 'mouseLeave') {
    let overPanel = false;
    if (dockPanelWin && !dockPanelWin.isDestroyed() && dockPanelWin.isVisible()) {
      const pb = dockPanelRect || computePanelBounds(dockPanelView);
      overPanel = p.x >= pb.x && p.x <= pb.x + pb.width && p.y >= pb.y && p.y <= pb.y + pb.height;
    }
    if (inside || overPanel) dockOutsideSince = 0;
    else {
      const now = Date.now();
      if (!dockOutsideSince) dockOutsideSince = now;
      else if (now - dockOutsideSince >= (Number.isFinite(Number(settings.dockCloseSeconds)) ? Number(settings.dockCloseSeconds) : 3) * 1000) {
        dockOutsideSince = 0;
        collapseDockPanel();
      }
    }
  } else {
    dockOutsideSince = 0;
  }
}

function createDock() {
  if (dockWin && !dockWin.isDestroyed()) return;
  dockWin = new BrowserWindow({
    ...computeDockBounds(),
    frame: false, transparent: true, hasShadow: false, backgroundColor: '#00000000',
    resizable: false, movable: false, skipTaskbar: true, alwaysOnTop: true,
    roundedCorners: false, focusable: true,
    icon: WINDOW_ICON_PATH,
    webPreferences: { nodeIntegration: true, contextIsolation: false, nodeIntegrationInSubFrames: true , backgroundThrottling: false},
  });
  dockExpanded = false;
  // Sin acrílico ni insertCSS de --bg: la ventana es transparente de verdad; el panel del
  // dock pinta su propio fondo. Arranca dejando pasar los clics (solo la barra captura).
  dockHitRects = []; dockIgnoring = null;
  setDockIgnore(true);
  if (dockHitTimer) clearInterval(dockHitTimer);
  dockHitTimer = setInterval(updateDockHitTest, 60);
  // 'screen-saver' es el nivel que queda por encima de las aplicaciones a pantalla
  // completa. Con el alwaysOnTop normal, un juego o un vídeo maximizado se ponía
  // delante y la barra desaparecía. La ventana es click-through salvo en la barra,
  // así que estar tan arriba no molesta a nada.
  try { dockWin.setAlwaysOnTop(true, 'screen-saver'); } catch {}
  dockWin.loadFile(path.join(__dirname, 'src', 'dock.html'));
  sendDockConfig();
  // 2.8.5: el panel se prepara escondido poco después de arrancar (sus vistas y su cristal
  // tardan ~medio segundo la primera vez): así el primer clic en la barrita ya abre al momento.
  setTimeout(() => { if (settings.dockMode && dockWin && !dockWin.isDestroyed()) createDockPanel(); }, 2500);
  dockWin.once('ready-to-show', () => { if (dockWin && !dockWin.isDestroyed()) dockWin.showInactive(); });
  // El clic fuera se detecta en la ventana del PANEL (ver createDockPanel): esta ventana
  // es la de la barrita y no tiene foco propio.
  dockWin.on('closed', () => {
    if (dockHitTimer) { clearInterval(dockHitTimer); dockHitTimer = null; }
    dockWin = null; dockExpanded = false; dockHitRects = []; dockIgnoring = null;
  });

  // Red de seguridad: la ventana cubre toda el área de trabajo, y quien decide si los
  // clics pasan al escritorio es el renderer. Si el renderer se cuelga o se muere, esa
  // decisión deja de actualizarse, así que forzamos click-through (y si ha muerto del
  // todo, salimos del modo dock) para no dejar la pantalla bloqueada.
  dockWin.webContents.on('unresponsive', () => { setDockIgnore(true); });
  // 2.14.3: al volver en sí, que se recalcule todo en el siguiente tic. Antes el bloqueo de
  // arriba no apuntaba que la ventana ignoraba el ratón, y si el cursor seguía sobre el botón
  // de esconder, ese botón no respondía hasta sacar el ratón y volver a entrar.
  dockWin.webContents.on('responsive', () => { dockIgnoring = null; ultimoPuntoDock = null; });
  dockWin.webContents.on('render-process-gone', () => {
    // Si la app se está cerrando (o el instalador la está cerrando a la fuerza para actualizar),
    // el proceso de la barra muere antes que el principal: eso no es un fallo, y no hay que
    // quitar el modo barra ni guardarlo así.
    if (saliendo) return;
    destroyDock();
    // 2.13: antes se apagaba el modo barra y se guardaba así para siempre por una sola caída.
    // Ahora se vuelve a crear; solo si se cae 3 veces en un minuto se pasa a ventanas, y sin
    // guardarlo (al volver a abrir la app, vuelve la barra).
    const ahora = Date.now();
    caidasDock = caidasDock.filter(t => ahora - t < 60000); caidasDock.push(ahora);
    if (caidasDock.length < 3) { setTimeout(() => { if (!saliendo && settings.dockMode) { createDock(); positionDock(); } }, 800); return; }
    settings.dockMode = false; updateTrayTitle();
    openMain();
  });
}

let caidasDock = [];
function destroyDock() {
  if (dockPanelWin && !dockPanelWin.isDestroyed()) dockPanelWin.close();
  dockPanelWin = null;
  if (dockHitTimer) { clearInterval(dockHitTimer); dockHitTimer = null; }
  if (dockWin && !dockWin.isDestroyed()) dockWin.close();
  dockWin = null; dockExpanded = false; dockHitRects = []; dockIgnoring = null;
}

// Reposiciona el dock y le reenvía la config (pantalla, lado, grosor, color...).
function positionDock() {
  if (!dockWin || dockWin.isDestroyed()) return;
  try { dockWin.setBounds(computeDockBounds()); } catch {}
  sendDockConfig();
}

// Recuerda por dónde andaba el usuario para volver a abrir ahí (ver openLastView).
// Ajustes no cuenta: no es una "pestaña" a la que tenga sentido volver al arrancar.
function rememberView(view) {
  if (view !== 'panel' && view !== 'calendar') return;   // Guardadas/Ajustes no se recuerdan
  if (settings.lastView === view) return;
  settings.lastView = view;
  saveSettingsSoon();
}

// Abre la app por donde se quedó la última vez (panel, calendario o guardadas).
function openLastView() {
  const v = settings.lastView;   // se lee ANTES: openMain() lo sobrescribe con 'panel'
  if (settings.dockMode) { dockNavigate(v && v !== 'settings' ? v : 'panel'); return; }
  // En modo ventanas el panel se abre SIEMPRE: es el único sitio con los botones para
  // navegar. Si no, al recordar "Guardadas" o "Calendario" se abría solo esa ventana y no
  // había forma de volver (y al cerrarla no quedaba nada visible: parecía que la app se
  // rompía). La vista recordada se abre encima del panel.
  openMain();
  if (v === 'calendar') openCalendar();
}

// Evita quedarse sin ninguna ventana a la vista al cerrar el calendario o Guardadas.
function ensureSomeWindowVisible() {
  if (settings.dockMode) return;
  const anyVisible = [mainWin, calendarWin, groupsWin]
    .some(w => w && !w.isDestroyed() && w.isVisible());
  if (!anyVisible) openMain();
}

// Enseña una vista dentro del dock (en vez de abrir una ventana suelta).
function dockNavigate(view) {
  rememberView(view);
  if (!dockWin || dockWin.isDestroyed()) createDock();
  dockPanelView = view;
  showDockPanel();
  const send = () => { try { dockPanelWin.webContents.send('dock-navigate', view); } catch {} };
  if (dockPanelWin.webContents.isLoading()) dockPanelWin.webContents.once('did-finish-load', send);
  else send();
  if (dockWin && !dockWin.isDestroyed()) { try { dockWin.webContents.send('dock-expand'); } catch {} }
}

// Aplica el modo dock al cambiarlo en Ajustes (o al arrancar). wasDock = estado anterior.
function applyDockMode(wasDock) {
  if (settings.dockMode) {
    // Al entrar en modo dock, escondemos las ventanas sueltas y creamos la barra.
    [mainWin, calendarWin, groupsWin, notasWin, settingsWin].forEach(w => { try { if (w && !w.isDestroyed()) w.hide(); } catch {} });   // escondidas (no cerradas) para que, al salir del dock, vuelvan con su tamaño y sitio; con el frenado por defecto no pintan
    createDock();
    if (!wasDock) dockNavigate('panel');
    else positionDock();   // reajusta a la pantalla elegida
  } else if (wasDock) {
    destroyDock();
    openMain();
  }
}

function openMain() {
  if (settings.dockMode) { dockNavigate('panel'); return; }
  rememberView('panel');
  if (mainWin && !mainWin.isDestroyed()) { mainWin.show(); mainWin.focus(); sendStateToWindow(mainWin); return; }
  mainWin = makeWindow('main.html', 560, 660, {
    minWidth: 380, minHeight: 480,
    maxWidth: 900, maxHeight: 1000,
  });
  mainWin.once('ready-to-show', () => { mainWin.show(); sendStateToWindow(mainWin); });
  mainWin.on('closed', () => { mainWin = null; });
}

function createSplash() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const S = 300;
  splashWin = new BrowserWindow({
    width: S, height: S,
    x: Math.round((width - S) / 2), y: Math.round((height - S) / 2),
    frame: false, transparent: true, hasShadow: false, backgroundColor: '#00000000',
    resizable: false, movable: false, alwaysOnTop: true, skipTaskbar: true,
    show: false,
    icon: WINDOW_ICON_PATH,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  splashWin.loadFile(path.join(__dirname, 'src', 'splash.html'));
  splashWin.once('ready-to-show', () => splashWin.show());
  return splashWin;
}

function showSplashThenMain() {
  const splash = createSplash();
  let closed = false;
  const closeSplash = () => {
    if (closed) return; closed = true;
    if (!splash || splash.isDestroyed()) return;
    try { splash.webContents.send('leave'); } catch {}
    setTimeout(() => { if (splash && !splash.isDestroyed()) splash.close(); }, 340);
  };
  setTimeout(() => {
    openLastView();
    const first = mainWin || calendarWin || groupsWin;
    if (first && !first.isDestroyed()) first.once('show', closeSplash);
    else closeSplash();
    // Cierre de seguridad: pase lo que pase (si 'show' no llega, la ventana tarda,
    // etc.) el splash nunca se queda enganchado.
    setTimeout(closeSplash, 2500);
  }, 3500);
}

function openCalendar() {
  if (settings.dockMode) { dockNavigate('calendar'); return; }
  rememberView('calendar');
  if (calendarWin && !calendarWin.isDestroyed()) { calendarWin.show(); calendarWin.focus(); sendStateToWindow(calendarWin); return; }
  calendarWin = makeWindow('calendar.html', 1280, 760, {
    minWidth: 760, minHeight: 520,
    maxWidth: 1600, maxHeight: 1000,
  });
  calendarWin.once('ready-to-show', () => { calendarWin.show(); sendStateToWindow(calendarWin); });
  calendarWin.on('closed', () => { calendarWin = null; });
}

function openSettings() {
  if (settings.dockMode) { dockNavigate('settings'); return; }
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.show(); settingsWin.focus(); return; }
  settingsWin = makeWindow('settings.html', 430, 720, {
    minWidth: 380, minHeight: 420,
    maxWidth: 560, maxHeight: 900,
  });
  settingsWin.once('ready-to-show', () => { settingsWin.show(); settingsWin.webContents.send('settings', { ...settings, appVersion: app.getVersion(), isStore: IS_STORE, versionNueva }); });
  settingsWin.on('closed', () => { settingsWin = null; });
}

function openGroups() {
  if (settings.dockMode) { dockNavigate('groups'); return; }
  rememberView('groups');
  if (groupsWin && !groupsWin.isDestroyed()) { groupsWin.show(); groupsWin.focus(); sendStateToWindow(groupsWin); return; }
  groupsWin = makeWindow('groups.html', 420, 620, {
    minWidth: 340, minHeight: 420,
    maxWidth: 700, maxHeight: 1000,
  });
  groupsWin.once('ready-to-show', () => { groupsWin.show(); sendStateToWindow(groupsWin); });
  groupsWin.on('closed', () => { groupsWin = null; });
}

// 2.16: Notas, como Tareas: en la barra flotante es una pestaña más; si no, su propia ventana.
function openNotas() {
  if (settings.dockMode) { dockNavigate('notas'); return; }
  if (notasWin && !notasWin.isDestroyed()) { notasWin.show(); notasWin.focus(); sendStateToWindow(notasWin); return; }
  notasWin = makeWindow('notas.html', 980, 760, { minWidth: 360, minHeight: 420, maxWidth: 2400, maxHeight: 1600 });
  notasWin.once('ready-to-show', () => { notasWin.show(); sendStateToWindow(notasWin); });
  notasWin.on('closed', () => { notasWin = null; });
}

// ── Notas y caja fuerte (2.16) ────────────────────────────────────────────────────
// Notas: notas sueltas en un mapa (cada una con su sitio x, y; se colocan arrastrando). Cada nota
// tiene propiedades: urgencia (baja / media / alta), sección propia de notas, color y recordatorio
// con fecha y hora (aviso de Windows). (Al principio iban en carriles; Álvaro prefirió el mapa.)
// Viven en state.notas y state.seccionesNotas: se guardan, se deshacen con Ctrl+Z y viajan con
// la sincronización y las copias como las tareas.
const URGENCIAS_NOTAS = ['', 'baja', 'media', 'alta'];
const numMapa = (v) => Math.max(-20000, Math.min(20000, Math.round(Number(v) || 0)));
// 2.16: la caja fuerte es otra pizarra igual. Mientras está abierta, sus notas viven descifradas
// solo en memoria (cajaNotasMem); las acciones que llegan marcadas con «caja» trabajan sobre ellas
// (usandoCaja) y al guardar se vuelven a cifrar. Cerrada, no queda nada en claro.
let cajaNotasMem = null, usandoCaja = false;
function notas() {
  if (usandoCaja) return cajaNotasMem;
  if (!Array.isArray(state.notas)) state.notas = [];
  return state.notas;
}
function ponerNotas(l) { if (usandoCaja) cajaNotasMem = l; else state.notas = l; }
function seccionesNotas() { if (!Array.isArray(state.seccionesNotas)) state.seccionesNotas = []; return state.seccionesNotas; }
function limpiarNota(n, base) {
  const r = { ...(base || {}) };
  if (n.texto !== undefined) r.texto = String(n.texto || '').slice(0, 4000);
  if (n.urgencia !== undefined) r.urgencia = URGENCIAS_NOTAS.includes(n.urgencia) ? n.urgencia : '';
  if (n.x !== undefined) r.x = numMapa(n.x);
  if (n.y !== undefined) r.y = numMapa(n.y);
  // 2.16: las secciones de las notas son las de Tareas (pedido por Álvaro).
  if (n.seccion !== undefined) r.seccion = n.seccion && (state.groups || []).some(g => g.id === n.seccion) ? n.seccion : null;
  if (n.color !== undefined) r.color = /^#[0-9a-fA-F]{6}$/.test(String(n.color || '')) ? n.color : null;
  if (n.recordatorio !== undefined) {
    const t = Number(n.recordatorio) || null;
    if (t !== r.recordatorio) r.avisada = false;   // fecha nueva: vuelve a avisar
    r.recordatorio = t;
  }
  if (n.hecha !== undefined) { r.hecha = !!n.hecha; r.hechaEn = r.hecha ? (r.hechaEn || Date.now()) : null; }
  if (n.vence !== undefined) r.vence = Number(n.vence) || null;   // vencimiento: un día (su medianoche)
  if (n.fijada !== undefined) r.fijada = !!n.fijada;              // fijada: siempre encima de las demás
  if (n.desplegada !== undefined) r.desplegada = !!n.desplegada;  // las largas se ven plegadas salvo que se desplieguen
  if (n.archivo !== undefined) r.archivo = usandoCaja ? null : archivoLimpio(n.archivo);   // en la caja no hay archivos (no van cifrados)
  if (n.adjuntos !== undefined) r.adjuntos = usandoCaja || !Array.isArray(n.adjuntos) ? [] : n.adjuntos.map(archivoLimpio).filter(Boolean).slice(0, 30);   // los demás archivos
  if (n.celda !== undefined) r.celda = n.celda && Number.isFinite(Number(n.celda.c)) && Number.isFinite(Number(n.celda.f)) ? { c: Math.max(0, Math.min(500, Math.round(n.celda.c))), f: Math.max(0, Math.min(2000, Math.round(n.celda.f))) } : null;   // cuadrícula libre
  if (n.orden !== undefined) r.orden = Number.isFinite(Number(n.orden)) ? Number(n.orden) : null;   // orden en las vistas ordenadas
  return r;
}
function archivoLimpio(a) {
  if (!a || typeof a !== 'object' || !a.fichero) return null;
  return {
    fichero: path.basename(String(a.fichero)).slice(0, 200),   // nombre dentro de la carpeta de archivos
    nombre: String(a.nombre || a.fichero).slice(0, 200),
    tamano: Number(a.tamano) || 0,
    ext: String(a.ext || '').toLowerCase().slice(0, 12),
    miniatura: /^data:image\/(png|jpeg);base64,/.test(String(a.miniatura || '')) && String(a.miniatura).length < 400000 ? a.miniatura : null,
    icono: !!a.icono,
  };
}
function crearNota(p) {
  if (!p || (!String(p.texto || '').trim() && !(p.archivo && p.archivo.fichero))) return null;
  const lista = notas();
  const n = limpiarNota({ urgencia: '', seccion: null, color: null, recordatorio: null, hecha: false, x: 0, y: 0, ...p },
    { id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), creada: Date.now(), avisada: false });
  n.texto = n.texto.trim();
  lista.push(n);   // la nueva, encima de las demás (el orden de la lista es el de apilado)
  saveData(); broadcastState();
  return n.id;
}
function editarNota(p) {
  const lista = notas();
  const i = lista.findIndex(x => x.id === (p && p.id));
  if (i < 0) return;
  lista[i] = limpiarNota(p, lista[i]);
  saveData(); broadcastState();
}
function borrarNota(id) {
  const lista = notas();
  const i = lista.findIndex(x => x.id === id);
  if (i < 0) return;
  lista.splice(i, 1);
  saveData(); broadcastState();
}
// Arrastrar en el mapa: la nota va a su sitio nuevo y queda encima de las demás.
function moverNota(p) {
  const lista = notas();
  const i = lista.findIndex(x => x.id === (p && p.id));
  if (i < 0) return;
  const [n] = lista.splice(i, 1);
  n.x = numMapa(p.x); n.y = numMapa(p.y);
  lista.push(n);
  saveData(); broadcastState();
}
function duplicarNota(id) {
  const lista = notas();
  const o = lista.find(x => x.id === id);
  if (!o) return;
  const n = { ...o, id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), creada: Date.now(), x: (o.x || 0) + 28, y: (o.y || 0) + 28, avisada: false, hecha: false, hechaEn: null };
  lista.push(n);
  saveData(); broadcastState();
}
// 2.16: varias a la vez (seleccionadas): mover, borrar y pegar en un solo paso.
function moverNotas(lista) {
  const ns = notas();
  (Array.isArray(lista) ? lista : []).forEach(p => {
    const i = ns.findIndex(x => x.id === (p && p.id));
    if (i < 0) return;
    const [n] = ns.splice(i, 1);
    n.x = numMapa(p.x); n.y = numMapa(p.y);
    ns.push(n);
  });
  saveData(); broadcastState();
}
// Varias notas con cambios (orden y, al soltar en otra columna, su sección, urgencia o fecha).
function editarNotas(lista) {
  const ns = notas();
  (Array.isArray(lista) ? lista : []).forEach(p => {
    const i = ns.findIndex(x => x.id === (p && p.id));
    if (i >= 0) ns[i] = limpiarNota(p, ns[i]);
  });
  saveData(); broadcastState();
}
function borrarNotas(ids) {
  const fuera = new Set(Array.isArray(ids) ? ids : []);
  ponerNotas(notas().filter(n => !fuera.has(n.id)));
  saveData(); broadcastState();
}
function pegarNotas(lista) {
  const ns = notas();
  (Array.isArray(lista) ? lista : []).slice(0, 200).forEach((p, k) => {
    if (!p || (!String(p.texto || '').trim() && !(p.archivo && p.archivo.fichero))) return;
    const n = limpiarNota({ urgencia: '', seccion: null, color: null, recordatorio: null, hecha: false, x: 0, y: 0, ...p },
      { id: 'n' + Date.now().toString(36) + k + Math.random().toString(36).slice(2, 5), creada: Date.now(), avisada: false });
    n.texto = n.texto.trim();
    ns.push(n);
  });
  saveData(); broadcastState();
}
function vaciarHechas() {
  ponerNotas(notas().filter(n => !n.hecha));
  saveData(); broadcastState();
}
function crearSeccionNotas(p) {
  const name = String((p && p.name) || '').trim().slice(0, 40);
  if (!name) return;
  const color = /^#[0-9a-fA-F]{6}$/.test(String(p.color || '')) ? p.color : TASK_COLORS[seccionesNotas().length % TASK_COLORS.length];
  seccionesNotas().push({ id: 's' + Date.now().toString(36), name, color });
  saveData(); broadcastState();
}
function editarSeccionNotas(p) {
  const s = seccionesNotas().find(x => x.id === (p && p.id));
  if (!s) return;
  if (p.name !== undefined && String(p.name).trim()) s.name = String(p.name).trim().slice(0, 40);
  if (p.color !== undefined && /^#[0-9a-fA-F]{6}$/.test(String(p.color))) s.color = p.color;
  saveData(); broadcastState();
}
function borrarSeccionNotas(id) {
  state.seccionesNotas = seccionesNotas().filter(s => s.id !== id);
  notas().forEach(n => { if (n.seccion === id) n.seccion = null; });   // sus notas se quedan, sin sección
  saveData(); broadcastState();
}

// ── Archivos en las notas (2.16) ──────────────────────────────────────────────
// Se copian a «notas-archivos» en la carpeta de datos. La miniatura va en la propia nota (así se
// ve también en otro PC por la nube); el archivo en sí se queda en este PC.
const carpetaArchivosNotas = () => path.join(app.getPath('userData'), 'notas-archivos');
const MAX_ARCHIVO = 300 * 1024 * 1024;
async function miniaturaDe(ruta) {
  try {
    const img = await nativeImage.createThumbnailFromPath(ruta, { width: 480, height: 480 });
    if (img && !img.isEmpty()) { const s = img.getSize(); const r = s.width > 360 ? img.resize({ width: 360 }) : img; return { miniatura: 'data:image/jpeg;base64,' + r.toJPEG(78).toString('base64'), icono: false }; }
  } catch {}
  try { const ic = await app.getFileIcon(ruta, { size: 'large' }); if (ic && !ic.isEmpty()) return { miniatura: ic.toDataURL(), icono: true }; } catch {}
  return { miniatura: null, icono: true };
}
const archivosDe = (n) => n ? [n.archivo, ...(Array.isArray(n.adjuntos) ? n.adjuntos : [])].filter(a => a && a.fichero) : [];
function rutaArchivoNota(id, fichero) {
  const n = notas().find(x => x.id === id);
  const a = archivosDe(n).find(x => !fichero || x.fichero === fichero);
  if (!a) return null;
  const r = path.join(carpetaArchivosNotas(), a.fichero);
  return fs.existsSync(r) ? r : null;
}
// Copia un archivo a la carpeta de las notas y devuelve su ficha (o el motivo si no vale).
async function copiarArchivoNota(ruta) {
  let st; try { st = fs.statSync(ruta); } catch { return { aviso: path.basename(ruta) + ' (no se encuentra)' }; }
  if (!st.isFile()) return { aviso: path.basename(ruta) + ' (es una carpeta)' };
  if (st.size > MAX_ARCHIVO) return { aviso: path.basename(ruta) + ' (más de 300 MB)' };
  fs.mkdirSync(carpetaArchivosNotas(), { recursive: true });
  const nombre = path.basename(ruta);
  const fichero = Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '-' + nombre.replace(/[^\w.\- ]+/g, '_');
  await fs.promises.copyFile(ruta, path.join(carpetaArchivosNotas(), fichero));
  const mini = await miniaturaDe(ruta);
  return { archivo: archivoLimpio({ fichero, nombre, tamano: st.size, ext: path.extname(nombre).slice(1), ...mini }) };
}
ipcMain.handle('notas-archivos', async (_e, p) => {
  const accion = p && p.accion;
  try {
    // Un archivo para una nota (la ventana de la nota): de una ruta (soltado) o eligiéndolo.
    if (accion === 'preparar') {
      let rutas = Array.isArray(p.rutas) ? p.rutas : [];
      if (!rutas.length) {
        const parent = notasWin && !notasWin.isDestroyed() && notasWin.isVisible() ? notasWin : (dockPanelWin || undefined);
        const r = await dialog.showOpenDialog(parent, { title: 'Adjuntar archivos a la nota', properties: ['openFile', 'multiSelections'] });
        if (r.canceled || !r.filePaths.length) return { ok: false };
        rutas = r.filePaths;
      }
      const lista = [], avisos = [];
      for (const ruta of rutas.slice(0, 20)) { const c = await copiarArchivoNota(String(ruta)); if (c.aviso) avisos.push(c.aviso); else lista.push(c.archivo); }
      return { ok: true, archivos: lista, avisos };
    }
    // Soltar un archivo encima de una nota: se le adjunta (se queda con su texto).
    if (accion === 'adjuntar') {
      const n = notas().find(x => x.id === p.id);
      if (!n) return { error: 'No encuentro la nota' };
      const nuevos = [], avisos = [];
      for (const ruta of (Array.isArray(p.rutas) ? p.rutas : [p.ruta]).filter(Boolean).slice(0, 20)) { const c = await copiarArchivoNota(String(ruta)); if (c.aviso) avisos.push(c.aviso); else nuevos.push(c.archivo); }
      if (!nuevos.length) return { error: avisos.join(', ') || 'No se ha podido adjuntar' };
      fotoAntesDe('nota-editar');
      const todos = archivosDe(n).concat(nuevos);
      n.archivo = todos[0]; n.adjuntos = todos.slice(1, 31);
      saveData(); broadcastState();
      return { ok: true, adjuntados: nuevos.length, avisos };
    }
    if (accion === 'soltar') {
      const rutas = (Array.isArray(p.rutas) ? p.rutas : []).slice(0, 20);
      fs.mkdirSync(carpetaArchivosNotas(), { recursive: true });
      const avisos = [];
      fotoAntesDe('nota-crear');
      let k = 0;
      for (const ruta of rutas) {
        let st; try { st = fs.statSync(ruta); } catch { continue; }
        if (!st.isFile()) { avisos.push(path.basename(ruta) + ' (es una carpeta)'); continue; }
        if (st.size > MAX_ARCHIVO) { avisos.push(path.basename(ruta) + ' (más de 300 MB)'); continue; }
        const nombre = path.basename(ruta);
        const fichero = Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '-' + nombre.replace(/[^\w.\- ]+/g, '_');
        await fs.promises.copyFile(ruta, path.join(carpetaArchivosNotas(), fichero));
        const mini = await miniaturaDe(ruta);
        const n = limpiarNota({ texto: '', urgencia: '', seccion: p.seccion || null, color: null, recordatorio: null, hecha: false, x: (Number(p.x) || 0) + k * 32, y: (Number(p.y) || 0) + k * 32,
          archivo: { fichero, nombre, tamano: st.size, ext: path.extname(nombre).slice(1), ...mini } },
          { id: 'n' + Date.now().toString(36) + k + Math.random().toString(36).slice(2, 5), creada: Date.now(), avisada: false });
        n.texto = '';
        notas().push(n);
        k++;
      }
      saveData(); broadcastState();
      return { ok: true, creadas: k, avisos };
    }
    const ruta = rutaArchivoNota(p && p.id, p && p.fichero);
    if (accion === 'ruta') return { ruta };
    if (!ruta) return { error: 'El archivo no está en este PC (quizá se añadió en otro).' };
    if (accion === 'abrir') { const err = await require('electron').shell.openPath(ruta); return err ? { error: err } : { ok: true }; }
    if (accion === 'carpeta') { require('electron').shell.showItemInFolder(ruta); return { ok: true }; }
    if (accion === 'texto') {   // los de texto se ven dentro (hasta 1 MB)
      const st = fs.statSync(ruta); if (st.size > 1024 * 1024) return { error: 'Demasiado grande para verlo aquí' };
      return { texto: fs.readFileSync(ruta, 'utf8') };
    }
    if (accion === 'guardar') {
      const n = notas().find(x => x.id === p.id);
      const parent = settingsWin && !settingsWin.isDestroyed() && settingsWin.isFocused() ? settingsWin : (notasWin && !notasWin.isDestroyed() ? notasWin : dockPanelWin || undefined);
      const a = archivosDe(n).find(x => !p.fichero || x.fichero === p.fichero);
      const { canceled, filePath } = await dialog.showSaveDialog(parent, { title: 'Guardar una copia', defaultPath: path.join(app.getPath('downloads'), a.nombre) });
      if (canceled || !filePath) return { ok: false };
      await fs.promises.copyFile(ruta, filePath);
      return { ok: true, ruta: filePath };
    }
  } catch (err) { return { error: String((err && err.message) || err) }; }
  return { error: 'Acción desconocida' };
});
// Al arrancar, fuera los archivos que ya no están en ninguna nota (borradas hace tiempo).
function limpiarArchivosNotas() {
  try {
    const usados = new Set(notas().flatMap(n => archivosDe(n).map(a => a.fichero)));
    const dir = carpetaArchivosNotas();
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => { if (!usados.has(f)) { try { fs.unlinkSync(path.join(dir, f)); } catch {} } });
  } catch {}
}

// Recordatorios: cada 20 s. Si estás en «No molestar» o en una llamada, espera a que acabe.
function vigilarRecordatoriosNotas() {
  try { vigilarAvisosCalendario(); } catch {}   // 2.17: los del calendario, con el mismo vigilante
  const ahora = Date.now();
  const toca = notas().filter(n => !n.hecha && n.recordatorio && n.recordatorio <= ahora && !n.avisada);
  if (!toca.length || silenciado()) return;
  toca.forEach(n => {
    n.avisada = true;
    const sec = (state.groups || []).find(g => g.id === n.seccion);
    const pal = sec && todasLasPaletas()[sec.palette];
    avisar({ id: n.id, texto: n.texto, archivo: n.archivo ? n.archivo.nombre : null, cuando: n.recordatorio, color: n.color || (pal && pal.colors && pal.colors[0]) || null,
      clic: 'abrir', programado: true,   // un clic en el aviso abre la nota; se queda hasta que hagas algo
      acciones: [{ a: 'hecha', label: 'Hecha' }, { a: 'posponer', label: '10 min', titulo: 'Recuérdamelo dentro de 10 minutos' }],
      al: {
        hecha: () => { if (!notas().some(x => x.id === n.id)) return; fotoAntesDe('nota-editar'); editarNota({ id: n.id, hecha: true }); },
        posponer: (p) => editarNota({ id: n.id, recordatorio: Date.now() + Math.max(1, Math.min(525600, Number(p && p.minutos) || 10)) * 60000 }),   // lo elegido con la rueda
        abrir: () => { openNotas(); setTimeout(() => { [notasWin, dockPanelWin].forEach(w => { try { if (w && !w.isDestroyed()) sendToAllFrames(w, 'abrir-nota', n.id); } catch {} }); }, 700); },
      } });
  });
  saveData(); broadcastState();
}

// ── Aviso de los recordatorios (2.16) ─────────────────────────────────────────────
// Una isla de cristal líquido pegada al borde de arriba, en el centro de la pantalla (src/aviso.html),
// en vez de la notificación de Windows. Si saltan varios a la vez van en cola, de uno en uno. No
// coge el foco (no te saca de lo que haces) y está por encima de todo, como la burbuja de la vista.
let avisoWin = null;
const colaAvisos = [];
// La ventana es más ancha que el aviso (70 px por lado) para la franja ancha con la que entra y sale.
const AVISO_W = 460 + 140, AVISO_H = 64, AVISO_ARRIBA = 0;   // pegada al borde de arriba (no asoma en otra pantalla de encima)
// En qué pantalla salen los avisos (Ajustes → General): la de la barra (por defecto), la que tiene
// el ratón, la principal o una concreta. Vale para todos: recordatorios, descanso de la vista y demás.
function pantallaAvisos(elegida) {
  const v = elegida || settings.avisosPantalla;
  const displays = screen.getAllDisplays();
  if (v === 'raton') return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  if (v === 'principal') return screen.getPrimaryDisplay();
  if (v && v !== 'barra') { const d = displays.find(x => String(x.id) === String(v)); if (d) return d; }
  return dockDisplay();
}
function avisoBounds(elegida, alto) {
  const work = pantallaAvisos(elegida).workArea;
  const k = widgetEscala();   // el tamaño de Ajustes → Avisos («Tamaño del recordatorio»)
  const h = Math.round((alto || AVISO_H) * k);
  // 2.17: con el estilo «Abajo», tarjeta en la esquina de abajo a la derecha (sin el margen ancho de la franja de la isla).
  if (settings.estiloAvisos === 'abajo') { const w = Math.round((460 + 32) * k); return { x: work.x + work.width - w - 4, y: work.y + work.height - h - 18, width: w, height: h + 10 }; }
  const W = Math.round(AVISO_W * k);
  return { x: work.x + Math.round((work.width - W) / 2), y: work.y - AVISO_ARRIBA, width: W, height: h };
}
// Cambia el tamaño de la isla que se está viendo (el deslizador de Ajustes, en vivo).
function ajustarTamanoAviso() {
  const a = colaAvisos[0]; if (!a || !avisoWin || avisoWin.isDestroyed()) return;
  try { avisoWin.setBounds(avisoBounds(a.pantalla, a.titulo && a.sub ? 82 : AVISO_H)); avisoWin.webContents.setZoomFactor(widgetEscala()); } catch {}
}
function crearAvisoWin() {
  if (avisoWin && !avisoWin.isDestroyed()) return avisoWin;
  avisoWin = new BrowserWindow({
    ...avisoBounds(),
    frame: false, transparent: true, hasShadow: false, backgroundColor: '#00000000', resizable: false, roundedCorners: false,
    skipTaskbar: true, alwaysOnTop: true, focusable: false, show: false, movable: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  try { avisoWin.setAlwaysOnTop(true, 'screen-saver'); } catch {}
  avisoWin.loadFile(path.join(__dirname, 'src', 'aviso.html'));
  avisoWin.on('closed', () => { avisoWin = null; });
  return avisoWin;
}
// a = { titulo, sub (o texto, el de una nota), que, icono, color, duracion, acciones: [{ a, label, … }],
//       al: { accion: función } }. Las funciones se quedan aquí; a la ventana va solo lo que se pinta.
function avisar(a) {
  colaAvisos.push(a);
  if (colaAvisos.length === 1) mostrarSiguienteAviso();
}
// 2.17: el recordatorio de la tarea en marcha, como aviso (Pausar / Cambiar; un clic abre el panel).
// Si ya hay uno de tarea a la vista no se repite; si estaba en cola, se cambia por el nuevo.
function avisarTarea(prueba) {
  const t = (state.tasks || []).find(x => x.id === state.activeTaskId);
  if (!t && !prueba) return;
  if (colaAvisos[0] && colaAvisos[0].tipo === 'tarea' && !prueba) return;
  for (let i = colaAvisos.length - 1; i > 0; i--) if (colaAvisos[i].tipo === 'tarea') colaAvisos.splice(i, 1);
  const sub = t && t.subtasks && state.activeSubId ? (t.subtasks.find(x => x.id === state.activeSubId) || {}).name : '';
  avisar({
    tipo: 'tarea', titulo: t ? t.name + (sub ? ' · ' + sub : '') : 'Tu tarea en marcha',
    sub: t ? 'En marcha' : 'Así te recuerda Cronota la tarea que tienes en marcha',
    // Lo que enseñaba la tarjeta de abajo; la isla lo hace correr segundo a segundo.
    tarea: t ? { segs: Math.floor(todaySecondsForTask(t)), hoy: Math.floor(totalTodaySeconds()), desde: Date.now(),
      clase: t.taskType === 'oneShot' ? 'Puntual' : 'Recurrente', memo: String(t.memo || '').trim().slice(0, 120) } : null,
    color: t ? t.color : null, clic: 'cambiar', duracion: 15000,   // informativo: se va solo
    acciones: [{ a: 'pausar', label: 'Pausar' }, { a: 'cambiar', label: 'Cambiar' }],
    al: { pausar: () => { if (t) { pauseActive(); } }, cambiar: () => openMain() },
  });
}
// 2.17: «Avisarme» en las citas del calendario (las tuyas y las de Outlook). Cada aviso guarda su
// cita (clave), el título, a qué hora empieza y cuántos minutos antes avisar.
function avisosCal() { if (!Array.isArray(state.avisosCalendario)) state.avisosCalendario = []; return state.avisosCalendario; }
function ponerAvisoCal(p) {
  if (!p || !p.clave) return;
  const inicio = Number(p.inicio) || 0, antes = Math.max(0, Math.min(10080, Number(p.antes) || 0));
  const lista = avisosCal().filter(a => a.clave !== p.clave);
  lista.push({ clave: String(p.clave).slice(0, 200), titulo: String(p.titulo || 'Cita').slice(0, 200), inicio, antes, cuando: inicio - antes * 60000, avisada: false,
    color: /^#[0-9a-fA-F]{6}$/.test(String(p.color || '')) ? p.color : null });
  state.avisosCalendario = lista;
  saveData(); broadcastState();
}
function quitarAvisoCal(clave) {
  state.avisosCalendario = avisosCal().filter(a => a.clave !== clave);
  saveData(); broadcastState();
}
function vigilarAvisosCalendario() {
  const ahora = Date.now();
  let cambio = false;
  // Los ya avisados de hace más de un día, fuera.
  const antes = avisosCal().length;
  state.avisosCalendario = avisosCal().filter(a => !(a.avisada && a.inicio < ahora - 86400000));
  if (state.avisosCalendario.length !== antes) cambio = true;
  const toca = avisosCal().filter(a => !a.avisada && a.cuando <= ahora);
  if (toca.length && !silenciado()) {
    toca.forEach(a => {
      a.avisada = true; cambio = true;
      const h = new Date(a.inicio), hora = String(h.getHours()).padStart(2, '0') + ':' + String(h.getMinutes()).padStart(2, '0');
      const falta = Math.round((a.inicio - Date.now()) / 60000);
      avisar({
        tipo: 'calendario', titulo: a.titulo, color: a.color, clic: 'abrir', programado: true,
        sub: falta > 1 ? `A las ${hora} · dentro de ${falta >= 60 ? Math.round(falta / 60) + ' h' : falta + ' min'}` : `A las ${hora} · ahora`,
        acciones: [{ a: 'hecha', label: 'Vale' }, { a: 'posponer', label: '10 min' }],
        al: {
          posponer: (p) => { const x = avisosCal().find(y => y.clave === a.clave); if (x) { x.cuando = Date.now() + Math.max(1, Number(p && p.minutos) || 10) * 60000; x.avisada = false; saveData(); broadcastState(); } },
          abrir: () => openCalendar(),
        },
      });
    });
  }
  if (cambio) { saveData(); broadcastState(); }
}
// Para los sitios que antes usaban la notificación de Windows.
function avisoSimple(titulo, sub, extra) { avisar({ que: 'Cronota', titulo, sub, icono: 'campana', duracion: 15000, acciones: [], ...(extra || {}) }); }
function mostrarSiguienteAviso() {
  const a = colaAvisos[0];
  if (!a) { try { if (avisoWin && !avisoWin.isDestroyed()) avisoWin.hide(); } catch {} return; }
  const win = crearAvisoWin();
  try { win.setBounds(avisoBounds(a.pantalla, a.titulo && a.sub ? 82 : AVISO_H)); } catch {}   // con una segunda línea, un poco más alto
  const lanzar = () => {
    if (!win || win.isDestroyed()) return;
    const { al, pantalla, ...visible } = a;
    visible.abajo = settings.estiloAvisos === 'abajo';
    try { win.webContents.setZoomFactor(widgetEscala()); win.showInactive(); win.webContents.send('aviso-mostrar', visible, colaAvisos.length - 1); } catch {}
  };
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', lanzar); else lanzar();
}
ipcMain.on('aviso-accion', (_e, p) => {
  const a = colaAvisos.shift();
  const fn = a && a.al && p && a.al[p.accion];
  if (fn) { try { fn(p); } catch {} }
  setTimeout(mostrarSiguienteAviso, colaAvisos.length ? 250 : 0);
});

// Caja fuerte: notas cifradas con AES-256-GCM. La clave sale del PIN o la contraseña con scrypt y
// solo vive en memoria mientras está abierta; en el disco (y en la nube y las copias) solo va el
// cifrado. Se cierra sola a los 5 minutos sin usarla, al bloquear Windows y al cerrar la app. Sin
// el PIN no hay forma de leerla: no hay cuenta ni servidor que lo recupere.
const nodeCrypto = require('crypto');
let cajaClave = null, cajaTemporizador = null, cajaFallos = 0, cajaEsperaHasta = 0;
const CAJA_MINUTOS = 5;
function cajaDerivar(secreto, sal) {
  return nodeCrypto.scryptSync(String(secreto), Buffer.from(sal, 'base64'), 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}
function cajaCifrar(clave, notasCaja) {
  const iv = nodeCrypto.randomBytes(12);
  const c = nodeCrypto.createCipheriv('aes-256-gcm', clave, iv);
  const datos = Buffer.concat([c.update(JSON.stringify(notasCaja || []), 'utf8'), c.final()]);
  return { iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), datos: datos.toString('base64') };
}
function cajaDescifrar(clave, caja) {
  const d = nodeCrypto.createDecipheriv('aes-256-gcm', clave, Buffer.from(caja.iv, 'base64'));
  d.setAuthTag(Buffer.from(caja.tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(caja.datos, 'base64')), d.final()]).toString('utf8'));
}
function cajaEstado() {
  const c = state.cajaFuerte;
  return { existe: !!(c && c.datos), tipo: c && c.tipo === 'clave' ? 'clave' : 'pin', abierta: !!cajaClave };
}
function cajaRearmar() {
  clearTimeout(cajaTemporizador);
  cajaTemporizador = setTimeout(() => cajaCerrar(), CAJA_MINUTOS * 60000);
}
function cajaCerrar() {
  clearTimeout(cajaTemporizador); cajaTemporizador = null;
  if (cajaClave) { try { cajaClave.fill(0); } catch {} }
  cajaClave = null;
  const habia = !!cajaNotasMem;
  cajaNotasMem = null; pilaCaja.length = 0; pilaCajaRehacer.length = 0;
  if (habia) { try { broadcastState(); } catch {} }
  [dockPanelWin, notasWin].forEach(w => sendToAllFrames(w, 'caja-cerrada'));
}
// Las de antes (título + texto) pasan a notas normales, colocadas en rejilla.
function migrarCaja(lista) {
  usandoCaja = true;
  try {
    return (Array.isArray(lista) ? lista : []).map((n, k) => {
      if (!n) return null;
      if (n.x !== undefined && n.urgencia !== undefined) return n;
      const texto = (n.titulo ? '# ' + n.titulo + (n.texto ? '\n' : '') : '') + (n.texto || '');
      return limpiarNota({ texto, urgencia: '', seccion: null, color: null, recordatorio: null, hecha: false, x: (k % 3) * 260, y: Math.floor(k / 3) * 190 },
        { id: String(n.id || ('c' + Date.now().toString(36) + k)).slice(0, 40), creada: Number(n.creada) || Date.now(), avisada: false });
    }).filter(n => n && String(n.texto || '').trim());
  } finally { usandoCaja = false; }
}
// Las acciones de notas que llegan con «caja»: sobre las de la caja, con su propio deshacer.
const ACCIONES_NOTA = new Set(['nota-crear', 'nota-editar', 'nota-borrar', 'nota-mover', 'nota-duplicar', 'notas-mover', 'notas-borrar', 'notas-editar', 'notas-pegar', 'notas-vaciar-hechas']);
function accionNota(type, payload) {
  switch (type) {
    case 'nota-crear': crearNota(payload); return;
    case 'nota-editar': editarNota(payload); return;
    case 'nota-borrar': borrarNota(payload && payload.id); return;
    case 'nota-mover': moverNota(payload); return;
    case 'nota-duplicar': duplicarNota(payload && payload.id); return;
    case 'notas-mover': moverNotas(payload && payload.lista); return;
    case 'notas-borrar': borrarNotas(payload && payload.ids); return;
    case 'notas-editar': editarNotas(payload && payload.lista); return;
    case 'notas-pegar': pegarNotas(payload && payload.lista); return;
    case 'notas-vaciar-hechas': vaciarHechas(); return;
  }
}
const pilaCaja = [], pilaCajaRehacer = [];
let ultimaFotoCaja = { type: null, t: 0 };
function accionCaja(type, payload, event) {
  if (!cajaClave || !Array.isArray(cajaNotasMem)) return;
  cajaRearmar();
  if (type === 'undo' || type === 'redo') {
    const de = type === 'redo' ? pilaCajaRehacer : pilaCaja, a = type === 'redo' ? pilaCaja : pilaCajaRehacer;
    const ok = de.length > 0;
    if (ok) {
      a.push(JSON.stringify(cajaNotasMem));
      usandoCaja = true;
      try { cajaNotasMem = JSON.parse(de.pop()); saveData(); } finally { usandoCaja = false; }
      ultimaFotoCaja = { type: null, t: 0 };
      broadcastState();
    }
    try { event.reply('undo-hecho', { tipo: type, ok }); } catch {}
    return;
  }
  if (!ACCIONES_NOTA.has(type)) return;
  const ahora = Date.now();
  if (!(type === ultimaFotoCaja.type && ahora - ultimaFotoCaja.t < 700)) {
    pilaCaja.push(JSON.stringify(cajaNotasMem));
    if (pilaCaja.length > 60) pilaCaja.shift();
    pilaCajaRehacer.length = 0;
  }
  ultimaFotoCaja = { type, t: ahora };
  usandoCaja = true;
  try { accionNota(type, payload); } finally { usandoCaja = false; }
}
// Al mandar notas a la caja, también salen de las fotos de deshacer (que no vuelvan en claro).
function quitarDeFotos(ids) {
  [pilaDeshacer, pilaRehacer].forEach(pila => pila.forEach((f, i) => {
    if (![...ids].some(id => f.includes(id))) return;
    try { const st = JSON.parse(f); st.notas = (st.notas || []).filter(n => !ids.has(n.id)); pila[i] = JSON.stringify(st); } catch {}
  }));
}
async function cajaFallo(c) {
  cajaFallos++;
  if (cajaFallos >= 5) { cajaEsperaHasta = Date.now() + 30000; cajaFallos = 0; }
  await new Promise(r => setTimeout(r, 500));
  return { error: c.tipo === 'clave' ? 'Contraseña incorrecta' : 'PIN incorrecto' };
}
ipcMain.handle('caja', async (_e, p) => {
  const accion = p && p.accion;
  try {
    if (accion === 'estado') return cajaEstado();
    if (accion === 'cerrar') { cajaCerrar(); return cajaEstado(); }
    if (accion === 'crear') {
      if (state.cajaFuerte && state.cajaFuerte.datos) return { error: 'Ya hay una caja fuerte' };
      const secreto = String(p.secreto || '');
      const tipo = p.tipo === 'clave' ? 'clave' : 'pin';
      if (tipo === 'pin' ? !/^\d{4,8}$/.test(secreto) : secreto.length < 6) return { error: tipo === 'pin' ? 'El PIN tiene que tener de 4 a 8 números' : 'La contraseña tiene que tener al menos 6 caracteres' };
      const sal = nodeCrypto.randomBytes(16).toString('base64');
      cajaClave = cajaDerivar(secreto, sal);
      state.cajaFuerte = { v: 1, tipo, sal, ...cajaCifrar(cajaClave, []) };
      cajaNotasMem = [];
      saveData(); broadcastState(); cajaRearmar();
      return cajaEstado();
    }
    if (accion === 'abrir') {
      const c = state.cajaFuerte;
      if (!c || !c.datos) return { error: 'No hay caja fuerte' };
      if (Date.now() < cajaEsperaHasta) return { error: `Demasiados intentos. Espera ${Math.ceil((cajaEsperaHasta - Date.now()) / 1000)} s` };
      let clave;
      try { clave = cajaDerivar(String(p.secreto || ''), c.sal); const lista = cajaDescifrar(clave, c); cajaClave = clave; cajaFallos = 0; cajaNotasMem = migrarCaja(lista); }
      catch { return cajaFallo(c); }
      cajaRearmar(); broadcastState();
      return cajaEstado();
    }
    // Mandar notas del mapa a la caja. Si está cerrada, con el PIN se meten sin dejarla abierta.
    if (accion === 'meter') {
      const c = state.cajaFuerte;
      if (!c || !c.datos) return { error: 'No hay caja fuerte' };
      const ids = new Set(Array.isArray(p.ids) ? p.ids : []);
      const elegidas = notas().filter(n => ids.has(n.id));
      const van = elegidas.filter(n => !archivosDe(n).length), conArchivo = elegidas.length - van.length;
      if (!van.length) return { error: conArchivo ? 'Las notas con archivos no pueden ir a la caja fuerte (el archivo no se cifra)' : 'No hay nada que guardar' };
      let clave = cajaClave, lista = cajaNotasMem;
      if (!clave) {
        if (Date.now() < cajaEsperaHasta) return { error: `Demasiados intentos. Espera ${Math.ceil((cajaEsperaHasta - Date.now()) / 1000)} s` };
        try { clave = cajaDerivar(String(p.secreto || ''), c.sal); lista = migrarCaja(cajaDescifrar(clave, c)); cajaFallos = 0; }
        catch { return cajaFallo(c); }
      }
      // Debajo de lo que ya hay en la caja, con la misma forma que tenían en el mapa.
      const dy = lista.length ? Math.max(...lista.map(n => Number(n.y) || 0)) + 220 - Math.min(...van.map(n => Number(n.y) || 0)) : 0;
      const dx = lista.length ? -Math.min(...van.map(n => Number(n.x) || 0)) : 0;
      const nuevas = lista.concat(van.map(n => ({ ...n, x: numMapa((Number(n.x) || 0) + dx), y: numMapa((Number(n.y) || 0) + dy), celda: null, orden: null })));
      const fuera = new Set(van.map(n => n.id));
      state.notas = notas().filter(n => !fuera.has(n.id));
      state.cajaFuerte = { ...c, ...cajaCifrar(clave, nuevas) };
      quitarDeFotos(fuera);
      if (cajaClave) { cajaNotasMem = nuevas; pilaCaja.length = 0; pilaCajaRehacer.length = 0; cajaRearmar(); }
      else { try { clave.fill(0); } catch {} }
      saveData(); broadcastState();
      return { ok: true, movidas: van.length, conArchivo };
    }
    // Sacar notas de la caja (abierta) al mapa normal.
    if (accion === 'sacar') {
      if (!cajaClave || !Array.isArray(cajaNotasMem) || !state.cajaFuerte) return { error: 'La caja fuerte está cerrada' };
      const ids = new Set(Array.isArray(p.ids) ? p.ids : []);
      const van = cajaNotasMem.filter(n => ids.has(n.id));
      if (!van.length) return { error: 'No hay nada que sacar' };
      cajaNotasMem = cajaNotasMem.filter(n => !ids.has(n.id));
      pilaCaja.length = 0; pilaCajaRehacer.length = 0;
      state.cajaFuerte = { ...state.cajaFuerte, ...cajaCifrar(cajaClave, cajaNotasMem) };
      notas().push(...van.map(n => ({ ...n, celda: null, orden: null })));
      saveData(); broadcastState(); cajaRearmar();
      return { ok: true, movidas: van.length };
    }
    if (accion === 'tocar') { if (cajaClave) cajaRearmar(); return cajaEstado(); }
    if (accion === 'borrar') {   // olvidaste el PIN: se borra entera (lo confirma la pantalla)
      cajaCerrar(); delete state.cajaFuerte; saveData(); broadcastState();
      return cajaEstado();
    }
  } catch (err) { return { error: String((err && err.message) || err) }; }
  return { error: 'Acción desconocida' };
});

// ── Sugerencias y fallos (2.16) ──────────────────────────────────────────────────
// Se envían por Web3Forms (https://web3forms.com), que los reenvía al correo del autor. La clave
// de acceso solo sirve para enviar a ese buzón; el correo no está en la app.
const WEB3FORMS_CLAVE = '';   // la pone Álvaro (la de su cuenta de Web3Forms)
ipcMain.handle('sugerencias-activas', () => !!WEB3FORMS_CLAVE);   // sin clave, el botón no sale
ipcMain.handle('enviar-sugerencia', async (_e, p) => {
  if (!WEB3FORMS_CLAVE) return { error: 'El envío de sugerencias aún no está activado.' };
  const tipo = { idea: 'Sugerencia', fallo: 'Algo no funciona', otro: 'Otro' }[p && p.tipo] || 'Sugerencia';
  const texto = String((p && p.texto) || '').trim().slice(0, 5000);
  if (texto.length < 3) return { error: 'Escribe un poco más' };
  const contacto = String((p && p.contacto) || '').trim().slice(0, 200);
  const datos = p && p.conDatos ? `\n\n—\nCronota ${app.getVersion()}${IS_STORE ? ' (Microsoft Store)' : ''} · Windows ${require('os').release()} · ${settings.dockMode ? 'barra flotante' : 'ventanas'}` : '';
  try {
    const r = await net.fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_CLAVE,
        subject: `Cronota · ${tipo}`,
        from_name: 'Cronota',
        tipo, mensaje: texto + datos,
        ...(contacto ? { email: contacto, replyto: contacto } : {}),
        botcheck: '',
      }),
    });
    const j = await r.json().catch(() => ({}));
    return r.ok && j.success !== false ? { ok: true } : { error: j.message || ('No se pudo enviar (' + r.status + ')') };
  } catch { return { error: 'Sin conexión: inténtalo dentro de un rato (tu texto no se pierde mientras no cierres).' }; }
});

// ── Novedades al actualizar ───────────────────────────────────────────────────
function openWhatsNew() {
  if (whatsNewWin && !whatsNewWin.isDestroyed()) { whatsNewWin.show(); whatsNewWin.focus(); return; }
  whatsNewWin = makeWindow('whatsnew.html', 440, 430, {
    alwaysOnTop: true, resizable: false,
    minWidth: 400, minHeight: 380, maxWidth: 520, maxHeight: 520,
  });
  whatsNewWin.once('ready-to-show', () => {
    whatsNewWin.show(); whatsNewWin.focus();
    try { whatsNewWin.moveTop(); } catch {}
  });
  whatsNewWin.on('closed', () => { whatsNewWin = null; });
}

// Se enseña una sola vez por versión y SOLO en el canal estable: en el de prueba salen
// versiones a diario y sería un incordio verlo cada vez.
// 2.14: las notas que tocan son las de la última versión que tenga notas escritas y no sea más
// nueva que la instalada (antes solo valía la versión exacta, y en una 2.12.1 no salía nada).
function compararVersiones(a, b) {
  const pa = String(a).split(/[.-]/).map(Number), pb = String(b).split(/[.-]/).map(Number);
  for (let k = 0; k < 3; k++) { const d = (pa[k] || 0) - (pb[k] || 0); if (d) return d; }
  return 0;
}
function notasDeVersion(v) {
  const claves = Object.keys(WHATS_NEW).filter(k => WHATS_NEW[k] && compararVersiones(k, v) <= 0)
    .sort(compararVersiones);
  const k = claves[claves.length - 1];
  return k ? { version: k, ...WHATS_NEW[k] } : null;
}
function whatsNewSignature(notes) {
  if (!notes) return '';
  return (notes.steps || []).map(s => s.title).join('|');
}

function maybeShowWhatsNew() {
  const v = app.getVersion();
  if (settings.lastSeenVersion === v) return;
  // Lo que decide si hay recorrido es que ESA versión tenga novedades escritas, y solo
  // las estables las tienen. Antes se descartaba además a quien tuviera Betatester
  // activado, y eso también le ocultaba las novedades de las estables, que es justo lo
  // que había que enseñar.
  const notes = notasDeVersion(v);
  const sig = whatsNewSignature(notes);
  const yaVisto = !!sig && sig === settings.lastSeenWhatsNew;
  settings.lastSeenVersion = v;      // se marca aunque no haya notas, para no reintentarlo
  if (sig) settings.lastSeenWhatsNew = sig;
  saveSettings();
  // Si la versión nueva cuenta exactamente lo mismo que la anterior, no se repite:
  // ya se leyó una vez y volver a soltarlo entero es justo lo que molestaba.
  if (!notes || yaVisto) return;
  setTimeout(() => openWhatsNew(), 1200);   // tras el arranque, sin pisar al splash
}

// ── IPC ───────────────────────────────────────────────────────────────────────
// 2.14: con una tarea en marcha, cada segundo solo cambian sus tiempos y el total de hoy. Antes se
// recalculaban todas las tareas con todo su historial (crece con los años). Ahora el tic parte del
// último estado completo y solo rehace la tarea en marcha; el completo se rehace con cada cambio
// de verdad, al cambiar de día y, por si acaso, cada minuto.
let estadoCache = null, estadoCacheEn = 0, estadoCacheDia = '';
function estadoDelTic() {
  const ahora = Date.now(), dia = new Date().toDateString();
  if (!estadoCache || dia !== estadoCacheDia || ahora - estadoCacheEn > 60000) {
    estadoCache = getSerializableState(); estadoCacheEn = ahora; estadoCacheDia = dia;
    return estadoCache;
  }
  const t = state.tasks.find(x => x.id === state.activeTaskId);
  if (!t) return estadoCache;
  const hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0);
  const tareaAlDia = {
    ...t,
    todaySecs: todaySecondsForTask(t),
    totalSecs: totalSecondsForTask(t),
    inTrash: isInTrash(t),
    inactive: isInactiveTask(t),
    subtasks: (t.subtasks || []).map(sub => ({ ...sub, todaySecs: secondsForSub(t, sub.id, hoy0.getTime()), totalSecs: secondsForSub(t, sub.id, null) })),
    ownTodaySecs: secondsForSub(t, null, hoy0.getTime()),
  };
  return { ...estadoCache, tasks: estadoCache.tasks.map(x => (x.id === t.id ? tareaAlDia : x)), todayTotal: totalTodaySeconds(), activeTaskId: state.activeTaskId, activeSubId: state.activeSubId || null };
}

function getSerializableState() {
  return {
    enLlamada: appsEnLlamada,   // 2.12: apps con el micrófono abierto (Ajustes lo enseña)
    outlookDescartadas: state.outlookDescartadas || [],   // 2.12: sugerencias de Outlook descartadas
    tasks: state.tasks.map(t => {
      const hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0);
      return {
        ...t,
        todaySecs: todaySecondsForTask(t),
        totalSecs: totalSecondsForTask(t),
        inTrash: isInTrash(t),   // para la sección "Papelera" de Guardadas
        inactive: isInactiveTask(t),   // para la sección "Archivador" de Guardadas
        subtasks: (t.subtasks || []).map(sub => ({
          ...sub,
          todaySecs: secondsForSub(t, sub.id, hoy0.getTime()),
          totalSecs: secondsForSub(t, sub.id, null),
        })),
        // Tiempo apuntado a la tarea sin subtarea ninguna, para que la suma cuadre.
        ownTodaySecs: secondsForSub(t, null, hoy0.getTime()),
      };
    }),
    groups: sortedGroups(),
    palettes: todasLasPaletas(),
    notas: state.notas || [],   // 2.16
    seccionesNotas: state.seccionesNotas || [],
    cajaFuerte: cajaEstado(),
    avisosCalendario: state.avisosCalendario || [],   // 2.17
    cajaNotas: cajaClave && Array.isArray(cajaNotasMem) ? cajaNotasMem : null,   // solo abierta
    activeTaskId: state.activeTaskId,
    activeSubId: state.activeSubId || null,
    todayTotal: totalTodaySeconds(),
    settings,
    trashRetentionDays: TRASH_RETENTION_DAYS,
  };
}

// webContents.send() SOLO llega al frame principal. En modo dock las vistas (panel,
// calendario, guardadas, ajustes) viven en un iframe, así que sin reenviar a los
// sub-frames se quedaban con el estado del momento en que cargaron: las acciones se
// ejecutaban de verdad pero la interfaz no se refrescaba nunca (parecía que restaurar,
// eliminar de la papelera o reanudar una tarea "no hacían nada").
// Avisa a TODAS las vistas de que hay un recorrido en marcha. Hace falta además de la
// respuesta a 'am-i-visible' porque, si la vista de destino ya era la que estaba
// abierta, el iframe no se recarga y esa página nunca llega a preguntar.
function broadcastTourFlag() {
  [dockPanelWin, mainWin, calendarWin, groupsWin, notasWin, settingsWin].forEach(w => {
    if (w && !w.isDestroyed()) sendToAllFrames(w, 'tutorial-tour');
  });
}

function sendToAllFrames(win, channel, payload) {
  if (!win || win.isDestroyed()) return;
  try { win.webContents.send(channel, payload); } catch {}
  try {
    (win.webContents.mainFrame.frames || []).forEach(f => { try { f.send(channel, payload); } catch {} });
  } catch {}
}

function sendStateToWindow(win) {
  if (!win || win.isDestroyed()) return;
  sendToAllFrames(win, 'state', getSerializableState());
}

// Vista del dock que se ve ahora. Desde la 2.8 las cuatro viven a la vez (una por
// iframe): solo la visible recibe el estado de cada segundo, y la que entra lo recibe al
// momento al cambiar de pestaña (ver 'dock-view-changed').
const DOCK_VIEW_FILE = { panel: 'main.html', calendar: 'calendar.html', groups: 'groups.html', notas: 'notas.html', settings: 'settings.html' };
function activeDockFrames() {
  if (!dockPanelWin || dockPanelWin.isDestroyed()) return [];
  let todos = [];
  try { todos = dockPanelWin.webContents.mainFrame.frames || []; } catch { return []; }
  const fichero = DOCK_VIEW_FILE[dockPanelView] || 'main.html';
  return todos.filter(f => { try { return String(f.url || '').includes(fichero); } catch { return false; } });
}
function sendStateToActiveDockFrame() {
  const fr = activeDockFrames();
  if (!fr.length) return;
  const s = getSerializableState();
  fr.forEach(f => { try { f.send('state', s); } catch {} });
}

// Todas las vistas del panel del dock (visibles o no).
function allDockFrames() {
  if (!dockPanelWin || dockPanelWin.isDestroyed()) return [];
  let todos = [];
  try { todos = dockPanelWin.webContents.mainFrame.frames || []; } catch { return []; }
  const ficheros = Object.values(DOCK_VIEW_FILE);
  return todos.filter(f => { try { return ficheros.some(x => String(f.url || '').includes(x)); } catch { return false; } });
}

// opts.tic: es el refresco de cada segundo (solo cambian los tiempos), no un cambio de verdad.
function broadcastState(opts) {
  updateTrayTitle();
  const tic = !!(opts && opts.tic);
  const seVe = (w) => !!w && !w.isDestroyed() && w.isVisible();
  // 2.8.5: el tic de cada segundo (solo cambian los tiempos) va solo a lo que se ve. Antes iba
  // también a las ventanas escondidas y al panel plegado, que se repintaban todo el día sin que
  // nadie las viera. Al enseñarse se ponen al día (makeWindow 'show', showDockPanel).
  const ventanas = [widgetWin, mainWin, calendarWin, groupsWin, notasWin].filter(w => w && !w.isDestroyed() && (!tic || seVe(w)));
  // El panel del dock lo escucha su iframe (panel/calendario/tareas), no la página que lo
  // envuelve; la barrita (dockWin) no escucha 'state'. Con un cambio de verdad se ponen al
  // día TODAS sus vistas: así la que entra al cambiar de pestaña ya está pintada y no tiene
  // que rehacerse justo mientras se anima (eso era lo que se comía la animación). Con el
  // tic de cada segundo, solo la visible: las demás se ponen al día al cambiar de pestaña
  // ('dock-view-changed'). 2.8.5: antes iba a las cuatro cada cinco tics, y rehacer el
  // calendario escondido (~90 ms) daba un tirón cada cinco segundos con el panel abierto.
  let marcos = [];
  if (!tic) marcos = allDockFrames();
  else if (seVe(dockPanelWin)) marcos = activeDockFrames();
  if (!ventanas.length && !marcos.length) return;   // nadie mira: ni se calcula
  let s;   // 2.14: el tic reutiliza el último estado completo (ver estadoDelTic)
  if (tic) s = estadoDelTic();
  else { s = estadoCache = getSerializableState(); estadoCacheEn = Date.now(); estadoCacheDia = new Date().toDateString(); }
  ventanas.forEach(w => sendToAllFrames(w, 'state', s));
  marcos.forEach(f => { try { f.send('state', s); } catch {} });
}

// ── Deshacer / rehacer (Ctrl+Z / Ctrl+Y) ─────────────────────────────────────────
// Antes de cada cambio en tareas, entradas o secciones se guarda una foto del estado. Los
// cambios seguidos del mismo tipo (p. ej. estirar un bloque varias veces) van en una sola.
const ACCIONES_DESHACIBLES = new Set([
  'start-task', 'add-subtask', 'add-subtask-and-start', 'rename-subtask', 'delete-subtask', 'pause',
  'switch-task', 'restart-task-with-note', 'resume-entry', 'create-task', 'update-task-meta',
  'set-task-memo', 'delete-task', 'restore-task', 'purge-task', 'edit-task-color', 'rename-task',
  'set-active-note', 'archive-task', 'unarchive-task', 'create-group', 'rename-group', 'delete-group',
  'move-task-to-group', 'set-group-palette', 'recolor-group-tasks', 'reorder-groups',
  'restore-and-start-task', 'edit-entry', 'delete-entry', 'add-calendar-entry', 'archive-purge',
  'descartar-reunion', 'restaurar-descartadas',
  'nota-crear', 'nota-editar', 'nota-borrar', 'nota-mover', 'nota-duplicar', 'notas-mover', 'notas-borrar', 'notas-pegar', 'notas-editar', 'notas-vaciar-hechas', 'nota-seccion-crear', 'nota-seccion-editar', 'nota-seccion-borrar',
]);
const pilaDeshacer = [], pilaRehacer = [];
let ultimaFoto = { type: null, t: 0 };
function fotoAntesDe(type) {
  const ahora = Date.now();
  if (type === ultimaFoto.type && ahora - ultimaFoto.t < 700) { ultimaFoto.t = ahora; return; }
  ultimaFoto = { type, t: ahora };
  pilaDeshacer.push(JSON.stringify(state));
  if (pilaDeshacer.length > 60) pilaDeshacer.shift();
  pilaRehacer.length = 0;
}
function deshacer(rehacer) {
  const de = rehacer ? pilaRehacer : pilaDeshacer, a = rehacer ? pilaDeshacer : pilaRehacer;
  if (!de.length) return false;
  a.push(JSON.stringify(state));
  const cajaAhora = state.cajaFuerte;   // 2.16: deshacer no toca la caja fuerte (va cifrada aparte)
  state = JSON.parse(de.pop());
  if (cajaAhora) state.cajaFuerte = cajaAhora; else delete state.cajaFuerte;
  ultimaFoto = { type: null, t: 0 };
  saveData(); broadcastState(); resetReminderTimer();
  return true;
}

ipcMain.on('action', (event, { type, payload }) => {
  if (payload && payload.caja) { accionCaja(type, payload, event); return; }   // 2.16: la pizarra de la caja fuerte
  if (ACCIONES_DESHACIBLES.has(type)) fotoAntesDe(type);
  switch (type) {
    case 'undo':
    case 'redo': {
      const ok = deshacer(type === 'redo');
      try { event.reply('undo-hecho', { tipo: type, ok }); } catch {}
      break;
    }
    case 'add-subtask':    addSubtask(payload.taskId, payload.name); break;
    // Crear y arrancar de una vez: quien la crea desde "Empezar tarea" la quiere ya en
    // marcha, y desde el renderer no se puede porque el id lo pone este proceso.
    case 'add-subtask-and-start': {
      addSubtask(payload.taskId, payload.name);
      const task = state.tasks.find(t => t.id === payload.taskId);
      const sub = task && (task.subtasks || [])[task.subtasks.length - 1];
      if (sub) startTask(task.id, payload.backMinutes, sub.id);
      break;
    }
    case 'rename-subtask': renameSubtask(payload.taskId, payload.subId, payload.name); break;
    case 'delete-subtask': deleteSubtask(payload.taskId, payload.subId); break;
    case 'pause':         pauseActive(); break;
    // 2.14.6: parar una entrada que sigue abierta aunque su tarea no sea la que está en marcha.
    case 'stop-entry': {
      const t = state.tasks.find(x => x.id === (payload && payload.taskId));
      const e = t && t.entries[payload.entryIndex];
      if (!e || e.end != null) break;
      if (state.activeTaskId === t.id && entradaEnCurso(t) === e) { pauseActive(); break; }
      fotoAntesDe('parar-entrada');
      e.end = Math.max(e.start, Date.now());
      saveData(); broadcastState();
      break;
    }
    case 'switch-task':   switchTask(payload.taskId, payload.backMinutes, payload.subId, payload.note); break;
    case 'restart-task-with-note': restartActiveTaskWithNote(payload && payload.note); break;
    case 'resume-entry':  resumeEntry(payload.taskId, payload.entryIndex); break;
    case 'create-task': {
      const id = createTask(payload.name, payload.color, {
        taskType: payload.taskType,
        memo: payload.memo,
        erpId: payload.erpId,
        groupId: payload.groupId,   // solo para el color: de su paleta, si la sección tiene
      });
      // La sección es solo su etiqueta: se le pone y sigue sin archivar, así que nace
      // dentro de su sección en Tareas y a la vez a mano en el Panel.
      if (payload.groupId && state.groups.some(g => g.id === payload.groupId)) {
        const t = state.tasks.find(x => x.id === id);
        if (t) t.groupId = payload.groupId;
      }
      // 2.14.7: se puede crear sin empezarla (botón «Crear» en Tareas).
      if (payload.empezar === false) { saveData(); broadcastState(); break; }
      // Nota de esta sesión al crear+empezar (aparte del memo persistente).
      startTask(id, payload.backMinutes, payload.subId, payload.note);
      openMain();
      break;
    }
    case 'update-task-meta': {
      updateTaskMeta(payload.taskId, payload);
      break;
    }
    case 'set-task-memo': {
      setTaskMemo(payload.taskId, payload.memo);
      break;
    }
    case 'delete-task':   deleteTask(payload.taskId); break;
    case 'restore-task':  restoreTask(payload.taskId); break;
    case 'purge-task':    purgeTask(payload.taskId); break;
    case 'edit-task-color': editTaskColor(payload.taskId, payload.color); break;
    case 'rename-task':   renameTask(payload.taskId, payload.name); break;
    case 'set-active-note': setActiveEntryNote(payload.note); break;
    case 'archive-task':  archiveTask(payload.taskId, payload.groupId, payload.groupName); break;
    case 'unarchive-task': unarchiveTask(payload.taskId); break;
    case 'create-group':  createGroup(payload.name); break;
    case 'rename-group':  renameGroup(payload.groupId, payload.name); break;
    case 'delete-group':  deleteGroup(payload.groupId); break;
    case 'move-task-to-group': moveTaskToGroup(payload.taskId, payload.groupId); break;
    case 'set-group-palette': setGroupPalette(payload.groupId, payload.palette); break;
    case 'guardar-paleta': guardarPaletaPropia(payload); break;   // 2.15
    case 'borrar-paleta': borrarPaletaPropia(payload && payload.id); break;
    case 'recolor-group-tasks': recolorGroupTasks(payload.groupId); break;
    case 'set-eye-care': {
      const p = payload || {};
      const antesActivo = !!settings.eyeCareEnabled;
      const antesCada = settings.eyeCareEvery;
      if (p.eyeCareEnabled !== undefined) settings.eyeCareEnabled = !!p.eyeCareEnabled;
      if (p.eyeCareEvery !== undefined) settings.eyeCareEvery = Math.max(1, Math.min(180, Number(p.eyeCareEvery) || 20));
      if (p.eyeCareRest !== undefined) settings.eyeCareRest = Math.max(5, Math.min(120, Number(p.eyeCareRest) || 20));
      if (p.eyeCarePos !== undefined) settings.eyeCarePos = p.eyeCarePos;
      if (p.eyeCareSize !== undefined) settings.eyeCareSize = Math.max(80, Math.min(420, Number(p.eyeCareSize) || 150));
      if (p.eyeCareSoloOjos !== undefined) settings.eyeCareSoloOjos = !!p.eyeCareSoloOjos;   // 2.8.3: sin fondo
      saveSettingsSoon(); broadcastState();
      // La cuenta atrás solo vuelve a empezar si se acaba de encender o si cambia cada
      // cuánto avisa. Mover el tamaño o la posición no debe retrasar el próximo aviso.
      const reiniciar = (!antesActivo && settings.eyeCareEnabled) || antesCada !== settings.eyeCareEvery;
      startEyeCareTimer(reiniciar);
      // Al tocar la posición o el tamaño se enseña un momento, para verlo mientras se ajusta.
      if (p.preview) showEyeCare(p.previewSeconds || 3, true);
      break;
    }
    case 'eye-done': hideEyeCare(); break;
    case 'set-leave': {
      const p = payload || {};
      settings.leaveEnabled = !!p.leaveEnabled;
      settings.leaveSameEveryDay = p.leaveSameEveryDay !== false;
      if (typeof p.leaveTime === 'string') settings.leaveTime = p.leaveTime;
      if (p.leaveDays && typeof p.leaveDays === 'object') settings.leaveDays = p.leaveDays;
      settings.leaveAutoStop = !!p.leaveAutoStop;
      leaveNotifiedOn = null;   // cambiar la hora vuelve a habilitar el aviso de hoy
      saveSettings(); broadcastState();
      startLeaveWatcher();
      break;
    }
    case 'set-impute-urls': {
      const lista = Array.isArray(payload && payload.urls) ? payload.urls : [];
      settings.imputeUrls = lista
        .map(u => normalizeUrl(String(u || '').trim().slice(0, 2000)))
        .filter(Boolean)
        .filter((u, i, a) => a.indexOf(u) === i);   // sin repetidos
      settings.imputeUrl = settings.imputeUrls[0] || '';   // el viejo ajuste, al día
      saveSettings(); broadcastState();
      break;
    }
    case 'open-impute-url': openImputeUrl(payload); break;
    // 2.12: abrir Outlook en el navegador, sin iniciar sesión desde Cronota ni registrar nada.
    //   que='publicar': la página de Outlook donde se publica el calendario (para sacar el vínculo ICS);
    //   que='evento': un evento nuevo ya relleno (título, horas y nota); tú solo pulsas Guardar.
    case 'abrir-outlook': {
      const p = payload || {};
      let url = null;
      if (p.que === 'publicar') url = 'https://outlook.office.com/calendar/options/calendar/SharedCalendars';
      else if (p.que === 'calendario') {
        // 2.13: el calendario de Outlook en el día de esa reunión.
        const d = new Date(Number(p.dia) || Date.now());
        const web = `https://outlook.office.com/calendar/view/day/${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
        // La app de Outlook no deja abrir un día concreto (y un evento concreto solo se puede con su
        // id interno, que sin iniciar sesión no tenemos): el navegador sí abre ese día.
        require('electron').shell.openExternal(web).catch(() => {});
        break;
      }
      else if (p.que === 'evento' && Number(p.inicio) && Number(p.fin) > Number(p.inicio)) {
        const q = new URLSearchParams({
          path: '/calendar/action/compose', rru: 'addevent',
          subject: String(p.titulo || '').slice(0, 250),
          startdt: new Date(Number(p.inicio)).toISOString(),
          enddt: new Date(Number(p.fin)).toISOString(),
          body: String(p.nota || '').slice(0, 1000),
        });
        url = 'https://outlook.office.com/calendar/deeplink/compose?' + q.toString();
      }
      if (url) { try { require('electron').shell.openExternal(url); } catch {} }
      break;
    }
    case 'set-week-days': {
      const dias = Array.isArray(payload && payload.days)
        ? payload.days.map(Number).filter(d => d >= 0 && d <= 6) : [];
      settings.weekDays = dias.length ? [...new Set(dias)] : [1, 2, 3, 4, 5, 6, 0];
      saveSettings(); broadcastState();
      break;
    }
    case 'set-week-override': {
      const clave = String((payload && payload.week) || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(clave)) break;
      if (!settings.weekOverrides || typeof settings.weekOverrides !== 'object') settings.weekOverrides = {};
      if (payload.days === null) {
        delete settings.weekOverrides[clave];   // vuelve a lo de siempre
      } else {
        const dias = Array.isArray(payload.days) ? payload.days.map(Number).filter(d => d >= 0 && d <= 6) : [];
        settings.weekOverrides[clave] = [...new Set(dias)];
      }
      pruneWeekOverrides();
      saveSettings(); broadcastState();
      break;
    }
    case 'set-group-sort':
      if (payload && payload.sort !== undefined) {
        settings.groupSort = ['alpha', 'created', 'custom'].includes(payload.sort) ? payload.sort : 'created';
      }
      if (payload && payload.dir !== undefined) {
        settings.groupSortDir = payload.dir === 'desc' ? 'desc' : 'asc';
      }
      saveSettings(); broadcastState();
      break;
    case 'reorder-groups': reorderGroups(payload && payload.ids); break;
    case 'restore-and-start-task': restoreAndStartTask(payload.taskId, payload.backMinutes, payload.subId, payload.note); break;
    case 'edit-entry':    editEntry(payload.taskId, payload.entryIndex, payload.startMs, payload.endMs, payload.note, payload.name, payload.subId); break;
    case 'delete-entry':  deleteEntry(payload.taskId, payload.entryIndex); break;
    // 2.12: descartar una sugerencia de Outlook. Va en el estado (no en los ajustes) para que
    // Ctrl+Z la recupere como cualquier otro cambio.
    case 'descartar-reunion': {
      const id = payload && String(payload.id || '').slice(0, 300);
      if (!id) break;
      state.outlookDescartadas = [...new Set([...(state.outlookDescartadas || []), id])].slice(-500);
      saveData(); broadcastState();
      break;
    }
    case 'restaurar-descartadas':
      state.outlookDescartadas = [];
      saveData(); broadcastState();
      break;
    case 'add-calendar-entry':
      if (payload && payload.reunionId) { anadirReunion(payload); break; }   // 2.12: desde Outlook
      addCalendarEntry(payload.taskId, payload.newTaskName, payload.newTaskColor, payload.startMs, payload.endMs, payload.note, payload.subId, payload.newTaskGroupId);
      break;
    case 'archive-purge': archivePurge(payload && payload.taskIds); break;
    case 'save-settings': {
      const wasDock = settings.dockMode;
      settings = { ...settings, ...payload };
      saveSettings(); resetReminderTimer(); applyTranslucencyAll();
      if (outlook && payload && payload.outlookIcsUrl !== undefined) outlook.configurar(settings.outlookIcsUrl);   // 2.12
      applyDockMode(wasDock);   // crea/destruye el dock si ha cambiado el modo
      // El botón es "Aplicar": deja los ajustes aplicados pero SIN cerrarlos ni sacarte
      // de la pantalla, para poder seguir tocando cosas.
      break;
    }
    case 'set-blur':
      settings.blurEnabled = !!(payload && payload.enabled);
      saveSettings();
      // 2.8.3: el panel del dock ya no lleva material de Windows; el desenfoque es el de su
      // cristal, que llega con el tema (themeVars.difuminar) y se rehace solo.
      applyTranslucencyAll();
      break;
    // Aplicar un ajuste suelto al momento (los controles de Ajustes no deben esperar a
    // que se pulse "Aplicar" para verse).
    case 'set-setting': {
      const key = payload && payload.key;
      if (!key || !(key in settings)) break;
      settings[key] = payload.value;
      saveSettingsSoon();
      if (key === 'reminderMinutes' || key === 'widgetAutoHide' || key === 'widgetAutoHideSeconds') resetReminderTimer();
      if (key === 'outlookIcsUrl' && outlook) outlook.configurar(payload.value);
      if (key === 'silenciarEnLlamada' && vigiaLlamadas) { if (payload.value) vigiaLlamadas.encender(); else vigiaLlamadas.apagar(); }
      if (key === 'widgetScale') widgetBounds = null;   // el sitio guardado era del tamaño de antes
      if (key === 'liquidGlass') { broadcastTheme(); sendDockConfig(); }   // estilo: cristal o plano, al momento
      broadcastState();   // p. ej. colorMode lo usan los selectores de color
      break;
    }
    case 'set-bg-opacity':
      settings.bgOpacity = Math.max(0, Math.min(100, Number(payload.value)));
      saveSettingsSoon(); applyTranslucencyAll();   // llega en cada 'input' del deslizador
      break;
    case 'mark-tutorial-seen': {
      const ids = Array.isArray(payload && payload.ids) ? payload.ids : [];
      const seen = new Set(settings.tutorialSeenSteps || []);
      const antes = seen.size;
      ids.forEach(id => seen.add(id));
      if (seen.size === antes) break;   // nada nuevo: ni guardar ni difundir
      settings.tutorialSeenSteps = [...seen];
      saveSettings(); broadcastState();
      break;
    }
    case 'reset-tutorial':
      settings.tutorialSeenSteps = [];
      saveSettings(); broadcastState();
      tourActive = true;   // el recorrido empieza por el Panel y de ahí va solo
      openMain();
      setTimeout(broadcastTourFlag, 400);
      break;
    // Una vista recién cargada pregunta si el usuario la está viendo ya. Hace falta
    // porque al cambiar de pestaña el iframe se recarga y se pierde el aviso 'dock-expanded'.
    case 'am-i-visible':
      if (dockExpanded) { try { event.reply('dock-expanded'); } catch {} }
      if (tourActive) { try { event.reply('tutorial-tour'); } catch {} }
      break;
    // Recorrido asistido: al acabar los pasos de una vista, lleva solo a la siguiente.
    // Las vistas que ya no tengan nada pendiente lo mandan también, para no dejar al
    // usuario plantado en una pantalla sin explicación ninguna.
    case 'tutorial-next': {
      if (!tourActive) break;   // no hay recorrido en marcha: nadie tiene que ir a ningún lado
      const idx = TOUR_ORDER.indexOf(payload && payload.from);
      const next = idx >= 0 ? TOUR_ORDER[idx + 1] : null;
      if (!next) { tourActive = false; break; }
      const open = { calendar: openCalendar, groups: openGroups, settings: openSettings };
      setTimeout(() => { try { open[next](); } catch {} }, 260);
      break;
    }
    case 'tutorial-stop': tourActive = false; break;
    case 'open-main':     openMain(); break;
    case 'open-calendar': openCalendar(); break;
    case 'open-settings': openSettings(); break;
    case 'open-groups':   openGroups(); break;
    case 'open-notas':    openNotas(); break;   // 2.16
    case 'close-widget':  hideWidget(); break;
    case 'widget-escala-vivo': {   // Ajustes: el deslizador de tamaño, mientras se mueve
      settings.widgetScale = Math.max(80, Math.min(150, Number(payload && payload.value) || 100));
      saveSettingsSoon();
      if (settings.estiloAvisos !== 'abajo') {   // 2.17: con la isla, se ve la isla cambiando de tamaño
        if (colaAvisos[0] && avisoWin && !avisoWin.isDestroyed() && avisoWin.isVisible()) ajustarTamanoAviso();
        else avisarTarea(true);
        break;
      }
      if (widgetWin && !widgetWin.isDestroyed()) {
        try { widgetWin.webContents.send('widget-escala', widgetEscala()); } catch {}
        scheduleWidgetAutoHide();   // que no se esconda mientras lo ajustas
      } else createWidgetWindow();
      break;
    }
    case 'preview-widget':   // Ajustes: enseñar el recordatorio (en isla o, con el estilo «Abajo», la tarjeta)
      if (settings.estiloAvisos !== 'abajo') { avisarTarea(true); break; }
      if (widgetWin && !widgetWin.isDestroyed()) { try { widgetWin.destroy(); } catch {} widgetWin = null; }
      createWidgetWindow();
      break;
    case 'aviso-cal-poner': ponerAvisoCal(payload); break;     // 2.17: «Avisarme» en el calendario
    case 'aviso-cal-quitar': quitarAvisoCal(payload && payload.clave); break;
    case 'widget-raton': {   // la tarjeta pide los clics solo mientras el ratón está encima
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && !win.isDestroyed()) try { win.setIgnoreMouseEvents(!payload.dentro, { forward: true }); } catch {}
      break;
    }
    case 'close-main':
      if (settings.dockMode && dockWin && !dockWin.isDestroyed()) dockWin.webContents.send('dock-collapse');
      else if (mainWin && !mainWin.isDestroyed()) mainWin.hide();
      break;
    case 'dock-hit-rects':
      dockHitRects = (payload && Array.isArray(payload.rects)) ? payload.rects : [];
      dockBarRect = (payload && payload.barRect) || null;
      updateDockHitTest();
      break;
    case 'set-dnd': setDnd(payload && payload.minutes === null ? null : Number(payload && payload.minutes) || 0); break;
    case 'dock-context-menu': showDockContextMenu(); break;
    case 'dock-expand':            // la barrita pide abrir el panel
      showDockPanel();
      break;
    case 'dock-collapse-panel':     // la barrita (o su botón) pide cerrarlo
      collapseDockPanel();
      break;
    case 'dock-view-changed':
      if (payload && payload.view) {
        dockPanelView = payload.view;
        rememberView(payload.view);
        // 2.8: las vistas ya no se recargan (cada una vive en su iframe) y están al día (ver
        // broadcastState). Los tiempos se refrescan cuando ha terminado de entrar: mandárselos
        // antes la hacía repintarse en mitad de la animación.
        setTimeout(sendStateToActiveDockFrame, 700);
        // 2.8.3: el ancho lo anima la página y avisa con 'dock-panel-rect'.
      }
      break;
    // 2.8.3: la forma visible de la ventana que lo pide (lo de fuera deja pasar los clics y no
    // lleva desenfoque). x, y, w, h en px de la página; radios de las esquinas.
    case 'forma-ventana': {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win || win.isDestroyed() || !payload) break;
      const clave = [payload.x, payload.y, payload.w, payload.h, (payload.radios || []).join(',')].map(v => typeof v === 'number' ? Math.round(v) : v).join('|');
      if (win.__forma === clave) break;   // sin cambios: ni se toca (cada setShape repinta)
      win.__forma = clave;
      try { win.setShape(formaRedondeada(payload.x, payload.y, payload.w, payload.h, payload.radios)); } catch {}
      break;
    }
    // Desenfoque del propio Windows detrás de la ventana (cero retraso: lo pinta el compositor).
    case 'dock-panel-rect': {   // dónde está la tarjeta: botón = su tamaño; forma = cuánto dejar visible
      if (!dockPanelWin || dockPanelWin.isDestroyed() || !payload) break;
      const boton = Number(payload.boton) || 0, forma = payload.forma == null ? boton : Number(payload.forma) || 0;
      if (forma > 0) aplicarFormaPanel(forma);
      if (boton > 0) {
        dockPanelRect = rectPanel(boton);
        if (dockExpanded && !dockPanelWin.__botonPendiente) positionDockHide(dockPanelRect);
      }
      break;
    }
    case 'fin-captura': {   // la página ya no lee la pantalla (estilo plano o panel mate)
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win || win.isDestroyed()) break;
      ventanasExcluidas.delete(win);
      try { win.setContentProtection(false); } catch {}   // vuelve a salir en las capturas
      actualizarVigilanteCapturas();
      break;
    }
    case 'dock-panel-entrando':   // la tarjeta empieza a deslizarse: ahora sí, el botón
      if (dockPanelWin && !dockPanelWin.isDestroyed() && dockPanelWin.__botonPendiente) dockPanelWin.__botonPendiente();
      break;
    case 'dock-panel-salido':     // el panel ya ha salido deslizándose: se esconde la ventana
      if (dockPanelWin && !dockPanelWin.isDestroyed() && dockPanelWin.__alSalir) dockPanelWin.__alSalir();
      break;
    case 'dock-panel-resize-end': {
      // Se recuerda por separado: el ancho del calendario no pisa el del resto.
      const c = dockConfig();
      const vertical = c.anchor === 'left' || c.anchor === 'right';
      const size = Math.round(Number(payload && payload.size) || 0);
      if (size > 0) {
        const lim = (a, b) => Math.max(a, Math.min(b, size));
        if (!vertical) settings.dockPanelHeight = lim(260, 1400);
        else if ((payload && payload.view) === 'calendar') settings.dockCalendarWidth = lim(760, 1900);
        else if ((payload && payload.view) === 'notas') settings.dockNotasWidth = lim(420, 1900);
        else settings.dockPanelWidth = lim(320, 1600);
        saveSettingsSoon();
        sendDockConfig();   // la barrita necesita el tamaño para colocar su botón
      }
      break;
    }
    // El módulo screen no está disponible de forma fiable dentro de un iframe del dock:
    // la lista de monitores se pide aquí (por eso el desplegable salía vacío).
    case 'get-displays':
      event.reply('displays', screen.getAllDisplays().map((d, i) => ({
        id: d.id, index: i + 1,
        width: d.size.width, height: d.size.height,
        primary: d.bounds.x === 0 && d.bounds.y === 0,
      })));
      break;
    // Vista previa en vivo mientras se toquetea la barra en Ajustes (sin darle a Guardar).
    // 2.10: la píldora se está arrastrando fuera de su pantalla. La ventana de la barra se
    // muda a la pantalla que hay bajo el cursor (y se recuerda como la elegida, igual que
    // desde Ajustes o el menú). El panel se recoloca al soltar, con 'set-dock-config'.
    case 'dock-bar-cruza': {
      const p = payload || {};
      try {
        const destino = screen.getDisplayNearestPoint({ x: Math.round(Number(p.x) || 0), y: Math.round(Number(p.y) || 0) });
        if (destino && destino.id !== dockDisplay().id && dockWin && !dockWin.isDestroyed()) {
          settings.dockDisplayId = destino.id;
          settings.dockDisplayKey = displayKey(destino);
          saveSettingsSoon();
          dockWin.setBounds(computeDockBounds());
        }
      } catch {}
      try { event.reply('dock-bar-cruzada'); } catch {}
      break;
    }
    case 'set-dock-config': {
      const { preview, ...vals } = payload || {};
      settings = { ...settings, ...vals };
      if (vals.dockDisplayId !== undefined) {
        const elegida = screen.getAllDisplays().find(d => d.id === vals.dockDisplayId);
        settings.dockDisplayKey = elegida ? displayKey(elegida) : null;
      }
      saveSettingsSoon();   // los deslizadores disparan esto muchas veces por segundo
      if (settings.dockMode) { createDock(); positionDock(); syncDockBounds(); }   // sync: el panel, por si la píldora cambió de pantalla
      // Con el panel abierto la barrita se oculta; al ajustarla hay que verla.
      if (preview && dockWin && !dockWin.isDestroyed()) {
        const now = Date.now();
        if (now - lastBarRaiseAt > 1500) {
          lastBarRaiseAt = now;
          try { dockWin.moveTop(); } catch {}   // si no, queda debajo de la ventana del panel
        }
        try { dockWin.webContents.send('dock-bar-preview'); } catch {}
      }
      break;
    }
    // El interruptor de "modo barra flotante" se aplica al momento (no al Guardar), y
    // deja el dock en Ajustes para poder seguir configurándolo sin perder de vista nada.
    case 'set-dock-mode': {
      const wasDock = !!settings.dockMode;
      settings.dockMode = !!(payload && payload.enabled);
      saveSettings();
      if (settings.dockMode) {
        [mainWin, calendarWin, groupsWin, notasWin, settingsWin].forEach(w => { try { if (w && !w.isDestroyed()) w.hide(); } catch {} });
        createDock();
        if (!wasDock) dockNavigate('settings'); else positionDock();
      } else if (wasDock) {
        destroyDock();
        openSettings();
      }
      updateTrayTitle();
      break;
    }
    case 'get-theme':     event.reply('theme', themeVars()); break;
    case 'get-whats-new': {
      const v = app.getVersion();
      const notes = notasDeVersion(v);
      // Lo visto del recorrido va también: la ventana solo ofrece «Enséñame dónde está» si queda algo.
      event.reply('whats-new', { version: v, title: notes && notes.title, steps: (notes && notes.steps) || [], vistos: settings.tutorialSeenSteps || [] });
      break;
    }
    case 'show-whats-new': openWhatsNew(); break;   // botón "Ver novedades" de Ajustes
    // Del resumen de novedades al recorrido guiado: los pasos del tutorial llevan la
    // versión en la que se añadieron, así que los pendientes son justo los de lo nuevo.
    case 'start-whats-new-tour':
      if (whatsNewWin && !whatsNewWin.isDestroyed()) whatsNewWin.close();
      tourActive = true;
      openMain();
      setTimeout(broadcastTourFlag, 400);   // por si el Panel ya era la vista abierta
      break;
    case 'close-whats-new':
      if (whatsNewWin && !whatsNewWin.isDestroyed()) whatsNewWin.close();
      break;
    case 'set-theme':
      if (payload && payload.theme !== undefined) {
        settings.theme = THEMES[payload.theme] ? payload.theme : DEFAULT_THEME;
        applySystemThemeSource();
      }
      if (payload && payload.accent !== undefined) {
        settings.accent = ACCENTS[payload.accent] ? payload.accent : null;   // null = el del tema
      }
      saveSettings(); broadcastTheme();
      break;
    case 'cerrar-y-actualizar': cerrarYActualizar(); break;   // 2.14.3
    case 'get-settings':  event.reply('settings', { ...settings, appVersion: app.getVersion(), isStore: IS_STORE, versionNueva }); break;
    case 'min-main':      if (mainWin && !mainWin.isDestroyed()) mainWin.minimize(); break;
    case 'close-calendar':
      if (settings.dockMode) dockNavigate('panel');
      else { if (calendarWin && !calendarWin.isDestroyed()) calendarWin.hide(); ensureSomeWindowVisible(); }
      break;
    case 'close-settings':
      if (settings.dockMode) dockNavigate('panel');
      else if (settingsWin && !settingsWin.isDestroyed()) settingsWin.hide();
      break;
    case 'aviso-probar':   // 2.16: «Ver cómo queda» de los recordatorios de notas (Ajustes → Avisos)
      avisar({ que: 'Recordatorio', texto: 'Así se ven los recordatorios de tus notas', cuando: Date.now(), color: '#ffb383', programado: true,
        acciones: [{ a: 'hecha', label: 'Hecha' }, { a: 'posponer', label: '10 min' }] });
      break;
    case 'close-notas':   // 2.16
      if (settings.dockMode) dockNavigate('panel');
      else { if (notasWin && !notasWin.isDestroyed()) notasWin.hide(); ensureSomeWindowVisible(); }
      break;
    case 'nota-crear': case 'nota-editar': case 'nota-borrar': case 'nota-mover': case 'nota-duplicar':
    case 'notas-mover': case 'notas-borrar': case 'notas-editar': case 'notas-pegar': case 'notas-vaciar-hechas':
      accionNota(type, payload); break;
    case 'nota-seccion-crear': crearSeccionNotas(payload); break;
    case 'nota-seccion-editar': editarSeccionNotas(payload); break;
    case 'nota-seccion-borrar': borrarSeccionNotas(payload && payload.id); break;
    case 'close-groups':
      if (settings.dockMode) dockNavigate('panel');
      else { if (groupsWin && !groupsWin.isDestroyed()) groupsWin.hide(); ensureSomeWindowVisible(); }
      break;
    case 'check-for-updates': checkForUpdates(true); break;   // «Buscar actualizaciones» de Ajustes: abre la Store
    case 'get-state':     event.reply('state', getSerializableState()); break;
  }
});

// Arrastre de ventana desde el asa (.win-drag). Lo hacemos a mano porque
// -webkit-app-region: drag no funcionaba en la ventana del calendario. Guardamos la
// posición del cursor y de la ventana al empezar, y en cada movimiento reposicionamos
// según cuánto se ha desplazado el cursor.
let winDragState = null;
ipcMain.on('win-drag', (event, phase) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;
  if (phase === 'start') {
    winDragState = { win, cursor: screen.getCursorScreenPoint(), bounds: win.getBounds() };
  } else if (phase === 'move' && winDragState && winDragState.win === win) {
    const p = screen.getCursorScreenPoint();
    const { cursor, bounds } = winDragState;
    const x = bounds.x + (p.x - cursor.x);
    const y = bounds.y + (p.y - cursor.y);
    // Solo tocamos el ancho/alto cuando de verdad se ha desviado del original (al cruzar
    // a una pantalla con distinta escala/DPI, Windows reescala la ventana sola). Antes se
    // reafirmaba el tamaño en CADA movimiento incluso sin hacer falta, y ese setBounds de
    // más (compitiendo con el reescalado del sistema) es lo que se veía como pequeños
    // saltos/tirones mientras se arrastraba. Así solo se corrige cuando hay algo que corregir.
    const current = win.getBounds();
    if (current.width !== bounds.width || current.height !== bounds.height) {
      win.setBounds({ x, y, width: bounds.width, height: bounds.height });
    } else {
      win.setPosition(x, y);
    }
  } else if (phase === 'end') {
    winDragState = null;
  }
});

// Exportar CSV: abre un diálogo nativo "Guardar como…" y escribe el archivo.
// El contenido lo genera el renderer (que ya tiene el estado y sabe qué rango exportar).
ipcMain.handle('export-csv', async (_e, { content, defaultName }) => {
  try {
    const parent = calendarWin && !calendarWin.isDestroyed() ? calendarWin : undefined;
    const baseDir = app.getPath('documents') || app.getPath('home') || app.getPath('desktop') || '';
    const { canceled, filePath } = await dialog.showSaveDialog(parent, {
      title: 'Exportar horas',
      defaultPath: path.join(baseDir, defaultName || 'cronota-horas.csv'),
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    fs.writeFileSync(filePath, '﻿' + (content || ''), 'utf8');  // BOM para que Excel respete los acentos
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

// ── Copia de seguridad (export/import de tareas y grupos a un .json local) ────
function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// Ajustes que no se restauran desde una copia: dependen de este equipo (qué pantalla, si arranca
// con Windows, qué versión hay instalada...). En el archivo van todos; al restaurar se saltan.
const AJUSTES_DE_ESTE_EQUIPO = ['dockDisplayId', 'dockDisplayKey', 'dockHiddenUntil', 'dndUntil', 'uiVersion'];

ipcMain.handle('export-backup', async (_e, extra) => {
  try {
    const parent = settingsWin && !settingsWin.isDestroyed() ? settingsWin : (mainWin || undefined);
    const baseDir = app.getPath('documents') || app.getPath('home') || app.getPath('desktop') || '';
    const { canceled, filePath } = await dialog.showSaveDialog(parent, {
      title: 'Exportar copia de seguridad',
      defaultPath: path.join(baseDir, `cronota-backup-${new Date().toISOString().slice(0, 10)}.json`),
      filters: [{ name: 'Copia de seguridad de Cronota', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    // La marca del archivo es solo informativa: al restaurar basta con que traiga tasks y groups,
    // así que las copias antiguas (con la marca de antes) se siguen pudiendo restaurar.
    // Copia completa: todas las tareas (con su historial de fichajes, también las archivadas y
    // las borradas), los grupos, todos los ajustes y las preferencias que guardan las pantallas.
    const local = extra && extra.local && typeof extra.local === 'object' ? extra.local : {};
    const payload = { cronotaBackup: true, version: 2, appVersion: app.getVersion(), exportedAt: new Date().toISOString(), tasks: state.tasks, groups: state.groups, outlookDescartadas: state.outlookDescartadas || [], notas: state.notas || [], seccionesNotas: state.seccionesNotas || [], cajaFuerte: state.cajaFuerte || null, settings, local };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    // 2.16: los archivos de las notas, en una carpeta al lado con el mismo nombre.
    const usados = copias.ficherosEnNotas(state);
    if (usados.length) copias.copiarArchivosNotas(carpetaArchivosNotas(), filePath.replace(/\.json$/i, '') + ' (archivos de notas)', usados);
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

// Guarda el backup ya leído entre 'import-backup' (que solo calcula qué hay que
// decidir) y 'apply-import-backup' (que lo aplica), para no tener que mandar todo
// el JSON de un lado a otro dos veces por IPC.
let pendingImport = null;

ipcMain.handle('import-backup', async () => {
  try {
    const parent = settingsWin && !settingsWin.isDestroyed() ? settingsWin : (mainWin || undefined);
    const { canceled, filePaths } = await dialog.showOpenDialog(parent, {
      title: 'Restaurar copia de seguridad',
      filters: [{ name: 'Copia de seguridad de Cronota', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths || !filePaths[0]) return { ok: false, canceled: true };
    const raw = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
    if (!raw || !Array.isArray(raw.tasks) || !Array.isArray(raw.groups)) {
      return { ok: false, error: 'El archivo no es una copia de seguridad válida de Cronota.' };
    }
    // Compara cada tarea/grupo de la copia con lo que ya hay en local por id: si no
    // existe es nuevo (se añade sin preguntar), si es idéntico se ignora en silencio,
    // y si existe pero con datos distintos es un conflicto que hay que decidir.
    const conflicts = [];
    let newCount = 0, sameCount = 0;
    const localTasksById = new Map(state.tasks.map(t => [t.id, t]));
    const localGroupsById = new Map(state.groups.map(g => [g.id, g]));
    raw.tasks.forEach(t => {
      const local = localTasksById.get(t.id);
      if (!local) newCount++;
      else if (deepEqual(local, t)) sameCount++;
      else conflicts.push({ kind: 'task', id: t.id, key: `task:${t.id}`, name: t.name, localName: local.name });
    });
    raw.groups.forEach(g => {
      const local = localGroupsById.get(g.id);
      if (!local) newCount++;
      else if (deepEqual(local, g)) sameCount++;
      else conflicts.push({ kind: 'group', id: g.id, key: `group:${g.id}`, name: g.name, localName: local.name });
    });
    pendingImport = raw;
    pendingImport.__ruta = filePaths[0];
    const hasSettings = !!(raw.settings && typeof raw.settings === 'object');
    return { ok: true, newCount, sameCount, conflicts, hasSettings };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle('apply-import-backup', async (_e, payload) => {
  if (!pendingImport) return { ok: false, error: 'No hay ninguna copia cargada.' };
  const raw = pendingImport; pendingImport = null;
  const res = (payload && payload.resolutions) || {};
  pauseActive();   // evita que un reemplazo deje la tarea activa en un estado ambiguo
  raw.groups.forEach(g => {
    const idx = state.groups.findIndex(x => x.id === g.id);
    if (idx === -1) { state.groups.push(g); return; }
    if (deepEqual(state.groups[idx], g)) return;
    if (res[`group:${g.id}`] === 'replace') state.groups[idx] = g;
  });
  raw.tasks.forEach(t => {
    const idx = state.tasks.findIndex(x => x.id === t.id);
    if (idx === -1) { state.tasks.push(t); return; }
    if (deepEqual(state.tasks[idx], t)) return;
    if (res[`task:${t.id}`] === 'replace') state.tasks[idx] = t;
  });
  // 2.16: notas y secciones de notas: se añaden las que no hay (por id). La caja fuerte, solo si
  // aquí no hay ninguna (no se mezclan dos cajas cifradas con PIN distintos).
  if (Array.isArray(raw.seccionesNotas)) raw.seccionesNotas.forEach(s => { if (s && s.id && !seccionesNotas().some(x => x.id === s.id)) seccionesNotas().push(s); });
  if (Array.isArray(raw.notas)) raw.notas.forEach(n => { if (n && n.id && !notas().some(x => x.id === n.id)) notas().push(n); });
  if (raw.cajaFuerte && raw.cajaFuerte.datos && !(state.cajaFuerte && state.cajaFuerte.datos)) state.cajaFuerte = raw.cajaFuerte;
  // Los archivos de las notas: de la carpeta de al lado de la copia, o de la de las copias automáticas.
  if (raw.__ruta) {
    const usados = copias.ficherosEnNotas(raw);
    if (usados.length) [raw.__ruta.replace(/\.json$/i, '') + ' (archivos de notas)', path.join(path.dirname(raw.__ruta), 'archivos de notas')]
      .forEach(dir => copias.copiarArchivosNotas(dir, carpetaArchivosNotas(), usados));
  }
  // 2.14.1: las sugerencias de Outlook descartadas se suman a las de aquí.
  if (Array.isArray(raw.outlookDescartadas) && raw.outlookDescartadas.length) {
    state.outlookDescartadas = [...new Set([...(state.outlookDescartadas || []), ...raw.outlookDescartadas.map(String)])].slice(-500);
  }
  saveData(); broadcastState();
  // Con los ajustes de la copia: se guardan y la app se reinicia para que todo (tema, barra,
  // avisos...) arranque ya con ellos, igual que al abrirla.
  if (payload && payload.withSettings && raw.settings && typeof raw.settings === 'object') {
    const nuevos = copias.ajustesTraspasables(raw.settings);
    AJUSTES_DE_ESTE_EQUIPO.forEach(k => { delete nuevos[k]; });
    Object.keys(nuevos).forEach(k => { if (!(k in settings)) delete nuevos[k]; });
    Object.assign(settings, nuevos);
    saveSettings();
    return { ok: true, restart: true, local: raw.local && typeof raw.local === 'object' ? raw.local : {} };
  }
  return { ok: true };
});

ipcMain.on('reiniciar-tras-copia', () => {
  try { saveSettings(); if (nubeSync) nubeSync.alSalir(); } catch {}   // 2.14.1: que la nube se lleve lo restaurado
  setTimeout(() => { try { app.relaunch(); } catch {} app.exit(0); }, 300);
});

// Foto de lo que hay DETRÁS del panel del dock (el escritorio y las demás apps), para su
// cristal líquido cuando la translucidez no está en mate. Cubre la zona más ancha que
// puede ocupar el panel (la del calendario), así sirve aunque cambie de ancho. Mientras se
// hace, el panel y la barrita se excluyen de las capturas (setContentProtection →
// WDA_EXCLUDEFROMCAPTURE) para no salir en su propia foto, y enseguida se dejan como
// estaban, para que sí salgan si compartes pantalla.
// La pantalla en directo para el cristal del recordatorio y de los ojos: el id de la pantalla
// donde está la ventana que lo pide, que se excluye de la captura para no verse a sí misma.
// Para la captura nativa del cristal (src/captura-dxgi.js, en la página): la pantalla donde
// está la ventana, en px lógicos (dip) y físicos (fis), para pasar de unos a otros. La ventana
// deja de salir en capturas (WDA_EXCLUDEFROMCAPTURE): si no, el cristal se vería a sí mismo.
// Ventanas excluidas de capturas por su cristal en vivo. Cuando el usuario va a hacer una captura
// (capturas-windows.js) se les quita la exclusión un momento, con el cristal congelado.
const ventanasExcluidas = new Set();
let capturaEnCurso = false;
function cristalesPausados(on) {
  ventanasExcluidas.forEach(w => { if (w.isDestroyed()) ventanasExcluidas.delete(w); else sendToAllFrames(w, 'captura-pausa', on); });
}
function exclusionCapturas(on) {
  ventanasExcluidas.forEach(w => { if (w.isDestroyed()) ventanasExcluidas.delete(w); else { try { w.setContentProtection(on); } catch {} } });
}
function alCambiarCaptura(empieza) {
  capturaEnCurso = empieza;
  if (empieza) {
    // Primero se congela el cristal (si no, vería la propia ventana) y luego se deja ver.
    cristalesPausados(true);
    setTimeout(() => { if (capturaEnCurso) exclusionCapturas(false); }, 60);
  } else {
    exclusionCapturas(true);
    setTimeout(() => { if (!capturaEnCurso) cristalesPausados(false); }, 90);
  }
}

// 2.8.5: el vigilante de capturas (mira el teclado cada 40 ms) solo corre mientras alguna
// ventana está excluida; con el estilo plano no hay ninguna y no corre.
let pararVigilante = null;
function actualizarVigilanteCapturas() {
  ventanasExcluidas.forEach(w => { if (w.isDestroyed()) ventanasExcluidas.delete(w); });
  if (ventanasExcluidas.size && !pararVigilante) pararVigilante = vigilarCapturas(alCambiarCaptura);
  else if (!ventanasExcluidas.size && pararVigilante) { pararVigilante(); pararVigilante = null; capturaEnCurso = false; }
}

ipcMain.handle('fuente-dxgi', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return null;
  if (!ventanasExcluidas.has(win)) win.once('closed', () => setTimeout(actualizarVigilanteCapturas, 0));
  ventanasExcluidas.add(win);
  actualizarVigilanteCapturas();
  if (capturaEnCurso) sendToAllFrames(win, 'captura-pausa', true);
  else { try { win.setContentProtection(true); } catch {} }
  try {
    const d = screen.getDisplayMatching(win.getBounds());
    let fis;
    try { fis = screen.dipToScreenRect(null, d.bounds); } catch { fis = null; }
    if (!fis) fis = { x: Math.round(d.bounds.x * d.scaleFactor), y: Math.round(d.bounds.y * d.scaleFactor), width: Math.round(d.bounds.width * d.scaleFactor), height: Math.round(d.bounds.height * d.scaleFactor) };
    return { dip: d.bounds, fis, sf: fis.width / d.bounds.width };
  } catch { return null; }
});

ipcMain.handle('fuente-pantalla', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return null;
  try { win.setContentProtection(true); } catch {}
  try {
    const disp = screen.getDisplayMatching(win.getBounds());
    const fuentes = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
    const src = fuentes.find(s => String(s.display_id) === String(disp.id)) || fuentes[0];
    const b = disp.bounds;
    return src ? { id: src.id, region: { x: b.x, y: b.y, w: b.width, h: b.height } } : null;
  } catch { return null; }
});

ipcMain.handle('capture-desktop', async (event, opts) => {
  // { propia: true }: lo que hay detrás de la ventana que lo pide (el recordatorio). Si no,
  // lo de detrás del panel del dock y su calendario.
  const propia = opts && opts.propia ? BrowserWindow.fromWebContents(event.sender) : null;
  const protegidas = (propia ? [propia] : [dockPanelWin, dockWin]).filter(w => w && !w.isDestroyed());
  try {
    let disp, region;
    if (propia) {
      const b = propia.getBounds();
      disp = screen.getDisplayMatching(b);
      region = { x: b.x, y: b.y, w: b.width, h: b.height };
    } else {
      disp = dockDisplay();
      const a = computePanelBounds('panel'), b = computePanelBounds('calendar');
      const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
      region = { x, y, w: Math.max(a.x + a.width, b.x + b.width) - x, h: Math.max(a.y + a.height, b.y + b.height) - y };
    }
    const sf = disp.scaleFactor || 1;
    protegidas.forEach(w => { try { w.setContentProtection(true); } catch {} });
    await new Promise(r => setTimeout(r, 40));   // que el sistema lo aplique antes de la foto
    const fuentes = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: Math.round(disp.bounds.width * sf), height: Math.round(disp.bounds.height * sf) },
    });
    const src = fuentes.find(s => String(s.display_id) === String(disp.id)) || fuentes[0];
    if (!src || !src.thumbnail || src.thumbnail.isEmpty()) return null;
    const k = src.thumbnail.getSize().width / disp.bounds.width;
    const img = src.thumbnail.crop({
      x: Math.round((region.x - disp.bounds.x) * k), y: Math.round((region.y - disp.bounds.y) * k),
      width: Math.round(region.w * k), height: Math.round(region.h * k),
    });
    const data = img.toBitmap();
    let { width: pw, height: ph } = img.getSize();
    if (data.length !== pw * ph * 4) {
      const s = Math.sqrt(data.length / 4 / (pw * ph));
      pw = Math.round(pw * s); ph = Math.round(ph * s);
      if (data.length !== pw * ph * 4) return null;
    }
    return { data, pw, ph, region };
  } catch { return null; }
  // Las que llevan cristal en vivo siguen excluidas (si no, se verían a sí mismas).
  finally { protegidas.forEach(w => { if (!ventanasExcluidas.has(w) || capturaEnCurso) { try { w.setContentProtection(false); } catch {} } }); }
});

// 2.8: foto de la ventana para el cristal líquido de los bocadillos (src/glass.js). Va en
// crudo (BGRA, sin comprimir: es lo más rápido) junto con el ancho de la página en px CSS,
// para saber la escala, y, si quien la pide va dentro del panel del dock (en un iframe),
// dónde cae ese iframe dentro de la ventana.
ipcMain.handle('capture-region', async (event) => {
  try {
    const wc = event.sender;
    if (!wc || wc.isDestroyed()) return null;
    const frame = event.senderFrame;
    let vista = null;
    if (frame && frame.parent) {
      vista = Object.keys(DOCK_VIEW_FILE).find(v => (frame.url || '').includes(DOCK_VIEW_FILE[v]));
      if (!vista) return null;
    }
    const sitio = await wc.executeJavaScript(`(() => {
      const f = ${vista ? `document.querySelector('iframe[data-view="${vista}"]')` : 'null'};
      const r = f ? f.getBoundingClientRect() : { left: 0, top: 0 };
      return { iw: window.innerWidth, ih: window.innerHeight, x: r.left, y: r.top };
    })()`);
    if (!sitio || !sitio.iw) return null;
    const img = await wc.capturePage();
    if (!img || img.isEmpty()) return null;
    const data = img.toBitmap();
    let { width: pw, height: ph } = img.getSize();
    if (data.length !== pw * ph * 4) {
      // Según la versión, getSize() va en px lógicos y el mapa de bits en px reales.
      const s = Math.sqrt(data.length / 4 / (pw * ph));
      pw = Math.round(pw * s); ph = Math.round(ph * s);
      if (data.length !== pw * ph * 4) return null;
    }
    return { data, pw, ph, iw: sitio.iw, ih: sitio.ih, offX: sitio.x, offY: sitio.y };
  } catch { return null; }
});

function startTick() {
  tickTimer = setInterval(() => {
    // broadcastState ya actualiza la bandeja: llamarla también aquí era hacerlo doble.
    if (state.activeTaskId) broadcastState({ tic: true });
    else updateTrayTitle();
  }, 1000);
}

// ── Actualizaciones (2.13: solo Microsoft Store) ──────────────────────────────────
// La app solo se publica en la Store, que la actualiza sola. «Buscar actualizaciones…» (bandeja
// y Ajustes) abre su ficha en la Store, donde sale «Actualizar» si hay una versión nueva.
function checkForUpdates(manual) {
  if (manual) { try { require('electron').shell.openExternal('ms-windows-store://pdp/?productid=9NXSJVW6BXQF'); } catch {} }
}

// 2.14.3: la Store no puede actualizar Cronota mientras está abierta (da error si le das a
// «Actualizar»). Cronota mira en el catálogo público de la Store qué versión hay publicada y, si
// es más nueva, lo avisa una vez y ofrece «Cerrar y actualizar» (aviso, bandeja y Ajustes): abre
// la ficha de la Store y se cierra. La tarea en marcha no se para: si vuelves a abrir Cronota en
// menos de media hora, sigue contando como si nada (ver repararCierreDeGolpe).
const CATALOGO_STORE = 'https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=9NXSJVW6BXQF&market=ES&languages=es-es';
let versionNueva = null;
function versionDelCatalogo(texto) {
  let mejor = null;
  const re = new RegExp('Cronota_(\\d+)\\.(\\d+)\\.(\\d+)\\.\\d+_', 'g');
  let m;
  while ((m = re.exec(String(texto || '')))) {
    const v = m[1] + '.' + m[2] + '.' + m[3];
    if (!mejor || compararVersiones(v, mejor) > 0) mejor = v;
  }
  return mejor;
}
async function buscarVersionNueva() {
  if (!IS_STORE) return;
  try {
    const r = await net.fetch(CATALOGO_STORE);
    if (!r.ok) return;
    const v = versionDelCatalogo(await r.text());
    if (!v || compararVersiones(v, app.getVersion()) <= 0) return;
    const yaAvisada = settings.versionNuevaAvisada === v;
    versionNueva = v;
    [settingsWin, dockPanelWin].forEach(w => sendToAllFrames(w, 'version-nueva', v));
    if (yaAvisada) return;
    settings.versionNuevaAvisada = v; saveSettings();
    avisar({ que: 'Actualización', icono: 'flecha', duracion: 20000, titulo: `Cronota ${v} está lista`, sub: 'Se cierra, se actualiza en la Store y tu tarea sigue contando',
      acciones: [{ a: 'actualizar', label: 'Cerrar y actualizar', clase: 'hecha' }], al: { actualizar: () => cerrarYActualizar() } });
  } catch {}
}
function cerrarYActualizar() {
  // 2.14.9: antes se abría la Store y la app se cerraba con calma (app.quit cierra ventana a
  // ventana y tarda unos segundos). Si le dabas a «Actualizar» enseguida, Cronota seguía viva y la
  // Store daba error («Reintentar»). Ahora se guarda todo, se quitan bandeja y ventanas y el
  // proceso sale en cuanto Windows ha lanzado la Store, que tarda más en abrirse que esto.
  saliendo = true;
  settings.cerradoParaActualizar = Date.now();
  settings.ultimoLatido = Date.now();
  try { saveData(); saveSettings(); if (nubeSync) nubeSync.alSalir(); } catch {}
  try { if (tray) { tray.destroy(); tray = null; } } catch {}
  try { BrowserWindow.getAllWindows().forEach(w => { try { w.destroy(); } catch {} }); } catch {}
  const salir = () => { try { app.exit(0); } catch {} };
  let abierta;
  try { abierta = require('electron').shell.openExternal('ms-windows-store://pdp/?productid=9NXSJVW6BXQF'); } catch {}
  Promise.resolve(abierta).catch(() => {}).then(() => setTimeout(salir, 100));
  setTimeout(salir, 1500);   // por si Windows no contesta
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
// ── Reuniones apuntadas antes de tiempo (2.12) ──────────────────────────────────
// Una reunión de Outlook añadida antes de que empiece ya está en el calendario. Cuando llega su
// hora, si sigue en marcha otra tarea, esa tarea se corta justo al empezar la reunión (para no
// contar doble) y se vuelve a poner en marcha sola al acabar, desde la hora de fin. Si mientras
// tanto pones otra en marcha, ya no se reanuda nada.
let reanudarTrasReunion = null;   // { taskId, subId, en }
function vigilarReunionesPlaneadas() {
  const ahora = Date.now();
  const activa = getActiveTask();
  const enMarcha = entradaEnCurso(activa);
  if (enMarcha && enMarcha.end == null) {
    let reunion = null;
    state.tasks.forEach(t => { if (!t.deleted) t.entries.forEach(e => {
      if (e.outlookId && e !== enMarcha && e.end != null && e.start > enMarcha.start && e.start <= ahora && (!reunion || e.start < reunion.start)) reunion = e;
    }); });
    if (reunion) {
      fotoAntesDe('reunion-planeada');
      enMarcha.end = reunion.start;
      reanudarTrasReunion = { taskId: activa.id, subId: state.activeSubId, en: reunion.end };
      state.activeTaskId = null; state.activeSubId = null;
      saveData(); broadcastState(); resetReminderTimer();
    }
  }
  if (reanudarTrasReunion && Date.now() >= reanudarTrasReunion.en) {
    const r = reanudarTrasReunion; reanudarTrasReunion = null;
    if (!state.activeTaskId && state.tasks.some(t => t.id === r.taskId && !t.deleted)) {
      startTask(r.taskId, Math.max(0, (Date.now() - r.en) / 60000), r.subId);
    }
  }
}

// ── Outlook (enlace ICS) y llamadas (2.12) ─────────────────────────────────────
let outlook = null, vigiaLlamadas = null;
function avisarReuniones() {
  BrowserWindow.getAllWindows().forEach(w => { try { if (!w.isDestroyed()) sendToAllFrames(w, 'reuniones-cambiadas'); } catch {} });
}
function arrancarOutlookYLlamadas() {
  try {
    outlook = outlookIcs.crear({ carpeta: app.getPath('userData'), alCambiar: avisarReuniones, fetchFn: (u, o) => net.fetch(u, o) });
    outlook.configurar(settings.outlookIcsUrl);
  } catch {}
  try {
    vigiaLlamadas = enLlamada.vigilar((apps) => { appsEnLlamada = apps; broadcastState(); });
    if (settings.silenciarEnLlamada !== false) vigiaLlamadas.encender();
  } catch {}
}
ipcMain.handle('reuniones', (_e, r) => {
  try { return outlook ? outlook.reuniones(Number(r && r.desde) || 0, Number(r && r.hasta) || 0) : []; } catch { return []; }
});
ipcMain.handle('en-llamada', () => appsEnLlamada);

// ── Sincronizar con OneDrive o Google Drive (2.14) ────────────────────────────────
let nubeSync = null;
function avisarNube() {
  const e = nubeSync ? nubeSync.estado() : null;
  [settingsWin, dockPanelWin].forEach(w => sendToAllFrames(w, 'nube-estado', e));
}
function arrancarNube() {
  try {
    nubeSync = nube.crear({
      getEstado: () => state,
      aplicar: (datos) => {
        fotoAntesDe('nube');   // Ctrl+Z vuelve a lo de antes
        // 2.16: si la caja fuerte cambia desde otro PC, se cierra la de aquí (para no pisar lo de allí).
        if (datos.cajaFuerte !== undefined && (datos.cajaFuerte && datos.cajaFuerte.datos) !== (state.cajaFuerte && state.cajaFuerte.datos)) cajaCerrar();
        state = { ...state, ...datos };
        if (!Array.isArray(state.groups)) state.groups = [];
        saveDataRaw(); broadcastState(); resetReminderTimer();
      },
      ajustes: () => settings,
      guardar: () => saveSettingsSoon(),
      ajustesParaSubir: () => { const a = ajustesQueViajan(); firmaAjustesNube = JSON.stringify(a); return a; },
      archivos: {   // 2.16: los archivos de las notas
        subir: (dir) => copias.copiarArchivosNotas(carpetaArchivosNotas(), dir, copias.ficherosEnNotas(state)),
        bajar: (dir) => { if (copias.copiarArchivosNotas(dir, carpetaArchivosNotas(), copias.ficherosEnNotas(state))) broadcastState(); },
      },
      aplicarAjustes: aplicarAjustesDeOtroPC,
      avisar: (title, body) => avisoSimple(title, body, { que: 'Sincronizar', icono: 'nube' }),
      alCambiarEstado: avisarNube,
    });
    firmaAjustesNube = JSON.stringify(ajustesQueViajan());   // 2.14.1: punto de partida
    nubeSync.arrancar();
  } catch {}
}
// 2.14.1: los ajustes que llegan de otro PC se ponen al momento, sin reiniciar.
function aplicarAjustesDeOtroPC(remotos) {
  const nuevos = {};
  AJUSTES_QUE_SE_SINCRONIZAN.forEach(k => { if (remotos[k] !== undefined) nuevos[k] = remotos[k]; });
  const antes = JSON.stringify(ajustesQueViajan());
  const eyeAntes = settings.eyeCareEnabled + '|' + settings.eyeCareEvery;
  Object.assign(settings, nuevos);
  if (!THEMES[settings.theme]) settings.theme = DEFAULT_THEME;
  const ahora = JSON.stringify(ajustesQueViajan());
  firmaAjustesNube = ahora;   // vienen de la nube: no hay que volver a subirlos
  if (ahora === antes) return;
  saveSettings();
  try { resetReminderTimer(); } catch {}
  try { applyTranslucencyAll(); } catch {}
  try { sendDockConfig(); } catch {}
  try { if (outlook) outlook.configurar(settings.outlookIcsUrl); } catch {}
  try { if (vigiaLlamadas) { if (settings.silenciarEnLlamada !== false) vigiaLlamadas.encender(); else vigiaLlamadas.apagar(); } } catch {}
  try { startEyeCareTimer(eyeAntes !== settings.eyeCareEnabled + '|' + settings.eyeCareEvery); } catch {}
  broadcastState();
  // Ajustes abierto: que enseñe lo nuevo (si no, al tocar algo guardaría lo de antes encima).
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('settings', { ...settings, appVersion: app.getVersion(), isStore: IS_STORE, versionNueva });
}
ipcMain.handle('nube-estado', () => (nubeSync ? nubeSync.estado() : null));
ipcMain.on('nube', (_e, p) => {
  if (!nubeSync) return;
  const accion = p && p.accion;
  if (accion === 'elegir') {
    const servicio = nube.SERVICIOS[p.servicio] ? p.servicio : '';
    settings.nube = servicio;
    settings.nubeVersion = 0;
    // Si aquí ya hay tareas, se tratan como cambios por subir: si en la nube ya hubiera datos de
    // otro PC, no se pisan: se apartan como conflicto y se avisa (ver nube.js).
    settings.nubePendiente = !!(servicio && state.tasks.some(t => !t.deleted));
    saveSettings();
    nubeSync.arrancar();
  } else if (accion === 'quitar') {
    nubeSync.parar();
    settings.nube = ''; settings.nubePendiente = false; saveSettings();
    nubeSync.arrancar();
  } else if (accion === 'carpeta') {
    // 2.14.5: elegir la carpeta dentro de OneDrive / Google Drive. Tiene que estar dentro.
    const e = nubeSync.estado();
    const raiz = e.carpeta;
    if (!raiz) { avisarNube(); return; }
    const parent = settingsWin && !settingsWin.isDestroyed() ? settingsWin : (dockPanelWin && !dockPanelWin.isDestroyed() ? dockPanelWin : undefined);
    const nombre = nube.SERVICIOS[e.servicio] ? nube.SERVICIOS[e.servicio].nombre : 'tu nube';
    const actual = path.join(raiz, nube.carpetaRelativa(settings.nubeCarpeta));
    dialog.showOpenDialog(parent, {
      title: `Carpeta de ${nombre} donde guardar Cronota`,
      defaultPath: fs.existsSync(actual) ? actual : raiz,
      properties: ['openDirectory', 'createDirectory'],
    }).then(({ canceled, filePaths }) => {
      if (canceled || !filePaths || !filePaths[0]) return;
      const rel = path.relative(raiz, filePaths[0]);
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        dialog.showMessageBox(parent, { type: 'warning', title: 'Cronota', message: `Elige una carpeta dentro de ${nombre}`, detail: `Tiene que estar dentro de ${raiz} para que ${nombre} la suba a tu nube.` }).catch(() => {});
        return;
      }
      const nueva = rel === '' ? '.' : rel;
      if (nube.carpetaRelativa(settings.nubeCarpeta) === nueva) return;
      nubeSync.parar();
      settings.nubeCarpeta = nueva;
      // Como al elegir el servicio: si en la carpeta nueva ya hay datos de otro PC, no se pisan.
      settings.nubeVersion = 0;
      settings.nubePendiente = state.tasks.some(t => !t.deleted);
      saveSettings();
      nubeSync.arrancar();
      avisarNube();
    }).catch(() => {});
    return;
  } else if (accion === 'ahora') {
    nubeSync.ahora();
  } else if (accion === 'abrir-carpeta') {
    const e = nubeSync.estado();
    if (e.archivo) { try { require('electron').shell.showItemInFolder(e.archivo); } catch {} }
  } else if (accion === 'descargar' && nube.SERVICIOS[p.servicio]) {
    try { require('electron').shell.openExternal(nube.SERVICIOS[p.servicio].descarga); } catch {}
  }
  avisarNube();
});
ipcMain.handle('outlook-estado', async (_e, opts) => {
  if (!outlook) return { conectado: false };
  if (opts && opts.probar) await outlook.descargar();
  const lunes = new Date(); lunes.setHours(0, 0, 0, 0); lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  const n = outlook.reuniones(lunes.getTime(), lunes.getTime() + 7 * 86400000).length;
  return { ...outlook.estado(), estaSemana: n };
});

app.whenReady().then(() => {
  // El vigilante de capturas arranca solo cuando alguna ventana se excluye (ver fuente-dxgi).
  DATA_FILE = path.join(app.getPath('userData'), 'imputa-tasks.json');
  SETTINGS_FILE = path.join(app.getPath('userData'), 'imputa-settings.json');
  loadData();
  // En modo pruebas las copias van a su carpeta temporal, no a tus Documentos.
  try { copias.configurar({ documentos: MODO_PRUEBAS ? path.join(app.getPath('userData'), 'Documentos') : app.getPath('documents') }); } catch {}
  pruneWeekOverrides();
  applySystemThemeSource();
  // Instalación nueva: el recorrido va solo por las cuatro pantallas. En cualquier otro
  // caso hay que pedirlo desde Ajustes; si no, a quien le quedaran pasos sueltos se lo
  // encontraría paseándole por la app en cada arranque.
  if (!(settings.tutorialSeenSteps || []).length) tourActive = true;
  repararCierreDeGolpe();   // 2.13: antes que nada que use la tarea en marcha
  try { const { powerMonitor } = require('electron'); powerMonitor.on('suspend', alSuspender); powerMonitor.on('resume', alDespertar); powerMonitor.on('lock-screen', cajaCerrar); powerMonitor.on('suspend', cajaCerrar); } catch {}
  setInterval(vigilarRecordatoriosNotas, 20000); setTimeout(vigilarRecordatoriosNotas, 5000);   // 2.16
  setTimeout(limpiarArchivosNotas, 15000);
  latir(); setInterval(latir, 60000);
  setTimeout(buscarVersionNueva, 60000); setInterval(buscarVersionNueva, 4 * 60 * 60 * 1000);   // 2.14.3
  startLeaveWatcher();
  startEyeCareTimer();
  arrancarOutlookYLlamadas();
  arrancarNube();
  setInterval(vigilarReunionesPlaneadas, 20000);   // 2.12
  // No molestar se apaga solo al vencer: dndActive() lo caduca y avisa a las vistas.
  setInterval(() => { if (settings.dndUntil) dndActive(); }, 30000);

  const trayIcon = nativeImage.createFromPath(APP_ICON_PATH).resize({ width: 32, height: 32, quality: 'best' });

  tray = new Tray(trayIcon);
  tray.setToolTip('Cronota');
  // El menú se monta al abrirlo, no cada segundo (ver updateTrayTitle).
  tray.on('right-click', () => { try { tray.popUpContextMenu(buildTrayMenu()); } catch {} });
  tray.on('click', () => openLastView());

  // Conectar/desconectar monitores o cambiar su resolución deja las medidas viejas.
  ['display-added', 'display-removed', 'display-metrics-changed'].forEach(ev => {
    try {
      screen.on(ev, () => {
        // Varias pasadas: al desconectar un monitor, Windows tarda un poco en dejar
        // las áreas de trabajo definitivas, y una sola pasada inmediata las coge a medias.
        [0, 400, 1500, 4000].forEach(ms => setTimeout(() => {
          if (!settings.dockMode) return;
          positionDock(); syncDockBounds(); ensureDockBarVisible();
        }, ms));
      });
    } catch {}
  });
  setInterval(() => {
    if (!settings.dockMode) return;
    // dockIsHidden() caduca el escondite solo, y ensureDockBarVisible la devuelve
    // (y le reafirma el nivel, por si algo a pantalla completa se puso delante).
    if (dockIsHidden()) return;
    ensureDockBarVisible();   // ya hace syncDockBounds
  }, 3000);

  startTick();
  resetReminderTimer();
  // Si arranca solo por el inicio de sesión de Windows (--hidden), no se abre el panel.
  // PERO en modo barra flotante la barrita ES la presencia de la app (ya es discreta de
  // por sí), así que hay que crearla igualmente: si no, arrancar con Windows dejaba la
  // app sin nada visible salvo el icono de la bandeja.
  // 2.9.2: la versión de la Store arranca con Windows por su tarea de inicio, que no pasa
  // "--hidden"; ahí se deduce mirando si la sesión acaba de empezar.
  if (process.argv.includes('--hidden') || (IS_STORE && copias.arranqueDeSesion())) {
    if (settings.dockMode) {
      createDock();
      // Arrancando con Windows, las pantallas todavía no son las definitivas: se recoloca
      // un par de veces después para que la barrita no quede fuera ni en medio.
      setTimeout(ensureDockBarVisible, 2500);
      setTimeout(ensureDockBarVisible, 8000);
    }
  } else {
    showSplashThenMain();
  }
  maybeShowWhatsNew();
  // 2.9.2: una copia al día en Documentos\Cronota\Copias automáticas. La versión de la Store
  // guarda sus datos dentro del paquete, y Windows los borra si se desinstala.
  if (app.isPackaged) {
    copias.copiaDelDia(state, settings, carpetaArchivosNotas());
    setInterval(() => copias.copiaDelDia(state, settings, carpetaArchivosNotas()), 3 * 60 * 60 * 1000);
  }
});

app.on('window-all-closed', e => e.preventDefault());
// saveSettings() explícito: saveSettingsSoon puede tener un guardado pendiente (p. ej.
// la última vista abierta) que se perdería si la app se cierra antes de que salte.
// ── Apagar el PC con una tarea en marcha (2.13) ───────────────────────────────────
// Antes, al apagar Windows con una tarea en marcha, el rato se quedaba abierto y al día
// siguiente contaba toda la noche. Ahora:
//   - al cerrar sesión o apagar, Windows avisa a cada ventana ('session-end') y se para ahí;
//   - si la app se cierra de golpe (se va la luz, se cuelga), cada minuto se apunta que sigue
//     viva, y al volver a abrirla la tarea se para en ese último minuto y se avisa.
function alTerminarSesion() {
  if (saliendo) return;
  saliendo = true;
  try { pauseActive(); saveData(); settings.ultimoLatido = Date.now(); saveSettings(); if (nubeSync) nubeSync.alSalir(); } catch {}
}
app.on('browser-window-created', (_e, w) => { try { w.on('session-end', alTerminarSesion); } catch {} });

// 2.14: si el portátil se suspende (se cierra la tapa) con una tarea en marcha y pasa más de media
// hora dormido, al despertar la tarea se para a la hora en que se durmió y se avisa. Antes contaba
// toda la noche. Una suspensión corta (moverte de sala) no la toca.
let suspendidoEn = 0;
function alSuspender() { suspendidoEn = Date.now(); settings.ultimoLatido = suspendidoEn; saveSettings(); }
function alDespertar() {
  const desde = suspendidoEn; suspendidoEn = 0;
  if (!desde || Date.now() - desde < 30 * 60000) return;
  const task = getActiveTask();
  const ultima = entradaEnCurso(task);
  if (!ultima || ultima.end != null || ultima.start >= desde) return;
  fotoAntesDe('suspender');
  ultima.end = desde;
  state.activeTaskId = null; state.activeSubId = null;
  saveData(); broadcastState(); resetReminderTimer();
  const hora = new Date(desde).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  avisoSimple('Cronota paró una tarea', `El equipo se suspendió con «${task.name}» en marcha. La he parado a las ${hora}. Si seguías trabajando, Ctrl+Z en el calendario lo deshace.`, { icono: 'pausa', duracion: 30000 });
}

function latir() { settings.ultimoLatido = Date.now(); saveSettings(); }
function repararCierreDeGolpe() {
  // 2.14.3: cerrada para actualizar. Si vuelve en menos de media hora, la tarea sigue contando
  // (el rato de la actualización también cuenta); si tarda más, se para cuando se cerró.
  const paraActualizar = Number(settings.cerradoParaActualizar) || 0;
  if (paraActualizar) {
    settings.cerradoParaActualizar = 0; saveSettings();
    if (Date.now() - paraActualizar < 30 * 60000) return;
  }
  const latido = Number(settings.ultimoLatido) || 0;
  const task = getActiveTask();
  const ultima = entradaEnCurso(task);
  if (!latido || !ultima || ultima.end != null) return;
  // Más de 10 minutos sin señal: la app no estuvo abierta todo ese rato.
  if (Date.now() - latido < 10 * 60000 || latido <= ultima.start) return;
  ultima.end = latido;
  state.activeTaskId = null; state.activeSubId = null;
  saveDataRaw();
  const hora = new Date(latido).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  setTimeout(() => {
    try {
      avisoSimple('Cronota paró una tarea', `Se cerró de golpe con «${task.name}» en marcha: la he parado a las ${hora}`, { icono: 'pausa', duracion: 30000 });
    } catch {}
  }, 4000);
}

app.on('before-quit', () => {
  saliendo = true;
  // 2.14.3: al cerrar para actualizar, la tarea en marcha no se para (ver cerrarYActualizar).
  if (!settings.cerradoParaActualizar) pauseActive();
  saveData(); saveSettings();
  if (nubeSync) nubeSync.alSalir();   // 2.14: que no quede nada sin subir a la nube
  // La bandeja se va con la app: si se queda, el instalador que se lanza al salir
  // (autoInstallOnAppQuit) puede seguir viendo el proceso vivo y pedir que la cierres.
  try { if (tray) { tray.destroy(); tray = null; } } catch {}
});
