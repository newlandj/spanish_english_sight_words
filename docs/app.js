const STORAGE_KEY        = "sightwords_progress";
const MATH_STORAGE_KEY   = "math_progress";
const DAILY_STREAK_KEY   = "daily_streak";
const XP_KEY             = "xp_data";
const BADGES_KEY         = "badges";
const WORDS_URL          = "./words.json";

// XP needed to reach each level (index = level - 1)
const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1050, 1500, 2100, 2800, 3700];

const BADGE_DEFS = {
  "first-blood":   { name: "First Blood",     desc: "First correct answer!",       icon: "🩸" },
  "hot-streak-5":  { name: "Hot Streak",       desc: "5 correct in a row",          icon: "🔥" },
  "on-fire-10":    { name: "On Fire",          desc: "10 correct in a row",         icon: "🌋" },
  "flawless":      { name: "Flawless",         desc: "Finish a deck with 0 misses", icon: "⭐" },
};

// ── Language data ──────────────────────────────────────────────────────────────

let words = [];

async function loadWords() {
  const res = await fetch(WORDS_URL);
  words = await res.json();
}

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function recordResult(wordId, direction, correct) {
  const progress = loadProgress();
  if (!progress[wordId]) progress[wordId] = {};
  const [c, w] = progress[wordId][direction] || [0, 0];
  progress[wordId][direction] = correct ? [c + 1, w] : [c, w + 1];
  saveProgress(progress);
}

function isStillLearning(wordId, direction, progress) {
  const [correct = 0, wrong = 0] = (progress[wordId] || {})[direction] || [];
  return wrong > correct;
}

function isUnseen(wordId, direction, progress) {
  const [correct = 0, wrong = 0] = (progress[wordId] || {})[direction] || [];
  return correct === wrong;
}

function getStats() {
  const progress = loadProgress();
  let mastered = 0, stillLearning = 0, unseen = 0;
  for (const word of words) {
    for (const dir of ["en_es", "es_en"]) {
      const [c = 0, w = 0] = (progress[word.id] || {})[dir] || [];
      if (!((progress[word.id] || {})[dir])) unseen++;
      else if (c > w) mastered++;
      else if (w > c) stillLearning++;
      else unseen++;
    }
  }
  return { mastered, stillLearning, unseen };
}

// ── Math data ──────────────────────────────────────────────────────────────────

function loadMathProgress() {
  try { return JSON.parse(localStorage.getItem(MATH_STORAGE_KEY) || "{}"); }
  catch { return {}; }
}

function saveMathProgress(progress) {
  localStorage.setItem(MATH_STORAGE_KEY, JSON.stringify(progress));
}

function recordMathResult(factId, correct) {
  const progress = loadMathProgress();
  const [c, w] = progress[factId] || [0, 0];
  progress[factId] = correct ? [c + 1, w] : [c, w + 1];
  saveMathProgress(progress);
}

function getMathStats(table) {
  const progress = loadMathProgress();
  let mastered = 0, stillLearning = 0, unseen = 0;
  for (const fact of getMathFacts(table)) {
    const [c = 0, w = 0] = progress[fact.id] || [];
    if (!progress[fact.id]) unseen++;
    else if (c > w) mastered++;
    else if (w > c) stillLearning++;
    else unseen++;
  }
  return { mastered, stillLearning, unseen };
}

function getMathFacts(table) {
  const tables = table === "all" ? [1,2,3,4,5,6,7,8,9] : [table];
  const facts = [];
  for (const a of tables) {
    for (let b = 1; b <= 9; b++) {
      facts.push({ id: `${a}x${b}`, a, b, answer: a * b });
    }
  }
  return facts;
}

function buildMathDeck(mode, table) {
  const progress = loadMathProgress();
  let cards = getMathFacts(table).filter(fact => {
    const [c = 0, w = 0] = progress[fact.id] || [];
    if (mode === "still-learning") return w > c;
    if (mode === "new") return c === w && !progress[fact.id] || c === w;
    return true;
  });
  return shuffle(cards);
}

// ── Daily streak ───────────────────────────────────────────────────────────────

function getDailyStreak() {
  try { return JSON.parse(localStorage.getItem(DAILY_STREAK_KEY)) || { streak: 0, lastDate: null }; }
  catch { return { streak: 0, lastDate: null }; }
}

function markSessionPlayed() {
  const today = new Date().toISOString().slice(0, 10);
  const data = getDailyStreak();
  if (data.lastDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newStreak = data.lastDate === yesterday ? data.streak + 1 : 1;
  localStorage.setItem(DAILY_STREAK_KEY, JSON.stringify({ streak: newStreak, lastDate: today }));
}

// ── XP & Levels ────────────────────────────────────────────────────────────────

function getXPData() {
  try { return JSON.parse(localStorage.getItem(XP_KEY)) || { xp: 0, level: 1 }; }
  catch { return { xp: 0, level: 1 }; }
}

function getLevelForXP(xp) {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) { level = i + 1; break; }
  }
  return level;
}

function getXPProgress(xp) {
  const level = getLevelForXP(xp);
  const lo = LEVEL_THRESHOLDS[level - 1] || 0;
  const hi = LEVEL_THRESHOLDS[level] || lo + 1000;
  const pct = Math.min(100, Math.round(((xp - lo) / (hi - lo)) * 100));
  return { level, currentXP: xp - lo, rangeXP: hi - lo, pct };
}

function addXP(amount) {
  const data = getXPData();
  const prevLevel = getLevelForXP(data.xp);
  data.xp += amount;
  data.level = getLevelForXP(data.xp);
  localStorage.setItem(XP_KEY, JSON.stringify(data));
  return { leveledUp: data.level > prevLevel, newLevel: data.level, totalXP: data.xp };
}

// ── Badges ─────────────────────────────────────────────────────────────────────

function getEarnedBadges() {
  try { return JSON.parse(localStorage.getItem(BADGES_KEY)) || []; }
  catch { return []; }
}

function awardBadge(badgeId) {
  const earned = getEarnedBadges();
  if (earned.includes(badgeId)) return false;
  earned.push(badgeId);
  localStorage.setItem(BADGES_KEY, JSON.stringify(earned));
  return true;
}

// ── Deck builders ──────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(mode, direction) {
  const progress = loadProgress();
  const dirs = direction === "mixed" ? null : [direction];
  const cards = [];
  for (const word of words) {
    for (const dir of (dirs || ["en_es", "es_en"])) {
      if (mode === "still-learning" && !isStillLearning(word.id, dir, progress)) continue;
      if (mode === "new" && !isUnseen(word.id, dir, progress)) continue;
      cards.push({ word, direction: dir });
    }
  }
  return shuffle(cards);
}


// ── Gamification UI helpers ────────────────────────────────────────────────────

function showXPFloat(amount, isBonus) {
  const el = document.createElement("div");
  el.className = `xp-float${isBonus ? " bonus" : ""}`;
  el.textContent = `+${amount} XP`;
  el.style.left = "50%";
  el.style.bottom = "140px";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

function showStreakBanner(streak) {
  const msgs = { 3: "🔥 3 in a row!", 5: "🔥🔥 On fire! 5 streak!", 10: "🌋 UNSTOPPABLE! 10 streak!" };
  const msg = msgs[streak];
  if (!msg) return;
  const el = document.createElement("div");
  el.className = "streak-banner";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

function showBadgeToast(badgeId) {
  const badge = BADGE_DEFS[badgeId];
  if (!badge) return;
  const el = document.createElement("div");
  el.className = "badge-toast";
  el.innerHTML = `
    <span class="badge-toast-icon">${badge.icon}</span>
    <span class="badge-toast-text">
      <span class="badge-toast-title">Badge unlocked: ${badge.name}</span>
      <span class="badge-toast-desc">${badge.desc}</span>
    </span>
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

function showLevelUpBanner(level) {
  const el = document.createElement("div");
  el.className = "level-up-banner";
  el.innerHTML = `
    <div class="lu-tag">Level Up!</div>
    <div class="lu-num">${level}</div>
    <div class="lu-sub">You reached Level ${level}!</div>
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2300);
}

function showMasteryMoment() {
  const el = document.createElement("div");
  el.className = "mastery-star";
  el.textContent = "⭐";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

function triggerConfetti(intensity = 1) {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:999;width:100%;height:100%";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const count = Math.round(90 * intensity);
  const colors = ["#7C3AED","#0EA5E9","#10B981","#F43F5E","#F97316","#FBBF24","#EC4899"];
  const particles = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 150,
    w: 6 + Math.random() * 8,
    h: 3 + Math.random() * 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    vx: -2 + Math.random() * 4,
    vy: 2.5 + Math.random() * 3.5,
    rot: Math.random() * 360,
    rotV: -4 + Math.random() * 8,
  }));
  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.rot += p.rotV;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    frame++;
    if (frame < 200 && particles.some(p => p.y < canvas.height + 20)) requestAnimationFrame(animate);
    else canvas.remove();
  }
  requestAnimationFrame(animate);
}

// ── Rendering ──────────────────────────────────────────────────────────────────

const app = document.getElementById("app");

// ── Subject picker ─────────────────────────────────────────────────────────────

function renderSubjectPicker() {
  const { streak, lastDate } = getDailyStreak();
  const today = new Date().toISOString().slice(0, 10);
  const streakActive = lastDate === today;
  const xpData = getXPData();
  const { level, currentXP, rangeXP, pct } = getXPProgress(xpData.xp);

  app.innerHTML = `
    <div class="home">
      <h1>Flashcards</h1>
      <p class="subtitle">What do you want to practice?</p>

      <div class="gamification-bar">
        <div class="daily-streak-pill ${streakActive ? "active" : streak === 0 ? "inactive" : ""}">
          <span>${streakActive || streak > 0 ? "🔥" : "💤"}</span>
          <span class="streak-num">${streak}</span>
          <span class="streak-lbl">day streak</span>
        </div>
        <div class="xp-pill">
          <div class="xp-pill-header">
            <span class="xp-level-label">Level ${level}</span>
            <span class="xp-count-label">${xpData.xp} XP</span>
          </div>
          <div class="xp-pill-bar-track">
            <div class="xp-pill-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>
      </div>

      <div class="subject-grid">
        <button class="subject-card" id="btn-language">
          <span class="subject-icon">🌎</span>
          <span class="subject-title">Language</span>
          <span class="subject-desc">Sight words &amp; vocab</span>
        </button>
        <button class="subject-card" id="btn-math">
          <span class="subject-icon">✖️</span>
          <span class="subject-title">Math</span>
          <span class="subject-desc">Multiplication tables</span>
        </button>
      </div>
    </div>
  `;

  document.getElementById("btn-language").addEventListener("click", renderLanguagePicker);
  document.getElementById("btn-math").addEventListener("click", renderMathPicker);
}


// ── Language picker ────────────────────────────────────────────────────────────

function renderLanguagePicker() {
  app.innerHTML = `
    <div class="home">
      <button class="btn-back" id="btn-back">← Back</button>
      <h1>Language</h1>
      <p class="subtitle">Choose a language pair</p>
      <div class="option-group">
        <button class="picker-row" id="btn-es-en">
          <span>🇺🇸 English / 🇲🇽 Spanish</span>
          <span class="picker-arrow">›</span>
        </button>
      </div>
    </div>
  `;
  document.getElementById("btn-back").addEventListener("click", renderSubjectPicker);
  document.getElementById("btn-es-en").addEventListener("click", renderLanguageHome);
}

// ── Language home ──────────────────────────────────────────────────────────────

function renderLanguageHome() {
  const { mastered, stillLearning, unseen } = getStats();

  app.innerHTML = `
    <div class="home">
      <button class="btn-back" id="btn-back">← Back</button>
      <h1>Spanish Sight Words</h1>
      <p class="subtitle">Tap a card to reveal its translation</p>

      <div class="stats-bar">
        <div class="stat-pill mastered">
          <div class="num">${mastered}</div>
          <div class="label">Mastered</div>
        </div>
        <div class="stat-pill still-learning">
          <div class="num">${stillLearning}</div>
          <div class="label">Still Learning</div>
        </div>
        <div class="stat-pill unseen">
          <div class="num">${unseen}</div>
          <div class="label">New</div>
        </div>
      </div>

      <div class="section-label">Word set</div>
      <div class="option-group" id="mode-group">
        <label>
          <input type="radio" name="mode" value="all" checked />
          All words
        </label>
        <label>
          <input type="radio" name="mode" value="still-learning" ${stillLearning === 0 ? "disabled" : ""} />
          Still learning only ${stillLearning > 0 ? `(${stillLearning})` : "(none yet)"}
        </label>
        <label>
          <input type="radio" name="mode" value="new" ${unseen === 0 ? "disabled" : ""} />
          New words only ${unseen > 0 ? `(${unseen})` : "(none yet)"}
        </label>
      </div>

      <div class="section-label">Direction</div>
      <div class="option-group" id="dir-group">
        <label>
          <input type="radio" name="dir" value="mixed" checked />
          Mixed (random)
        </label>
        <label>
          <input type="radio" name="dir" value="en_es" />
          English → Spanish
        </label>
        <label>
          <input type="radio" name="dir" value="es_en" />
          Spanish → English
        </label>
      </div>

      <button class="btn-start" id="btn-start">Start</button>
      <button class="reset-link" id="btn-reset">Reset all progress</button>
    </div>
  `;

  document.getElementById("btn-back").addEventListener("click", renderLanguagePicker);

  document.getElementById("btn-start").addEventListener("click", () => {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const dir  = document.querySelector('input[name="dir"]:checked').value;
    const deck = buildDeck(mode, dir);
    if (deck.length === 0) {
      if (mode === "still-learning") alert("No words in 'still learning' yet! Play 'All words' first.");
      else if (mode === "new") alert("No new words left! You've seen them all.");
      return;
    }
    renderCardScreen(deck, renderLanguageHome);
  });

  document.getElementById("btn-reset").addEventListener("click", () => {
    if (confirm("Reset all language progress? This cannot be undone.")) {
      localStorage.removeItem(STORAGE_KEY);
      renderLanguageHome();
    }
  });
}

// ── Math picker ────────────────────────────────────────────────────────────────

function renderMathPicker() {
  app.innerHTML = `
    <div class="home">
      <button class="btn-back" id="btn-back">← Back</button>
      <h1>Math</h1>
      <p class="subtitle">Choose a topic</p>
      <div class="option-group">
        <button class="picker-row" id="btn-mult">
          <span>✖️ Multiplication Tables</span>
          <span class="picker-arrow">›</span>
        </button>
      </div>
    </div>
  `;
  document.getElementById("btn-back").addEventListener("click", renderSubjectPicker);
  document.getElementById("btn-mult").addEventListener("click", () => renderMathHome("all"));
}

// ── Math home ──────────────────────────────────────────────────────────────────

function renderMathHome(selectedTable) {
  const { mastered, stillLearning, unseen } = getMathStats(selectedTable);
  const tableOptions = [
    { value: "all", label: "All tables (1–9)" },
    ...Array.from({ length: 9 }, (_, i) => ({ value: i + 1, label: `${i + 1}× table` }))
  ];

  app.innerHTML = `
    <div class="home">
      <button class="btn-back" id="btn-back">← Back</button>
      <h1>Multiplication</h1>
      <p class="subtitle">Practice your times tables</p>

      <div class="stats-bar">
        <div class="stat-pill mastered">
          <div class="num">${mastered}</div>
          <div class="label">Mastered</div>
        </div>
        <div class="stat-pill still-learning">
          <div class="num">${stillLearning}</div>
          <div class="label">Still Learning</div>
        </div>
        <div class="stat-pill unseen">
          <div class="num">${unseen}</div>
          <div class="label">New</div>
        </div>
      </div>

      <div class="section-label">Table</div>
      <div class="option-group" id="table-group">
        ${tableOptions.map(opt => `
          <label>
            <input type="radio" name="table" value="${opt.value}" ${String(selectedTable) === String(opt.value) ? "checked" : ""} />
            ${opt.label}
          </label>
        `).join("")}
      </div>

      <div class="section-label">Card set</div>
      <div class="option-group" id="mode-group">
        <label>
          <input type="radio" name="mode" value="all" checked />
          All facts
        </label>
        <label>
          <input type="radio" name="mode" value="still-learning" ${stillLearning === 0 ? "disabled" : ""} />
          Still learning only ${stillLearning > 0 ? `(${stillLearning})` : "(none yet)"}
        </label>
        <label>
          <input type="radio" name="mode" value="new" ${unseen === 0 ? "disabled" : ""} />
          New only ${unseen > 0 ? `(${unseen})` : "(none yet)"}
        </label>
      </div>

      <button class="btn-start" id="btn-start">Start</button>
      <button class="reset-link" id="btn-reset">Reset math progress</button>
    </div>
  `;

  document.querySelectorAll('input[name="table"]').forEach(radio => {
    radio.addEventListener("change", () => {
      renderMathHome(radio.value === "all" ? "all" : parseInt(radio.value));
    });
  });

  document.getElementById("btn-back").addEventListener("click", renderMathPicker);

  document.getElementById("btn-start").addEventListener("click", () => {
    const tableVal = document.querySelector('input[name="table"]:checked').value;
    const table = tableVal === "all" ? "all" : parseInt(tableVal);
    const mode  = document.querySelector('input[name="mode"]:checked').value;
    const deck  = buildMathDeck(mode, table);
    if (deck.length === 0) {
      if (mode === "still-learning") alert("No facts in 'still learning' yet! Play 'All facts' first.");
      else if (mode === "new") alert("No new facts left! You've seen them all.");
      return;
    }
    renderMathCardScreen(deck);
  });

  document.getElementById("btn-reset").addEventListener("click", () => {
    if (confirm("Reset all math progress? This cannot be undone.")) {
      localStorage.removeItem(MATH_STORAGE_KEY);
      renderMathHome(selectedTable);
    }
  });
}

// ── Language card screen ───────────────────────────────────────────────────────

function renderCardScreen(deck, onExit, sessionType = "normal") {
  let index = 0;
  let sessionCorrect = 0;
  let sessionWrong = 0;
  let sessionStreak = 0;
  let sessionXP = 0;
  let flipped = false;
  let animating = false;

  function renderCard() {
    if (index >= deck.length) {
      renderDone(sessionCorrect, sessionWrong, onExit, sessionType, sessionXP);
      return;
    }

    const { word, direction } = deck[index];
    const isEnEs = direction === "en_es";
    const prompt = isEnEs ? word.en : word.es;
    const answer = isEnEs ? word.es : word.en;
    const promptLang = isEnEs ? "English" : "Spanish";
    const answerLang = isEnEs ? "Spanish" : "English";
    const dirLabel = isEnEs ? "English → Spanish" : "Spanish → English";
    const badgeClass = isEnEs ? "en-es" : "es-en";
    const frontCardClass = isEnEs ? "" : "es-en-front";
    const backCardClass  = isEnEs ? "" : "es-en-back";
    const pct = Math.round((index / deck.length) * 100);

    const hasConjugations = isEnEs && word.conjugations;
    const conjugationTable = hasConjugations
      ? `<div class="conjugation-table">
          ${Object.entries(word.conjugations).map(([pronoun, form]) =>
            `<div class="conj-row"><span class="conj-pronoun">${pronoun}</span><span class="conj-form">${form}</span></div>`
          ).join("")}
        </div>`
      : "";

    const hl = s => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    const sentenceFront = hl(isEnEs ? word.sentence_en : word.sentence_es);
    const sentenceBack  = hl(isEnEs ? word.sentence_es : word.sentence_en);

    flipped = false;
    animating = false;

    app.innerHTML = `
      <div class="card-screen">
        <div class="card-header">
          <button class="btn-exit" id="btn-exit">← Home</button>
          <div class="header-center">
            ${sessionStreak > 0 ? `<span class="streak-badge">🔥 ${sessionStreak}</span>` : ""}
            <span class="card-counter">${index + 1} / ${deck.length}</span>
          </div>
          <span class="direction-badge ${badgeClass}">${dirLabel}</span>
        </div>
        <div class="card-area">
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" style="width:${pct}%"></div>
          </div>
          <div class="card-flip-container ${hasConjugations ? "has-conjugations" : ""}" id="card-flip">
            <div class="card-inner">
              <div class="card-face card-front ${frontCardClass}">
                <span class="lang-label">${promptLang}</span>
                <span class="word">${prompt}</span>
                <span class="card-sentence">${sentenceFront}</span>
                <span class="tap-hint">tap to reveal</span>
              </div>
              <div class="card-face card-back ${backCardClass} ${hasConjugations ? "with-conjugations" : ""}">
                ${hasConjugations ? `
                  <span class="lang-label">${answerLang}</span>
                  <div class="verb-block">
                    <span class="word word-verb">${answer}</span>
                    ${conjugationTable}
                  </div>
                  <span class="card-sentence">${sentenceBack}</span>
                ` : `
                  <span class="lang-label">${answerLang}</span>
                  <span class="word">${answer}</span>
                  <span class="card-sentence">${sentenceBack}</span>
                `}
              </div>
            </div>
          </div>
          <div class="answer-buttons" id="answer-btns">
            <button class="btn-missed-it" id="btn-missed">✗ Missed it</button>
            <button class="btn-got-it" id="btn-got">✓ Got it</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("card-flip").addEventListener("click", () => {
      if (animating) return;
      document.getElementById("card-flip").classList.toggle("flipped");
      if (!flipped) {
        flipped = true;
        document.getElementById("answer-btns").classList.add("visible");
      }
    });

    document.getElementById("btn-got").addEventListener("click", () => {
      if (!flipped || animating) return;
      animating = true;

      // Check mastery transition
      const prevProgress = loadProgress();
      const [prevC = 0, prevW = 0] = (prevProgress[word.id] || {})[direction] || [];
      const wasLearning = prevW > prevC;

      recordResult(word.id, direction, true);

      const newProgress = loadProgress();
      const [newC = 0, newW = 0] = (newProgress[word.id] || {})[direction] || [];
      const justMastered = wasLearning && newC > newW;

      // Streak & XP
      sessionStreak++;
      sessionCorrect++;
      const isBonus = sessionStreak >= 3;
      const xpGain = isBonus ? 15 : 10;
      const xpResult = addXP(xpGain);
      sessionXP += xpGain;

      // Visuals
      showXPFloat(xpGain, isBonus);
      showStreakBanner(sessionStreak);
      if (justMastered) showMasteryMoment();

      const cardFlip = document.getElementById("card-flip");
      cardFlip.classList.add(justMastered ? "mastery-flash" : "correct-flash");

      // Badges
      const newBadges = [];
      if (sessionCorrect === 1 && awardBadge("first-blood"))   newBadges.push("first-blood");
      if (sessionStreak === 5 && awardBadge("hot-streak-5"))   newBadges.push("hot-streak-5");
      if (sessionStreak === 10 && awardBadge("on-fire-10"))    newBadges.push("on-fire-10");
      newBadges.forEach((b, i) => setTimeout(() => showBadgeToast(b), 300 + i * 800));
      if (xpResult.leveledUp) setTimeout(() => showLevelUpBanner(xpResult.newLevel), 500);

      setTimeout(() => { index++; renderCard(); }, 400);
    });

    document.getElementById("btn-missed").addEventListener("click", () => {
      if (!flipped || animating) return;
      animating = true;

      recordResult(word.id, direction, false);
      sessionWrong++;
      sessionStreak = 0;

      document.getElementById("card-flip").classList.add("miss-shake");
      setTimeout(() => { index++; renderCard(); }, 430);
    });

    document.getElementById("btn-exit").addEventListener("click", onExit);
  }

  renderCard();
}

// ── Math card screen ───────────────────────────────────────────────────────────

function renderMathCardScreen(deck) {
  let index = 0;
  let sessionCorrect = 0;
  let sessionWrong = 0;
  let sessionStreak = 0;
  let sessionXP = 0;
  let flipped = false;
  let animating = false;

  function renderCard() {
    if (index >= deck.length) {
      renderDone(sessionCorrect, sessionWrong, renderMathPicker, "math", sessionXP);
      return;
    }

    const fact = deck[index];
    const pct = Math.round((index / deck.length) * 100);
    flipped = false;
    animating = false;

    app.innerHTML = `
      <div class="card-screen">
        <div class="card-header">
          <button class="btn-exit" id="btn-exit">← Home</button>
          <div class="header-center">
            ${sessionStreak > 0 ? `<span class="streak-badge">🔥 ${sessionStreak}</span>` : ""}
            <span class="card-counter">${index + 1} / ${deck.length}</span>
          </div>
          <span class="direction-badge en-es">Multiplication</span>
        </div>
        <div class="card-area">
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" style="width:${pct}%"></div>
          </div>
          <div class="card-flip-container" id="card-flip">
            <div class="card-inner">
              <div class="card-face card-front">
                <span class="word">${fact.a} × ${fact.b}</span>
                <span class="tap-hint">tap to reveal</span>
              </div>
              <div class="card-face card-back math-back">
                <span class="math-problem">${fact.a} × ${fact.b}</span>
                <span class="math-answer">${fact.answer}</span>
              </div>
            </div>
          </div>
          <div class="answer-buttons" id="answer-btns">
            <button class="btn-missed-it" id="btn-missed">✗ Missed it</button>
            <button class="btn-got-it" id="btn-got">✓ Got it</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("card-flip").addEventListener("click", () => {
      if (animating) return;
      document.getElementById("card-flip").classList.toggle("flipped");
      if (!flipped) {
        flipped = true;
        document.getElementById("answer-btns").classList.add("visible");
      }
    });

    document.getElementById("btn-got").addEventListener("click", () => {
      if (!flipped || animating) return;
      animating = true;

      // Check mastery transition
      const prevProgress = loadMathProgress();
      const [prevC = 0, prevW = 0] = prevProgress[fact.id] || [];
      const wasLearning = prevW > prevC;

      recordMathResult(fact.id, true);

      const newProgress = loadMathProgress();
      const [newC = 0, newW = 0] = newProgress[fact.id] || [];
      const justMastered = wasLearning && newC > newW;

      // Streak & XP
      sessionStreak++;
      sessionCorrect++;
      const isBonus = sessionStreak >= 3;
      const xpGain = isBonus ? 15 : 10;
      const xpResult = addXP(xpGain);
      sessionXP += xpGain;

      // Visuals
      showXPFloat(xpGain, isBonus);
      showStreakBanner(sessionStreak);
      if (justMastered) showMasteryMoment();

      const cardFlip = document.getElementById("card-flip");
      cardFlip.classList.add(justMastered ? "mastery-flash" : "correct-flash");

      // Badges
      const newBadges = [];
      if (sessionCorrect === 1 && awardBadge("first-blood"))   newBadges.push("first-blood");
      if (sessionStreak === 5 && awardBadge("hot-streak-5"))   newBadges.push("hot-streak-5");
      if (sessionStreak === 10 && awardBadge("on-fire-10"))    newBadges.push("on-fire-10");
      newBadges.forEach((b, i) => setTimeout(() => showBadgeToast(b), 300 + i * 800));
      if (xpResult.leveledUp) setTimeout(() => showLevelUpBanner(xpResult.newLevel), 500);

      setTimeout(() => { index++; renderCard(); }, 400);
    });

    document.getElementById("btn-missed").addEventListener("click", () => {
      if (!flipped || animating) return;
      animating = true;

      recordMathResult(fact.id, false);
      sessionWrong++;
      sessionStreak = 0;

      document.getElementById("card-flip").classList.add("miss-shake");
      setTimeout(() => { index++; renderCard(); }, 430);
    });

    document.getElementById("btn-exit").addEventListener("click", renderMathPicker);
  }

  renderCard();
}

// ── Done screen ────────────────────────────────────────────────────────────────

function renderDone(correct, wrong, onHome, sessionType = "normal", sessionXP = 0) {
  const total = correct + wrong;
  const pct   = total === 0 ? 0 : Math.round((correct / total) * 100);

  let message, trophy;
  if (pct === 100 && total > 0) {
    message = "PERFECT! You're on fire! 🌋";
    trophy = "🏆";
  } else if (pct >= 80) {
    message = "Excellent session!";
    trophy = "🎉";
  } else if (pct >= 50) {
    message = "Good work, keep it up!";
    trophy = "👍";
  } else {
    message = "Keep practicing, you'll get there!";
    trophy = "💪";
  }

  // Mark daily streak
  markSessionPlayed();
  const { streak } = getDailyStreak();

  // Check for new badges
  const newBadges = [];
  if (wrong === 0 && total > 0 && awardBadge("flawless")) newBadges.push("flawless");


  app.innerHTML = `
    <div class="done-screen">
      <div class="trophy">${trophy}</div>
      <h2>All done!</h2>
      <p>${message}</p>
      ${streak > 1 ? `<p class="done-streak">🔥 ${streak} day streak!</p>` : ""}
      <div class="done-stats">
        <div class="done-stat good">
          <div class="num">${correct}</div>
          <div class="lbl">Got it</div>
        </div>
        <div class="done-stat bad">
          <div class="num">${wrong}</div>
          <div class="lbl">Missed</div>
        </div>
        ${sessionXP > 0 ? `
        <div class="done-stat xp">
          <div class="num">+${sessionXP}</div>
          <div class="lbl">XP</div>
        </div>` : ""}
      </div>
      <button class="btn-home" id="btn-home">Back to Home</button>
    </div>
  `;

  document.getElementById("btn-home").addEventListener("click", onHome);

  // Confetti based on performance
  if (total > 0) {
    const intensity = pct === 100 ? 1.5 : pct >= 80 ? 1 : pct >= 50 ? 0.6 : 0.3;
    setTimeout(() => triggerConfetti(intensity), 150);
  }

  // Badge toasts after a short delay
  newBadges.forEach((b, i) => setTimeout(() => showBadgeToast(b), 700 + i * 900));
}

// ── Boot ───────────────────────────────────────────────────────────────────────

async function init() {
  await loadWords();
  renderSubjectPicker();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  }
}

init();
