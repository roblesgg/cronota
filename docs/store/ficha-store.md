# Ficha de Cronota en Microsoft Store (español)

Textos para copiar en Partner Center → envío → **Descripciones de Store** → Español (España).
Las capturas están en esta misma carpeta (1366×768, con datos inventados).

## Descripción

Cronota registra el tiempo que dedicas a cada tarea para que, al final del día, imputar tus horas sea cuestión de un minuto.

Dale al play en una tarea y Cronota cuenta por ti. Cambia a otra y el contador la sigue. Cada rato puede llevar su nota («Maquetando la portada»), y cada tarea una nota fija que siempre tienes a mano, como el número de proyecto o el código de imputación.

Lo que te ofrece:

• Contador por tarea, con el tiempo de hoy siempre a la vista.
• Calendario semanal con todos tus ratos: arrástralos, cópialos y pégalos, cámbiales la hora o añade los que olvidaste.
• Totales del día, de la semana y del mes, por tarea.
• Tareas organizadas por secciones (clientes, proyectos…), recurrentes o puntuales.
• Botón «Imputar» que te lleva directo a tu herramienta de imputación.
• Recordatorio discreto mientras tienes una tarea en marcha y aviso a la hora de salir.
• Barra flotante en el borde de la pantalla: un toque y aparece el panel, otro y desaparece.
• Descanso visual opcional para mirar lejos cada cierto tiempo.
• Temas claros y oscuros, colores de acento y estilo de cristal o plano.
• Funciona sin cuenta, con tus datos en tu equipo. Si quieres, inicia sesión para sincronizarlo con el móvil.

Sin publicidad y sin seguimiento.

## Novedades de esta versión

Esta versión trae un lavado de cara completo: letra nueva, Ajustes por categorías, una tarjeta más clara para la tarea en marcha, un diálogo de nueva tarea más sencillo y un calendario más pulido.

## Características del producto (una por línea)

Contador de tiempo por tarea con un clic
Calendario semanal para revisar y corregir tus ratos
Totales por día, semana y mes
Tareas organizadas por secciones
Notas por rato y nota fija por tarea
Botón Imputar hacia tu herramienta de imputación
Barra flotante en el borde de la pantalla
Recordatorios y aviso a la hora de salir
Temas claros y oscuros
Funciona sin cuenta; sincronización opcional con el móvil

## Palabras clave (máximo 7)

control de horas
registro de tiempo
imputar horas
cronómetro
productividad
parte de horas
time tracking

## Descripción corta (si la pide)

Registra el tiempo de cada tarea con un clic e imputa tus horas en un minuto.

## Otros campos

- **Categoría**: Productividad.
- **URL de la política de privacidad**: https://github.com/roblesgg/cronota/blob/main/PRIVACIDAD.md (el envío de la 2.9.1 lleva la del nombre antiguo del repositorio, que redirige a esta; cambiarla en el envío de la 2.9.2)
- **Correo de soporte**: roblesgg16@gmail.com
- **Justificación de runFullTrust** (Opciones de envío → Capacidades restringidas):
  > Cronota es una aplicación de escritorio (Electron) que vive en la bandeja del sistema y muestra una barra flotante y recordatorios por encima de otras ventanas. Necesita ejecutarse como aplicación de escritorio de plena confianza para esas ventanas, para el icono de la bandeja y para guardar sus datos localmente.

## Imágenes (en esta carpeta)

En Partner Center: *Actualizar* el envío → *Fichas de Store* → *Español (España)*.

| Archivo | Dónde va |
|---|---|
| `captura-1-portada.png` … `captura-5-personalizable.png` (1920×1080), por ese orden | Capturas de pantalla → Escritorio |
| `logo-icono-300.png`, `logo-icono-150.png` y `logo-icono-71.png` (transparentes) | Imágenes para mostrar en Store → iconos 1:1 de 300, 150 y 71. En la ficha sustituyen a los del paquete |
| `logo-caja-1080.png` (1080×1080) | Logotipos de la tienda → arte de caja 1:1 |
| `logo-poster-720x1080.png` (720×1080) | Logotipos de la tienda → arte de póster 2:3 |

El icono de la app (menú Inicio, barra de tareas) sale del paquete `.appx`, que ya lleva el logo nuevo desde la 2.9.2. Los logotipos se rehacen con `npx electron tools/imagenes-store.js` y las capturas con `npx electron tools/capturas-store.js` (los dos sin `ELECTRON_RUN_AS_NODE`). Las capturas usan una semana de trabajo inventada; hay que rehacerlas cuando llegue la interfaz nueva.

## Política de privacidad

El texto está en `web/privacidad.html`. Antes de usarla:

1. Correo de contacto: roblesgg16@gmail.com (ya puesto).
2. Publícala. La carpeta `web/` es la web de descarga (Vercel): al desplegarla quedará en `https://<tu-dominio>/privacidad.html`. Esa es la URL para Partner Center.
