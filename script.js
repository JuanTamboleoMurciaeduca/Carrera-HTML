const DATA = window.APP_DATA;
const byId = (id) => document.getElementById(id);

let state = null;
let pendingToken = null;

function nowIso() { return new Date().toISOString(); }
function normalizeGroup(value) { return String(value || '').trim().toUpperCase(); }
function normalizeAnswer(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*=\s*/g, '=')
    .replace(/;+$/g, '');
}
async function sha256Text(value) {
  const bytes = new TextEncoder().encode(value);
  const buffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hashToken(token) {
  const bytes = new TextEncoder().encode(token);
  const buffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function saveState() { localStorage.setItem(DATA.storageKey, JSON.stringify(state)); }
function loadState() {
  const raw = localStorage.getItem(DATA.storageKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !DATA.groups[parsed.group]) return null;
    return parsed;
  } catch { return null; }
}
function getChallenge(id) { return DATA.challenges.find(ch => ch.id === id); }
function getExercise(id) { return DATA.exercises.find(ex => ex.id === id); }
function currentChallengeId() { return DATA.groups[state.group][state.currentIndex]; }
function addEvent(type, details = {}) { state.events.push({ at: nowIso(), type, ...details }); }
function elapsedSeconds() {
  const end = state.finishedAt ? new Date(state.finishedAt).getTime() : Date.now();
  return Math.max(0, Math.floor((end - new Date(state.startedAt).getTime()) / 1000));
}
function timePenalty() { return Math.floor(elapsedSeconds() / 60); }
function finalScore() { return state.score - timePenalty(); }
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m} min ${String(s).padStart(2, '0')} s`;
}
function showOnly(viewId) {
  ['loginView', 'gameView', 'teacherView'].forEach(id => byId(id).classList.add('hidden'));
  byId(viewId).classList.remove('hidden');
}
function updateTopbar() {
  if (!state) return;
  const route = DATA.groups[state.group];
  byId('groupLabel').textContent = `Grupo ${state.group}`;
  byId('progressLabel').textContent = state.finishedAt ? 'Reto terminado' : `Prueba ${state.currentIndex + 1} de ${route.length}`;
  byId('scoreLabel').textContent = `Puntuación: ${finalScore()} (${state.score} - ${timePenalty()} por tiempo)`;
}
function renderStats() {
  return `
    <div class="stats">
      <div class="stat"><strong>${state.score}</strong>puntos brutos</div>
      <div class="stat"><strong>-${timePenalty()}</strong>penalización por tiempo</div>
      <div class="stat"><strong>${finalScore()}</strong>puntuación actual</div>
      <div class="stat"><strong>${formatTime(elapsedSeconds())}</strong>tiempo total</div>
    </div>`;
}
function renderGame() {
  showOnly('gameView');
  updateTopbar();
  byId('exerciseCard').classList.add('hidden');
  byId('finishCard').classList.add('hidden');
  if (state.finishedAt) { renderFinish(); return; }
  if (state.mode === 'exercise') renderExercise();
  else renderRiddle();
}
function renderRiddle(message = '', messageClass = 'bad') {
  const ch = getChallenge(currentChallengeId());
  const card = byId('riddleCard');
  card.classList.remove('hidden');
  card.innerHTML = `
    <h2>${ch.title}</h2>
    <p class="riddle">${ch.riddle}</p>
    ${renderStats()}
    <p>Escanead el QR con este mismo móvil. Solo funciona el código correspondiente a la pista actual. Los señuelos de esta pista restan puntos.</p>
    ${message ? `<p class="message ${messageClass}">${message}</p>` : ''}
    <button class="secondary" id="exportBtn">Exportar JSON</button>
    <button class="danger" id="resetBtn">Reiniciar este dispositivo</button>
  `;
  byId('exportBtn').addEventListener('click', exportJson);
  byId('resetBtn').addEventListener('click', resetState);
  updateTopbar();
}
function lineToHtml(line, blanks) {
  const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return escaped.replace(/\{\{(b\d+)\}\}/g, (_, id) => {
    const blank = blanks.find(b => b.id === id);
    const size = blank ? blank.length : 8;
    return `<input data-blank="${id}" size="${size}" autocomplete="off" autocapitalize="off" spellcheck="false">`;
  });
}
function renderExercise(message = '', messageClass = 'bad') {
  const ch = getChallenge(currentChallengeId());
  const ex = getExercise(ch.exerciseId);
  byId('riddleCard').classList.add('hidden');
  const card = byId('exerciseCard');
  card.classList.remove('hidden');
  const lines = ex.lines.map(line => `<div class="line">${lineToHtml(line, ex.blanks)}</div>`).join('');
  const guidance = Array.isArray(ex.guidance) && ex.guidance.length
    ? `<div class="exercise-help"><h3>Cómo debe quedar la página</h3><ul>${ex.guidance.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`
    : '';
  card.innerHTML = `
    <h2>${escapeHtml(ex.title)}</h2>
    <p>${escapeHtml(ex.statement)}</p>
    ${guidance}
    ${renderStats()}
    <div class="codebox">${lines}</div>
    <div class="exercise-actions">
      <button id="checkExerciseBtn">Comprobar código</button>
      <button class="secondary" id="exportBtn2">Exportar JSON</button>
    </div>
    <p id="exerciseMessage" class="message ${messageClass}">${escapeHtml(message)}</p>
  `;
  byId('checkExerciseBtn').addEventListener('click', checkExercise);
  byId('exportBtn2').addEventListener('click', exportJson);
  updateTopbar();
}
async function checkExercise() {
  const ch = getChallenge(currentChallengeId());
  const ex = getExercise(ch.exerciseId);
  const inputs = Array.from(byId('exerciseCard').querySelectorAll('input[data-blank]'));
  let wrong = 0;
  let answers = {};
  for (const input of inputs) {
    const id = input.dataset.blank;
    const blank = ex.blanks.find(b => b.id === id);
    const raw = input.value;
    const hash = await sha256Text(normalizeAnswer(raw));
    const ok = blank.hashes.includes(hash);
    answers[id] = raw;
    input.classList.toggle('ok', ok);
    input.classList.toggle('bad', !ok);
    if (!ok) wrong += 1;
  }
  if (wrong > 0) {
    const penalty = wrong * DATA.scoring.wrongBlank;
    state.score += penalty;
    addEvent('exercise_attempt_failed', { challengeId: ch.id, exerciseId: ex.id, wrongBlanks: wrong, penalty, answers });
    saveState();
    byId('exerciseMessage').className = 'message bad';
    byId('exerciseMessage').textContent = `${wrong} hueco(s) incorrecto(s). Penalización: ${penalty} puntos.`;
    updateTopbar();
    return;
  }
  const seconds = Math.floor((Date.now() - new Date(state.exerciseStartedAt).getTime()) / 1000);
  const speedBonus = Math.max(0, 10 - Math.floor(seconds / 30));
  const gain = DATA.scoring.exerciseBase + speedBonus;
  state.score += gain;
  addEvent('exercise_completed', { challengeId: ch.id, exerciseId: ex.id, seconds, basePoints: DATA.scoring.exerciseBase, speedBonus, gain, answers });
  state.currentIndex += 1;
  state.mode = 'riddle';
  state.exerciseStartedAt = null;
  state.lastCorrectTokenHash = null;
  if (state.currentIndex >= DATA.groups[state.group].length) {
    state.finishedAt = nowIso();
    addEvent('game_finished', { rawScore: state.score, timePenalty: timePenalty(), finalScore: finalScore(), totalSeconds: elapsedSeconds() });
  }
  saveState();
  renderGame();
}
async function processToken(token) {
  if (!state || state.finishedAt) return;
  const tokenHash = await hashToken(token);
  const scanned = DATA.qrIndex[tokenHash] || null;
  const currentId = currentChallengeId();
  const current = getChallenge(currentId);

  if (!scanned) {
    addEvent('qr_unknown_ignored', { tokenHash });
    saveState();
    if (state.mode === 'exercise') renderExercise('QR no registrado. No modifica la puntuación.', 'warn');
    else renderRiddle('QR no registrado. No modifica la puntuación.', 'warn');
    return;
  }

  if (state.mode === 'exercise') {
    addEvent('qr_ignored_during_exercise', { scannedChallengeId: scanned.challengeId, scannedKind: scanned.kind });
    saveState();
    renderExercise('Ya estáis en el ejercicio. Resolvedlo para desbloquear la siguiente pista.', 'warn');
    return;
  }

  if (scanned.challengeId !== currentId) {
    addEvent('qr_out_of_sequence_ignored', { expectedChallengeId: currentId, scannedChallengeId: scanned.challengeId, scannedKind: scanned.kind });
    saveState();
    renderRiddle('Ese sello no responde todavía. Debéis resolver la pista actual antes.', 'warn');
    return;
  }

  if (scanned.kind === 'correct') {
    state.score += DATA.scoring.qrCorrect;
    state.mode = 'exercise';
    state.exerciseStartedAt = nowIso();
    state.lastCorrectTokenHash = tokenHash;
    addEvent('qr_correct', { challengeId: current.id, points: DATA.scoring.qrCorrect });
    saveState();
    renderExercise();
    return;
  }

  state.score += DATA.scoring.qrWrong;
  addEvent('qr_wrong_current_challenge', { challengeId: current.id, penalty: DATA.scoring.qrWrong });
  saveState();
  renderRiddle(`QR incorrecto de esta pista. Penalización: ${DATA.scoring.qrWrong} puntos.`, 'bad');
}
function renderFinish() {
  byId('riddleCard').classList.add('hidden');
  const card = byId('finishCard');
  card.classList.remove('hidden');
  card.innerHTML = `
    <h2>Reto terminado</h2>
    ${renderStats()}
    <p>Exportad el JSON y enviadlo al profesor.</p>
    <button id="downloadJsonBtn">Descargar JSON</button>
    <button class="danger" id="resetBtn2">Reiniciar este dispositivo</button>
  `;
  byId('downloadJsonBtn').addEventListener('click', exportJson);
  byId('resetBtn2').addEventListener('click', resetState);
  updateTopbar();
}
function exportJson() {
  if (!state) return;
  const payload = {
    app: 'carrera-html', version: DATA.version, exportedAt: nowIso(), group: state.group,
    route: DATA.groups[state.group], startedAt: state.startedAt, finishedAt: state.finishedAt,
    rawScore: state.score, timePenalty: timePenalty(), finalScore: finalScore(), totalSeconds: elapsedSeconds(),
    currentIndex: state.currentIndex, mode: state.mode, events: state.events
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.group}_carrera_html.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function resetState() {
  if (!confirm('¿Reiniciar los datos de este dispositivo? Se perderá la puntuación local.')) return;
  localStorage.removeItem(DATA.storageKey);
  state = null;
  location.href = 'index.html';
}
async function handleManualEntry(value) {
  const code = String(value || '').trim();
  const codeHash = await sha256Text(normalizeAnswer(code));
  if (codeHash === DATA.teacherCodeHash) {
    openTeacherView(code);
    return;
  }
  startGroup(code);
}
function startGroup(group) {
  group = normalizeGroup(group);
  if (!DATA.groups[group]) {
    byId('loginMessage').className = 'message bad';
    byId('loginMessage').textContent = 'Código no válido.';
    return;
  }
  state = { group, currentIndex: 0, mode: 'riddle', score: 0, startedAt: nowIso(), finishedAt: null, exerciseStartedAt: null, lastCorrectTokenHash: null, events: [] };
  addEvent('group_started', { group, route: DATA.groups[group] });
  saveState();
  renderGame();
  if (pendingToken) {
    const token = pendingToken;
    pendingToken = null;
    sessionStorage.removeItem('pendingToken');
    processToken(token);
  }
}
function xorDecodeB64(base64, key) {
  const raw = atob(base64);
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
  const keyBytes = new TextEncoder().encode(key);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  return new TextDecoder().decode(out);
}
function openTeacherView(code) {
  let teacher;
  try { teacher = JSON.parse(xorDecodeB64(DATA.teacherBlob, code)); }
  catch {
    byId('loginMessage').className = 'message bad';
    byId('loginMessage').textContent = 'Código no válido.';
    return;
  }
  renderTeacher(teacher);
}
function renderTeacher(teacher) {
  showOnly('teacherView');
  const challengeMap = Object.fromEntries(teacher.challenges.map(ch => [ch.id, ch]));
  const exerciseMap = Object.fromEntries(teacher.exercises.map(ex => [ex.id, ex]));
  const routesHtml = Object.entries(teacher.routes).map(([group, route]) => `
    <tr><th>${group}</th><td>${route.map(id => `${id} — ${challengeMap[id].title}`).join('<br>')}</td></tr>`).join('');
  const challengesHtml = teacher.challenges.map(ch => {
    const ex = exerciseMap[ch.exerciseId];
    const qrHtml = ch.qrCards.map(card => `<li><strong>${card.kind}</strong> — ${escapeHtml(card.label)}<br><code>${escapeHtml(card.url)}</code></li>`).join('');
    return `
      <article class="teacher-item">
        <h3>${ch.id} — ${ch.title}</h3>
        <p><strong>Adivinanza:</strong> ${ch.riddle}</p>
        <p><strong>Solución:</strong> ${ch.solution}</p>
        <p><strong>QR correcto:</strong> ${ch.correctLabel}</p>
        <details><summary>Enlaces de QR</summary><ol class="qr-list">${qrHtml}</ol></details>
        <p><strong>Ejercicio:</strong> ${escapeHtml(ex.title)}</p>
        ${Array.isArray(ex.guidance) ? `<details><summary>Indicaciones visibles para el alumnado</summary><ul>${ex.guidance.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></details>` : ''}
        <pre class="teacher-code">${escapeHtml(ex.solvedLines.join('\n'))}</pre>
      </article>`;
  }).join('');
  byId('teacherView').innerHTML = `
    <h2>Vista de profesor</h2>
    <p>Acceso oculto: se abre escribiendo el código de profesor en la entrada de grupo.</p>
    <p>Para generar los QR, usad directamente los enlaces de <code>qr-links.md</code>.</p>
    <h3>Rutas por grupo</h3>
    <table>${routesHtml}</table>
    <h3>Pistas, soluciones, enlaces y códigos resueltos</h3>
    <div class="teacher-grid">${challengesHtml}</div>
    <button class="secondary" id="backBtn">Volver</button>`;
  byId('backBtn').addEventListener('click', () => location.href = 'index.html');
}
function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function init() {
  const params = new URLSearchParams(location.search);
  const token = params.get('t');
  if (token) {
    pendingToken = token;
    sessionStorage.setItem('pendingToken', token);
    history.replaceState({}, document.title, location.pathname.endsWith('/') ? 'index.html' : location.pathname);
  } else {
    pendingToken = sessionStorage.getItem('pendingToken');
  }
  document.querySelectorAll('[data-group]').forEach(btn => btn.addEventListener('click', () => startGroup(btn.dataset.group)));
  byId('startBtn').addEventListener('click', () => handleManualEntry(byId('manualGroup').value));
  byId('manualGroup').addEventListener('keydown', (event) => { if (event.key === 'Enter') handleManualEntry(byId('manualGroup').value); });
  state = loadState();
  if (state) {
    renderGame();
    if (pendingToken) {
      const tokenToProcess = pendingToken;
      pendingToken = null;
      sessionStorage.removeItem('pendingToken');
      processToken(tokenToProcess);
    }
  } else {
    showOnly('loginView');
    if (pendingToken) {
      byId('loginMessage').className = 'message warn';
      byId('loginMessage').textContent = 'QR detectado. Introducid primero vuestro grupo.';
    }
  }
  setInterval(() => { if (state && !state.finishedAt) updateTopbar(); }, 10000);
}
init();
