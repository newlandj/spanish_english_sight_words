const STORAGE_KEY = "sightwords_progress";
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
function isStruggling(wordId, direction, progress) {
  const entry = (progress[wordId] || {})[direction];
  if (!entry) return false; // unseen = not struggling
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
  let mastered = 0, struggling = 0, unseen = 0;
  for (const word of words) {
    const dirs = ["en_es", "es_en"];
    for (const dir of dirs) {
      const entry = (progress[word.id] || {})[dir];
      if (!entry) { unseen++; continue; }
      const [correct, wrong] = entry;
      if (correct > wrong) mastered++;
      else if (wrong > correct) struggling++;
      else unseen++;
    }
  }
  return { mastered, struggling, unseen };
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
 * mode: "all" | "struggling" | "new"
 * direction: "en_es" | "es_en" | "mixed"
 */
function buildDeck(mode, direction) {
  const progress = loadProgress();
  const dirs = direction === "mixed" ? null : [direction];

  let cards = [];
  for (const word of words) {
    const wordDirs = dirs || ["en_es", "es_en"];
    for (const dir of wordDirs) {
      if (mode === "struggling" && !isStruggling(word.id, dir, progress)) continue;
      if (mode === "new" && !isUnseen(word.id, dir, progress)) continue;
      cards.push({ word, direction: dir });
    }
  }

  return shuffle(cards);
}

// ── Rendering ─────────────────────────────────────────────────────────────────

const app = document.getElementById("app");

function renderHome() {
  const { mastered, struggling, unseen } = getStats();
  const total = mastered + struggling + unseen;
  const hasStruggling = struggling > 0;
  const hasUnseen = unseen > 0;

  app.innerHTML = `
    <div class="home">
      <h1>Spanish Sight Words</h1>
      <p class="subtitle">Tap a card to reveal its translation</p>

      <div class="stats-bar">
        <div class="stat-pill mastered">
          <div class="num">${mastered}</div>
          <div class="label">Mastered</div>
        </div>
        <div class="stat-pill struggling">
          <div class="num">${struggling}</div>
          <div class="label">Struggling</div>
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
          <input type="radio" name="mode" value="struggling" ${!hasStruggling ? "disabled" : ""} />
          Struggling words only ${struggling > 0 ? `(${struggling})` : "(none yet)"}
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

  document.getElementById("btn-start").addEventListener("click", () => {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const dir = document.querySelector('input[name="dir"]:checked').value;
    const deck = buildDeck(mode, dir);
    if (deck.length === 0) {
      if (mode === "struggling") alert("No struggling words yet! Play 'All words' first.");
      else if (mode === "new") alert("No new words left! You've seen them all.");
      return;
    }
    renderCardScreen(deck);
  });

  document.getElementById("btn-reset").addEventListener("click", () => {
    if (confirm("Reset all progress? This cannot be undone.")) {
      localStorage.removeItem(STORAGE_KEY);
      renderHome();
    }
  });
}

function renderCardScreen(deck) {
  let index = 0;
  let sessionCorrect = 0;
  let sessionWrong = 0;
  let flipped = false;

  function renderCard() {
    if (index >= deck.length) {
      renderDone(sessionCorrect, sessionWrong);
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

    document.getElementById("btn-exit").addEventListener("click", () => {
      renderHome();
    });
  }

  renderCard();
}

function renderDone(correct, wrong) {
  app.innerHTML = `
    <div class="done-screen">
      <div class="trophy">🎉</div>
      <h2>All done!</h2>
      <p>Great work on your sight words.</p>
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
  document.getElementById("btn-home").addEventListener("click", renderHome);
}

// ── Boot ─────────────────────────────────────────────────────────────────────

async function init() {
  await loadWords();
  renderHome();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  }
}

init();
