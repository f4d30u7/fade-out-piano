'use strict';

/* Fade Out Piano 1.1 - Web/PWA runtime */

const webRuntime = {
  deferredInstallPrompt: null,
  registration: null,
  waitingWorker: null,
  reloadForUpdate: false,
  initialized: false
};

function webIsStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function webIsIOS() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function webIsAndroid() {
  return /Android/i.test(navigator.userAgent || '');
}

function webCanInstall() {
  if (webIsStandalone()) return false;
  if (webRuntime.deferredInstallPrompt) return true;
  if (webIsIOS()) return true;
  return window.isSecureContext && 'serviceWorker' in navigator;
}

function webInstallLabel() {
  if (webIsStandalone()) return 'Ya instalada';
  if (webIsIOS()) return 'Instalar en iPad/iPhone';
  return 'Instalar app';
}

function webSyncInstallControls() {
  const topButton = document.getElementById('installAppButton');
  if (topButton) {
    topButton.textContent = webInstallLabel();
    topButton.classList.toggle('hidden', !webCanInstall());
    topButton.disabled = webIsStandalone();
  }
  const settingsButton = document.getElementById('settingsInstallApp');
  if (settingsButton) {
    settingsButton.textContent = webInstallLabel();
    settingsButton.disabled = webIsStandalone();
  }
  const installStatus = document.getElementById('webInstallStatus');
  if (installStatus) installStatus.textContent = webIsStandalone() ? 'Instalada' : 'Disponible desde el navegador';
}

function webInstallInstructions() {
  const ios = webIsIOS();
  const android = webIsAndroid();
  const title = ios ? 'Instalar en iPad o iPhone' : android ? 'Instalar en Android' : 'Instalar Fade Out Piano';
  const steps = ios
    ? `<ol class="instruction-list"><li>Abr\u00ed esta direcci\u00f3n en Safari.</li><li>Toc\u00e1 <strong>Compartir</strong>.</li><li>Eleg\u00ed <strong>Agregar a pantalla de inicio</strong>.</li><li>Activ\u00e1 <strong>Abrir como app web</strong> y confirm\u00e1.</li></ol>`
    : android
      ? `<ol class="instruction-list"><li>Abr\u00ed esta direcci\u00f3n en Chrome.</li><li>Toc\u00e1 el men\u00fa de tres puntos.</li><li>Eleg\u00ed <strong>Instalar aplicaci\u00f3n</strong> o <strong>Agregar a pantalla principal</strong>.</li><li>Confirm\u00e1 la instalaci\u00f3n.</li></ol>`
      : `<ol class="instruction-list"><li>Abr\u00ed el men\u00fa del navegador.</li><li>Eleg\u00ed <strong>Instalar Fade Out Piano</strong> o el icono de instalaci\u00f3n de la barra de direcciones.</li><li>Confirm\u00e1.</li></ol>`;
  openModal({
    title,
    eyebrow: 'Aplicaci\u00f3n web',
    body: `<div class="install-help"><div class="install-hero"><img src="icons/icon-192.png" alt="" /><div><strong>Fade Out Piano puede quedar en tu pantalla de inicio.</strong><p>Una vez instalada, abre sin las barras del navegador y conserva el funcionamiento offline despu\u00e9s de la primera carga.</p></div></div>${steps}<div class="prompt-box mt-18"><span>Datos</span><p>El historial queda guardado en este dispositivo. Us\u00e1 el respaldo JSON para trasladarlo o protegerlo.</p></div></div>`,
    footer: '<button class="secondary-button" data-close-modal>Cerrar</button><button class="primary-button" id="copyWebAddress">Copiar direcci\u00f3n</button>',
    onOpen: () => {
      document.querySelector('[data-close-modal]')?.addEventListener('click', () => closeModal(true));
      document.getElementById('copyWebAddress')?.addEventListener('click', async () => {
        await webCopyAddress();
      });
    }
  });
}

async function webInstallApp() {
  if (webIsStandalone()) {
    toast('Fade Out Piano ya est\u00e1 instalada');
    return;
  }
  if (webRuntime.deferredInstallPrompt) {
    const promptEvent = webRuntime.deferredInstallPrompt;
    webRuntime.deferredInstallPrompt = null;
    promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice?.outcome === 'accepted') toast('Instalaci\u00f3n iniciada');
    else toast('Instalaci\u00f3n cancelada', 'Pod\u00e9s hacerlo m\u00e1s tarde desde Ajustes.');
    webSyncInstallControls();
    return;
  }
  webInstallInstructions();
}

async function webCopyAddress() {
  const url = location.href.split('#')[0];
  try {
    await navigator.clipboard.writeText(url);
    toast('Direcci\u00f3n copiada');
  } catch (error) {
    const input = document.createElement('textarea');
    input.value = url;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
    toast('Direcci\u00f3n copiada');
  }
}

function webShowUpdate(worker) {
  if (!worker) return;
  webRuntime.waitingWorker = worker;
  const banner = document.getElementById('webUpdateBanner');
  banner?.classList.remove('hidden');
}

function webHideUpdate() {
  document.getElementById('webUpdateBanner')?.classList.add('hidden');
}

async function webApplyUpdate() {
  const worker = webRuntime.waitingWorker || webRuntime.registration?.waiting;
  if (!worker) {
    await webCheckForUpdates(true);
    return;
  }
  webRuntime.reloadForUpdate = true;
  worker.postMessage({ type: 'SKIP_WAITING' });
}

async function webCheckForUpdates(showResult = false) {
  if (!webRuntime.registration) {
    if (showResult) toast('Actualizaciones no disponibles', 'Abr\u00ed la versi\u00f3n HTTPS publicada.');
    return;
  }
  try {
    await webRuntime.registration.update();
    if (webRuntime.registration.waiting) {
      webShowUpdate(webRuntime.registration.waiting);
    } else if (showResult) {
      toast('Fade Out Piano est\u00e1 actualizada', `Versi\u00f3n ${APP_VERSION}`);
    }
  } catch (error) {
    if (showResult) toast('No se pudo buscar la actualizaci\u00f3n', 'Revis\u00e1 la conexi\u00f3n e intent\u00e1 de nuevo.');
    console.warn('Fall\u00f3 la verificaci\u00f3n de actualizaciones.', error);
  }
}

async function webRegisterServiceWorker() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http') || window.FADE_OUT_STANDALONE) return null;
  if (webRuntime.registration) return webRuntime.registration;
  try {
    const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    webRuntime.registration = registration;
    if (registration.waiting && navigator.serviceWorker.controller) webShowUpdate(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) webShowUpdate(worker);
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!webRuntime.reloadForUpdate) return;
      webRuntime.reloadForUpdate = false;
      location.reload();
    });
    setTimeout(() => webCheckForUpdates(false), 1500);
    return registration;
  } catch (error) {
    console.warn('Service worker no registrado.', error);
    return null;
  }
}

async function webPersistentStorageStatus() {
  if (!navigator.storage?.persisted) return null;
  try {
    return await navigator.storage.persisted();
  } catch (error) {
    return null;
  }
}

async function webProtectLocalData() {
  if (!navigator.storage?.persist) {
    toast('El navegador no ofrece esta protecci\u00f3n', 'Los respaldos JSON siguen siendo la defensa sensata.');
    return;
  }
  try {
    if (await navigator.storage.persisted()) {
      toast('Los datos locales ya est\u00e1n protegidos');
      webRefreshStatusFields();
      return;
    }
    const granted = await navigator.storage.persist();
    if (granted) toast('Protecci\u00f3n local activada');
    else toast('El navegador no concedi\u00f3 protecci\u00f3n persistente', 'Export\u00e1 respaldos peri\u00f3dicos. La humanidad invent\u00f3 los backups por una raz\u00f3n.');
    webRefreshStatusFields();
  } catch (error) {
    toast('No se pudo cambiar la protecci\u00f3n local');
  }
}

async function webRefreshStatusFields() {
  const network = document.getElementById('webNetworkStatus');
  if (network) network.textContent = navigator.onLine ? 'En l\u00ednea' : 'Sin conexi\u00f3n';
  const secure = document.getElementById('webSecureStatus');
  if (secure) secure.textContent = window.isSecureContext ? 'HTTPS seguro' : 'Entorno no seguro';
  const offline = document.getElementById('webOfflineStatus');
  if (offline) offline.textContent = webRuntime.registration ? 'Preparado' : 'Pendiente de publicaci\u00f3n HTTPS';
  const persistent = document.getElementById('webStorageStatus');
  if (persistent) {
    const status = await webPersistentStorageStatus();
    persistent.textContent = status === true ? 'Protegido' : status === false ? 'Est\u00e1ndar' : 'No informado';
  }
  webSyncInstallControls();
}

function webStatusCard() {
  const installed = webIsStandalone();
  return `<div class="section-header mt-10"><div><h2>Aplicaci\u00f3n web</h2><p>Instalaci\u00f3n, funcionamiento offline y actualizaciones.</p></div>${statusTag(installed ? 'Instalada' : 'Web', installed ? 'success' : '')}</div>
  <div class="card pad web-app-card">
    <div class="task-list">
      <div class="task-row"><span class="task-icon">I</span><div class="task-copy"><strong>Instalaci\u00f3n</strong><span>Acceso desde la pantalla de inicio</span></div><span class="task-meta" id="webInstallStatus">${installed ? 'Instalada' : 'Disponible'}</span></div>
      <div class="task-row"><span class="task-icon">N</span><div class="task-copy"><strong>Conexi\u00f3n</strong><span>Estado de esta apertura</span></div><span class="task-meta" id="webNetworkStatus">${navigator.onLine ? 'En l\u00ednea' : 'Sin conexi\u00f3n'}</span></div>
      <div class="task-row"><span class="task-icon">S</span><div class="task-copy"><strong>Publicaci\u00f3n</strong><span>Contexto requerido para instalar y actualizar</span></div><span class="task-meta" id="webSecureStatus">${window.isSecureContext ? 'HTTPS seguro' : 'Entorno no seguro'}</span></div>
      <div class="task-row"><span class="task-icon">O</span><div class="task-copy"><strong>Uso offline</strong><span>Archivos guardados por la PWA</span></div><span class="task-meta" id="webOfflineStatus">${webRuntime.registration ? 'Preparado' : 'Verificando'}</span></div>
      <div class="task-row"><span class="task-icon">D</span><div class="task-copy"><strong>Datos locales</strong><span>Protecci\u00f3n frente a limpieza autom\u00e1tica</span></div><span class="task-meta" id="webStorageStatus">Verificando</span></div>
    </div>
    <div class="row wrap mt-18">
      <button class="primary-button" id="settingsInstallApp" type="button" ${installed ? 'disabled' : ''}>${webInstallLabel()}</button>
      <button class="secondary-button" id="checkWebUpdate" type="button">Buscar actualizaci\u00f3n</button>
      <button class="secondary-button" id="protectLocalData" type="button">Proteger datos locales</button>
      <button class="secondary-button" id="copyWebUrl" type="button">Copiar direcci\u00f3n</button>
    </div>
    <p class="input-hint mt-14">El historial sigue siendo local a cada dispositivo. Exportar el respaldo JSON contin\u00faa siendo necesario antes de cambiar de celular, tablet o navegador.</p>
  </div>`;
}

const webCoreRenderSettings = renderSettings;
const webCoreBindSettings = bindSettings;

renderSettings = function renderSettingsWeb() {
  const html = webCoreRenderSettings();
  const closing = '</aside></div>';
  const position = html.lastIndexOf(closing);
  if (position < 0) return `${html}${webStatusCard()}`;
  return `${html.slice(0, position)}${webStatusCard()}${html.slice(position)}`;
};

bindSettings = function bindSettingsWeb() {
  webCoreBindSettings();
  document.getElementById('settingsInstallApp')?.addEventListener('click', webInstallApp);
  document.getElementById('checkWebUpdate')?.addEventListener('click', () => webCheckForUpdates(true));
  document.getElementById('protectLocalData')?.addEventListener('click', webProtectLocalData);
  document.getElementById('copyWebUrl')?.addEventListener('click', webCopyAddress);
  webRefreshStatusFields();
};

function webInitRuntime() {
  if (webRuntime.initialized) return;
  webRuntime.initialized = true;
  document.getElementById('installAppButton')?.addEventListener('click', webInstallApp);
  document.getElementById('dismissWebUpdate')?.addEventListener('click', webHideUpdate);
  document.getElementById('applyWebUpdate')?.addEventListener('click', webApplyUpdate);
  window.addEventListener('online', () => {
    webRefreshStatusFields();
    toast('Conexi\u00f3n recuperada');
  });
  window.addEventListener('offline', () => {
    webRefreshStatusFields();
    toast('Sin conexi\u00f3n', 'La aplicaci\u00f3n seguir\u00e1 usando los archivos guardados.');
  });
  webSyncInstallControls();
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  webRuntime.deferredInstallPrompt = event;
  webSyncInstallControls();
});

window.addEventListener('appinstalled', () => {
  webRuntime.deferredInstallPrompt = null;
  webSyncInstallControls();
  toast('Fade Out Piano instalada');
});

window.matchMedia('(display-mode: standalone)').addEventListener?.('change', webSyncInstallControls);

document.addEventListener('DOMContentLoaded', webInitRuntime);

window.fadeOutWeb = {
  registerServiceWorker: webRegisterServiceWorker,
  checkForUpdates: webCheckForUpdates,
  installApp: webInstallApp,
  protectLocalData: webProtectLocalData
};
