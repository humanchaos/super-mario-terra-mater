const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const sceneCanvas = document.createElement("canvas");
sceneCanvas.width = canvas.width;
sceneCanvas.height = canvas.height;
const sctx = sceneCanvas.getContext("2d");

const glowCanvas = document.createElement("canvas");
glowCanvas.width = canvas.width;
glowCanvas.height = canvas.height;
const gctx = glowCanvas.getContext("2d");

ctx.imageSmoothingEnabled = false;
sctx.imageSmoothingEnabled = false;

const ui = {
  credits: document.getElementById("credits"),
  lives: document.getElementById("lives"),
  progress: document.getElementById("progress"),
  carbon: document.getElementById("carbon"),
  greenness: document.getElementById("greenness"),
  stageText: document.getElementById("stageText")
};

const WORLD_WIDTH = 5600;
const GROUND_Y = 470;
const DAY_LENGTH = 28000;
const TILE = 32;

const PHOTO_FILTERS = [
  "none",
  "sepia(0.55) contrast(1.1)",
  "grayscale(1) contrast(1.2)",
  "saturate(1.35) hue-rotate(-8deg)"
];

const VEHICLES = {
  foot: { label: "Foot", speed: 4.1, jump: -12.5, gravity: 0.58 },
  bike: { label: "Cargo Bike", speed: 5.0, jump: -11.4, gravity: 0.6 },
  ev: { label: "EV", speed: 5.8, jump: -10.8, gravity: 0.63 },
  train: { label: "Train", speed: 6.4, jump: -10.1, gravity: 0.66 }
};

const MINI_GAME_LIBRARY = [
  {
    id: "sort",
    title: "Mini-Game: Sort Recycling",
    prompt: "Press [A] rapidly to sort materials.",
    key: "a",
    target: 18
  },
  {
    id: "route",
    title: "Mini-Game: Optimize Route",
    prompt: "Press [D] rapidly to optimize delivery routes.",
    key: "d",
    target: 20
  },
  {
    id: "thermostat",
    title: "Mini-Game: Set Thermostat",
    prompt: "Press [W] carefully to balance comfort + efficiency.",
    key: "w",
    target: 14
  }
];

function createSoundEngine() {
  const audio = {
    ctx: null,
    master: null,
    unlocked: false,
    muted: false,
    bgmTime: 0,
    bgmStep: 0
  };

  const scale = [60, 64, 67, 72, 67, 64, 62, 64];
  const bass = [48, 48, 55, 55, 53, 53, 50, 50];

  function ensure() {
    if (audio.ctx) return true;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return false;
    audio.ctx = new AudioContextCtor();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.28;
    audio.master.connect(audio.ctx.destination);
    return true;
  }

  function midiToHz(midi) {
    return 440 * 2 ** ((midi - 69) / 12);
  }

  function tone(freq, duration, type = "square", volume = 0.18, when = 0) {
    if (!audio.unlocked || audio.muted || !ensure()) return;
    const t0 = audio.ctx.currentTime + when;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function slide(startFreq, endFreq, duration, type = "square", volume = 0.18, when = 0) {
    if (!audio.unlocked || audio.muted || !ensure()) return;
    const t0 = audio.ctx.currentTime + when;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  function noise(duration = 0.08, volume = 0.1, when = 0) {
    if (!audio.unlocked || audio.muted || !ensure()) return;
    const len = Math.floor(audio.ctx.sampleRate * duration);
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const source = audio.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 900;
    const gain = audio.ctx.createGain();
    const t0 = audio.ctx.currentTime + when;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    source.start(t0);
    source.stop(t0 + duration + 0.02);
  }

  return {
    unlock() {
      if (!ensure()) return;
      if (audio.ctx.state === "suspended") audio.ctx.resume();
      audio.unlocked = true;
      if (audio.bgmTime <= audio.ctx.currentTime) audio.bgmTime = audio.ctx.currentTime + 0.02;
    },
    isUnlocked() {
      return audio.unlocked;
    },
    toggleMute() {
      audio.muted = !audio.muted;
    },
    jump() {
      slide(540, 290, 0.15, "square", 0.18);
    },
    doubleJump() {
      slide(780, 340, 0.17, "triangle", 0.2);
    },
    coin() {
      tone(988, 0.07, "square", 0.16);
      tone(1319, 0.08, "square", 0.13, 0.05);
    },
    stomp() {
      tone(170, 0.09, "triangle", 0.2);
      noise(0.05, 0.08);
    },
    bossHit() {
      tone(220, 0.08, "sawtooth", 0.22);
      tone(164, 0.11, "square", 0.16, 0.07);
    },
    hurt() {
      slide(280, 120, 0.24, "square", 0.2);
      noise(0.08, 0.07, 0.02);
    },
    shield() {
      tone(740, 0.05, "triangle", 0.16);
      tone(1175, 0.07, "triangle", 0.13, 0.06);
    },
    powerup() {
      [660, 784, 988, 1175].forEach((f, i) => tone(f, 0.08, "square", 0.14, i * 0.05));
    },
    dash() {
      noise(0.07, 0.06);
      slide(720, 420, 0.12, "square", 0.14);
    },
    gate() {
      [392, 494, 587].forEach((f, i) => tone(f, 0.1, "triangle", 0.12, i * 0.06));
    },
    miniTick() {
      tone(990, 0.045, "square", 0.1);
    },
    miniSuccess() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.09, "square", 0.14, i * 0.05));
    },
    miniFail() {
      slide(420, 180, 0.22, "square", 0.14);
    },
    storm() {
      noise(0.2, 0.07);
      tone(140, 0.12, "sawtooth", 0.1, 0.05);
    },
    bossIntro() {
      [262, 196, 147].forEach((f, i) => tone(f, 0.18, "sawtooth", 0.12, i * 0.11));
    },
    win() {
      [523, 659, 784, 988, 1319].forEach((f, i) => tone(f, 0.11, "square", 0.16, i * 0.08));
    },
    kitchen() {
      tone(523, 0.05, "triangle", 0.1);
      tone(659, 0.05, "triangle", 0.08, 0.05);
    },
    cutsceneNext() {
      tone(880, 0.04, "square", 0.08);
    },
    updateBgm() {
      if (!audio.unlocked || audio.muted || !ensure()) return;
      if (audio.ctx.state === "suspended") return;
      const stepDur = 0.17;
      const lookAhead = 0.33;
      while (audio.bgmTime < audio.ctx.currentTime + lookAhead) {
        const n = scale[audio.bgmStep % scale.length];
        const b = bass[audio.bgmStep % bass.length];
        tone(midiToHz(n), 0.12, "square", 0.05, audio.bgmTime - audio.ctx.currentTime);
        tone(midiToHz(b), 0.14, "triangle", 0.045, audio.bgmTime - audio.ctx.currentTime + 0.02);
        if (audio.bgmStep % 4 === 2) {
          noise(0.02, 0.025, audio.bgmTime - audio.ctx.currentTime + 0.12);
        }
        audio.bgmStep += 1;
        audio.bgmTime += stepDur;
      }
    }
  };
}

const sound = createSoundEngine();

const keys = { left: false, right: false, up: false };

const stageMilestones = [
  { x: 0, text: "Act I: The Ordinary World — Another day at Terra Mater Studios." },
  { x: 500, text: "Act II: The Call — The mission: become the most sustainable film production company." },
  { x: 980, text: "Act III: The Resistance — Adversaries block the transformation at every turn." },
  { x: 2200, text: "Act IV: Allies Emerge — Good spirits join your cause one by one." },
  { x: 3550, text: "Act V: The Transformation — Your team grows, adversaries crumble." },
  { x: 4700, text: "Act VI: The New World — Terra Mater Studios is a green pioneer." }
];

const playerStart = { x: 80, y: 400 };
const atlas = buildAtlas();

let player;
let platforms;
let credits;
let enemies;
let gates;
let flags;
let decorations;
let particles;
let allies;
let guardians;
let supportTeam;
let powerups;
let storm;
let miniGame;
let unlockedVehicles;
let currentVehicle;
let activePowerups;
let carbonEmitted;
let morale;
let endingText;
let endingKey;
let cutscene;
let cameraX = 0;
let gameWon = false;
let gameLost = false;
let paradeMode = false;
let invulnerableTimer = 0;
let frame = 0;
let dashCooldown = 0;
let photoMode = false;
let photoFilterIndex = 0;
let funnyMistakeCooldown = 0;

let prologuePlayed = false;

function resetGame(fullReset = true) {
  player = {
    x: playerStart.x,
    y: playerStart.y,
    width: 34,
    height: 46,
    vx: 0,
    vy: 0,
    onGround: false,
    doubleJumpUsed: false,
    lives: fullReset ? 3 : player.lives,
    credits: fullReset ? 0 : player.credits,
    facing: 1,
    checkpointX: 80,
    stepPhase: 0
  };

  cameraX = 0;
  invulnerableTimer = 0;
  gameWon = false;
  gameLost = false;
  paradeMode = false;
  frame = 0;
  particles = [];
  allies = [];
  endingText = "";
  endingKey = "compliance";
  cutscene = null;

  carbonEmitted = 68;
  morale = 56;
  dashCooldown = 0;
  funnyMistakeCooldown = 0;

  unlockedVehicles = { foot: true, bike: false, ev: false, train: false };
  currentVehicle = "foot";
  activePowerups = {
    solarShield: 0,
    shieldCharges: 0,
    windDash: 0,
    magnet: 0,
    doubleJump: 0
  };

  guardians = {
    active: false,
    cooldown: 0,
    introduced: false,
    members: [
      { name: "Josy", x: playerStart.x - 26, y: playerStart.y - 60, phase: 0, color: "rgba(138,232,173,1)", introduced: false, introLine: "Josy: I will protect you on this journey!" },
      { name: "Nina", x: playerStart.x + 26, y: playerStart.y - 60, phase: Math.PI, color: "rgba(145,196,255,1)", introduced: false, introLine: "Nina: Together we can make a difference!" }
    ]
  };

  supportTeam = {
    active: false,
    assistTick: 90,
    cleanTick: 210,
    revealedCount: 0,
    allMembers: [
      { name: "Irene", type: "support_irene", x: playerStart.x - 70, y: playerStart.y - 24, phase: 0, role: "warrior", color: "rgba(218,171,255,1)", introduced: false, introLine: "Irene: My expertise is at your service!" },
      { name: "Sirna", type: "support_sirna", x: playerStart.x - 96, y: playerStart.y - 20, phase: Math.PI / 2, role: "warrior", color: "rgba(141,216,255,1)", introduced: false, introLine: "Sirna: Let me help tackle these blockers!" },
      { name: "Denise", type: "support_denise", x: playerStart.x - 122, y: playerStart.y - 16, phase: Math.PI, role: "warrior", color: "rgba(156,245,191,1)", introduced: false, introLine: "Denise: Count me in for the green shift!" },
      { name: "Susanne", type: "support_susanne", x: playerStart.x - 136, y: playerStart.y - 14, phase: Math.PI * 1.2, role: "warrior", color: "rgba(255,196,228,1)", introduced: false, introLine: "Susanne: I will handle communications!" },
      { name: "Traude", type: "support_traude", x: playerStart.x - 142, y: playerStart.y - 10, phase: Math.PI * 1.3, role: "warrior", color: "rgba(187,224,255,1)", introduced: false, introLine: "Traude: Strategy is my middle name!" },
      { name: "Roland", type: "support_roland", x: playerStart.x - 148, y: playerStart.y - 12, phase: Math.PI * 1.4, role: "cleaner", color: "rgba(255,220,152,1)", introduced: false, introLine: "Roland: I will clean up the carbon mess!" }
    ],
    members: []
  };

  storm = {
    type: null,
    timer: 0,
    cooldown: 540
  };

  miniGame = null;

  platforms = [
    { x: 0, y: GROUND_Y, width: 820, height: 100, type: "ground" },
    { x: 900, y: GROUND_Y, width: 650, height: 100, type: "ground" },
    { x: 1640, y: GROUND_Y, width: 500, height: 100, type: "ground" },
    { x: 2220, y: GROUND_Y, width: 810, height: 100, type: "ground" },
    { x: 3130, y: GROUND_Y, width: 780, height: 100, type: "ground" },
    { x: 4020, y: GROUND_Y, width: 610, height: 100, type: "ground" },
    { x: 4700, y: GROUND_Y, width: 600, height: 100, type: "ground" },
    { x: 5400, y: GROUND_Y, width: 1200, height: 100, type: "ground" },
    { x: 290, y: 400, width: 120, height: 16, type: "block" },
    { x: 530, y: 390, width: 110, height: 16, type: "block" },
    { x: 1060, y: 400, width: 140, height: 16, type: "block" },
    { x: 1360, y: 385, width: 110, height: 16, type: "block" },
    { x: 1840, y: 395, width: 120, height: 16, type: "block" },
    { x: 2440, y: 390, width: 130, height: 16, type: "block" },
    { x: 2690, y: 380, width: 120, height: 16, type: "block" },
    { x: 3340, y: 390, width: 130, height: 16, type: "block" },
    { x: 4300, y: 395, width: 150, height: 16, type: "block" },
    { x: 4860, y: 385, width: 130, height: 16, type: "block" },
    { x: 5600, y: 400, width: 160, height: 16, type: "block" },
    { x: 5900, y: 390, width: 140, height: 16, type: "block" },
    { x: 6200, y: 395, width: 130, height: 16, type: "block" }
  ];

  credits = [
    coin(330, 360), coin(560, 350), coin(610, 350), coin(1090, 360), coin(1140, 360),
    coin(1380, 345), coin(1880, 355), coin(2470, 350), coin(2730, 340), coin(3380, 350),
    coin(4340, 355), coin(4890, 345), coin(5200, 420)
  ];

  enemies = [
    enemy(620, 438, 540, 790, "Toni: refuses to stop eating Schnitzel", "toni", 0.85, false, 1, [
      "Schnitzel is non-negotiable!",
      "Plant-based? Not today!"
    ], "Okay fine, I will test veggie Mondays."),
    enemy(1370, 430, 1280, 1560, "CEO Walter: insists on flying the whole crew", "walter", 1.0, true, 3, [
      "Budget over planet!",
      "We always flew the crew!"
    ], "Fine. Local crews + virtual scouting it is."),
    enemy(2190, 430, 2100, 2480, "Markus: prints every script on paper", "markus", 1.2, true, 3, [
      "Digital is unreliable!",
      "I need to hold the pages!"
    ], "Okay, tablets for everyone. Less paper, more trees."),
    enemy(3050, 438, 2960, 3320, "Wolle: we need those printouts", "wolle", 1.0, false, 1, [
      "We need those printouts!!!",
      "Nothing beats paper in your hand!"
    ], "Fine, digital workflows from now on."),
    enemy(3550, 438, 3460, 3780, "Producer: demands diesel generators on set", "commuter", 1.0, false, 1, [
      "Green power is too expensive!",
      "We need reliable generators!"
    ], "Hybrid power trucks accepted. Clean energy on every set."),
    enemy(3920, 438, 3840, 4100, "TV: but we need our DOP to travel", "tv", 0.95, false, 1, [
      "But we need our DOP to travel!",
      "Remote cinematography is impossible!"
    ], "Okay, local DOPs and streaming dailies it is."),
    enemy(4150, 438, 4080, 4350, "Crew member: waste separation? why?", "waste", 0.9, false, 1, [
      "Waste separation? Why?",
      "One bin for everything is easier!"
    ], "Okay, color-coded bins on every set from now on."),
    enemy(4420, 438, 4350, 4600, "Set designer: overuses single-use props", "thermostat", 0.95, false, 1, [
      "Reusable props look cheap!",
      "I need fresh materials!"
    ], "Sustainable prop workshop it is."),
    enemy(5800, 410, 5500, 6400, "Laziness & Complacency: the final obstacle", "finalboss", 0.6, true, 8, [
      "Why change? Everything works fine!",
      "This is how we always did it!",
      "Transformation is too exhausting!",
      "The comfort zone is warm and cozy!"
    ], "We were wrong. Real courage means leaving the comfort zone.")
  ];

  gates = [
    gate(1500, "Cross the Threshold — Commit to the mission", 3, 0),
    gate(3010, "The Ordeal — Prove the concept works", 7, 1),
    gate(4610, "The Final Test — Win over the last holdouts", 10, 2)
  ];

  flags = [{ x: 6480, y: 300, width: 24, height: 170 }];

  powerups = [
    pickup(950, 332, "solar", "Solar Shield"),
    pickup(2080, 425, "wind", "Wind Dash"),
    pickup(2890, 425, "magnet", "Recycling Magnet"),
    pickup(4450, 300, "heat", "Heat-Pump Double Jump")
  ];

  decorations = {
    hills: [
      hill(120, 460, 300, 150, "#5ca366"),
      hill(560, 460, 350, 190, "#6fb372"),
      hill(1320, 460, 300, 145, "#5fa967"),
      hill(2180, 460, 390, 210, "#6fb372"),
      hill(3050, 460, 330, 170, "#5ca366"),
      hill(4020, 460, 360, 190, "#6aa86f"),
      hill(4950, 460, 400, 220, "#72b879")
    ],
    skyline: [
      building(420, 350, 90, 130), building(980, 300, 140, 180), building(1880, 280, 100, 200),
      building(3320, 320, 120, 160), building(4380, 270, 150, 210)
    ],
    trees: [
      tree(740, 420, 1.1), tree(1220, 420, 1), tree(2100, 420, 1.2), tree(2860, 420, 1.05),
      tree(3580, 420, 1.1), tree(5140, 420, 1.2)
    ],
    turbines: [turbine(1700, 250, 90), turbine(3720, 230, 105), turbine(4520, 240, 98)],
    solar: [panel(2320, 435, 70), panel(2380, 435, 70), panel(2440, 435, 70), panel(2500, 435, 70), panel(2560, 435, 70)]
  };

  updateHud();

  // Opening prologue cutscene on first-ever start only
  if (fullReset && !prologuePlayed) {
    prologuePlayed = true;
    cutscene = {
      active: true,
      type: "prologue",
      title: "Prologue — Terra Mater Studios",
      pages: [
        "Another ordinary day at Terra Mater Studios. Coffee in hand, scripts on the desk.",
        "But a bold vision takes hold: What if we became the most sustainable film production company in the world?",
        "The journey begins. Not everyone will be on board — but every transformation starts with one step."
      ],
      index: 0,
      portraits: [{ name: "Mario", type: "mario" }]
    };
  }
}

function coin(x, y) {
  return { x, y, radius: 11, collected: false, wobble: Math.random() * Math.PI * 2 };
}

function enemy(x, y, minX, maxX, label, type, speed, boss, hp, lines, convertedLine) {
  const isFinal = type === "finalboss";
  return {
    x,
    y: isFinal ? y - 24 : y,
    width: isFinal ? 70 : boss ? 40 : 34,
    height: isFinal ? 64 : boss ? 38 : 32,
    vx: speed,
    minX,
    maxX,
    label,
    type,
    boss,
    hp,
    maxHp: hp,
    lines,
    convertedLine,
    alive: true,
    converted: false,
    introduced: false,
    phase: Math.random() * Math.PI * 2,
    talkCooldown: 140 + Math.floor(Math.random() * 220)
  };
}

function pickup(x, y, type, label) {
  return { x, y, type, label, collected: false, pulse: Math.random() * Math.PI * 2 };
}

function gate(x, label, requiredCredits, miniGameIndex) {
  return {
    x,
    y: GROUND_Y - 120,
    width: 26,
    height: 120,
    label,
    requiredCredits,
    passed: false,
    miniGameIndex,
    miniGameDone: false,
    miniGameRetryCooldown: 0
  };
}

function hill(x, y, width, height, color) {
  return { x, y, width, height, color };
}

function building(x, y, width, height) {
  return { x, y, width, height };
}

function tree(x, y, scale) {
  return { x, y, scale };
}

function turbine(x, y, size) {
  return { x, y, size };
}

function panel(x, y, width) {
  return { x, y, width };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getGreennessFactor() {
  return 1 - clamp(carbonEmitted / 100, 0, 1);
}

function getVehicleStats() {
  return VEHICLES[currentVehicle] || VEHICLES.foot;
}

function getPhysics() {
  const base = getVehicleStats();
  let speed = base.speed;
  let jump = base.jump;
  let gravity = base.gravity;

  const moraleFactor = 0.82 + (morale / 100) * 0.36;
  speed *= moraleFactor;

  if (allies.length > 0) {
    speed += Math.min(0.85, allies.length * 0.12);
  }

  if (storm.type === "flood") {
    speed *= 0.84;
    gravity *= 0.92;
  }
  if (storm.type === "heatwave") {
    jump *= 0.88;
    gravity *= 1.1;
  }
  if (storm.type === "smog") {
    speed *= 0.9;
  }

  if (activePowerups.windDash > 0) speed *= 1.1;

  return { speed, jump, gravity };
}

function updateHud() {
  ui.credits.textContent = String(player.credits);
  ui.lives.textContent = String(player.lives);

  const transformed = Math.min(100, Math.round((player.credits / 13) * 72 + gates.filter((g) => g.passed).length * 9.5 + allies.length * 2));
  const greenness = Math.round(getGreennessFactor() * 100);

  ui.progress.textContent = `${gameWon ? 100 : transformed}%`;
  ui.carbon.textContent = `${Math.round(carbonEmitted)} tCO2e`;
  ui.greenness.textContent = `${greenness}%`;

  let activeStage = stageMilestones[0].text;
  for (const stage of stageMilestones) {
    if (player.x >= stage.x) activeStage = stage.text;
  }

  const lockedGate = gates.find((g) => !g.passed && Math.abs(g.x - player.x) < 140);
  if (lockedGate && player.credits < lockedGate.requiredCredits) {
    activeStage = `Challenge Gate: ${lockedGate.label}. Need ${lockedGate.requiredCredits} credits.`;
  }

  if (miniGame) {
    activeStage = `${miniGame.title} - ${miniGame.progress}/${miniGame.target} before timer ends.`;
  }

  const activePower = [];
  if (activePowerups.solarShield > 0) activePower.push(`Solar Shield x${activePowerups.shieldCharges}`);
  if (activePowerups.windDash > 0) activePower.push("Wind Dash");
  if (activePowerups.magnet > 0) activePower.push("Recycling Magnet");
  if (activePowerups.doubleJump > 0) activePower.push("Heat-Pump Double Jump");

  if (guardians.active) activeStage = "Act IV: Josy and Nina joined the transformation team.";
  if (supportTeam.active && supportTeam.members.length > 0) activeStage = `Act IV: ${supportTeam.members.length} allies have joined the cause.`;
  if (allies.length) activeStage = `Act V: ${allies.length} former adversaries now fight alongside you. The team grows!`;
  if (activePower.length) activeStage += ` Power-ups: ${activePower.join(", ")}.`;

  if (storm.type) activeStage = `Carbon Storm (${storm.type}) active. Adapt quickly.`;
  if (photoMode) activeStage = `Photo Mode [P]: paused. [F] filter ${photoFilterIndex + 1}/${PHOTO_FILTERS.length}, [C] capture.`;
  if (cutscene && cutscene.active) activeStage = "Cutscene active: press Enter/Space to continue.";

  if (gameLost) activeStage = "The resistance won this round. Press R to begin the journey again.";
  if (gameWon) activeStage = `Act VI: ${endingText} Parade mode — the team celebrates together.`;

  ui.stageText.textContent = activeStage;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function spawnDust(x, y, count = 4) {
  for (let i = 0; i < count; i += 1) {
    particles.push({ x, y, vx: (Math.random() - 0.5) * 2.2, vy: -Math.random() * 1.4, life: 22 + Math.random() * 12, maxLife: 34, color: "rgba(180,130,85,1)", size: 2 + Math.random() * 2, glow: false, anchored: false });
  }
}

function spawnSparkle(x, y, color) {
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8;
    particles.push({ x, y, vx: Math.cos(angle) * (1.2 + Math.random() * 1.8), vy: Math.sin(angle) * (1.2 + Math.random() * 1.8), life: 28, maxLife: 28, color, size: 2.2, glow: true, anchored: false });
  }
}

function spawnDialogue(text, worldX, worldY, tint = "rgba(255,255,255,1)") {
  particles.push({
    x: worldX,
    y: worldY,
    vx: 0,
    vy: -0.04,
    life: 240,
    maxLife: 240,
    color: tint,
    size: 0,
    glow: false,
    anchored: true,
    text,
    textColor: tint
  });
}

function maybeUnlockVehicles() {
  if (allies.length >= 1) unlockedVehicles.bike = true;
  if (allies.length >= 3) unlockedVehicles.ev = true;
  if (allies.length >= 5) unlockedVehicles.train = true;

  if (unlockedVehicles.train) currentVehicle = "train";
  else if (unlockedVehicles.ev) currentVehicle = "ev";
  else if (unlockedVehicles.bike) currentVehicle = "bike";
  else currentVehicle = "foot";
}

function applyInput() {
  player.vx = 0;
  const physics = getPhysics();

  if (keys.left) {
    player.vx = -physics.speed;
    player.facing = -1;
  }
  if (keys.right) {
    player.vx = physics.speed;
    player.facing = 1;
  }

  if (keys.up && player.onGround) {
    player.vy = physics.jump;
    player.onGround = false;
    player.doubleJumpUsed = false;
    spawnDust(player.x + player.width / 2, player.y + player.height, 6);
    sound.jump();
  } else if (keys.up && !player.onGround && activePowerups.doubleJump > 0 && !player.doubleJumpUsed) {
    player.vy = physics.jump * 0.95;
    player.doubleJumpUsed = true;
    spawnSparkle(player.x + player.width / 2, player.y + player.height / 2, "rgba(255,145,84,1)");
    sound.doubleJump();
  }

  if (morale < 32 && funnyMistakeCooldown <= 0 && Math.random() < 0.006) {
    funnyMistakeCooldown = 120;
    player.vx += (Math.random() > 0.5 ? 1 : -1) * 2.6;
    spawnDialogue("Oops, coffee spill!", player.x - 12, player.y - 14, "rgba(255,236,188,1)");
  }
}

function handlePlatforms() {
  player.onGround = false;
  player.x += player.vx;

  for (const plat of platforms) {
    if (!rectsOverlap(player, plat)) continue;
    if (player.vx > 0) player.x = plat.x - player.width;
    else if (player.vx < 0) player.x = plat.x + plat.width;
  }

  const physics = getPhysics();
  player.vy += physics.gravity;
  player.y += player.vy;

  for (const plat of platforms) {
    if (!rectsOverlap(player, plat)) continue;

    if (player.vy > 0) {
      if (!player.onGround && player.vy > 4) spawnDust(player.x + player.width / 2, plat.y, 5);
      player.y = plat.y - player.height;
      player.vy = 0;
      player.onGround = true;
      player.doubleJumpUsed = false;
    } else if (player.vy < 0) {
      player.y = plat.y + plat.height;
      player.vy = 0;
    }
  }

  if (player.y > canvas.height + 140) loseLife();

  player.x = Math.max(0, Math.min(WORLD_WIDTH - player.width, player.x));
}

function handlePowerups() {
  for (const p of powerups) {
    if (p.collected) continue;

    const r = { x: p.x - 14, y: p.y - 14, width: 28, height: 28 };
    if (!rectsOverlap(player, r)) continue;

    p.collected = true;
    morale = clamp(morale + 8, 0, 100);

    if (p.type === "solar") {
      activePowerups.solarShield = 1800;
      activePowerups.shieldCharges = 2;
      spawnDialogue("Solar shield online.", p.x - 35, p.y - 20, "rgba(255,227,140,1)");
    }
    if (p.type === "wind") {
      activePowerups.windDash = 1700;
      spawnDialogue("Wind dash unlocked.", p.x - 35, p.y - 20, "rgba(154,215,255,1)");
    }
    if (p.type === "magnet") {
      activePowerups.magnet = 1700;
      spawnDialogue("Recycling magnet active.", p.x - 45, p.y - 20, "rgba(136,255,177,1)");
    }
    if (p.type === "heat") {
      activePowerups.doubleJump = 2200;
      spawnDialogue("Heat-pump double jump enabled.", p.x - 55, p.y - 20, "rgba(255,176,138,1)");
    }

    spawnSparkle(p.x, p.y, "rgba(111,255,182,1)");
    sound.powerup();
  }

  activePowerups.solarShield = Math.max(0, activePowerups.solarShield - 1);
  activePowerups.windDash = Math.max(0, activePowerups.windDash - 1);
  activePowerups.magnet = Math.max(0, activePowerups.magnet - 1);
  activePowerups.doubleJump = Math.max(0, activePowerups.doubleJump - 1);

  if (activePowerups.solarShield <= 0) activePowerups.shieldCharges = 0;
}

function handleCredits() {
  for (const c of credits) {
    if (c.collected) continue;

    if (activePowerups.magnet > 0) {
      const dx = player.x + player.width / 2 - c.x;
      const dy = player.y + player.height / 2 - c.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 180) {
        c.x += dx * 0.03;
        c.y += dy * 0.03;
      }
    }

    const nearX = player.x + player.width / 2 > c.x - c.radius && player.x < c.x + c.radius;
    const nearY = player.y + player.height > c.y - c.radius && player.y < c.y + c.radius;
    if (nearX && nearY) {
      c.collected = true;
      player.credits += 1;
      morale = clamp(morale + 1.5, 0, 100);
      carbonEmitted = clamp(carbonEmitted - 2.2, 0, 100);
      spawnSparkle(c.x, c.y, "rgba(255,214,85,1)");
      sound.coin();
      updateHud();
    }
  }
}

function handleEnemies() {
  for (const mob of enemies) {
    if (!mob.alive) continue;

    if (mob.boss && !mob.introduced && Math.abs(player.x - mob.x) < 240) {
      mob.introduced = true;
      startBossIntroCutscene(mob);
      return;
    }

    mob.phase += 0.05;
    mob.x += mob.vx;
    if (mob.x <= mob.minX || mob.x + mob.width >= mob.maxX) mob.vx *= -1;

    // Final boss throws barrel projectiles
    if (mob.type === "finalboss" && mob.alive) {
      if (!mob.barrelTimer) mob.barrelTimer = 0;
      mob.barrelTimer += 1;
      if (mob.barrelTimer >= 90) {
        mob.barrelTimer = 0;
        const dirX = player.x < mob.x ? -3.5 : 3.5;
        particles.push({
          x: mob.x + mob.width / 2,
          y: mob.y + mob.height / 2,
          vx: dirX + (Math.random() - 0.5),
          vy: -2,
          life: 180,
          maxLife: 180,
          color: "rgba(139,69,19,1)",
          size: 12,
          glow: false,
          barrel: true
        });
      }
    }

    mob.talkCooldown -= 1;
    if (mob.talkCooldown <= 0) {
      mob.talkCooldown = 180 + Math.floor(Math.random() * 220);
      const line = mob.lines[Math.floor(Math.random() * mob.lines.length)];
      spawnDialogue(line, mob.x - 26, mob.y - 12, "rgba(255,245,220,1)");
    }

    if (!rectsOverlap(player, mob)) continue;

    const stomping = player.vy > 0 && player.y + player.height - mob.y < 20;
    if (stomping) {
      if (mob.boss && mob.hp > 1) {
        mob.hp -= 1;
        player.vy = -8;
        morale = clamp(morale + 2, 0, 100);
        carbonEmitted = clamp(carbonEmitted - 3.2, 0, 100);
        spawnSparkle(mob.x + mob.width / 2, mob.y + mob.height / 2, "rgba(255,167,108,1)");
        spawnDialogue(`Boss hit! ${mob.hp} phases left.`, mob.x - 20, mob.y - 18, "rgba(255,209,164,1)");
        sound.bossHit();
      } else {
        convertEnemyToAlly(mob);
        player.vy = -8;
        spawnSparkle(mob.x + mob.width / 2, mob.y + mob.height / 2, "rgba(87,232,163,1)");
      }
    } else if (guardians.active && guardians.cooldown <= 0) {
      convertEnemyToAlly(mob);
      guardians.cooldown = 42;
      spawnSparkle(mob.x + mob.width / 2, mob.y + mob.height / 2, "rgba(145,196,255,1)");
    } else if (invulnerableTimer <= 0) {
      loseLife();
    }
  }
}

function startMiniGame(gateObj) {
  const config = MINI_GAME_LIBRARY[gateObj.miniGameIndex % MINI_GAME_LIBRARY.length];
  miniGame = {
    ...config,
    gateX: gateObj.x,
    gateLabel: gateObj.label,
    timer: 20 * 60,
    progress: 0
  };
  spawnDialogue(config.title, player.x - 30, player.y - 24, "rgba(222,236,255,1)");
  sound.miniTick();
}

function handleMiniGameTick() {
  if (!miniGame) return;

  miniGame.timer -= 1;
  if (miniGame.timer <= 0) {
    morale = clamp(morale - 12, 0, 100);
    const gateObj = gates.find((g) => g.x === miniGame.gateX);
    if (gateObj) gateObj.miniGameRetryCooldown = 180;
    spawnDialogue("Mini-game failed. Try again.", player.x - 40, player.y - 24, "rgba(255,170,170,1)");
    sound.miniFail();
    miniGame = null;
  }
}

function handleGates() {
  for (const g of gates) {
    g.miniGameRetryCooldown = Math.max(0, g.miniGameRetryCooldown - 1);
    if (g.passed) continue;

    const gateRect = { x: g.x, y: g.y, width: g.width, height: g.height };
    if (!rectsOverlap(player, gateRect)) continue;

    if (player.credits < g.requiredCredits) {
      if (player.vx > 0) player.x = g.x - player.width;
      else if (player.vx < 0) player.x = g.x + g.width;
      continue;
    }

    if (!g.miniGameDone) {
      if (!miniGame && g.miniGameRetryCooldown <= 0) startMiniGame(g);
      if (player.vx > 0) player.x = g.x - player.width;
      else if (player.vx < 0) player.x = g.x + g.width;
      continue;
    }

    g.passed = true;
    player.checkpointX = g.x + 60;
    morale = clamp(morale + 7, 0, 100);
    carbonEmitted = clamp(carbonEmitted - 4.5, 0, 100);
    spawnSparkle(g.x + g.width / 2, g.y + 20, "rgba(111,255,182,1)");
    sound.gate();
    updateHud();
  }
}

function handleFlag() {
  const flag = flags[0];
  if (!flag || gameWon) return;

  if (rectsOverlap(player, flag) && gates.every((g) => g.passed)) {
    gameWon = true;
    paradeMode = true;
    const ending = getEndingOutcome();
    endingText = ending.text;
    endingKey = ending.key;
    spawnSparkle(flag.x + 20, flag.y + 12, "rgba(80,255,140,1)");
    spawnDialogue(endingText, flag.x - 80, flag.y - 25, "rgba(222,255,233,1)");
    startEndingEpilogueCutscene(ending);
    sound.win();
    updateHud();
  }
}

function getEndingOutcome() {
  if (carbonEmitted < 24 && allies.length >= 5) {
    return {
      key: "regeneration",
      text: "The Return: Terra Mater Studios becomes a beacon of sustainable filmmaking.",
      pages: [
        "Every set runs on clean energy. Every crew member is an ambassador.",
        "Former adversaries became the loudest champions of change.",
        "Terra Mater Studios is now a model for the entire industry."
      ]
    };
  }
  if (carbonEmitted < 45 && allies.length >= 3) {
    return {
      key: "transition",
      text: "The Transformation: The company changed for good, one ally at a time.",
      pages: [
        "The transformation held strong even under industry pressure.",
        "Teams aligned on action instead of excuses.",
        "Terra Mater moved from ambition to lasting implementation."
      ]
    };
  }
  return {
    key: "compliance",
    text: "Partial Victory: The seed is planted, but deep change needs a second season.",
    pages: [
      "Some habits shifted, and awareness spread across the company.",
      "But not every adversary was convinced — resistance lingers.",
      "The hero's journey is not over. A sequel awaits."
    ]
  };
}

function startBossIntroCutscene(mob) {
  const label = mob.label.split(":")[0];
  const isFinalBoss = mob.type === "finalboss";

  const pages = isFinalBoss
    ? [
      "A massive shadow blocks the path. It is Laziness & Complacency — the final obstacle.",
      "This is the enemy that lives inside every company. It whispers: Why change?",
      "But your entire team is here now. Guardians, allies, support — everyone stands together.",
      "Jump on top repeatedly. It will take many hits. This is the ultimate test!"
    ]
    : [
      `${label} stands in the way of transformation.`,
      "Defeat all phases by jumping on top with precise timing.",
      "Every hero faces resistance. Press Enter to continue."
    ];

  const portraits = [{ name: label, type: mob.type }, { name: "Mario", type: "mario" }];
  if (isFinalBoss) {
    guardians.members.forEach((g) => portraits.push({ name: g.name, type: "guardian_" + g.name.toLowerCase() }));
    allies.slice(0, 3).forEach((a) => portraits.push({ name: a.name, type: a.type }));
  }

  cutscene = {
    active: true,
    type: "boss_intro",
    title: isFinalBoss ? "FINAL BOSS — Laziness & Complacency" : `${label} — A Major Adversary Appears`,
    pages,
    index: 0,
    portraits
  };
  sound.bossIntro();
}

function startEndingEpilogueCutscene(ending) {
  const portraits = [{ name: "Mario", type: "mario" }];
  if (supportTeam.active) {
    portraits.push({ name: "Irene", type: "support_irene" });
    portraits.push({ name: "Sirna", type: "support_sirna" });
    portraits.push({ name: "Denise", type: "support_denise" });
    portraits.push({ name: "Roland", type: "support_roland" });
  }
  portraits.push({ name: "Josy", type: "guardian_josy" });
  portraits.push({ name: "Nina", type: "guardian_nina" });
  allies.slice(0, 4).forEach((ally) => portraits.push({ name: ally.name, type: ally.type }));

  cutscene = {
    active: true,
    type: "ending_epilogue",
    title: "Epilogue - Terra Mater Studios",
    pages: ending.pages,
    index: 0,
    portraits
  };
}

function advanceCutscene() {
  if (!cutscene || !cutscene.active) return;
  sound.cutsceneNext();
  cutscene.index += 1;
  if (cutscene.index >= cutscene.pages.length) {
    cutscene = null;
  }
}

function loseLife() {
  if (activePowerups.shieldCharges > 0 && activePowerups.solarShield > 0) {
    activePowerups.shieldCharges -= 1;
    invulnerableTimer = 120;
    spawnDialogue("Solar shield absorbed impact.", player.x - 40, player.y - 20, "rgba(255,234,155,1)");
    spawnSparkle(player.x + player.width / 2, player.y + player.height / 2, "rgba(255,224,104,1)");
    sound.shield();
    return;
  }

  player.lives -= 1;
  morale = clamp(morale - 14, 0, 100);

  if (player.lives <= 1 && !guardians.active) {
    activateGuardians();
  }

  if (player.lives <= 0) {
    gameLost = true;
    player.lives = 0;
  }

  carbonEmitted = clamp(carbonEmitted + 6.2, 0, 100);
  spawnSparkle(player.x + player.width / 2, player.y + player.height / 2, "rgba(255,120,120,1)");
  sound.hurt();
  player.x = player.checkpointX;
  player.y = 350;
  player.vx = 0;
  player.vy = 0;
  invulnerableTimer = 90;
  updateHud();
}

function convertEnemyToAlly(mob) {
  mob.alive = false;
  mob.converted = true;
  carbonEmitted = clamp(carbonEmitted - 7.5, 0, 100);
  morale = clamp(morale + 10, 0, 100);
  const creditReward = mob.boss ? 3 : 2;
  player.credits += creditReward;
  allies.push({
    name: mob.label.split(":")[0],
    type: mob.type,
    x: mob.x,
    y: mob.y,
    phase: Math.random() * Math.PI * 2
  });
  maybeUnlockVehicles();
  spawnDialogue(`+${creditReward} credits! ${mob.convertedLine}`, mob.x - 42, mob.y - 20, "rgba(178,255,209,1)");
  sound.stomp();
  updateHud();
}

function updateAllies() {
  allies.forEach((ally, index) => {
    const targetX = player.x - (index + 1) * 42;
    const targetY = player.y + 2 + Math.sin(frame * 0.04 + index) * 2;
    ally.x += (targetX - ally.x) * 0.12;
    ally.y += (targetY - ally.y) * 0.18;
    ally.phase += 0.04;
  });

  // Activate guardians after first ally is converted
  if (allies.length >= 1 && !guardians.active) {
    activateGuardians();
  }

  // Gradually reveal support team members as more allies join
  if (allies.length >= 2 && !supportTeam.active) {
    supportTeam.active = true;
  }
  if (supportTeam.active) {
    const targetCount = Math.min(supportTeam.allMembers.length, allies.length);
    while (supportTeam.revealedCount < targetCount) {
      const member = supportTeam.allMembers[supportTeam.revealedCount];
      supportTeam.members.push(member);
      supportTeam.revealedCount += 1;
      if (!member.introduced) {
        member.introduced = true;
        spawnDialogue(member.introLine, player.x - 40, player.y - 30 - supportTeam.revealedCount * 8, member.color);
        spawnSparkle(player.x, player.y - 10, member.color);
      }
    }
  }
}

function activateGuardians() {
  guardians.active = true;
  guardians.members.forEach((guardian) => {
    if (!guardian.introduced) {
      guardian.introduced = true;
      spawnDialogue(guardian.introLine, player.x - 35, player.y - 26, guardian.color);
      spawnSparkle(player.x, player.y, guardian.color);
    }
  });
}

function updateGuardians() {
  if (!guardians.active) return;
  guardians.cooldown = Math.max(0, guardians.cooldown - 1);
  guardians.members.forEach((guardian, i) => {
    guardian.phase += 0.018 + i * 0.004;
    const radius = 34 + i * 8;
    guardian.x = player.x + player.width / 2 + Math.cos(guardian.phase) * radius;
    guardian.y = player.y - 18 + Math.sin(guardian.phase * 1.2) * 14;
  });
}

function maybeActivateSupportTeam() {
  // Support team now activates gradually via updateAllies based on ally count
}

function updateSupportTeam() {
  if (!supportTeam.active || supportTeam.members.length === 0) return;

  supportTeam.members.forEach((member, i) => {
    member.phase += 0.02 + i * 0.004;
    const radius = 58 + i * 16;
    member.x = player.x + player.width / 2 - 24 + Math.cos(member.phase) * radius;
    member.y = player.y - 8 + Math.sin(member.phase * 1.25) * (10 + i * 1.5);
  });

  supportTeam.assistTick -= 1;
  if (supportTeam.assistTick <= 0) {
    const target = enemies.find((mob) => mob.alive && Math.abs(mob.x - player.x) < 520);
    if (target) {
      if (target.boss && target.hp > 1) {
        target.hp -= 1;
        morale = clamp(morale + 3, 0, 100);
        carbonEmitted = clamp(carbonEmitted - 2.4, 0, 100);
        spawnSparkle(target.x + target.width / 2, target.y + target.height / 2, "rgba(168,219,255,1)");
        spawnDialogue("Support strike! Boss pressure reduced.", target.x - 35, target.y - 20, "rgba(210,231,255,1)");
      } else {
        convertEnemyToAlly(target);
        spawnDialogue("Support squad converted a blocker.", target.x - 34, target.y - 20, "rgba(177,255,211,1)");
      }
    }
    supportTeam.assistTick = 110;
  }

  supportTeam.cleanTick -= 1;
  if (supportTeam.cleanTick <= 0) {
    morale = clamp(morale + 5, 0, 100);
    carbonEmitted = clamp(carbonEmitted - 2.8, 0, 100);
    const roland = supportTeam.members.find((m) => m.name === "Roland");
    if (roland) {
      spawnDialogue("Roland leads by example and cleans the kitchen.", roland.x - 58, roland.y - 24, "rgba(255,236,188,1)");
      spawnSparkle(roland.x + 10, roland.y + 12, "rgba(255,220,152,1)");
      sound.kitchen();
    }
    supportTeam.cleanTick = 360;
  }
}

function updateCarbonDynamics() {
  const activeAdversaries = enemies.filter((mob) => mob.alive).length;
  const teamBenefit = allies.length * 0.0032;
  const gateBenefit = gates.filter((g) => g.passed).length * 0.0023;
  const guardianBenefit = guardians.active ? 0.004 : 0;
  const supportBenefit = supportTeam.active ? 0.0055 : 0;

  carbonEmitted += activeAdversaries * 0.0024;
  carbonEmitted -= teamBenefit + gateBenefit + guardianBenefit + supportBenefit;

  if (storm.type === "heatwave") carbonEmitted += 0.018;
  if (storm.type === "flood") carbonEmitted += 0.012;

  carbonEmitted = clamp(carbonEmitted, 0, 100);
}

function updateMoraleDynamics() {
  const allyBoost = allies.length * 0.009;
  const stormPenalty = storm.type ? 0.016 : 0;
  morale += allyBoost;
  morale -= stormPenalty;
  morale = clamp(morale, 0, 100);
  funnyMistakeCooldown = Math.max(0, funnyMistakeCooldown - 1);
}

function updateStorms() {
  if (storm.timer > 0) {
    storm.timer -= 1;
    if (storm.timer <= 0) {
      storm.type = null;
      storm.cooldown = 700;
      spawnDialogue("Carbon storm cleared.", player.x - 30, player.y - 25, "rgba(198,255,222,1)");
    }
    return;
  }

  storm.cooldown = Math.max(0, storm.cooldown - 1);
  if (storm.cooldown > 0) return;

  if (carbonEmitted > 70 && Math.random() < 0.006) {
    const types = ["smog", "flood", "heatwave"];
    storm.type = types[Math.floor(Math.random() * types.length)];
    storm.timer = 520;
    spawnDialogue(`Carbon Storm: ${storm.type.toUpperCase()}`, player.x - 28, player.y - 32, "rgba(255,223,186,1)");
    sound.storm();
  }
}

function updateParade() {
  if (!paradeMode || !gameWon) return;
  player.vx = 2.8;
  player.facing = 1;
  player.x = Math.min(WORLD_WIDTH - 120, player.x + player.vx);

  if (frame % 14 === 0) {
    const colors = ["rgba(255,110,110,1)", "rgba(105,206,255,1)", "rgba(122,244,150,1)", "rgba(255,230,90,1)"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    spawnSparkle(player.x + 20, player.y - 20, color);
  }
}

function updateParticles() {
  particles = particles.filter((p) => p.life > 0);
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.barrel) {
      p.vy += 0.15; // gravity for barrels
      // Bounce off ground
      if (p.y >= GROUND_Y - 6) {
        p.y = GROUND_Y - 6;
        p.vy = -Math.abs(p.vy) * 0.5;
      }
      // Damage player on collision
      if (invulnerableTimer <= 0 &&
        Math.abs(p.x - player.x - player.width / 2) < 22 &&
        Math.abs(p.y - player.y - player.height / 2) < 22) {
        loseLife();
        p.life = 0;
      }
    } else {
      if (!p.anchored) p.vy += 0.05;
    }
    p.vx *= 0.99;
    p.life -= 1;
  }
}

function updateCamera() {
  const target = player.x - canvas.width * 0.35;
  cameraX = Math.max(0, Math.min(WORLD_WIDTH - canvas.width, target));
}

function getDayRatio() {
  return (performance.now() % DAY_LENGTH) / DAY_LENGTH;
}

function drawBackground() {
  const dayRatio = getDayRatio();
  const greenness = getGreennessFactor();

  // Act-based color tinting
  const actProgress = clamp(player.x / 6480, 0, 1);
  const greyTint = 1 - actProgress; // 1.0 at start (grey office), 0.0 at end (green nature)
  const skyTop = lerpColor([73, 143, 235], [255, 129, 104], Math.sin(dayRatio * Math.PI) * 0.35 + 0.2);
  const skyBottom = lerpColor([196, 234, 255], [255, 199, 165], Math.sin(dayRatio * Math.PI) * 0.3);
  const actSkyTop = lerpColor(skyTop, [140, 150, 160], greyTint * 0.4);
  const actSkyBottom = lerpColor(skyBottom, [180, 185, 190], greyTint * 0.3);
  const ecoSkyTop = lerpColor(actSkyTop, [60, 166, 118], greenness * 0.2);
  const ecoSkyBottom = lerpColor(actSkyBottom, [197, 247, 210], greenness * 0.35);

  const gradient = sctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, rgb(ecoSkyTop));
  gradient.addColorStop(1, rgb(ecoSkyBottom));
  sctx.fillStyle = gradient;
  sctx.fillRect(0, 0, canvas.width, canvas.height);

  const sunX = canvas.width * (0.15 + dayRatio * 0.7);
  const sunY = 95 + Math.sin(dayRatio * Math.PI * 2) * 20;
  const sunGrad = sctx.createRadialGradient(sunX, sunY, 12, sunX, sunY, 80);
  sunGrad.addColorStop(0, "rgba(255,248,205,0.95)");
  sunGrad.addColorStop(1, "rgba(255,210,140,0)");
  sctx.fillStyle = sunGrad;
  sctx.beginPath();
  sctx.arc(sunX, sunY, 80, 0, Math.PI * 2);
  sctx.fill();

  glowScreen(sunX, sunY, 70, "rgba(255,220,120,0.55)");

  for (let i = 0; i < 9; i += 1) {
    const cloudX = ((i * 190 - cameraX * (0.16 + (i % 3) * 0.03)) % (canvas.width + 300)) - 120;
    const cloudY = 65 + (i % 4) * 38 + Math.sin(frame * 0.01 + i) * 4;
    drawCloud(cloudX, cloudY, 0.8 + (i % 3) * 0.2, 0.75);
  }

  drawHills();
  drawSkyline();
  drawEcoProps();

  const groundTop = rgb(lerpColor(lerpColor([122, 149, 88], [160, 160, 155], greyTint * 0.5), [93, 206, 105], greenness));
  const groundBottom = rgb(lerpColor(lerpColor([79, 95, 64], [110, 110, 105], greyTint * 0.4), [54, 142, 67], greenness));
  const groundGrad = sctx.createLinearGradient(0, GROUND_Y + 40, 0, canvas.height);
  groundGrad.addColorStop(0, groundTop);
  groundGrad.addColorStop(1, groundBottom);
  sctx.fillStyle = groundGrad;
  sctx.fillRect(0, GROUND_Y + 40, canvas.width, canvas.height - GROUND_Y - 40);

  if (storm.type === "smog") {
    sctx.fillStyle = "rgba(125,130,120,0.26)";
    sctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (storm.type === "heatwave") {
    sctx.fillStyle = "rgba(255,145,94,0.14)";
    sctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (storm.type === "flood") {
    sctx.fillStyle = "rgba(80,148,214,0.18)";
    sctx.fillRect(0, GROUND_Y + 14, canvas.width, canvas.height - GROUND_Y - 14);
  }
}

function drawCloud(x, y, scale, alpha) {
  sctx.fillStyle = `rgba(255,255,255,${alpha})`;
  sctx.beginPath();
  sctx.arc(x, y, 24 * scale, 0, Math.PI * 2);
  sctx.arc(x + 25 * scale, y - 6 * scale, 18 * scale, 0, Math.PI * 2);
  sctx.arc(x + 48 * scale, y + 3 * scale, 20 * scale, 0, Math.PI * 2);
  sctx.arc(x + 70 * scale, y + 1 * scale, 16 * scale, 0, Math.PI * 2);
  sctx.fill();
}

function drawHills() {
  const greenness = getGreennessFactor();

  // Far mountain layer (slowest parallax)
  const farMountains = [
    { x: 200, y: 440, w: 500, h: 200 },
    { x: 900, y: 440, w: 600, h: 240 },
    { x: 1800, y: 440, w: 450, h: 180 },
    { x: 2600, y: 440, w: 550, h: 220 },
    { x: 3600, y: 440, w: 500, h: 200 },
    { x: 4800, y: 440, w: 600, h: 250 }
  ];
  for (const m of farMountains) {
    const drawX = m.x - cameraX * 0.15;
    sctx.fillStyle = mixHex("#8a9aaa", "#6aaa7a", greenness * 0.5);
    sctx.globalAlpha = 0.35;
    sctx.beginPath();
    sctx.ellipse(drawX, m.y, m.w, m.h, 0, Math.PI, Math.PI * 2);
    sctx.fill();
    sctx.globalAlpha = 1;
  }

  // Mid hills (original layer, slightly adjusted parallax)
  for (const h of decorations.hills) {
    const drawX = h.x - cameraX * 0.35;
    sctx.fillStyle = mixHex(h.color, "#4fd173", greenness * 0.7);
    sctx.beginPath();
    sctx.ellipse(drawX, h.y, h.width, h.height, 0, Math.PI, Math.PI * 2);
    sctx.fill();

    sctx.fillStyle = "rgba(255,255,255,0.08)";
    sctx.beginPath();
    sctx.ellipse(drawX - h.width * 0.2, h.y - h.height * 0.2, h.width * 0.22, h.height * 0.3, -0.4, 0, Math.PI * 2);
    sctx.fill();
  }
}

function drawSkyline() {
  for (const b of decorations.skyline) {
    const drawX = b.x - cameraX * 0.62;
    sctx.fillStyle = "rgba(58,85,125,0.6)";
    sctx.fillRect(drawX, b.y, b.width, b.height);
    for (let r = 0; r < 6; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        sctx.fillStyle = (r + c + Math.floor(frame / 12)) % 4 === 0 ? "rgba(255,245,160,0.7)" : "rgba(170,198,235,0.45)";
        sctx.fillRect(drawX + 10 + c * 24, b.y + 12 + r * 24, 10, 14);
      }
    }
  }
}

function drawEcoProps() {
  const greenness = getGreennessFactor();
  for (const t of decorations.trees) {
    const drawX = t.x - cameraX * 0.85;
    const trunkW = 12 * t.scale;
    const trunkH = 48 * t.scale;
    sctx.fillStyle = "#6f4a2c";
    sctx.fillRect(drawX - trunkW / 2, t.y - trunkH, trunkW, trunkH);

    sctx.fillStyle = mixHex("#2f8b4e", "#39c768", greenness * 0.85);
    sctx.beginPath();
    sctx.arc(drawX, t.y - trunkH - 10, 24 * t.scale, 0, Math.PI * 2);
    sctx.arc(drawX - 18, t.y - trunkH + 5, 18 * t.scale, 0, Math.PI * 2);
    sctx.arc(drawX + 18, t.y - trunkH + 5, 18 * t.scale, 0, Math.PI * 2);
    sctx.fill();
  }

  for (const t of decorations.turbines) {
    const drawX = t.x - cameraX * 0.82;
    sctx.strokeStyle = "#e8f0ff";
    sctx.lineWidth = 4;
    sctx.beginPath();
    sctx.moveTo(drawX, GROUND_Y);
    sctx.lineTo(drawX, t.y);
    sctx.stroke();

    const rot = frame * 0.03;
    for (let i = 0; i < 3; i += 1) {
      const a = rot + (Math.PI * 2 * i) / 3;
      sctx.strokeStyle = "#f7fbff";
      sctx.lineWidth = 3;
      sctx.beginPath();
      sctx.moveTo(drawX, t.y);
      sctx.lineTo(drawX + Math.cos(a) * t.size * 0.35, t.y + Math.sin(a) * t.size * 0.35);
      sctx.stroke();
    }
  }

  for (const p of decorations.solar) {
    const drawX = p.x - cameraX * 0.9;
    sctx.fillStyle = "#2c4f90";
    sctx.beginPath();
    sctx.moveTo(drawX, p.y);
    sctx.lineTo(drawX + p.width, p.y);
    sctx.lineTo(drawX + p.width - 8, p.y + 14);
    sctx.lineTo(drawX - 8, p.y + 14);
    sctx.closePath();
    sctx.fill();

    sctx.strokeStyle = "rgba(173,224,255,0.7)";
    sctx.lineWidth = 1;
    for (let i = 1; i < 5; i += 1) {
      sctx.beginPath();
      sctx.moveTo(drawX + (i * p.width) / 5, p.y);
      sctx.lineTo(drawX - 8 + (i * p.width) / 5, p.y + 14);
      sctx.stroke();
    }
  }
}

function drawPlatforms() {
  const grassFrames = atlas.tiles.grass;
  const dirtFrames = atlas.tiles.dirt;
  const brickFrames = atlas.tiles.brick;
  const grassIdx = Math.floor(frame / 14) % grassFrames.length;
  const brickIdx = Math.floor(frame / 10) % brickFrames.length;

  for (const plat of platforms) {
    const drawX = Math.floor(plat.x - cameraX);
    if (drawX + plat.width < -40 || drawX > canvas.width + 40) continue;

    if (plat.type === "ground") {
      const columns = Math.ceil(plat.width / TILE);
      const rows = Math.ceil(plat.height / TILE);
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < columns; x += 1) {
          const src = y === 0
            ? grassFrames[(grassIdx + x) % grassFrames.length]
            : dirtFrames[(x + y + Math.floor(frame / 22)) % dirtFrames.length];
          drawAtlas(src, drawX + x * TILE, plat.y + y * TILE, TILE, TILE);
        }
      }
    } else {
      const columns = Math.ceil(plat.width / TILE);
      for (let x = 0; x < columns; x += 1) {
        const src = brickFrames[(brickIdx + x) % brickFrames.length];
        drawAtlas(src, drawX + x * TILE, plat.y - 6, TILE, TILE);
      }
    }
  }
}

function drawCredits() {
  const coinFrames = atlas.sprites.coin;
  const spin = Math.floor(frame / 6) % coinFrames.length;

  for (const c of credits) {
    if (c.collected) continue;
    const drawX = c.x - cameraX;
    if (drawX < -20 || drawX > canvas.width + 20) continue;

    drawAtlas(coinFrames[spin], drawX - 14, c.y - 14, 28, 28);
    glowWorld(c.x, c.y, 16 + Math.sin(frame * 0.1 + c.wobble) * 3, "rgba(255,214,80,0.42)");
  }
}

function drawPowerups() {
  for (const p of powerups) {
    if (p.collected) continue;
    const drawX = p.x - cameraX;
    const bob = Math.sin(frame * 0.07 + p.pulse) * 3;
    const icon = atlas.sprites.power[p.type];
    drawAtlas(icon, drawX - 14, p.y - 16 + bob, 28, 28);

    const glowColorByType = {
      solar: "rgba(255,222,102,0.4)",
      wind: "rgba(136,219,255,0.35)",
      magnet: "rgba(118,255,166,0.35)",
      heat: "rgba(255,159,107,0.35)"
    };
    glowWorld(p.x, p.y + bob, 18, glowColorByType[p.type]);
  }
}

function drawEnemies() {
  for (const mob of enemies) {
    if (!mob.alive) continue;
    const drawX = mob.x - cameraX;
    if (drawX + mob.width < -30 || drawX > canvas.width + 30) continue;

    const bounce = Math.sin(mob.phase) * 2;
    const bodyY = mob.y + bounce;
    const frames = atlas.enemies[mob.type] || atlas.enemies.toni;
    const anim = Math.floor(frame / 10 + Math.abs(mob.vx) * 2) % frames.length;
    const isFinal = mob.type === "finalboss";
    const w = isFinal ? 80 : mob.boss ? 46 : 38;
    const h = isFinal ? 76 : mob.boss ? 44 : 36;
    drawAtlas(frames[anim], drawX - (isFinal ? 20 : 2), bodyY - (isFinal ? 36 : 4), w, h);

    if (isFinal) {
      sctx.fillStyle = `rgba(180,40,40,${0.15 + Math.sin(frame * 0.05) * 0.1})`;
      sctx.beginPath();
      sctx.arc(drawX + w / 2 - 20, bodyY + h / 2 - 36, 55, 0, Math.PI * 2);
      sctx.fill();
    }

    if (mob.boss) {
      const isFinal = mob.type === "finalboss";
      const barW = isFinal ? 100 : 60;
      sctx.fillStyle = "rgba(255,255,255,0.86)";
      roundedRect(sctx, drawX - 4, bodyY - 20, barW, 8, 3);
      sctx.fill();
      sctx.fillStyle = isFinal ? "rgba(255,60,60,0.95)" : "rgba(255,110,110,0.9)";
      const width = (mob.hp / mob.maxHp) * (barW - 2);
      roundedRect(sctx, drawX - 3, bodyY - 19, width, 6, 2);
      sctx.fill();
      sctx.fillStyle = isFinal ? "#fff" : "#1f2940";
      sctx.font = isFinal ? "bold 12px Nunito" : "10px Nunito";
      sctx.fillText(isFinal ? "⚠ FINAL BOSS" : "Boardroom Boss", drawX - 2, bodyY - 24);
    }

    // Draw enemy name label
    const enemyName = mob.label.split(":")[0];
    sctx.fillStyle = "rgba(255,255,255,0.9)";
    sctx.font = isFinal ? "bold 13px Nunito" : "11px Nunito";
    const nameY = isFinal ? bodyY - 50 : mob.boss ? bodyY - 28 : bodyY - 8;
    sctx.fillText(enemyName, drawX - 2, nameY);
  }
}

function drawAllies() {
  for (const ally of allies) {
    const drawX = ally.x - cameraX;
    const frames = atlas.enemies[ally.type] || atlas.enemies.toni;
    const anim = Math.floor(frame / 10 + ally.phase * 2) % frames.length;
    drawAtlas(frames[anim], drawX - 2, ally.y - 2, 34, 34);
    glowWorld(ally.x + 16, ally.y + 15, 18, "rgba(110,236,165,0.26)");
  }
}

function drawGuardians() {
  if (!guardians.active) return;
  const guardianFrames = atlas.sprites.guardians;

  guardians.members.forEach((guardian, i) => {
    const drawX = guardian.x - cameraX;
    const frameIdx = Math.floor(frame / 18 + i * 2) % guardianFrames.length;
    const sprite = guardianFrames[frameIdx];
    drawAtlas(sprite, drawX - 18, guardian.y - 18, 36, 36);
    glowWorld(guardian.x, guardian.y, 22, rgbaWithAlpha(guardian.color, 0.45));
    sctx.fillStyle = "rgba(255,255,255,0.9)";
    sctx.font = "11px Nunito";
    sctx.fillText(guardian.name, drawX - 10, guardian.y - 22);
  });
}

function drawSupportTeam() {
  if (!supportTeam.active) return;
  supportTeam.members.forEach((member, i) => {
    const drawX = member.x - cameraX;
    const sprite = atlas.sprites.support[member.type] || atlas.sprites.support.support_irene;
    drawAtlas(sprite, drawX - 16, member.y - 16, 32, 32);
    glowWorld(member.x, member.y, 20, rgbaWithAlpha(member.color, 0.45));
    sctx.fillStyle = "rgba(255,255,255,0.9)";
    sctx.font = "11px Nunito";
    sctx.fillText(member.name, drawX - 12, member.y - 20 - (i % 2) * 4);
  });
}

function drawDialogues() {
  const visible = [];

  for (const p of particles) {
    if (!p.text) continue;
    const drawX = p.x - cameraX;
    const alpha = Math.max(0, p.life / p.maxLife);

    sctx.font = "800 15px Nunito";
    const maxWidth = 250;
    const words = p.text.split(" ");
    const lines = [];
    let current = "";

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (sctx.measureText(next).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);

    const lineHeight = 17;
    const textWidth = Math.max(...lines.map((line) => sctx.measureText(line).width));
    const boxWidth = textWidth + 22;
    const boxHeight = lines.length * lineHeight + 14;
    const bx = clamp(drawX - boxWidth / 2, 10, canvas.width - boxWidth - 10);
    const by = Math.max(8, p.y - boxHeight - 22);
    const tailX = clamp(drawX, bx + 14, bx + boxWidth - 14);
    const accent = `rgba(0, 0, 0, ${Math.max(0.92, alpha)})`;

    sctx.fillStyle = `rgba(242, 247, 235, ${Math.max(0.98, alpha)})`;
    roundedRect(sctx, bx, by, boxWidth, boxHeight, 8);
    sctx.fill();

    sctx.strokeStyle = accent;
    sctx.lineWidth = 2.4;
    roundedRect(sctx, bx, by, boxWidth, boxHeight, 8);
    sctx.stroke();

    sctx.fillStyle = `rgba(242, 247, 235, ${Math.max(0.98, alpha)})`;
    sctx.beginPath();
    sctx.moveTo(tailX - 8, by + boxHeight - 1);
    sctx.lineTo(tailX + 8, by + boxHeight - 1);
    sctx.lineTo(tailX, by + boxHeight + 10);
    sctx.closePath();
    sctx.fill();
    sctx.stroke();

    sctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0.99, alpha)})`;
    sctx.shadowColor = "rgba(0, 0, 0, 0)";
    lines.forEach((line, i) => {
      const tx = bx + 11;
      const ty = by + 18 + i * lineHeight;
      sctx.fillText(line, tx, ty);
    });

    visible.push({ text: p.text, accent, alpha, life: p.life });
  }


}

function drawMiniGameOverlay() {
  if (!miniGame) return;

  const left = canvas.width * 0.16;
  const top = canvas.height * 0.2;
  const w = canvas.width * 0.68;
  const h = canvas.height * 0.34;

  sctx.fillStyle = "rgba(9,18,40,0.72)";
  roundedRect(sctx, left, top, w, h, 12);
  sctx.fill();

  sctx.fillStyle = "#eff6ff";
  sctx.font = "20px Nunito";
  sctx.fillText(miniGame.title, left + 20, top + 36);
  sctx.font = "16px Nunito";
  sctx.fillText(miniGame.prompt, left + 20, top + 66);

  const secs = Math.ceil(miniGame.timer / 60);
  sctx.fillText(`Time left: ${secs}s`, left + 20, top + 95);

  const barW = w - 40;
  sctx.fillStyle = "rgba(255,255,255,0.28)";
  roundedRect(sctx, left + 20, top + 110, barW, 18, 8);
  sctx.fill();
  sctx.fillStyle = "#5fd695";
  const prog = clamp(miniGame.progress / miniGame.target, 0, 1);
  roundedRect(sctx, left + 21, top + 111, (barW - 2) * prog, 16, 7);
  sctx.fill();

  sctx.fillStyle = "#e5eeff";
  sctx.fillText(`Progress: ${miniGame.progress}/${miniGame.target}`, left + 20, top + 152);
}

function drawGates() {
  const gateFrame = atlas.sprites.gate[Math.floor(frame / 8) % atlas.sprites.gate.length];

  sctx.font = "bold 12px Nunito";
  for (const g of gates) {
    if (g.passed) continue;

    const drawX = g.x - cameraX;
    if (drawX + g.width < -40 || drawX > canvas.width + 120) continue;

    const span = Math.ceil(g.height / TILE);
    for (let i = 0; i < span; i += 1) {
      drawAtlas(gateFrame, drawX - 4, g.y + i * TILE, 34, 34);
    }

    sctx.fillStyle = "#ffefb0";
    roundedRect(sctx, drawX - 5, g.y - 20, 118, 16, 3);
    sctx.fill();
    sctx.fillStyle = "#102042";
    const suffix = g.miniGameDone ? " ready" : " + mini-game";
    sctx.fillText(`${g.requiredCredits} credits${suffix}`, drawX + 2, g.y - 8);
    sctx.fillStyle = "#1f2940";
    sctx.fillText(g.label, drawX - 40, g.y + g.height + 16);

    glowWorld(g.x + g.width / 2, g.y + g.height / 2, 46, "rgba(98,158,255,0.30)");
  }
}

function drawFlag() {
  const flag = flags[0];
  const drawX = flag.x - cameraX;
  const pole = atlas.sprites.pole;
  const flagFrames = gameWon ? atlas.sprites.flagGreen : atlas.sprites.flagRed;
  const ff = flagFrames[Math.floor(frame / 8) % flagFrames.length];

  const parts = Math.ceil(flag.height / TILE);
  for (let i = 0; i < parts; i += 1) {
    drawAtlas(pole, drawX - 3, flag.y + i * TILE, 16, 32);
  }
  drawAtlas(ff, drawX + 2, flag.y + 8, 54, 34);

  glowWorld(flag.x + 20, flag.y + 24, gameWon ? 38 : 24, gameWon ? "rgba(90,255,170,0.4)" : "rgba(255,95,95,0.25)");
}

function drawPlayer() {
  const drawX = player.x - cameraX;
  const moving = Math.abs(player.vx) > 0.2;
  if (moving && player.onGround) player.stepPhase += Math.abs(player.vx) * 0.12;

  if (invulnerableTimer > 0 && Math.floor(invulnerableTimer / 6) % 2 === 0) return;

  let idx = 0;
  if (!player.onGround) idx = 4;
  else if (moving) idx = Math.floor(frame / 6) % 4;
  else idx = 5;

  drawAtlas(atlas.player[idx], drawX - 1, player.y - 2, 36, 50, player.facing < 0);

  const badge = atlas.sprites.vehicle[currentVehicle];
  if (badge) {
    drawAtlas(badge, drawX - 4, player.y - 16, 18, 18);
  }
}

function drawParticles() {
  for (const p of particles) {
    if (p.text) continue;
    const drawX = p.x - cameraX;
    if (drawX < -20 || drawX > canvas.width + 20) continue;
    const alpha = Math.max(0, p.life / p.maxLife);

    // Barrel rendering (boss projectile)
    if (p.barrel) {
      sctx.save();
      sctx.translate(drawX, p.y);
      sctx.rotate(frame * 0.15);
      sctx.fillStyle = `rgba(139,69,19,${alpha})`;
      sctx.beginPath();
      sctx.arc(0, 0, 10, 0, Math.PI * 2);
      sctx.fill();
      sctx.strokeStyle = `rgba(90,40,10,${alpha})`;
      sctx.lineWidth = 2;
      sctx.beginPath();
      sctx.moveTo(-10, 0); sctx.lineTo(10, 0);
      sctx.moveTo(0, -10); sctx.lineTo(0, 10);
      sctx.stroke();
      sctx.restore();
      continue;
    }

    const color = rgbaWithAlpha(p.color, alpha);
    sctx.fillStyle = color;
    sctx.beginPath();
    sctx.arc(drawX, p.y, p.size * alpha, 0, Math.PI * 2);
    sctx.fill();

    if (p.glow) {
      gctx.fillStyle = rgbaWithAlpha(p.color, alpha * 0.85);
      gctx.beginPath();
      gctx.arc(drawX, p.y, p.size * 2.2, 0, Math.PI * 2);
      gctx.fill();
    }
  }
}

function drawColorGrade() {
  const vignette = sctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 80, canvas.width / 2, canvas.height / 2, canvas.width * 0.72);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(10,22,39,0.20)");
  sctx.fillStyle = vignette;
  sctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawPortraitCard(portrait, x, y) {
  sctx.fillStyle = "rgba(255,255,255,0.9)";
  roundedRect(sctx, x, y, 74, 92, 8);
  sctx.fill();

  sctx.fillStyle = "rgba(39,53,88,0.15)";
  roundedRect(sctx, x + 6, y + 6, 62, 60, 6);
  sctx.fill();

  if (portrait.type === "mario") {
    drawAtlas(atlas.player[5], x + 18, y + 12, 36, 48, false);
  } else if (portrait.type === "guardian_josy") {
    drawAtlas(atlas.sprites.guardians[0], x + 18, y + 14, 36, 36, false);
  } else if (portrait.type === "guardian_nina") {
    drawAtlas(atlas.sprites.guardians[2], x + 18, y + 14, 36, 36, false);
  } else if (portrait.type.startsWith("support_")) {
    const sprite = atlas.sprites.support[portrait.type] || atlas.sprites.support.support_irene;
    drawAtlas(sprite, x + 20, y + 16, 32, 32, false);
  } else {
    const frames = atlas.enemies[portrait.type] || atlas.enemies.toni;
    drawAtlas(frames[0], x + 18, y + 14, 36, 36, false);
  }

  sctx.fillStyle = "#1f2940";
  sctx.font = "11px Nunito";
  sctx.fillText(portrait.name, x + 8, y + 82);
}

function drawCutscenePanel() {
  if (!cutscene || !cutscene.active) return;

  const panelX = canvas.width * 0.09;
  const panelY = canvas.height * 0.12;
  const panelW = canvas.width * 0.82;
  const panelH = canvas.height * 0.76;

  sctx.fillStyle = "rgba(6,12,28,0.78)";
  roundedRect(sctx, panelX, panelY, panelW, panelH, 14);
  sctx.fill();

  sctx.fillStyle = "#f0f6ff";
  sctx.font = "22px Nunito";
  sctx.fillText(cutscene.title, panelX + 24, panelY + 40);

  sctx.fillStyle = "rgba(255,255,255,0.08)";
  roundedRect(sctx, panelX + 20, panelY + 56, panelW - 40, 92, 8);
  sctx.fill();

  sctx.fillStyle = "#ebf1ff";
  sctx.font = "20px Nunito";
  const pageText = cutscene.pages[cutscene.index];
  const maxTextW = panelW - 60;
  const words = pageText.split(" ");
  const textLines = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (sctx.measureText(testLine).width > maxTextW && currentLine) {
      textLines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) textLines.push(currentLine);
  textLines.forEach((line, i) => {
    sctx.fillText(line, panelX + 30, panelY + 82 + i * 26);
  });

  const portraitRow = cutscene.portraits.slice(0, 6);
  portraitRow.forEach((portrait, i) => {
    drawPortraitCard(portrait, panelX + 26 + i * 82, panelY + 168);
  });

  sctx.fillStyle = "#d8e4ff";
  sctx.font = "14px Nunito";
  sctx.fillText(`Panel ${cutscene.index + 1}/${cutscene.pages.length} - Press Enter/Space`, panelX + 24, panelY + panelH - 24);
}

function drawOverlay() {
  if (cutscene && cutscene.active) return;
  if (!gameWon && !gameLost) return;

  sctx.fillStyle = "rgba(4,11,24,0.55)";
  sctx.fillRect(0, 0, canvas.width, canvas.height);
  sctx.textAlign = "center";

  if (gameWon) {
    sctx.fillStyle = "#e9ffef";
    sctx.font = "24px 'Press Start 2P'";
    sctx.fillText("TRANSFORMATION COMPLETE", canvas.width / 2, canvas.height / 2 - 22);
    sctx.font = "16px Nunito";
    sctx.fillText(endingText, canvas.width / 2, canvas.height / 2 + 10);
    sctx.fillText("Parade mode active. Press P for photo mode, C to capture.", canvas.width / 2, canvas.height / 2 + 34);
  } else {
    sctx.fillStyle = "#ffe8e8";
    sctx.font = "28px 'Press Start 2P'";
    sctx.fillText("PROGRAM FAILED", canvas.width / 2, canvas.height / 2 - 12);
    sctx.font = "18px Nunito";
    sctx.fillText("Resistance won this round. Press R to restart.", canvas.width / 2, canvas.height / 2 + 24);
  }

  sctx.textAlign = "left";
}

function renderScene() {
  sctx.clearRect(0, 0, canvas.width, canvas.height);
  gctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();
  drawPlatforms();
  drawCredits();
  drawPowerups();
  drawEnemies();
  drawAllies();
  drawGuardians();
  drawSupportTeam();
  drawGates();
  drawFlag();
  drawPlayer();
  drawParticles();
  drawDialogues();
  drawMiniGameOverlay();
  drawColorGrade();
  drawCutscenePanel();
  drawOverlay();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = photoMode ? PHOTO_FILTERS[photoFilterIndex] : "none";
  ctx.drawImage(sceneCanvas, 0, 0);

  ctx.globalCompositeOperation = "screen";
  ctx.filter = "blur(11px) saturate(135%)";
  ctx.drawImage(glowCanvas, 0, 0);
  ctx.filter = "blur(4px) saturate(120%)";
  ctx.drawImage(glowCanvas, 0, 0);
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";
}

function drawAtlas(src, dx, dy, dw, dh, flip = false) {
  if (!src) return;
  if (!flip) {
    sctx.drawImage(atlas.image, src.x, src.y, src.w, src.h, dx, dy, dw, dh);
    return;
  }

  sctx.save();
  sctx.translate(dx + dw, dy);
  sctx.scale(-1, 1);
  sctx.drawImage(atlas.image, src.x, src.y, src.w, src.h, 0, 0, dw, dh);
  sctx.restore();
}

function glowWorld(x, y, radius, color) {
  glowScreen(x - cameraX, y, radius, color);
}

function glowScreen(x, y, radius, color) {
  const grad = gctx.createRadialGradient(x, y, 1, x, y, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  gctx.fillStyle = grad;
  gctx.beginPath();
  gctx.arc(x, y, radius, 0, Math.PI * 2);
  gctx.fill();
}

function tick() {
  frame += 1;
  sound.updateBgm();

  if (!photoMode) {
    if (cutscene && cutscene.active) {
      updateParticles();
    } else if (miniGame) {
      handleMiniGameTick();
      updateParticles();
    } else if (!gameWon && !gameLost) {
      applyInput();
      handlePlatforms();
      handlePowerups();
      handleCredits();
      maybeActivateSupportTeam();
      handleEnemies();
      handleGates();
      handleFlag();
      updateAllies();
      updateGuardians();
      updateSupportTeam();
      updateStorms();
      updateCarbonDynamics();
      updateMoraleDynamics();
      updateParticles();
      updateCamera();
      maybeUnlockVehicles();

      if (dashCooldown > 0) dashCooldown -= 1;
      if (invulnerableTimer > 0) invulnerableTimer -= 1;

      updateHud();
    } else {
      updateParade();
      updateAllies();
      updateGuardians();
      updateSupportTeam();
      updateParticles();
      updateCamera();
      updateHud();
    }
  }

  renderScene();
  requestAnimationFrame(tick);
}

function cyclePhotoFilter() {
  photoFilterIndex = (photoFilterIndex + 1) % PHOTO_FILTERS.length;
}

function capturePhoto() {
  const a = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = canvas.toDataURL("image/png");
  a.download = `terra-mater-photo-${stamp}.png`;
  a.click();
}

function handleMiniGameKeyPress(k) {
  if (!miniGame) return false;
  if (k !== miniGame.key) return false;

  miniGame.progress += 1;
  spawnSparkle(player.x + player.width / 2, player.y - 5, "rgba(125,224,255,1)");
  sound.miniTick();

  if (miniGame.progress >= miniGame.target) {
    morale = clamp(morale + 10, 0, 100);
    const gateObj = gates.find((g) => g.x === miniGame.gateX);
    if (gateObj) gateObj.miniGameDone = true;
    spawnDialogue("Mini-game success! Gate unlocked.", player.x - 40, player.y - 25, "rgba(177,255,211,1)");
    sound.miniSuccess();
    miniGame = null;
  }
  return true;
}

function keyDown(event) {
  const key = event.key.toLowerCase();
  sound.unlock();

  if (cutscene && cutscene.active) {
    if (event.key === "Enter" || event.key === " ") {
      advanceCutscene();
    }
    return;
  }

  if (key === "p") {
    photoMode = !photoMode;
    updateHud();
    return;
  }

  if (key === "m") {
    sound.toggleMute();
    spawnDialogue("Audio toggled.", player.x - 10, player.y - 20, "rgba(222,238,255,1)");
    return;
  }

  if (photoMode) {
    if (key === "f") cyclePhotoFilter();
    if (key === "c") capturePhoto();
    if (key === "r") resetGame(true);
    return;
  }

  if (miniGame && handleMiniGameKeyPress(key)) return;

  if (event.key === "ArrowLeft" || key === "a") keys.left = true;
  if (event.key === "ArrowRight" || key === "d") keys.right = true;
  if (event.key === "ArrowUp" || key === "w" || event.key === " ") keys.up = true;

  if (event.key === "Shift" && activePowerups.windDash > 0 && dashCooldown <= 0) {
    dashCooldown = 40;
    player.vx += player.facing * 8.5;
    spawnSparkle(player.x + player.width / 2, player.y + player.height / 2, "rgba(136,219,255,1)");
    sound.dash();
  }

  if (key === "c") capturePhoto();
  if (key === "r") resetGame(true);
}

function keyUp(event) {
  const key = event.key.toLowerCase();
  if (event.key === "ArrowLeft" || key === "a") keys.left = false;
  if (event.key === "ArrowRight" || key === "d") keys.right = false;
  if (event.key === "ArrowUp" || key === "w" || event.key === " ") keys.up = false;
}

function rgbaWithAlpha(rgba, alpha) {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return rgba;
  return `rgba(${m[1]},${m[2]},${m[3]},${Math.max(0, Math.min(1, alpha))})`;
}

function lerpColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

function rgb(arr) {
  return `rgb(${arr[0]}, ${arr[1]}, ${arr[2]})`;
}

function mixHex(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgb(lerpColor(a, b, clamp(t, 0, 1)));
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16)
  ];
}

function roundedRect(target, x, y, w, h, r) {
  target.beginPath();
  target.moveTo(x + r, y);
  target.lineTo(x + w - r, y);
  target.quadraticCurveTo(x + w, y, x + w, y + r);
  target.lineTo(x + w, y + h - r);
  target.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  target.lineTo(x + r, y + h);
  target.quadraticCurveTo(x, y + h, x, y + h - r);
  target.lineTo(x, y + r);
  target.quadraticCurveTo(x, y, x + r, y);
  target.closePath();
}

function buildAtlas() {
  const image = document.createElement("canvas");
  image.width = 1024;
  image.height = 640;
  const a = image.getContext("2d");

  const map = {
    image,
    tiles: { grass: [], dirt: [], brick: [] },
    sprites: {
      coin: [],
      gate: [],
      flagRed: [],
      flagGreen: [],
      pole: null,
      guardians: [],
      support: {},
      vehicle: {},
      power: {}
    },
    player: [],
    enemies: {}
  };

  function slot(col, row, w = 32, h = 32) {
    return { x: col * 40 + 4, y: row * 40 + 4, w, h };
  }

  function drawPanelRect(sx, sy, w, h, c1, c2) {
    const grad = a.createLinearGradient(sx, sy, sx, sy + h);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    a.fillStyle = grad;
    a.fillRect(sx, sy, w, h);
  }

  function drawPixelFace(sx, sy, skin, hair) {
    a.fillStyle = skin;
    a.fillRect(sx + 10, sy + 8, 12, 10);
    a.fillStyle = hair;
    a.fillRect(sx + 8, sy + 5, 16, 5);
    a.fillStyle = "#1a1a1a";
    a.fillRect(sx + 18, sy + 11, 2, 2);
    a.fillRect(sx + 15, sy + 16, 7, 2);
  }

  for (let i = 0; i < 4; i += 1) {
    const s = slot(i, 0);
    drawPanelRect(s.x, s.y, s.w, s.h, "#80d45f", "#53ab41");
    a.fillStyle = i % 2 === 0 ? "#4d953c" : "#5fa549";
    for (let x = 0; x < s.w; x += 4) a.fillRect(s.x + x, s.y + 18 + ((x / 4 + i) % 2), 3, 2);
    map.tiles.grass.push(s);
  }

  for (let i = 0; i < 3; i += 1) {
    const s = slot(i, 1);
    drawPanelRect(s.x, s.y, s.w, s.h, "#9b6a3f", "#6f4528");
    a.fillStyle = "rgba(0,0,0,0.22)";
    for (let y = 5; y < s.h; y += 7) a.fillRect(s.x + ((i + y) % 5), s.y + y, s.w - 3, 1);
    map.tiles.dirt.push(s);
  }

  for (let i = 0; i < 4; i += 1) {
    const s = slot(i, 2);
    drawPanelRect(s.x, s.y, s.w, s.h, "#ecb066", "#b77436");
    a.strokeStyle = "#7a4e22";
    a.lineWidth = 2;
    a.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);
    a.fillStyle = "rgba(255,255,255,0.25)";
    a.fillRect(s.x + 3, s.y + 3, s.w - 6, 2);
    a.fillStyle = "rgba(0,0,0,0.12)";
    a.fillRect(s.x + 2 + i, s.y + 20, s.w - 4, 2);
    map.tiles.brick.push(s);
  }

  for (let i = 0; i < 6; i += 1) {
    const s = slot(i, 3, 28, 28);
    const squash = 1 - Math.abs(2.5 - i) * 0.08;
    a.fillStyle = "#ffd35a";
    a.beginPath();
    a.ellipse(s.x + 14, s.y + 14, 10 * squash, 12, 0, 0, Math.PI * 2);
    a.fill();
    a.strokeStyle = "#b57e16";
    a.stroke();
    a.fillStyle = "#9a6711";
    a.fillRect(s.x + 12, s.y + 10, 4, 8);
    map.sprites.coin.push(s);
  }

  for (let i = 0; i < 6; i += 1) {
    const s = slot(i, 4, 34, 48);
    const leg = i < 4 ? (i % 2 === 0 ? 2 : -2) : 0;
    a.fillStyle = "#244ebe";
    roundedRect(a, s.x + 5, s.y + 20, 24, 18, 4);
    a.fill();
    a.fillStyle = "#d53838";
    roundedRect(a, s.x + 3, s.y + 8, 28, 12, 4);
    a.fill();
    drawPixelFace(s.x + 2, s.y + 2, "#f4c8a6", "#7b2b22");
    a.fillStyle = "#4a2e1f";
    a.fillRect(s.x + 9, s.y + 38, 7, 7 + Math.max(0, leg));
    a.fillRect(s.x + 18, s.y + 38, 7, 7 + Math.max(0, -leg));
    map.player.push(s);
  }

  const enemyDefs = [
    ["toni", "#f0c39e", "#4d3020", "#2f7f39", "#f2b93d"],
    ["walter", "#ebbe9d", "#272727", "#2b2f3f", "#80848e"],
    ["markus", "#f2cfaa", "#4b3523", "#2f486e", "#7ac8ff"],
    ["commuter", "#f4cfb0", "#5d4037", "#7d3d8a", "#ce67e0"],
    ["thermostat", "#f0c2a8", "#513024", "#b14141", "#ff9446"],
    ["wolle", "#f5d4b5", "#6b4530", "#3a6b3a", "#a8d86c"],
    ["tv", "#e8c5a0", "#2a2a2a", "#1a3a5c", "#4fc3f7"],
    ["waste", "#f2d0b0", "#3b2818", "#5a7a3a", "#8bc34a"],
    ["finalboss", "#8b4513", "#2a0a0a", "#4a0e0e", "#ff2222"]
  ];

  enemyDefs.forEach((def, idx) => {
    const [name, skin, hair, outfit, accent] = def;
    map.enemies[name] = [];
    for (let i = 0; i < 4; i += 1) {
      const s = slot(i, 6 + idx, 34, 34);
      const bob = i % 2 === 0 ? 1 : -1;
      a.fillStyle = outfit;
      roundedRect(a, s.x + 3, s.y + 10 + bob, 28, 20, 6);
      a.fill();
      drawPixelFace(s.x + 1, s.y + 2 + bob, skin, hair);
      a.fillStyle = accent;
      a.fillRect(s.x + 8, s.y + 19 + bob, 18, 3);
      a.fillStyle = "#fff";
      a.fillRect(s.x + 10, s.y + 13 + bob, 4, 4);
      a.fillRect(s.x + 20, s.y + 13 + bob, 4, 4);
      a.fillStyle = "#221";
      a.fillRect(s.x + 11, s.y + 14 + bob, 2, 2);
      a.fillRect(s.x + 21, s.y + 14 + bob, 2, 2);
      map.enemies[name].push(s);
    }
  });

  for (let i = 0; i < 3; i += 1) {
    const s = slot(i, 12, 34, 34);
    drawPanelRect(s.x, s.y, s.w, s.h, "#4f8af9", "#204da8");
    a.fillStyle = "rgba(255,255,255,0.35)";
    a.fillRect(s.x + 3, s.y + 3, s.w - 6, 3);
    a.fillStyle = "rgba(0,0,0,0.3)";
    a.fillRect(s.x + i + 4, s.y + 24, s.w - 8, 2);
    map.sprites.gate.push(s);
  }

  const pole = slot(3, 12, 14, 34);
  drawPanelRect(pole.x, pole.y, pole.w, pole.h, "#f5f5f5", "#b9c4d6");
  map.sprites.pole = pole;

  for (let i = 0; i < 4; i += 1) {
    const s = slot(i, 13, 54, 34);
    a.fillStyle = "#d73737";
    a.beginPath();
    a.moveTo(s.x + 2, s.y + 4);
    a.quadraticCurveTo(s.x + 30 + i * 2, s.y + 10, s.x + 50, s.y + 16);
    a.quadraticCurveTo(s.x + 30 - i, s.y + 26, s.x + 2, s.y + 30);
    a.closePath();
    a.fill();
    a.fillStyle = "#fff";
    a.font = "bold 9px monospace";
    a.fillText("ESG", s.x + 12, s.y + 21);
    map.sprites.flagRed.push(s);
  }

  for (let i = 0; i < 4; i += 1) {
    const s = slot(i + 4, 13, 54, 34);
    a.fillStyle = "#35c672";
    a.beginPath();
    a.moveTo(s.x + 2, s.y + 4);
    a.quadraticCurveTo(s.x + 30 + i * 2, s.y + 10, s.x + 50, s.y + 16);
    a.quadraticCurveTo(s.x + 30 - i, s.y + 26, s.x + 2, s.y + 30);
    a.closePath();
    a.fill();
    a.fillStyle = "#fff";
    a.font = "bold 9px monospace";
    a.fillText("ESG", s.x + 12, s.y + 21);
    map.sprites.flagGreen.push(s);
  }

  for (let i = 0; i < 4; i += 1) {
    const s = slot(i, 14, 34, 34);
    const lift = i % 2 === 0 ? 0 : 1;
    a.fillStyle = i < 2 ? "#8ae8ad" : "#91c4ff";
    roundedRect(a, s.x + 9, s.y + 10 + lift, 16, 18, 6);
    a.fill();
    a.fillStyle = "rgba(255,255,255,0.95)";
    a.beginPath();
    a.ellipse(s.x + 8, s.y + 18, 7, 4, -0.4, 0, Math.PI * 2);
    a.ellipse(s.x + 26, s.y + 18, 7, 4, 0.4, 0, Math.PI * 2);
    a.fill();
    a.fillStyle = "#f8dcc7";
    a.fillRect(s.x + 13, s.y + 6 + lift, 8, 7);
    a.fillStyle = "#25345f";
    a.fillRect(s.x + 15, s.y + 9 + lift, 2, 2);
    map.sprites.guardians.push(s);
  }

  const supportDefs = [
    ["support_irene", "#dca8ff", "#6f4391", "IR"],
    ["support_sirna", "#99d8ff", "#2b6485", "SI"],
    ["support_denise", "#9ff2c2", "#2f7a57", "DE"],
    ["support_roland", "#ffd69f", "#8f6231", "RO"]
  ];

  supportDefs.forEach((sDef, i) => {
    const [name, c1, c2, txt] = sDef;
    const s = slot(i + 10, 14, 32, 32);
    drawPanelRect(s.x, s.y, s.w, s.h, c1, c2);
    a.fillStyle = "rgba(255,255,255,0.22)";
    roundedRect(a, s.x + 4, s.y + 4, s.w - 8, 10, 4);
    a.fill();
    a.fillStyle = "#1f2940";
    a.font = "bold 10px monospace";
    a.fillText(txt, s.x + 7, s.y + 22);
    map.sprites.support[name] = s;
  });

  const vehicleIcons = [
    ["foot", "#f8f8f8", "#475777", "FT"],
    ["bike", "#95ffb4", "#34734e", "BK"],
    ["ev", "#9ed3ff", "#2d5370", "EV"],
    ["train", "#ffcda3", "#7a5031", "TR"]
  ];

  vehicleIcons.forEach((v, i) => {
    const [name, c1, c2, txt] = v;
    const s = slot(i + 4, 14, 18, 18);
    drawPanelRect(s.x, s.y, s.w, s.h, c1, c2);
    a.fillStyle = "#1f2940";
    a.font = "bold 8px monospace";
    a.fillText(txt, s.x + 2, s.y + 12);
    map.sprites.vehicle[name] = s;
  });

  const powerDefs = [
    ["solar", "#ffe670", "#b48e26", "S"],
    ["wind", "#9ce8ff", "#2b8aa3", "W"],
    ["magnet", "#9fffba", "#2b8b4a", "M"],
    ["heat", "#ffb689", "#ad5330", "H"]
  ];

  powerDefs.forEach((p, i) => {
    const [name, c1, c2, txt] = p;
    const s = slot(i + 8, 14, 28, 28);
    drawPanelRect(s.x, s.y, s.w, s.h, c1, c2);
    a.fillStyle = "rgba(255,255,255,0.28)";
    a.fillRect(s.x + 3, s.y + 3, s.w - 6, 2);
    a.fillStyle = "#1f2940";
    a.font = "bold 12px monospace";
    a.fillText(txt, s.x + 9, s.y + 19);
    map.sprites.power[name] = s;
  });

  return map;
}

window.addEventListener("keydown", keyDown);
window.addEventListener("keyup", keyUp);
window.addEventListener("pointerdown", () => sound.unlock(), { passive: true });
window.addEventListener("touchstart", () => sound.unlock(), { passive: true });

resetGame(true);
tick();
