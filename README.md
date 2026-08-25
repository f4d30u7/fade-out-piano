# Fade Out Piano Web 1.1.0

Aplicación web progresiva para organizar la práctica de piano, registrar progreso, estudiar teoría, entrenar improvisación y practicar lectura a primera vista.

## Qué contiene este paquete

- `site/`: aplicación estática completa, lista para publicar.
- `.github/workflows/deploy-pages.yml`: publicación automática en GitHub Pages.
- `DEPLOY.md`: instrucciones de publicación e instalación.
- `CHANGELOG.md`: cambios de la versión web.

No existe un proceso de compilación. GitHub Pages publica directamente los archivos HTML, CSS y JavaScript de `site/`.

## Diferencias respecto de la versión local 1.0

- Instalación desde Android, iPad, Windows y macOS.
- Funcionamiento offline después de la primera carga.
- Aviso cuando existe una actualización lista para aplicar.
- Pantalla de ayuda de instalación para iPad/iPhone y Android.
- Indicadores de HTTPS, conexión, caché offline y protección del almacenamiento local.
- Acciones para comprobar actualizaciones, copiar la dirección y pedir almacenamiento persistente.
- Configuración preparada para GitHub Pages incluso cuando el sitio vive dentro de una subcarpeta del dominio.

## Datos e historial

Los datos se guardan localmente en IndexedDB dentro de cada navegador. Publicar la aplicación no sube repertorio, sesiones ni información personal al repositorio.

Al cambiar desde la versión local a la versión web, el origen del navegador cambia. Por ese motivo, el historial no aparece automáticamente:

1. En la versión anterior, abrir `Ajustes` y exportar el respaldo JSON.
2. Abrir la nueva dirección web.
3. En la primera apertura, elegir `Restaurar respaldo`.
4. Seleccionar el JSON y confirmar.

A partir de allí, las actualizaciones publicadas en la misma dirección conservan la base local. De todos modos, conviene exportar respaldos periódicos. La tecnología progresa; la necesidad de hacer backups, con admirable terquedad, no.

## Sincronización entre dispositivos

La versión 1.1 no sincroniza automáticamente PC, celular y tablet. Cada dispositivo mantiene su propia base. El respaldo JSON permite moverla manualmente. La sincronización requiere un servicio de cuenta y nube y queda para una versión posterior.

## Versionado

- Aplicación: 1.1.0
- Base de datos: 2
- Formato de respaldo: 2
- Caché PWA: fade-out-piano-v1.1.0

## Privacidad

La aplicación no incluye analítica, publicidad ni servicios de terceros. El código publicado es público si se utiliza GitHub Pages con un repositorio público, pero los datos de uso permanecen en el navegador.
