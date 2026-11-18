# Política de privacidad de Cronota

_Última actualización: 18 de noviembre de 2026_

Cronota es una aplicación para Windows que registra el tiempo que dedicas a cada tarea para que luego puedas imputarlo. Esta política explica qué datos maneja, dónde se guardan y qué control tienes sobre ellos.

## Quién es el responsable

Álvaro Robles González (DripDev), desarrollador y editor de Cronota. Para cualquier duda sobre tus datos: **roblesgg16@gmail.com**.

## Datos que se guardan en tu equipo

Tus tareas, secciones, los ratos de tiempo registrados, sus notas y tus ajustes se guardan **solo en tu ordenador**, en la carpeta de datos de la aplicación de tu usuario de Windows. No salen de tu equipo salvo que actives la sincronización descrita abajo.

Para que no los pierdas si desinstalas la app, Cronota guarda además **una copia de tus tareas y secciones cada día** en tu carpeta Documentos, en `Documentos\Cronota\Copias automáticas` (se quedan las 14 últimas). Al pasar de la versión del instalador a la de Microsoft Store también deja una copia en `Documentos\Cronota\cronota-traspaso.json`. Si tu carpeta Documentos se sincroniza con OneDrive u otro servicio, estas copias se sincronizan con ella como cualquier otro documento tuyo.

## Sincronización con una cuenta (opcional)

Si inicias sesión para sincronizar Cronota con la aplicación móvil, se usan estos datos:

- **Tu correo electrónico y tu contraseña**, para identificarte. La contraseña la gestiona el servicio de autenticación de Supabase y nunca se guarda en texto legible.
- **Tus tareas y los ratos de tiempo registrados**, que se guardan en la base de datos de Supabase (proveedor de base de datos en la nube) para tenerlos iguales en todos tus dispositivos.

Sin cuenta, la aplicación funciona igual, solo que en local.

## Lectura de la pantalla para el efecto de cristal

Con el estilo «Cristal líquido», Cronota lee la imagen de la pantalla que queda detrás de sus paneles para dibujar el efecto de cristal desenfocado. Esa imagen se usa **solo en memoria, en tu equipo**: no se guarda en disco ni se envía a ningún sitio. Si prefieres que no se lea la pantalla, elige el estilo «Plano» en Ajustes → Apariencia.

## Calendario de Outlook (opcional)

Si pegas en Ajustes el vínculo ICS de un calendario que has publicado en Outlook, Cronota lo descarga desde Microsoft cada 15 minutos para enseñarte tus reuniones en su calendario. El vínculo y la última copia del calendario se guardan solo en tu equipo y no se envían a nadie más. Cronota solo lee ese calendario: no puede crear, cambiar ni borrar reuniones. Para dejar de usarlo, pulsa «Quitar» en Ajustes, y si quieres que el vínculo deje de funcionar, deja de publicar el calendario en Outlook.

## Llamadas (opcional)

Si tienes encendido «Sin avisos en llamadas», Cronota mira cada 20 segundos en el registro de Windows qué aplicaciones están usando el micrófono, solo para saber si estás en una llamada y no interrumpirte con avisos. Cronota no usa el micrófono, no escucha nada y no guarda esa información.

## Portapapeles

Cronota solo escribe en el portapapeles cuando tú copias algo desde la aplicación (por ejemplo, un rato del calendario). No lee lo que copias en otras aplicaciones.

## Actualizaciones

La versión de Microsoft Store se actualiza a través de la propia Store. La versión que se instala desde nuestra web consulta GitHub para saber si hay una versión nueva; esa consulta no incluye ninguno de tus datos.

## Lo que no hacemos

- No mostramos publicidad.
- No usamos herramientas de analítica ni de seguimiento.
- No vendemos ni cedemos tus datos a terceros.

## Tus derechos

Los datos locales los borras al desinstalar Cronota o eliminando su carpeta de datos, y las copias, borrando la carpeta `Documentos\Cronota`. Si usas una cuenta, puedes pedir en cualquier momento que te enviemos, corrijamos o borremos tus datos y tu cuenta escribiendo a **roblesgg16@gmail.com**. También puedes presentar una reclamación ante la Agencia Española de Protección de Datos (aepd.es).

## Cambios en esta política

Si cambia algo importante, actualizaremos esta página y la fecha de arriba.
