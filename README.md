<a href="https://dripdev.dev"><img src="docs/readme/dripdev.png" alt="Un producto de DripDev" width="100%"></a>

<p align="center">
  <img src="docs/readme/portada.png" alt="Cronota: tus horas por tarea, sin pensar en ellas" width="100%">
</p>

<p align="center">
  <a href="https://github.com/roblesgg/cronota/releases/latest"><img src="https://img.shields.io/github/v/release/roblesgg/cronota?style=for-the-badge&label=descargar&color=818CF8" alt="Descargar la última versión"></a>
  <img src="https://img.shields.io/badge/Windows-10%20%C2%B7%2011-1C1C2A?style=for-the-badge&logo=windows&logoColor=A69EDB" alt="Windows 10 y 11">
  <img src="https://img.shields.io/badge/%E2%97%8F-en%20marcha-F53F4C?style=for-the-badge" alt="En marcha">
</p>

**Cronota** cuenta el tiempo que dedicas a cada tarea mientras trabajas. Un clic para empezar, otro para parar. A final de semana, el calendario te dice dónde fue cada hora, e imputar es copiar y pegar.

Vive en la bandeja del sistema y no molesta.

<p align="center">
  <img src="docs/readme/capturas.png" alt="Calendario semanal de Cronota" width="100%">
</p>

## Qué puedes hacer

| | |
|---|---|
| ▶️ **Un botón por tarea** | Empezar, pausar o cambiar de tarea en un clic. Solo corre una a la vez. |
| 🗒️ **Notas** | Una fija por tarea (el código del proyecto, por ejemplo) y otra para cada sesión. |
| 📅 **Calendario semanal** | Ves tus bloques de tiempo, los corriges y añades los que se te pasaron. |
| ⏱️ **Recordatorio** | Un aviso discreto si una tarea lleva mucho rato corriendo. |
| ✅ **No pierde nada** | Cada cambio se guarda al momento. Ni un apagón te quita un minuto. |
| ☕ **No molestar** | Silencia los avisos cuando necesitas concentrarte. |

## Descárgala

En la [última versión](https://github.com/roblesgg/cronota/releases/latest):

| Archivo | Para quién |
|---|---|
| `cronota-setup.exe` | Instalador. **Se actualiza sola.** Recomendado. |
| `cronota-portable.exe` | Sin instalar, por ejemplo desde un USB. |

Pronto también en la Microsoft Store.

## Hecho con

Electron con HTML, CSS y JavaScript, sin framework. Tipografías Zalando Sans y Zalando Sans Expanded.

<details>
<summary><b>Para desarrollar</b></summary>

<br>

```bash
npm install
npm start          # modo desarrollo (o tools/iniciar-dev.vbs)
npm run check      # comprobaciones antes de publicar
```

Cómo está montado el proyecto:

| Carpeta | Qué hay |
|---|---|
| `main.js`, `sync.js`… | Proceso principal de la app |
| `src/` | Pantallas (HTML, CSS y JS) |
| `assets/`, `build/`, `build-hooks/` | Iconos, letras y personalización del instalador |
| `movil/` | App del móvil |
| `web/` | Web de descarga |
| `tools/` | Comprobaciones, capturas y arranque en desarrollo |
| `docs/` | [Roadmap](docs/ROADMAP.md), [notas técnicas](docs/notas-tecnicas.md) y la ficha de la Microsoft Store |

El roadmap explica también cómo se publica cada versión (beta → estable → Microsoft Store).

</details>

---

<p align="center"><sub>Un producto de <a href="https://dripdev.dev"><b>DripDev</b></a> · hecho por Álvaro Robles</sub></p>
