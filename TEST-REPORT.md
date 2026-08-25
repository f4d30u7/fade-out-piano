# Verificación de Fade Out Piano Web 1.1.0

Fecha: 25 de agosto de 2026

## Navegación e interfaz

- Carga correcta de las nueve secciones: Hoy, Semana, Repertorio, Mi laboratorio, Teoría, Improvisación, Lectura, Progreso y Ajustes.
- Tarjeta de administración web visible en Ajustes.
- Ayuda de instalación específica para iPad/iPhone.
- Vista móvil de 390 px sin desborde horizontal, incluida la sección Lectura.
- Sin errores de JavaScript ni errores de consola durante el recorrido automatizado.

## PWA

- Manifest procesado sin errores por Chromium.
- `start_url` y `scope` resueltos correctamente dentro de una subcarpeta, equivalente a un sitio de proyecto de GitHub Pages.
- Service worker registrado y activado con control sobre la aplicación.
- Recarga offline completada correctamente después de la primera carga.
- Iconos de 192, 512 y 180 px verificados.
- Capturas de escritorio y móvil verificadas contra las dimensiones declaradas.

La comprobación de instalabilidad no devolvió errores del manifest. El único estado informado por el navegador de prueba fue `in-incognito`, esperado porque la automatización utiliza un perfil temporal.

## Actualizaciones

- Detección de un nuevo service worker.
- Aparición del aviso de nueva versión.
- Activación mediante `Actualizar ahora`.
- Recarga con el nuevo controlador.
- Conservación del esquema de base de datos y formato de respaldo.

## Validación estática

- Sintaxis válida en `app.js`, `v1.js`, `web.js` y `sw.js`.
- Todos los recursos referenciados por HTML, manifest y service worker existen.
- Workflow de GitHub Pages validado y configurado con la carpeta `site` como artefacto.
- Consistencia de versión: aplicación 1.1.0, base 2, respaldo 2 y caché 1.1.0.
