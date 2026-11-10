// Habit Tracker
// Data lives in localStorage on this device only.
// state = { habits: [{ id, name, color, created: "YYYY-MM-DD", done: { "YYYY-MM-DD": true } }] }

const STORAGE_KEY = "habit-tracker-v1";
const COLOURS = ["#16a34a", "#2563eb", "#9333ea", "#db2777", "#ea580c", "#0891b2", "#ca8a04", "#475569"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

let state = load();
let editingId = null;
let pickedColour = COLOURS[0];

// ---------- Dates (local time, as "YYYY-MM-DD") ----------
function key(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

// ---------- Storage ----------
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.habits)) return saved;
  } catch (e) {}
  return { habits: [] };
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

// ---------- Streak maths ----------
// Current streak: days in a row ending today. If today isn't ticked yet,
// we count back from yesterday, so the streak isn't "lost" until the day ends.
function currentStreak(h) {
  let d = today();
  if (!h.done[key(d)]) d = addDays(d, -1);
  let n = 0;
  while (h.done[key(d)]) { n++; d = addDays(d, -1); }
  return n;
}
// Best streak: the longest run of consecutive ticked days ever.
function bestStreak(h) {
  const days = Object.keys(h.done).filter(k => h.done[k]).sort();
  let best = 0, run = 0, prev = null;
  for (const k of days) {
    const d = new Date(k + "T00:00:00");
    run = prev && key(addDays(prev, 1)) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
// Last 7 days completion %, counting only days on or after each habit was created.
function weekPercent() {
  let possible = 0, done = 0;
  const t = today();
  for (const h of state.habits) {
    for (let i = 0; i < 7; i++) {
      const k = key(addDays(t, -i));
      if (k < h.created) continue;
      possible++;
      if (h.done[k]) done++;
    }
  }
  return possible ? Math.round((done / possible) * 100) : null;
}

// ---------- Rendering ----------
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function render() {
  renderSummary();
  renderHabits();
  renderYearSelect();
  renderYear();
}

function renderSummary() {
  const t = key(today());
  const total = state.habits.length;
  const doneToday = state.habits.filter(h => h.done[t]).length;
  document.getElementById("todayLabel").textContent = "Today, " + today().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
  document.getElementById("todayCount").textContent = `${doneToday} / ${total}`;
  let msg = "Add your first habit below";
  if (total) msg = doneToday === total ? "All done for today. Great work!" : `${total - doneToday} left for today`;
  document.getElementById("todayText").textContent = msg;
  document.getElementById("todayBar").style.width = total ? `${(doneToday / total) * 100}%` : "0";
  const w = weekPercent();
  document.getElementById("weekPct").textContent = w === null ? "--" : `${w}%`;
}

function renderHabits() {
  const list = document.getElementById("habitList");
  document.getElementById("emptyMsg").hidden = state.habits.length > 0;
  const t = today(), tk = key(t);
  list.innerHTML = state.habits.map(h => {
    const cur = currentStreak(h), best = bestStreak(h);
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(t, -i), k = key(d);
      const before = k < h.created;
      days.push(`<button type="button" class="day${h.done[k] ? " done" : ""}" data-act="day" data-id="${h.id}" data-day="${k}" ${before ? "disabled" : ""} aria-pressed="${!!h.done[k]}" aria-label="${esc(h.name)} on ${d.toDateString()}">${i === 0 ? "Today" : DAY_NAMES[d.getDay()]}<b>${d.getDate()}</b></button>`);
    }
    return `<article class="card habit" style="--hc:${h.color}">
      <div class="habit-head">
        <button type="button" class="tick${h.done[tk] ? " done" : ""}" data-act="tick" data-id="${h.id}" aria-pressed="${!!h.done[tk]}" aria-label="Mark ${esc(h.name)} done today">${CHECK}</button>
        <div class="habit-info">
          <p class="habit-name">${esc(h.name)}</p>
          <p class="habit-stats">Streak <span class="streak-num">${cur} ${cur === 1 ? "day" : "days"}</span> · Best ${best}</p>
        </div>
      </div>
      <div class="days">${days.join("")}</div>
      <div class="habit-actions">
        <button type="button" class="btn small" data-act="edit" data-id="${h.id}">Edit</button>
        <button type="button" class="btn small" data-act="delete" data-id="${h.id}">Delete</button>
      </div>
    </article>`;
  }).join("");
}

function renderYearSelect() {
  const sel = document.getElementById("yearHabit");
  const current = sel.value || "all";
  sel.innerHTML = `<option value="all">All habits</option>` + state.habits.map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join("");
  sel.value = state.habits.some(h => h.id === current) ? current : "all";
}

function renderYear() {
  const grid = document.getElementById("yearGrid");
  const sel = document.getElementById("yearHabit").value;
  const habits = sel === "all" ? state.habits : state.habits.filter(h => h.id === sel);
  const t = today();
  // Start on the Sunday about one year ago, so columns are weeks like GitHub.
  let start = addDays(t, -364);
  start = addDays(start, -start.getDay());
  const cells = [];
  let activeDays = 0;
  for (let d = new Date(start); d <= addDays(t, 6 - t.getDay()); d = addDays(d, 1)) {
    const k = key(d);
    if (d > t) { cells.push(`<span class="sq future"></span>`); continue; }
    const done = habits.filter(h => h.done[k]).length;
    if (done) activeDays++;
    let level = 0;
    if (done && habits.length) {
      const r = done / habits.length;
      level = r >= 1 ? 4 : r >= 0.66 ? 3 : r >= 0.33 ? 2 : 1;
    }
    const label = `${d.toDateString()}: ${done} of ${habits.length}`;
    cells.push(`<span class="sq l${level}" title="${label}" aria-label="${label}"></span>`);
  }
  grid.innerHTML = cells.join("");
  document.getElementById("yearText").textContent = habits.length
    ? `${activeDays} active ${activeDays === 1 ? "day" : "days"} in the last year.`
    : "Add a habit to start filling your year.";
  // Show the most recent weeks first on small screens.
  const sc = document.getElementById("yearScroll");
  sc.scrollLeft = sc.scrollWidth;
}

// ---------- Colours ----------
function renderColours() {
  document.getElementById("colours").innerHTML = COLOURS.map(c =>
    `<button type="button" class="colour" role="radio" aria-checked="${c === pickedColour}" aria-label="Colour ${c}" data-colour="${c}" style="background:${c}"></button>`
  ).join("");
}

// ---------- Actions ----------
function toggle(id, dayKey) {
  const h = state.habits.find(x => x.id === id);
  if (!h) return;
  if (h.done[dayKey]) delete h.done[dayKey]; else h.done[dayKey] = true;
  save(); render();
}

function resetForm() {
  editingId = null;
  pickedColour = COLOURS[state.habits.length % COLOURS.length];
  document.getElementById("habitForm").reset();
  document.getElementById("formTitle").textContent = "Add a habit";
  document.getElementById("saveBtn").textContent = "Add habit";
  document.getElementById("cancelBtn").hidden = true;
  document.getElementById("error").textContent = "";
  renderColours();
}

document.getElementById("habitForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const err = document.getElementById("error");
  if (!name) { err.textContent = "Give your habit a name."; return; }
  if (state.habits.some(h => h.name.toLowerCase() === name.toLowerCase() && h.id !== editingId)) { err.textContent = "You already have a habit with this name."; return; }
  if (editingId) {
    const h = state.habits.find(x => x.id === editingId);
    h.name = name; h.color = pickedColour;
  } else {
    state.habits.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, color: pickedColour, created: key(today()), done: {} });
  }
  save(); resetForm(); render();
});

document.getElementById("cancelBtn").addEventListener("click", resetForm);

document.getElementById("colours").addEventListener("click", e => {
  const b = e.target.closest("[data-colour]");
  if (!b) return;
  pickedColour = b.dataset.colour;
  renderColours();
});

document.getElementById("habitList").addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const { act, id } = b.dataset;
  if (act === "tick") toggle(id, key(today()));
  if (act === "day") toggle(id, b.dataset.day);
  if (act === "edit") {
    const h = state.habits.find(x => x.id === id);
    editingId = id; pickedColour = h.color;
    document.getElementById("name").value = h.name;
    document.getElementById("formTitle").textContent = "Edit habit";
    document.getElementById("saveBtn").textContent = "Save changes";
    document.getElementById("cancelBtn").hidden = false;
    renderColours();
    document.getElementById("name").focus();
  }
  if (act === "delete") {
    const h = state.habits.find(x => x.id === id);
    if (confirm(`Delete "${h.name}" and all its history?`)) {
      state.habits = state.habits.filter(x => x.id !== id);
      save(); render();
    }
  }
});

document.getElementById("yearHabit").addEventListener("change", renderYear);

// Refresh when the app is reopened on a new day.
document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });

resetForm();
render();
