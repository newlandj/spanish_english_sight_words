const STORAGE_KEY = "sightwords_progress";
const MATH_STORAGE_KEY = "math_progress";
const WORDS_URL = "./words.json";

// ── Data ──────────────────────────────────────────────────────────────────────

let words = [];

async function loadWords() {
  const res = await fetch(WORDS_URL);
  words = await res.json();
}

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function recordResult(wordId, direction, correct) {
  const progress = loadProgress();
  if (!progress[wordId]) progress[wordId] = {};
  const key = direction; // "en_es" or "es_en"
  const [c, w] = progress[wordId][key] || [0, 0];
  progress[wordId][key] = correct ? [c + 1, w] : [c, w + 1];
  saveProgress(progress);
}

// direction: "en_es" | "es_en"
function isStillLearning(wordId, direction, progress) {
  const entry = (progress[wordId] || {})[direction];
  if (!entry) return false;
  const [correct, wrong] = entry;
  return wrong > correct;
}

function isUnseen(wordId, direction, progress) {
  const entry = (progress[wordId] || {})[direction];
  if (!entry) return true;
  const [correct, wrong] = entry;
  return correct === wrong;
}

function getStats() {
  const progress = loadProgress();
  let mastered = 0, stillLearning = 0, unseen = 0;
  for (const word of words) {
    const dirs = ["en_es", "es_en"];
    for (const dir of dirs) {
      const entry = (progress[word.id] || {})[dir];
      if (!entry) { unseen++; continue; }
      const [correct, wrong] = entry;
      if (correct > wrong) mastered++;
      else if (wrong > correct) stillLearning++;
      else unseen++;
    }
  }
  return { mastered, stillLearning, unseen };
}

// ── Deck builder ──────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Returns array of { word, direction } objects.
 * mode: "all" | "still-learning" | "new"
 * direction: "en_es" | "es_en" | "mixed"
 */
function buildDeck(mode, direction) {
  const progress = loadProgress();
  const dirs = direction === "mixed" ? null : [direction];

  let cards = [];
  for (const word of words) {
    const wordDirs = dirs || ["en_es", "es_en"];
    for (const dir of wordDirs) {
      if (mode === "still-learning" && !isStillLearning(word.id, dir, progress)) continue;
      if (mode === "new" && !isUnseen(word.id, dir, progress)) continue;
      cards.push({ word, direction: dir });
    }
  }

  return shuffle(cards);
}

// ── Math data & logic ─────────────────────────────────────────────────────────

function loadMathProgress() {
  try {
    return JSON.parse(localStorage.getItem(MATH_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
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
  const facts = getMathFacts(table);
  for (const fact of facts) {
    const entry = progress[fact.id];
    if (!entry) { unseen++; continue; }
    const [correct, wrong] = entry;
    if (correct > wrong) mastered++;
    else if (wrong > correct) stillLearning++;
    else unseen++;
  }
  return { mastered, stillLearning, unseen };
}

// table: number 1-9 or "all"
function getMathFacts(table) {
  const facts = [];
  const tables = table === "all" ? [1,2,3,4,5,6,7,8,9] : [table];
  for (const a of tables) {
    for (let b = 1; b <= 9; b++) {
      facts.push({ id: `${a}x${b}`, a, b, answer: a * b });
    }
  }
  return facts;
}

function buildMathDeck(mode, table) {
  const progress = loadMathProgress();
  const facts = getMathFacts(table);
  let cards = facts.filter(fact => {
    const entry = progress[fact.id];
    if (mode === "still-learning") {
      if (!entry) return false;
      const [c, w] = entry;
      return w > c;
    }
    if (mode === "new") {
      if (!entry) return true;
      const [c, w] = entry;
      return c === w;
    }
    return true; // "all"
  });
  return shuffle(cards);
}

// ── Rendering ─────────────────────────────────────────────────────────────────

const app = document.getElementById("app");

// ── Subject picker ────────────────────────────────────────────────────────────

function renderSubjectPicker() {
  app.innerHTML = `
    <div class="home">
      <h1>Flashcards</h1>
      <p class="subtitle">What do you want to practice?</p>
      <div class="subject-grid">
        <button class="subject-card" id="btn-language">
          <span class="subject-icon">🌎</span>
          <span class="subject-title">Language</span>
          <span class="subject-desc">Sight words &amp; vocabulary</span>
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

// ── Language picker ───────────────────────────────────────────────────────────

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

// ── Language home ─────────────────────────────────────────────────────────────

function renderLanguageHome() {
  const { mastered, stillLearning, unseen } = getStats();
  const hasStillLearning = stillLearning > 0;
  const hasUnseen = unseen > 0;

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
          <input type="radio" name="mode" value="still-learning" ${!hasStillLearning ? "disabled" : ""} />
          Still learning only ${stillLearning > 0 ? `(${stillLearning})` : "(none yet)"}
        </label>
        <label>
          <input type="radio" name="mode" value="new" ${!hasUnseen ? "disabled" : ""} />
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
    const dir = document.querySelector('input[name="dir"]:checked').value;
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

// ── Math picker ───────────────────────────────────────────────────────────────

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

// ── Math home ─────────────────────────────────────────────────────────────────

function renderMathHome(selectedTable) {
  const { mastered, stillLearning, unseen } = getMathStats(selectedTable);
  const hasStillLearning = stillLearning > 0;
  const hasUnseen = unseen > 0;

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
          <input type="radio" name="mode" value="still-learning" ${!hasStillLearning ? "disabled" : ""} />
          Still learning only ${stillLearning > 0 ? `(${stillLearning})` : "(none yet)"}
        </label>
        <label>
          <input type="radio" name="mode" value="new" ${!hasUnseen ? "disabled" : ""} />
          New only ${unseen > 0 ? `(${unseen})` : "(none yet)"}
        </label>
      </div>

      <button class="btn-start" id="btn-start">Start</button>
      <button class="reset-link" id="btn-reset">Reset math progress</button>
    </div>
  `;

  // Re-render stats when table selection changes
  document.querySelectorAll('input[name="table"]').forEach(radio => {
    radio.addEventListener("change", () => {
      const val = radio.value === "all" ? "all" : parseInt(radio.value);
      renderMathHome(val);
    });
  });

  document.getElementById("btn-back").addEventListener("click", renderMathPicker);

  document.getElementById("btn-start").addEventListener("click", () => {
    const tableVal = document.querySelector('input[name="table"]:checked').value;
    const table = tableVal === "all" ? "all" : parseInt(tableVal);
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const deck = buildMathDeck(mode, table);
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

// ── Math card screen ──────────────────────────────────────────────────────────

function renderMathCardScreen(deck) {
  let index = 0;
  let sessionCorrect = 0;
  let sessionWrong = 0;
  let flipped = false;

  function renderCard() {
    if (index >= deck.length) {
      renderDone(sessionCorrect, sessionWrong, renderMathPicker);
      return;
    }

    const fact = deck[index];
    const pct = Math.round((index / deck.length) * 100);
    flipped = false;

    app.innerHTML = `
      <div class="card-screen">
        <div class="card-header">
          <button class="btn-exit" id="btn-exit">← Home</button>
          <span class="card-counter">${index + 1} / ${deck.length}</span>
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
      document.getElementById("card-flip").classList.toggle("flipped");
      if (!flipped) {
        flipped = true;
        document.getElementById("answer-btns").classList.add("visible");
      }
    });

    document.getElementById("btn-got").addEventListener("click", () => {
      recordMathResult(fact.id, true);
      sessionCorrect++;
      index++;
      renderCard();
    });

    document.getElementById("btn-missed").addEventListener("click", () => {
      recordMathResult(fact.id, false);
      sessionWrong++;
      index++;
      renderCard();
    });

    document.getElementById("btn-exit").addEventListener("click", renderMathPicker);
  }

  renderCard();
}

// ── Language card screen ──────────────────────────────────────────────────────

function renderCardScreen(deck, onExit) {
  let index = 0;
  let sessionCorrect = 0;
  let sessionWrong = 0;
  let flipped = false;

  function renderCard() {
    if (index >= deck.length) {
      renderDone(sessionCorrect, sessionWrong, onExit);
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
    const backCardClass = isEnEs ? "" : "es-en-back";
    const pct = Math.round((index / deck.length) * 100);

    // Conjugation table: only show on the Spanish-answer side (en→es)
    const hasConjugations = isEnEs && word.conjugations;
    const conjugationTable = hasConjugations
      ? `<div class="conjugation-table">
          ${Object.entries(word.conjugations).map(([pronoun, form]) =>
            `<div class="conj-row"><span class="conj-pronoun">${pronoun}</span><span class="conj-form">${form}</span></div>`
          ).join("")}
        </div>`
      : "";

    const highlightSentence = s => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    const sentenceFront = highlightSentence(isEnEs ? word.sentence_en : word.sentence_es);
    const sentenceBack  = highlightSentence(isEnEs ? word.sentence_es : word.sentence_en);

    flipped = false;

    app.innerHTML = `
      <div class="card-screen">
        <div class="card-header">
          <button class="btn-exit" id="btn-exit">← Home</button>
          <span class="card-counter">${index + 1} / ${deck.length}</span>
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
      document.getElementById("card-flip").classList.toggle("flipped");
      if (!flipped) {
        flipped = true;
        document.getElementById("answer-btns").classList.add("visible");
      }
    });

    document.getElementById("btn-got").addEventListener("click", () => {
      recordResult(word.id, direction, true);
      sessionCorrect++;
      index++;
      renderCard();
    });

    document.getElementById("btn-missed").addEventListener("click", () => {
      recordResult(word.id, direction, false);
      sessionWrong++;
      index++;
      renderCard();
    });

    document.getElementById("btn-exit").addEventListener("click", onExit);
  }

  renderCard();
}

// ── Done screen ───────────────────────────────────────────────────────────────

function renderDone(correct, wrong, onHome) {
  app.innerHTML = `
    <div class="done-screen">
      <div class="trophy">🎉</div>
      <h2>All done!</h2>
      <p>Great work!</p>
      <div class="done-stats">
        <div class="done-stat good">
          <div class="num">${correct}</div>
          <div class="lbl">Got it</div>
        </div>
        <div class="done-stat bad">
          <div class="num">${wrong}</div>
          <div class="lbl">Missed</div>
        </div>
      </div>
      <button class="btn-home" id="btn-home">Back to Home</button>
    </div>
  `;
  document.getElementById("btn-home").addEventListener("click", onHome);
}

// ── Boot ─────────────────────────────────────────────────────────────────────

async function init() {
  await loadWords();
  renderSubjectPicker();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  }
}

init();
