'use strict';

const APP_VERSION = '1.1.0';
const DB_NAME = 'fadeOutPianoDB';
const DB_VERSION = 2;
const STATE_KEY = 'main-state';
const FALLBACK_KEY = 'fade-out-piano-state-v1';

const ROUTES = {
  hoy: { title: 'Hoy', eyebrow: 'Práctica deliberada' },
  semana: { title: 'Semana', eyebrow: 'De la clase al progreso' },
  repertorio: { title: 'Repertorio', eyebrow: 'Obras, técnica y objetivos' },
  laboratorio: { title: 'Mi laboratorio', eyebrow: 'Curiosidad con estructura' },
  teoria: { title: 'Teoría', eyebrow: 'Entender de dónde sale' },
  improvisacion: { title: 'Improvisación', eyebrow: 'Libertad con una consigna' },
  progreso: { title: 'Progreso', eyebrow: 'Evidencia, no decoración' },
  ajustes: { title: 'Ajustes', eyebrow: 'Perfil, datos y respaldos' }
};

const SOURCE_LABELS = {
  teacher: 'Profesora',
  personal: 'Personal',
  app: 'Aplicación'
};

const CATEGORY_LABELS = {
  repertoire: 'Repertorio',
  technique: 'Técnica',
  theory: 'Teoría',
  improvisation: 'Improvisación',
  warmup: 'Activación',
  closing: 'Cierre',
  free: 'Práctica libre'
};

const ui = {
  route: 'hoy',
  duration: 30,
  energy: 'normal',
  todayFocus: null,
  currentPlan: [],
  labTab: 'objetivos',
  repertoireFilter: 'active',
  theoryRoot: 'C',
  theoryScale: 'major',
  theoryPath: 'todos',
  improvDuration: 15,
  improvFocus: 'motifs',
  improvProgression: 'pop-c',
  improvPlan: null,
  quiz: null,
  sessionRun: null,
  metronome: null,
  freePractice: null
};

let appState;
let db;

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function uid(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function localISO(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 10);
}

function dateOffset(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return localISO(date);
}

function parseISO(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatDate(value, options = { day: 'numeric', month: 'short' }) {
  const date = typeof value === 'string' ? parseISO(value) : value;
  return new Intl.DateTimeFormat('es-AR', options).format(date);
}

function formatLongDate(date = new Date()) {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long'
  }).format(date);
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function daysBetween(fromISO, toISO = localISO()) {
  const from = parseISO(fromISO);
  const to = parseISO(toISO);
  return Math.floor((to - from) / 86400000);
}

function minutesLabel(minutes) {
  const value = Number(minutes) || 0;
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function percent(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

function getCurrentCycle(reference = new Date()) {
  const date = new Date(reference);
  date.setHours(12, 0, 0, 0);
  const diff = (date.getDay() - 6 + 7) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const nextClass = new Date(start);
  nextClass.setDate(start.getDate() + 7);
  return { start, end, nextClass };
}

function nextWeekday(dayIndex, from = new Date()) {
  const date = new Date(from);
  date.setHours(12, 0, 0, 0);
  let diff = (dayIndex - date.getDay() + 7) % 7;
  if (diff === 0) diff = 7;
  date.setDate(date.getDate() + diff);
  return date;
}

function seedState() {
  const cycle = getCurrentCycle();
  const sessionDateA = new Date(cycle.start); sessionDateA.setDate(cycle.start.getDate() + 1);
  const sessionDateB = new Date(cycle.start); sessionDateB.setDate(cycle.start.getDate() + 3);
  const sessionDateC = new Date(cycle.start); sessionDateC.setDate(cycle.start.getDate() + 5);

  const moonlightId = uid('rep');
  const techniqueId = uid('rep');
  const improvId = uid('rep');

  return {
    schemaVersion: 1,
    appVersionCreated: APP_VERSION,
    demoMode: true,
    profile: {
      name: 'Esteban',
      experienceYears: 3,
      level: 'Inicial avanzado',
      instrument: 'Piano digital / acústico',
      classDay: 6,
      weeklySessionsGoal: 4,
      weeklyMinutesGoal: 120,
      minTeacherShare: 50,
      distributions: { teacher: 55, personal: 20, theory: 10, improvisation: 15 }
    },
    repertoire: [
      {
        id: moonlightId,
        title: 'Sonata Claro de luna',
        composer: 'Ludwig van Beethoven',
        type: 'Obra',
        status: 'active',
        startedAt: dateOffset(-90),
        notes: 'Obra principal de trabajo. Priorizar continuidad, balance de voces y relajación.'
      },
      {
        id: techniqueId,
        title: 'Técnica general',
        composer: 'Escalas, articulación y coordinación',
        type: 'Técnica',
        status: 'active',
        startedAt: dateOffset(-60),
        notes: 'Contenedor para escalas, arpegios, legato, staccato y coordinación.'
      },
      {
        id: improvId,
        title: 'Improvisación',
        composer: 'Motivos, ritmo y armonía funcional',
        type: 'Laboratorio',
        status: 'active',
        startedAt: dateOffset(-21),
        notes: 'Explorar con consignas pequeñas y registrar qué recursos funcionan.'
      }
    ],
    tasks: [
      {
        id: uid('task'),
        repertoireId: moonlightId,
        title: 'Claro de luna · compases 1–8',
        source: 'teacher', category: 'repertoire', priority: 2,
        suggestedMinutes: 9,
        objective: 'Mantener continuidad y una melodía superior clara.',
        method: 'Primero voces separadas; después una pasada completa sin detenerse.',
        success: 'Dos ejecuciones continuas a 50 BPM.',
        bpm: 50, targetBpm: 54,
        status: 'active', lastPracticed: dateOffset(-2), frequencyPerWeek: 3,
        completedThisWeek: 1, protected: false
      },
      {
        id: uid('task'),
        repertoireId: moonlightId,
        title: 'Transición entre compases 8–9',
        source: 'teacher', category: 'repertoire', priority: 3,
        suggestedMinutes: 7,
        objective: 'Resolver el cambio sin tensión ni pausa.',
        method: 'Encadenar dos pulsos antes y dos después; aumentar desde 42 BPM.',
        success: 'Tres repeticiones limpias consecutivas.',
        bpm: 42, targetBpm: 50,
        status: 'active', lastPracticed: dateOffset(-4), frequencyPerWeek: 3,
        completedThisWeek: 1, protected: false
      },
      {
        id: uid('task'),
        repertoireId: techniqueId,
        title: 'Escala de Re mayor',
        source: 'teacher', category: 'technique', priority: 2,
        suggestedMinutes: 6,
        objective: 'Regularidad de pulso y digitación sin tensión.',
        method: 'Manos separadas, dos octavas; alternar legato y staccato.',
        success: 'Dos repeticiones limpias por articulación.',
        bpm: 60, targetBpm: 72,
        status: 'active', lastPracticed: dateOffset(-3), frequencyPerWeek: 2,
        completedThisWeek: 1, protected: false
      },
      {
        id: uid('task'),
        repertoireId: techniqueId,
        title: 'Staccato en escalas conocidas',
        source: 'personal', category: 'technique', priority: 1,
        suggestedMinutes: 5,
        objective: 'Obtener un ataque liviano y parejo sin endurecer la muñeca.',
        method: 'Elegir una escala conocida y tocar fragmentos cortos, lento y relajado.',
        success: 'Dos escalas con sonido parejo y sin tensión visible.',
        bpm: 56, targetBpm: 66,
        status: 'active', lastPracticed: dateOffset(-5), frequencyPerWeek: 2,
        completedThisWeek: 0, protected: false
      },
      {
        id: uid('task'),
        repertoireId: improvId,
        title: 'Motivo de tres notas sobre I–vi–IV–V',
        source: 'personal', category: 'improvisation', priority: 1,
        suggestedMinutes: 7,
        objective: 'Desarrollar una idea en vez de encadenar notas al azar.',
        method: 'Crear un motivo breve, repetirlo, desplazarlo y cambiar solo el final.',
        success: 'Sostener dos vueltas de la progresión con una idea reconocible.',
        bpm: 70, targetBpm: 80,
        status: 'active', lastPracticed: dateOffset(-7), frequencyPerWeek: 1,
        completedThisWeek: 0, protected: false
      }
    ],
    explorations: [
      { id: uid('exp'), title: 'Cómo usar silencios al improvisar', note: 'Probar respuestas más cortas y dejar un compás sin tocar.', createdAt: dateOffset(-4), status: 'idea' },
      { id: uid('exp'), title: 'Acordes con séptima', note: 'Entender cómo cambia la función y el color de cada tríada.', createdAt: dateOffset(-9), status: 'idea' }
    ],
    classNotes: [
      {
        id: uid('note'), date: localISO(cycle.start),
        text: 'Trabajar continuidad en Claro de luna. No acelerar la transición 8–9. Mantener la melodía por encima del acompañamiento.'
      }
    ],
    sessions: [
      {
        id: uid('session'), date: localISO(sessionDateA), plannedMinutes: 25, actualMinutes: 23,
        mood: 'buena', demo: true,
        blocks: [
          { category: 'technique', source: 'teacher', title: 'Escala de Re mayor', minutes: 6, result: 'achieved' },
          { category: 'repertoire', source: 'teacher', title: 'Claro de luna · compases 1–8', minutes: 12, result: 'partial' },
          { category: 'theory', source: 'app', title: 'Intervalos y distancia', minutes: 5, result: 'achieved' }
        ]
      },
      {
        id: uid('session'), date: localISO(sessionDateB), plannedMinutes: 30, actualMinutes: 28,
        mood: 'correcta', demo: true,
        blocks: [
          { category: 'repertoire', source: 'teacher', title: 'Transición entre compases 8–9', minutes: 10, result: 'partial' },
          { category: 'repertoire', source: 'teacher', title: 'Claro de luna · compases 1–8', minutes: 10, result: 'achieved' },
          { category: 'improvisation', source: 'personal', title: 'Pregunta y respuesta', minutes: 6, result: 'partial' }
        ]
      },
      {
        id: uid('session'), date: localISO(sessionDateC), plannedMinutes: 35, actualMinutes: 34,
        mood: 'muy buena', demo: true,
        blocks: [
          { category: 'technique', source: 'personal', title: 'Staccato en escalas conocidas', minutes: 7, result: 'achieved' },
          { category: 'repertoire', source: 'teacher', title: 'Claro de luna · integración', minutes: 18, result: 'partial' },
          { category: 'improvisation', source: 'app', title: 'Motivo de tres notas', minutes: 7, result: 'achieved' }
        ]
      }
    ],
    theoryProgress: {
      completedLessons: ['intervals'],
      quizCorrect: 3,
      quizTotal: 4
    },
    improvisationProgress: {
      completedSessions: 2,
      lastFocus: 'motifs',
      favorites: []
    },
    settings: {
      includeWarmup: true,
      includeClosing: true,
      maxBlockMinutes: 12,
      metronomeSound: 'click',
      lastBackup: null
    }
  };
}

function migrateState(raw) {
  if (!raw || typeof raw !== 'object') return seedState();
  const migrated = structuredClone(raw);
  migrated.schemaVersion ||= 1;
  migrated.profile ||= seedState().profile;
  migrated.repertoire ||= [];
  migrated.tasks ||= [];
  migrated.explorations ||= [];
  migrated.classNotes ||= [];
  migrated.sessions ||= [];
  migrated.theoryProgress ||= { completedLessons: [], quizCorrect: 0, quizTotal: 0 };
  migrated.improvisationProgress ||= { completedSessions: 0, lastFocus: 'motifs', favorites: [] };
  migrated.settings ||= seedState().settings;
  return migrated;
}

async function openDatabase() {
  if (!('indexedDB' in window)) return null;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('state')) database.createObjectStore('state');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadState() {
  try {
    db = await openDatabase();
    if (db) {
      const saved = await new Promise((resolve, reject) => {
        const tx = db.transaction('state', 'readonly');
        const request = tx.objectStore('state').get(STATE_KEY);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (saved) return migrateState(saved);
    }
  } catch (error) {
    console.warn('IndexedDB no disponible; se usará almacenamiento de respaldo.', error);
  }

  try {
    const fallback = localStorage.getItem(FALLBACK_KEY);
    if (fallback) return migrateState(JSON.parse(fallback));
  } catch (error) {
    console.warn('No se pudo leer el respaldo local.', error);
  }
  return seedState();
}

async function saveState() {
  appState.demoMode = appState.sessions.some(session => session.demo);
  appState.appVersionLastUsed = APP_VERSION;
  try {
    if (db) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('state', 'readwrite');
        tx.objectStore('state').put(appState, STATE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return;
    }
  } catch (error) {
    console.warn('Falló el guardado en IndexedDB.', error);
  }
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(appState));
}

function getCycleSessions() {
  const { start, end } = getCurrentCycle();
  const startISO = localISO(start);
  const endISO = localISO(end);
  return appState.sessions.filter(session => session.date >= startISO && session.date <= endISO);
}

function getWeeklyStats() {
  const sessions = getCycleSessions();
  const minutes = sessions.reduce((sum, item) => sum + Number(item.actualMinutes || 0), 0);
  const achieved = sessions.flatMap(s => s.blocks || []).filter(b => b.result === 'achieved').length;
  const totalBlocks = sessions.flatMap(s => s.blocks || []).length;
  return {
    sessions: sessions.length,
    minutes,
    achieved,
    totalBlocks,
    sessionGoal: appState.profile.weeklySessionsGoal,
    minuteGoal: appState.profile.weeklyMinutesGoal
  };
}

function taskScore(task) {
  const priority = Number(task.priority || 1) * 15;
  const stale = clamp(daysBetween(task.lastPracticed || dateOffset(-14)), 0, 14) * 2;
  const frequencyGap = Math.max(0, Number(task.frequencyPerWeek || 1) - Number(task.completedThisWeek || 0)) * 8;
  const protectedScore = task.protected ? 100 : 0;
  return priority + stale + frequencyGap + protectedScore;
}

function sourceTag(source) {
  return `<span class="source-tag ${esc(source)}">${esc(SOURCE_LABELS[source] || source)}</span>`;
}

function statusTag(label, kind = '') {
  return `<span class="status-tag ${kind}">${esc(label)}</span>`;
}

function toast(title, message = '') {
  const stack = $('#toastStack');
  const node = document.createElement('div');
  node.className = 'toast';
  node.innerHTML = `<strong>${esc(title)}</strong>${message ? `<span>${esc(message)}</span>` : ''}`;
  stack.appendChild(node);
  setTimeout(() => node.remove(), 3600);
}

function openModal({ title, eyebrow = 'Fade Out Piano', body = '', footer = '', wide = false, onOpen = null }) {
  $('#modalTitle').textContent = title;
  $('#modalEyebrow').textContent = eyebrow;
  $('#modalBody').innerHTML = body;
  $('#modalFooter').innerHTML = footer;
  $('#modal').classList.toggle('wide', Boolean(wide));
  $('#modalBackdrop').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    const first = $('#modalBody input, #modalBody select, #modalBody textarea, #modalBody button');
    first?.focus();
    if (typeof onOpen === 'function') onOpen();
  });
}

function closeModal() {
  stopMetronome();
  if (ui.sessionRun?.timerId) clearInterval(ui.sessionRun.timerId);
  $('#modalBackdrop').classList.add('hidden');
  $('#modal').classList.remove('wide');
  document.body.style.overflow = '';
}

function setRoute(route, updateHash = true) {
  if (!ROUTES[route]) route = 'hoy';
  ui.route = route;
  if (updateHash && location.hash !== `#${route}`) history.pushState(null, '', `#${route}`);
  $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.route === route));
  $('#pageTitle').textContent = ROUTES[route].title;
  $('#pageEyebrow').textContent = ROUTES[route].eyebrow;
  renderRoute();
  closeMobileMenu();
  $('#appView').focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function closeMobileMenu() {
  $('.sidebar').classList.remove('open');
  $('#mobileBackdrop').classList.remove('open');
}

function updateChrome() {
  const name = appState.profile.name || 'Pianista';
  $('#sidebarName').textContent = name;
  $('#sidebarAvatar').textContent = name.charAt(0).toUpperCase();
  $('#sidebarLevel').textContent = appState.profile.level || 'Nivel personal';
  $('#versionBadge').textContent = `v${APP_VERSION}`;
  $('#demoPill').classList.toggle('hidden', !appState.demoMode);
}

function renderRoute() {
  const renderers = {
    hoy: renderToday,
    semana: renderWeek,
    repertorio: renderRepertoire,
    laboratorio: renderLab,
    teoria: renderTheory,
    improvisacion: renderImprovisation,
    progreso: renderProgress,
    ajustes: renderSettings
  };
  $('#appView').innerHTML = renderers[ui.route]();
  bindRouteEvents();
}

function bindRouteEvents() {
  const binders = {
    hoy: bindToday,
    semana: bindWeek,
    repertorio: bindRepertoire,
    laboratorio: bindLab,
    teoria: bindTheory,
    improvisacion: bindImprovisation,
    progreso: bindProgress,
    ajustes: bindSettings
  };
  binders[ui.route]?.();
}

function renderToday() {
  const stats = getWeeklyStats();
  const nextClass = nextWeekday(appState.profile.classDay);
  const topTasks = appState.tasks
    .filter(task => task.status === 'active')
    .sort((a, b) => taskScore(b) - taskScore(a))
    .slice(0, 4);
  const planMinutes = ui.currentPlan.reduce((sum, block) => sum + block.duration, 0);
  const teacherMinutes = ui.currentPlan.filter(block => block.source === 'teacher').reduce((sum, block) => sum + block.duration, 0);
  const teacherShare = percent(teacherMinutes, planMinutes);

  return `
    <div class="page-grid">
      <section class="card hero accent-card">
        <div class="hero-copy">
          <span class="eyebrow">${esc(capitalize(formatLongDate()))}</span>
          <h2>Practicá con intención.<br>Dejá que el ruido haga fade out.</h2>
          <p>Elegí el tiempo y la energía reales de hoy. La aplicación organiza el trabajo de clase, tus objetivos personales, teoría e improvisación sin fingir que todos los martes son idénticos.</p>
          <div class="stats-row">
            <div class="stat-chip"><strong>${stats.sessions}/${stats.sessionGoal}</strong><span>sesiones</span></div>
            <div class="stat-chip"><strong>${stats.minutes}</strong><span>minutos</span></div>
            <div class="stat-chip"><strong>${stats.achieved}</strong><span>bloques logrados</span></div>
            <div class="stat-chip"><strong>${formatDate(nextClass)}</strong><span>próxima clase</span></div>
          </div>
        </div>
        <div class="hero-visual" aria-hidden="true">
          <div class="fade-orbit">
            <span class="orbit-dot a"></span><span class="orbit-dot b"></span><span class="orbit-dot c"></span>
            <div class="orbit-label"><strong>${stats.minutes}</strong><span>min esta semana</span></div>
          </div>
        </div>
      </section>

      <div class="page-grid two">
        <section class="page-section">
          <div class="section-header">
            <div><h2>Preparar la práctica</h2><p>Dos decisiones honestas y un plan que no requiere negociar con vos mismo durante quince minutos.</p></div>
          </div>
          <div class="card pad">
            <div class="control-group">
              <span class="control-label">¿Cuánto tiempo tenés?</span>
              <div class="chip-row" id="durationChoices">
                ${[5,10,15,20,30,45,60].map(value => `<button class="choice-chip ${ui.duration === value ? 'active' : ''}" data-duration="${value}">${value} min</button>`).join('')}
                <button class="choice-chip ${![5,10,15,20,30,45,60].includes(ui.duration) ? 'active' : ''}" data-duration="custom">Otro</button>
              </div>
            </div>
            <div class="control-group mt-18">
              <span class="control-label">¿Cómo está tu energía?</span>
              <div class="chip-row" id="energyChoices">
                <button class="choice-chip energy ${ui.energy === 'low' ? 'active' : ''}" data-energy="low">Baja · simplificar</button>
                <button class="choice-chip energy ${ui.energy === 'normal' ? 'active' : ''}" data-energy="normal">Normal · equilibrar</button>
                <button class="choice-chip energy ${ui.energy === 'high' ? 'active' : ''}" data-energy="high">Alta · desafiar</button>
              </div>
            </div>
            <div class="divider"></div>
            <div class="row between wrap">
              <div>
                <strong class="small">Actividad específica de hoy</strong>
                <div class="muted small mt-10">${ui.todayFocus ? esc(ui.todayFocus.title) : 'Ninguna. El generador usará tus tareas activas.'}</div>
              </div>
              <button class="secondary-button" id="addTodayFocus">＋ Agregar</button>
            </div>
            ${ui.todayFocus ? `<div class="row between mt-14"><span class="source-tag personal">Protegida hoy</span><button class="text-button" id="clearTodayFocus">Quitar</button></div>` : ''}
            <button class="primary-button full mt-18" id="generatePlan">GENERAR PRÁCTICA · ${ui.duration} MIN</button>
          </div>

          ${ui.currentPlan.length ? `
            <div class="section-header mt-10">
              <div><h2>Plan de hoy</h2><p>${planMinutes} minutos · ${teacherShare}% de trabajo de clase · energía ${ui.energy === 'low' ? 'baja' : ui.energy === 'high' ? 'alta' : 'normal'}.</p></div>
              <button class="text-button" id="regeneratePlan">Regenerar</button>
            </div>
            <div class="card pad accent-card">
              <div class="plan-list">
                ${ui.currentPlan.map((block, index) => renderPlanBlock(block, index)).join('')}
              </div>
              <div class="row between wrap mt-18">
                <span class="muted small">Podés reordenar o quitar bloques. El plan es una herramienta, no una orden judicial.</span>
                <button class="primary-button" id="startPractice">▶ EMPEZAR</button>
              </div>
            </div>
          ` : ''}
        </section>

        <aside class="page-section">
          <div class="section-header"><div><h2>Prioridades</h2><p>Lo que el sistema considera más relevante ahora.</p></div></div>
          <div class="card pad">
            <div class="task-list">
              ${topTasks.map(task => `
                <div class="task-row">
                  <span class="task-icon">${task.category === 'repertoire' ? '♫' : task.category === 'technique' ? '⌁' : '≈'}</span>
                  <div class="task-copy">
                    <strong>${esc(task.title)}</strong>
                    <span>${esc(task.objective)}</span>
                    <div class="row wrap mt-10">${sourceTag(task.source)} ${statusTag(`hace ${Math.max(0, daysBetween(task.lastPracticed))} d`)}</div>
                  </div>
                  <span class="task-meta">${task.suggestedMinutes} min</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="card pad soft">
            <div class="card-header"><div><h3>Próxima clase</h3><p>${capitalize(formatDate(nextClass, { weekday: 'long', day: 'numeric', month: 'long' }))}</p></div>${statusTag(`${Math.ceil((nextClass - new Date()) / 86400000)} días`, 'warning')}</div>
            <div class="card-body">
              <div class="progress-bar"><span style="width:${clamp(percent(stats.sessions, stats.sessionGoal), 0, 100)}%"></span></div>
              <div class="progress-meta"><span>${stats.sessions} sesiones realizadas</span><span>meta ${stats.sessionGoal}</span></div>
              <button class="secondary-button full mt-18" data-route-jump="semana">Ver semana y notas</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  `;
}

function renderPlanBlock(block, index) {
  return `
    <div class="plan-block" data-plan-id="${esc(block.id)}">
      <span class="plan-order">${index + 1}</span>
      <div class="plan-copy">
        <div class="row wrap"><strong>${esc(block.title)}</strong>${sourceTag(block.source)}</div>
        <span>${esc(block.instruction || block.objective || '')}</span>
        ${block.success ? `<span><b>Cierre:</b> ${esc(block.success)}</span>` : ''}
      </div>
      <div class="text-right">
        <div class="plan-time">${block.duration} min</div>
        <div class="row mt-10">
          ${index > 0 ? `<button class="icon-button ghost" data-plan-action="up" data-index="${index}" title="Subir">↑</button>` : ''}
          ${index < ui.currentPlan.length - 1 ? `<button class="icon-button ghost" data-plan-action="down" data-index="${index}" title="Bajar">↓</button>` : ''}
          ${!['closing'].includes(block.category) ? `<button class="icon-button ghost" data-plan-action="remove" data-index="${index}" title="Quitar">×</button>` : ''}
        </div>
      </div>
    </div>
  `;
}

function bindToday() {
  $$('#durationChoices [data-duration]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.duration === 'custom') {
      openCustomDurationModal();
      return;
    }
    ui.duration = Number(button.dataset.duration);
    renderRoute();
  }));
  $$('#energyChoices [data-energy]').forEach(button => button.addEventListener('click', () => {
    ui.energy = button.dataset.energy;
    renderRoute();
  }));
  $('#addTodayFocus')?.addEventListener('click', () => openQuickActivityModal('today'));
  $('#clearTodayFocus')?.addEventListener('click', () => { ui.todayFocus = null; renderRoute(); });
  $('#generatePlan')?.addEventListener('click', () => {
    ui.currentPlan = generatePracticePlan(ui.duration, ui.energy, ui.todayFocus);
    renderRoute();
    toast('Plan generado', `${ui.currentPlan.length} bloques para ${ui.duration} minutos.`);
  });
  $('#regeneratePlan')?.addEventListener('click', () => {
    ui.currentPlan = generatePracticePlan(ui.duration, ui.energy, ui.todayFocus, true);
    renderRoute();
  });
  $$('[data-plan-action]').forEach(button => button.addEventListener('click', () => updatePlan(button.dataset.planAction, Number(button.dataset.index))));
  $('#startPractice')?.addEventListener('click', () => startPracticeSession());
  $$('[data-route-jump]').forEach(button => button.addEventListener('click', () => setRoute(button.dataset.routeJump)));
}

function openCustomDurationModal() {
  openModal({
    title: 'Tiempo personalizado',
    eyebrow: 'Práctica de hoy',
    body: `<div class="field"><label for="customDuration">Minutos disponibles</label><input id="customDuration" type="number" min="3" max="180" value="${ui.duration}" /><span class="input-hint">Entre 3 y 180 minutos. Después de dos horas quizá ya no sea práctica deliberada sino una toma de rehenes.</span></div>`,
    footer: `<button class="secondary-button" data-close-modal>Cancelar</button><button class="primary-button" id="saveCustomDuration">Usar tiempo</button>`,
    onOpen: () => {
      $('[data-close-modal]').addEventListener('click', closeModal);
      $('#saveCustomDuration').addEventListener('click', () => {
        ui.duration = clamp(Number($('#customDuration').value) || 30, 3, 180);
        closeModal();
        renderRoute();
      });
    }
  });
}

function openQuickActivityModal(context = 'global') {
  openModal({
    title: context === 'today' ? 'Actividad para hoy' : 'Nueva actividad',
    eyebrow: 'Carga rápida',
    body: `
      <div class="field-grid">
        <div class="field span-2"><label for="quickTitle">Qué querés practicar</label><input id="quickTitle" placeholder="Ej.: staccato, una escala, un pasaje, una idea de improvisación" /></div>
        <div class="field"><label for="quickMinutes">Tiempo sugerido</label><input id="quickMinutes" type="number" min="2" max="30" value="5" /></div>
        <div class="field"><label for="quickCategory">Categoría</label><select id="quickCategory"><option value="technique">Técnica</option><option value="repertoire">Repertorio</option><option value="improvisation">Improvisación</option><option value="theory">Teoría</option></select></div>
        <div class="field span-2"><label for="quickObjective">Objetivo o consigna</label><textarea id="quickObjective" placeholder="Qué querés conseguir o cómo pensás trabajarlo"></textarea></div>
      </div>
    `,
    footer: `<button class="secondary-button" data-close-modal>Cancelar</button><button class="primary-button" id="saveQuickActivity">${context === 'today' ? 'Proteger para hoy' : 'Guardar objetivo'}</button>`,
    onOpen: () => {
      $('[data-close-modal]').addEventListener('click', closeModal);
      $('#saveQuickActivity').addEventListener('click', async () => {
        const title = $('#quickTitle').value.trim();
        if (!title) return toast('Falta el nombre', 'Necesitamos saber qué actividad guardar, pequeño detalle administrativo.');
        const activity = {
          id: uid('task'), title,
          source: 'personal',
          category: $('#quickCategory').value,
          suggestedMinutes: clamp(Number($('#quickMinutes').value) || 5, 2, 30),
          objective: $('#quickObjective').value.trim() || 'Explorar la actividad con atención y registrar qué aparece.',
          method: 'Empezar lento, observar y ajustar la dificultad.',
          success: 'Cerrar con una observación o una próxima acción concreta.',
          priority: 2, status: 'active', lastPracticed: dateOffset(-14),
          frequencyPerWeek: 1, completedThisWeek: 0, protected: context === 'today'
        };
        if (context === 'today') {
          ui.todayFocus = activity;
        } else {
          appState.tasks.push(activity);
          await saveState();
        }
        closeModal();
        renderRoute();
        toast('Actividad guardada', context === 'today' ? 'Quedó protegida para el plan de hoy.' : 'Ya aparece en Mi laboratorio.');
      });
    }
  });
}

function generatePracticePlan(total, energy, focus = null, rotate = false) {
  const active = appState.tasks.filter(task => task.status === 'active');
  const teacherTasks = active.filter(task => task.source === 'teacher').sort((a, b) => taskScore(b) - taskScore(a));
  const personalTasks = active.filter(task => task.source === 'personal' && task.id !== focus?.id).sort((a, b) => taskScore(b) - taskScore(a));
  if (rotate && teacherTasks.length > 1) teacherTasks.push(teacherTasks.shift());
  if (rotate && personalTasks.length > 1) personalTasks.push(personalTasks.shift());

  const closing = appState.settings.includeClosing ? (total <= 10 ? 1 : total <= 25 ? 2 : 3) : 0;
  const warmup = appState.settings.includeWarmup && total >= 15 ? clamp(Math.round(total * .1), 2, 5) : 0;
  let remaining = total - closing - warmup;
  const plan = [];

  if (warmup) {
    plan.push({
      id: uid('block'), title: 'Activación consciente', source: 'app', category: 'warmup', duration: warmup,
      instruction: energy === 'low' ? 'Movilidad suave y un patrón conocido, sin buscar velocidad.' : 'Patrón cómodo, respiración y chequeo de tensión antes de exigir precisión.',
      success: 'Sentirte más disponible que al empezar.', bpm: 54
    });
  }

  if (focus && remaining >= 3) {
    const duration = clamp(Math.min(focus.suggestedMinutes || 5, Math.round(remaining * .28)), 3, Math.max(3, remaining - 3));
    plan.push(taskToBlock(focus, duration, energy));
    remaining -= duration;
  }

  const extras = [];
  if (total >= 20 && personalTasks.length) extras.push({ type: 'personal', duration: total >= 45 ? 7 : 5 });
  if (total >= 30) extras.push({ type: rotate ? 'theory' : 'improvisation', duration: total >= 60 ? 7 : 5 });
  if (total >= 45) extras.push({ type: rotate ? 'improvisation' : 'theory', duration: total >= 60 ? 7 : 5 });

  const extraBudget = extras.reduce((sum, item) => sum + item.duration, 0);
  const minimumTeacher = teacherTasks.length ? Math.ceil(total * (appState.profile.minTeacherShare / 100)) : 0;
  if (remaining - extraBudget < Math.max(3, minimumTeacher - plan.filter(p => p.source === 'teacher').reduce((s, p) => s + p.duration, 0))) {
    while (extras.length && remaining - extras.reduce((s, i) => s + i.duration, 0) < Math.max(3, minimumTeacher)) extras.pop();
  }

  const finalExtraBudget = extras.reduce((sum, item) => sum + item.duration, 0);
  let teacherBudget = Math.max(0, remaining - finalExtraBudget);

  if (teacherTasks.length && teacherBudget > 0) {
    const maxBlocks = teacherBudget >= 14 && teacherTasks.length > 1 ? 2 : 1;
    for (let index = 0; index < maxBlocks; index++) {
      const slotsLeft = maxBlocks - index;
      const duration = index === maxBlocks - 1 ? teacherBudget : clamp(Math.round(teacherBudget / slotsLeft), 4, appState.settings.maxBlockMinutes);
      plan.push(taskToBlock(teacherTasks[index], duration, energy));
      teacherBudget -= duration;
    }
    if (teacherBudget > 0) plan[plan.length - 1].duration += teacherBudget;
  } else if (remaining - finalExtraBudget > 0 && personalTasks.length) {
    const duration = remaining - finalExtraBudget;
    plan.push(taskToBlock(personalTasks[0], duration, energy));
  }

  extras.forEach(extra => {
    if (extra.type === 'personal' && personalTasks.length) {
      plan.push(taskToBlock(personalTasks[0], extra.duration, energy));
    } else if (extra.type === 'theory') {
      const nextLesson = THEORY_LESSONS.find(lesson => !appState.theoryProgress.completedLessons.includes(lesson.id)) || THEORY_LESSONS[0];
      plan.push({
        id: uid('block'), title: `Teoría · ${nextLesson.title}`, source: 'app', category: 'theory', duration: extra.duration,
        instruction: `Leé la idea central y probala en el teclado. ${nextLesson.practice}`,
        success: 'Poder explicarlo con tus palabras y tocar un ejemplo.', lessonId: nextLesson.id
      });
    } else if (extra.type === 'improvisation') {
      plan.push({
        id: uid('block'), title: 'Improvisación · motivo y variación', source: 'app', category: 'improvisation', duration: extra.duration,
        instruction: 'Usá tres notas, repetí el motivo y cambiá solo ritmo o final. Dejale espacio al silencio.',
        success: 'Dos vueltas con una idea reconocible, no una colección de notas sorprendidas.', bpm: 72
      });
    }
  });

  if (!plan.some(block => block.category !== 'warmup') && remaining > 0) {
    plan.push({ id: uid('block'), title: 'Práctica enfocada', source: 'personal', category: 'technique', duration: remaining, instruction: 'Elegí una dificultad concreta y trabajala en fragmentos pequeños.', success: 'Terminar con una próxima acción.' });
  }

  if (closing) {
    plan.push({
      id: uid('block'), title: 'Cierre y próxima acción', source: 'app', category: 'closing', duration: closing,
      instruction: 'Registrá qué mejoró, qué sigue bloqueado y por dónde conviene empezar la próxima vez.',
      success: 'Una próxima acción concreta.'
    });
  }

  const difference = total - plan.reduce((sum, block) => sum + block.duration, 0);
  const adjustable = [...plan].reverse().find(block => block.category !== 'closing');
  if (adjustable && difference !== 0) adjustable.duration = Math.max(1, adjustable.duration + difference);
  return plan;
}

function taskToBlock(task, duration, energy) {
  let instruction = task.method || task.objective;
  if (energy === 'low') instruction = `${instruction} Reducí el tempo y el tamaño del fragmento; priorizá relajación.`;
  if (energy === 'high') instruction = `${instruction} Cerrá con una pasada integrada o un pequeño aumento de tempo.`;
  return {
    id: uid('block'), taskId: task.id, title: task.title, source: task.source, category: task.category,
    duration: Math.max(1, duration), instruction, objective: task.objective, success: task.success,
    bpm: task.bpm || 60, targetBpm: task.targetBpm || null
  };
}

function updatePlan(action, index) {
  if (!ui.currentPlan[index]) return;
  if (action === 'remove') ui.currentPlan.splice(index, 1);
  if (action === 'up' && index > 0) [ui.currentPlan[index - 1], ui.currentPlan[index]] = [ui.currentPlan[index], ui.currentPlan[index - 1]];
  if (action === 'down' && index < ui.currentPlan.length - 1) [ui.currentPlan[index + 1], ui.currentPlan[index]] = [ui.currentPlan[index], ui.currentPlan[index + 1]];
  renderRoute();
}

function startPracticeSession(plan = ui.currentPlan, type = 'practice') {
  if (!plan.length) return toast('No hay plan', 'Generá o elegí una práctica antes de empezar.');
  ui.sessionRun = {
    type,
    plan: structuredClone(plan),
    index: 0,
    results: [],
    startedAt: Date.now(),
    blockStartedAt: Date.now(),
    remainingSeconds: plan[0].duration * 60,
    running: false,
    timerId: null,
    awaitingResult: false
  };
  renderSessionRunner();
}

function renderSessionRunner() {
  const run = ui.sessionRun;
  if (!run) return;
  const block = run.plan[run.index];
  const progress = percent(run.index, run.plan.length);
  const bpm = block.bpm || 60;

  openModal({
    title: block.title,
    eyebrow: `Bloque ${run.index + 1} de ${run.plan.length}`,
    wide: false,
    body: `
      <div class="timer-stage">
        <div class="progress-bar"><span style="width:${progress}%"></span></div>
        <div class="timer-value" id="timerValue">${formatTimer(run.remainingSeconds)}</div>
        <div class="timer-label">tiempo restante</div>
        <div class="session-meta">${sourceTag(block.source)}<span class="category-tag">${esc(CATEGORY_LABELS[block.category] || block.category)}</span></div>
      </div>
      <div class="session-instruction">
        <strong>Consigna</strong>
        <p id="sessionInstruction">${esc(block.instruction || block.objective || 'Trabajá con atención y cerrá con una observación concreta.')}</p>
        ${block.success ? `<p><b>Criterio de cierre:</b> ${esc(block.success)}</p>` : ''}
      </div>
      ${['repertoire','technique','improvisation','warmup'].includes(block.category) ? `
        <div class="metronome-panel">
          <button class="icon-button ghost" id="metronomeToggle" aria-label="Activar metrónomo">▶</button>
          <input id="bpmRange" type="range" min="30" max="180" value="${bpm}" />
          <span class="metronome-bpm"><b id="bpmValue">${bpm}</b> BPM</span>
        </div>
      ` : ''}
      <div id="sessionResultArea"></div>
    `,
    footer: `
      <button class="secondary-button" id="simplifyBlock">Simplificar</button>
      <button class="secondary-button" id="skipBlock">Omitir</button>
      <button class="primary-button" id="timerToggle">▶ Empezar</button>
      <button class="primary-button hidden" id="finishBlock">Cerrar bloque</button>
    `,
    onOpen: bindSessionRunner
  });
}

function bindSessionRunner() {
  const run = ui.sessionRun;
  if (!run) return;
  $('#timerToggle')?.addEventListener('click', toggleSessionTimer);
  $('#finishBlock')?.addEventListener('click', showBlockResult);
  $('#skipBlock')?.addEventListener('click', () => recordBlockResult('omitted'));
  $('#simplifyBlock')?.addEventListener('click', simplifyCurrentBlock);
  $('#bpmRange')?.addEventListener('input', event => {
    const bpm = Number(event.target.value);
    $('#bpmValue').textContent = bpm;
    run.plan[run.index].bpm = bpm;
    if (ui.metronome?.active) startMetronome(bpm);
  });
  $('#metronomeToggle')?.addEventListener('click', () => {
    const bpm = Number($('#bpmRange')?.value || 60);
    if (ui.metronome?.active) {
      stopMetronome();
      $('#metronomeToggle').textContent = '▶';
    } else {
      startMetronome(bpm);
      $('#metronomeToggle').textContent = '■';
    }
  });
}

function formatTimer(seconds) {
  const safe = Math.max(0, Math.round(seconds));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function toggleSessionTimer() {
  const run = ui.sessionRun;
  if (!run || run.awaitingResult) return;
  run.running = !run.running;
  const button = $('#timerToggle');
  if (run.running) {
    button.textContent = 'Ⅱ Pausar';
    $('#finishBlock')?.classList.remove('hidden');
    run.blockStartedAt = Date.now();
    run.timerId = setInterval(() => {
      run.remainingSeconds -= 1;
      const timer = $('#timerValue');
      if (timer) timer.textContent = formatTimer(run.remainingSeconds);
      if (run.remainingSeconds <= 0) {
        clearInterval(run.timerId);
        run.timerId = null;
        run.running = false;
        showBlockResult();
        playClick(880, .08);
      }
    }, 1000);
  } else {
    clearInterval(run.timerId);
    run.timerId = null;
    button.textContent = '▶ Continuar';
  }
}

function simplifyCurrentBlock() {
  const run = ui.sessionRun;
  const block = run?.plan[run.index];
  if (!block) return;
  block.bpm = Math.max(30, Number(block.bpm || 60) - 10);
  block.instruction = `${block.instruction || ''} Trabajá un fragmento más corto, una mano por vez y a menor tempo.`.trim();
  $('#sessionInstruction').textContent = block.instruction;
  if ($('#bpmRange')) {
    $('#bpmRange').value = block.bpm;
    $('#bpmValue').textContent = block.bpm;
  }
  toast('Bloque simplificado', 'Menos variables, más atención. Una rareza sensata.');
}

function showBlockResult() {
  const run = ui.sessionRun;
  if (!run || run.awaitingResult) return;
  run.awaitingResult = true;
  run.running = false;
  if (run.timerId) clearInterval(run.timerId);
  run.timerId = null;
  stopMetronome();
  $('#timerToggle')?.classList.add('hidden');
  $('#finishBlock')?.classList.add('hidden');
  $('#skipBlock')?.classList.add('hidden');
  $('#simplifyBlock')?.classList.add('hidden');
  $('#sessionResultArea').innerHTML = `
    <div class="divider"></div>
    <div class="quiz-question">¿Cómo salió este bloque?</div>
    <div class="result-buttons">
      <button class="result-button" data-block-result="achieved">Logrado</button>
      <button class="result-button" data-block-result="partial">Parcial</button>
      <button class="result-button" data-block-result="blocked">Bloqueado</button>
    </div>
    <div class="field mt-14"><label for="blockNote">Observación opcional</label><input id="blockNote" placeholder="Qué cambió o por dónde seguir" /></div>
  `;
  $$('[data-block-result]').forEach(button => button.addEventListener('click', () => recordBlockResult(button.dataset.blockResult, $('#blockNote')?.value.trim())));
}

async function recordBlockResult(result, note = '') {
  const run = ui.sessionRun;
  if (!run) return;
  if (run.timerId) clearInterval(run.timerId);
  stopMetronome();
  const block = run.plan[run.index];
  run.results.push({
    ...block,
    result,
    note,
    elapsedSeconds: Math.max(0, block.duration * 60 - run.remainingSeconds)
  });

  if (block.taskId) {
    const task = appState.tasks.find(item => item.id === block.taskId);
    if (task) {
      task.lastPracticed = localISO();
      task.completedThisWeek = Number(task.completedThisWeek || 0) + 1;
      if (result === 'achieved' && task.bpm && block.bpm) task.bpm = Math.max(task.bpm, block.bpm);
    }
  }

  run.index += 1;
  if (run.index >= run.plan.length) {
    await finishPracticeSession();
    return;
  }
  run.remainingSeconds = run.plan[run.index].duration * 60;
  run.running = false;
  run.awaitingResult = false;
  renderSessionRunner();
}

async function finishPracticeSession() {
  const run = ui.sessionRun;
  if (!run) return;
  const plannedMinutes = run.plan.reduce((sum, block) => sum + block.duration, 0);
  const elapsedMinutes = Math.max(1, Math.round((Date.now() - run.startedAt) / 60000));
  const actualMinutes = Math.min(plannedMinutes, elapsedMinutes);
  const achieved = run.results.filter(item => item.result === 'achieved').length;
  const omitted = run.results.filter(item => item.result === 'omitted').length;
  const session = {
    id: uid('session'),
    date: localISO(),
    plannedMinutes,
    actualMinutes,
    mood: achieved >= Math.max(1, run.results.length / 2) ? 'buena' : 'correcta',
    type: run.type,
    demo: false,
    blocks: run.results.map(item => ({
      category: item.category, source: item.source, title: item.title,
      minutes: item.duration, result: item.result, note: item.note || ''
    }))
  };
  appState.sessions.push(session);
  if (run.type === 'improvisation') appState.improvisationProgress.completedSessions += 1;
  appState.demoMode = appState.sessions.some(item => item.demo);
  await saveState();
  ui.sessionRun = null;
  ui.currentPlan = [];
  closeModal();
  renderRoute();

  openModal({
    title: 'Sesión completada',
    eyebrow: 'Fade Out Piano',
    body: `
      <div class="timer-stage">
        <div class="timer-value">${actualMinutes}</div>
        <div class="timer-label">minutos registrados</div>
      </div>
      <div class="kpi-grid mt-18">
        <div class="card soft kpi-card"><div class="kpi-label">Bloques</div><div class="kpi-value">${run.results.length}</div></div>
        <div class="card soft kpi-card"><div class="kpi-label">Logrados</div><div class="kpi-value">${achieved}</div></div>
        <div class="card soft kpi-card"><div class="kpi-label">Omitidos</div><div class="kpi-value">${omitted}</div></div>
        <div class="card soft kpi-card"><div class="kpi-label">Planeado</div><div class="kpi-value">${plannedMinutes}</div></div>
      </div>
      <div class="prompt-box mt-18"><span>Próxima acción</span><p>${esc(suggestNextAction(run.results))}</p></div>
    `,
    footer: `<button class="secondary-button" id="goProgress">Ver progreso</button><button class="primary-button" data-close-modal>Cerrar</button>`,
    onOpen: () => {
      $('[data-close-modal]').addEventListener('click', closeModal);
      $('#goProgress').addEventListener('click', () => { closeModal(); setRoute('progreso'); });
    }
  });
}

function suggestNextAction(results) {
  const blocked = results.find(item => item.result === 'blocked');
  if (blocked) return `Volvé a “${blocked.title}” con menos tempo, un fragmento más corto o una sola mano.`;
  const partial = results.find(item => item.result === 'partial');
  if (partial) return `Retomá “${partial.title}” desde el último punto estable antes de aumentar dificultad.`;
  return 'Repetí el objetivo más importante una vez más en la próxima sesión y después integralo en un contexto más amplio.';
}

function startMetronome(bpm = 60) {
  stopMetronome();
  const interval = 60000 / bpm;
  ui.metronome = { active: true, bpm, timerId: null };
  playClick(1050, .035);
  ui.metronome.timerId = setInterval(() => playClick(1050, .035), interval);
}

function stopMetronome() {
  if (ui.metronome?.timerId) clearInterval(ui.metronome.timerId);
  ui.metronome = null;
}

function playClick(frequency = 900, duration = .04) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const context = playClick.context || (playClick.context = new AudioCtx());
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.18, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  } catch (error) {
    console.warn('No se pudo reproducir audio.', error);
  }
}

function renderWeek() {
  const { start, end, nextClass } = getCurrentCycle();
  const stats = getWeeklyStats();
  const sessions = getCycleSessions();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const iso = localISO(date);
    const daySessions = sessions.filter(session => session.date === iso);
    return { date, iso, sessions: daySessions };
  });
  const teacherTasks = appState.tasks.filter(task => task.source === 'teacher' && task.status === 'active').sort((a, b) => taskScore(b) - taskScore(a));
  const latestNote = [...appState.classNotes].sort((a, b) => b.date.localeCompare(a.date))[0];

  return `
    <div class="page-grid">
      <section class="card pad accent-card">
        <div class="row between wrap">
          <div>
            <span class="eyebrow">Ciclo actual</span>
            <h2 class="mt-10">${formatDate(start, { day: 'numeric', month: 'long' })} al ${formatDate(end, { day: 'numeric', month: 'long' })}</h2>
            <p class="muted small">La semana empieza con la clase y termina preparando la siguiente, en vez de obedecer mansamente al calendario civil.</p>
          </div>
          <div class="row wrap">
            ${statusTag(`${stats.sessions}/${stats.sessionGoal} sesiones`, stats.sessions >= stats.sessionGoal ? 'success' : '')}
            ${statusTag(`${stats.minutes}/${stats.minuteGoal} min`, stats.minutes >= stats.minuteGoal ? 'success' : '')}
            ${statusTag(`Clase ${formatDate(nextClass)}`, 'warning')}
          </div>
        </div>
        <div class="week-strip mt-18">
          ${days.map(day => {
            const isToday = day.iso === localISO();
            const minutes = day.sessions.reduce((sum, session) => sum + session.actualMinutes, 0);
            return `<div class="day-cell ${isToday ? 'today' : ''}">
              <div class="day-name">${formatDate(day.date, { weekday: 'short' })}</div>
              <div class="day-number">${day.date.getDate()}</div>
              <div class="day-session">${minutes ? `<span class="day-dot"></span>${minutes} min · ${day.sessions.length} sesión${day.sessions.length === 1 ? '' : 'es'}` : indexDayLabel(day.date, start, nextClass)}</div>
            </div>`;
          }).join('')}
        </div>
      </section>

      <div class="page-grid two">
        <section class="page-section">
          <div class="section-header"><div><h2>Indicaciones de la clase</h2><p>Contexto general arriba; tareas ejecutables abajo. Las notas solas son cementerios de buenas intenciones.</p></div><button class="secondary-button" id="addClassNote">＋ Nota de clase</button></div>
          <div class="card pad">
            ${latestNote ? `
              <div class="prompt-box"><span>Última clase · ${formatDate(latestNote.date, { day: 'numeric', month: 'long' })}</span><p>${esc(latestNote.text)}</p></div>
            ` : `<div class="empty-state"><strong>Sin notas de clase</strong><p>Cargá una síntesis breve y después convertí lo importante en tareas.</p></div>`}
            <div class="divider"></div>
            <div class="row between wrap"><strong>Tareas activas de la profesora</strong><button class="text-button" id="addTeacherTask">＋ Nueva tarea</button></div>
            <div class="task-list mt-14">
              ${teacherTasks.map(task => `
                <div class="task-row">
                  <span class="task-icon">${task.category === 'technique' ? '⌁' : '♫'}</span>
                  <div class="task-copy">
                    <strong>${esc(task.title)}</strong>
                    <span>${esc(task.objective)}</span>
                    <div class="row wrap mt-10">${sourceTag(task.source)} ${statusTag(task.priority === 3 ? 'Alta' : task.priority === 2 ? 'Media' : 'Normal', task.priority === 3 ? 'warning' : '')}</div>
                  </div>
                  <span class="task-meta">${task.suggestedMinutes} min</span>
                </div>
              `).join('') || `<div class="empty-state"><strong>No hay tareas activas</strong><p>Una semana sin tareas puede ser descanso deliberado o simple olvido. La aplicación, prudentemente, no adivina.</p></div>`}
            </div>
          </div>
        </section>

        <aside class="page-section">
          <div class="section-header"><div><h2>Preparación para la clase</h2><p>Qué mostrar, qué preguntar y qué no conviene ocultar bajo una ejecución rápida.</p></div></div>
          <div class="card pad">
            <div class="stack">
              <div>
                <div class="row between"><span class="control-label">Sesiones</span><strong>${stats.sessions}/${stats.sessionGoal}</strong></div>
                <div class="progress-bar mt-10"><span style="width:${clamp(percent(stats.sessions, stats.sessionGoal), 0, 100)}%"></span></div>
              </div>
              <div>
                <div class="row between"><span class="control-label">Tiempo</span><strong>${stats.minutes}/${stats.minuteGoal} min</strong></div>
                <div class="progress-bar mt-10"><span style="width:${clamp(percent(stats.minutes, stats.minuteGoal), 0, 100)}%"></span></div>
              </div>
              <div class="divider"></div>
              <div class="insight-list">
                ${weekInsights(teacherTasks, sessions).map(item => `<div class="insight"><span class="insight-mark"></span><div><strong>${esc(item.title)}</strong><p>${esc(item.text)}</p></div></div>`).join('')}
              </div>
              <button class="primary-button full" id="generatePreClass">GENERAR REPASO PREVIO</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  `;
}

function indexDayLabel(date, start, nextClass) {
  const iso = localISO(date);
  if (iso === localISO(start)) return '<span class="day-dot"></span>Inicio del ciclo';
  if (iso === localISO(nextClass)) return '<span class="day-dot"></span>Clase';
  if (iso === localISO()) return 'Hoy · sin sesión';
  return 'Sin práctica registrada';
}

function weekInsights(tasks, sessions) {
  const blocks = sessions.flatMap(session => session.blocks || []);
  const teacherMinutes = blocks.filter(block => block.source === 'teacher').reduce((sum, block) => sum + block.minutes, 0);
  const personalMinutes = blocks.filter(block => block.source === 'personal').reduce((sum, block) => sum + block.minutes, 0);
  const blocked = blocks.filter(block => block.result === 'blocked');
  const stale = tasks.find(task => daysBetween(task.lastPracticed) >= 4);
  const insights = [];
  if (stale) insights.push({ title: 'Tarea postergada', text: `${stale.title} lleva ${daysBetween(stale.lastPracticed)} días sin aparecer.` });
  if (blocked.length) insights.push({ title: 'Duda para llevar', text: `${blocked[0].title} quedó bloqueada. Conviene anotar exactamente dónde y con qué síntoma.` });
  insights.push({ title: 'Distribución', text: `${teacherMinutes} min de clase y ${personalMinutes} min personales registrados en el ciclo.` });
  if (insights.length < 3) insights.push({ title: 'Cierre recomendado', text: 'El día previo, priorizá una ejecución completa y después una corrección breve, no veinte intentos de rescate.' });
  return insights.slice(0, 3);
}

function bindWeek() {
  $('#addClassNote')?.addEventListener('click', openClassNoteModal);
  $('#addTeacherTask')?.addEventListener('click', () => openTaskModal('teacher'));
  $('#generatePreClass')?.addEventListener('click', () => {
    const duration = Math.max(20, ui.duration || 30);
    ui.duration = duration;
    ui.energy = 'normal';
    ui.currentPlan = generatePreClassPlan(duration);
    setRoute('hoy');
    toast('Repaso preparado', 'Más integración, menos microscopio. La clase está cerca.');
  });
}

function openClassNoteModal() {
  openModal({
    title: 'Nota de clase',
    eyebrow: 'Semana',
    body: `<div class="field-grid"><div class="field"><label for="classDate">Fecha</label><input id="classDate" type="date" value="${localISO(getCurrentCycle().start)}" /></div><div class="field span-2"><label for="classText">Síntesis</label><textarea id="classText" placeholder="Qué trabajaron, qué corrigió la profesora y qué conviene priorizar"></textarea></div></div>`,
    footer: `<button class="secondary-button" data-close-modal>Cancelar</button><button class="primary-button" id="saveClassNote">Guardar nota</button>`,
    onOpen: () => {
      $('[data-close-modal]').addEventListener('click', closeModal);
      $('#saveClassNote').addEventListener('click', async () => {
        const text = $('#classText').value.trim();
        if (!text) return toast('La nota está vacía', 'Una pantalla en blanco tiene pureza estética, pero poca utilidad pedagógica.');
        appState.classNotes.push({ id: uid('note'), date: $('#classDate').value || localISO(), text });
        appState.demoMode = false;
        await saveState();
        closeModal(); renderRoute(); toast('Nota guardada');
      });
    }
  });
}

function generatePreClassPlan(total) {
  const teachers = appState.tasks.filter(task => task.source === 'teacher' && task.status === 'active').sort((a, b) => taskScore(b) - taskScore(a));
  const closing = 3;
  const remaining = total - closing;
  const plan = [];
  if (!teachers.length) return generatePracticePlan(total, 'normal');
  const first = Math.ceil(remaining * .55);
  plan.push({ ...taskToBlock(teachers[0], first, 'normal'), instruction: `${teachers[0].method} Terminá con una ejecución continua como la mostrarías en clase.` });
  if (teachers[1] && remaining - first > 0) plan.push({ ...taskToBlock(teachers[1], remaining - first, 'normal'), instruction: `${teachers[1].method} Registrá una duda precisa si el problema persiste.` });
  plan.push({ id: uid('block'), title: 'Resumen para la clase', source: 'app', category: 'closing', duration: closing, instruction: 'Anotá un logro, un bloqueo y una pregunta concreta para tu profesora.', success: 'Tres frases breves, sin autobiografía de la semana.' });
  return plan;
}

function renderRepertoire() {
  const filters = [
    ['active', 'Activo'], ['paused', 'En pausa'], ['completed', 'Completado'], ['all', 'Todo']
  ];
  const items = appState.repertoire.filter(item => ui.repertoireFilter === 'all' || item.status === ui.repertoireFilter);

  return `
    <div class="page-grid">
      <div class="section-header">
        <div><h2>Obras y áreas de trabajo</h2><p>Los contenedores grandes. Las tareas concretas viven adentro, como corresponde a una jerarquía que no fue diseñada por una fotocopiadora.</p></div>
        <button class="primary-button" id="addRepertoire">＋ Agregar</button>
      </div>
      <div class="tabs">
        ${filters.map(([value, label]) => `<button class="tab-button ${ui.repertoireFilter === value ? 'active' : ''}" data-repertoire-filter="${value}">${label}</button>`).join('')}
      </div>
      <div class="repertoire-grid">
        ${items.map(item => renderRepertoireCard(item)).join('') || `<div class="empty-state"><strong>No hay elementos en esta vista</strong><p>Probá otro filtro o agregá una obra, área técnica o proyecto.</p></div>`}
      </div>
    </div>
  `;
}

function renderRepertoireCard(item) {
  const tasks = appState.tasks.filter(task => task.repertoireId === item.id);
  const active = tasks.filter(task => task.status === 'active').length;
  const minutes = appState.sessions.flatMap(session => session.blocks || [])
    .filter(block => tasks.some(task => task.title === block.title))
    .reduce((sum, block) => sum + Number(block.minutes || 0), 0);
  const statusLabel = item.status === 'active' ? 'Activo' : item.status === 'paused' ? 'En pausa' : 'Completado';
  return `
    <article class="card repertoire-card">
      <div class="row between"><span class="meta-line">${esc(item.type)}</span>${statusTag(statusLabel, item.status === 'completed' ? 'success' : item.status === 'paused' ? 'warning' : '')}</div>
      <h3>${esc(item.title)}</h3>
      <p>${esc(item.composer || 'Sin autor o descripción')}</p>
      <div class="card-spacer"></div>
      <div class="stats-row" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:18px">
        <div class="stat-chip"><strong>${active}</strong><span>tareas activas</span></div>
        <div class="stat-chip"><strong>${minutes}</strong><span>min registrados</span></div>
      </div>
      <div class="card-actions"><span class="muted small">Desde ${formatDate(item.startedAt)}</span><button class="text-button" data-open-repertoire="${esc(item.id)}">Ver detalle →</button></div>
    </article>
  `;
}

function bindRepertoire() {
  $$('[data-repertoire-filter]').forEach(button => button.addEventListener('click', () => {
    ui.repertoireFilter = button.dataset.repertoireFilter;
    renderRoute();
  }));
  $('#addRepertoire')?.addEventListener('click', openRepertoireModal);
  $$('[data-open-repertoire]').forEach(button => button.addEventListener('click', () => openRepertoireDetail(button.dataset.openRepertoire)));
}

function openRepertoireModal() {
  openModal({
    title: 'Nuevo elemento',
    eyebrow: 'Repertorio',
    body: `
      <div class="field-grid">
        <div class="field span-2"><label for="repTitle">Nombre</label><input id="repTitle" placeholder="Obra, técnica, método o proyecto" /></div>
        <div class="field"><label for="repComposer">Compositor o descripción</label><input id="repComposer" placeholder="Opcional" /></div>
        <div class="field"><label for="repType">Tipo</label><select id="repType"><option>Obra</option><option>Técnica</option><option>Ejercicio</option><option>Laboratorio</option><option>Proyecto</option></select></div>
        <div class="field span-2"><label for="repNotes">Notas generales</label><textarea id="repNotes" placeholder="Qué querés trabajar y por qué"></textarea></div>
      </div>
    `,
    footer: `<button class="secondary-button" data-close-modal>Cancelar</button><button class="primary-button" id="saveRepertoire">Agregar</button>`,
    onOpen: () => {
      $('[data-close-modal]').addEventListener('click', closeModal);
      $('#saveRepertoire').addEventListener('click', async () => {
        const title = $('#repTitle').value.trim();
        if (!title) return toast('Falta el nombre');
        appState.repertoire.push({ id: uid('rep'), title, composer: $('#repComposer').value.trim(), type: $('#repType').value, status: 'active', startedAt: localISO(), notes: $('#repNotes').value.trim() });
        appState.demoMode = false;
        await saveState(); closeModal(); renderRoute(); toast('Elemento agregado', title);
      });
    }
  });
}

function openRepertoireDetail(id) {
  const item = appState.repertoire.find(rep => rep.id === id);
  if (!item) return;
  const tasks = appState.tasks.filter(task => task.repertoireId === id);
  openModal({
    title: item.title,
    eyebrow: item.type,
    wide: true,
    body: `
      <div class="page-grid equal">
        <div class="stack">
          <div class="prompt-box"><span>Descripción</span><p>${esc(item.notes || 'Sin notas generales.')}</p></div>
          <div class="field"><label>Estado</label><select id="detailStatus"><option value="active" ${item.status === 'active' ? 'selected' : ''}>Activo</option><option value="paused" ${item.status === 'paused' ? 'selected' : ''}>En pausa</option><option value="completed" ${item.status === 'completed' ? 'selected' : ''}>Completado</option></select></div>
        </div>
        <div>
          <div class="row between"><strong>Tareas</strong><button class="text-button" id="detailAddTask">＋ Agregar tarea</button></div>
          <div class="task-list mt-14">
            ${tasks.map(task => `<div class="task-row"><span class="task-icon">${task.category === 'technique' ? '⌁' : task.category === 'improvisation' ? '≈' : '♫'}</span><div class="task-copy"><strong>${esc(task.title)}</strong><span>${esc(task.objective)}</span><div class="row wrap mt-10">${sourceTag(task.source)}</div></div><span class="task-meta">${task.suggestedMinutes} min</span></div>`).join('') || `<div class="empty-state"><strong>Sin tareas</strong><p>El elemento existe, pero todavía no sabe qué hacer con su vida.</p></div>`}
          </div>
        </div>
      </div>
    `,
    footer: `<button class="secondary-button" data-close-modal>Cerrar</button><button class="primary-button" id="saveRepertoireStatus">Guardar estado</button>`,
    onOpen: () => {
      $('[data-close-modal]').addEventListener('click', closeModal);
      $('#saveRepertoireStatus').addEventListener('click', async () => {
        item.status = $('#detailStatus').value;
        await saveState(); closeModal(); renderRoute(); toast('Estado actualizado');
      });
      $('#detailAddTask').addEventListener('click', () => {
        closeModal();
        openTaskModal('personal', id);
      });
    }
  });
}

function openTaskModal(source = 'personal', repertoireId = '') {
  const repertoireOptions = appState.repertoire.filter(item => item.status === 'active').map(item => `<option value="${esc(item.id)}" ${repertoireId === item.id ? 'selected' : ''}>${esc(item.title)}</option>`).join('');
  openModal({
    title: source === 'teacher' ? 'Tarea de la profesora' : 'Objetivo personal',
    eyebrow: source === 'teacher' ? 'Semana' : 'Mi laboratorio',
    wide: true,
    body: `
      <div class="field-grid">
        <div class="field span-2"><label for="taskTitle">Tarea concreta</label><input id="taskTitle" placeholder="Qué vas a hacer" /></div>
        <div class="field"><label for="taskRepertoire">Obra o área</label><select id="taskRepertoire"><option value="">Sin asociar</option>${repertoireOptions}</select></div>
        <div class="field"><label for="taskCategory">Categoría</label><select id="taskCategory"><option value="repertoire">Repertorio</option><option value="technique">Técnica</option><option value="improvisation">Improvisación</option><option value="theory">Teoría</option></select></div>
        <div class="field span-2"><label for="taskObjective">Objetivo</label><textarea id="taskObjective" placeholder="Qué resultado buscás"></textarea></div>
        <div class="field span-2"><label for="taskMethod">Método</label><textarea id="taskMethod" placeholder="Cómo vas a trabajarlo: fragmentos, manos, tempo, repetición"></textarea></div>
        <div class="field span-2"><label for="taskSuccess">Criterio de cierre</label><input id="taskSuccess" placeholder="Cuándo considerar el bloque terminado" /></div>
        <div class="field"><label for="taskMinutes">Minutos sugeridos</label><input id="taskMinutes" type="number" min="2" max="30" value="7" /></div>
        <div class="field"><label for="taskPriority">Prioridad</label><select id="taskPriority"><option value="1">Normal</option><option value="2" selected>Media</option><option value="3">Alta</option></select></div>
        <div class="field"><label for="taskFrequency">Veces por semana</label><input id="taskFrequency" type="number" min="1" max="7" value="2" /></div>
        <div class="field"><label for="taskBpm">Tempo inicial</label><input id="taskBpm" type="number" min="20" max="240" placeholder="Opcional" /></div>
      </div>
    `,
    footer: `<button class="secondary-button" data-close-modal>Cancelar</button><button class="primary-button" id="saveTask">Guardar tarea</button>`,
    onOpen: () => {
      $('[data-close-modal]').addEventListener('click', closeModal);
      $('#saveTask').addEventListener('click', async () => {
        const title = $('#taskTitle').value.trim();
        if (!title) return toast('Falta la tarea concreta');
        appState.tasks.push({
          id: uid('task'), repertoireId: $('#taskRepertoire').value || null, title,
          source, category: $('#taskCategory').value, priority: Number($('#taskPriority').value),
          suggestedMinutes: clamp(Number($('#taskMinutes').value) || 7, 2, 30),
          objective: $('#taskObjective').value.trim() || 'Mejorar el aspecto elegido con atención.',
          method: $('#taskMethod').value.trim() || 'Trabajar lento, en fragmentos y registrar el resultado.',
          success: $('#taskSuccess').value.trim() || 'Cerrar con una repetición estable y una próxima acción.',
          bpm: Number($('#taskBpm').value) || null, targetBpm: null,
          status: 'active', lastPracticed: dateOffset(-14), frequencyPerWeek: clamp(Number($('#taskFrequency').value) || 2, 1, 7), completedThisWeek: 0, protected: false
        });
        appState.demoMode = false;
        await saveState(); closeModal(); renderRoute(); toast('Tarea guardada', title);
      });
    }
  });
}

function renderLab() {
  const tabs = [
    ['objetivos', 'Objetivos personales'],
    ['exploraciones', 'Exploraciones'],
    ['rutinas', 'Rutinas técnicas'],
    ['libre', 'Práctica libre']
  ];
  return `
    <div class="page-grid">
      <section class="card pad accent-card">
        <div class="row between wrap">
          <div>
            <span class="eyebrow">Mi laboratorio</span>
            <h2 class="mt-10">Lo que querés investigar por cuenta propia</h2>
            <p class="muted small">Una zona separada del trabajo de clase, pero lo bastante estructurada como para que la curiosidad no se evapore después de dos tardes.</p>
          </div>
          <button class="primary-button" id="addPersonalGoal">＋ Nuevo objetivo</button>
        </div>
      </section>
      <div class="tabs">
        ${tabs.map(([value, label]) => `<button class="tab-button ${ui.labTab === value ? 'active' : ''}" data-lab-tab="${value}">${label}</button>`).join('')}
      </div>
      ${renderLabTab()}
    </div>
  `;
}

function renderLabTab() {
  if (ui.labTab === 'objetivos') {
    const tasks = appState.tasks.filter(task => task.source === 'personal' && task.status === 'active');
    return `<div class="repertoire-grid">
      ${tasks.map(task => `
        <article class="card repertoire-card">
          <div class="row between"><span class="meta-line">${esc(CATEGORY_LABELS[task.category] || task.category)}</span>${statusTag(task.protected ? 'Protegida' : `${task.frequencyPerWeek || 1}× semana`, task.protected ? 'warning' : '')}</div>
          <h3>${esc(task.title)}</h3>
          <p>${esc(task.objective)}</p>
          <div class="card-spacer"></div>
          <div class="progress-bar mt-18"><span style="width:${clamp(percent(task.completedThisWeek || 0, task.frequencyPerWeek || 1), 0, 100)}%"></span></div>
          <div class="progress-meta"><span>${task.completedThisWeek || 0} de ${task.frequencyPerWeek || 1} esta semana</span><span>${task.suggestedMinutes} min</span></div>
          <div class="card-actions">
            <button class="text-button" data-protect-task="${esc(task.id)}">${task.protected ? 'Desproteger' : 'Proteger hoy'}</button>
            <button class="secondary-button" data-practice-task="${esc(task.id)}">Practicar</button>
          </div>
        </article>
      `).join('') || `<div class="empty-state"><strong>No hay objetivos personales</strong><p>Creá uno puntual o recurrente. “Quiero mejorar técnica” no cuenta; “staccato parejo en dos escalas conocidas” empieza a parecer una tarea.</p><button class="primary-button" id="emptyAddGoal">Crear objetivo</button></div>`}
    </div>`;
  }

  if (ui.labTab === 'exploraciones') {
    return `<div class="page-grid two">
      <section class="card pad">
        <div class="row between"><div><h3 class="mt-0">Bandeja de ideas</h3><p class="muted small">Se guardan sin entrar automáticamente al plan.</p></div><button class="secondary-button" id="addExploration">＋ Idea</button></div>
        <div class="task-list mt-18">
          ${appState.explorations.filter(item => item.status === 'idea').map(item => `
            <div class="task-row">
              <span class="task-icon">?</span>
              <div class="task-copy"><strong>${esc(item.title)}</strong><span>${esc(item.note || '')}</span><span>Guardada ${formatDate(item.createdAt)}</span></div>
              <div class="stack"><button class="text-button" data-convert-exploration="${esc(item.id)}">Convertir</button><button class="text-button" data-archive-exploration="${esc(item.id)}">Archivar</button></div>
            </div>
          `).join('') || `<div class="empty-state"><strong>La bandeja está vacía</strong><p>No es una tragedia. También se puede tocar sin fundar un proyecto nuevo cada quince minutos.</p></div>`}
        </div>
      </section>
      <aside class="card pad soft">
        <div class="card-header"><div><h3>De idea a práctica</h3><p>La conversión agrega frecuencia, método y criterio de cierre.</p></div></div>
        <div class="insight-list mt-18">
          <div class="insight"><span class="insight-mark"></span><div><strong>Idea</strong><p>Algo que te interesa, todavía sin compromiso.</p></div></div>
          <div class="insight"><span class="insight-mark"></span><div><strong>Objetivo</strong><p>Resultado observable, por ejemplo sostener un motivo durante dos vueltas.</p></div></div>
          <div class="insight"><span class="insight-mark"></span><div><strong>Tarea</strong><p>La acción que puede entrar en una sesión concreta.</p></div></div>
        </div>
      </aside>
    </div>`;
  }

  if (ui.labTab === 'rutinas') {
    const technical = appState.tasks.filter(task => task.source === 'personal' && task.category === 'technique' && task.status === 'active');
    return `<div class="page-grid two">
      <section class="card pad">
        <div class="card-header"><div><h3>Rutina técnica actual</h3><p>Actividades recurrentes que rotan según frecuencia y última práctica.</p></div></div>
        <div class="task-list mt-18">
          ${technical.map(task => `<div class="task-row"><span class="task-icon">⌁</span><div class="task-copy"><strong>${esc(task.title)}</strong><span>${esc(task.method)}</span><div class="row wrap mt-10">${statusTag(`${task.frequencyPerWeek || 1}× semana`)}${task.bpm ? statusTag(`${task.bpm} BPM`) : ''}</div></div><button class="secondary-button" data-practice-task="${esc(task.id)}">Practicar</button></div>`).join('') || `<div class="empty-state"><strong>Sin rutina técnica personal</strong><p>Podés agregar articulación, escalas, arpegios o coordinación sin mezclarlos con una obra.</p></div>`}
        </div>
      </section>
      <aside class="card pad soft">
        <div class="card-header"><div><h3>Regla de rotación</h3><p>Versión inicial</p></div></div>
        <p class="muted small mt-18">El generador prioriza lo que lleva más días sin practicarse y lo que todavía no alcanzó su frecuencia semanal. Más adelante podrá rotar tonalidades, articulaciones y patrones dentro de una misma rutina.</p>
      </aside>
    </div>`;
  }

  return `<div class="page-grid two">
    <section class="card pad accent-card">
      <div class="card-header"><div><h3>Práctica libre</h3><p>Tocá sin plan obligatorio y decidí después si algo merece convertirse en objetivo.</p></div></div>
      <div class="timer-stage mt-18"><div class="timer-value">∞</div><div class="timer-label">sin evaluación automática</div></div>
      <button class="primary-button full mt-18" id="startFreePractice">▶ INICIAR PRÁCTICA LIBRE</button>
    </section>
    <aside class="card pad soft">
      <div class="card-header"><div><h3>Qué se registra</h3><p>Lo mínimo para no transformar el placer en burocracia.</p></div></div>
      <div class="insight-list mt-18">
        <div class="insight"><span class="insight-mark"></span><div><strong>Tiempo real</strong><p>Desde iniciar hasta cerrar la práctica.</p></div></div>
        <div class="insight"><span class="insight-mark"></span><div><strong>Descripción opcional</strong><p>Qué tocaste o qué apareció.</p></div></div>
        <div class="insight"><span class="insight-mark"></span><div><strong>Continuación opcional</strong><p>Convertir una idea en tarea u objetivo.</p></div></div>
      </div>
    </aside>
  </div>`;
}

function bindLab() {
  $$('[data-lab-tab]').forEach(button => button.addEventListener('click', () => { ui.labTab = button.dataset.labTab; renderRoute(); }));
  $('#addPersonalGoal')?.addEventListener('click', () => openTaskModal('personal'));
  $('#emptyAddGoal')?.addEventListener('click', () => openTaskModal('personal'));
  $('#addExploration')?.addEventListener('click', openExplorationModal);
  $('#startFreePractice')?.addEventListener('click', startFreePractice);
  $$('[data-practice-task]').forEach(button => button.addEventListener('click', () => {
    const task = appState.tasks.find(item => item.id === button.dataset.practiceTask);
    if (!task) return;
    startPracticeSession([taskToBlock(task, task.suggestedMinutes || 5, 'normal')]);
  }));
  $$('[data-protect-task]').forEach(button => button.addEventListener('click', async () => {
    const task = appState.tasks.find(item => item.id === button.dataset.protectTask);
    if (!task) return;
    task.protected = !task.protected;
    ui.todayFocus = task.protected ? task : ui.todayFocus?.id === task.id ? null : ui.todayFocus;
    await saveState(); renderRoute();
  }));
  $$('[data-convert-exploration]').forEach(button => button.addEventListener('click', () => convertExploration(button.dataset.convertExploration)));
  $$('[data-archive-exploration]').forEach(button => button.addEventListener('click', async () => {
    const item = appState.explorations.find(exp => exp.id === button.dataset.archiveExploration);
    if (item) { item.status = 'archived'; await saveState(); renderRoute(); }
  }));
}

function openExplorationModal() {
  openModal({
    title: 'Nueva exploración', eyebrow: 'Mi laboratorio',
    body: `<div class="field"><label for="explorationTitle">Idea</label><input id="explorationTitle" placeholder="Qué te interesa probar o entender" /></div><div class="field mt-14"><label for="explorationNote">Contexto</label><textarea id="explorationNote" placeholder="Por qué te interesa o cómo podrías empezar"></textarea></div>`,
    footer: `<button class="secondary-button" data-close-modal>Cancelar</button><button class="primary-button" id="saveExploration">Guardar idea</button>`,
    onOpen: () => {
      $('[data-close-modal]').addEventListener('click', closeModal);
      $('#saveExploration').addEventListener('click', async () => {
        const title = $('#explorationTitle').value.trim();
        if (!title) return toast('Falta la idea');
        appState.explorations.push({ id: uid('exp'), title, note: $('#explorationNote').value.trim(), createdAt: localISO(), status: 'idea' });
        appState.demoMode = false;
        await saveState(); closeModal(); renderRoute();
      });
    }
  });
}

function convertExploration(id) {
  const item = appState.explorations.find(exp => exp.id === id);
  if (!item) return;
  openModal({
    title: 'Convertir en objetivo', eyebrow: 'De idea a práctica',
    body: `<div class="prompt-box"><span>Idea original</span><p>${esc(item.title)}</p></div><div class="field mt-18"><label for="convertObjective">Resultado buscado</label><textarea id="convertObjective">${esc(item.note || '')}</textarea></div><div class="field-grid mt-14"><div class="field"><label for="convertMinutes">Minutos</label><input id="convertMinutes" type="number" value="7" min="2" max="30" /></div><div class="field"><label for="convertFrequency">Veces por semana</label><input id="convertFrequency" type="number" value="1" min="1" max="7" /></div></div>`,
    footer: `<button class="secondary-button" data-close-modal>Cancelar</button><button class="primary-button" id="saveConverted">Convertir</button>`,
    onOpen: () => {
      $('[data-close-modal]').addEventListener('click', closeModal);
      $('#saveConverted').addEventListener('click', async () => {
        appState.tasks.push({
          id: uid('task'), title: item.title, source: 'personal', category: 'improvisation', priority: 1,
          suggestedMinutes: Number($('#convertMinutes').value) || 7,
          objective: $('#convertObjective').value.trim() || item.note || 'Explorar y registrar un resultado concreto.',
          method: 'Trabajar con una consigna limitada y una breve revisión al final.',
          success: 'Cerrar con una idea que pueda repetirse en la próxima sesión.',
          status: 'active', lastPracticed: dateOffset(-14), frequencyPerWeek: Number($('#convertFrequency').value) || 1, completedThisWeek: 0, protected: false
        });
        item.status = 'converted';
        await saveState(); closeModal(); ui.labTab = 'objetivos'; renderRoute(); toast('Idea convertida', 'Ahora sí puede entrar en un plan.');
      });
    }
  });
}

function startFreePractice() {
  ui.freePractice = { startedAt: Date.now(), timerId: null };
  openModal({
    title: 'Práctica libre', eyebrow: 'Mi laboratorio',
    body: `<div class="timer-stage"><div class="timer-value" id="freeTimer">00:00</div><div class="timer-label">tiempo transcurrido</div></div><div class="field mt-18"><label for="freeLabel">Qué estás tocando</label><input id="freeLabel" placeholder="Opcional; podés completarlo al terminar" /></div>`,
    footer: `<button class="danger-button" id="finishFree">■ Terminar y registrar</button>`,
    onOpen: () => {
      ui.freePractice.timerId = setInterval(() => {
        const elapsed = Math.floor((Date.now() - ui.freePractice.startedAt) / 1000);
        if ($('#freeTimer')) $('#freeTimer').textContent = formatTimer(elapsed);
      }, 1000);
      $('#finishFree').addEventListener('click', finishFreePractice);
    }
  });
}

async function finishFreePractice() {
  const practice = ui.freePractice;
  if (!practice) return;
  clearInterval(practice.timerId);
  const minutes = Math.max(1, Math.round((Date.now() - practice.startedAt) / 60000));
  const title = $('#freeLabel')?.value.trim() || 'Práctica libre';
  appState.sessions.push({
    id: uid('session'), date: localISO(), plannedMinutes: minutes, actualMinutes: minutes,
    mood: 'libre', type: 'free', demo: false,
    blocks: [{ category: 'free', source: 'personal', title, minutes, result: 'achieved' }]
  });
  appState.demoMode = false;
  await saveState();
  ui.freePractice = null;
  closeModal(); renderRoute(); toast('Práctica registrada', `${minutes} min · ${title}`);
}

const THEORY_LESSONS = [
  {
    id: 'intervals', path: 'Fundamentos', minutes: 8,
    title: 'Intervalos: medir antes de nombrar',
    description: 'La distancia entre dos notas explica melodías, acordes y movimiento armónico.',
    why: 'Reconocer una tercera o una quinta permite leer patrones, transponer y entender por qué ciertas combinaciones suenan estables o tensas.',
    core: 'Un intervalo se mide contando grados y semitonos. El número describe cuántas letras abarca; la cualidad describe su tamaño exacto.',
    practice: 'Tocá una nota raíz y compará segunda, tercera, cuarta y quinta sin cambiar de registro.',
    example: 'Do–Mi es una tercera porque abarca Do, Re y Mi; tiene cuatro semitonos, por eso es mayor.'
  },
  {
    id: 'major-scale', path: 'Fundamentos', minutes: 10,
    title: 'La escala mayor no cayó del cielo',
    description: 'Se construye con una secuencia concreta de tonos y semitonos.',
    why: 'De esa secuencia salen los grados, las tríadas diatónicas y gran parte de la armonía tonal que usamos para acompañar e improvisar.',
    core: 'Patrón: tono, tono, semitono, tono, tono, tono, semitono. Aplicarlo desde cualquier raíz produce una escala mayor.',
    practice: 'Elegí una raíz en el laboratorio, observá las notas y construí la escala sin mirar.',
    example: 'Desde Do: Do–Re–Mi–Fa–Sol–La–Si–Do.'
  },
  {
    id: 'triads', path: 'Armonía', minutes: 12,
    title: 'Tríadas: apilar terceras',
    description: 'Los acordes básicos aparecen al tomar grados alternados de una escala.',
    why: 'Entender su construcción evita memorizar acordes como objetos aislados y mejora el acompañamiento y la improvisación por notas del acorde.',
    core: 'Raíz, tercera y quinta. La combinación de tercera mayor o menor con quinta justa, aumentada o disminuida define la calidad.',
    practice: 'Construí una tríada desde cada grado de Do mayor y escuchá cómo cambia su carácter.',
    example: 'Do–Mi–Sol es mayor; Re–Fa–La es menor; Si–Re–Fa es disminuida.'
  },
  {
    id: 'functions', path: 'Armonía', minutes: 12,
    title: 'Funciones: casa, viaje y regreso',
    description: 'Los acordes tienen tendencias, no solo nombres.',
    why: 'La función tonal ayuda a anticipar movimientos, elegir acompañamientos y darle dirección a una improvisación.',
    core: 'Tónica aporta reposo; predominante prepara; dominante crea tensión y empuja hacia la tónica.',
    practice: 'Tocá I–IV–V–I y describí la sensación de cada paso antes de leer la etiqueta.',
    example: 'En Do mayor: C funciona como tónica, F como predominante y G como dominante.'
  },
  {
    id: 'circle', path: 'Armonía', minutes: 10,
    title: 'Círculo de quintas: un mapa de parentescos',
    description: 'Ordena tonalidades por cercanía y muestra cómo aparecen sostenidos y bemoles.',
    why: 'Sirve para modular, prever armaduras y elegir progresiones que se sientan relacionadas.',
    core: 'Moverse una quinta ascendente agrega normalmente un sostenido; una quinta descendente agrega un bemol.',
    practice: 'Partí de Do y recorré tres quintas hacia cada lado, tocando la tónica de cada tonalidad.',
    example: 'Do → Sol → Re → La; Do → Fa → Si♭ → Mi♭.'
  },
  {
    id: 'subdivision', path: 'Ritmo', minutes: 9,
    title: 'Subdivisión: el pulso por dentro',
    description: 'El ritmo se vuelve estable cuando no depende de adivinar dónde cae la próxima nota.',
    why: 'Subdividir permite sostener silencios, síncopas y frases largas sin perder el pulso.',
    core: 'Un pulso puede dividirse en dos, tres o cuatro partes iguales. Las figuras describen cómo ocupamos esas partes.',
    practice: 'Marcá negras con una mano y subdividí corcheas y tresillos con la voz.',
    example: 'En 4/4, cuatro negras completan el compás; ocho corcheas ocupan el mismo tiempo.'
  },
  {
    id: 'minor-scales', path: 'Fundamentos', minutes: 11,
    title: 'Por qué existen varias escalas menores',
    description: 'Natural, armónica y melódica responden a necesidades distintas.',
    why: 'La sensible y la conducción de voces explican por qué la escala cambia en ciertos contextos, en vez de ser una colección caprichosa.',
    core: 'La menor armónica eleva el séptimo grado para fortalecer la dominante; la melódica también eleva el sexto al ascender para suavizar el salto aumentado.',
    practice: 'Compará las tres formas desde La y escuchá qué nota cambia la dirección hacia la tónica.',
    example: 'La menor natural usa Sol; la armónica usa Sol♯.'
  },
  {
    id: 'modes', path: 'Color', minutes: 12,
    title: 'Modos: la misma materia, otro centro',
    description: 'No son escalas exóticas pegadas al costado de la teoría tonal.',
    why: 'Cambiar el centro y ciertos grados modifica el color y ofrece materiales claros para improvisar sin recorrer todas las teclas disponibles por ansiedad.',
    core: 'Cada modo tiene grados característicos. Dórico, por ejemplo, combina tercera menor con sexta mayor.',
    practice: 'Improvisá en Re dórico usando solo Re, Fa, Sol, La y Si; destacá la sexta mayor.',
    example: 'Re dórico comparte notas con Do mayor, pero Re funciona como centro.'
  }
];

const SCALE_DEFS = {
  major: { name: 'Mayor', intervals: [0,2,4,5,7,9,11], degrees: [0,1,2,3,4,5,6], formula: 'T · T · S · T · T · T · S', explanation: 'La referencia básica de la armonía tonal. Sus grados generan un patrón fijo de acordes mayores, menores y disminuido.' },
  naturalMinor: { name: 'Menor natural', intervals: [0,2,3,5,7,8,10], degrees: [0,1,2,3,4,5,6], formula: 'T · S · T · T · S · T · T', explanation: 'Comparte armadura con su relativa mayor, pero el centro cambia y la tercera menor define su color.' },
  dorian: { name: 'Dórico', intervals: [0,2,3,5,7,9,10], degrees: [0,1,2,3,4,5,6], formula: '1 · 2 · ♭3 · 4 · 5 · 6 · ♭7', explanation: 'Modo menor con sexta mayor. Esa sexta evita que suene igual que la menor natural y funciona como nota característica.' },
  majorPent: { name: 'Pentatónica mayor', intervals: [0,2,4,7,9], degrees: [0,1,2,4,5], formula: '1 · 2 · 3 · 5 · 6', explanation: 'Elimina los semitonos de la escala mayor y reduce fricciones. Es simple, pero no debería convertirse en permiso para tocar sin fraseo.' },
  minorPent: { name: 'Pentatónica menor', intervals: [0,3,5,7,10], degrees: [0,2,3,4,6], formula: '1 · ♭3 · 4 · 5 · ♭7', explanation: 'Material muy estable sobre contextos menores y blues. La limitación facilita concentrarse en ritmo, motivos y dirección.' },
  blues: { name: 'Blues', intervals: [0,3,5,6,7,10], degrees: [0,2,3,3,4,6], formula: '1 · ♭3 · 4 · ♭5 · 5 · ♭7', explanation: 'Agrega la quinta disminuida como nota de tensión y paso. Su expresividad depende más del gesto y el ritmo que de recitar la escala.' }
};

const ROOTS = [
  { name: 'C', pc: 0 }, { name: 'Db', pc: 1 }, { name: 'D', pc: 2 }, { name: 'Eb', pc: 3 },
  { name: 'E', pc: 4 }, { name: 'F', pc: 5 }, { name: 'F#', pc: 6 }, { name: 'G', pc: 7 },
  { name: 'Ab', pc: 8 }, { name: 'A', pc: 9 }, { name: 'Bb', pc: 10 }, { name: 'B', pc: 11 }
];

function renderTheory() {
  const root = ROOTS.find(item => item.name === ui.theoryRoot) || ROOTS[0];
  const scaleDef = SCALE_DEFS[ui.theoryScale];
  const notes = spellScale(root.name, scaleDef);
  const pitchClasses = scaleDef.intervals.map(interval => (root.pc + interval) % 12);
  if (!ui.quiz) ui.quiz = generateTheoryQuiz();
  const paths = ['todos', ...new Set(THEORY_LESSONS.map(lesson => lesson.path))];
  const lessons = THEORY_LESSONS.filter(lesson => ui.theoryPath === 'todos' || lesson.path === ui.theoryPath);
  const completed = appState.theoryProgress.completedLessons.length;

  return `
    <div class="page-grid">
      <section class="card pad accent-card">
        <div class="row between wrap">
          <div>
            <span class="eyebrow">Teoría aplicada</span>
            <h2 class="mt-10">Entender para tocar con más opciones</h2>
            <p class="muted small">Cada concepto incluye origen, función y una prueba en el teclado. Memorizar nombres sin escuchar relaciones es una forma especialmente elegante de olvidar.</p>
          </div>
          <div class="row wrap">${statusTag(`${completed}/${THEORY_LESSONS.length} lecciones`, completed ? 'success' : '')}${statusTag(`${appState.theoryProgress.quizCorrect}/${appState.theoryProgress.quizTotal || 0} quiz`)}</div>
        </div>
      </section>

      <section class="card pad">
        <div class="card-header">
          <div><h3>Laboratorio de escalas</h3><p>Cambiá raíz y estructura para ver cómo el patrón se convierte en notas reales.</p></div>
          ${statusTag(scaleDef.name)}
        </div>
        <div class="theory-lab mt-18">
          <div class="stack">
            <div class="field-grid">
              <div class="field"><label for="theoryRoot">Raíz</label><select id="theoryRoot">${ROOTS.map(item => `<option value="${item.name}" ${item.name === root.name ? 'selected' : ''}>${displayNote(item.name)}</option>`).join('')}</select></div>
              <div class="field"><label for="theoryScale">Estructura</label><select id="theoryScale">${Object.entries(SCALE_DEFS).map(([key, item]) => `<option value="${key}" ${key === ui.theoryScale ? 'selected' : ''}>${item.name}</option>`).join('')}</select></div>
            </div>
            <div class="formula-box">
              <span class="control-label">Fórmula</span>
              <h3 class="mt-10">${esc(scaleDef.formula)}</h3>
              <p class="muted small">${esc(scaleDef.explanation)}</p>
              <div class="note-pills">${notes.map((note, index) => `<span class="note-pill ${index === 0 ? 'active' : ''}">${esc(note)}</span>`).join('')}</div>
            </div>
            <div class="prompt-box"><span>Probalo</span><p>Tocá la escala lentamente. Después improvisá usando solo raíz, tercera y una nota característica. La teoría debería producir sonido, no una colección de etiquetas satisfechas consigo mismas.</p></div>
          </div>
          <div>
            <div class="keyboard-wrap">${renderKeyboard(pitchClasses)}</div>
            <div class="row between wrap mt-14"><span class="muted small">Teclas iluminadas: ${notes.join(' · ')}</span><button class="secondary-button" id="hearScale">▶ Escuchar</button></div>
          </div>
        </div>
      </section>

      <section class="page-section">
        <div class="section-header"><div><h2>Recorridos de teoría</h2><p>Lecciones breves, conectadas con una acción musical.</p></div></div>
        <div class="tabs">
          ${paths.map(path => `<button class="tab-button ${ui.theoryPath === path ? 'active' : ''}" data-theory-path="${esc(path)}">${path === 'todos' ? 'Todas' : esc(path)}</button>`).join('')}
        </div>
        <div class="lesson-grid">
          ${lessons.map(lesson => {
            const done = appState.theoryProgress.completedLessons.includes(lesson.id);
            return `<article class="card lesson-card">
              <div class="row between"><span class="meta-line">${esc(lesson.path)} · ${lesson.minutes} min</span>${done ? statusTag('Completada', 'success') : statusTag('Pendiente')}</div>
              <h3>${esc(lesson.title)}</h3>
              <p>${esc(lesson.description)}</p>
              <div class="card-spacer"></div>
              <div class="card-actions"><span class="muted small">Incluye práctica</span><button class="text-button" data-open-lesson="${esc(lesson.id)}">Abrir →</button></div>
            </article>`;
          }).join('')}
        </div>
      </section>

      <section class="page-grid two">
        <div class="card pad">
          <div class="card-header"><div><h3>Pregunta rápida</h3><p>Recuperación activa, no reconocimiento entre cuatro botones amables.</p></div>${statusTag('Quiz')}</div>
          ${renderTheoryQuiz(ui.quiz)}
        </div>
        <aside class="card pad soft">
          <div class="card-header"><div><h3>Cómo usar este módulo</h3><p>Una secuencia que evita leer teoría como si fuera el manual de una heladera.</p></div></div>
          <div class="insight-list mt-18">
            <div class="insight"><span class="insight-mark"></span><div><strong>1. Explicá</strong><p>Decí con tus palabras qué relación describe el concepto.</p></div></div>
            <div class="insight"><span class="insight-mark"></span><div><strong>2. Tocá</strong><p>Construí al menos un ejemplo en el piano.</p></div></div>
            <div class="insight"><span class="insight-mark"></span><div><strong>3. Usá</strong><p>Incluí esa relación en una obra, acompañamiento o improvisación.</p></div></div>
          </div>
        </aside>
      </section>
    </div>
  `;
}

function displayNote(note) {
  return String(note).replaceAll('bb', '𝄫').replaceAll('##', '𝄪').replaceAll('b', '♭').replaceAll('#', '♯');
}

function spellScale(rootName, scaleDef) {
  const letters = ['C','D','E','F','G','A','B'];
  const naturalPc = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
  const rootInfo = ROOTS.find(item => item.name === rootName) || ROOTS[0];
  const rootLetter = rootName.charAt(0);
  const rootIndex = letters.indexOf(rootLetter);
  const fallbackSharp = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  const accidentalMap = { '-2':'𝄫', '-1':'♭', '0':'', '1':'♯', '2':'𝄪' };

  return scaleDef.intervals.map((interval, index) => {
    const degreeOffset = scaleDef.degrees[index] ?? index;
    const letter = letters[(rootIndex + degreeOffset) % 7];
    const target = (rootInfo.pc + interval) % 12;
    let diff = target - naturalPc[letter];
    while (diff > 6) diff -= 12;
    while (diff < -6) diff += 12;
    if (accidentalMap[String(diff)] !== undefined) return `${letter}${accidentalMap[String(diff)]}`;
    return fallbackSharp[target];
  });
}

function renderKeyboard(activePitchClasses = []) {
  const whiteNames = ['C','D','E','F','G','A','B'];
  const whitePc = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
  const whites = [];
  [4,5].forEach(octave => whiteNames.forEach(name => whites.push({ name, octave, pc: whitePc[name] })));
  whites.push({ name: 'C', octave: 6, pc: 0 });

  const blackPattern = [
    { name: 'C♯', pc:1, after:0 }, { name:'D♯', pc:3, after:1 },
    { name:'F♯', pc:6, after:3 }, { name:'G♯', pc:8, after:4 }, { name:'A♯', pc:10, after:5 }
  ];
  const blacks = [];
  [0,1].forEach(octaveIndex => blackPattern.forEach(note => blacks.push({ ...note, left: (octaveIndex * 7 + note.after) * 52 + 36, octave: 4 + octaveIndex })));

  return `<div class="keyboard" aria-label="Teclado de dos octavas">
    ${whites.map(note => `<button class="white-key ${activePitchClasses.includes(note.pc) ? 'active' : ''}" data-piano-pc="${note.pc}" data-piano-octave="${note.octave}"><span>${note.name}${note.octave}</span></button>`).join('')}
    ${blacks.map(note => `<button class="black-key ${activePitchClasses.includes(note.pc) ? 'active' : ''}" style="left:${note.left}px" data-piano-pc="${note.pc}" data-piano-octave="${note.octave}"><span>${note.name}</span></button>`).join('')}
  </div>`;
}

function renderTheoryQuiz(quiz) {
  return `<div class="quiz-box mt-18">
    <div class="quiz-question">${esc(quiz.question)}</div>
    <div class="quiz-options">
      ${quiz.options.map(option => {
        let className = '';
        if (quiz.answered && option === quiz.correct) className = 'correct';
        else if (quiz.answered && option === quiz.selected) className = 'incorrect';
        return `<button class="quiz-option ${className}" data-quiz-option="${esc(option)}" ${quiz.answered ? 'disabled' : ''}>${esc(option)}</button>`;
      }).join('')}
    </div>
    ${quiz.answered ? `<div class="prompt-box"><span>${quiz.selected === quiz.correct ? 'Correcto' : 'Revisar'}</span><p>${esc(quiz.explanation)}</p></div><button class="secondary-button" id="nextQuiz">Otra pregunta</button>` : ''}
  </div>`;
}

function generateTheoryQuiz() {
  const roots = ['C','D','E','F','G','A','Bb','Eb'];
  const scaleKeys = ['major','naturalMinor'];
  const rootName = roots[Math.floor(Math.random() * roots.length)];
  const scaleKey = scaleKeys[Math.floor(Math.random() * scaleKeys.length)];
  const def = SCALE_DEFS[scaleKey];
  const notes = spellScale(rootName, def);
  const degree = 1 + Math.floor(Math.random() * 6);
  const correct = notes[degree];
  const chromatic = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
  const options = new Set([correct]);
  while (options.size < 4) options.add(chromatic[Math.floor(Math.random() * chromatic.length)]);
  return {
    question: `¿Cuál es el ${degree + 1}.º grado de ${displayNote(rootName)} ${def.name.toLowerCase()}?`,
    correct,
    options: [...options].sort(() => Math.random() - .5),
    explanation: `La escala es ${notes.join(' – ')}. El ${degree + 1}.º grado es ${correct}.`,
    answered: false,
    selected: null
  };
}

function bindTheory() {
  $('#theoryRoot')?.addEventListener('change', event => { ui.theoryRoot = event.target.value; renderRoute(); });
  $('#theoryScale')?.addEventListener('change', event => { ui.theoryScale = event.target.value; renderRoute(); });
  $$('[data-theory-path]').forEach(button => button.addEventListener('click', () => { ui.theoryPath = button.dataset.theoryPath; renderRoute(); }));
  $$('[data-open-lesson]').forEach(button => button.addEventListener('click', () => openTheoryLesson(button.dataset.openLesson)));
  $$('[data-quiz-option]').forEach(button => button.addEventListener('click', async () => {
    if (ui.quiz.answered) return;
    ui.quiz.selected = button.dataset.quizOption;
    ui.quiz.answered = true;
    appState.theoryProgress.quizTotal += 1;
    if (ui.quiz.selected === ui.quiz.correct) appState.theoryProgress.quizCorrect += 1;
    await saveState(); renderRoute();
  }));
  $('#nextQuiz')?.addEventListener('click', () => { ui.quiz = generateTheoryQuiz(); renderRoute(); });
  $('#hearScale')?.addEventListener('click', () => {
    const root = ROOTS.find(item => item.name === ui.theoryRoot) || ROOTS[0];
    const pcs = SCALE_DEFS[ui.theoryScale].intervals.map(interval => root.pc + interval);
    playNoteSequence(pcs.map(pc => 60 + pc), .32);
  });
  $$('[data-piano-pc]').forEach(key => key.addEventListener('click', () => {
    const midi = 12 * (Number(key.dataset.pianoOctave) + 1) + Number(key.dataset.pianoPc);
    playMidiNote(midi, .45);
  }));
}

function openTheoryLesson(id) {
  const lesson = THEORY_LESSONS.find(item => item.id === id);
  if (!lesson) return;
  const done = appState.theoryProgress.completedLessons.includes(id);
  openModal({
    title: lesson.title,
    eyebrow: `${lesson.path} · ${lesson.minutes} min`,
    wide: true,
    body: `
      <div class="page-grid equal">
        <div class="stack">
          <div class="prompt-box"><span>Por qué importa</span><p>${esc(lesson.why)}</p></div>
          <div class="card pad soft"><div class="card-header"><div><h3>Idea central</h3></div></div><p class="muted small">${esc(lesson.core)}</p></div>
          <div class="card pad soft"><div class="card-header"><div><h3>Ejemplo</h3></div></div><p class="muted small">${esc(lesson.example)}</p></div>
        </div>
        <div class="stack">
          <div class="card pad accent-card"><div class="card-header"><div><h3>Prueba en el piano</h3><p>No cierres la lección sin producir sonido.</p></div></div><p class="muted small mt-18">${esc(lesson.practice)}</p></div>
          <div class="insight-list">
            <div class="insight"><span class="insight-mark"></span><div><strong>Describí</strong><p>Explicá la relación sin mirar el texto.</p></div></div>
            <div class="insight"><span class="insight-mark"></span><div><strong>Construí</strong><p>Tocá un ejemplo desde al menos dos raíces.</p></div></div>
            <div class="insight"><span class="insight-mark"></span><div><strong>Aplicá</strong><p>Usalo durante un minuto en una improvisación o una obra.</p></div></div>
          </div>
        </div>
      </div>
    `,
    footer: `<button class="secondary-button" data-close-modal>Cerrar</button><button class="primary-button" id="completeLesson">${done ? 'Marcar como pendiente' : 'Marcar completada'}</button>`,
    onOpen: () => {
      $('[data-close-modal]').addEventListener('click', closeModal);
      $('#completeLesson').addEventListener('click', async () => {
        const list = appState.theoryProgress.completedLessons;
        if (list.includes(id)) appState.theoryProgress.completedLessons = list.filter(item => item !== id);
        else list.push(id);
        appState.demoMode = false;
        await saveState(); closeModal(); renderRoute();
      });
    }
  });
}

function playMidiNote(midi, duration = .4, when = 0) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const context = playClick.context || (playClick.context = new AudioCtx());
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + when;
    oscillator.type = 'triangle';
    oscillator.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(.12, start + .02);
    gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + .03);
  } catch (error) {
    console.warn('Audio no disponible.', error);
  }
}

function playNoteSequence(midiNotes, spacing = .35) {
  midiNotes.forEach((midi, index) => playMidiNote(midi, spacing * .9, index * spacing));
  const last = midiNotes[midiNotes.length - 1];
  playMidiNote(last + 12, spacing * 1.2, midiNotes.length * spacing);
}

const IMPROV_PROGRESSIONS = {
  'pop-c': {
    name: 'I–vi–IV–V en Do', key: 'Do mayor', scale: ['C','D','E','F','G','A','B'],
    chords: [
      { symbol: 'C', function: 'I · tónica', midi: [60,64,67], tones: 'C · E · G' },
      { symbol: 'Am', function: 'vi', midi: [57,60,64], tones: 'A · C · E' },
      { symbol: 'F', function: 'IV · predominante', midi: [53,57,60], tones: 'F · A · C' },
      { symbol: 'G', function: 'V · dominante', midi: [55,59,62], tones: 'G · B · D' }
    ]
  },
  'ii-v-i': {
    name: 'ii–V–I en Do', key: 'Do mayor', scale: ['C','D','E','F','G','A','B'],
    chords: [
      { symbol: 'Dm7', function: 'ii · predominante', midi: [50,53,57,60], tones: 'D · F · A · C' },
      { symbol: 'G7', function: 'V · dominante', midi: [55,59,62,65], tones: 'G · B · D · F' },
      { symbol: 'Cmaj7', function: 'I · tónica', midi: [48,52,55,59], tones: 'C · E · G · B' },
      { symbol: 'Cmaj7', function: 'I · reposo', midi: [48,52,55,59], tones: 'C · E · G · B' }
    ]
  },
  'minor-a': {
    name: 'i–VI–III–VII en La menor', key: 'La menor natural', scale: ['A','B','C','D','E','F','G'],
    chords: [
      { symbol: 'Am', function: 'i · tónica', midi: [57,60,64], tones: 'A · C · E' },
      { symbol: 'F', function: 'VI', midi: [53,57,60], tones: 'F · A · C' },
      { symbol: 'C', function: 'III', midi: [48,52,55], tones: 'C · E · G' },
      { symbol: 'G', function: 'VII', midi: [55,59,62], tones: 'G · B · D' }
    ]
  },
  'blues-f': {
    name: 'Blues simple en Fa', key: 'Fa blues', scale: ['F','A♭','B♭','B','C','E♭'],
    chords: [
      { symbol: 'F7', function: 'I7', midi: [53,57,60,63], tones: 'F · A · C · E♭' },
      { symbol: 'B♭7', function: 'IV7', midi: [58,62,65,68], tones: 'B♭ · D · F · A♭' },
      { symbol: 'F7', function: 'I7', midi: [53,57,60,63], tones: 'F · A · C · E♭' },
      { symbol: 'C7', function: 'V7', midi: [55,59,62,65], tones: 'C · E · G · B♭' }
    ]
  }
};

const IMPROV_FOCUS = {
  rhythm: {
    name: 'Ritmo con pocas notas',
    summary: 'Reducir alturas para que el ritmo deje de esconderse detrás de los dedos.',
    steps: [
      ['Pulso y silencio', 'Marcá el pulso. Tocá una sola nota durante dos pulsos y dejá dos pulsos de silencio.'],
      ['Tres ritmos', 'Con la misma nota, inventá tres patrones cortos y repetilos exactamente.'],
      ['Segunda altura', 'Agregá una segunda nota, pero conservá los ritmos anteriores.'],
      ['Frase de cuatro compases', 'Armá una frase breve con al menos un compás completo de silencio.']
    ],
    prompt: 'Usá como máximo dos notas. Cambiá ritmo, acento y espacio antes de agregar material.'
  },
  motifs: {
    name: 'Motivo y desarrollo',
    summary: 'Crear una idea reconocible y transformarla en vez de comenzar de cero a cada segundo.',
    steps: [
      ['Elegí tres notas', 'Tomá tres notas cercanas de la escala y construí un gesto de uno o dos compases.'],
      ['Repetición literal', 'Repetí el motivo tres veces sin modificarlo. La memoria necesita una oportunidad.'],
      ['Una sola variación', 'Cambiá únicamente el ritmo, la altura inicial o el final. No todo junto.'],
      ['Arco completo', 'Usá original, variación y regreso durante dos vueltas de la progresión.']
    ],
    prompt: 'La segunda frase debe parecer pariente de la primera, no alguien que apareció en otra reunión.'
  },
  chordTones: {
    name: 'Notas del acorde',
    summary: 'Escuchar cada armonía y llegar a notas estables en momentos fuertes.',
    steps: [
      ['Mapa armónico', 'Tocá las notas de cada acorde sin improvisar y nombrá raíz, tercera y quinta.'],
      ['Una nota por acorde', 'Elegí una nota del acorde y sostenela durante todo el compás.'],
      ['Conexión cercana', 'Pasá al siguiente acorde usando la nota disponible más próxima.'],
      ['Frase con destino', 'Improvisá libremente, pero caé en una nota del acorde al comienzo de cada compás.']
    ],
    prompt: 'La meta no es tocar todas las notas del acorde. Es saber dónde está el piso cuando decidís aterrizar.'
  },
  questionAnswer: {
    name: 'Pregunta y respuesta',
    summary: 'Construir frases con dirección y contraste, como una conversación que no monopoliza una sola voz.',
    steps: [
      ['Pregunta breve', 'Tocá una frase ascendente de dos compases y terminá sin sensación de cierre.'],
      ['Respuesta', 'Contestá con una frase descendente y más corta.'],
      ['Contraste', 'Repetí la pregunta y respondé con otro ritmo, manteniendo alguna nota en común.'],
      ['Diálogo', 'Alterná preguntas y respuestas durante dos vueltas sin llenar todos los espacios.']
    ],
    prompt: 'La respuesta debe relacionarse con la pregunta y, aun así, aportar algo. Curiosamente, también sirve fuera del piano.'
  },
  leftHand: {
    name: 'Mano izquierda y acompañamiento',
    summary: 'Crear una base estable sin ocupar todo el registro ni competir con la melodía.',
    steps: [
      ['Raíces', 'Tocá solo la raíz de cada acorde y sostené el pulso.'],
      ['Raíz y quinta', 'Agregá la quinta con un patrón constante.'],
      ['Acordes livianos', 'Probá tercera y séptima o tríadas en posición cómoda, con menos volumen.'],
      ['Sumá la derecha', 'Improvisá una frase simple arriba sin alterar el patrón de la izquierda.']
    ],
    prompt: 'La izquierda acompaña. No necesita presentar una tesis completa debajo de cada frase.'
  },
  space: {
    name: 'Fraseo y espacio',
    summary: 'Aprender a terminar, respirar y dejar que una idea tenga contorno.',
    steps: [
      ['Dos y dos', 'Tocá dos compases y permanecé en silencio durante los dos siguientes.'],
      ['Finales claros', 'Terminá cada frase en una nota larga y escuchá la armonía continuar.'],
      ['Densidad gradual', 'Primera vuelta con pocas notas; segunda con algo más de movimiento; tercera vuelve a reducir.'],
      ['Forma A–B–A', 'Creá una idea A, una sección contrastante B y regresá a A.']
    ],
    prompt: 'El silencio no es tiempo perdido. Es la parte de la frase donde el oyente alcanza a enterarse de lo que pasó.'
  }
};

function renderImprovisation() {
  if (!ui.improvPlan) ui.improvPlan = generateImprovPlan(ui.improvDuration, ui.improvFocus, ui.improvProgression);
  const progression = IMPROV_PROGRESSIONS[ui.improvProgression];
  const focus = IMPROV_FOCUS[ui.improvFocus];
  const prompt = ui.improvPlan.prompt;

  return `
    <div class="page-grid">
      <section class="card pad accent-card">
        <div class="row between wrap">
          <div>
            <span class="eyebrow">Improvisación guiada</span>
            <h2 class="mt-10">Menos “tocá cualquier cosa”; más decisiones entrenables</h2>
            <p class="muted small">Elegí una habilidad, una progresión y un tiempo. La sesión limita variables para que puedas escuchar qué estás haciendo y cómo mejorarlo.</p>
          </div>
          ${statusTag(`${appState.improvisationProgress.completedSessions} sesiones`, appState.improvisationProgress.completedSessions ? 'success' : '')}
        </div>
      </section>

      <div class="page-grid two">
        <section class="page-section">
          <div class="card pad">
            <div class="field-grid">
              <div class="field"><label for="improvFocus">Habilidad</label><select id="improvFocus">${Object.entries(IMPROV_FOCUS).map(([key, item]) => `<option value="${key}" ${key === ui.improvFocus ? 'selected' : ''}>${item.name}</option>`).join('')}</select></div>
              <div class="field"><label for="improvProgression">Progresión</label><select id="improvProgression">${Object.entries(IMPROV_PROGRESSIONS).map(([key, item]) => `<option value="${key}" ${key === ui.improvProgression ? 'selected' : ''}>${item.name}</option>`).join('')}</select></div>
            </div>
            <div class="control-group mt-18">
              <span class="control-label">Duración</span>
              <div class="chip-row">${[5,10,15,20,30].map(value => `<button class="choice-chip ${ui.improvDuration === value ? 'active' : ''}" data-improv-duration="${value}">${value} min</button>`).join('')}</div>
            </div>
            <div class="divider"></div>
            <div class="prompt-box"><span>Foco</span><p><b>${esc(focus.name)}.</b> ${esc(focus.summary)}</p></div>
            <div class="row between wrap mt-18"><button class="secondary-button" id="regenerateImprov">↻ Otra guía</button><button class="primary-button" id="startImprov">▶ EMPEZAR SESIÓN</button></div>
          </div>

          <div class="card pad">
            <div class="card-header"><div><h3>Guía de ${ui.improvDuration} minutos</h3><p>${esc(progression.name)} · ${esc(progression.key)}</p></div>${statusTag(focus.name)}</div>
            <div class="improv-session mt-18">
              ${ui.improvPlan.steps.map(step => `<div class="improv-step"><div><strong>${esc(step.title)}</strong><p>${esc(step.instruction)}</p></div><span class="task-meta">${step.duration} min</span></div>`).join('')}
            </div>
            <div class="prompt-box mt-18"><span>Restricción creativa</span><p>${esc(prompt)}</p></div>
          </div>
        </section>

        <aside class="page-section">
          <div class="card pad">
            <div class="card-header"><div><h3>Mapa armónico</h3><p>Escuchá la progresión y observá sus puntos de apoyo.</p></div><button class="icon-button ghost" id="hearProgression" title="Escuchar">▶</button></div>
            <div class="chord-progression mt-18">
              ${progression.chords.map(chord => `<div class="chord-chip"><strong>${esc(chord.symbol)}</strong><span>${esc(chord.function)}</span></div>`).join('')}
            </div>
            <div class="divider"></div>
            <span class="control-label">Escala de referencia</span>
            <div class="note-pills">${progression.scale.map((note, index) => `<span class="note-pill ${index === 0 ? 'active' : ''}">${esc(note)}</span>`).join('')}</div>
          </div>

          <div class="card pad soft">
            <div class="card-header"><div><h3>Notas de cada acorde</h3><p>Úsalas como destinos, no como una lista de asistencia.</p></div></div>
            <div class="task-list mt-18">
              ${progression.chords.map(chord => `<div class="task-row"><span class="task-icon">${esc(chord.symbol)}</span><div class="task-copy"><strong>${esc(chord.function)}</strong><span>${esc(chord.tones)}</span></div></div>`).join('')}
            </div>
          </div>

          <div class="card pad soft">
            <div class="card-header"><div><h3>Después de tocar</h3><p>Tres preguntas útiles.</p></div></div>
            <div class="insight-list mt-18">
              <div class="insight"><span class="insight-mark"></span><div><strong>¿Hubo una idea reconocible?</strong><p>Algo que volvió o se transformó.</p></div></div>
              <div class="insight"><span class="insight-mark"></span><div><strong>¿El ritmo tuvo intención?</strong><p>O apareció como consecuencia de buscar teclas.</p></div></div>
              <div class="insight"><span class="insight-mark"></span><div><strong>¿Dónde respiró la frase?</strong><p>Identificá al menos un silencio deliberado.</p></div></div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  `;
}

function allocateDurations(total, count) {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function generateImprovPlan(duration, focusKey, progressionKey, rotatePrompt = false) {
  const focus = IMPROV_FOCUS[focusKey];
  const count = duration <= 5 ? 2 : duration <= 10 ? 3 : 4;
  const steps = focus.steps.slice(0, count);
  const durations = allocateDurations(duration, steps.length);
  const prompts = [
    focus.prompt,
    'Empezá cada frase en un lugar rítmico diferente, pero mantené el mismo motivo.',
    'Durante una vuelta solo podés tocar en registro medio; en la siguiente, respondé una octava más arriba.',
    'Elegí una nota que no vas a usar durante la primera mitad. La restricción obliga a escuchar otras rutas.',
    'La última nota de cada frase debe pertenecer al acorde actual.'
  ];
  const promptIndex = rotatePrompt ? 1 + Math.floor(Math.random() * (prompts.length - 1)) : 0;
  return {
    focusKey, progressionKey, duration,
    steps: steps.map(([title, instruction], index) => ({ title, instruction, duration: durations[index] })),
    prompt: prompts[promptIndex]
  };
}

function bindImprovisation() {
  $('#improvFocus')?.addEventListener('change', event => {
    ui.improvFocus = event.target.value;
    ui.improvPlan = generateImprovPlan(ui.improvDuration, ui.improvFocus, ui.improvProgression);
    renderRoute();
  });
  $('#improvProgression')?.addEventListener('change', event => {
    ui.improvProgression = event.target.value;
    ui.improvPlan = generateImprovPlan(ui.improvDuration, ui.improvFocus, ui.improvProgression);
    renderRoute();
  });
  $$('[data-improv-duration]').forEach(button => button.addEventListener('click', () => {
    ui.improvDuration = Number(button.dataset.improvDuration);
    ui.improvPlan = generateImprovPlan(ui.improvDuration, ui.improvFocus, ui.improvProgression);
    renderRoute();
  }));
  $('#regenerateImprov')?.addEventListener('click', () => {
    ui.improvPlan = generateImprovPlan(ui.improvDuration, ui.improvFocus, ui.improvProgression, true);
    renderRoute();
  });
  $('#startImprov')?.addEventListener('click', () => {
    const focus = IMPROV_FOCUS[ui.improvFocus];
    const progression = IMPROV_PROGRESSIONS[ui.improvProgression];
    const blocks = ui.improvPlan.steps.map(step => ({
      id: uid('block'), title: `${focus.name} · ${step.title}`, source: 'app', category: 'improvisation', duration: step.duration,
      instruction: `${step.instruction} Progresión: ${progression.name}.`, success: 'Cerrar con una observación sobre ritmo, motivo o dirección.', bpm: 72
    }));
    startPracticeSession(blocks, 'improvisation');
  });
  $('#hearProgression')?.addEventListener('click', () => playProgression(IMPROV_PROGRESSIONS[ui.improvProgression]));
}

function playProgression(progression) {
  progression.chords.forEach((chord, chordIndex) => {
    chord.midi.forEach(midi => playMidiNote(midi, .85, chordIndex * .95));
  });
}

function renderProgress() {
  const sessions = [...appState.sessions].sort((a, b) => b.date.localeCompare(a.date));
  const totalMinutes = sessions.reduce((sum, item) => sum + Number(item.actualMinutes || 0), 0);
  const totalBlocks = sessions.flatMap(item => item.blocks || []).length;
  const achieved = sessions.flatMap(item => item.blocks || []).filter(block => block.result === 'achieved').length;
  const activeWeeks = new Set(sessions.map(session => {
    const cycle = getCurrentCycle(parseISO(session.date));
    return localISO(cycle.start);
  })).size;
  const lastSeven = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const iso = localISO(date);
    return {
      date,
      minutes: sessions.filter(session => session.date === iso).reduce((sum, session) => sum + Number(session.actualMinutes || 0), 0)
    };
  });
  const maxDay = Math.max(1, ...lastSeven.map(item => item.minutes));
  const categoryMinutes = {};
  sessions.flatMap(session => session.blocks || []).forEach(block => {
    categoryMinutes[block.category] = (categoryMinutes[block.category] || 0) + Number(block.minutes || 0);
  });
  const maxCategory = Math.max(1, ...Object.values(categoryMinutes));
  const recent = sessions.slice(0, 8);

  return `
    <div class="page-grid">
      ${appState.demoMode ? `<section class="card pad" style="border-color:rgba(255,201,109,.22)"><div class="row between wrap"><div><span class="eyebrow" style="color:#edc579">Datos de ejemplo</span><h3 class="mt-10">El tablero incluye sesiones ficticias para mostrar el prototipo</h3><p class="muted small">Podés eliminarlas sin tocar las tareas, obras y configuraciones que hayas agregado.</p></div><button class="secondary-button" id="clearDemoSessions">Quitar sesiones demo</button></div></section>` : ''}

      <div class="kpi-grid">
        <div class="card kpi-card"><div class="kpi-label">Tiempo acumulado</div><div class="kpi-value">${minutesLabel(totalMinutes)}</div><div class="kpi-note">${sessions.length} sesiones registradas</div></div>
        <div class="card kpi-card"><div class="kpi-label">Bloques logrados</div><div class="kpi-value">${achieved}</div><div class="kpi-note">de ${totalBlocks} bloques totales</div></div>
        <div class="card kpi-card"><div class="kpi-label">Semanas activas</div><div class="kpi-value">${activeWeeks}</div><div class="kpi-note">continuidad por ciclo de clase</div></div>
        <div class="card kpi-card"><div class="kpi-label">Teoría</div><div class="kpi-value">${appState.theoryProgress.completedLessons.length}/${THEORY_LESSONS.length}</div><div class="kpi-note">lecciones completadas</div></div>
      </div>

      <div class="page-grid two">
        <section class="card pad">
          <div class="card-header"><div><h3>Últimos siete días</h3><p>Minutos reales por día.</p></div>${statusTag(`${lastSeven.reduce((s, i) => s + i.minutes, 0)} min`)}</div>
          <div class="chart">
            ${lastSeven.map(item => `<div class="chart-column"><div class="chart-bar" title="${item.minutes} min" style="height:${Math.max(4, percent(item.minutes, maxDay))}%"></div><span class="chart-label">${formatDate(item.date, { weekday: 'short' })}</span></div>`).join('')}
          </div>
        </section>
        <aside class="card pad">
          <div class="card-header"><div><h3>Distribución por categoría</h3><p>En qué se fue el tiempo registrado.</p></div></div>
          <div class="stack mt-18">
            ${Object.entries(categoryMinutes).sort((a,b) => b[1]-a[1]).map(([category, minutes]) => `<div><div class="row between"><span class="small">${esc(CATEGORY_LABELS[category] || category)}</span><strong class="small">${minutes} min</strong></div><div class="progress-bar mt-10"><span style="width:${percent(minutes, maxCategory)}%"></span></div></div>`).join('') || `<div class="empty-state"><strong>Sin datos</strong><p>Completá una sesión para empezar a ver distribución.</p></div>`}
          </div>
        </aside>
      </div>

      <div class="page-grid two">
        <section class="card pad">
          <div class="card-header"><div><h3>Lectura del progreso</h3><p>Observaciones derivadas de tu historial actual.</p></div></div>
          <div class="insight-list mt-18">
            ${progressInsights(sessions, categoryMinutes).map(item => `<div class="insight"><span class="insight-mark"></span><div><strong>${esc(item.title)}</strong><p>${esc(item.text)}</p></div></div>`).join('')}
          </div>
        </section>
        <aside class="card pad soft">
          <div class="card-header"><div><h3>Historial reciente</h3><p>Sesiones más nuevas primero.</p></div></div>
          <div class="timeline-list mt-18">
            ${recent.map(session => `<div class="task-row"><span class="task-icon">${session.type === 'improvisation' ? '≈' : session.type === 'free' ? '∞' : '▶'}</span><div class="task-copy"><strong>${formatDate(session.date, { weekday: 'short', day: 'numeric', month: 'short' })}</strong><span>${session.blocks?.map(block => block.title).slice(0,2).join(' · ') || 'Sesión'}</span><div class="row wrap mt-10">${session.demo ? statusTag('Demo', 'warning') : ''}${statusTag(session.mood || 'registrada')}</div></div><span class="task-meta">${session.actualMinutes} min</span></div>`).join('') || `<div class="empty-state"><strong>Sin sesiones</strong><p>El historial espera. Pacientemente, porque es una base de datos y carece de expectativas.</p></div>`}
          </div>
        </aside>
      </div>
    </div>
  `;
}

function progressInsights(sessions, categoryMinutes) {
  if (!sessions.length) return [{ title: 'Todavía no hay tendencia', text: 'Completá algunas sesiones para comparar consistencia, categorías y resultados.' }];
  const insights = [];
  const total = Object.values(categoryMinutes).reduce((sum, value) => sum + value, 0);
  const sorted = Object.entries(categoryMinutes).sort((a,b) => b[1]-a[1]);
  if (sorted[0]) insights.push({ title: 'Categoría dominante', text: `${CATEGORY_LABELS[sorted[0][0]] || sorted[0][0]} representa ${percent(sorted[0][1], total)}% del tiempo registrado.` });
  const blocked = sessions.flatMap(s => s.blocks || []).filter(block => block.result === 'blocked');
  if (blocked.length) insights.push({ title: 'Bloqueos recurrentes', text: `${blocked.length} bloques quedaron marcados como bloqueados. Conviene simplificarlos o llevarlos a clase.` });
  const achieved = sessions.flatMap(s => s.blocks || []).filter(block => block.result === 'achieved').length;
  const all = sessions.flatMap(s => s.blocks || []).length;
  insights.push({ title: 'Cierre de objetivos', text: `${achieved} de ${all} bloques terminaron como logrados. Los parciales siguen siendo trabajo útil si dejan una próxima acción.` });
  if ((categoryMinutes.improvisation || 0) < total * .1) insights.push({ title: 'Improvisación escasa', text: 'Menos del 10% del tiempo fue a improvisación. Una guía de cinco minutos alcanza para sostener el hábito.' });
  return insights.slice(0, 4);
}

function bindProgress() {
  $('#clearDemoSessions')?.addEventListener('click', async () => {
    appState.sessions = appState.sessions.filter(session => !session.demo);
    appState.demoMode = false;
    await saveState(); renderRoute(); updateChrome(); toast('Datos demo eliminados', 'Tus datos reales y la configuración quedaron intactos.');
  });
}

function renderSettings() {
  const profile = appState.profile;
  const settings = appState.settings;
  const totalDistribution = Object.values(profile.distributions).reduce((sum, value) => sum + Number(value || 0), 0);
  return `
    <div class="page-grid two">
      <section class="page-section">
        <div class="section-header"><div><h2>Perfil de práctica</h2><p>Valores que usa el generador para interpretar tu semana.</p></div></div>
        <form class="card pad" id="profileForm">
          <div class="field-grid">
            <div class="field"><label for="profileName">Nombre</label><input id="profileName" value="${esc(profile.name)}" /></div>
            <div class="field"><label for="profileLevel">Nivel autopercibido</label><select id="profileLevel"><option ${profile.level === 'Inicial' ? 'selected' : ''}>Inicial</option><option ${profile.level === 'Inicial avanzado' ? 'selected' : ''}>Inicial avanzado</option><option ${profile.level === 'Intermedio' ? 'selected' : ''}>Intermedio</option><option ${profile.level === 'Intermedio avanzado' ? 'selected' : ''}>Intermedio avanzado</option><option ${profile.level === 'Avanzado' ? 'selected' : ''}>Avanzado</option></select></div>
            <div class="field"><label for="profileYears">Años de estudio</label><input id="profileYears" type="number" min="0" max="80" step=".5" value="${profile.experienceYears}" /></div>
            <div class="field"><label for="profileInstrument">Instrumento</label><input id="profileInstrument" value="${esc(profile.instrument)}" /></div>
            <div class="field"><label for="profileClassDay">Día de clase</label><select id="profileClassDay">${['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'].map((day,index) => `<option value="${index}" ${profile.classDay === index ? 'selected' : ''}>${day}</option>`).join('')}</select></div>
            <div class="field"><label for="profileSessions">Meta de sesiones semanales</label><input id="profileSessions" type="number" min="1" max="7" value="${profile.weeklySessionsGoal}" /></div>
            <div class="field"><label for="profileMinutes">Meta de minutos semanales</label><input id="profileMinutes" type="number" min="15" max="1000" value="${profile.weeklyMinutesGoal}" /></div>
            <div class="field"><label for="profileTeacherShare">Mínimo de trabajo de clase (%)</label><input id="profileTeacherShare" type="number" min="0" max="100" value="${profile.minTeacherShare}" /></div>
          </div>
          <button class="primary-button mt-18" type="submit">Guardar perfil</button>
        </form>

        <div class="section-header mt-10"><div><h2>Distribución sugerida</h2><p>Se usa como orientación en sesiones con tiempo suficiente.</p></div>${statusTag(`${totalDistribution}%`, totalDistribution === 100 ? 'success' : 'warning')}</div>
        <form class="card pad" id="distributionForm">
          <div class="field-grid">
            <div class="field"><label for="distTeacher">Profesora (%)</label><input id="distTeacher" type="number" min="0" max="100" value="${profile.distributions.teacher}" /></div>
            <div class="field"><label for="distPersonal">Personal (%)</label><input id="distPersonal" type="number" min="0" max="100" value="${profile.distributions.personal}" /></div>
            <div class="field"><label for="distTheory">Teoría (%)</label><input id="distTheory" type="number" min="0" max="100" value="${profile.distributions.theory}" /></div>
            <div class="field"><label for="distImprovisation">Improvisación (%)</label><input id="distImprovisation" type="number" min="0" max="100" value="${profile.distributions.improvisation}" /></div>
          </div>
          <p class="input-hint mt-14">La suma ideal es 100%. La versión actual usa sobre todo el mínimo de trabajo de clase y agrega teoría o improvisación según la duración.</p>
          <button class="primary-button mt-18" type="submit">Guardar distribución</button>
        </form>
      </section>

      <aside class="page-section">
        <div class="section-header"><div><h2>Planificador</h2><p>Comportamiento de las sesiones.</p></div></div>
        <form class="card pad" id="plannerForm">
          <div class="field-grid">
            <div class="field"><label for="maxBlock">Máximo por bloque (min)</label><input id="maxBlock" type="number" min="4" max="30" value="${settings.maxBlockMinutes}" /></div>
            <div class="field"><label for="warmupSelect">Activación automática</label><select id="warmupSelect"><option value="yes" ${settings.includeWarmup ? 'selected' : ''}>Sí</option><option value="no" ${!settings.includeWarmup ? 'selected' : ''}>No</option></select></div>
            <div class="field"><label for="closingSelect">Cierre automático</label><select id="closingSelect"><option value="yes" ${settings.includeClosing ? 'selected' : ''}>Sí</option><option value="no" ${!settings.includeClosing ? 'selected' : ''}>No</option></select></div>
          </div>
          <button class="primary-button mt-18" type="submit">Guardar planificador</button>
        </form>

        <div class="section-header mt-10"><div><h2>Datos y respaldos</h2><p>El código cambia; el histórico no debería pagar por ello.</p></div></div>
        <div class="card pad">
          <div class="stack">
            <div class="row between wrap"><div><strong class="small">Último respaldo</strong><div class="muted small mt-10">${settings.lastBackup ? formatDate(settings.lastBackup, { day: 'numeric', month: 'long', year: 'numeric' }) : 'Todavía no exportado'}</div></div><button class="secondary-button" id="exportBackup">Exportar JSON</button></div>
            <div class="divider"></div>
            <div class="row between wrap"><div><strong class="small">Restaurar respaldo</strong><div class="muted small mt-10">Valida versión y estructura antes de reemplazar datos.</div></div><label class="secondary-button" for="importBackup" style="cursor:pointer">Elegir archivo</label><input class="hidden" id="importBackup" type="file" accept="application/json,.json" /></div>
            <div class="divider"></div>
            <div class="row between wrap"><div><strong class="small">Sesiones de demostración</strong><div class="muted small mt-10">${appState.sessions.filter(session => session.demo).length} sesiones ficticias presentes.</div></div><button class="secondary-button" id="removeDemo" ${appState.sessions.some(session => session.demo) ? '' : 'disabled'}>Quitar demo</button></div>
            <div class="divider"></div>
            <div class="row between wrap"><div><strong class="small">Reiniciar aplicación</strong><div class="muted small mt-10">Borra datos locales y vuelve al estado inicial.</div></div><button class="danger-button" id="resetApp">Borrar todo</button></div>
          </div>
        </div>

        <div class="card pad soft">
          <div class="card-header"><div><h3>Información de versión</h3><p>Separada para permitir migraciones futuras.</p></div></div>
          <div class="task-list mt-18">
            <div class="task-row"><span class="task-icon">A</span><div class="task-copy"><strong>Aplicación</strong><span>Interfaz y lógica</span></div><span class="task-meta">${APP_VERSION}</span></div>
            <div class="task-row"><span class="task-icon">D</span><div class="task-copy"><strong>Base de datos</strong><span>Estructura local</span></div><span class="task-meta">${DB_VERSION}</span></div>
            <div class="task-row"><span class="task-icon">B</span><div class="task-copy"><strong>Respaldo</strong><span>Formato exportable</span></div><span class="task-meta">1</span></div>
          </div>
        </div>
      </aside>
    </div>
  `;
}

function bindSettings() {
  $('#profileForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    Object.assign(appState.profile, {
      name: $('#profileName').value.trim() || 'Pianista',
      level: $('#profileLevel').value,
      experienceYears: Number($('#profileYears').value) || 0,
      instrument: $('#profileInstrument').value.trim(),
      classDay: Number($('#profileClassDay').value),
      weeklySessionsGoal: clamp(Number($('#profileSessions').value) || 4, 1, 7),
      weeklyMinutesGoal: clamp(Number($('#profileMinutes').value) || 120, 15, 1000),
      minTeacherShare: clamp(Number($('#profileTeacherShare').value) || 0, 0, 100)
    });
    appState.demoMode = false;
    await saveState(); updateChrome(); renderRoute(); toast('Perfil guardado');
  });
  $('#distributionForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    appState.profile.distributions = {
      teacher: clamp(Number($('#distTeacher').value) || 0, 0, 100),
      personal: clamp(Number($('#distPersonal').value) || 0, 0, 100),
      theory: clamp(Number($('#distTheory').value) || 0, 0, 100),
      improvisation: clamp(Number($('#distImprovisation').value) || 0, 0, 100)
    };
    await saveState(); renderRoute(); toast('Distribución guardada');
  });
  $('#plannerForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    appState.settings.maxBlockMinutes = clamp(Number($('#maxBlock').value) || 12, 4, 30);
    appState.settings.includeWarmup = $('#warmupSelect').value === 'yes';
    appState.settings.includeClosing = $('#closingSelect').value === 'yes';
    await saveState(); toast('Planificador actualizado');
  });
  $('#exportBackup')?.addEventListener('click', exportBackup);
  $('#importBackup')?.addEventListener('change', importBackup);
  $('#removeDemo')?.addEventListener('click', async () => {
    appState.sessions = appState.sessions.filter(session => !session.demo);
    appState.demoMode = false;
    await saveState(); updateChrome(); renderRoute(); toast('Datos demo eliminados');
  });
  $('#resetApp')?.addEventListener('click', confirmReset);
}

async function exportBackup() {
  const payload = {
    backupFormat: 1,
    appVersion: APP_VERSION,
    databaseVersion: DB_VERSION,
    exportedAt: new Date().toISOString(),
    data: appState
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `fade-out-piano-backup-${localISO()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  appState.settings.lastBackup = localISO();
  await saveState(); renderRoute(); toast('Respaldo exportado', anchor.download);
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const data = parsed.data || parsed;
    if (!data.profile || !Array.isArray(data.tasks) || !Array.isArray(data.sessions)) throw new Error('Estructura incompatible');
    openModal({
      title: 'Restaurar respaldo', eyebrow: 'Verificación de datos',
      body: `<div class="kpi-grid"><div class="card soft kpi-card"><div class="kpi-label">Sesiones</div><div class="kpi-value">${data.sessions.length}</div></div><div class="card soft kpi-card"><div class="kpi-label">Tareas</div><div class="kpi-value">${data.tasks.length}</div></div><div class="card soft kpi-card"><div class="kpi-label">Repertorio</div><div class="kpi-value">${data.repertoire?.length || 0}</div></div><div class="card soft kpi-card"><div class="kpi-label">Formato</div><div class="kpi-value">${parsed.backupFormat || 1}</div></div></div><div class="prompt-box mt-18"><span>Advertencia</span><p>La restauración reemplaza los datos locales actuales. Conviene exportarlos primero si todavía tienen valor.</p></div>`,
      footer: `<button class="secondary-button" data-close-modal>Cancelar</button><button class="primary-button" id="confirmImport">Restaurar</button>`,
      onOpen: () => {
        $('[data-close-modal]').addEventListener('click', closeModal);
        $('#confirmImport').addEventListener('click', async () => {
          appState = migrateState(data);
          await saveState(); closeModal(); updateChrome(); renderRoute(); toast('Respaldo restaurado');
        });
      }
    });
  } catch (error) {
    toast('No se pudo importar', 'El archivo no tiene una estructura reconocida de Fade Out Piano.');
  } finally {
    event.target.value = '';
  }
}

function confirmReset() {
  openModal({
    title: 'Borrar todos los datos', eyebrow: 'Acción irreversible',
    body: `<div class="prompt-box" style="border-color:rgba(255,133,142,.25);background:rgba(255,133,142,.07)"><span style="color:#ffc1c5">Confirmación</span><p>Esto elimina perfil, tareas, sesiones, progreso, teoría y configuraciones del navegador. Escribí <b>BORRAR</b> para continuar.</p></div><div class="field mt-18"><label for="resetConfirm">Confirmación</label><input id="resetConfirm" autocomplete="off" /></div>`,
    footer: `<button class="secondary-button" data-close-modal>Cancelar</button><button class="danger-button" id="confirmResetButton">Borrar todo</button>`,
    onOpen: () => {
      $('[data-close-modal]').addEventListener('click', closeModal);
      $('#confirmResetButton').addEventListener('click', async () => {
        if ($('#resetConfirm').value.trim() !== 'BORRAR') return toast('Confirmación incorrecta');
        appState = seedState();
        ui.currentPlan = [];
        ui.todayFocus = null;
        await saveState(); closeModal(); updateChrome(); setRoute('hoy'); toast('Aplicación reiniciada');
      });
    }
  });
}

function refreshWeeklyCounters() {
  const sessions = getCycleSessions();
  appState.tasks.forEach(task => {
    task.completedThisWeek = sessions.flatMap(session => session.blocks || []).filter(block => block.title === task.title).length;
  });
}

async function initialize() {
  appState = await loadState();
  refreshWeeklyCounters();
  updateChrome();

  $$('.nav-item').forEach(button => button.addEventListener('click', () => setRoute(button.dataset.route)));
  $('.brand').addEventListener('click', event => { event.preventDefault(); setRoute('hoy'); });
  $('#quickAddButton').addEventListener('click', () => openQuickActivityModal('global'));
  $('#modalClose').addEventListener('click', closeModal);
  $('#modalBackdrop').addEventListener('click', event => { if (event.target === $('#modalBackdrop')) closeModal(); });
  $('#mobileMenu').addEventListener('click', () => { $('.sidebar').classList.add('open'); $('#mobileBackdrop').classList.add('open'); });
  $('#mobileBackdrop').addEventListener('click', closeMobileMenu);
  window.addEventListener('hashchange', () => setRoute(location.hash.slice(1) || 'hoy', false));
  window.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('#modalBackdrop').classList.contains('hidden')) closeModal(); });

  setRoute(location.hash.slice(1) || 'hoy', false);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.FADE_OUT_STANDALONE) {
    navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Service worker no registrado.', error));
  }
}

// Inicialización delegada a v1.js
