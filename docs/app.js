"use strict";
// Client-only renderer. Reads the three JSONs the Actions regenerate; no build step.
const REPO = "indos-costaction/journal-club";
const NEW_ISSUE = id =>
  `https://github.com/${REPO}/issues/new?template=claim.yml&title=${encodeURIComponent("[claim] ")}` +
  (id ? `&paper_ids=${encodeURIComponent(id)}` : "");

const $ = sel => document.querySelector(sel);
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  for (const k of kids) n.append(k);
  return n;
};

let POOL = [], STATUS = {}, RANKING = { participants: [] };

async function load() {
  const [pool, status, ranking] = await Promise.all([
    fetch("data/pool.json").then(r => r.json()),
    fetch("data/status.json").then(r => r.json()),
    fetch("data/ranking.json").then(r => r.json()).catch(() => ({ participants: [] })),
  ]);
  POOL = pool;
  STATUS = status;
  RANKING = ranking;
  $("#claimTop").href = NEW_ISSUE("");
  initModalities();
  renderProgress();
  renderPool();
  renderBoard();
  const t = status.generated_at ? `Updated ${status.generated_at.slice(0, 10)}.` : "";
  $("#stamp").textContent = t;
}

function initModalities() {
  const mods = [...new Set(POOL.map(p => p.modality))];
  const sel = $("#modality");
  mods.forEach(m => sel.append(el("option", { value: m, textContent: m })));
}

function renderProgress() {
  const t = STATUS.totals; if (!t) return;
  const reviews = t.reviews_completed, needed = t.papers * STATUS.params.completion_threshold;
  const pct = needed ? Math.round(100 * reviews / needed) : 0;
  $("#progressFill").style.width = pct + "%";
  $("#progressText").textContent =
    `${reviews} / ${needed} reviews in · ${t.done} papers done · ` +
    `${t.total_outstanding} reviews still needed across ${t.papers} papers`;
  $("#progress").hidden = false;
}

function statusBadge(s) {
  return el("span", { className: "badge b-" + s, textContent: s });
}

function renderPool() {
  const q = $("#search").value.trim().toLowerCase();
  const mod = $("#modality").value, st = $("#status").value, needy = $("#needy").checked;
  const tbody = $("#poolTable tbody");
  tbody.replaceChildren();
  let n = 0;
  for (const p of POOL) {
    const s = STATUS.papers?.[p.id] || { live_claims: 0, completed_reviews: 0, status: "open", outstanding_need: 3 };
    if (mod && p.modality !== mod) continue;
    if (st && s.status !== st) continue;
    if (needy && s.outstanding_need === 0) continue;
    if (q && !(`${p.id} ${p.title} ${p.first_author}`.toLowerCase().includes(q))) continue;
    n++;
    const title = el("td", {},
      el("a", { href: p.url, target: "_blank", rel: "noopener", textContent: p.title }),
      el("div", { className: "meta", textContent: `${p.first_author || ""}${p.year ? " · " + p.year : ""}${p.level === 0 ? " · seed review" : ""}` }));
    const canClaim = s.status === "open";
    const action = canClaim
      ? el("a", { className: "claim", href: NEW_ISSUE(p.id), textContent: "Claim" })
      : el("span", { className: "muted", textContent: s.status === "done" ? "—" : "closed" });
    tbody.append(el("tr", {},
      el("td", { textContent: p.id }),
      el("td", { textContent: p.modality }),
      title,
      el("td", { className: "num", textContent: `${s.live_claims}/${STATUS.params.pool_close_threshold}` }),
      el("td", { className: "num", textContent: `${s.completed_reviews}/${STATUS.params.completion_threshold}` }),
      el("td", {}, statusBadge(s.status)),
      el("td", {}, action)));
  }
  $("#poolCount").textContent = `${n} paper${n === 1 ? "" : "s"} shown of ${POOL.length}.`;
}

function renderBoard() {
  const rows = RANKING.participants || [];
  const tbody = $("#boardTable tbody");
  tbody.replaceChildren();
  $("#boardEmpty").hidden = rows.length > 0;
  $("#boardTable").hidden = rows.length === 0;
  for (const r of rows) {
    tbody.append(el("tr", {},
      el("td", { className: "num", textContent: r.rank }),
      el("td", { textContent: r.display }),
      el("td", { className: "num", textContent: r.points.toFixed(2) }),
      el("td", { className: "num", textContent: r.reviews }),
      el("td", { className: "num", textContent: r.mean.toFixed(2) })));
  }
}

// tabs + controls
document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("active", x === b));
  $("#pool").hidden = b.dataset.tab !== "pool";
  $("#board").hidden = b.dataset.tab !== "board";
}));
["#search", "#modality", "#status", "#needy"].forEach(s =>
  $(s).addEventListener("input", renderPool));

load().catch(e => { $("#poolCount").textContent = "Could not load data: " + e; });
