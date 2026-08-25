# Publicar Fade Out Piano en la web

## Opción recomendada: GitHub Pages

El paquete ya incluye el flujo de publicación automática.

### 1. Crear el repositorio

Crear un repositorio en GitHub, por ejemplo `fade-out-piano`. Puede ser público. No subir respaldos JSON ni datos personales al repositorio.

### 2. Subir este paquete

Subir a la raíz del repositorio:

- la carpeta `.github`
- la carpeta `site`
- `README.md`
- `DEPLOY.md`
- `CHANGELOG.md`

La rama principal debe llamarse `main`, tal como espera el flujo incluido.

### 3. Activar Pages

En el repositorio:

1. Abrir `Settings`.
2. Entrar en `Pages`.
3. En `Build and deployment`, elegir `GitHub Actions` como fuente.
4. Abrir la pestaña `Actions` y verificar que termine el flujo `Deploy Fade Out Piano to GitHub Pages`.

La dirección habitual quedará con esta forma:

`https://USUARIO.github.io/fade-out-piano/`

La aplicación usa rutas relativas, por lo que funciona en esa subcarpeta sin editar archivos.

## Instalar en Android

1. Abrir la dirección en Chrome.
2. Usar el botón `Instalar app` de Fade Out Piano o el menú del navegador.
3. Confirmar `Instalar aplicación` o `Agregar a pantalla principal`.

## Instalar en iPad

1. Abrir la dirección en Safari.
2. Tocar `Compartir`.
3. Elegir `Agregar a pantalla de inicio`.
4. Activar `Abrir como app web`.
5. Confirmar.

## Actualizaciones

Cada cambio enviado a `main` vuelve a publicar el sitio. Cuando el navegador descarga una nueva versión del service worker, Fade Out Piano muestra un aviso. `Actualizar ahora` activa el nuevo código y recarga la aplicación. El historial local no se reemplaza.

Antes de una actualización importante, exportar el respaldo JSON desde `Ajustes`.

## Dominio personalizado

Puede agregarse más adelante desde la configuración de GitHub Pages. No hace falta para instalar la PWA: la dirección `github.io` ya ofrece HTTPS.

## Prueba local

Para revisar los archivos antes de publicar, servir la carpeta `site` con cualquier servidor HTTP local. Abrir `index.html` directamente permite ver gran parte de la interfaz, pero la instalación PWA y el service worker requieren HTTP seguro o `localhost`.
