import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// French spelling follows the traditional hyphenation used in the brief.
const numberWords = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'
];
const tensWords = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];
const stageConfig = {
  1: { max: 100, defaultCount: 15, name: '初級', enemies: [5, 9] },
  2: { max: 1000, defaultCount: 20, name: '中級', enemies: [7, 12] },
  3: { max: 9999, defaultCount: 25, name: '上級', enemies: [9, 15] }
};
const frenchPraise = ['Très bien !', 'Excellent !', 'Bravo !', 'Parfait !', 'Super !', 'Formidable !'];
const frenchEncouragement = ['Pas tout à fait…', 'Oups !', 'À réessayer !', 'Presque !'];
const adVideos = ['広告動画 (1).mp4', '広告動画 (2).mp4', '広告動画 (3).mp4'];
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const ui = {
  canvas: $('#world'), home: $('#homeScreen'), game: $('#gameScreen'), study: $('#studyScreen'), result: $('#resultScreen'),
  flash: $('#flash'),
  pause: $('#pauseScreen'), pauseGame: $('#gamePause'), pauseStudy: $('#studyPause'), resume: $('#resumeButton'), pauseHome: $('#pauseHome'),
  pauseInfo: $('#pauseSessionInfo'), currentTrack: $('#currentTrack'), bgmVolume: $('#bgmVolume'), volumeLabel: $('#volumeLabel'),
  pauseAnswerButtons: $$('[data-pause-answer]'), pauseSfx: $('#pauseSfx'),
  start: $('#startButton'), status: $('#assetStatus'), modeCards: $$('.mode-card'), stageCards: $$('.stage-card'),
  answerButtons: $$('[data-answer]'), countButtons: $$('[data-count]'), review: $('#reviewButton'), reviewCount: $('#reviewCount'),
  gamePanel: $('#gameAnswerPanel'), gateHint: $('#gateHint'), touchControls: $('#touchControls'), battleBanner: $('#battleBanner'),
  gameNumber: $('#gameNumber'), armyCount: $('#armyCount'), armyBadge: $('#armyBadge'), enemyBadge: $('#enemyBadge'), enemyBadgeCount: $('#enemyBadgeCount'),
  enemyLabel: $('#enemyLabel'), waveLabel: $('#waveLabel'), correct: $('#gameCorrect'), answered: $('#gameAnswered'),
  questionWave: $('#questionWave'), quizNumber: $('#quizNumber'), quizTag: $('#quizStageTag'), choiceGrid: $('#gameChoiceGrid'),
  inputForm: $('#gameInputForm'), answerInput: $('#gameAnswerInput'), feedback: $('#gameFeedback'), battleContinue: $('#battleContinue'),
  leaveGame: $('#leaveGame'), muteGame: $('#muteButton'), touchButtons: $$('.touch-controls button'),
  leaveStudy: $('#leaveStudy'), studyTitle: $('#studyTitle'), studyCorrect: $('#studyCorrect'), studyStreak: $('#studyStreak'),
  studyAccuracy: $('#studyAccuracy'), studyProgress: $('#studyProgressBar'), studyIndex: $('#studyQuestionIndex'), studyTag: $('#studyStageTag'),
  studyNumber: $('#studyNumber'), studyChoices: $('#studyChoiceGrid'), studyInputForm: $('#studyInputForm'), studyInput: $('#studyAnswerInput'),
  studyFeedback: $('#studyFeedback'), studyNext: $('#studyNext'), muteStudy: $('#studyMute'),
  resultIcon: $('#resultIcon'), resultEyebrow: $('#resultEyebrow'), resultTitle: $('#resultTitle'), resultSubtitle: $('#resultSubtitle'),
  resultCorrect: $('#resultCorrect'), resultAccuracy: $('#resultAccuracy'), resultArmy: $('#resultArmy'), survivorStat: $('#survivorStat'),
  resultFeedback: $('#resultFeedback'), reviveActions: $('#reviveActions'), watchAd: $('#watchAdButton'), reviveButton: $('#reviveButton'),
  adOverlay: $('#adOverlay'), adVideo: $('#adVideo'), adClose: $('#adClose'), adCountdown: $('#adCountdown'), adMessage: $('#adMessage'),
  resultReview: $('#resultReview'), resultHome: $('#resultHome'), toast: $('#toast')
};

const settings = { mode: 'game', stage: 1, answer: 'choice', count: 15 };
const state = {
  screen: 'home', mode: 'game', phase: 'idle', stage: 1, total: 15, index: 0,
  sessionNumbers: [], reviewMode: false, reviewQueue: [], reviewIndex: 0,
  playerCount: 12, playerX: -2.8, enemyCount: 0, enemyInitial: 0, enemyZ: -15,
  waveGateZ: -34, gateElapsed: 0, gateChoices: null, activeNumber: 0, choices: [],
  gateSpeed: 9, waveDelay: 0, enemySpeed: 5.5, battleDamageMultiplier: 1, pendingPhrase: '',
  approachElapsed: 0,
  answered: 0, correct: 0, streak: 0, bestStreak: 0, locked: false, lastCorrect: false,
  battleClock: 0, battleTick: 0, battleStep: 0, battleSteps: 0, reviveUsed: false, adOpened: false,
  lastFrame: 0, elapsed: 0, roadOffset: 0, toastTimer: 0, wrongAnswer: '',
  studyQuestion: null, gateFlash: 0, paused: false, pausedFrom: '', pauseAnswerChanged: false,
  bossParticleTimer: 0, bossCinematic: false, waveAction: '', cameraNormalPosition: new THREE.Vector3(0, 9.3, 15.5),
  cameraNormalTarget: new THREE.Vector3(0, 1.25, -22)
};

let scene, camera, renderer, loader, warriorPack, wizardPack, gateGroup, bossStageGroup, bossEnvironment, bossWizard, bossArcane;
let ground, road, roadEdges = [], roadDashes = [], stars = [];
let particlePoints, particlePosition, particleColor, particles = [];
let audioContext = null, bgmAudio = null, bgmTracks = [], currentTrackName = 'BGM未登録', bgmAttemptToken = 0;
let bgmVolume = .38, modelsReady = false, bgmReady = false, muted = false, pointerDown = false, pointerX = 0, heldKeys = new Set();
let adTimer = 0, adSecondsRemaining = 20;
const tempObject = new THREE.Object3D();
const projectVector = new THREE.Vector3();
const currentCameraTarget = new THREE.Vector3(0, 1.25, -22);
let toastTimeout = 0;

function frenchUnderHundred(n) {
  if (n <= 16) return numberWords[n];
  if (n < 20) return `dix-${numberWords[n - 10]}`;
  if (n < 70) {
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    if (!unit) return tensWords[ten];
    if (unit === 1) return `${tensWords[ten]}-et-un`;
    return `${tensWords[ten]}-${numberWords[unit]}`;
  }
  if (n < 80) {
    const unit = n - 60;
    if (unit === 10) return 'soixante-dix';
    if (unit === 11) return 'soixante-et-onze';
    return `soixante-${frenchUnderHundred(unit)}`;
  }
  if (n === 80) return 'quatre-vingts';
  if (n < 90) return `quatre-vingt-${numberWords[n - 80]}`;
  return `quatre-vingt-${frenchUnderHundred(n - 80)}`;
}

function frenchUnderThousand(n) {
  if (n < 100) return frenchUnderHundred(n);
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const head = hundreds === 1 ? 'cent' : `${numberWords[hundreds]} cent${rest === 0 ? 's' : ''}`;
  return rest ? `${head} ${frenchUnderHundred(rest)}` : head;
}

function numberToFrench(n) {
  if (!Number.isInteger(n) || n < 0 || n > 9999) throw new RangeError('n must be an integer from 0 to 9999');
  if (n < 1000) return frenchUnderThousand(n);
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const head = thousands === 1 ? 'mille' : `${numberWords[thousands]} mille`;
  return rest ? `${head} ${frenchUnderThousand(rest)}` : head;
}

function normalizeFrench(value) {
  return String(value ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/-/g, ' ').replace(/\s+/g, ' ');
}

function grammarTip(n) {
  const parts = [];
  if (n >= 1000) parts.push('mille は「un mille」と言わず、複数でも s を付けません。');
  if (n % 1000 === 100) parts.push('100は un cent ではなく cent。cent の前に un は付けません。');
  else if (n >= 200 && n % 1000 >= 100 && n % 100 === 0) parts.push('cent は200・300…のように後ろに数が続かないときだけ cents。');
  else if (n >= 100 && Math.floor((n % 1000) / 100) >= 2 && (n % 100) !== 0) parts.push('cent の後ろに数が続くので、cent に s は付きません。');
  const lastTwo = n % 100;
  if (lastTwo === 80) parts.push('80ぴったりの quatre-vingts は s で終わります。後ろに数が続くと s は外れます。');
  else if (lastTwo >= 81 && lastTwo <= 99) parts.push('81〜99は quatre-vingt… とし、vingt に s は付けません。81にも et は入りません。');
  if (lastTwo >= 70 && lastTwo <= 79) parts.push(lastTwo === 71 ? '71は soixante-et-onze。70番台は60＋10台で作ります。' : '70番台は soixante＋10台で作ります。');
  else if ([21, 31, 41, 51, 61].includes(lastTwo)) parts.push('20・30・40・50・60の後ろの un には et を入れます。');
  if (!parts.length) parts.push('単語はハイフンでつなぎます。数字と綴りを声に出して比べてみましょう。');
  return parts.slice(0, 2).join(' ');
}

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function makeChoices(n, maxValue = 9999) {
  const correct = numberToFrench(n);
  const pool = [];
  const addText = (text) => {
    if (text && normalizeFrench(text) !== normalizeFrench(correct) && !pool.some(x => normalizeFrench(x) === normalizeFrench(text))) pool.push(text);
  };
  const addNumber = (candidate) => {
    if (candidate > 0 && candidate <= maxValue && candidate !== n) addText(numberToFrench(candidate));
  };

  // Deliberately include common spelling traps before nearby-number distractors.
  if (correct.includes('vingts')) addText(correct.replace(/vingts\b/, 'vingt'));
  else if (n % 100 === 80) addText(`${correct}s`);
  if (/\bcents\b/.test(correct)) addText(correct.replace(/\bcents\b/, 'cent'));
  else if (/\bcent\b/.test(correct) && (n % 1000 % 100 !== 0 || n === 100)) addText(correct.replace(/\bcent\b/, 'cents'));
  if (correct.includes('-et-')) addText(correct.replace(/-et-/g, '-'));
  else if ([21, 31, 41, 51, 61].includes(n % 100)) addText(correct.replace(/-un\b/, '-et-un'));
  else if (n % 100 === 81) addText(correct.replace('vingt-un', 'vingt-et-un'));
  if (n % 100 >= 70 && n % 100 <= 79) addNumber(n + 20);
  if (n % 100 >= 90 && n % 100 <= 99) addNumber(n - 20);
  if (n % 100 === 80 && n >= 100) addText(correct.replace(/quatre-vingts\b/, 'quatre-vingt'));

  for (const offset of shuffle([1, -1, 10, -10, 20, -20, 100, -100, 1000, -1000])) addNumber(n + offset);
  let guard = 0;
  while (pool.length < 3 && guard++ < 100) addNumber(1 + Math.floor(Math.random() * maxValue));
  const wrong = shuffle(pool).slice(0, 3);
  return shuffle([{ text: correct, isCorrect: true }, ...wrong.map(text => ({ text, isCorrect: false }))]);
}

function getWrongBank() {
  try {
    const parsed = JSON.parse(localStorage.getItem('nombreRunWrong') || '[]');
    return Array.isArray(parsed) ? [...new Set(parsed.filter(n => Number.isInteger(n) && n >= 1 && n <= 9999))] : [];
  } catch { return []; }
}
let wrongBank = getWrongBank();

function saveWrongBank() {
  try { localStorage.setItem('nombreRunWrong', JSON.stringify(wrongBank)); } catch { /* private browsing may disable storage */ }
  updateReviewButton();
}

function addWrong(n) {
  if (!wrongBank.includes(n)) wrongBank.push(n);
  saveWrongBank();
}

function removeWrong(n) {
  wrongBank = wrongBank.filter(value => value !== n);
  saveWrongBank();
}

function updateReviewButton() {
  ui.review.hidden = wrongBank.length === 0;
  ui.reviewCount.textContent = wrongBank.length ? `(${wrongBank.length})` : '';
  ui.resultReview.hidden = wrongBank.length === 0;
}

function pickSessionNumbers(stage, count) {
  const max = stageConfig[stage].max;
  const numberPool = Array.from({ length: max }, (_, i) => i + 1);
  return shuffle(numberPool).slice(0, Math.min(count, max));
}

function toggleScreen(which) {
  if (which === 'home') {
    state.paused = false;
    ui.pause.hidden = true;
    stopBgm();
  }
  if (which === 'game') {
    ui.toast.classList.remove('visible');
    clearTimeout(toastTimeout);
  }
  if (which === 'result') bgmAudio?.pause();
  state.screen = which;
  ui.home.hidden = which !== 'home';
  ui.game.hidden = which !== 'game';
  ui.study.hidden = which !== 'study';
  ui.result.hidden = which !== 'result';
  if (which !== 'result') ui.result.classList.remove('game-over');
  document.body.classList.toggle('playing', which === 'game');
}

function updateSettingsUI() {
  ui.modeCards.forEach(card => card.classList.toggle('selected', card.dataset.mode === settings.mode));
  ui.stageCards.forEach(card => card.classList.toggle('selected', Number(card.dataset.stage) === settings.stage));
  ui.answerButtons.forEach(button => button.classList.toggle('selected', button.dataset.answer === settings.answer));
  ui.countButtons.forEach(button => button.classList.toggle('selected', Number(button.dataset.count) === settings.count));
}

function showToast(message) {
  if (state.screen === 'game') {
    ui.toast.classList.remove('visible');
    return;
  }
  ui.toast.textContent = message;
  ui.toast.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => ui.toast.classList.remove('visible'), 1750);
}

function initAudio() {
  if (!audioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioCtor) audioContext = new AudioCtor();
  }
  if (audioContext?.state === 'suspended') audioContext.resume().catch(() => {});
}

function stopBgm() {
  bgmAttemptToken++;
  if (bgmAudio) {
    bgmAudio.pause();
    bgmAudio.currentTime = 0;
    bgmAudio = null;
  }
}

function filenameFromPath(path) {
  try { return decodeURIComponent(path.split('/').pop()).replace(/\.[^.]+$/, ''); }
  catch { return path.split('/').pop().replace(/\.[^.]+$/, ''); }
}

function updateCurrentTrackLabel() {
  ui.currentTrack.textContent = currentTrackName;
}

function startRandomBgm() {
  stopBgm();
  if (!bgmTracks.length) {
    currentTrackName = 'BGM未登録（BGMフォルダに音源を追加）';
    updateCurrentTrackLabel();
    return;
  }
  const attemptToken = bgmAttemptToken;
  const shuffled = [...bgmTracks].sort(() => Math.random() - .5);
  const tryTrack = (index) => {
    if (attemptToken !== bgmAttemptToken || index >= shuffled.length) {
      if (attemptToken === bgmAttemptToken) {
        currentTrackName = 'BGMを再生できません';
        updateCurrentTrackLabel();
      }
      return;
    }
    const track = shuffled[index];
    const audio = new Audio(new URL(track.url || track.path, document.baseURI).href);
    let failed = false;
    const fallback = (error) => {
      if (failed || attemptToken !== bgmAttemptToken) return;
      failed = true;
      if (error) console.warn(`BGM playback failed: ${track.path}`, error);
      if (bgmAudio === audio) bgmAudio = null;
      tryTrack(index + 1);
    };
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = bgmVolume;
    audio.addEventListener('error', () => fallback(audio.error));
    bgmAudio = audio;
    currentTrackName = filenameFromPath(track.url || track.path);
    updateCurrentTrackLabel();
    audio.play().catch(fallback);
  };
  tryTrack(0);
}

async function discoverBgmTracks() {
  const found = new Map();
  const audioPattern = /\.mp3$/i;
  // A manifest avoids relying on whether the local web server exposes folder listings.
  try {
    const response = await fetch(new URL('BGM/playlist.json', document.baseURI), {
      signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined,
      cache: 'no-store'
    });
    if (response.ok) {
      const list = await response.json();
      if (Array.isArray(list)) list.forEach(entry => {
        if (typeof entry !== 'string') return;
        const filename = entry.split(/[\\/]/).pop();
        if (!audioPattern.test(filename)) return;
        found.set(filename.toLowerCase(), { path: `BGM/${filename}`, url: `BGM/${encodeURIComponent(filename)}` });
      });
    }
  } catch { /* manifest may be absent; try a server directory listing */ }
  // Simple local servers (including Python's http.server) expose a directory listing.
  try {
    const response = await fetch(new URL('BGM/', document.baseURI), { signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined });
    if (response.ok) {
      const html = await response.text();
      const documentListing = new DOMParser().parseFromString(html, 'text/html');
      documentListing.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href') || '';
        let decoded;
        try { decoded = decodeURIComponent(href.split('?')[0]); } catch { return; }
        if (!audioPattern.test(decoded) || decoded.includes('../')) return;
        const filename = decoded.split('/').pop();
        if (filename) found.set(filename.toLowerCase(), { path: `BGM/${filename}`, url: `BGM/${encodeURIComponent(filename)}` });
      });
    }
  } catch { /* directory listing may be disabled; keep manifest tracks */ }
  bgmTracks = [...found.values()];
  bgmReady = true;
  updateAssetStatus();
}

function updateAssetStatus() {
  ui.start.disabled = !(modelsReady && bgmReady);
  if (!modelsReady) return;
  ui.start.querySelector('span').textContent = '学習をはじめる';
  if (!bgmReady) {
    ui.status.textContent = '3Dモデル読み込み完了 · BGMを確認中…';
  } else if (bgmTracks.length) {
    ui.status.textContent = `3Dモデル読み込み完了 · BGM ${bgmTracks.length}曲を検出`;
    ui.status.classList.add('ready');
  } else {
    ui.status.textContent = '3Dモデル読み込み完了 · BGM未登録（BGMフォルダへ追加してください）';
    ui.status.classList.remove('ready');
  }
}

function pauseSession() {
  if (!['game', 'study'].includes(state.screen) || state.paused) return;
  state.paused = true;
  state.pausedFrom = state.screen;
  state.pauseAnswerChanged = false;
  bgmAudio?.pause();
  if (state.screen === 'game') {
    ui.pauseInfo.textContent = `STAGE ${state.stage} · WAVE ${String(state.index + 1).padStart(2, '0')} / ${state.total} · 味方 ${state.playerCount}人`;
  } else {
    ui.pauseInfo.textContent = `${state.reviewMode ? '間違い復習' : `STAGE ${state.stage}`} · QUESTION ${String(state.index + 1).padStart(2, '0')} / ${state.total}`;
  }
  updateCurrentTrackLabel();
  ui.pauseAnswerButtons.forEach(button => button.classList.toggle('selected', button.dataset.pauseAnswer === settings.answer));
  ui.pauseSfx.querySelector('b').textContent = muted ? 'OFF' : 'ON';
  ui.pauseSfx.classList.toggle('off', muted);
  ui.pause.hidden = false;
  setTimeout(() => ui.resume.focus({ preventScroll: true }), 40);
}

function resumeSession() {
  if (!state.paused) return;
  state.paused = false;
  ui.pause.hidden = true;
  if (state.pauseAnswerChanged && state.pausedFrom === 'game' && state.phase === 'quiz' && !state.locked) showQuizPanel();
  if (state.pauseAnswerChanged && state.pausedFrom === 'study' && !state.locked) resetStudyQuestion();
  if (bgmAudio && bgmVolume > 0) bgmAudio.play().catch(() => {});
  state.pausedFrom = '';
}

function tone(frequency, duration = 0.12, type = 'sine', delay = 0, volume = 0.07) {
  if (muted || !audioContext) return;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const start = audioContext.currentTime + delay;
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(audioContext.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function playSound(kind) {
  if (!audioContext || muted) return;
  if (kind === 'gate') { tone(530, .13, 'triangle', 0, .045); tone(780, .18, 'sine', .07, .05); }
  if (kind === 'correct') { tone(660, .13, 'sine', 0, .055); tone(880, .17, 'sine', .09, .055); tone(1050, .22, 'triangle', .18, .05); }
  if (kind === 'wrong') { tone(220, .21, 'sawtooth', 0, .045); tone(165, .23, 'triangle', .1, .035); }
  if (kind === 'clash') { tone(110 + Math.random() * 35, .12, 'square', 0, .028); }
  if (kind === 'clear') { [523, 659, 784, 1047].forEach((f, i) => tone(f, .28, 'triangle', i * .11, .05)); }
}

function setMute(value = !muted) {
  muted = value;
  [ui.muteGame, ui.muteStudy].forEach(button => {
    button.textContent = muted ? '♪' : '♫';
    button.setAttribute('aria-label', muted ? 'サウンドをオン' : 'サウンドをミュート');
  });
  ui.pauseSfx.querySelector('b').textContent = muted ? 'OFF' : 'ON';
  ui.pauseSfx.classList.toggle('off', muted);
}

function initThree() {
  renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#8cb4c4');
  scene.fog = new THREE.Fog(0x88aab7, 32, 105);
  camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, .1, 170);
  camera.position.set(0, 9.3, 15.5);
  camera.lookAt(0, 1.25, -22);

  const hemi = new THREE.HemisphereLight(0xe4f5ff, 0x20283b, 2.05);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe6c6, 3.0);
  key.position.set(-8, 18, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -18; key.shadow.camera.right = 18; key.shadow.camera.top = 20; key.shadow.camera.bottom = -20;
  key.shadow.bias = -.0004;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fe9ef, 1.25);
  rim.position.set(8, 7, -20);
  scene.add(rim);

  buildRoad();
  buildParticleSystem();
  gateGroup = new THREE.Group();
  scene.add(gateGroup);

  window.addEventListener('resize', resizeRenderer);
  animate(0);
}

function resizeRenderer() {
  if (!renderer) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function buildRoad() {
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x31504a, roughness: .95 });
  ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 260), grassMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -.22, -85);
  ground.receiveShadow = true;
  scene.add(ground);

  road = new THREE.Mesh(new THREE.PlaneGeometry(14, 230), new THREE.MeshStandardMaterial({ color: 0x263346, roughness: .86, metalness: .02 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, -.16, -94);
  road.receiveShadow = true;
  scene.add(road);

  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x5bd8cb, emissive: 0x1d8d8a, emissiveIntensity: .62, roughness: .35 });
  for (const x of [-7, 7]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(.12, .035, 230), edgeMat);
    edge.position.set(x, -.115, -94);
    scene.add(edge);
    roadEdges.push(edge);
  }
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xc9dfdc, emissive: 0x273f43, emissiveIntensity: .4, roughness: .7 });
  for (let i = 0; i < 18; i++) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(.11, .025, 2.15), dashMat);
    dash.position.set(0, -.105, 10 - i * 7.2);
    scene.add(dash);
    roadDashes.push(dash);
  }

  const decorMat = new THREE.MeshStandardMaterial({ color: 0x4d7f79, emissive: 0x174544, emissiveIntensity: .25, roughness: .56 });
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x8fded3, emissive: 0x36aaa0, emissiveIntensity: .8, roughness: .25, metalness: .2 });
  for (let i = 0; i < 34; i++) {
    const side = i % 2 ? 1 : -1;
    const z = 9 - Math.floor(i / 2) * 8.7;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.16, .32, 1.25 + (i % 3) * .28, 6), decorMat);
    stem.position.set(side * (8.3 + (i % 4) * .45), .42, z);
    stem.castShadow = true;
    scene.add(stem);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.28 + (i % 3) * .06, 0), crystalMat);
    crystal.position.set(stem.position.x, 1.12 + (i % 3) * .18, z);
    crystal.rotation.z = .2 * (i % 4);
    scene.add(crystal);
    stars.push({ crystal, phase: Math.random() * Math.PI * 2, homeY: crystal.position.y });
  }
}

function createBossStage(fullScene) {
  const environmentSource = fullScene.getObjectByName('Lunar_Landing_Environment');
  const wizardSource = fullScene.getObjectByName('Cross_Legged_Wizard');
  const arcaneSource = fullScene.getObjectByName('Arcane_Battle_Effects');
  if (!environmentSource || !wizardSource || !arcaneSource) throw new Error('Boss model parts are missing from lunar-arcane-clash-no-space-scene.gltf');

  bossStageGroup = new THREE.Group();
  bossStageGroup.visible = false;
  bossStageGroup.name = 'FinalBossCinematicStage';
  scene.add(bossStageGroup);

  // Reuse the supplied complete scene's lunar environment, giant wizard and arcane FX.
  // Its Indian horde is intentionally excluded because this is the wizard boss arena.
  bossEnvironment = environmentSource.clone(true);
  bossEnvironment.scale.setScalar(.11);
  bossEnvironment.position.set(0, -.25, 0);
  bossStageGroup.add(bossEnvironment);

  bossWizard = new THREE.Group();
  bossWizard.name = 'GiantWizardBoss';
  const wizardModel = wizardSource.clone(true);
  wizardModel.matrixAutoUpdate = true;
  wizardModel.scale.multiplyScalar(2.85);
  wizardModel.updateMatrix();
  bossWizard.add(wizardModel);
  bossWizard.position.set(0, .1, 0);
  bossWizard.rotation.y = 0;
  bossStageGroup.add(bossWizard);

  bossArcane = arcaneSource.clone(true);
  bossArcane.name = 'ArcaneBossParticles';
  bossArcane.scale.setScalar(.9);
  // The source scene includes a dark spherical deflection shield that hides the wizard in this camera setup.
  const deflectionDome = bossArcane.getObjectByName('Arcane_Deflection_Dome');
  if (deflectionDome) deflectionDome.visible = false;
  bossStageGroup.add(bossArcane);
}

const bossCameraPosition = new THREE.Vector3();
const bossCameraTarget = new THREE.Vector3();
function updateBossCinematic(dt) {
  if (!camera) return;
  const active = state.bossCinematic && state.screen === 'game';
  if (bossStageGroup) {
    bossStageGroup.visible = active;
    if (active) {
      bossStageGroup.position.set(0, 0, state.enemyZ);
      if (bossWizard) {
        bossWizard.position.y = .14 + Math.sin(state.elapsed * 2.8) * .18;
        // The model's forward axis faces +Z, toward the player approaching from the camera side.
        bossWizard.rotation.y = Math.sin(state.elapsed * .68) * .14;
        bossWizard.rotation.z = Math.sin(state.elapsed * 1.4) * .035;
      }
      if (bossArcane) bossArcane.rotation.y = Math.sin(state.elapsed * .42) * .16;
    }
  }
  if (active) {
    bossCameraPosition.set(Math.sin(state.elapsed * .42) * .8, 5.7 + Math.sin(state.elapsed * .8) * .22, state.enemyZ + 11.2);
    bossCameraTarget.set(0, 2.65, state.enemyZ - .35);
  } else {
    bossCameraPosition.copy(state.cameraNormalPosition);
    bossCameraTarget.copy(state.cameraNormalTarget);
  }
  const blend = Math.min(1, dt * (active ? 1.45 : 1.7));
  camera.position.lerp(bossCameraPosition, blend);
  currentCameraTarget.lerp(bossCameraTarget, blend);
  camera.lookAt(currentCameraTarget);
}

function emitBossMagic(dt) {
  if (!state.bossCinematic || !bossStageGroup || !bossStageGroup.visible || !['enemyApproach', 'quiz', 'battle'].includes(state.phase)) return;
  state.bossParticleTimer -= dt;
  if (state.bossParticleTimer > 0) return;
  state.bossParticleTimer = .07 + Math.random() * .12;
  const color = Math.random() < .5 ? 0x9b65ff : 0x58ddff;
  const hue = new THREE.Color(color);
  for (let i = 0; i < 9; i++) {
    if (particles.length >= 360) particles.shift();
    const angle = Math.random() * Math.PI * 2;
    const radius = 1 + Math.random() * 3.4;
    particles.push({
      x: Math.cos(angle) * radius,
      y: 2.5 + Math.random() * 4.3,
      z: state.enemyZ + Math.sin(angle) * radius,
      vx: Math.cos(angle) * (1.2 + Math.random() * 2.5),
      vy: (Math.random() - .3) * 2.8,
      vz: Math.sin(angle) * (1.2 + Math.random() * 2.5),
      life: .45 + Math.random() * .8,
      maxLife: 1.1,
      color: hue.clone().multiplyScalar(.8 + Math.random() * .4)
    });
  }
}

function buildParticleSystem() {
  const capacity = 360;
  particlePosition = new Float32Array(capacity * 3);
  particleColor = new Float32Array(capacity * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(particlePosition, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color', new THREE.BufferAttribute(particleColor, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setDrawRange(0, 0);
  particlePoints = new THREE.Points(geometry, new THREE.PointsMaterial({ size: .15, vertexColors: true, transparent: true, opacity: .95, depthWrite: false, sizeAttenuation: true }));
  particlePoints.frustumCulled = false;
  scene.add(particlePoints);
}

function burstParticles(x, z, color = 0x8ce9db, amount = 10) {
  const baseColor = new THREE.Color(color);
  for (let i = 0; i < amount; i++) {
    if (particles.length >= 360) particles.shift();
    particles.push({
      x: x + (Math.random() - .5) * .5, y: .65 + Math.random() * 1.25, z: z + (Math.random() - .5) * .4,
      vx: (Math.random() - .5) * 3.4, vy: 1.2 + Math.random() * 3.6, vz: (Math.random() - .5) * 2.8,
      life: .55 + Math.random() * .55, maxLife: .9, color: baseColor.clone().multiplyScalar(.86 + Math.random() * .3)
    });
  }
}

function updateParticles(dt) {
  const alive = [];
  for (const particle of particles) {
    particle.life -= dt;
    if (particle.life <= 0) continue;
    particle.vy -= 7.5 * dt;
    particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.z += particle.vz * dt;
    alive.push(particle);
  }
  particles = alive;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i], fade = Math.min(1, p.life / p.maxLife);
    const at = i * 3;
    particlePosition[at] = p.x; particlePosition[at + 1] = p.y; particlePosition[at + 2] = p.z;
    particleColor[at] = p.color.r * fade; particleColor[at + 1] = p.color.g * fade; particleColor[at + 2] = p.color.b * fade;
  }
  particlePoints.geometry.attributes.position.needsUpdate = true;
  particlePoints.geometry.attributes.color.needsUpdate = true;
  particlePoints.geometry.setDrawRange(0, particles.length);
}

async function createInstancedPack(url, targetHeight, capacity) {
  const gltf = await loader.loadAsync(url);
  const source = gltf.scene;
  source.updateMatrixWorld(true);
  const allBounds = new THREE.Box3().setFromObject(source);
  const size = allBounds.getSize(new THREE.Vector3());
  const scale = targetHeight / Math.max(size.y, .001);
  const byMaterial = new Map();
  source.traverse(object => {
    if (!object.isMesh) return;
    const material = object.material;
    const sourceGeometry = object.geometry;
    // The supplied GLBs use one material per primitive. Splitting groups keeps this helper robust.
    if (Array.isArray(material) && sourceGeometry.groups.length) {
      for (const group of sourceGeometry.groups) {
        const geometry = sourceGeometry.clone();
        const sourceIndex = sourceGeometry.index;
        const indices = sourceIndex ? sourceIndex.array.slice(group.start, group.start + group.count) : Array.from({ length: group.count }, (_, i) => group.start + i);
        geometry.setIndex(indices);
        geometry.clearGroups();
        geometry.applyMatrix4(object.matrixWorld);
        const itemMaterial = material[group.materialIndex] || material[0];
        if (!byMaterial.has(itemMaterial)) byMaterial.set(itemMaterial, []);
        byMaterial.get(itemMaterial).push(geometry);
      }
    } else {
      const geometry = sourceGeometry.clone();
      geometry.applyMatrix4(object.matrixWorld);
      const itemMaterial = Array.isArray(material) ? material[0] : material;
      if (!byMaterial.has(itemMaterial)) byMaterial.set(itemMaterial, []);
      byMaterial.get(itemMaterial).push(geometry);
    }
  });

  const offset = new THREE.Matrix4().makeTranslation(-((allBounds.min.x + allBounds.max.x) / 2) * scale, -allBounds.min.y * scale, -((allBounds.min.z + allBounds.max.z) / 2) * scale);
  const scaleMatrix = new THREE.Matrix4().makeScale(scale, scale, scale);
  offset.multiply(scaleMatrix);
  const meshes = [];
  for (const [material, geometries] of byMaterial) {
    const merged = mergeGeometries(geometries, false);
    geometries.forEach(g => g.dispose());
    if (!merged) continue;
    merged.applyMatrix4(offset);
    merged.computeBoundingSphere();
    const mesh = new THREE.InstancedMesh(merged, material, capacity);
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    meshes.push(mesh);
  }
  return { meshes, capacity, targetHeight };
}

function updatePack(pack, count, centerX, centerZ, time, kind = 'ally') {
  if (!pack) return;
  const isBoss = kind === 'boss';
  const visible = Math.min(count, isBoss ? 1 : pack.capacity);
  const columns = isBoss ? 1 : Math.min(8, Math.ceil(Math.sqrt(visible * 1.55)));
  for (const mesh of pack.meshes) {
    mesh.count = visible;
    for (let i = 0; i < visible; i++) {
      const row = Math.floor(i / columns), col = i % columns;
      const rowWidth = Math.min(columns, visible - row * columns);
      const xOffset = (col - (rowWidth - 1) / 2) * (kind === 'enemy' ? 1.0 : .88);
      const zOffset = row * (kind === 'enemy' ? .95 : .82);
      const bob = kind === 'ally' ? Math.abs(Math.sin(time * 9.5 + i * .91)) * .09 : Math.abs(Math.sin(time * 7 + i * 1.2)) * .045;
      const scale = isBoss ? 2.65 : (kind === 'enemy' ? .93 : .9);
      tempObject.position.set(centerX + xOffset, bob, centerZ + (kind === 'enemy' ? -zOffset : zOffset));
      tempObject.rotation.set(0, kind === 'ally' ? Math.PI + Math.sin(time * 2 + i) * .025 : Math.sin(time * 1.2 + i) * .045, 0);
      tempObject.scale.setScalar(scale);
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}

function disposeGroup(group) {
  const children = [...group.children];
  children.forEach(child => group.remove(child));
  children.forEach(child => child.traverse(object => {
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    materials.forEach(material => { material.map?.dispose(); material.dispose(); });
  }));
}

function textTexture(lines, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 300;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = color; ctx.shadowBlur = 26;
  ctx.fillStyle = '#f6fbff';
  ctx.font = '800 112px Manrope, sans-serif';
  ctx.fillText(lines.effect, 320, 150, 600);
  if (lines.text) {
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#e6f0f7';
    ctx.font = '700 30px sans-serif';
    ctx.fillText(lines.text, 320, 244, 600);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function addGate(centerX, choice, correctColor) {
  const group = new THREE.Group();
  const accent = correctColor ? 0x258cff : 0xff405f;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(5.7, 4.55, .11), new THREE.MeshPhysicalMaterial({ color: accent, emissive: accent, emissiveIntensity: .22, roughness: .2, metalness: .15, transparent: true, opacity: .23, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.set(0, 2.28, 0);
  group.add(glass);
  const frameMaterial = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: .78, metalness: .25, roughness: .28 });
  for (const x of [-2.82, 2.82]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(.16, 4.75, .2), frameMaterial);
    pillar.position.set(x, 2.38, .09); pillar.castShadow = true; group.add(pillar);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(5.78, .17, .22), frameMaterial);
  beam.position.set(0, 4.68, .09); beam.castShadow = true; group.add(beam);
  const labelMaterial = new THREE.MeshBasicMaterial({ map: textTexture(choice, correctColor ? '#5ff4e7' : '#ff7b92'), transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(5.05, 2.35), labelMaterial);
  label.position.set(0, 2.55, .18); group.add(label);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: .58, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.24, 48), ringMaterial);
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, -.07, 0); group.add(ring);
  group.position.set(centerX, 0, 0);
  gateGroup.add(group);
}

function buildGates() {
  disposeGroup(gateGroup);
  const rareRoll = Math.random() * 100;
  let good;
  if (rareRoll < .8) good = { effectType: 'multiply', value: 100, label: '×100' };
  else if (rareRoll < 4.8) good = { effectType: 'multiply', value: 10, label: '×10' };
  else {
    const common = [
      { effectType: 'add', value: 5, label: '+5', weight: 8 },
      { effectType: 'add', value: 10, label: '+10', weight: 18 },
      { effectType: 'add', value: 15, label: '+15', weight: 14 },
      { effectType: 'add', value: 20, label: '+20', weight: 12 },
      { effectType: 'add', value: 30, label: '+30', weight: 8 },
      { effectType: 'add', value: 50, label: '+50', weight: 4 },
      { effectType: 'multiply', value: 2, label: '×2', weight: 20 },
      { effectType: 'multiply', value: 3, label: '×3', weight: 10 },
      { effectType: 'multiply', value: 4, label: '×4', weight: 4 },
      { effectType: 'multiply', value: 5, label: '×5', weight: 2 }
    ];
    let roll = Math.random() * common.reduce((sum, item) => sum + item.weight, 0);
    good = common.find(item => (roll -= item.weight) <= 0) || common[0];
  }
  const badOptions = [
    { effectType: 'add', value: -10, label: '-10' },
    { effectType: 'divide', value: 2, label: '÷2' },
    { effectType: 'add', value: -15, label: '-15' }
  ];
  const bad = badOptions[Math.floor(Math.random() * badOptions.length)];
  const [left, right] = Math.random() < .5 ? [good, bad] : [bad, good];
  for (const item of [left, right]) { item.effect = item.label; item.text = ''; }
  state.gateChoices = { left, right };
  const isHelpful = choice => choice.effectType === 'multiply' || choice.value > 0;
  addGate(-3.35, left, isHelpful(left));
  addGate(3.35, right, isHelpful(right));
  gateGroup.position.z = state.waveGateZ;
  gateGroup.visible = true;
}

function applyGate(choice) {
  const before = state.playerCount;
  if (choice.effectType === 'multiply') state.playerCount = Math.round(state.playerCount * choice.value);
  else if (choice.effectType === 'divide') state.playerCount = Math.floor(state.playerCount / choice.value);
  else state.playerCount += choice.value;
  state.playerCount = Math.max(1, Math.min(9999, state.playerCount));
  const delta = state.playerCount - before;
  burstParticles(state.playerX, 0, delta >= 0 ? 0x6de3d3 : 0xff6f88, 24);
  state.gateFlash = .28;
  playSound('gate');
  updateGameHUD();
  showToast(`${choice.label}  ${delta >= 0 ? '仲間が増えた！' : '仲間が減った…'}`);
  gateGroup.visible = false;
  state.enemyInitial = randomEnemyCount();
  state.enemyCount = state.enemyInitial;
  state.approachElapsed = 0;
  state.enemyZ = -(22 + Math.random() * 15);
  state.enemySpeed = 5.2 + Math.random() * 3.4;
  state.bossCinematic = state.index === state.total - 1;
  if (state.bossCinematic) {
    state.enemyZ = -39 - Math.random() * 8;
    state.enemySpeed = 5.5 + Math.random() * 1.7;
    state.bossParticleTimer = 0;
    playSound('clear');
  }
  state.phase = 'enemyApproach';
  state.locked = false;
  ui.enemyBadge.hidden = false;
  ui.enemyLabel.textContent = state.bossCinematic ? '魔法使いボス' : '魔法使い軍団';
  ui.gateHint.textContent = '敵が来る！左右に動いて迎え撃とう';
  ui.gateHint.hidden = false;
  ui.touchControls.hidden = false;
  ui.gamePanel.hidden = true;
  ui.gameNumber.textContent = '—';
  ui.waveLabel.textContent = `WAVE ${String(state.index + 1).padStart(2, '0')} / ${state.total}`;
  ui.battleBanner.hidden = true;
  updateGameHUD();
}

function showCollisionQuestion() {
  if (state.phase === 'quiz') return;
  state.phase = 'quiz';
  pointerDown = false;
  heldKeys.clear();
  state.locked = false;
  const maxNumber = stageConfig[state.stage]?.max ?? 100;
  const selectedNumber = state.sessionNumbers[state.index];
  state.activeNumber = Number.isInteger(selectedNumber) && selectedNumber >= 1 && selectedNumber <= maxNumber
    ? selectedNumber
    : 1 + Math.floor(Math.random() * maxNumber);
  state.sessionNumbers[state.index] = state.activeNumber;
  ui.gameNumber.textContent = String(state.activeNumber);
  ui.questionWave.textContent = String(state.index + 1).padStart(2, '0');
  ui.quizNumber.textContent = String(state.activeNumber);
  ui.quizTag.textContent = `STAGE ${state.stage} · ${state.index + 1}/${state.total}`;
  ui.gateHint.hidden = true;
  ui.touchControls.hidden = true;
  ui.battleBanner.hidden = true;
  // Open the quiz UI first so the collision cannot leave a frozen-looking scene
  // if choice generation or focus handling takes an extra frame.
  ui.gamePanel.hidden = false;
  ui.gamePanel.classList.remove('collision-open');
  void ui.gamePanel.offsetWidth;
  ui.gamePanel.classList.add('collision-open');
  ui.gamePanel.style.visibility = 'visible';
  ui.gamePanel.style.display = 'block';
  ui.gamePanel.scrollTop = 0;
  try {
    state.choices = makeChoices(state.activeNumber, stageConfig[state.stage].max);
    showQuizPanel();
  } catch (error) {
    console.error('Could not build collision quiz choices:', error);
    settings.answer = 'input';
    ui.quizTag.textContent = 'ÉCRIS EN FRANÇAIS';
    showQuizPanel();
  }
}

function showQuizPanel() {
  ui.gamePanel.hidden = false;
  ui.gamePanel.style.visibility = 'visible';
  ui.gamePanel.style.display = 'block';
  ui.feedback.hidden = true;
  ui.battleContinue.hidden = true;
  ui.choiceGrid.replaceChildren();
  ui.answerInput.value = '';
  const inputMode = settings.answer === 'input';
  ui.choiceGrid.hidden = inputMode;
  ui.inputForm.hidden = !inputMode;
  if (inputMode) {
    setTimeout(() => ui.answerInput.focus({ preventScroll: true }), 100);
  } else {
    fillChoiceGrid(ui.choiceGrid, state.choices, (value, button, isCorrect) => submitGameAnswer(value, button, isCorrect));
  }
}

function fillChoiceGrid(container, choices, callback) {
  container.replaceChildren();
  choices.forEach(choice => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'choice-button'; button.textContent = choice.text;
    button.dataset.correct = String(choice.isCorrect === true);
    button.addEventListener('click', () => callback(choice.text, button, choice.isCorrect === true), { once: true });
    container.append(button);
  });
}

function createFeedback(parent, isCorrect, number, typed) {
  parent.hidden = false;
  parent.classList.toggle('correct', isCorrect);
  parent.classList.toggle('incorrect', !isCorrect);
  const result = state.pendingPhrase || (isCorrect ? 'Très bien !' : 'Oups !');
  const lead = isCorrect ? 'Bonne réponse !' : 'La bonne réponse :';
  parent.innerHTML = `<p class="feedback-result" lang="fr">${result}</p><p class="feedback-lead" lang="fr">${lead}</p><p class="feedback-spelling" lang="fr">${numberToFrench(number)}</p><p class="feedback-rule">${grammarTip(number)}</p>`;
  if (typed) parent.setAttribute('aria-label', `${result} ${lead} ${numberToFrench(number)}. ${grammarTip(number)}`);
}

function flashAnswer(isCorrect) {
  ui.flash.style.background = isCorrect ? 'rgba(70, 255, 174, .82)' : 'rgba(255, 56, 89, .86)';
  ui.flash.classList.remove('answer-pop');
  void ui.flash.offsetWidth;
  ui.flash.classList.add('answer-pop');
  setTimeout(() => ui.flash.classList.remove('answer-pop'), 650);
}

function lockChoiceButtons(container, selected, correctSpelling) {
  [...container.querySelectorAll('button')].forEach(button => {
    button.disabled = true;
    if (button.dataset.correct === 'true' || normalizeFrench(button.textContent) === normalizeFrench(correctSpelling)) button.classList.add('correct-choice');
    else if (button === selected) button.classList.add('wrong-choice');
  });
}

function recordAnswer(n, rawAnswer, isCorrect, mode) {
  state.answered++;
  if (isCorrect) {
    state.correct++;
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    playSound('correct');
    if (state.reviewMode) removeWrong(n);
  } else {
    state.streak = 0;
    addWrong(n);
    playSound('wrong');
  }
  state.lastCorrect = isCorrect;
  state.battleDamageMultiplier = isCorrect ? 1 : 2;
  state.pendingPhrase = isCorrect
    ? frenchPraise[Math.floor(Math.random() * frenchPraise.length)]
    : frenchEncouragement[Math.floor(Math.random() * frenchEncouragement.length)];
  state.wrongAnswer = rawAnswer;
  flashAnswer(isCorrect);
  if (mode === 'game') {
    ui.correct.textContent = String(state.correct);
    ui.answered.textContent = String(state.answered);
    createFeedback(ui.feedback, isCorrect, n, rawAnswer);
    ui.battleContinue.hidden = false;
    ui.gateHint.hidden = true;
    ui.touchControls.hidden = true;
    state.locked = true;
  } else {
    createFeedback(ui.studyFeedback, isCorrect, n, rawAnswer);
    ui.studyNext.hidden = false;
    updateStudyHUD();
    state.locked = true;
  }
}

function submitGameAnswer(raw, selectedButton, choiceCorrectness = null) {
  if (state.locked || state.phase !== 'quiz') return;
  const isCorrect = typeof choiceCorrectness === 'boolean'
    ? choiceCorrectness
    : normalizeFrench(raw) === normalizeFrench(numberToFrench(state.activeNumber));
  if (settings.answer === 'choice') lockChoiceButtons(ui.choiceGrid, selectedButton, numberToFrench(state.activeNumber));
  else ui.answerInput.disabled = true;
  recordAnswer(state.activeNumber, raw, isCorrect, 'game');
}

function startBattle() {
  state.phase = 'battle';
  ui.gamePanel.hidden = true;
  ui.enemyBadge.hidden = false;
  state.battleClock = 0;
  state.battleTick = 0;
  state.battleStep = 0;
  state.battleSteps = state.enemyInitial;
  ui.battleBanner.hidden = true;
  updateGameHUD();
}

function randomEnemyCount() {
  const [min, max] = stageConfig[state.stage].enemies;
  const progress = state.index / Math.max(1, state.total - 1);
  const stagePressure = Math.ceil((min + Math.random() * (max - min) + progress * 2) * .5);
  // Enemy pressure stays near half of the current army, including after strong gates.
  const armyPressure = Math.ceil(state.playerCount * (.28 + Math.random() * .06));
  return Math.max(1, Math.min(9999, Math.max(stagePressure, armyPressure)));
}

function resolveBattleStep() {
  if (state.enemyCount <= 0) return;
  const x = (Math.random() - .5) * 4.7;
  // Resolve large crowds in up to 32 readable beats while preserving exact casualty ratios.
  const exchangeBatch = Math.max(1, Math.ceil(state.enemyInitial / 32));
  const alliesLostPerEnemy = state.lastCorrect ? 1 : Math.max(1, state.battleDamageMultiplier);
  const playerLimitedExchanges = state.lastCorrect ? state.playerCount : state.enemyCount;
  const enemiesDefeated = Math.min(exchangeBatch, state.enemyCount, playerLimitedExchanges);
  if (enemiesDefeated <= 0) {
    finishRun(false);
    return;
  }
  const alliesLost = Math.min(state.playerCount, enemiesDefeated * alliesLostPerEnemy);
  state.playerCount -= alliesLost;
  state.enemyCount -= enemiesDefeated;
  state.battleStep++;
  burstParticles(x, state.enemyZ, state.lastCorrect ? 0x8be7da : 0xff6f88, 12 + Math.min(alliesLost, 8) * 3);
  ui.battleBanner.hidden = true;
  if (state.bossCinematic) {
    burstParticles((Math.random() - .5) * 3, state.enemyZ, 0xb780ff, 18);
    state.gateFlash = .16;
  }
  playSound('clash');
  updateGameHUD();
  const finalWaveVictory = state.index >= state.total - 1 && state.enemyCount <= 0 && state.lastCorrect;
  if (finalWaveVictory) {
    ui.enemyBadge.hidden = true;
    state.phase = 'celebrate';
    state.waveDelay = 1.8;
    state.waveAction = 'clear';
    return;
  }
  if (state.playerCount <= 0) {
    finishRun(false);
    return;
  }
  if (state.enemyCount <= 0) {
    ui.enemyBadge.hidden = true;
    ui.battleBanner.hidden = true;
    if (state.index >= state.total - 1) {
      state.phase = 'celebrate';
      state.waveDelay = 1.8;
      state.waveAction = 'clear';
    } else {
      state.phase = 'between';
      state.waveDelay = .7 + Math.random() * 2.1;
      state.waveAction = 'next';
    }
  }
}

function beginWave() {
  state.phase = 'gateDelay';
  state.locked = false;
  state.gateElapsed = 0;
  state.waveGateZ = -(35 + Math.random() * 17);
  state.gateSpeed = 7.5 + Math.random() * 5.2;
  state.waveDelay = Math.random() * 1.15;
  state.enemyCount = 0;
  state.enemyZ = -24;
  state.bossCinematic = false;
  state.waveAction = '';
  ui.battleBanner.hidden = true;
  ui.enemyBadge.hidden = true;
  ui.gateHint.innerHTML = '<span class="hint-arrows">← <i>→</i></span><span>左右に動いてゲートを選ぼう</span>';
  ui.gateHint.hidden = true;
  ui.touchControls.hidden = true;
  ui.gamePanel.hidden = true;
  ui.gamePanel.classList.remove('collision-open');
  ui.gameNumber.textContent = '—';
  state.activeNumber = state.sessionNumbers[state.index];
  ui.waveLabel.textContent = `WAVE ${String(state.index + 1).padStart(2, '0')} / ${state.total}`;
  buildGates();
  gateGroup.visible = false;
  updateGameHUD();
}

function updateGameHUD() {
  ui.armyCount.textContent = String(state.playerCount);
  ui.armyBadge.querySelector('b').textContent = String(state.playerCount);
  ui.enemyBadgeCount.textContent = String(state.enemyCount);
  ui.correct.textContent = String(state.correct);
  ui.answered.textContent = String(state.answered);
}

function startGameSession() {
  initAudio();
  startRandomBgm();
  state.mode = 'game'; state.stage = settings.stage; state.total = settings.count;
  state.index = 0; state.playerCount = 12; state.playerX = -2.8;
  state.answered = 0; state.correct = 0; state.streak = 0; state.bestStreak = 0;
  state.sessionNumbers = pickSessionNumbers(state.stage, state.total);
  state.reviewMode = false; state.reviveUsed = false; state.adOpened = false;
  ui.correct.textContent = '0'; ui.answered.textContent = '0';
  toggleScreen('game');
  beginWave();
}

function resetStudyQuestion() {
  ui.studyFeedback.hidden = true;
  ui.studyNext.hidden = true;
  ui.studyInput.value = '';
  ui.studyInput.disabled = false;
  ui.studyChoices.hidden = settings.answer === 'input';
  ui.studyInputForm.hidden = settings.answer !== 'input';
  if (settings.answer === 'choice') {
    const n = state.studyQuestion;
    fillChoiceGrid(ui.studyChoices, makeChoices(n, state.reviewMode ? 9999 : stageConfig[state.stage].max), (value, button, isCorrect) => submitStudyAnswer(value, button, isCorrect));
  } else {
    setTimeout(() => ui.studyInput.focus({ preventScroll: true }), 80);
  }
}

function beginStudySession(review = false) {
  initAudio();
  startRandomBgm();
  state.mode = 'study'; state.stage = settings.stage;
  state.reviewMode = review;
  state.reviewQueue = review ? [...wrongBank] : [];
  state.reviewIndex = 0;
  state.total = review ? state.reviewQueue.length : settings.count;
  state.index = 0; state.answered = 0; state.correct = 0; state.streak = 0; state.bestStreak = 0;
  state.sessionNumbers = review ? [...state.reviewQueue] : pickSessionNumbers(state.stage, state.total);
  ui.studyTitle.textContent = review ? '間違えた問題の復習' : '一問一答';
  ui.studyTag.textContent = review ? 'REVIEW' : `STAGE ${state.stage}`;
  toggleScreen('study');
  showStudyQuestion();
}

function showStudyQuestion() {
  if (state.index >= state.sessionNumbers.length) {
    showResult(true, 'study');
    return;
  }
  state.locked = false;
  state.studyQuestion = state.sessionNumbers[state.index];
  ui.studyNumber.textContent = String(state.studyQuestion);
  ui.studyIndex.textContent = `${String(state.index + 1).padStart(2, '0')} / ${state.sessionNumbers.length}`;
  ui.studyTag.textContent = state.reviewMode ? 'REVIEW' : `STAGE ${state.stage}`;
  ui.studyProgress.style.width = `${(state.index / Math.max(1, state.sessionNumbers.length)) * 100}%`;
  resetStudyQuestion();
  updateStudyHUD();
}

function submitStudyAnswer(raw, selectedButton, choiceCorrectness = null) {
  if (state.locked) return;
  const n = state.studyQuestion;
  const correct = typeof choiceCorrectness === 'boolean'
    ? choiceCorrectness
    : normalizeFrench(raw) === normalizeFrench(numberToFrench(n));
  if (settings.answer === 'choice') lockChoiceButtons(ui.studyChoices, selectedButton, numberToFrench(n));
  else ui.studyInput.disabled = true;
  recordAnswer(n, raw, correct, 'study');
}

function updateStudyHUD() {
  ui.studyCorrect.textContent = `${state.correct}`;
  ui.studyStreak.textContent = `${state.streak}`;
  ui.studyAccuracy.textContent = `${state.answered ? Math.round(state.correct / state.answered * 100) : 0}%`;
  ui.studyProgress.style.width = `${(state.answered / Math.max(1, state.sessionNumbers.length)) * 100}%`;
}

function moveStudyNext() {
  if (!state.locked) return;
  state.index++;
  showStudyQuestion();
}

function startAdPopup() {
  if (state.screen !== 'result' || !ui.result.classList.contains('game-over') || state.reviveUsed) return;
  const file = adVideos[Math.floor(Math.random() * adVideos.length)];
  clearInterval(adTimer);
  adSecondsRemaining = 20;
  state.adOpened = false;
  ui.adCountdown.textContent = '20秒';
  ui.adClose.hidden = true;
  ui.adMessage.textContent = '動画を再生中です。再生時間が20秒になると閉じるボタンが表示されます。';
  ui.watchAd.disabled = true;
  ui.adVideo.pause();
  ui.adVideo.src = encodeURI(file);
  ui.adVideo.loop = true;
  ui.adVideo.muted = false;
  ui.adOverlay.hidden = false;
  ui.adVideo.load();
  ui.adVideo.play().catch(() => {
    ui.adMessage.textContent = '動画の再生ボタンを押してください。再生時間が20秒になると閉じるボタンが表示されます。';
  });
  adTimer = window.setInterval(() => {
    if (ui.adOverlay.hidden || ui.adVideo.paused || ui.adVideo.seeking || ui.adVideo.readyState < 2) return;
    adSecondsRemaining = Math.max(0, adSecondsRemaining - 1);
    ui.adCountdown.textContent = adSecondsRemaining ? `${adSecondsRemaining}秒` : 'OK';
    if (adSecondsRemaining <= 0) {
      clearInterval(adTimer);
      ui.adClose.hidden = false;
      ui.adMessage.textContent = '視聴時間を確認しました。×で閉じて、復活ボタンを押してください。';
    }
  }, 1000);
}

function closeAdPopup() {
  if (adSecondsRemaining > 0 || ui.adClose.hidden) return;
  clearInterval(adTimer);
  ui.adVideo.pause();
  ui.adVideo.removeAttribute('src');
  ui.adVideo.load();
  ui.adOverlay.hidden = true;
  state.adOpened = true;
  ui.watchAd.disabled = true;
  ui.watchAd.innerHTML = '広告を視聴しました <b>✓</b>';
  ui.reviveButton.hidden = false;
}

function showResult(success, kind) {
  toggleScreen('result');
  clearInterval(adTimer);
  ui.adVideo.pause();
  ui.adOverlay.hidden = true;
  ui.result.classList.toggle('game-over', !success);
  const accuracy = state.answered ? Math.round((state.correct / state.answered) * 100) : 0;
  ui.resultEyebrow.textContent = kind === 'game' ? (success ? 'RUN COMPLETE' : 'RUN ENDED') : (state.reviewMode ? 'REVIEW COMPLETE' : 'STUDY COMPLETE');
  ui.resultTitle.textContent = kind === 'game' ? (success ? 'CLEAR!' : 'GAME OVER') : (state.reviewMode ? 'BIEN JOUÉ !' : 'BRAVO !');
  ui.resultSubtitle.textContent = kind === 'game' ? (success ? `${stageConfig[state.stage].name}を走破！数字の綴りもよく身につきました。` : '群れが力尽きました。広告を見て一度だけ復活できます。') : (state.reviewMode ? '復習した問題は間違いリストから外れます。' : '答えと文法を確認しながら学習できました。');
  ui.resultCorrect.textContent = `${state.correct} / ${state.answered}`;
  ui.resultAccuracy.textContent = `${accuracy}%`;
  ui.resultArmy.textContent = `${state.playerCount}人`;
  ui.survivorStat.hidden = kind !== 'game';
  ui.resultIcon.textContent = success ? '✦' : '×';
  ui.resultFeedback.hidden = true;
  ui.reviveActions.hidden = !(kind === 'game' && !success && !state.reviveUsed);
  ui.reviveButton.hidden = true;
  ui.watchAd.disabled = false;
  ui.watchAd.innerHTML = '広告を見て復活 <b>▶</b>';
  ui.resultHome.textContent = success || state.reviveUsed ? 'ホームへ戻る →' : 'リトライ →';
  playSound(success ? 'clear' : 'wrong');
  updateReviewButton();
  ui.resultReview.hidden = wrongBank.length === 0;
}

function finishRun(success) {
  state.phase = 'result';
  showResult(success, 'game');
}

function reviveRun() {
  if (!state.adOpened || state.reviveUsed) return;
  state.reviveUsed = true;
  state.adOpened = false;
  const reducedEnemy = Math.max(1, Math.floor(state.enemyCount * .48));
  state.enemyCount = reducedEnemy;
  state.playerCount = Math.max(8, reducedEnemy + 5);
  state.lastCorrect = true;
  state.battleDamageMultiplier = 1;
  state.pendingPhrase = 'Courage !';
  state.phase = 'battle';
  state.battleTick = 0; state.battleStep = 0;
  ui.reviveActions.hidden = true;
  ui.result.hidden = true;
  toggleScreen('game');
  if (bgmAudio && bgmVolume > 0) bgmAudio.play().catch(() => {});
  ui.battleBanner.hidden = true;
  ui.enemyBadge.hidden = false;
  updateGameHUD();
  burstParticles(state.playerX, -1, 0xffcf78, 44);
}

function laneButton(lane) {
  if (!['gate', 'enemyApproach'].includes(state.phase)) return;
  state.playerX = lane === 'left' ? -3.1 : 3.1;
}

function beginPointer(clientX) {
  if (state.screen !== 'game' || !['gate', 'enemyApproach'].includes(state.phase)) return;
  pointerDown = true;
  pointerX = clientX;
}

function movePointer(clientX) {
  if (!pointerDown || state.screen !== 'game' || !['gate', 'enemyApproach'].includes(state.phase)) return;
  const delta = clientX - pointerX;
  pointerX = clientX;
  state.playerX = THREE.MathUtils.clamp(state.playerX + delta / Math.max(1, window.innerWidth) * 14, -5.3, 5.3);
}

function installControls() {
  ui.modeCards.forEach(card => card.addEventListener('click', () => { settings.mode = card.dataset.mode; updateSettingsUI(); }));
  ui.stageCards.forEach(card => card.addEventListener('click', () => {
    settings.stage = Number(card.dataset.stage);
    settings.count = stageConfig[settings.stage].defaultCount;
    updateSettingsUI();
  }));
  ui.answerButtons.forEach(button => button.addEventListener('click', () => { settings.answer = button.dataset.answer; updateSettingsUI(); }));
  ui.countButtons.forEach(button => button.addEventListener('click', () => { settings.count = Number(button.dataset.count); updateSettingsUI(); }));
  ui.start.addEventListener('click', () => settings.mode === 'game' ? startGameSession() : beginStudySession(false));
  ui.review.addEventListener('click', () => beginStudySession(true));
  ui.leaveGame.addEventListener('click', () => { pointerDown = false; toggleScreen('home'); });
  ui.leaveStudy.addEventListener('click', () => toggleScreen('home'));
  ui.muteGame.addEventListener('click', () => setMute());
  ui.muteStudy.addEventListener('click', () => setMute());
  ui.pauseGame.addEventListener('click', pauseSession);
  ui.pauseStudy.addEventListener('click', pauseSession);
  ui.resume.addEventListener('click', resumeSession);
  ui.pauseHome.addEventListener('click', () => { pointerDown = false; toggleScreen('home'); });
  ui.pauseSfx.addEventListener('click', () => setMute());
  ui.bgmVolume.addEventListener('input', () => {
    bgmVolume = Number(ui.bgmVolume.value) / 100;
    ui.volumeLabel.textContent = `${ui.bgmVolume.value}%`;
    if (bgmAudio) bgmAudio.volume = bgmVolume;
  });
  ui.pauseAnswerButtons.forEach(button => button.addEventListener('click', () => {
    if (settings.answer === button.dataset.pauseAnswer) return;
    settings.answer = button.dataset.pauseAnswer;
    state.pauseAnswerChanged = true;
    ui.pauseAnswerButtons.forEach(item => item.classList.toggle('selected', item === button));
    updateSettingsUI();
  }));
  ui.touchButtons.forEach(button => button.addEventListener('click', () => laneButton(button.dataset.lane)));
  ui.inputForm.addEventListener('submit', event => { event.preventDefault(); const value = ui.answerInput.value.trim(); if (value) submitGameAnswer(value); });
  ui.studyInputForm.addEventListener('submit', event => { event.preventDefault(); const value = ui.studyInput.value.trim(); if (value) submitStudyAnswer(value); });
  ui.battleContinue.addEventListener('click', startBattle);
  ui.studyNext.addEventListener('click', moveStudyNext);
  ui.resultHome.addEventListener('click', () => {
    if (ui.result.classList.contains('game-over') && !state.reviveUsed) {
      startGameSession();
    } else toggleScreen('home');
  });
  ui.resultReview.addEventListener('click', () => beginStudySession(true));
  ui.watchAd.addEventListener('click', startAdPopup);
  ui.adClose.addEventListener('click', closeAdPopup);
  ui.reviveButton.addEventListener('click', reviveRun);
  ui.game.addEventListener('touchstart', event => {
    if (event.target.closest('button, input, form, .game-answer-panel')) return;
    event.preventDefault();
    if (event.touches.length) beginPointer(event.touches[0].clientX);
  }, { passive: false });
  ui.game.addEventListener('touchmove', event => {
    if (event.target.closest('button, input, form, .game-answer-panel')) return;
    event.preventDefault();
    if (event.touches.length) movePointer(event.touches[0].clientX);
  }, { passive: false });
  ui.game.addEventListener('touchend', () => { pointerDown = false; }, { passive: true });
  ui.game.addEventListener('mousedown', event => {
    if (event.target.closest('button, input, form, .game-answer-panel')) return;
    beginPointer(event.clientX);
  });
  window.addEventListener('mousemove', event => movePointer(event.clientX));
  window.addEventListener('mouseup', () => { pointerDown = false; });
  window.addEventListener('keydown', event => {
    const typing = event.target.closest?.('input, textarea');
    if ((event.key === 'Escape' || (!typing && event.key.toLowerCase() === 'p')) && ['game', 'study'].includes(state.screen)) {
      event.preventDefault();
      state.paused ? resumeSession() : pauseSession();
    }
    if (['ArrowLeft', 'ArrowRight'].includes(event.key) && state.screen === 'game' && ['gate', 'enemyApproach'].includes(state.phase)) event.preventDefault();
    if (['ArrowLeft', 'ArrowRight'].includes(event.key)) heldKeys.add(event.key);
    if (event.key === 'Enter' && state.screen === 'game' && state.phase === 'quiz' && settings.answer === 'input') {
      const value = ui.answerInput.value.trim(); if (value) submitGameAnswer(value);
    }
  });
  window.addEventListener('keyup', event => heldKeys.delete(event.key));
  updateReviewButton();
}

function updateWorldLabels() {
  if (!camera || state.screen !== 'game') return;
  camera.updateMatrixWorld();
  const project = (element, x, y, z) => {
    projectVector.set(x, y, z).project(camera);
    const px = (projectVector.x * .5 + .5) * window.innerWidth;
    const py = (-projectVector.y * .5 + .5) * window.innerHeight;
    element.style.left = `${px}px`;
    element.style.top = `${py}px`;
  };
  project(ui.armyBadge, state.playerX, 3.2, 1.1);
  if (state.enemyCount > 0 && !ui.enemyBadge.hidden) project(ui.enemyBadge, 0, state.index === state.total - 1 ? 6.6 : 3.4, state.enemyZ);
}

function animate(now) {
  requestAnimationFrame(animate);
  if (!renderer || !scene) return;
  const dt = Math.min(.05, state.lastFrame ? (now - state.lastFrame) / 1000 : .016);
  state.lastFrame = now;
  if (!state.paused) state.elapsed += dt;
  if (state.screen === 'game' && !state.paused) updateGame(dt);
  if (!state.paused) updateParticles(dt);
  updateBossCinematic(state.paused ? 0 : dt);
  for (const item of stars) item.crystal.position.y = item.homeY + Math.sin(state.elapsed * 1.7 + item.phase) * .12;
  renderer.render(scene, camera);
  updateWorldLabels();
}

function updateGame(dt) {
  if (state.phase === 'gateDelay') {
    state.waveDelay -= dt;
    if (state.waveDelay <= 0) {
      state.phase = 'gate';
      gateGroup.visible = true;
      ui.gateHint.hidden = false;
      ui.touchControls.hidden = false;
    }
  } else if (state.phase === 'gate') {
    if (heldKeys.has('ArrowLeft')) state.playerX -= dt * 5.4;
    if (heldKeys.has('ArrowRight')) state.playerX += dt * 5.4;
    state.playerX = THREE.MathUtils.clamp(state.playerX, -5.3, 5.3);
    state.gateElapsed += dt;
    state.waveGateZ += dt * state.gateSpeed;
    gateGroup.position.z = state.waveGateZ;
    advanceRoad(dt * state.gateSpeed);
    if (state.waveGateZ >= -.3) {
      const lane = state.playerX < 0 ? state.gateChoices.left : state.gateChoices.right;
      applyGate(lane);
    }
  } else if (state.phase === 'enemyApproach') {
    if (heldKeys.has('ArrowLeft')) state.playerX -= dt * 5.4;
    if (heldKeys.has('ArrowRight')) state.playerX += dt * 5.4;
    state.playerX = THREE.MathUtils.clamp(state.playerX, -5.3, 5.3);
    state.enemyZ += state.enemySpeed * dt;
    state.approachElapsed += dt;
    advanceRoad(dt * state.enemySpeed);
    if (state.enemyZ >= -3.2 || state.approachElapsed >= 12) {
      state.enemyZ = -3.2;
      ui.battleBanner.hidden = true;
      showCollisionQuestion();
    }
  } else if (state.phase === 'battle') {
    state.battleClock += dt;
    state.battleTick += dt;
    if (state.battleTick >= .22) {
      state.battleTick = 0;
      resolveBattleStep();
    }
  } else if (state.phase === 'between' || state.phase === 'celebrate') {
    state.waveDelay -= dt;
    if (state.waveDelay <= 0) {
      if (state.waveAction === 'clear') finishRun(true);
      else {
        state.index++;
        beginWave();
      }
    }
  }
  if (state.gateFlash > 0) state.gateFlash = Math.max(0, state.gateFlash - dt);
  ui.flash.style.opacity = String(Math.max(0, state.gateFlash * 1.9));
  if (warriorPack) updatePack(warriorPack, state.screen === 'game' ? Math.min(state.playerCount, 44) : 0, state.playerX, .6, state.elapsed, 'ally');
  if (wizardPack) {
    const showMinions = state.screen === 'game' && !state.bossCinematic && ['enemyApproach', 'quiz', 'battle'].includes(state.phase);
    updatePack(wizardPack, showMinions ? state.enemyCount : 0, 0, state.enemyZ, state.elapsed, 'enemy');
  }
  emitBossMagic(dt);
}

function advanceRoad(distance) {
  state.roadOffset += distance;
  for (const dash of roadDashes) {
    dash.position.z += distance;
    if (dash.position.z > 12) dash.position.z -= 18 * 7.2;
  }
}

async function loadModels() {
  loader = new GLTFLoader();
  const [warrior, wizard, bossScene] = await Promise.all([
    createInstancedPack('spear-indian-warrior-character.glb', 2.05, 60),
    createInstancedPack('cross-legged-wizard-character.glb', 1.9, 60),
    loader.loadAsync('lunar-arcane-clash-no-space-scene.gltf')
  ]);
  warriorPack = warrior;
  wizardPack = wizard;
  createBossStage(bossScene.scene);
  modelsReady = true;
  updateAssetStatus();
}

function init() {
  installControls();
  updateSettingsUI();
  initThree();
  discoverBgmTracks();
  loadModels().catch(error => {
    console.error(error);
    ui.status.textContent = '3Dモデルを読み込めません。モデルとHTMLを同じフォルダに置き、ネット接続を確認してください。';
    ui.start.disabled = true;
    ui.start.querySelector('span').textContent = '読み込みエラー';
  });
}

init();

// Expose the spelling function for quick inspection in the browser console.
window.numberToFrench = numberToFrench;
