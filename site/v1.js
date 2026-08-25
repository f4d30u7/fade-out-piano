'use strict';

/* Fade Out Piano 1.1
 * Capa funcional sobre el prototipo 0.1. Mantiene compatibilidad con la base
 * anterior, elimina los datos ficticios y completa las operaciones visibles.
 */

ROUTES.lectura = { title: 'Lectura', eyebrow: 'Vista, pulso y teclado' };
CATEGORY_LABELS.reading = 'Lectura';
SOURCE_LABELS.system = 'Aplicación';
let bindReading;

Object.assign(ui, {
  readingLevel: 2,
  readingClef: 'treble',
  readingMeasures: 2,
  readingTempo: 60,
  readingPulse: false,
  readingExercise: null,
  readingRun: null,
  readingResult: null,
  readingKeyboardLabels: false,
  readingMidiStatus: 'idle',
  readingMidiAccess: null,
  readingKeyFlash: null,
  planEditIndex: null,
  selectedWeekDate: null
});

const OLD_RENDER_TODAY = renderToday;
const OLD_RENDER_THEORY = renderTheory;
const OLD_BIND_THEORY = bindTheory;
const OLD_RENDER_IMPROVISATION = renderImprovisation;
const OLD_BIND_IMPROVISATION = bindImprovisation;
const OLD_RENDER_PROGRESS = renderProgress;
const OLD_BIND_PROGRESS = bindProgress;
const OLD_OPEN_THEORY_LESSON = openTheoryLesson;
const OLD_CLOSE_MODAL = closeModal;
const OLD_RENDER_SESSION_RUNNER = renderSessionRunner;
const OLD_BIND_SESSION_RUNNER = bindSessionRunner;
const OLD_RECORD_BLOCK_RESULT = recordBlockResult;
const OLD_FINISH_PRACTICE_SESSION = finishPracticeSession;

function emptyStateV1() {
  return {
    schemaVersion: 2,
    appVersionCreated: APP_VERSION,
    appVersionLastUsed: APP_VERSION,
    onboardingCompleted: false,
    demoMode: false,
    profile: {
      name: 'Esteban',
      experienceYears: 3,
      level: 'Inicial avanzado',
      instrument: 'Piano digital / acústico',
      classDay: 6,
      weeklySessionsGoal: 4,
      weeklyMinutesGoal: 120,
      minTeacherShare: 50,
      noteNaming: 'latin',
      distributions: { teacher: 50, personal: 15, theory: 10, improvisation: 10, reading: 15 }
    },
    repertoire: [],
    tasks: [],
    explorations: [],
    classNotes: [],
    sessions: [],
    theoryProgress: {
      completedLessons: [],
      quizCorrect: 0,
      quizTotal: 0,
      questionStats: {}
    },
    improvisationProgress: {
      completedSessions: 0,
      lastFocus: 'motifs',
      favorites: [],
      reflections: []
    },
    readingAttempts: [],
    readingProfile: {
      trebleLevel: 2,
      bassLevel: 1,
      rhythmLevel: 1,
      totalExercises: 0,
      correctNotes: 0,
      attemptedNotes: 0,
      bestAccuracy: 0
    },
    readingSettings: {
      clef: 'treble',
      level: 2,
      measures: 2,
      tempo: 60,
      withPulse: false,
      labels: false,
      sound: true
    },
    customProgressions: [],
    activeSession: null,
    planDraft: null,
    settings: {
      includeWarmup: true,
      includeClosing: true,
      maxBlockMinutes: 12,
      metronomeSound: 'click',
      metronomeAccent: true,
      masterVolume: 75,
      lastBackup: null,
      sampleContentLoaded: false
    }
  };
}

seedState = emptyStateV1;

migrateState = function migrateStateV1(raw) {
  if (!raw || typeof raw !== 'object') return emptyStateV1();
  const clean = structuredClone(raw);
  const defaults = emptyStateV1();

  clean.schemaVersion = 2;
  clean.appVersionLastUsed = APP_VERSION;
  clean.demoMode = false;
  clean.sessions = Array.isArray(clean.sessions) ? clean.sessions.filter(session => !session.demo) : [];
  clean.profile = { ...defaults.profile, ...(clean.profile || {}) };
  clean.profile.distributions = {
    ...defaults.profile.distributions,
    ...(clean.profile.distributions || {})
  };
  clean.repertoire = Array.isArray(clean.repertoire) ? clean.repertoire : [];
  clean.tasks = Array.isArray(clean.tasks) ? clean.tasks : [];
  clean.explorations = Array.isArray(clean.explorations) ? clean.explorations : [];
  clean.classNotes = Array.isArray(clean.classNotes) ? clean.classNotes : [];
  clean.theoryProgress = {
    ...defaults.theoryProgress,
    ...(clean.theoryProgress || {}),
    completedLessons: Array.isArray(clean.theoryProgress?.completedLessons) ? clean.theoryProgress.completedLessons : [],
    questionStats: clean.theoryProgress?.questionStats || {}
  };
  clean.improvisationProgress = {
    ...defaults.improvisationProgress,
    ...(clean.improvisationProgress || {}),
    favorites: Array.isArray(clean.improvisationProgress?.favorites) ? clean.improvisationProgress.favorites : [],
    reflections: Array.isArray(clean.improvisationProgress?.reflections) ? clean.improvisationProgress.reflections : []
  };
  clean.readingAttempts = Array.isArray(clean.readingAttempts) ? clean.readingAttempts : [];
  clean.readingProfile = { ...defaults.readingProfile, ...(clean.readingProfile || {}) };
  clean.readingSettings = { ...defaults.readingSettings, ...(clean.readingSettings || {}) };
  clean.customProgressions = Array.isArray(clean.customProgressions) ? clean.customProgressions : [];
  clean.settings = { ...defaults.settings, ...(clean.settings || {}) };
  clean.activeSession ||= null;
  clean.planDraft ||= null;

  clean.repertoire = clean.repertoire.map(item => ({
    createdAt: item.createdAt || item.startedAt || localISO(),
    startedAt: item.startedAt || item.createdAt || localISO(),
    status: item.status || 'active',
    notes: '',
    ...item
  }));
  clean.tasks = clean.tasks.map(task => ({
    createdAt: task.createdAt || localISO(),
    source: task.source || 'personal',
    category: task.category || 'technique',
    priority: Number(task.priority || 1),
    suggestedMinutes: Number(task.suggestedMinutes || 5),
    frequencyPerWeek: Number(task.frequencyPerWeek || 1),
    completedThisWeek: Number(task.completedThisWeek || 0),
    status: task.status || 'active',
    protected: Boolean(task.protected),
    nextAction: task.nextAction || '',
    days: Array.isArray(task.days) ? task.days : [],
    ...task
  }));

  const hasUserData = Boolean(clean.sessions.length || clean.tasks.length || clean.repertoire.length || clean.classNotes.length);
  if (typeof clean.onboardingCompleted !== 'boolean') clean.onboardingCompleted = hasUserData;
  return clean;
};

function loadStarterContent() {
  if (appState.settings.sampleContentLoaded) return;
  const techniqueId = uid('rep');
  const repertoireId = uid('rep');
  appState.repertoire.push(
    {
      id: repertoireId,
      title: 'Obra actual',
      composer: 'Reemplazá este nombre por la obra que estés estudiando',
      type: 'Obra',
      status: 'active',
      startedAt: localISO(),
      createdAt: localISO(),
      notes: 'Contenido inicial editable. No registra sesiones ficticias.'
    },
    {
      id: techniqueId,
      title: 'Técnica general',
      composer: 'Escalas, articulación y coordinación',
      type: 'Técnica',
      status: 'active',
      startedAt: localISO(),
      createdAt: localISO(),
      notes: 'Usalo como contenedor para tareas técnicas.'
    }
  );
  appState.tasks.push(
    {
      id: uid('task'), repertoireId, title: 'Definir el pasaje prioritario', source: 'teacher', category: 'repertoire', priority: 2,
      suggestedMinutes: 8, objective: 'Trabajar el fragmento indicado en la última clase.',
      method: 'Editá esta tarea con compases, manos, tempo y método concretos.',
      success: 'Definir un criterio observable de cierre.', status: 'active', lastPracticed: dateOffset(-14),
      frequencyPerWeek: 3, completedThisWeek: 0, protected: false, createdAt: localISO(), nextAction: ''
    },
    {
      id: uid('task'), repertoireId: techniqueId, title: 'Rutina técnica personal', source: 'personal', category: 'technique', priority: 1,
      suggestedMinutes: 5, objective: 'Trabajar una habilidad técnica elegida por vos.',
      method: 'Editá esta tarea y convertí la consigna genérica en algo real.',
      success: 'Registrar qué cambió y cuál es el siguiente paso.', status: 'active', lastPracticed: dateOffset(-14),
      frequencyPerWeek: 2, completedThisWeek: 0, protected: false, createdAt: localISO(), nextAction: ''
    }
  );
  appState.settings.sampleContentLoaded = true;
}

function serializeSessionRun(run) {
  if (!run) return null;
  return {
    type: run.type,
    plan: structuredClone(run.plan),
    index: run.index,
    results: structuredClone(run.results || []),
    startedAt: run.startedAt,
    blockStartedAt: run.blockStartedAt,
    remainingSeconds: run.remainingSeconds,
    running: false,
    awaitingResult: Boolean(run.awaitingResult),
    elapsedActiveSeconds: Number(run.elapsedActiveSeconds || 0)
  };
}

async function persistActiveSession() {
  appState.activeSession = serializeSessionRun(ui.sessionRun);
  await saveState();
  updateChrome();
}

function restoreActiveSession() {
  if (!appState.activeSession || ui.sessionRun) return;
  ui.sessionRun = {
    ...structuredClone(appState.activeSession),
    running: false,
    timerId: null,
    checkpointId: null
  };
}

updateChrome = function updateChromeV1() {
  const profileName = appState?.profile?.name || 'Pianista';
  $('#sidebarName').textContent = profileName;
  $('#sidebarAvatar').textContent = profileName.charAt(0).toUpperCase();
  $('#sidebarLevel').textContent = appState?.profile?.level || 'Perfil musical';
  $('#versionBadge').textContent = `v${APP_VERSION}`;
  const route = ROUTES[ui.route] || ROUTES.hoy;
  $('#pageTitle').textContent = route.title;
  $('#pageEyebrow').textContent = route.eyebrow;
  $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.route === ui.route));
  const resume = $('#resumeSessionTop');
  if (resume) resume.classList.toggle('hidden', !(ui.sessionRun || appState?.activeSession));
};

function showWelcome() {
  openModal({
    title: 'Tu espacio de práctica',
    eyebrow: 'Fade Out Piano 1.1',
    wide: true,
    body: `
      <div class="welcome-grid">
        <div class="welcome-copy">
          <span class="eyebrow">Primera apertura</span>
          <h3>Esta versión ya trabaja con datos reales.</h3>
          <p>Podés empezar en blanco, cargar dos elementos editables para orientarte o restaurar un respaldo del prototipo. No habrá sesiones inventadas adornando estadísticas como si la base de datos necesitara autoestima.</p>
        </div>
        <div class="stack">
          <button class="welcome-choice" id="welcomeClean"><strong>Empezar limpio</strong><span>Perfil configurado, sin obras, tareas ni sesiones.</span></button>
          <button class="welcome-choice" id="welcomeStarter"><strong>Cargar estructura inicial</strong><span>Dos contenedores y dos tareas genéricas, todas editables.</span></button>
          <label class="welcome-choice" for="welcomeImport"><strong>Restaurar respaldo</strong><span>Importar el JSON exportado desde una versión anterior.</span></label>
          <input class="hidden" id="welcomeImport" type="file" accept="application/json,.json" />
        </div>
      </div>`,
    footer: '',
    onOpen: () => {
      $('#modalClose').classList.add('hidden');
      $('#welcomeClean').addEventListener('click', async () => {
        appState.onboardingCompleted = true;
        await saveState();
        $('#modalClose').classList.remove('hidden');
        closeModal(); renderRoute();
      });
      $('#welcomeStarter').addEventListener('click', async () => {
        loadStarterContent();
        appState.onboardingCompleted = true;
        await saveState();
        $('#modalClose').classList.remove('hidden');
        closeModal(); renderRoute();
      });
      $('#welcomeImport').addEventListener('change', async event => {
        await importBackup(event);
        appState.onboardingCompleted = true;
        await saveState();
        $('#modalClose').classList.remove('hidden');
      });
    }
  });
}

renderRoute = function renderRouteV1() {
  const renderers = {
    hoy: renderToday,
    semana: renderWeek,
    repertorio: renderRepertoire,
    laboratorio: renderLab,
    teoria: renderTheory,
    improvisacion: renderImprovisation,
    lectura: renderReading,
    progreso: renderProgress,
    ajustes: renderSettings
  };
  const binders = {
    hoy: bindToday,
    semana: bindWeek,
    repertorio: bindRepertoire,
    laboratorio: bindLab,
    teoria: bindTheory,
    improvisacion: bindImprovisation,
    lectura: bindReading,
    progreso: bindProgress,
    ajustes: bindSettings
  };
  const renderer = renderers[ui.route] || renderers.hoy;
  $('#appView').innerHTML = renderer();
  $('#appView').focus({ preventScroll: true });
  updateChrome();
  binders[ui.route]?.();
};

closeModal = function closeModalV1(force = false) {
  if (!force && ui.sessionRun && !$('#modalBackdrop').classList.contains('hidden')) {
    const title = $('#modalTitle')?.textContent || '';
    const isSessionModal = title === ui.sessionRun.plan?.[ui.sessionRun.index]?.title || $('#timerValue');
    if (isSessionModal) {
      if (ui.sessionRun.timerId) clearInterval(ui.sessionRun.timerId);
      if (ui.sessionRun.checkpointId) clearInterval(ui.sessionRun.checkpointId);
      ui.sessionRun.running = false;
      stopMetronome();
      persistActiveSession();
      toast('Sesión pausada', 'Podés retomarla desde la barra superior o desde Hoy.');
    }
  }
  OLD_CLOSE_MODAL();
};

function planDraftSave() {
  appState.planDraft = ui.currentPlan.length ? {
    date: localISO(), duration: ui.duration, energy: ui.energy, focus: ui.todayFocus ? structuredClone(ui.todayFocus) : null,
    blocks: structuredClone(ui.currentPlan)
  } : null;
  saveState();
}

function planDraftRestore() {
  const draft = appState.planDraft;
  if (!draft || draft.date !== localISO() || !Array.isArray(draft.blocks)) return;
  ui.duration = draft.duration || ui.duration;
  ui.energy = draft.energy || ui.energy;
  ui.todayFocus = draft.focus || null;
  ui.currentPlan = structuredClone(draft.blocks);
}


function distributeMinutes(total, count, maxPerBlock = 12) {
  if (count <= 0 || total <= 0) return [];
  const values = Array(count).fill(Math.floor(total / count));
  let rest = total - values.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  while (rest > 0) {
    values[cursor % count] += 1;
    rest -= 1;
    cursor += 1;
  }
  for (let i = 0; i < values.length; i += 1) values[i] = Math.max(2, Math.min(maxPerBlock, values[i]));
  const delta = total - values.reduce((sum, value) => sum + value, 0);
  if (values.length) values[0] += delta;
  return values;
}

generatePracticePlan = function generatePracticePlanV1(total, energy, focus = null, rotate = false) {
  total = clamp(Number(total) || 20, 3, 180);
  const active = appState.tasks.filter(task => task.status === 'active');
  const teacherTasks = active.filter(task => task.source === 'teacher').sort((a, b) => taskScore(b) - taskScore(a));
  const personalTasks = active.filter(task => task.source === 'personal' && task.id !== focus?.id).sort((a, b) => taskScore(b) - taskScore(a));
  if (rotate && teacherTasks.length > 1) teacherTasks.push(teacherTasks.shift());
  if (rotate && personalTasks.length > 1) personalTasks.push(personalTasks.shift());

  const closing = appState.settings.includeClosing ? (total <= 10 ? 1 : total <= 30 ? 2 : 3) : 0;
  const warmup = appState.settings.includeWarmup && total >= 15 ? clamp(Math.round(total * .1), 2, 5) : 0;
  let remaining = total - closing - warmup;
  const plan = [];
  const maxBlock = Number(appState.settings.maxBlockMinutes || 12);

  if (warmup) {
    plan.push({
      id: uid('block'), title: 'Activación consciente', source: 'app', category: 'warmup', duration: warmup,
      instruction: energy === 'low'
        ? 'Movilidad suave, respiración y un patrón conocido. Nada de perseguir velocidad con la sutileza de una topadora.'
        : 'Chequeá postura, respiración y tensión con un patrón cómodo antes de exigir precisión.',
      success: 'Empezar el bloque siguiente con manos disponibles y sin tensión evidente.', bpm: 54
    });
  }

  if (focus && remaining >= 3) {
    const duration = clamp(Math.min(Number(focus.suggestedMinutes || 5), Math.round(remaining * .35)), 3, remaining);
    plan.push(taskToBlock(focus, duration, energy));
    remaining -= duration;
  }

  const moduleOrder = ['reading', 'theory', 'improvisation'];
  const rotation = (new Date().getDay() + (rotate ? 1 : 0)) % moduleOrder.length;
  const rotatedModules = [...moduleOrder.slice(rotation), ...moduleOrder.slice(0, rotation)];
  const moduleCount = total >= 45 ? 2 : total >= 20 ? 1 : 0;
  const selectedModules = rotatedModules
    .filter(key => Number(appState.profile.distributions?.[key] || 0) > 0)
    .slice(0, moduleCount);
  const moduleMinutes = selectedModules.map(() => total >= 60 ? 7 : 5);
  const moduleBudget = moduleMinutes.reduce((sum, value) => sum + value, 0);

  let teacherBudget = teacherTasks.length
    ? Math.min(Math.max(remaining - moduleBudget - (personalTasks.length && total >= 20 ? 5 : 0), 4), remaining - moduleBudget)
    : 0;
  const minimumTeacher = teacherTasks.length ? Math.round(total * Number(appState.profile.minTeacherShare || 0) / 100) : 0;
  const alreadyTeacher = plan.filter(block => block.source === 'teacher').reduce((sum, block) => sum + block.duration, 0);
  teacherBudget = Math.max(teacherBudget, Math.min(remaining - moduleBudget, Math.max(0, minimumTeacher - alreadyTeacher)));
  teacherBudget = clamp(teacherBudget, 0, Math.max(0, remaining - moduleBudget));

  if (teacherBudget > 0 && teacherTasks.length) {
    const count = teacherBudget >= 12 && teacherTasks.length > 1 ? 2 : 1;
    const minutes = distributeMinutes(teacherBudget, count, maxBlock);
    minutes.forEach((value, index) => plan.push(taskToBlock(teacherTasks[index % teacherTasks.length], value, energy)));
    remaining -= teacherBudget;
  }

  if (personalTasks.length && remaining - moduleBudget >= 3) {
    const value = clamp(Math.min(personalTasks[0].suggestedMinutes || 5, remaining - moduleBudget), 3, maxBlock);
    plan.push(taskToBlock(personalTasks[0], value, energy));
    remaining -= value;
  }

  selectedModules.forEach((moduleKey, index) => {
    if (remaining <= 0) return;
    const duration = Math.min(moduleMinutes[index], remaining);
    if (moduleKey === 'reading') {
      const rs = appState.readingSettings;
      plan.push({
        id: uid('block'), title: 'Lectura a primera vista', source: 'app', category: 'reading', duration,
        instruction: `${rs.clef === 'bass' ? 'Clave de Fa' : rs.clef === 'random' ? 'Clave alternada' : 'Clave de Sol'}, nivel ${rs.level}. Leé primero el compás y después tocá sin volver atrás.`,
        success: 'Completar un ejercicio y revisar precisión de notas y continuidad.', readingConfig: structuredClone(rs)
      });
    } else if (moduleKey === 'theory') {
      const nextLesson = THEORY_LESSONS.find(lesson => !appState.theoryProgress.completedLessons.includes(lesson.id)) || THEORY_LESSONS[0];
      plan.push({
        id: uid('block'), title: `Teoría · ${nextLesson.title}`, source: 'app', category: 'theory', duration,
        instruction: `${nextLesson.core} ${nextLesson.practice}`,
        success: 'Explicarlo con tus palabras y tocar al menos un ejemplo.', lessonId: nextLesson.id
      });
    } else {
      const progression = IMPROV_PROGRESSIONS[appState.improvisationProgress.lastProgression || 'pop-c'] || IMPROV_PROGRESSIONS['pop-c'];
      plan.push({
        id: uid('block'), title: 'Improvisación guiada', source: 'app', category: 'improvisation', duration,
        instruction: `Sobre ${progression.name}, usá un motivo corto, repetilo y cambiá una sola variable por vuelta.`,
        success: 'Sostener una idea reconocible durante dos vueltas y dejar espacios.', bpm: progression.bpm || 72
      });
    }
    remaining -= duration;
  });

  if (remaining > 0) {
    const target = [...plan].reverse().find(block => !['closing', 'warmup'].includes(block.category));
    if (target) target.duration += remaining;
    else {
      plan.push({
        id: uid('block'), title: 'Práctica enfocada', source: 'personal', category: 'technique', duration: remaining,
        instruction: 'Elegí una dificultad concreta, reducí variables y trabajá en fragmentos pequeños.',
        success: 'Registrar un cambio observable y una próxima acción.'
      });
    }
  }

  if (closing) {
    plan.push({
      id: uid('block'), title: 'Cierre y próxima acción', source: 'app', category: 'closing', duration: closing,
      instruction: 'Registrá qué mejoró, qué sigue bloqueado y el primer paso de la próxima sesión.',
      success: 'Una próxima acción concreta y breve.'
    });
  }

  const difference = total - plan.reduce((sum, block) => sum + Number(block.duration || 0), 0);
  const adjustable = [...plan].reverse().find(block => block.category !== 'closing');
  if (adjustable && difference) adjustable.duration = Math.max(1, adjustable.duration + difference);
  return plan;
};

renderPlanBlock = function renderPlanBlockV1(block, index) {
  return `
    <div class="plan-block" data-plan-id="${esc(block.id)}">
      <span class="plan-order">${index + 1}</span>
      <div class="plan-copy">
        <div class="row wrap"><strong>${esc(block.title)}</strong>${sourceTag(block.source)}<span class="category-tag">${esc(CATEGORY_LABELS[block.category] || block.category)}</span></div>
        <span>${esc(block.instruction || block.objective || '')}</span>
        ${block.success ? `<span><b>Cierre:</b> ${esc(block.success)}</span>` : ''}
      </div>
      <div class="text-right">
        <div class="plan-time">${block.duration} min</div>
        <div class="row mt-10">
          <button class="icon-button ghost" data-plan-action="edit" data-index="${index}" title="Editar bloque">✎</button>
          ${index > 0 ? `<button class="icon-button ghost" data-plan-action="up" data-index="${index}" title="Subir">↑</button>` : ''}
          ${index < ui.currentPlan.length - 1 ? `<button class="icon-button ghost" data-plan-action="down" data-index="${index}" title="Bajar">↓</button>` : ''}
          ${block.category !== 'closing' ? `<button class="icon-button ghost" data-plan-action="remove" data-index="${index}" title="Quitar">×</button>` : ''}
        </div>
      </div>
    </div>`;
};

renderToday = function renderTodayV1() {
  let html = OLD_RENDER_TODAY();
  const activeSession = ui.sessionRun || appState.activeSession;
  const resumeCard = activeSession ? `
    <section class="card pad resume-card">
      <div class="row between wrap">
        <div><span class="eyebrow">Sesión pausada</span><h3 class="mt-10">${esc(activeSession.plan?.[activeSession.index]?.title || 'Práctica en curso')}</h3><p class="muted small">Bloque ${Number(activeSession.index || 0) + 1} de ${activeSession.plan?.length || 0}. El progreso quedó guardado.</p></div>
        <div class="row wrap"><button class="secondary-button" id="discardActiveSession">Descartar</button><button class="primary-button" id="resumeActiveSession">▶ Retomar</button></div>
      </div>
    </section>` : '';
  html = html.replace('<div class="page-grid">', `<div class="page-grid">${resumeCard}`);
  html = html.replace(
    '<button class="primary-button" id="startPractice">▶ EMPEZAR</button>',
    '<div class="row wrap"><button class="secondary-button" id="addPlanBlock">＋ Agregar bloque</button><button class="primary-button" id="startPractice">▶ EMPEZAR</button></div>'
  );
  if (!appState.tasks.some(task => task.status === 'active')) {
    html = html.replace(
      '<div class="task-list">',
      '<div class="empty-state compact"><strong>Todavía no hay tareas activas</strong><p>Creá una indicación de tu profesora o un objetivo personal. El generador no va a inventar deberes con autoridad de cartón.</p><div class="row wrap mt-14"><button class="secondary-button" id="emptyTeacherTask">＋ Tarea de clase</button><button class="secondary-button" id="emptyPersonalTask">＋ Objetivo personal</button></div></div><div class="task-list">'
    );
  }
  return html;
};

function bindTodayV1Core() {
  $$('#durationChoices [data-duration]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.duration === 'custom') return openCustomDurationModal();
    ui.duration = Number(button.dataset.duration); renderRoute();
  }));
  $$('#energyChoices [data-energy]').forEach(button => button.addEventListener('click', () => { ui.energy = button.dataset.energy; renderRoute(); }));
  $('#addTodayFocus')?.addEventListener('click', () => openQuickActivityModal('today'));
  $('#clearTodayFocus')?.addEventListener('click', () => { ui.todayFocus = null; renderRoute(); });
  $('#generatePlan')?.addEventListener('click', () => {
    ui.currentPlan = generatePracticePlan(ui.duration, ui.energy, ui.todayFocus);
    planDraftSave(); renderRoute(); toast('Plan generado', `${ui.currentPlan.length} bloques para ${ui.duration} minutos.`);
  });
  $('#regeneratePlan')?.addEventListener('click', () => {
    ui.currentPlan = generatePracticePlan(ui.duration, ui.energy, ui.todayFocus, true);
    planDraftSave(); renderRoute();
  });
  $$('[data-plan-action]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.planAction;
    const index = Number(button.dataset.index);
    if (action === 'edit') return openPlanBlockModal(index);
    updatePlan(action, index); planDraftSave();
  }));
  $('#addPlanBlock')?.addEventListener('click', () => openPlanBlockModal(null));
  $('#startPractice')?.addEventListener('click', () => startPracticeSession());
  $('#resumeActiveSession')?.addEventListener('click', resumeActiveSession);
  $('#discardActiveSession')?.addEventListener('click', confirmDiscardActiveSession);
  $('#emptyTeacherTask')?.addEventListener('click', () => openTaskModal('teacher'));
  $('#emptyPersonalTask')?.addEventListener('click', () => openTaskModal('personal'));
  $$('[data-route-jump]').forEach(button => button.addEventListener('click', () => setRoute(button.dataset.routeJump)));
}

bindToday = bindTodayV1Core;

function openPlanBlockModal(index = null) {
  const existing = Number.isInteger(index) ? ui.currentPlan[index] : null;
  const taskOptions = appState.tasks.filter(task => task.status === 'active');
  openModal({
    title: existing ? 'Editar bloque' : 'Agregar bloque',
    eyebrow: 'Plan de hoy',
    body: `
      ${!existing && taskOptions.length ? `<div class="field"><label for="planTaskSelect">Usar una tarea existente</label><select id="planTaskSelect"><option value="">Bloque personalizado</option>${taskOptions.map(task => `<option value="${esc(task.id)}">${esc(task.title)} · ${esc(SOURCE_LABELS[task.source] || task.source)}</option>`).join('')}</select></div><div class="divider"></div>` : ''}
      <div class="field-grid">
        <div class="field span-2"><label for="planBlockTitle">Nombre</label><input id="planBlockTitle" value="${esc(existing?.title || '')}" /></div>
        <div class="field"><label for="planBlockDuration">Minutos</label><input id="planBlockDuration" type="number" min="1" max="90" value="${existing?.duration || 5}" /></div>
        <div class="field"><label for="planBlockCategory">Categoría</label><select id="planBlockCategory">${Object.entries(CATEGORY_LABELS).map(([value,label]) => `<option value="${value}" ${existing?.category === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
        <div class="field"><label for="planBlockSource">Origen</label><select id="planBlockSource"><option value="teacher" ${existing?.source === 'teacher' ? 'selected' : ''}>Profesora</option><option value="personal" ${existing?.source === 'personal' ? 'selected' : ''}>Personal</option><option value="app" ${(!existing || existing?.source === 'app') ? 'selected' : ''}>Aplicación</option></select></div>
        <div class="field"><label for="planBlockBpm">BPM</label><input id="planBlockBpm" type="number" min="20" max="240" value="${existing?.bpm || ''}" placeholder="Opcional" /></div>
        <div class="field span-2"><label for="planBlockInstruction">Consigna</label><textarea id="planBlockInstruction">${esc(existing?.instruction || '')}</textarea></div>
        <div class="field span-2"><label for="planBlockSuccess">Criterio de cierre</label><input id="planBlockSuccess" value="${esc(existing?.success || '')}" /></div>
      </div>`,
    footer: `<button class="secondary-button" data-close-modal>Cancelar</button><button class="primary-button" id="savePlanBlock">Guardar bloque</button>`,
    onOpen: () => {
      $('[data-close-modal]').addEventListener('click', () => closeModal(true));
      $('#planTaskSelect')?.addEventListener('change', event => {
        const task = appState.tasks.find(item => item.id === event.target.value);
        if (!task) return;
        $('#planBlockTitle').value = task.title;
        $('#planBlockDuration').value = task.suggestedMinutes || 5;
        $('#planBlockCategory').value = task.category;
        $('#planBlockSource').value = task.source;
        $('#planBlockBpm').value = task.bpm || '';
        $('#planBlockInstruction').value = task.method || task.objective || '';
        $('#planBlockSuccess').value = task.success || '';
      });
      $('#savePlanBlock').addEventListener('click', () => {
        const title = $('#planBlockTitle').value.trim();
        if (!title) return toast('Falta el nombre del bloque');
        const selectedTaskId = $('#planTaskSelect')?.value || existing?.taskId || null;
        const block = {
          id: existing?.id || uid('block'),
          taskId: selectedTaskId || undefined,
          title,
          duration: clamp(Number($('#planBlockDuration').value) || 5, 1, 90),
          category: $('#planBlockCategory').value,
          source: $('#planBlockSource').value,
          bpm: Number($('#planBlockBpm').value) || undefined,
          instruction: $('#planBlockInstruction').value.trim() || 'Trabajá con una consigna concreta y ajustá la dificultad según lo que aparezca.',
          success: $('#planBlockSuccess').value.trim() || 'Cerrar con una observación y una próxima acción.'
        };
        if (existing) ui.currentPlan[index] = block;
        else ui.currentPlan.splice(Math.max(0, ui.currentPlan.length - (ui.currentPlan.at(-1)?.category === 'closing' ? 1 : 0)), 0, block);
        ui.duration = ui.currentPlan.reduce((sum, item) => sum + Number(item.duration || 0), 0);
        planDraftSave(); closeModal(true); renderRoute();
      });
    }
  });
}

function confirmDiscardActiveSession() {
  openModal({
    title: 'Descartar sesión pausada', eyebrow: 'Confirmación',
    body: '<div class="prompt-box"><span>Se perderá el avance no cerrado</span><p>Las sesiones anteriores y las tareas siguen intactas. Solo se elimina esta ejecución en curso.</p></div>',
    footer: '<button class="secondary-button" data-close-modal>Cancelar</button><button class="danger-button" id="discardActiveConfirm">Descartar</button>',
    onOpen: () => {
      $('[data-close-modal]').addEventListener('click', () => closeModal(true));
      $('#discardActiveConfirm').addEventListener('click', async () => {
        if (ui.sessionRun?.timerId) clearInterval(ui.sessionRun.timerId);
        ui.sessionRun = null; appState.activeSession = null;
        await saveState(); closeModal(true); renderRoute(); updateChrome();
      });
    }
  });
}

function resumeActiveSession() {
  restoreActiveSession();
  if (!ui.sessionRun) return toast('No hay sesión pausada');
  renderSessionRunner();
}


startPracticeSession = function startPracticeSessionV1(plan = ui.currentPlan, type = 'practice') {
  if (!plan?.length) return toast('No hay plan', 'Generá o elegí una práctica antes de empezar. La telepatía todavía no entró al alcance.');
  ui.sessionRun = {
    type,
    plan: structuredClone(plan),
    index: 0,
    results: [],
    startedAt: Date.now(),
    blockStartedAt: Date.now(),
    remainingSeconds: Number(plan[0].duration || 1) * 60,
    running: false,
    timerId: null,
    checkpointId: null,
    awaitingResult: false,
    elapsedActiveSeconds: 0,
    lastTickAt: null
  };
  appState.planDraft = null;
  persistActiveSession();
  renderSessionRunner();
};

renderSessionRunner = function renderSessionRunnerV1() {
  OLD_RENDER_SESSION_RUNNER();
  const run = ui.sessionRun;
  const block = run?.plan?.[run.index];
  if (!block) return;
  const resultArea = $('#sessionResultArea');
  if (!resultArea) return;

  if (block.category === 'reading') {
    resultArea.insertAdjacentHTML('beforebegin', `
      <div class="module-action-panel">
        <strong>Ejercicio integrado</strong>
        <p>La sesión queda pausada mientras hacés el ejercicio. Al terminar, el resultado vuelve automáticamente a este plan.</p>
        <button class="secondary-button full" id="launchReadingBlock">𝄞 Abrir ejercicio de lectura</button>
      </div>`);
    $('#launchReadingBlock')?.addEventListener('click', launchReadingFromSession);
  }
  if (block.category === 'theory' && block.lessonId) {
    resultArea.insertAdjacentHTML('beforebegin', `
      <div class="module-action-panel">
        <strong>Lección integrada</strong>
        <p>Abrí la lección, probá el ejemplo y marcala como completada para cerrar este bloque.</p>
        <button class="secondary-button full" id="launchTheoryBlock">∑ Abrir lección</button>
      </div>`);
    $('#launchTheoryBlock')?.addEventListener('click', () => launchTheoryFromSession(block.lessonId));
  }
};

bindSessionRunner = function bindSessionRunnerV1() {
  OLD_BIND_SESSION_RUNNER();
};

toggleSessionTimer = function toggleSessionTimerV1() {
  const run = ui.sessionRun;
  if (!run || run.awaitingResult) return;
  run.running = !run.running;
  const button = $('#timerToggle');
  if (run.running) {
    button.textContent = 'Ⅱ Pausar';
    $('#finishBlock')?.classList.remove('hidden');
    run.lastTickAt = Date.now();
    run.blockStartedAt ||= Date.now();
    run.timerId = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.max(0, (now - run.lastTickAt) / 1000);
      run.lastTickAt = now;
      run.remainingSeconds -= elapsed;
      run.elapsedActiveSeconds += elapsed;
      const timer = $('#timerValue');
      if (timer) timer.textContent = formatTimer(run.remainingSeconds);
      if (run.remainingSeconds <= 0) {
        clearInterval(run.timerId); run.timerId = null;
        if (run.checkpointId) clearInterval(run.checkpointId);
        run.running = false;
        showBlockResult();
        playClick(880, .08);
      }
    }, 250);
    run.checkpointId = setInterval(persistActiveSession, 10000);
  } else {
    if (run.timerId) clearInterval(run.timerId);
    if (run.checkpointId) clearInterval(run.checkpointId);
    run.timerId = null; run.checkpointId = null;
    button.textContent = '▶ Continuar';
    persistActiveSession();
  }
};

recordBlockResult = async function recordBlockResultV1(result, note = '') {
  const runBefore = ui.sessionRun;
  await OLD_RECORD_BLOCK_RESULT(result, note);
  if (ui.sessionRun) {
    ui.sessionRun.elapsedActiveSeconds = runBefore?.elapsedActiveSeconds || ui.sessionRun.elapsedActiveSeconds || 0;
    await persistActiveSession();
  }
};

finishPracticeSession = async function finishPracticeSessionV1() {
  const run = ui.sessionRun;
  if (!run) return;
  if (run.timerId) clearInterval(run.timerId);
  if (run.checkpointId) clearInterval(run.checkpointId);
  stopMetronome();

  const plannedMinutes = run.plan.reduce((sum, block) => sum + Number(block.duration || 0), 0);
  const elapsedSeconds = run.results.reduce((sum, item) => sum + Number(item.elapsedSeconds || 0), 0);
  const actualMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
  const achieved = run.results.filter(item => item.result === 'achieved').length;
  const omitted = run.results.filter(item => item.result === 'omitted').length;
  const session = {
    id: uid('session'),
    date: localISO(),
    startedAt: new Date(run.startedAt).toISOString(),
    plannedMinutes,
    actualMinutes: Math.min(Math.max(actualMinutes, 1), Math.max(plannedMinutes, actualMinutes)),
    mood: 'correcta',
    note: '',
    type: run.type,
    demo: false,
    blocks: run.results.map(item => ({
      taskId: item.taskId || null,
      category: item.category,
      source: item.source,
      title: item.title,
      minutes: Math.max(0, Math.round(Number(item.elapsedSeconds || 0) / 60)) || Number(item.duration || 0),
      plannedMinutes: Number(item.duration || 0),
      result: item.result,
      note: item.note || '',
      bpm: item.bpm || null,
      nextAction: item.note || ''
    }))
  };
  appState.sessions.push(session);
  if (run.type === 'improvisation') appState.improvisationProgress.completedSessions += 1;
  appState.activeSession = null;
  appState.planDraft = null;
  ui.sessionRun = null;
  ui.currentPlan = [];
  await saveState();
  closeModal(true);
  renderRoute(); updateChrome();

  openModal({
    title: 'Sesión completada', eyebrow: 'Fade Out Piano',
    body: `
      <div class="timer-stage"><div class="timer-value">${session.actualMinutes}</div><div class="timer-label">minutos registrados</div></div>
      <div class="kpi-grid mt-18">
        <div class="card soft kpi-card"><div class="kpi-label">Bloques</div><div class="kpi-value">${run.results.length}</div></div>
        <div class="card soft kpi-card"><div class="kpi-label">Logrados</div><div class="kpi-value">${achieved}</div></div>
        <div class="card soft kpi-card"><div class="kpi-label">Omitidos</div><div class="kpi-value">${omitted}</div></div>
        <div class="card soft kpi-card"><div class="kpi-label">Planeado</div><div class="kpi-value">${plannedMinutes}</div></div>
      </div>
      <div class="prompt-box mt-18"><span>Próxima acción sugerida</span><p>${esc(suggestNextAction(run.results))}</p></div>
      <div class="field mt-18"><label>¿Cómo se sintió la práctica?</label><div class="mood-grid" id="sessionMood">${['frustrante','difícil','correcta','buena','muy buena'].map(value => `<button class="choice-chip ${value === 'correcta' ? 'active' : ''}" data-mood="${value}">${capitalize(value)}</button>`).join('')}</div></div>
      <div class="field mt-14"><label for="sessionNote">Observación general</label><textarea id="sessionNote" placeholder="Algo que convenga recordar mañana"></textarea></div>`,
    footer: '<button class="secondary-button" id="goProgress">Ver progreso</button><button class="primary-button" id="saveSessionReflection">Guardar y cerrar</button>',
    onOpen: () => {
      let mood = 'correcta';
      $$('[data-mood]').forEach(button => button.addEventListener('click', () => {
        mood = button.dataset.mood;
        $$('[data-mood]').forEach(item => item.classList.toggle('active', item === button));
      }));
      const saveReflection = async destination => {
        session.mood = mood;
        session.note = $('#sessionNote')?.value.trim() || '';
        await saveState(); closeModal(true);
        if (destination === 'progress') setRoute('progreso');
      };
      $('#saveSessionReflection').addEventListener('click', () => saveReflection('close'));
      $('#goProgress').addEventListener('click', () => saveReflection('progress'));
    }
  });
};

function launchReadingFromSession() {
  const block = ui.sessionRun?.plan?.[ui.sessionRun.index];
  if (!block) return;
  if (ui.sessionRun.timerId) clearInterval(ui.sessionRun.timerId);
  ui.sessionRun.running = false;
  ui.readingSessionContext = true;
  const config = block.readingConfig || appState.readingSettings;
  ui.readingClef = config.clef || 'treble';
  ui.readingLevel = Number(config.level || 2);
  ui.readingMeasures = Math.min(2, Number(config.measures || 2));
  ui.readingTempo = Number(config.tempo || 60);
  ui.readingPulse = Boolean(config.withPulse);
  ui.readingExercise = generateReadingExercise();
  persistActiveSession();
  closeModal(true);
  setRoute('lectura');
  toast('Bloque de lectura abierto', 'Al terminar el ejercicio, la sesión continuará automáticamente. Milagro menor de la ingeniería doméstica.');
}

function launchTheoryFromSession(lessonId) {
  if (ui.sessionRun?.timerId) clearInterval(ui.sessionRun.timerId);
  ui.sessionRun.running = false;
  ui.theorySessionContext = lessonId;
  persistActiveSession();
  closeModal(true);
  openTheoryLesson(lessonId);
}


function sessionsForDate(iso) {
  return appState.sessions.filter(session => session.date === iso).sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')));
}

renderWeek = function renderWeekV1() {
  const { start, end, nextClass } = getCurrentCycle();
  const stats = getWeeklyStats();
  const sessions = getCycleSessions();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start); date.setDate(start.getDate() + index);
    const iso = localISO(date);
    return { date, iso, sessions: sessionsForDate(iso) };
  });
  const notes = [...appState.classNotes].sort((a, b) => b.date.localeCompare(a.date));
  const teacherTasks = appState.tasks.filter(task => task.source === 'teacher' && task.status === 'active').sort((a,b) => taskScore(b)-taskScore(a));
  const selectedIso = ui.selectedWeekDate || localISO();
  const selectedSessions = sessionsForDate(selectedIso);

  return `<div class="page-grid">
    <section class="card pad accent-card">
      <div class="row between wrap">
        <div><span class="eyebrow">Ciclo actual</span><h2 class="mt-10">${formatDate(start,{day:'numeric',month:'long'})} al ${formatDate(end,{day:'numeric',month:'long'})}</h2><p class="muted small">La clase del sábado marca el ciclo. El calendario gregoriano sobrevivirá a la afrenta.</p></div>
        <div class="row wrap">${statusTag(`${stats.sessions}/${stats.sessionGoal} sesiones`,stats.sessions>=stats.sessionGoal?'success':'')}${statusTag(`${stats.minutes}/${stats.minuteGoal} min`,stats.minutes>=stats.minuteGoal?'success':'')}${statusTag(`Clase ${formatDate(nextClass)}`,'warning')}</div>
      </div>
      <div class="week-strip mt-18">
        ${days.map(day => {
          const minutes = day.sessions.reduce((sum,s)=>sum+Number(s.actualMinutes||0),0);
          return `<button class="day-cell ${day.iso===localISO()?'today':''} ${day.iso===selectedIso?'selected':''}" data-week-date="${day.iso}"><span class="day-name">${formatDate(day.date,{weekday:'short'})}</span><span class="day-number">${day.date.getDate()}</span><span class="day-session">${minutes?`<span class="day-dot"></span>${minutes} min · ${day.sessions.length}`:day.iso===localISO()?'Hoy · sin sesión':'Sin práctica'}</span></button>`;
        }).join('')}
      </div>
    </section>

    <div class="page-grid two">
      <section class="page-section">
        <div class="section-header"><div><h2>Indicaciones de la clase</h2><p>Notas para el contexto y tareas para la ejecución. Mezclarlas produce esa niebla administrativa tan querida por la humanidad.</p></div><button class="secondary-button" id="addClassNote">＋ Nota</button></div>
        <div class="card pad">
          <div class="stack">
            ${notes.length ? notes.slice(0,5).map(note => `<div class="class-note-row"><div><span class="eyebrow">${formatDate(note.date,{day:'numeric',month:'long'})}</span><p>${esc(note.text)}</p></div><div class="row"><button class="icon-button ghost" data-edit-class-note="${esc(note.id)}" title="Editar">✎</button><button class="icon-button ghost" data-delete-class-note="${esc(note.id)}" title="Eliminar">×</button></div></div>`).join('') : '<div class="empty-state"><strong>Sin notas de clase</strong><p>Podés cargar una síntesis y convertir cada indicación importante en una tarea.</p></div>'}
          </div>
          <div class="divider"></div>
          <div class="row between wrap"><strong>Tareas activas de la profesora</strong><button class="text-button" id="addTeacherTask">＋ Nueva tarea</button></div>
          <div class="task-list mt-14">
            ${teacherTasks.map(task => `<div class="task-row"><span class="task-icon">${task.category==='technique'?'⌁':'♫'}</span><div class="task-copy"><strong>${esc(task.title)}</strong><span>${esc(task.objective||task.method||'')}</span><div class="row wrap mt-10">${statusTag(task.priority===3?'Alta':task.priority===2?'Media':'Normal',task.priority===3?'warning':'')}${statusTag(`${task.frequencyPerWeek||1}× semana`)}</div></div><div class="stack task-actions"><button class="icon-button ghost" data-edit-task="${esc(task.id)}" title="Editar">✎</button><button class="icon-button ghost" data-delete-task="${esc(task.id)}" title="Eliminar">×</button></div></div>`).join('') || '<div class="empty-state"><strong>No hay tareas activas</strong><p>Agregá una indicación concreta o disfrutá de la rara paz de no tener deberes.</p></div>'}
          </div>
        </div>
      </section>

      <aside class="page-section">
        <div class="section-header"><div><h2>${formatDate(selectedIso,{weekday:'long',day:'numeric',month:'long'})}</h2><p>Detalle del día seleccionado.</p></div></div>
        <div class="card pad">
          ${selectedSessions.length ? `<div class="task-list">${selectedSessions.map(session => `<button class="task-row interactive" data-session-detail="${esc(session.id)}"><span class="task-icon">▶</span><div class="task-copy"><strong>${session.actualMinutes} min · ${esc(capitalize(session.mood||'registrada'))}</strong><span>${esc((session.blocks||[]).map(block=>block.title).slice(0,2).join(' · ')||'Sesión')}</span></div><span class="task-meta">${session.blocks?.length||0} bloques</span></button>`).join('')}</div>` : '<div class="empty-state"><strong>Sin sesiones ese día</strong><p>La ausencia de datos también es un dato. A veces incluso uno muy relajante.</p></div>'}
          <div class="divider"></div>
          <div class="insight-list">${weekInsights(teacherTasks,sessions).map(item=>`<div class="insight"><span class="insight-mark"></span><div><strong>${esc(item.title)}</strong><p>${esc(item.text)}</p></div></div>`).join('')}</div>
          <button class="primary-button full mt-18" id="generatePreClass">GENERAR REPASO PREVIO</button>
        </div>
      </aside>
    </div>
  </div>`;
};

bindWeek = function bindWeekV1() {
  $('#addClassNote')?.addEventListener('click', () => openClassNoteModalV1());
  $('#addTeacherTask')?.addEventListener('click', () => openTaskModal('teacher'));
  $$('[data-week-date]').forEach(button => button.addEventListener('click', () => { ui.selectedWeekDate = button.dataset.weekDate; renderRoute(); }));
  $$('[data-edit-class-note]').forEach(button => button.addEventListener('click', () => openClassNoteModalV1(button.dataset.editClassNote)));
  $$('[data-delete-class-note]').forEach(button => button.addEventListener('click', () => confirmDeleteEntity('classNote',button.dataset.deleteClassNote)));
  $$('[data-edit-task]').forEach(button => button.addEventListener('click', () => openTaskModal(null,'',button.dataset.editTask)));
  $$('[data-delete-task]').forEach(button => button.addEventListener('click', () => confirmDeleteEntity('task',button.dataset.deleteTask)));
  $$('[data-session-detail]').forEach(button => button.addEventListener('click', () => openSessionDetail(button.dataset.sessionDetail)));
  $('#generatePreClass')?.addEventListener('click', () => {
    const duration = Math.max(20,ui.duration||30); ui.duration=duration; ui.energy='normal';
    ui.currentPlan=generatePreClassPlan(duration); planDraftSave(); setRoute('hoy'); toast('Repaso preparado','Más integración y dudas concretas para la clase.');
  });
};

function openClassNoteModalV1(noteId = null) {
  const existing = appState.classNotes.find(note => note.id===noteId);
  openModal({
    title: existing?'Editar nota de clase':'Nota de clase', eyebrow:'Semana',
    body:`<div class="field-grid"><div class="field"><label for="classDate">Fecha</label><input id="classDate" type="date" value="${existing?.date||localISO(getCurrentCycle().start)}" /></div><div class="field span-2"><label for="classText">Síntesis</label><textarea id="classText" placeholder="Qué trabajaron, qué corrigió la profesora y qué conviene priorizar">${esc(existing?.text||'')}</textarea></div></div>`,
    footer:'<button class="secondary-button" data-close-modal>Cancelar</button><button class="primary-button" id="saveClassNote">Guardar</button>',
    onOpen:()=>{
      $('[data-close-modal]').addEventListener('click',()=>closeModal(true));
      $('#saveClassNote').addEventListener('click',async()=>{
        const text=$('#classText').value.trim(); if(!text)return toast('La nota está vacía');
        if(existing){existing.date=$('#classDate').value||localISO();existing.text=text;}
        else appState.classNotes.push({id:uid('note'),date:$('#classDate').value||localISO(),text});
        await saveState();closeModal(true);renderRoute();toast('Nota guardada');
      });
    }
  });
}

openRepertoireModal = function openRepertoireModalV1(itemId = null) {
  const existing = appState.repertoire.find(item=>item.id===itemId);
  openModal({
    title:existing?'Editar elemento':'Nuevo elemento',eyebrow:'Repertorio',
    body:`<div class="field-grid"><div class="field span-2"><label for="repTitle">Nombre</label><input id="repTitle" value="${esc(existing?.title||'')}" placeholder="Obra, técnica, método o proyecto" /></div><div class="field"><label for="repComposer">Compositor o descripción</label><input id="repComposer" value="${esc(existing?.composer||'')}" /></div><div class="field"><label for="repType">Tipo</label><select id="repType">${['Obra','Técnica','Método','Ejercicio','Laboratorio','Proyecto'].map(value=>`<option ${existing?.type===value?'selected':''}>${value}</option>`).join('')}</select></div><div class="field"><label for="repStatus">Estado</label><select id="repStatus"><option value="active" ${existing?.status==='active'?'selected':''}>Activo</option><option value="paused" ${existing?.status==='paused'?'selected':''}>En pausa</option><option value="completed" ${existing?.status==='completed'?'selected':''}>Completado</option><option value="archived" ${existing?.status==='archived'?'selected':''}>Archivado</option></select></div><div class="field span-2"><label for="repNotes">Notas generales</label><textarea id="repNotes">${esc(existing?.notes||'')}</textarea></div></div>`,
    footer:`<button class="secondary-button" data-close-modal>Cancelar</button><button class="primary-button" id="saveRepertoire">Guardar</button>`,
    onOpen:()=>{
      $('[data-close-modal]').addEventListener('click',()=>closeModal(true));
      $('#saveRepertoire').addEventListener('click',async()=>{
        const title=$('#repTitle').value.trim();if(!title)return toast('Falta el nombre');
        const values={title,composer:$('#repComposer').value.trim(),type:$('#repType').value,status:$('#repStatus').value,notes:$('#repNotes').value.trim()};
        if(existing)Object.assign(existing,values);
        else appState.repertoire.push({id:uid('rep'),...values,startedAt:localISO(),createdAt:localISO()});
        await saveState();closeModal(true);renderRoute();toast('Repertorio guardado');
      });
    }
  });
};

openTaskModal = function openTaskModalV1(source = 'personal', repertoireId = '', taskId = null) {
  const existing = appState.tasks.find(task=>task.id===taskId);
  source = existing?.source || source || 'personal';
  repertoireId = existing?.repertoireId || repertoireId || '';
  openModal({
    title:existing?'Editar tarea':source==='teacher'?'Nueva tarea de clase':'Nuevo objetivo personal',eyebrow:source==='teacher'?'Profesora':'Mi laboratorio',wide:true,
    body:`<div class="field-grid three">
      <div class="field span-2"><label for="taskTitle">Tarea concreta</label><input id="taskTitle" value="${esc(existing?.title||'')}" placeholder="Qué vas a hacer" /></div>
      <div class="field"><label for="taskSource">Origen</label><select id="taskSource"><option value="teacher" ${source==='teacher'?'selected':''}>Profesora</option><option value="personal" ${source==='personal'?'selected':''}>Personal</option><option value="app" ${source==='app'?'selected':''}>Aplicación</option></select></div>
      <div class="field"><label for="taskCategory">Categoría</label><select id="taskCategory">${Object.entries(CATEGORY_LABELS).filter(([key])=>!['warmup','closing','free'].includes(key)).map(([key,label])=>`<option value="${key}" ${existing?.category===key?'selected':''}>${label}</option>`).join('')}</select></div>
      <div class="field"><label for="taskRepertoire">Obra o área</label><select id="taskRepertoire"><option value="">Sin asociación</option>${appState.repertoire.map(item=>`<option value="${esc(item.id)}" ${repertoireId===item.id?'selected':''}>${esc(item.title)}</option>`).join('')}</select></div>
      <div class="field"><label for="taskPriority">Prioridad</label><select id="taskPriority"><option value="1" ${Number(existing?.priority||1)===1?'selected':''}>Normal</option><option value="2" ${Number(existing?.priority)===2?'selected':''}>Media</option><option value="3" ${Number(existing?.priority)===3?'selected':''}>Alta</option></select></div>
      <div class="field span-2"><label for="taskObjective">Objetivo</label><textarea id="taskObjective">${esc(existing?.objective||'')}</textarea></div>
      <div class="field span-2"><label for="taskMethod">Método</label><textarea id="taskMethod">${esc(existing?.method||'')}</textarea></div>
      <div class="field span-2"><label for="taskSuccess">Criterio de cierre</label><input id="taskSuccess" value="${esc(existing?.success||'')}" /></div>
      <div class="field"><label for="taskMinutes">Minutos sugeridos</label><input id="taskMinutes" type="number" min="2" max="60" value="${existing?.suggestedMinutes||5}" /></div>
      <div class="field"><label for="taskFrequency">Veces por semana</label><input id="taskFrequency" type="number" min="0" max="7" value="${existing?.frequencyPerWeek||1}" /></div>
      <div class="field"><label for="taskBpm">Tempo actual</label><input id="taskBpm" type="number" min="20" max="240" value="${existing?.bpm||''}" placeholder="Opcional" /></div>
      <div class="field"><label for="taskTargetBpm">Tempo objetivo</label><input id="taskTargetBpm" type="number" min="20" max="240" value="${existing?.targetBpm||''}" placeholder="Opcional" /></div>
      <div class="field"><label for="taskStatus">Estado</label><select id="taskStatus"><option value="active" ${(!existing||existing.status==='active')?'selected':''}>Activo</option><option value="paused" ${existing?.status==='paused'?'selected':''}>En pausa</option><option value="completed" ${existing?.status==='completed'?'selected':''}>Completado</option><option value="archived" ${existing?.status==='archived'?'selected':''}>Archivado</option></select></div>
      <div class="field span-2"><label for="taskNextAction">Próxima acción</label><input id="taskNextAction" value="${esc(existing?.nextAction||'')}" placeholder="Con qué empezar la próxima vez" /></div>
    </div>`,
    footer:'<button class="secondary-button" data-close-modal>Cancelar</button><button class="primary-button" id="saveTask">Guardar tarea</button>',
    onOpen:()=>{
      if(!existing)$('#taskCategory').value=source==='teacher'?'repertoire':'technique';
      $('[data-close-modal]').addEventListener('click',()=>closeModal(true));
      $('#saveTask').addEventListener('click',async()=>{
        const title=$('#taskTitle').value.trim();if(!title)return toast('Falta la tarea concreta');
        const values={
          title,source:$('#taskSource').value,category:$('#taskCategory').value,repertoireId:$('#taskRepertoire').value||null,
          priority:Number($('#taskPriority').value),objective:$('#taskObjective').value.trim()||'Definir un resultado observable.',
          method:$('#taskMethod').value.trim()||'Empezar lento, reducir variables y revisar el resultado.',
          success:$('#taskSuccess').value.trim()||'Cerrar con una repetición estable y una próxima acción.',
          suggestedMinutes:clamp(Number($('#taskMinutes').value)||5,2,60),frequencyPerWeek:clamp(Number($('#taskFrequency').value)||0,0,7),
          bpm:Number($('#taskBpm').value)||null,targetBpm:Number($('#taskTargetBpm').value)||null,status:$('#taskStatus').value,
          nextAction:$('#taskNextAction').value.trim(),lastPracticed:existing?.lastPracticed||dateOffset(-14),completedThisWeek:existing?.completedThisWeek||0,
          protected:existing?.protected||false,createdAt:existing?.createdAt||localISO()
        };
        if(existing)Object.assign(existing,values);else appState.tasks.push({id:uid('task'),...values});
        await saveState();closeModal(true);renderRoute();toast('Tarea guardada');
      });
    }
  });
};

openRepertoireDetail = function openRepertoireDetailV1(id) {
  const item=appState.repertoire.find(entry=>entry.id===id);if(!item)return;
  const tasks=appState.tasks.filter(task=>task.repertoireId===id && task.status!=='archived');
  openModal({
    title:item.title,eyebrow:item.type||'Repertorio',wide:true,
    body:`<div class="row between wrap"><div><p class="muted">${esc(item.composer||'Sin descripción')}</p><div class="row wrap mt-10">${statusTag(item.status==='active'?'Activo':item.status==='paused'?'En pausa':item.status==='completed'?'Completado':'Archivado',item.status==='completed'?'success':'')}</div></div><div class="row"><button class="secondary-button" id="editRepertoireItem">Editar</button><button class="danger-button" id="deleteRepertoireItem">Eliminar</button></div></div>${item.notes?`<div class="prompt-box mt-18"><span>Notas</span><p>${esc(item.notes)}</p></div>`:''}<div class="divider"></div><div class="row between wrap"><strong>Tareas asociadas</strong><button class="text-button" id="detailAddTask">＋ Agregar</button></div><div class="task-list mt-14">${tasks.map(task=>`<div class="task-row"><span class="task-icon">${task.category==='technique'?'⌁':task.category==='improvisation'?'≈':'♫'}</span><div class="task-copy"><strong>${esc(task.title)}</strong><span>${esc(task.objective)}</span><div class="row wrap mt-10">${sourceTag(task.source)}${statusTag(task.status)}</div></div><div class="stack task-actions"><button class="icon-button ghost" data-edit-detail-task="${esc(task.id)}">✎</button><button class="icon-button ghost" data-delete-detail-task="${esc(task.id)}">×</button></div></div>`).join('')||'<div class="empty-state"><strong>Sin tareas</strong><p>Agregá una acción concreta para que este elemento deje de ser solamente un título respetable.</p></div>'}</div>`,
    footer:'<button class="primary-button" data-close-modal>Cerrar</button>',
    onOpen:()=>{
      $('[data-close-modal]').addEventListener('click',()=>closeModal(true));
      $('#editRepertoireItem').addEventListener('click',()=>{closeModal(true);openRepertoireModal(id);});
      $('#deleteRepertoireItem').addEventListener('click',()=>{closeModal(true);confirmDeleteEntity('repertoire',id);});
      $('#detailAddTask').addEventListener('click',()=>{closeModal(true);openTaskModal('personal',id);});
      $$('[data-edit-detail-task]').forEach(button=>button.addEventListener('click',()=>{closeModal(true);openTaskModal(null,'',button.dataset.editDetailTask);}));
      $$('[data-delete-detail-task]').forEach(button=>button.addEventListener('click',()=>{closeModal(true);confirmDeleteEntity('task',button.dataset.deleteDetailTask);}));
    }
  });
};

bindRepertoire = function bindRepertoireV1() {
  $$('[data-repertoire-filter]').forEach(button=>button.addEventListener('click',()=>{ui.repertoireFilter=button.dataset.repertoireFilter;renderRoute();}));
  $('#addRepertoire')?.addEventListener('click',()=>openRepertoireModal());
  $$('[data-open-repertoire]').forEach(button=>button.addEventListener('click',()=>openRepertoireDetail(button.dataset.openRepertoire)));
};

function confirmDeleteEntity(type,id) {
  const labels={task:'tarea',repertoire:'elemento de repertorio',classNote:'nota de clase',exploration:'exploración',session:'sesión'};
  openModal({title:`Eliminar ${labels[type]||'elemento'}`,eyebrow:'Confirmación',body:`<div class="prompt-box danger-soft"><span>Acción permanente</span><p>Se eliminará este ${labels[type]||'elemento'}. Los seres humanos pidieron botones de borrar y luego inventaron las confirmaciones para defenderse de sí mismos.</p></div>`,footer:'<button class="secondary-button" data-close-modal>Cancelar</button><button class="danger-button" id="confirmEntityDelete">Eliminar</button>',onOpen:()=>{
    $('[data-close-modal]').addEventListener('click',()=>closeModal(true));
    $('#confirmEntityDelete').addEventListener('click',async()=>{
      if(type==='task')appState.tasks=appState.tasks.filter(item=>item.id!==id);
      if(type==='classNote')appState.classNotes=appState.classNotes.filter(item=>item.id!==id);
      if(type==='exploration')appState.explorations=appState.explorations.filter(item=>item.id!==id);
      if(type==='session')appState.sessions=appState.sessions.filter(item=>item.id!==id);
      if(type==='repertoire'){
        appState.repertoire=appState.repertoire.filter(item=>item.id!==id);
        appState.tasks.forEach(task=>{if(task.repertoireId===id)task.repertoireId=null;});
      }
      await saveState();closeModal(true);renderRoute();toast('Elemento eliminado');
    });
  }});
}


renderLabTab = function renderLabTabV1() {
  if (ui.labTab === 'objetivos') {
    const goals=appState.tasks.filter(task=>task.source==='personal'&&task.status!=='archived');
    return `<div class="page-grid two"><section class="card pad"><div class="row between wrap"><div><h3>Objetivos personales</h3><p class="muted small">Práctica elegida por vos, sin esconderla en una nota huérfana.</p></div><span class="muted small">Alta, edición, prioridad y práctica directa</span></div><div class="task-list mt-18">${goals.map(task=>`<div class="task-row"><span class="task-icon">${task.category==='improvisation'?'≈':task.category==='theory'?'∑':task.category==='reading'?'𝄞':'◇'}</span><div class="task-copy"><strong>${esc(task.title)}</strong><span>${esc(task.objective||task.method||'')}</span><div class="row wrap mt-10">${statusTag(`${task.frequencyPerWeek||0}× semana`)}${task.bpm?statusTag(`${task.bpm} BPM`):''}${task.protected?statusTag('Protegida','success'):''}</div></div><div class="goal-actions"><button class="text-button" data-protect-task="${esc(task.id)}">${task.protected?'Quitar de hoy':'Proteger hoy'}</button><button class="secondary-button" data-practice-task="${esc(task.id)}">Practicar</button><button class="icon-button ghost" data-edit-lab-task="${esc(task.id)}">✎</button><button class="icon-button ghost" data-delete-lab-task="${esc(task.id)}">×</button></div></div>`).join('')||'<div class="empty-state"><strong>Sin objetivos personales</strong><p>Creá uno para técnica, una obra paralela, teoría, lectura o cualquier curiosidad con suficientes ganas de sobrevivir al martes.</p><button class="secondary-button mt-14" id="emptyAddGoal">＋ Crear objetivo</button></div>'}</div></section><aside class="card pad soft"><div class="card-header"><div><h3>Cómo entran al plan</h3><p>Reglas transparentes, no astrología algorítmica.</p></div></div><div class="insight-list mt-18"><div class="insight"><span class="insight-mark"></span><div><strong>Frecuencia pendiente</strong><p>Sube la prioridad si todavía no alcanzó las veces semanales.</p></div></div><div class="insight"><span class="insight-mark"></span><div><strong>Tiempo sin practicar</strong><p>Evita que una tarea quede archivada por simple omisión.</p></div></div><div class="insight"><span class="insight-mark"></span><div><strong>Protegida hoy</strong><p>Entra en el próximo plan aunque desplace otro bloque.</p></div></div></div></aside></div>`;
  }
  if(ui.labTab==='exploraciones'){
    const ideas=appState.explorations.filter(item=>item.status!=='archived'&&item.status!=='converted');
    const archived=appState.explorations.filter(item=>item.status==='archived');
    return `<div class="page-grid two"><section class="card pad"><div class="row between wrap"><div><h3>Exploraciones</h3><p class="muted small">Ideas sin frecuencia obligatoria. Curiosidad, pero con botón de recuperar.</p></div><button class="secondary-button" id="addExploration">＋ Idea</button></div><div class="task-list mt-18">${ideas.map(item=>`<div class="task-row"><span class="task-icon">?</span><div class="task-copy"><strong>${esc(item.title)}</strong><span>${esc(item.note||'Sin contexto adicional')}</span><div class="row wrap mt-10">${statusTag(formatDate(item.createdAt))}</div></div><div class="goal-actions"><button class="text-button" data-convert-exploration="${esc(item.id)}">Convertir</button><button class="icon-button ghost" data-edit-exploration="${esc(item.id)}">✎</button><button class="icon-button ghost" data-archive-exploration="${esc(item.id)}">⇩</button><button class="icon-button ghost" data-delete-exploration="${esc(item.id)}">×</button></div></div>`).join('')||'<div class="empty-state"><strong>Sin ideas pendientes</strong><p>Una bandeja vacía no es falta de creatividad. A veces es simplemente una bandeja vacía.</p></div>'}</div></section><aside class="card pad soft"><div class="card-header"><div><h3>Archivo</h3><p>${archived.length} ideas archivadas</p></div></div><div class="task-list mt-18">${archived.slice(0,6).map(item=>`<div class="task-row"><span class="task-icon">↙</span><div class="task-copy"><strong>${esc(item.title)}</strong><span>${esc(item.note||'')}</span></div><button class="text-button" data-restore-exploration="${esc(item.id)}">Restaurar</button></div>`).join('')||'<div class="empty-state compact"><strong>Archivo vacío</strong></div>'}</div></aside></div>`;
  }
  if(ui.labTab==='rutinas'){
    const routines=appState.tasks.filter(task=>task.source==='personal'&&task.category==='technique'&&task.status==='active');
    return `<div class="page-grid two"><section class="card pad"><div class="row between wrap"><div><h3>Rutinas técnicas</h3><p class="muted small">Escalas, arpegios, articulación, coordinación o cualquier otra forma organizada de repetir dificultades.</p></div><button class="secondary-button" id="addTechnicalRoutine">＋ Rutina</button></div><div class="task-list mt-18">${routines.map(task=>`<div class="task-row"><span class="task-icon">⌁</span><div class="task-copy"><strong>${esc(task.title)}</strong><span>${esc(task.method)}</span><div class="row wrap mt-10">${statusTag(`${task.frequencyPerWeek||1}× semana`)}${task.bpm?statusTag(`${task.bpm} → ${task.targetBpm||'?'} BPM`):''}</div></div><div class="goal-actions"><button class="secondary-button" data-practice-task="${esc(task.id)}">Practicar</button><button class="icon-button ghost" data-edit-lab-task="${esc(task.id)}">✎</button><button class="icon-button ghost" data-delete-lab-task="${esc(task.id)}">×</button></div></div>`).join('')||'<div class="empty-state"><strong>Sin rutina técnica</strong><p>Podés crear actividades recurrentes y asignarles frecuencia, tempo y criterio de cierre.</p></div>'}</div></section><aside class="card pad soft"><div class="card-header"><div><h3>Rotación real</h3><p>Ya está activa</p></div></div><div class="insight-list mt-18"><div class="insight"><span class="insight-mark"></span><div><strong>Prioridad dinámica</strong><p>Combina frecuencia semanal, días desde la última práctica y prioridad manual.</p></div></div><div class="insight"><span class="insight-mark"></span><div><strong>Edición completa</strong><p>Podés cambiar consigna, tempo, frecuencia, estado y próxima acción.</p></div></div></div></aside></div>`;
  }
  return `<div class="page-grid two"><section class="card pad accent-card"><div class="card-header"><div><h3>Práctica libre</h3><p>Tocá sin plan obligatorio. El tiempo se registra y después decidís si algo merece continuar.</p></div></div><div class="timer-stage mt-18"><div class="timer-value">∞</div><div class="timer-label">sin evaluación automática</div></div><button class="primary-button full mt-18" id="startFreePractice">▶ INICIAR</button></section><aside class="card pad soft"><div class="card-header"><div><h3>Al terminar</h3><p>Se puede registrar, descartar o convertir lo descubierto en un objetivo.</p></div></div><div class="insight-list mt-18"><div class="insight"><span class="insight-mark"></span><div><strong>Tiempo real</strong><p>El cronómetro se pausa y se cierra de forma explícita.</p></div></div><div class="insight"><span class="insight-mark"></span><div><strong>Continuación opcional</strong><p>Una casilla convierte la práctica en una tarea personal editable.</p></div></div></div></aside></div>`;
};

bindLab = function bindLabV1(){
  $$('[data-lab-tab]').forEach(button=>button.addEventListener('click',()=>{ui.labTab=button.dataset.labTab;renderRoute();}));
  $('#addPersonalGoal')?.addEventListener('click',()=>openTaskModal('personal'));
  $('#emptyAddGoal')?.addEventListener('click',()=>openTaskModal('personal'));
  $('#addTechnicalRoutine')?.addEventListener('click',()=>openTaskModal('personal'));
  $('#addExploration')?.addEventListener('click',()=>openExplorationModalV1());
  $('#startFreePractice')?.addEventListener('click',startFreePractice);
  $$('[data-practice-task]').forEach(button=>button.addEventListener('click',()=>{const task=appState.tasks.find(item=>item.id===button.dataset.practiceTask);if(task)startPracticeSession([taskToBlock(task,task.suggestedMinutes||5,'normal')]);}));
  $$('[data-protect-task]').forEach(button=>button.addEventListener('click',async()=>{const task=appState.tasks.find(item=>item.id===button.dataset.protectTask);if(!task)return;task.protected=!task.protected;ui.todayFocus=task.protected?task:ui.todayFocus?.id===task.id?null:ui.todayFocus;await saveState();renderRoute();}));
  $$('[data-edit-lab-task]').forEach(button=>button.addEventListener('click',()=>openTaskModal(null,'',button.dataset.editLabTask)));
  $$('[data-delete-lab-task]').forEach(button=>button.addEventListener('click',()=>confirmDeleteEntity('task',button.dataset.deleteLabTask)));
  $$('[data-convert-exploration]').forEach(button=>button.addEventListener('click',()=>convertExploration(button.dataset.convertExploration)));
  $$('[data-edit-exploration]').forEach(button=>button.addEventListener('click',()=>openExplorationModalV1(button.dataset.editExploration)));
  $$('[data-archive-exploration]').forEach(button=>button.addEventListener('click',async()=>{const item=appState.explorations.find(entry=>entry.id===button.dataset.archiveExploration);if(item){item.status='archived';await saveState();renderRoute();}}));
  $$('[data-restore-exploration]').forEach(button=>button.addEventListener('click',async()=>{const item=appState.explorations.find(entry=>entry.id===button.dataset.restoreExploration);if(item){item.status='idea';await saveState();renderRoute();}}));
  $$('[data-delete-exploration]').forEach(button=>button.addEventListener('click',()=>confirmDeleteEntity('exploration',button.dataset.deleteExploration)));
};

function openExplorationModalV1(id=null){
  const existing=appState.explorations.find(item=>item.id===id);
  openModal({title:existing?'Editar exploración':'Nueva exploración',eyebrow:'Mi laboratorio',body:`<div class="field"><label for="explorationTitle">Idea</label><input id="explorationTitle" value="${esc(existing?.title||'')}" placeholder="Qué te interesa probar o entender" /></div><div class="field mt-14"><label for="explorationNote">Contexto</label><textarea id="explorationNote">${esc(existing?.note||'')}</textarea></div>`,footer:'<button class="secondary-button" data-close-modal>Cancelar</button><button class="primary-button" id="saveExploration">Guardar</button>',onOpen:()=>{$('[data-close-modal]').addEventListener('click',()=>closeModal(true));$('#saveExploration').addEventListener('click',async()=>{const title=$('#explorationTitle').value.trim();if(!title)return toast('Falta la idea');if(existing){existing.title=title;existing.note=$('#explorationNote').value.trim();}else appState.explorations.push({id:uid('exp'),title,note:$('#explorationNote').value.trim(),createdAt:localISO(),status:'idea'});await saveState();closeModal(true);renderRoute();});}});
}

startFreePractice = function startFreePracticeV1(){
  ui.freePractice={startedAt:Date.now(),elapsedBeforePause:0,running:true,timerId:null};
  openModal({title:'Práctica libre',eyebrow:'Mi laboratorio',body:'<div class="timer-stage"><div class="timer-value" id="freeTimer">00:00</div><div class="timer-label">tiempo transcurrido</div></div><div class="field mt-18"><label for="freeLabel">Qué estás tocando</label><input id="freeLabel" placeholder="Opcional" /></div>',footer:'<button class="secondary-button" id="cancelFree">Descartar</button><button class="secondary-button" id="pauseFree">Ⅱ Pausar</button><button class="danger-button" id="finishFree">■ Terminar</button>',onOpen:()=>{
    $('#modalClose').classList.add('hidden');
    const tick=()=>{const elapsed=ui.freePractice.elapsedBeforePause+(ui.freePractice.running?(Date.now()-ui.freePractice.startedAt):0);if($('#freeTimer'))$('#freeTimer').textContent=formatTimer(elapsed/1000);};
    ui.freePractice.timerId=setInterval(tick,250);tick();
    $('#pauseFree').addEventListener('click',()=>{const p=ui.freePractice;if(p.running){p.elapsedBeforePause+=Date.now()-p.startedAt;p.running=false;$('#pauseFree').textContent='▶ Continuar';}else{p.startedAt=Date.now();p.running=true;$('#pauseFree').textContent='Ⅱ Pausar';}});
    $('#cancelFree').addEventListener('click',()=>{clearInterval(ui.freePractice.timerId);ui.freePractice=null;$('#modalClose').classList.remove('hidden');closeModal(true);});
    $('#finishFree').addEventListener('click',finishFreePractice);
  }});
};

finishFreePractice = async function finishFreePracticeV1(){
  const p=ui.freePractice;if(!p)return;clearInterval(p.timerId);if(p.running)p.elapsedBeforePause+=Date.now()-p.startedAt;
  const minutes=Math.max(1,Math.round(p.elapsedBeforePause/60000));const title=$('#freeLabel')?.value.trim()||'Práctica libre';
  $('#modalClose').classList.remove('hidden');closeModal(true);ui.freePractice=null;
  openModal({title:'Cerrar práctica libre',eyebrow:`${minutes} minutos`,body:`<div class="prompt-box"><span>Registro</span><p>${esc(title)}</p></div><div class="field mt-18"><label for="freeReflection">Qué apareció</label><textarea id="freeReflection" placeholder="Opcional"></textarea></div><label class="check-row mt-18"><input id="freeConvert" type="checkbox" /><span><strong>Convertir en objetivo personal</strong><small>Creará una tarea editable de ${minutes} minutos.</small></span></label>`,footer:'<button class="secondary-button" id="discardFreeResult">Descartar</button><button class="primary-button" id="saveFreeResult">Guardar</button>',onOpen:()=>{
    $('#discardFreeResult').addEventListener('click',()=>closeModal(true));
    $('#saveFreeResult').addEventListener('click',async()=>{const note=$('#freeReflection').value.trim();appState.sessions.push({id:uid('session'),date:localISO(),plannedMinutes:minutes,actualMinutes:minutes,mood:'libre',note,type:'free',demo:false,blocks:[{category:'free',source:'personal',title,minutes,result:'achieved',note}]});if($('#freeConvert').checked)appState.tasks.push({id:uid('task'),title,source:'personal',category:'technique',priority:1,suggestedMinutes:Math.min(minutes,20),objective:note||'Continuar explorando y registrar un resultado concreto.',method:'Retomar desde lo que apareció en la práctica libre.',success:'Cerrar con una decisión sobre el siguiente paso.',status:'active',lastPracticed:localISO(),frequencyPerWeek:1,completedThisWeek:1,protected:false,createdAt:localISO(),nextAction:''});await saveState();closeModal(true);renderRoute();toast('Práctica registrada',`${minutes} min`);});
  }});
};


const READING_PC_NAMES = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const READING_LATIN_NAMES = ['Do','Do♯','Re','Re♯','Mi','Fa','Fa♯','Sol','Sol♯','La','La♯','Si'];
const NATURAL_PC_TO_LETTER = {0:0,2:1,4:2,5:3,7:4,9:5,11:6};
const READING_KEY_MAP = {
  z:48,s:49,x:50,d:51,c:52,v:53,g:54,b:55,h:56,n:57,j:58,m:59,
  q:60,'2':61,w:62,'3':63,e:64,r:65,'5':66,t:67,'6':68,y:69,'7':70,u:71,i:72
};

function readingNoteLabel(midi, includeOctave = true) {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const names = appState.profile.noteNaming === 'letters' ? READING_PC_NAMES : READING_LATIN_NAMES;
  return `${names[pc]}${includeOctave ? octave : ''}`;
}

function diatonicIndexForMidi(midi) {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const natural = NATURAL_PC_TO_LETTER[pc];
  if (natural !== undefined) return octave * 7 + natural;
  const lowerPc = [1,3,6,8,10].includes(pc) ? pc - 1 : pc;
  return octave * 7 + (NATURAL_PC_TO_LETTER[lowerPc] ?? 0);
}

function readingRange(clef, level) {
  const treble = [
    [60,67],[60,72],[59,74],[57,76],[55,77],[53,79],[52,81],[50,83],[48,84],[45,88]
  ];
  const bass = [
    [48,55],[45,60],[43,62],[41,64],[40,65],[38,67],[36,69],[35,71],[33,72],[28,76]
  ];
  return (clef === 'bass' ? bass : treble)[clamp(level,1,10)-1];
}

function readingScalePitchClasses(level) {
  if (level <= 3) return [0,2,4,5,7,9,11];
  const options = [
    [0,2,4,5,7,9,11],
    [7,9,11,0,2,4,6],
    [5,7,9,10,0,2,4],
    [2,4,6,7,9,11,1]
  ];
  return options[(level + new Date().getDay()) % options.length];
}

function allowedReadingDurations(level) {
  if (level <= 1) return [1];
  if (level === 2) return [1,2];
  if (level <= 4) return [0.5,1,2];
  if (level <= 6) return [0.5,1,1.5,2];
  return [0.5,0.5,1,1.5,2,3];
}

function generateMeasureRhythm(level) {
  const allowed = allowedReadingDurations(level);
  const values = [];
  let remaining = 4;
  let guard = 0;
  while (remaining > 0.001 && guard < 40) {
    guard += 1;
    const fits = allowed.filter(value => value <= remaining + 0.001 && !(value === 1.5 && remaining < 1.5));
    let value = fits[Math.floor(Math.random() * fits.length)] || remaining;
    if (remaining === 0.5) value = 0.5;
    values.push(value);
    remaining = Number((remaining - value).toFixed(2));
  }
  return values;
}

function generateReadingExercise() {
  const chosenClef = ui.readingClef === 'random' ? (Math.random() < .5 ? 'treble' : 'bass') : ui.readingClef;
  const level = clamp(Number(ui.readingLevel || 2),1,10);
  const measures = clamp(Number(ui.readingMeasures || 2),1,4);
  const [minMidi,maxMidi] = readingRange(chosenClef,level);
  const pitchClasses = readingScalePitchClasses(level);
  const allowedNotes = [];
  for(let midi=minMidi;midi<=maxMidi;midi+=1) if(pitchClasses.includes(midi%12)) allowedNotes.push(midi);
  let noteIndex = Math.floor(allowedNotes.length/2);
  const events=[];
  for(let measure=0;measure<measures;measure+=1){
    let beat=0;
    const durations=generateMeasureRhythm(level);
    durations.forEach(duration=>{
      const maxJump=level<=2?2:level<=5?3:5;
      const jump=Math.floor(Math.random()*(maxJump*2+1))-maxJump;
      noteIndex=clamp(noteIndex+jump,0,allowedNotes.length-1);
      if(Math.random()<.22) noteIndex=clamp(noteIndex+(Math.random()<.5?-1:1),0,allowedNotes.length-1);
      events.push({id:uid('read-note'),midi:allowedNotes[noteIndex],duration,measure,beat,absoluteBeat:measure*4+beat});
      beat+=duration;
    });
  }
  return {id:uid('exercise'),createdAt:new Date().toISOString(),clef:chosenClef,level,measures,tempo:Number(ui.readingTempo||60),withPulse:Boolean(ui.readingPulse),events};
}

function staffYForMidi(midi,clef) {
  const bottomDiatonic = clef==='bass' ? (2*7+4) : (4*7+2); // G2 o E4
  const step=6.5;
  return 132-(diatonicIndexForMidi(midi)-bottomDiatonic)*step;
}

function renderLedgerLines(midi,clef,x) {
  const y=staffYForMidi(midi,clef);
  const lines=[];
  if(y>132){for(let ly=145;ly<=y+2;ly+=13)lines.push(`<line x1="${x-11}" x2="${x+11}" y1="${ly}" y2="${ly}" class="ledger-line"/>`);}
  if(y<80){for(let ly=67;ly>=y-2;ly-=13)lines.push(`<line x1="${x-11}" x2="${x+11}" y1="${ly}" y2="${ly}" class="ledger-line"/>`);}
  return lines.join('');
}

function renderStaff(exercise,currentIndex=-1) {
  const measureWidth=230;
  const width=120+exercise.measures*measureWidth;
  const lines=[80,93,106,119,132];
  const notes=exercise.events.map((event,index)=>{
    const x=110+event.measure*measureWidth+(event.beat/4)*measureWidth+18;
    const y=staffYForMidi(event.midi,exercise.clef);
    const pc=event.midi%12;
    const accidental=[1,3,6,8,10].includes(pc)?'<text class="accidental" x="'+(x-19)+'" y="'+(y+5)+'">♯</text>':'';
    const open=event.duration>=2;
    const stem=event.duration<4?`<line x1="${x+6}" x2="${x+6}" y1="${y}" y2="${y-32}" class="note-stem"/>`:'';
    const flag=event.duration===0.5?`<path d="M ${x+6} ${y-32} q 18 8 5 23" class="note-flag"/>`:'';
    const dot=[1.5,3].includes(event.duration)?`<circle cx="${x+13}" cy="${y}" r="2.2" class="note-dot"/>`:'';
    return `<g class="staff-note ${index===currentIndex?'current':''} ${index<currentIndex?'done':''}" data-staff-index="${index}">${renderLedgerLines(event.midi,exercise.clef,x)}${accidental}<ellipse cx="${x}" cy="${y}" rx="7" ry="5" transform="rotate(-18 ${x} ${y})" class="note-head ${open?'open':''}"/>${stem}${flag}${dot}</g>`;
  }).join('');
  const bars=Array.from({length:exercise.measures+1},(_,index)=>{const x=105+index*measureWidth;return `<line x1="${x}" x2="${x}" y1="80" y2="132" class="bar-line"/>`;}).join('');
  return `<div class="staff-scroll"><svg class="music-staff" viewBox="0 0 ${width} 205" width="${width}" height="205" role="img" aria-label="Ejercicio de lectura">${lines.map(y=>`<line x1="16" x2="${width-12}" y1="${y}" y2="${y}" class="staff-line"/>`).join('')}<text class="clef-symbol" x="23" y="128">${exercise.clef==='bass'?'𝄢':'𝄞'}</text><text class="time-signature" x="76" y="104">4</text><text class="time-signature" x="76" y="130">4</text>${bars}${notes}</svg></div>`;
}

function buildPiano88() {
  const whites=[];const blacks=[];let whiteIndex=0;
  for(let midi=21;midi<=108;midi+=1){
    const pc=midi%12;const isBlack=[1,3,6,8,10].includes(pc);
    if(!isBlack){whites.push({midi,index:whiteIndex});whiteIndex+=1;}
    else blacks.push({midi,left:whiteIndex*32-10});
  }
  const expected=ui.readingRun?.active?ui.readingExercise?.events?.[ui.readingRun.index]?.midi:null;
  return `<div class="piano-88-scroll" id="readingKeyboardScroller"><div class="piano-88" style="width:${whites.length*32}px">${whites.map(key=>`<button class="piano88-white ${key.midi===expected?'expected':''} ${ui.readingKeyFlash?.midi===key.midi?ui.readingKeyFlash.kind:''}" data-reading-midi="${key.midi}"><span>${ui.readingKeyboardLabels||key.midi%12===0?readingNoteLabel(key.midi):''}</span></button>`).join('')}${blacks.map(key=>`<button class="piano88-black ${key.midi===expected?'expected':''} ${ui.readingKeyFlash?.midi===key.midi?ui.readingKeyFlash.kind:''}" style="left:${key.left}px" data-reading-midi="${key.midi}"><span>${ui.readingKeyboardLabels?readingNoteLabel(key.midi):''}</span></button>`).join('')}</div></div>`;
}

function readingAccuracyLabel(result){return result?`${result.accuracy}% notas${result.pulse?` · ${result.rhythm}% ritmo`:''}`:'Sin resultado';}

function renderReading() {
  const profile=appState.readingProfile;
  const exercise=ui.readingExercise;
  const run=ui.readingRun;
  const currentIndex=run?.index??-1;
  const attempts=[...appState.readingAttempts].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  return `<div class="page-grid">
    <section class="card pad accent-card"><div class="row between wrap"><div><span class="eyebrow">Lectura a primera vista</span><h2 class="mt-10">Leer, tocar y seguir adelante</h2><p class="muted small">Ejercicios generados, teclado completo de 88 teclas, entrada por mouse, teclado de computadora o MIDI. Por fin una sección que no finge existir.</p></div><div class="row wrap">${statusTag(`${profile.totalExercises} ejercicios`,profile.totalExercises?'success':'')}${statusTag(`${profile.bestAccuracy||0}% mejor precisión`)}${statusTag(`Sol ${profile.trebleLevel} · Fa ${profile.bassLevel}`)}</div></div></section>
    <div class="page-grid two">
      <section class="page-section">
        <div class="section-header"><div><h2>Ejercicio</h2><p>Configurá pocas variables, mirá antes de tocar y no vuelvas atrás después de un error.</p></div></div>
        <div class="card pad">
          <div class="field-grid three">
            <div class="field"><label for="readingClef">Clave</label><select id="readingClef"><option value="treble" ${ui.readingClef==='treble'?'selected':''}>Sol</option><option value="bass" ${ui.readingClef==='bass'?'selected':''}>Fa</option><option value="random" ${ui.readingClef==='random'?'selected':''}>Alternada</option></select></div>
            <div class="field"><label for="readingLevel">Nivel</label><select id="readingLevel">${Array.from({length:10},(_,i)=>`<option value="${i+1}" ${ui.readingLevel===i+1?'selected':''}>${i+1}</option>`).join('')}</select></div>
            <div class="field"><label for="readingMeasures">Compases</label><select id="readingMeasures">${[1,2,3,4].map(value=>`<option value="${value}" ${ui.readingMeasures===value?'selected':''}>${value}</option>`).join('')}</select></div>
            <div class="field"><label for="readingTempo">Tempo</label><input id="readingTempo" type="number" min="35" max="140" value="${ui.readingTempo}" /></div>
            <div class="field"><label for="readingPulse">Evaluación</label><select id="readingPulse"><option value="free" ${!ui.readingPulse?'selected':''}>Solo notas</option><option value="pulse" ${ui.readingPulse?'selected':''}>Notas y pulso</option></select></div>
            <div class="field"><label for="readingLabels">Nombres en teclas</label><select id="readingLabels"><option value="no" ${!ui.readingKeyboardLabels?'selected':''}>Ocultos</option><option value="yes" ${ui.readingKeyboardLabels?'selected':''}>Visibles</option></select></div>
          </div>
          <div class="row wrap mt-18"><button class="primary-button" id="generateReading">Generar ejercicio</button><button class="secondary-button" id="connectMidi">${ui.readingMidiStatus==='connected'?'MIDI conectado':ui.readingMidiStatus==='unsupported'?'MIDI no disponible':'Conectar MIDI'}</button><button class="secondary-button" id="addReadingToPlan">＋ Agregar al plan de hoy</button></div>
        </div>
        ${exercise?`<div class="card pad reading-card"><div class="row between wrap"><div><span class="eyebrow">${exercise.clef==='bass'?'Clave de Fa':'Clave de Sol'} · nivel ${exercise.level}</span><h3 class="mt-10">${exercise.measures} compás${exercise.measures===1?'':'es'} · ${exercise.tempo} BPM</h3></div><div class="row wrap"><button class="secondary-button" id="hearReading">▶ Escuchar</button>${run?`<button class="danger-button" id="stopReading">Detener</button>`:`<button class="primary-button" id="startReading">${exercise.withPulse?'Cuenta y empezar':'Empezar'}</button>`}</div></div><div id="readingStatus" class="reading-status ${run?.active?'active':''}">${run?.countdown?`Cuenta: ${run.countdown}`:run?.active?`Nota ${run.index+1} de ${exercise.events.length}`:'Mirá clave, compás, nota inicial y dirección antes de empezar.'}</div>${renderStaff(exercise,currentIndex)}${buildPiano88()}<div class="keyboard-help">Teclado de computadora: Z–M para Do3–Si3 y Q–I para Do4–Do5. El navegador también acepta MIDI cuando el entorno lo permite.</div></div>`:''}
        ${ui.readingResult?renderReadingResult(ui.readingResult):''}
      </section>
      <aside class="page-section"><div class="section-header"><div><h2>Historial reciente</h2><p>Los errores se separan por clave, notas y pulso.</p></div></div><div class="card pad"><div class="task-list">${attempts.map(attempt=>`<div class="task-row"><span class="task-icon">𝄞</span><div class="task-copy"><strong>${attempt.clef==='bass'?'Clave de Fa':'Clave de Sol'} · nivel ${attempt.level}</strong><span>${formatDate(attempt.date,{day:'numeric',month:'short'})} · ${attempt.events} notas</span><div class="row wrap mt-10">${statusTag(`${attempt.accuracy}% notas`,attempt.accuracy>=85?'success':attempt.accuracy<60?'warning':'')}${attempt.pulse?statusTag(`${attempt.rhythm}% ritmo`):''}</div></div></div>`).join('')||'<div class="empty-state"><strong>Sin ejercicios todavía</strong><p>Generá uno. El pentagrama lleva siglos esperando que alguien le haga clic.</p></div>'}</div></div><div class="card pad soft"><div class="card-header"><div><h3>Cómo progresa</h3><p>Una variable por vez</p></div></div><div class="insight-list mt-18"><div class="insight"><span class="insight-mark"></span><div><strong>Dos resultados sólidos</strong><p>La recomendación de nivel puede subir.</p></div></div><div class="insight"><span class="insight-mark"></span><div><strong>Precisión baja</strong><p>Reduce rango o ritmo antes de acelerar.</p></div></div><div class="insight"><span class="insight-mark"></span><div><strong>Clave separada</strong><p>Sol y Fa mantienen niveles independientes.</p></div></div></div></div></aside>
    </div>
  </div>`;
}

function renderReadingResult(result){
  return `<div class="card pad result-summary"><div class="row between wrap"><div><span class="eyebrow">Resultado</span><h3 class="mt-10">${readingAccuracyLabel(result)}</h3></div><div class="row wrap">${statusTag(`${result.correct}/${result.correct+result.wrong} intentos correctos`,result.accuracy>=85?'success':'')}${statusTag(`${result.durationSeconds}s`)}</div></div><div class="kpi-grid mt-18"><div class="card soft kpi-card"><div class="kpi-label">Notas</div><div class="kpi-value">${result.accuracy}%</div></div><div class="card soft kpi-card"><div class="kpi-label">Ritmo</div><div class="kpi-value">${result.pulse?`${result.rhythm}%`:'—'}</div></div><div class="card soft kpi-card"><div class="kpi-label">Errores</div><div class="kpi-value">${result.wrong}</div></div><div class="card soft kpi-card"><div class="kpi-label">Nivel</div><div class="kpi-value">${result.level}</div></div></div><div class="prompt-box mt-18"><span>Recomendación</span><p>${esc(result.recommendation)}</p></div><div class="row wrap mt-18">${ui.readingSessionPendingResult?'<button class="primary-button" id="returnToPracticeFromReading">Continuar sesión</button>':'<button class="secondary-button" id="repeatReading">Otro ejercicio similar</button>'}</div></div>`;
}


bindReading = function bindReadingV1(){
  const saveConfig=async()=>{
    ui.readingClef=$('#readingClef')?.value||ui.readingClef;
    ui.readingLevel=Number($('#readingLevel')?.value||ui.readingLevel);
    ui.readingMeasures=Number($('#readingMeasures')?.value||ui.readingMeasures);
    ui.readingTempo=clamp(Number($('#readingTempo')?.value||ui.readingTempo),35,140);
    ui.readingPulse=$('#readingPulse')?.value==='pulse';
    ui.readingKeyboardLabels=$('#readingLabels')?.value==='yes';
    Object.assign(appState.readingSettings,{clef:ui.readingClef,level:ui.readingLevel,measures:ui.readingMeasures,tempo:ui.readingTempo,withPulse:ui.readingPulse,labels:ui.readingKeyboardLabels});
    await saveState();
  };
  ['readingClef','readingLevel','readingMeasures','readingTempo','readingPulse','readingLabels'].forEach(id=>$('#'+id)?.addEventListener('change',saveConfig));
  $('#generateReading')?.addEventListener('click',async()=>{await saveConfig();stopReadingExercise(false);ui.readingResult=null;ui.readingExercise=generateReadingExercise();renderRoute();setTimeout(scrollToExpectedKey,80);});
  $('#startReading')?.addEventListener('click',startReadingExercise);
  $('#stopReading')?.addEventListener('click',()=>stopReadingExercise(true));
  $('#hearReading')?.addEventListener('click',playReadingExercise);
  $('#connectMidi')?.addEventListener('click',connectReadingMidi);
  $('#addReadingToPlan')?.addEventListener('click',addReadingBlockToPlan);
  $$('[data-reading-midi]').forEach(key=>key.addEventListener('pointerdown',event=>{event.preventDefault();handleReadingInput(Number(key.dataset.readingMidi),'screen');}));
  $('#repeatReading')?.addEventListener('click',()=>{ui.readingResult=null;ui.readingExercise=generateReadingExercise();renderRoute();});
  $('#returnToPracticeFromReading')?.addEventListener('click',returnToPracticeFromReading);
  setTimeout(scrollToExpectedKey,60);
};

function startReadingExercise(){
  if(!ui.readingExercise)ui.readingExercise=generateReadingExercise();
  stopMetronome();
  const exercise=ui.readingExercise;
  const beatMs=60000/exercise.tempo;
  ui.readingResult=null;
  ui.readingRun={index:0,correct:0,wrong:0,hits:[],startedAt:null,active:!exercise.withPulse,countdown:exercise.withPulse?4:null,beatMs,timers:[],sourceErrors:{},lastInputAt:null};
  if(exercise.withPulse){
    for(let i=0;i<4;i+=1){
      const timer=setTimeout(()=>{
        if(!ui.readingRun)return;
        ui.readingRun.countdown=4-i;
        playClick(i===0?1200:930,.05);
        const status=$('#readingStatus');if(status)status.textContent=`Cuenta: ${4-i}`;
      },i*beatMs);
      ui.readingRun.timers.push(timer);
    }
    const startTimer=setTimeout(()=>{
      if(!ui.readingRun)return;
      ui.readingRun.active=true;ui.readingRun.countdown=null;ui.readingRun.startedAt=performance.now();
      startMetronome(exercise.tempo);renderRoute();scrollToExpectedKey();
    },4*beatMs);
    ui.readingRun.timers.push(startTimer);
  }else{
    ui.readingRun.startedAt=performance.now();renderRoute();scrollToExpectedKey();
  }
}

function stopReadingExercise(render=true){
  if(ui.readingRun?.timers)ui.readingRun.timers.forEach(clearTimeout);
  ui.readingRun=null;stopMetronome();
  if(render)renderRoute();
}

function flashReadingKey(midi,kind){
  ui.readingKeyFlash={midi,kind};
  const key=document.querySelector(`[data-reading-midi="${midi}"]`);if(key){key.classList.add(kind);setTimeout(()=>key.classList.remove(kind),280);}
  setTimeout(()=>{if(ui.readingKeyFlash?.midi===midi)ui.readingKeyFlash=null;},320);
}

function handleReadingInput(midi,source='screen'){
  if(!Number.isFinite(midi))return;
  playMidiNote(midi,.36);
  const run=ui.readingRun;const exercise=ui.readingExercise;
  if(!run||!exercise||!run.active){flashReadingKey(midi,'played');return;}
  const expected=exercise.events[run.index];if(!expected)return;
  const now=performance.now();
  if(midi!==expected.midi){
    run.wrong+=1;run.sourceErrors[source]=(run.sourceErrors[source]||0)+1;flashReadingKey(midi,'wrong');
    const status=$('#readingStatus');if(status)status.textContent=`Esperaba ${readingNoteLabel(expected.midi)}. Seguí desde la misma nota.`;
    return;
  }
  const expectedAt=exercise.withPulse?run.startedAt+expected.absoluteBeat*run.beatMs:null;
  run.hits.push({midi,expectedMidi:expected.midi,timingError:expectedAt===null?null:now-expectedAt,source});
  run.correct+=1;run.index+=1;run.lastInputAt=now;flashReadingKey(midi,'correct');
  if(run.index>=exercise.events.length){finishReadingExercise();return;}
  renderRoute();scrollToExpectedKey();
}

async function finishReadingExercise(){
  const run=ui.readingRun;const exercise=ui.readingExercise;if(!run||!exercise)return;
  stopMetronome();if(run.timers)run.timers.forEach(clearTimeout);
  const totalAttempts=run.correct+run.wrong;
  const accuracy=Math.round(run.correct/Math.max(1,totalAttempts)*100);
  const timing=run.hits.map(hit=>hit.timingError).filter(value=>value!==null);
  const avgTiming=timing.length?timing.reduce((sum,value)=>sum+Math.abs(value),0)/timing.length:0;
  const rhythm=exercise.withPulse?clamp(Math.round(100-(avgTiming/(run.beatMs*.8))*100),0,100):null;
  const durationSeconds=Math.max(1,Math.round((performance.now()-(run.startedAt||performance.now()))/1000));
  let recommendation='Mantené el nivel y buscá continuidad antes de ampliar el rango.';
  if(accuracy>=90&&(!exercise.withPulse||rhythm>=75))recommendation='Resultado sólido. Podés subir un nivel o mantenerlo y aumentar un poco el tempo.';
  else if(accuracy<70)recommendation='Reducí un nivel o un compás. Mirá primero la dirección y los intervalos, no cada nota como un trámite aislado.';
  else if(exercise.withPulse&&rhythm<60)recommendation='Las notas están apareciendo, pero el pulso necesita margen. Bajá 8–12 BPM y repetí sin detenerte.';
  const result={id:uid('read-attempt'),date:localISO(),timestamp:new Date().toISOString(),clef:exercise.clef,level:exercise.level,measures:exercise.measures,tempo:exercise.tempo,pulse:exercise.withPulse,events:exercise.events.length,correct:run.correct,wrong:run.wrong,accuracy,rhythm,durationSeconds,recommendation};
  appState.readingAttempts.push(result);
  const profile=appState.readingProfile;profile.totalExercises+=1;profile.correctNotes+=run.correct;profile.attemptedNotes+=totalAttempts;profile.bestAccuracy=Math.max(profile.bestAccuracy||0,accuracy);
  const key=exercise.clef==='bass'?'bassLevel':'trebleLevel';
  const recent=appState.readingAttempts.filter(item=>item.clef===exercise.clef).slice(-3);
  const avg=recent.reduce((sum,item)=>sum+item.accuracy,0)/recent.length;
  if(recent.length>=2&&avg>=90)profile[key]=clamp(Math.max(profile[key]||1,exercise.level+1),1,10);
  if(recent.length>=2&&avg<60)profile[key]=clamp(Math.min(profile[key]||exercise.level,exercise.level-1),1,10);
  ui.readingResult=result;ui.readingRun=null;
  if(ui.readingSessionContext){ui.readingSessionPendingResult=result;ui.readingSessionContext=false;}
  await saveState();renderRoute();
}

function playReadingExercise(){
  const exercise=ui.readingExercise;if(!exercise)return;
  const beatSeconds=60/exercise.tempo;
  exercise.events.forEach(event=>playMidiNote(event.midi,Math.max(.12,event.duration*beatSeconds*.78),event.absoluteBeat*beatSeconds));
}

async function connectReadingMidi(){
  if(!navigator.requestMIDIAccess){ui.readingMidiStatus='unsupported';renderRoute();return toast('MIDI no disponible','Probá Chrome o Edge desde HTTPS o localhost.');}
  try{
    const access=await navigator.requestMIDIAccess();ui.readingMidiAccess=access;ui.readingMidiStatus='connected';
    const bindInputs=()=>{for(const input of access.inputs.values())input.onmidimessage=event=>{const [status,note,velocity]=event.data;if((status&0xf0)===0x90&&velocity>0)handleReadingInput(note,'midi');};};
    bindInputs();access.onstatechange=bindInputs;renderRoute();toast('MIDI conectado',`${access.inputs.size} entrada${access.inputs.size===1?'':'s'} detectada${access.inputs.size===1?'':'s'}.`);
  }catch(error){ui.readingMidiStatus='unsupported';renderRoute();toast('No se pudo conectar MIDI','El navegador rechazó el acceso o el entorno no es seguro.');}
}

function scrollToExpectedKey(){
  const midi=ui.readingRun?.active?ui.readingExercise?.events?.[ui.readingRun.index]?.midi:ui.readingExercise?.events?.[0]?.midi;
  if(!midi)return;const key=document.querySelector(`[data-reading-midi="${midi}"]`);const scroller=$('#readingKeyboardScroller');
  if(key&&scroller){const left=key.offsetLeft-scroller.clientWidth/2+key.offsetWidth/2;scroller.scrollTo({left:Math.max(0,left),behavior:'smooth'});}
}

function addReadingBlockToPlan(){
  const block={id:uid('block'),title:'Lectura a primera vista',source:'app',category:'reading',duration:5,instruction:`${ui.readingClef==='bass'?'Clave de Fa':ui.readingClef==='random'?'Clave alternada':'Clave de Sol'}, nivel ${ui.readingLevel}, ${ui.readingMeasures} compases.`,success:'Completar un ejercicio y revisar precisión y continuidad.',readingConfig:{clef:ui.readingClef,level:ui.readingLevel,measures:ui.readingMeasures,tempo:ui.readingTempo,withPulse:ui.readingPulse}};
  const closingIndex=ui.currentPlan.findIndex(item=>item.category==='closing');
  if(closingIndex>=0)ui.currentPlan.splice(closingIndex,0,block);else ui.currentPlan.push(block);
  ui.duration=ui.currentPlan.reduce((sum,item)=>sum+Number(item.duration||0),0);planDraftSave();setRoute('hoy');toast('Lectura agregada',`El plan ahora dura ${ui.duration} minutos.`);
}

function returnToPracticeFromReading(){
  const result=ui.readingSessionPendingResult;if(!result)return;
  ui.readingSessionPendingResult=null;
  const outcome=result.accuracy>=80&&(!result.pulse||result.rhythm>=60)?'achieved':'partial';
  recordBlockResult(outcome,`Lectura: ${result.accuracy}% notas${result.pulse?`, ${result.rhythm}% ritmo`:''}.`);
}

function handleGlobalReadingKeyboard(event){
  if(event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;
  const tag=document.activeElement?.tagName;if(['INPUT','TEXTAREA','SELECT'].includes(tag))return;
  const midi=READING_KEY_MAP[event.key.toLowerCase()];if(midi&&ui.route==='lectura'){event.preventDefault();handleReadingInput(midi,'computer');}
}


openTheoryLesson = function openTheoryLessonV1(id){
  const lesson=THEORY_LESSONS.find(item=>item.id===id);if(!lesson)return;
  const done=appState.theoryProgress.completedLessons.includes(id);
  openModal({title:lesson.title,eyebrow:`${lesson.path} · ${lesson.minutes} min`,wide:true,body:`<div class="page-grid equal"><div class="stack"><div class="prompt-box"><span>Por qué importa</span><p>${esc(lesson.why)}</p></div><div class="card pad soft"><div class="card-header"><div><h3>De dónde sale</h3></div></div><p class="muted small">${esc(lesson.core)}</p></div><div class="card pad soft"><div class="card-header"><div><h3>Ejemplo</h3></div></div><p class="muted small">${esc(lesson.example)}</p></div></div><div class="stack"><div class="card pad accent-card"><div class="card-header"><div><h3>Prueba en el piano</h3><p>La teoría se valida produciendo sonido, pequeño detalle que ciertos manuales olvidan.</p></div></div><p class="muted small mt-18">${esc(lesson.practice)}</p><button class="secondary-button full mt-18" id="lessonPlayReference">▶ Escuchar referencia simple</button></div><div class="insight-list"><div class="insight"><span class="insight-mark"></span><div><strong>Describí</strong><p>Explicá la relación sin mirar el texto.</p></div></div><div class="insight"><span class="insight-mark"></span><div><strong>Construí</strong><p>Tocá un ejemplo desde al menos dos raíces.</p></div></div><div class="insight"><span class="insight-mark"></span><div><strong>Aplicá</strong><p>Usalo durante un minuto en una improvisación o una obra.</p></div></div></div></div></div>`,footer:`<button class="secondary-button" data-close-modal>Cerrar</button><button class="secondary-button" id="addLessonToPlan">＋ Al plan de hoy</button><button class="primary-button" id="completeLesson">${done?'Marcar pendiente':'Marcar completada'}</button>`,onOpen:()=>{
    $('[data-close-modal]').addEventListener('click',()=>{ui.theorySessionContext=null;closeModal(true);});
    $('#lessonPlayReference').addEventListener('click',()=>{const sequences={intervals:[60,64,67], 'major-scale':[60,62,64,65,67,69,71,72],triads:[60,64,67,62,65,69],functions:[60,64,67,65,69,72,67,71,74,60,64,67],circle:[60,67,62,69],subdivision:[60,60,60,60],'minor-scales':[57,59,60,62,64,65,68,69],modes:[62,64,65,67,69,71,72,74]};playNoteSequence(sequences[id]||[60,64,67],.32);});
    $('#addLessonToPlan').addEventListener('click',()=>{const block={id:uid('block'),title:`Teoría · ${lesson.title}`,source:'app',category:'theory',duration:lesson.minutes,instruction:`${lesson.core} ${lesson.practice}`,success:'Explicarlo con tus palabras y tocar un ejemplo.',lessonId:id};const closing=ui.currentPlan.findIndex(item=>item.category==='closing');if(closing>=0)ui.currentPlan.splice(closing,0,block);else ui.currentPlan.push(block);ui.duration=ui.currentPlan.reduce((sum,item)=>sum+Number(item.duration||0),0);planDraftSave();closeModal(true);setRoute('hoy');toast('Lección agregada al plan');});
    $('#completeLesson').addEventListener('click',async()=>{const list=appState.theoryProgress.completedLessons;if(list.includes(id))appState.theoryProgress.completedLessons=list.filter(item=>item!==id);else list.push(id);await saveState();closeModal(true);if(ui.theorySessionContext===id){ui.theorySessionContext=null;await recordBlockResult('achieved',`Lección completada: ${lesson.title}.`);}else renderRoute();});
  }});
};

bindTheory = function bindTheoryV1(){
  OLD_BIND_THEORY();
};


renderProgress = function renderProgressV1(){
  const sessions=[...appState.sessions].sort((a,b)=>(b.timestamp||b.startedAt||b.date).localeCompare(a.timestamp||a.startedAt||a.date));
  const totalMinutes=sessions.reduce((sum,item)=>sum+Number(item.actualMinutes||0),0);
  const blocks=sessions.flatMap(item=>item.blocks||[]);const achieved=blocks.filter(block=>block.result==='achieved').length;
  const activeWeeks=new Set(sessions.map(session=>localISO(getCurrentCycle(parseISO(session.date)).start))).size;
  const lastSeven=Array.from({length:7},(_,index)=>{const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()-(6-index));const iso=localISO(date);return{date,minutes:sessionsForDate(iso).reduce((sum,s)=>sum+Number(s.actualMinutes||0),0)};});
  const maxDay=Math.max(1,...lastSeven.map(item=>item.minutes));const categoryMinutes={};blocks.forEach(block=>categoryMinutes[block.category]=(categoryMinutes[block.category]||0)+Number(block.minutes||0));const maxCategory=Math.max(1,...Object.values(categoryMinutes));
  const reading=appState.readingProfile;
  return `<div class="page-grid">
    <div class="row between wrap"><div><span class="eyebrow">Histórico real</span><h2 class="mt-10">Progreso</h2></div><div class="row wrap"><button class="secondary-button" id="manualSession">＋ Registrar práctica manual</button><button class="secondary-button" id="exportProgressCsv">Exportar CSV</button></div></div>
    <div class="kpi-grid"><div class="card kpi-card"><div class="kpi-label">Tiempo acumulado</div><div class="kpi-value">${minutesLabel(totalMinutes)}</div><div class="kpi-note">${sessions.length} sesiones</div></div><div class="card kpi-card"><div class="kpi-label">Bloques logrados</div><div class="kpi-value">${achieved}</div><div class="kpi-note">de ${blocks.length}</div></div><div class="card kpi-card"><div class="kpi-label">Lectura</div><div class="kpi-value">${reading.totalExercises}</div><div class="kpi-note">mejor ${reading.bestAccuracy||0}%</div></div><div class="card kpi-card"><div class="kpi-label">Teoría</div><div class="kpi-value">${appState.theoryProgress.completedLessons.length}/${THEORY_LESSONS.length}</div><div class="kpi-note">lecciones</div></div></div>
    <div class="page-grid two"><section class="card pad"><div class="card-header"><div><h3>Últimos siete días</h3><p>Minutos reales por día.</p></div>${statusTag(`${lastSeven.reduce((s,i)=>s+i.minutes,0)} min`)}</div><div class="chart">${lastSeven.map(item=>`<div class="chart-column"><div class="chart-bar" title="${item.minutes} min" style="height:${Math.max(4,percent(item.minutes,maxDay))}%"></div><span class="chart-label">${formatDate(item.date,{weekday:'short'})}</span></div>`).join('')}</div></section><aside class="card pad"><div class="card-header"><div><h3>Distribución por categoría</h3><p>En qué se fue el tiempo registrado.</p></div></div><div class="stack mt-18">${Object.entries(categoryMinutes).sort((a,b)=>b[1]-a[1]).map(([category,minutes])=>`<div><div class="row between"><span class="small">${esc(CATEGORY_LABELS[category]||category)}</span><strong class="small">${minutes} min</strong></div><div class="progress-bar mt-10"><span style="width:${percent(minutes,maxCategory)}%"></span></div></div>`).join('')||'<div class="empty-state"><strong>Sin datos</strong><p>Completá una sesión o cargá una práctica manual.</p></div>'}</div></aside></div>
    <div class="page-grid two"><section class="card pad"><div class="card-header"><div><h3>Lectura del progreso</h3><p>Observaciones derivadas del historial.</p></div></div><div class="insight-list mt-18">${progressInsights(sessions,categoryMinutes).map(item=>`<div class="insight"><span class="insight-mark"></span><div><strong>${esc(item.title)}</strong><p>${esc(item.text)}</p></div></div>`).join('')}${appState.readingAttempts.length?`<div class="insight"><span class="insight-mark"></span><div><strong>Lectura</strong><p>${appState.readingAttempts.length} ejercicios. Nivel recomendado: Sol ${reading.trebleLevel}, Fa ${reading.bassLevel}.</p></div></div>`:''}<div class="insight"><span class="insight-mark"></span><div><strong>Continuidad</strong><p>${activeWeeks} semana${activeWeeks===1?'':'s'} activa${activeWeeks===1?'':'s'} desde el primer registro.</p></div></div></div></section><aside class="card pad soft"><div class="card-header"><div><h3>Historial</h3><p>Seleccioná una sesión para verla, editarla o eliminarla.</p></div></div><div class="timeline-list mt-18">${sessions.slice(0,20).map(session=>`<button class="task-row interactive" data-session-detail="${esc(session.id)}"><span class="task-icon">${session.type==='improvisation'?'≈':session.type==='free'?'∞':session.type==='manual'?'＋':'▶'}</span><div class="task-copy"><strong>${formatDate(session.date,{weekday:'short',day:'numeric',month:'short'})}</strong><span>${esc(session.blocks?.map(block=>block.title).slice(0,2).join(' · ')||'Sesión')}</span><div class="row wrap mt-10">${statusTag(session.mood||'registrada')}</div></div><span class="task-meta">${session.actualMinutes} min</span></button>`).join('')||'<div class="empty-state"><strong>Sin sesiones</strong><p>El historial está vacío. Por una vez, la base de datos no está escondiendo nada.</p></div>'}</div></aside></div>
  </div>`;
};

bindProgress = function bindProgressV1(){
  $$('[data-session-detail]').forEach(button=>button.addEventListener('click',()=>openSessionDetail(button.dataset.sessionDetail)));
  $('#manualSession')?.addEventListener('click',openManualSessionModal);
  $('#exportProgressCsv')?.addEventListener('click',exportProgressCsv);
};

function openSessionDetail(id){
  const session=appState.sessions.find(item=>item.id===id);if(!session)return;
  openModal({title:`Sesión · ${formatDate(session.date,{day:'numeric',month:'long',year:'numeric'})}`,eyebrow:`${session.actualMinutes} min · ${session.type||'practice'}`,wide:true,body:`<div class="field-grid"><div class="field"><label for="detailSessionDate">Fecha</label><input id="detailSessionDate" type="date" value="${session.date}" /></div><div class="field"><label for="detailSessionMood">Sensación</label><select id="detailSessionMood">${['frustrante','difícil','correcta','buena','muy buena','libre'].map(value=>`<option value="${value}" ${session.mood===value?'selected':''}>${capitalize(value)}</option>`).join('')}</select></div><div class="field span-2"><label for="detailSessionNote">Nota general</label><textarea id="detailSessionNote">${esc(session.note||'')}</textarea></div></div><div class="divider"></div><div class="task-list">${(session.blocks||[]).map(block=>`<div class="task-row"><span class="task-icon">${block.result==='achieved'?'✓':block.result==='blocked'?'!':'·'}</span><div class="task-copy"><strong>${esc(block.title)}</strong><span>${esc(block.note||CATEGORY_LABELS[block.category]||block.category||'')}</span><div class="row wrap mt-10">${statusTag(block.result||'registrado',block.result==='achieved'?'success':block.result==='blocked'?'warning':'')}${statusTag(`${block.minutes||0} min`)}</div></div></div>`).join('')||'<div class="empty-state"><strong>Sin bloques detallados</strong></div>'}</div>`,footer:'<button class="danger-button" id="deleteSessionDetail">Eliminar</button><button class="secondary-button" data-close-modal>Cerrar</button><button class="primary-button" id="saveSessionDetail">Guardar cambios</button>',onOpen:()=>{
    $('[data-close-modal]').addEventListener('click',()=>closeModal(true));
    $('#deleteSessionDetail').addEventListener('click',()=>{closeModal(true);confirmDeleteEntity('session',id);});
    $('#saveSessionDetail').addEventListener('click',async()=>{session.date=$('#detailSessionDate').value||session.date;session.mood=$('#detailSessionMood').value;session.note=$('#detailSessionNote').value.trim();await saveState();closeModal(true);renderRoute();toast('Sesión actualizada');});
  }});
}

function openManualSessionModal(){
  openModal({title:'Registrar práctica manual',eyebrow:'Progreso',body:`<div class="field-grid"><div class="field"><label for="manualDate">Fecha</label><input id="manualDate" type="date" value="${localISO()}" /></div><div class="field"><label for="manualMinutes">Minutos</label><input id="manualMinutes" type="number" min="1" max="360" value="20" /></div><div class="field"><label for="manualCategory">Categoría</label><select id="manualCategory">${Object.entries(CATEGORY_LABELS).filter(([key])=>!['warmup','closing'].includes(key)).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></div><div class="field"><label for="manualMood">Sensación</label><select id="manualMood"><option>correcta</option><option>buena</option><option>muy buena</option><option>difícil</option><option>frustrante</option><option>libre</option></select></div><div class="field span-2"><label for="manualTitle">Qué practicaste</label><input id="manualTitle" placeholder="Obra, técnica, clase, improvisación..." /></div><div class="field span-2"><label for="manualNote">Observación</label><textarea id="manualNote"></textarea></div></div>`,footer:'<button class="secondary-button" data-close-modal>Cancelar</button><button class="primary-button" id="saveManualSession">Guardar</button>',onOpen:()=>{$('[data-close-modal]').addEventListener('click',()=>closeModal(true));$('#saveManualSession').addEventListener('click',async()=>{const title=$('#manualTitle').value.trim();if(!title)return toast('Falta qué practicaste');const minutes=clamp(Number($('#manualMinutes').value)||1,1,360);appState.sessions.push({id:uid('session'),date:$('#manualDate').value||localISO(),plannedMinutes:minutes,actualMinutes:minutes,mood:$('#manualMood').value,note:$('#manualNote').value.trim(),type:'manual',demo:false,blocks:[{category:$('#manualCategory').value,source:'personal',title,minutes,result:'achieved',note:$('#manualNote').value.trim()}]});await saveState();closeModal(true);renderRoute();toast('Práctica registrada');});}});
}

function exportProgressCsv(){
  const rows=[['fecha','tipo','minutos','sensacion','bloques','nota']];appState.sessions.forEach(session=>rows.push([session.date,session.type||'practice',session.actualMinutes,session.mood||'',(session.blocks||[]).map(block=>block.title).join(' | '),session.note||'']));
  const csv=rows.map(row=>row.map(value=>`"${String(value??'').replaceAll('"','""')}"`).join(',')).join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`fade-out-piano-progreso-${localISO()}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}

renderSettings = function renderSettingsV1(){
  const p=appState.profile,s=appState.settings,d=p.distributions,total=Object.values(d).reduce((sum,v)=>sum+Number(v||0),0),rs=appState.readingSettings;
  return `<div class="page-grid two"><section class="page-section"><div class="section-header"><div><h2>Perfil</h2><p>Valores usados por el planificador.</p></div></div><form class="card pad" id="profileForm"><div class="field-grid"><div class="field"><label for="profileName">Nombre</label><input id="profileName" value="${esc(p.name)}" /></div><div class="field"><label for="profileLevel">Nivel</label><select id="profileLevel">${['Inicial','Inicial avanzado','Intermedio','Intermedio avanzado','Avanzado'].map(value=>`<option ${p.level===value?'selected':''}>${value}</option>`).join('')}</select></div><div class="field"><label for="profileYears">Años de estudio</label><input id="profileYears" type="number" min="0" max="80" step=".5" value="${p.experienceYears}" /></div><div class="field"><label for="profileInstrument">Instrumento</label><input id="profileInstrument" value="${esc(p.instrument)}" /></div><div class="field"><label for="profileClassDay">Día de clase</label><select id="profileClassDay">${['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'].map((day,index)=>`<option value="${index}" ${p.classDay===index?'selected':''}>${day}</option>`).join('')}</select></div><div class="field"><label for="profileNoteNaming">Nombres de notas</label><select id="profileNoteNaming"><option value="latin" ${p.noteNaming!=='letters'?'selected':''}>Do, Re, Mi</option><option value="letters" ${p.noteNaming==='letters'?'selected':''}>C, D, E</option></select></div><div class="field"><label for="profileSessions">Sesiones semanales</label><input id="profileSessions" type="number" min="1" max="7" value="${p.weeklySessionsGoal}" /></div><div class="field"><label for="profileMinutes">Minutos semanales</label><input id="profileMinutes" type="number" min="15" max="1000" value="${p.weeklyMinutesGoal}" /></div><div class="field"><label for="profileTeacherShare">Mínimo de clase (%)</label><input id="profileTeacherShare" type="number" min="0" max="100" value="${p.minTeacherShare}" /></div></div><button class="primary-button mt-18" type="submit">Guardar perfil</button></form>
  <div class="section-header mt-10"><div><h2>Distribución sugerida</h2><p>Orienta sesiones de veinte minutos o más.</p></div>${statusTag(`${total}%`,total===100?'success':'warning')}</div><form class="card pad" id="distributionForm"><div class="field-grid"><div class="field"><label for="distTeacher">Profesora (%)</label><input id="distTeacher" type="number" min="0" max="100" value="${d.teacher}" /></div><div class="field"><label for="distPersonal">Personal (%)</label><input id="distPersonal" type="number" min="0" max="100" value="${d.personal}" /></div><div class="field"><label for="distTheory">Teoría (%)</label><input id="distTheory" type="number" min="0" max="100" value="${d.theory}" /></div><div class="field"><label for="distImprovisation">Improvisación (%)</label><input id="distImprovisation" type="number" min="0" max="100" value="${d.improvisation}" /></div><div class="field"><label for="distReading">Lectura (%)</label><input id="distReading" type="number" min="0" max="100" value="${d.reading}" /></div></div><button class="primary-button mt-18" type="submit">Guardar distribución</button></form>
  <div class="section-header mt-10"><div><h2>Lectura predeterminada</h2><p>Configuración usada al crear bloques automáticos.</p></div></div><form class="card pad" id="readingSettingsForm"><div class="field-grid"><div class="field"><label for="settingReadingClef">Clave</label><select id="settingReadingClef"><option value="treble" ${rs.clef==='treble'?'selected':''}>Sol</option><option value="bass" ${rs.clef==='bass'?'selected':''}>Fa</option><option value="random" ${rs.clef==='random'?'selected':''}>Alternada</option></select></div><div class="field"><label for="settingReadingLevel">Nivel</label><input id="settingReadingLevel" type="number" min="1" max="10" value="${rs.level}" /></div><div class="field"><label for="settingReadingMeasures">Compases</label><input id="settingReadingMeasures" type="number" min="1" max="4" value="${rs.measures}" /></div><div class="field"><label for="settingReadingTempo">Tempo</label><input id="settingReadingTempo" type="number" min="35" max="140" value="${rs.tempo}" /></div></div><button class="primary-button mt-18" type="submit">Guardar lectura</button></form></section>
  <aside class="page-section"><div class="section-header"><div><h2>Planificador</h2><p>Comportamiento de las sesiones.</p></div></div><form class="card pad" id="plannerForm"><div class="field-grid"><div class="field"><label for="maxBlock">Máximo por bloque</label><input id="maxBlock" type="number" min="4" max="30" value="${s.maxBlockMinutes}" /></div><div class="field"><label for="warmupSelect">Activación</label><select id="warmupSelect"><option value="yes" ${s.includeWarmup?'selected':''}>Sí</option><option value="no" ${!s.includeWarmup?'selected':''}>No</option></select></div><div class="field"><label for="closingSelect">Cierre</label><select id="closingSelect"><option value="yes" ${s.includeClosing?'selected':''}>Sí</option><option value="no" ${!s.includeClosing?'selected':''}>No</option></select></div><div class="field"><label for="masterVolume">Volumen (%)</label><input id="masterVolume" type="number" min="0" max="100" value="${s.masterVolume}" /></div></div><button class="primary-button mt-18" type="submit">Guardar planificador</button></form>
  <div class="section-header mt-10"><div><h2>Datos y respaldos</h2><p>La actualización conserva la base; el respaldo protege contra humanos, navegadores y otros fenómenos naturales.</p></div></div><div class="card pad"><div class="stack"><div class="row between wrap"><div><strong class="small">Último respaldo</strong><div class="muted small mt-10">${s.lastBackup?formatDate(s.lastBackup,{day:'numeric',month:'long',year:'numeric'}):'Todavía no exportado'}</div></div><button class="secondary-button" id="exportBackup">Exportar JSON</button></div><div class="divider"></div><div class="row between wrap"><div><strong class="small">Restaurar respaldo</strong><div class="muted small mt-10">La estructura se valida antes de reemplazar datos.</div></div><label class="secondary-button" for="importBackup">Elegir archivo</label><input class="hidden" id="importBackup" type="file" accept="application/json,.json" /></div><div class="divider"></div><div class="row between wrap"><div><strong class="small">Estructura inicial</strong><div class="muted small mt-10">Agrega contenedores editables, sin sesiones falsas.</div></div><button class="secondary-button" id="loadStarter" ${s.sampleContentLoaded?'disabled':''}>${s.sampleContentLoaded?'Ya cargada':'Cargar'}</button></div><div class="divider"></div><div class="row between wrap"><div><strong class="small">Reiniciar aplicación</strong><div class="muted small mt-10">Borra todos los datos locales.</div></div><button class="danger-button" id="resetApp">Borrar todo</button></div></div></div>
  <div class="card pad soft"><div class="card-header"><div><h3>Versión estable</h3><p>Sin controles deliberadamente inactivos.</p></div></div><div class="task-list mt-18"><div class="task-row"><span class="task-icon">A</span><div class="task-copy"><strong>Aplicación</strong><span>Interfaz y lógica</span></div><span class="task-meta">${APP_VERSION}</span></div><div class="task-row"><span class="task-icon">D</span><div class="task-copy"><strong>Base</strong><span>Esquema local</span></div><span class="task-meta">2</span></div><div class="task-row"><span class="task-icon">B</span><div class="task-copy"><strong>Respaldo</strong><span>Formato portable</span></div><span class="task-meta">2</span></div></div></div></aside></div>`;
};

bindSettings = function bindSettingsV1(){
  $('#profileForm')?.addEventListener('submit',async event=>{event.preventDefault();Object.assign(appState.profile,{name:$('#profileName').value.trim()||'Pianista',level:$('#profileLevel').value,experienceYears:Number($('#profileYears').value)||0,instrument:$('#profileInstrument').value.trim(),classDay:Number($('#profileClassDay').value),noteNaming:$('#profileNoteNaming').value,weeklySessionsGoal:clamp(Number($('#profileSessions').value)||4,1,7),weeklyMinutesGoal:clamp(Number($('#profileMinutes').value)||120,15,1000),minTeacherShare:clamp(Number($('#profileTeacherShare').value)||0,0,100)});await saveState();updateChrome();renderRoute();toast('Perfil guardado');});
  $('#distributionForm')?.addEventListener('submit',async event=>{event.preventDefault();appState.profile.distributions={teacher:clamp(Number($('#distTeacher').value)||0,0,100),personal:clamp(Number($('#distPersonal').value)||0,0,100),theory:clamp(Number($('#distTheory').value)||0,0,100),improvisation:clamp(Number($('#distImprovisation').value)||0,0,100),reading:clamp(Number($('#distReading').value)||0,0,100)};await saveState();renderRoute();toast('Distribución guardada');});
  $('#readingSettingsForm')?.addEventListener('submit',async event=>{event.preventDefault();Object.assign(appState.readingSettings,{clef:$('#settingReadingClef').value,level:clamp(Number($('#settingReadingLevel').value)||2,1,10),measures:clamp(Number($('#settingReadingMeasures').value)||2,1,4),tempo:clamp(Number($('#settingReadingTempo').value)||60,35,140)});Object.assign(ui,{readingClef:appState.readingSettings.clef,readingLevel:appState.readingSettings.level,readingMeasures:appState.readingSettings.measures,readingTempo:appState.readingSettings.tempo});await saveState();toast('Lectura actualizada');});
  $('#plannerForm')?.addEventListener('submit',async event=>{event.preventDefault();Object.assign(appState.settings,{maxBlockMinutes:clamp(Number($('#maxBlock').value)||12,4,30),includeWarmup:$('#warmupSelect').value==='yes',includeClosing:$('#closingSelect').value==='yes',masterVolume:clamp(Number($('#masterVolume').value)||75,0,100)});await saveState();toast('Planificador guardado');});
  $('#exportBackup')?.addEventListener('click',exportBackup);
  $('#importBackup')?.addEventListener('change',importBackup);
  $('#loadStarter')?.addEventListener('click',async()=>{loadStarterContent();await saveState();renderRoute();toast('Estructura inicial cargada');});
  $('#resetApp')?.addEventListener('click',confirmReset);
};

exportBackup = async function exportBackupV1(){
  const payload={backupFormat:2,appVersion:APP_VERSION,databaseVersion:DB_VERSION,exportedAt:new Date().toISOString(),data:appState};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`fade-out-piano-backup-${localISO()}.json`;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);appState.settings.lastBackup=localISO();await saveState();renderRoute();toast('Respaldo exportado',anchor.download);
};


playClick = function playClickV1(frequency=900,duration=.04){
  try{const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return;const context=playClick.context||(playClick.context=new AudioCtx());const oscillator=context.createOscillator();const gain=context.createGain();const volume=clamp(Number(appState?.settings?.masterVolume??75),0,100)/100;oscillator.frequency.value=frequency;gain.gain.setValueAtTime(Math.max(.0001,.18*volume),context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+duration);oscillator.connect(gain).connect(context.destination);oscillator.start();oscillator.stop(context.currentTime+duration);}catch(error){console.warn('No se pudo reproducir audio.',error);}
};

playMidiNote = function playMidiNoteV1(midi,duration=.4,when=0){
  try{const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return;const context=playClick.context||(playClick.context=new AudioCtx());const oscillator=context.createOscillator();const gain=context.createGain();const start=context.currentTime+when;const volume=clamp(Number(appState?.settings?.masterVolume??75),0,100)/100;oscillator.type='triangle';oscillator.frequency.value=440*Math.pow(2,(midi-69)/12);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,.12*volume),start+.02);gain.gain.exponentialRampToValueAtTime(.001,start+duration);oscillator.connect(gain).connect(context.destination);oscillator.start(start);oscillator.stop(start+duration+.03);}catch(error){console.warn('Audio no disponible.',error);}
};

async function initializeV1(){
  appState=await loadState();
  appState=migrateState(appState);
  refreshWeeklyCounters();
  Object.assign(ui,{
    readingClef:appState.readingSettings.clef,
    readingLevel:Number(appState.readingSettings.level||2),
    readingMeasures:Number(appState.readingSettings.measures||2),
    readingTempo:Number(appState.readingSettings.tempo||60),
    readingPulse:Boolean(appState.readingSettings.withPulse),
    readingKeyboardLabels:Boolean(appState.readingSettings.labels)
  });
  restoreActiveSession();
  planDraftRestore();
  updateChrome();

  $$('.nav-item').forEach(button=>button.addEventListener('click',()=>setRoute(button.dataset.route)));
  $('.brand').addEventListener('click',event=>{event.preventDefault();setRoute('hoy');});
  $('#quickAddButton').addEventListener('click',()=>openQuickActivityModal('global'));
  $('#resumeSessionTop').addEventListener('click',resumeActiveSession);
  $('#modalClose').addEventListener('click',()=>closeModal());
  $('#modalBackdrop').addEventListener('click',event=>{if(event.target===$('#modalBackdrop'))closeModal();});
  $('#mobileMenu').addEventListener('click',()=>{$('.sidebar').classList.add('open');$('#mobileBackdrop').classList.add('open');});
  $('#mobileBackdrop').addEventListener('click',closeMobileMenu);
  window.addEventListener('hashchange',()=>setRoute(location.hash.slice(1)||'hoy',false));
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#modalBackdrop').classList.contains('hidden'))closeModal();handleGlobalReadingKeyboard(event);});
  window.addEventListener('beforeunload',()=>{if(ui.sessionRun){appState.activeSession=serializeSessionRun(ui.sessionRun);try{localStorage.setItem(FALLBACK_KEY,JSON.stringify(appState));}catch{}}});

  const initialRoute=ROUTES[location.hash.slice(1)]?location.hash.slice(1):'hoy';
  setRoute(initialRoute,false);
  if(!appState.onboardingCompleted)setTimeout(showWelcome,100);
  if(window.fadeOutWeb?.registerServiceWorker)window.fadeOutWeb.registerServiceWorker();
  else if('serviceWorker' in navigator&&location.protocol.startsWith('http')&&!window.FADE_OUT_STANDALONE)navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('Service worker no registrado.',error));
}

document.addEventListener('DOMContentLoaded',initializeV1);

saveState = async function saveStateV1(){
  appState.demoMode=false;
  appState.appVersionLastUsed=APP_VERSION;
  try{
    if(db){
      await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(appState,STATE_KEY);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
      return;
    }
  }catch(error){console.warn('Falló el guardado en IndexedDB.',error);}
  try{localStorage.setItem(FALLBACK_KEY,JSON.stringify(appState));}
  catch(error){console.warn('No se pudo guardar el respaldo local.',error);}
};
