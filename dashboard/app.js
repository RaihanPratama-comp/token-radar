// Token Launch Radar dashboard — stage 2. Reads window.BOARD_DATA (compact
// tuples written by main.ts) from data.js and rebuilds full rows here.
// Tuple: [slug, name, category, chains, tvl_usd, change_7d,
//         implied_value_usd, token_recorded?1:0, watchlist?1:0, age_days]
// why, farm_steps and token_status are regenerated with the exact same
// templates lib/model.ts uses for board.json, so the detail view shows
// the same plan the board carries.
function farmStepsFor(r) {
  const chain = r.chains[0] ?? "Ethereum";
  const chainList = (r.chains.length > 3 ? r.chains.slice(0, 3).join(", ") + ` and ${r.chains.length - 3} more chains` : r.chains.join(", ")) || chain;
  const kind = !r.token_recorded
    ? "not recorded as having a token, so activity may count toward a future distribution"
    : "already has a recorded token, so farm its points, fees and governance rewards instead";
  return [
    `Open ${r.name} (${r.category} on ${chainList}) and read its docs first: about 20 minutes, $0 cost, note every points or season program it mentions.`,
    `Connect a fresh wallet on ${chain} and make one small real deposit of $25-$100 for 30-45 minutes of setup; keep gas money aside, roughly $2-$10 per transaction.`,
    `Use the core ${r.category} action weekly for 6-8 weeks (about 10 minutes each week, $5-$20 total gas) so activity looks sustained, not a one-day burst.`,
    `Track eligibility monthly in a simple sheet: wallet, dates, volume and cost per step, 15 minutes a month, $0; ${r.name} is ${kind}.`,
    `Set a monthly review alarm: re-check TVL and announcements for 10 minutes, $0 cost, and stop farming if total spend passes $150 without a confirmed program.`,
  ];
}
function rebuildRows(tuples) {
  return tuples.map((a, i) => {
    const r = {
      rank: i + 1, slug: a[0], name: a[1], category: a[2], chains: a[3],
      tvl_usd: a[4], change_7d: a[5], implied_value_usd: a[6],
      token_recorded: a[7] === 1, watchlist: a[8] === 1, age_days: a[9],
    };
    r.token_status = r.token_recorded
      ? "Token recorded (symbol, listing or market cap present in snapshot)"
      : "Not recorded as having a token in this snapshot";
    r.why = `$${r.tvl_usd.toLocaleString("en-US")} TVL, ${r.change_7d === null ? "no 7d change recorded" : r.change_7d.toFixed(1) + "% in 7 days"}, ${r.age_days === null ? "listing date not recorded" : r.age_days + " days in the snapshot"}, valued against the median market-cap/TVL of token-recorded ${r.category} peers in this same snapshot.`;
    r.farm_steps = farmStepsFor(r);
    return r;
  });
}
const board = rebuildRows(Array.isArray(window.BOARD_DATA) ? window.BOARD_DATA : []);
const $ = (id) => document.getElementById(id);
const money = (v) => "$" + Math.round(v).toLocaleString("en-US");
const pct = (v) => v === null || v === undefined ? "—" : (v >= 0 ? "+" : "") + Number(v).toFixed(1) + "%";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function stats() {
  const pre = board.filter((r) => !r.token_recorded);
  const total = pre.reduce((n, r) => n + r.implied_value_usd, 0);
  const top = board[0];
  $("stats").innerHTML =
    `<div class="stat"><b>${board.length}</b>ranked protocols</div>` +
    `<div class="stat"><b>${pre.length}</b>not recorded as having a token</div>` +
    `<div class="stat"><b>${money(total)}</b>total implied pre-token value</div>` +
    (top ? `<div class="stat"><b>#1 ${top.name}</b>${money(top.implied_value_usd)} implied</div>` : "");
}

function filtered() {
  const q = $("q").value.trim().toLowerCase();
  const st = $("status").value, so = $("sort").value;
  let rows = board.filter((r) => {
    if (st === "pre" && r.token_recorded) return false;
    if (st === "traded" && !r.token_recorded) return false;
    if (st === "watch" && !r.watchlist) return false;
    if (q && !(r.name + " " + r.category + " " + r.chains.join(" ")).toLowerCase().includes(q)) return false;
    return true;
  });
  const key = { value: "implied_value_usd", tvl: "tvl_usd", change: "change_7d", age: "age_days" }[so];
  rows = [...rows].sort((a, b) => (b[key] ?? -1e18) - (a[key] ?? -1e18));
  return rows;
}

function render() {
  const rows = filtered();
  $("rows").innerHTML = rows.map((r) =>
    `<tr data-slug="${r.slug}"><td>${r.rank}${r.watchlist ? ' <span class="watch">★</span>' : ""}</td>` +
    `<td><b>${esc(r.name)}</b><br><small>${esc(r.chains.join(", "))}</small></td><td>${esc(r.category)}</td>` +
    `<td>${money(r.tvl_usd)}</td><td class="${(r.change_7d ?? 0) >= 0 ? "up" : "down"}">${pct(r.change_7d)}</td>` +
    `<td><b>${money(r.implied_value_usd)}</b></td>` +
    `<td class="${r.token_recorded ? "traded" : "pre"}">${r.token_recorded ? "Token recorded" : "Pre-token candidate"}</td></tr>`).join("");
  for (const tr of document.querySelectorAll("tbody tr")) {
    tr.addEventListener("click", () => {
      detail(tr.getAttribute("data-slug"));
      $("detail").scrollIntoView({ block: "nearest" });
    });
  }
}

function detail(slug) {
  const r = board.find((x) => x.slug === slug);
  if (!r) return;
  $("detail").innerHTML =
    `<h2>#${r.rank} ${esc(r.name)} — ${money(r.implied_value_usd)} implied value</h2>` +
    `<p><i>${esc(r.why || "")}</i></p>` +
    `<p>${r.category} on ${r.chains.join(", ")} · TVL ${money(r.tvl_usd)} · 7d ${pct(r.change_7d)} · ` +
    `${r.age_days === null ? "listing date not recorded" : r.age_days + " days in snapshot"} · ${r.token_status}.</p>` +
    `<h3>How to farm it</h3><ol>${r.farm_steps.map((s) => `<li>${s}</li>`).join("")}</ol>`;
}

for (const id of ["q", "status", "sort"]) $(id).addEventListener("input", render);
stats(); render();
if (board.length) $("toppick").innerHTML = `Top farm today: <b>${esc(board[0].name)}</b> — ${money(board[0].implied_value_usd)} implied value, ${money(board[0].tvl_usd)} TVL. Click its row for the full farm plan.`;
if (board.length) detail(board[0].slug);
